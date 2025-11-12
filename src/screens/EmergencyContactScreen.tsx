import React, { useState, useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, YStack, XStack, Button, ScrollView, useTheme } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { 
    faPhone,
    faExclamationTriangle,
    faAmbulance,
    faShieldAlt,
    faTools,
    faBullhorn,
    faMapMarkerAlt,
    faUsers,
    faClock
} from '@fortawesome/free-solid-svg-icons';
import { useLocation } from '../contexts/LocationContext';
import { useFleetbase } from '../contexts/FleetbaseContext';
import { config } from '../utils/config';
import useAppTheme from '../hooks/use-app-theme';

const WidgetContainer = ({ children, ...props }) => {
    const { isDarkMode } = useAppTheme();
    return (
        <YStack 
            borderRadius='$6' 
            bg='$surface' 
            padding='$4' 
            borderWidth={1} 
            borderColor={isDarkMode ? '$transparent' : '$gray-300'} 
            marginBottom='$4'
            {...props}
        >
            {children}
        </YStack>
    );
};

const EmergencyContactButton = ({ contact, onPress, icon, theme: buttonTheme = 'red' }) => {
    return (
        <Button
            size='$5'
            theme={buttonTheme}
            onPress={() => onPress(contact)}
            marginBottom='$3'
        >
            <XStack alignItems='center' space='$3' width='100%'>
                <FontAwesomeIcon icon={icon} size={20} color='white' />
                <YStack flex={1} alignItems='flex-start'>
                    <Text color='white' fontSize='$4' fontWeight='600'>
                        {contact.name}
                    </Text>
                    <Text color='white' fontSize='$3' opacity={0.8}>
                        {contact.title || contact.phone}
                    </Text>
                </YStack>
            </XStack>
        </Button>
    );
};

const EmergencyContactScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const { location } = useLocation();
    const { fleetbase } = useFleetbase();
    
    const [emergencyContacts, setEmergencyContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [emergencyActive, setEmergencyActive] = useState(false);
    const [lastEmergencyCall, setLastEmergencyCall] = useState(null);

    // Default emergency contacts
    const defaultContacts = [
        {
            id: 'dispatch',
            name: 'School Dispatch',
            phone: config('SCHOOL_DISPATCH_PHONE', '555-0100'),
            title: 'Transportation Dispatch',
            type: 'dispatch',
            priority: 1
        },
        {
            id: 'maintenance',
            name: 'Vehicle Maintenance',
            phone: config('MAINTENANCE_PHONE', '555-0200'),
            title: 'Emergency Breakdown',
            type: 'maintenance',
            priority: 3
        },
        {
            id: 'principal',
            name: 'School Principal',
            phone: config('PRINCIPAL_PHONE', '555-0300'),
            title: 'School Administration',
            type: 'admin',
            priority: 4
        }
    ];

    useEffect(() => {
        loadEmergencyContacts();
    }, []);

    const loadEmergencyContacts = async () => {
        try {
            setLoading(true);
            
            // Load emergency contacts from settings
            const settingsResponse = await fleetbase.get('/int/v1/school-transport/settings/emergency-contacts');
            
            if (settingsResponse.data?.contacts) {
                setEmergencyContacts([
                    ...defaultContacts,
                    ...settingsResponse.data.contacts
                ].sort((a, b) => (a.priority || 5) - (b.priority || 5)));
            } else {
                setEmergencyContacts(defaultContacts);
            }
        } catch (error) {
            console.warn('Failed to load emergency contacts:', error);
            setEmergencyContacts(defaultContacts);
        } finally {
            setLoading(false);
        }
    };

    const makeEmergencyCall = (contact) => {
        Alert.alert(
            'Emergency Call',
            `Call ${contact.name} at ${contact.phone}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Call', 
                    style: 'destructive',
                    onPress: () => {
                        // Record the emergency call
                        recordEmergencyCall(contact);
                        
                        // Make the phone call
                        const phoneUrl = Platform.OS === 'ios' ? `tel:${contact.phone}` : `tel:${contact.phone}`;
                        Linking.openURL(phoneUrl).catch(err => {
                            console.error('Failed to make call:', err);
                            Alert.alert('Error', 'Unable to make phone call');
                        });
                    }
                }
            ]
        );
    };

    const recordEmergencyCall = async (contact) => {
        try {
            const callData = {
                contact_id: contact.id,
                contact_name: contact.name,
                contact_phone: contact.phone,
                contact_type: contact.type,
                timestamp: new Date().toISOString(),
                driver_uuid: fleetbase.currentUser?.uuid,
                location: location ? {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                } : null,
                vehicle_uuid: null // Would get from current assignment
            };

            await fleetbase.post('/school-transport/emergency-calls', callData);
            setLastEmergencyCall(callData);
            
            // Also create a communication record for tracking
            await fleetbase.post('/school-transport/communications/send-notification', {
                type: 'emergency',
                recipients: [contact.phone],
                message: `Emergency call initiated by driver at ${new Date().toLocaleString()}`,
                priority: 'emergency'
            });

        } catch (error) {
            console.error('Failed to record emergency call:', error);
        }
    };

    const call911 = () => {
        Alert.alert(
            'Emergency 911 Call',
            'This will call 911 emergency services. Only use for life-threatening emergencies.',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Call 911', 
                    style: 'destructive',
                    onPress: () => {
                        setEmergencyActive(true);
                        recordEmergencyCall({
                            id: '911',
                            name: '911 Emergency',
                            phone: '911',
                            type: 'emergency'
                        });
                        
                        Linking.openURL('tel:911').catch(err => {
                            console.error('Failed to call 911:', err);
                            Alert.alert('Error', 'Unable to call 911');
                        });
                    }
                }
            ]
        );
    };

    const broadcastEmergency = async () => {
        Alert.alert(
            'Emergency Broadcast',
            'This will notify all emergency contacts simultaneously. Use only for serious incidents.',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Send Alert', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const emergencyData = {
                                type: 'emergency_broadcast',
                                driver_uuid: fleetbase.currentUser?.uuid,
                                timestamp: new Date().toISOString(),
                                location: location ? {
                                    latitude: location.coords.latitude,
                                    longitude: location.coords.longitude
                                } : null,
                                message: 'EMERGENCY: Driver has activated emergency broadcast. Immediate assistance required.',
                                contacts: emergencyContacts.map(c => c.phone)
                            };

                            await fleetbase.post('/school-transport/emergency-broadcast', emergencyData);
                            
                            Alert.alert(
                                'Emergency Alert Sent',
                                'All emergency contacts have been notified. Help is on the way.',
                                [{ text: 'OK' }]
                            );

                        } catch (error) {
                            console.error('Failed to send emergency broadcast:', error);
                            Alert.alert('Error', 'Failed to send emergency alert');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <YStack flex={1} bg='$background' justifyContent='center' alignItems='center'>
                <Text color='$textPrimary'>Loading emergency contacts...</Text>
            </YStack>
        );
    }

    return (
        <YStack flex={1} bg='$background'>
            <ScrollView>
                <YStack padding='$4'>
                    {/* Emergency Header */}
                    <WidgetContainer bg='$red-50' borderColor='$red-200'>
                        <XStack alignItems='center' space='$3' marginBottom='$3'>
                            <FontAwesomeIcon icon={faExclamationTriangle} size={24} color={theme.errorBorder.val} />
                            <Text fontSize='$6' fontWeight='600' color='$errorBorder'>
                                Emergency Contacts
                            </Text>
                        </XStack>
                        <Text fontSize='$3' color='$textSecondary'>
                            Quick access to emergency contacts and services. Use responsibly.
                        </Text>
                    </WidgetContainer>

                    {/* 911 Emergency */}
                    <WidgetContainer>
                        <Button
                            size='$6'
                            theme='red'
                            onPress={call911}
                            marginBottom='$3'
                        >
                            <XStack alignItems='center' space='$3'>
                                <FontAwesomeIcon icon={faAmbulance} size={32} color='white' />
                                <YStack alignItems='flex-start'>
                                    <Text color='white' fontSize='$7' fontWeight='700'>
                                        CALL 911
                                    </Text>
                                    <Text color='white' fontSize='$3' opacity={0.9}>
                                        Life-threatening emergencies only
                                    </Text>
                                </YStack>
                            </XStack>
                        </Button>
                        
                        <Button
                            size='$5'
                            theme='orange'
                            onPress={broadcastEmergency}
                        >
                            <XStack alignItems='center' space='$3'>
                                <FontAwesomeIcon icon={faBullhorn} size={20} color='white' />
                                <Text color='white' fontSize='$4' fontWeight='600'>
                                    Emergency Broadcast
                                </Text>
                            </XStack>
                        </Button>
                    </WidgetContainer>

                    {/* School Emergency Contacts */}
                    <Text fontSize='$5' fontWeight='600' color='$textPrimary' marginBottom='$3'>
                        School Emergency Contacts
                    </Text>

                    {emergencyContacts
                        .filter(contact => contact.type !== 'external')
                        .map((contact) => {
                            const getIcon = () => {
                                switch (contact.type) {
                                    case 'dispatch': return faBullhorn;
                                    case 'maintenance': return faTools;
                                    case 'admin': return faUsers;
                                    case 'security': return faShieldAlt;
                                    default: return faPhone;
                                }
                            };

                            return (
                                <EmergencyContactButton
                                    key={contact.id}
                                    contact={contact}
                                    icon={getIcon()}
                                    theme='blue'
                                    onPress={makeEmergencyCall}
                                />
                            );
                        })}

                    {/* External Emergency Services */}
                    {emergencyContacts.some(c => c.type === 'external') && (
                        <>
                            <Text fontSize='$5' fontWeight='600' color='$textPrimary' marginBottom='$3' marginTop='$4'>
                                External Emergency Services
                            </Text>
                            
                            {emergencyContacts
                                .filter(contact => contact.type === 'external')
                                .map((contact) => (
                                    <EmergencyContactButton
                                        key={contact.id}
                                        contact={contact}
                                        icon={faPhone}
                                        theme='gray'
                                        onPress={makeEmergencyCall}
                                    />
                                ))}
                        </>
                    )}

                    {/* Current Location */}
                    {location && (
                        <WidgetContainer>
                            <Text fontSize='$4' fontWeight='600' color='$textPrimary' marginBottom='$3'>
                                Current Location
                            </Text>
                            <XStack alignItems='center' space='$2'>
                                <FontAwesomeIcon icon={faMapMarkerAlt} size={16} color={theme.textSecondary.val} />
                                <Text fontSize='$3' color='$textSecondary'>
                                    {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
                                </Text>
                            </XStack>
                            <Text fontSize='$2' color='$textSecondary' marginTop='$2'>
                                Share this location with emergency responders if needed
                            </Text>
                        </WidgetContainer>
                    )}

                    {/* Recent Emergency Call */}
                    {lastEmergencyCall && (
                        <WidgetContainer bg='$yellow-50' borderColor='$yellow-200'>
                            <Text fontSize='$4' fontWeight='600' color='$textPrimary' marginBottom='$2'>
                                Recent Emergency Call
                            </Text>
                            <XStack alignItems='center' space='$2' marginBottom='$1'>
                                <FontAwesomeIcon icon={faPhone} size={14} color={theme.textSecondary.val} />
                                <Text fontSize='$3' color='$textSecondary'>
                                    {lastEmergencyCall.contact_name} at {new Date(lastEmergencyCall.timestamp).toLocaleTimeString()}
                                </Text>
                            </XStack>
                            <Text fontSize='$2' color='$warningBorder'>
                                Emergency services have been notified
                            </Text>
                        </WidgetContainer>
                    )}

                    {/* Emergency Instructions */}
                    <WidgetContainer>
                        <Text fontSize='$4' fontWeight='600' color='$textPrimary' marginBottom='$3'>
                            Emergency Instructions
                        </Text>
                        <YStack space='$2'>
                            <Text fontSize='$3' color='$textSecondary'>
                                • Call 911 for life-threatening emergencies
                            </Text>
                            <Text fontSize='$3' color='$textSecondary'>
                                • Contact dispatch for vehicle breakdowns
                            </Text>
                            <Text fontSize='$3' color='$textSecondary'>
                                • Notify school admin for student incidents
                            </Text>
                            <Text fontSize='$3' color='$textSecondary'>
                                • Use emergency broadcast for serious incidents
                            </Text>
                            <Text fontSize='$3' color='$textSecondary'>
                                • Always prioritize student and public safety
                            </Text>
                        </YStack>
                    </WidgetContainer>
                </YStack>
            </ScrollView>
        </YStack>
    );
};

export default EmergencyContactScreen;