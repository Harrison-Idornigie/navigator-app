import React, { useState, useEffect } from 'react';
import { Alert, Vibration } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { 
    faSchool,
    faExclamationTriangle,
    faTachometerAlt,
    faMapMarkerAlt,
    faBellSlash,
    faVolumeUp
} from '@fortawesome/free-solid-svg-icons';
import { Text, YStack, XStack, useTheme, View } from 'tamagui';
import { useLocation } from '../contexts/LocationContext';
import { useFleetbase } from '../contexts/FleetbaseContext';
import { config, toNumber } from '../utils/config';
import useAppTheme from '../hooks/use-app-theme';

const SafetyAlert = ({ alert, onDismiss }) => {
    const theme = useTheme();
    const { isDarkMode } = useAppTheme();

    const getAlertColor = () => {
        switch (alert.severity) {
            case 'critical': return theme.errorBorder.val;
            case 'warning': return theme.warningBorder.val;
            case 'info': return theme.infoBorder.val;
            default: return theme.textSecondary.val;
        }
    };

    const getAlertIcon = () => {
        switch (alert.type) {
            case 'school_zone': return faSchool;
            case 'speed_limit': return faTachometerAlt;
            case 'bus_stop': return faMapMarkerAlt;
            default: return faExclamationTriangle;
        }
    };

    return (
        <View
            position='absolute'
            top='$4'
            left='$4'
            right='$4'
            bg={isDarkMode ? '$gray-800' : 'white'}
            borderRadius='$4'
            padding='$4'
            borderWidth={2}
            borderColor={getAlertColor()}
            shadowColor='$shadow'
            shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.25}
            shadowRadius={8}
            elevation={5}
            zIndex={1000}
        >
            <XStack alignItems='center' space='$3'>
                <View
                    width={40}
                    height={40}
                    borderRadius={20}
                    bg={getAlertColor()}
                    alignItems='center'
                    justifyContent='center'
                >
                    <FontAwesomeIcon 
                        icon={getAlertIcon()} 
                        size={20} 
                        color='white' 
                    />
                </View>
                
                <YStack flex={1}>
                    <Text fontSize='$4' fontWeight='600' color='$textPrimary'>
                        {alert.title}
                    </Text>
                    <Text fontSize='$3' color='$textSecondary'>
                        {alert.message}
                    </Text>
                    {alert.currentSpeed && alert.speedLimit && (
                        <Text fontSize='$2' color={getAlertColor()} marginTop='$1'>
                            Current: {alert.currentSpeed} mph • Limit: {alert.speedLimit} mph
                        </Text>
                    )}
                </YStack>

                <View
                    width={32}
                    height={32}
                    borderRadius={16}
                    bg='$gray-200'
                    alignItems='center'
                    justifyContent='center'
                    onTouchEnd={onDismiss}
                >
                    <FontAwesomeIcon 
                        icon={faBellSlash} 
                        size={16} 
                        color={theme.textSecondary.val} 
                    />
                </View>
            </XStack>
        </View>
    );
};

const SchoolZoneSafetyAlerts = ({ children }) => {
    const { location } = useLocation();
    const { fleetbase } = useFleetbase();
    
    const [currentAlert, setCurrentAlert] = useState(null);
    const [schoolZones, setSchoolZones] = useState([]);
    const [busStops, setBusStops] = useState([]);
    const [alertsEnabled, setAlertsEnabled] = useState(true);
    const [lastAlertTime, setLastAlertTime] = useState(0);
    
    // Safety settings from config
    const schoolZoneSpeedLimit = toNumber(config('SCHOOL_ZONE_SPEED_LIMIT', 25));
    const speedWarningsEnabled = config('ENABLE_SPEED_WARNINGS', 'true') === 'true';
    const schoolZoneAlertsEnabled = config('ENABLE_SCHOOL_ZONE_ALERTS', 'true') === 'true';
    const alertCooldownMs = 10000; // 10 seconds between similar alerts

    useEffect(() => {
        if (schoolZoneAlertsEnabled) {
            loadSchoolZones();
            loadBusStops();
        }
    }, [schoolZoneAlertsEnabled]);

    useEffect(() => {
        if (location && alertsEnabled && schoolZoneAlertsEnabled) {
            checkSafetyAlerts();
        }
    }, [location, alertsEnabled, schoolZoneAlertsEnabled]);

    const loadSchoolZones = async () => {
        try {
            // Load school zones from the backend
            const response = await fleetbase.get('/school-transport/school-zones');
            setSchoolZones(response.data || []);
        } catch (error) {
            console.warn('Failed to load school zones:', error);
            // Fallback to default school zones
            setSchoolZones([]);
        }
    };

    const loadBusStops = async () => {
        try {
            // Get current trip and route stops
            const tripsResponse = await fleetbase.get('/school-transport/trips', {
                params: {
                    status: 'active',
                    driver_uuid: fleetbase.currentUser?.uuid
                }
            });

            if (tripsResponse.data?.length > 0) {
                const trip = tripsResponse.data[0];
                if (trip.route?.stops) {
                    setBusStops(trip.route.stops);
                }
            }
        } catch (error) {
            console.warn('Failed to load bus stops:', error);
            setBusStops([]);
        }
    };

    const checkSafetyAlerts = () => {
        if (!location?.coords) return;

        const currentSpeed = location.coords.speed ? Math.round(location.coords.speed * 2.237) : 0; // Convert m/s to mph
        const currentLat = location.coords.latitude;
        const currentLng = location.coords.longitude;
        const now = Date.now();

        // Prevent spam alerts
        if (now - lastAlertTime < alertCooldownMs) return;

        // Check school zone proximity and speed
        const nearbySchoolZone = schoolZones.find(zone => 
            isWithinRadius(currentLat, currentLng, zone.latitude, zone.longitude, zone.radius || 500)
        );

        if (nearbySchoolZone) {
            const zoneSpeedLimit = nearbySchoolZone.speed_limit || schoolZoneSpeedLimit;
            
            if (speedWarningsEnabled && currentSpeed > zoneSpeedLimit) {
                showAlert({
                    id: 'school_zone_speed',
                    type: 'school_zone',
                    severity: currentSpeed > (zoneSpeedLimit + 10) ? 'critical' : 'warning',
                    title: 'School Zone Speed Alert',
                    message: `Slow down! You're in a school zone.`,
                    currentSpeed,
                    speedLimit: zoneSpeedLimit,
                    location: nearbySchoolZone.name
                });
                return;
            }

            // Show info alert when entering school zone
            if (!currentAlert?.type === 'school_zone') {
                showAlert({
                    id: 'school_zone_entry',
                    type: 'school_zone',
                    severity: 'info',
                    title: 'School Zone',
                    message: `Entering ${nearbySchoolZone.name}. Speed limit: ${zoneSpeedLimit} mph`,
                    speedLimit: zoneSpeedLimit
                });
                return;
            }
        }

        // Check bus stop proximity
        const nearbyBusStop = busStops.find(stop => 
            isWithinRadius(currentLat, currentLng, stop.latitude, stop.longitude, 100) // 100m radius
        );

        if (nearbyBusStop) {
            // Show bus stop alert if approaching
            if (currentSpeed > 15) { // Alert if going faster than 15 mph near bus stop
                showAlert({
                    id: 'bus_stop_approach',
                    type: 'bus_stop',
                    severity: 'warning',
                    title: 'Bus Stop Ahead',
                    message: `Approaching ${nearbyBusStop.name}. Prepare to stop.`,
                    currentSpeed,
                    speedLimit: 15
                });
                return;
            }
        }

        // Clear alert if no longer in danger zones
        if (currentAlert && !nearbySchoolZone && !nearbyBusStop) {
            setCurrentAlert(null);
        }
    };

    const showAlert = (alertData) => {
        setCurrentAlert(alertData);
        setLastAlertTime(Date.now());

        // Vibrate for critical alerts
        if (alertData.severity === 'critical') {
            Vibration.vibrate([200, 100, 200]);
        } else if (alertData.severity === 'warning') {
            Vibration.vibrate(200);
        }

        // Auto-dismiss info alerts after 5 seconds
        if (alertData.severity === 'info') {
            setTimeout(() => {
                setCurrentAlert(prev => prev?.id === alertData.id ? null : prev);
            }, 5000);
        }
    };

    const dismissAlert = () => {
        setCurrentAlert(null);
    };

    const toggleAlerts = () => {
        setAlertsEnabled(!alertsEnabled);
        if (!alertsEnabled) {
            setCurrentAlert(null);
        }
    };

    // Calculate distance between two points using Haversine formula
    const isWithinRadius = (lat1, lng1, lat2, lng2, radiusMeters) => {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lng2-lng1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        const distance = R * c;
        return distance <= radiusMeters;
    };

    return (
        <View flex={1}>
            {children}
            
            {/* Safety Alert Overlay */}
            {currentAlert && (
                <SafetyAlert 
                    alert={currentAlert}
                    onDismiss={dismissAlert}
                />
            )}

            {/* Alert Toggle Button (for debugging/testing) */}
            {__DEV__ && (
                <View
                    position='absolute'
                    bottom='$4'
                    right='$4'
                    width={48}
                    height={48}
                    borderRadius={24}
                    bg={alertsEnabled ? '$successBorder' : '$errorBorder'}
                    alignItems='center'
                    justifyContent='center'
                    onTouchEnd={toggleAlerts}
                >
                    <FontAwesomeIcon 
                        icon={alertsEnabled ? faVolumeUp : faBellSlash} 
                        size={20} 
                        color='white' 
                    />
                </View>
            )}
        </View>
    );
};

export default SchoolZoneSafetyAlerts;