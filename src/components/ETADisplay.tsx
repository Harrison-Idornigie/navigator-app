import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { YStack, XStack, Button, Separator } from 'tamagui';
import { Clock, MapPin, AlertCircle, Refresh, Navigation } from 'react-native-feather';
import useETA from '../hooks/use-eta';

/**
 * ETA Display Component - Shows real-time estimated arrival times
 */
const ETADisplay = ({ 
    tripId, 
    routeId, 
    busId,
    stops = [],
    showRefresh = true,
    autoRefresh = true,
    refreshInterval = 30,
    style,
    onStopPress,
    onETAUpdate
}) => {
    const {
        etas,
        loading,
        error,
        isMonitoring,
        getRouteETAs,
        getRouteETAData,
        startMonitoring,
        stopMonitoring,
        formatETA,
        getArrivalTime,
        isArrivingNow,
        getETAStatusColor,
        formatDistance,
        clearError
    } = useETA({ updateInterval: refreshInterval });

    const [lastRefresh, setLastRefresh] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Start monitoring when component mounts
    useEffect(() => {
        if (tripId && autoRefresh) {
            startMonitoring(tripId, { 
                updateInterval: refreshInterval,
                provider: 'google'
            });

            return () => {
                stopMonitoring(tripId);
            };
        }
    }, [tripId, autoRefresh, refreshInterval, startMonitoring, stopMonitoring]);

    // Notify parent of ETA updates
    useEffect(() => {
        const routeETAs = getRouteETAData(tripId);
        if (routeETAs && onETAUpdate) {
            onETAUpdate(routeETAs);
        }
    }, [etas, tripId, onETAUpdate, getRouteETAData]);

    // Manual refresh
    const handleRefresh = async () => {
        if (refreshing || loading || !tripId) return;

        setRefreshing(true);
        clearError();

        try {
            await getRouteETAs(tripId);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Failed to refresh ETAs:', err);
        } finally {
            setRefreshing(false);
        }
    };

    // Get current route ETAs
    const currentETAs = getRouteETAData(tripId);
    const etaList = currentETAs?.etas || [];

    // Render loading state
    if (loading && !currentETAs) {
        return (
            <YStack padding="$4" alignItems="center">
                <ActivityIndicator size="large" color="#0066CC" />
                <Text style={{ marginTop: 8, color: '#666' }}>Loading ETAs...</Text>
            </YStack>
        );
    }

    // Render error state
    if (error && !currentETAs) {
        return (
            <YStack padding="$4" alignItems="center">
                <AlertCircle width={24} height={24} color="#EF4444" />
                <Text style={{ marginTop: 8, color: '#EF4444', textAlign: 'center' }}>
                    Failed to load ETAs: {error}
                </Text>
                {showRefresh && (
                    <Button 
                        onPress={handleRefresh}
                        size="$3"
                        marginTop="$2"
                        disabled={refreshing}
                    >
                        {refreshing ? 'Retrying...' : 'Retry'}
                    </Button>
                )}
            </YStack>
        );
    }

    // Render empty state
    if (!etaList || etaList.length === 0) {
        return (
            <YStack padding="$4" alignItems="center">
                <MapPin width={24} height={24} color="#6B7280" />
                <Text style={{ marginTop: 8, color: '#6B7280', textAlign: 'center' }}>
                    No stops available for ETA calculation
                </Text>
            </YStack>
        );
    }

    const renderStopETA = (stop, index) => {
        const etaMinutes = stop.eta_minutes;
        const arrivalTime = getArrivalTime(etaMinutes);
        const isArriving = isArrivingNow(etaMinutes);
        const statusColor = getETAStatusColor(etaMinutes);
        const distance = formatDistance(stop.distance_km);

        return (
            <TouchableOpacity 
                key={stop.stop_id || index}
                onPress={() => onStopPress && onStopPress(stop)}
                activeOpacity={0.7}
                style={style}
            >
                <YStack 
                    backgroundColor="white"
                    borderRadius="$3"
                    padding="$3"
                    marginVertical="$1"
                    borderWidth={isArriving ? 2 : 1}
                    borderColor={isArriving ? statusColor : '#E5E7EB'}
                    shadowColor="#000"
                    shadowOffset={{ width: 0, height: 1 }}
                    shadowOpacity={0.1}
                    shadowRadius={2}
                    elevation={2}
                >
                    <XStack justifyContent="space-between" alignItems="center">
                        <YStack flex={1}>
                            <XStack alignItems="center" marginBottom="$1">
                                <View 
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: statusColor,
                                        marginRight: 8
                                    }}
                                />
                                <Text 
                                    fontSize="$4" 
                                    fontWeight="600" 
                                    color="#1F2937"
                                    numberOfLines={1}
                                >
                                    {stop.stop_name || `Stop ${stop.sequence}`}
                                </Text>
                            </XStack>
                            
                            {distance && (
                                <Text fontSize="$2" color="#6B7280" marginLeft="$4">
                                    {distance} away
                                </Text>
                            )}
                        </YStack>

                        <YStack alignItems="flex-end">
                            <XStack alignItems="center" marginBottom="$1">
                                <Clock width={14} height={14} color={statusColor} />
                                <Text 
                                    fontSize="$4" 
                                    fontWeight="bold"
                                    color={statusColor}
                                    marginLeft="$1"
                                >
                                    {formatETA(etaMinutes)}
                                </Text>
                            </XStack>
                            
                            {arrivalTime && !isArriving && (
                                <Text fontSize="$2" color="#6B7280">
                                    Arrives {arrivalTime}
                                </Text>
                            )}

                            {isArriving && (
                                <Text fontSize="$2" color={statusColor} fontWeight="600">
                                    ARRIVING NOW
                                </Text>
                            )}
                        </YStack>
                    </XStack>
                </YStack>
            </TouchableOpacity>
        );
    };

    return (
        <YStack>
            {/* Header with refresh button */}
            {showRefresh && (
                <XStack 
                    justifyContent="space-between" 
                    alignItems="center" 
                    padding="$3"
                    backgroundColor="#F9FAFB"
                >
                    <YStack>
                        <Text fontSize="$5" fontWeight="600" color="#1F2937">
                            Estimated Arrivals
                        </Text>
                        {lastRefresh && (
                            <Text fontSize="$2" color="#6B7280">
                                Updated {lastRefresh.toLocaleTimeString()}
                            </Text>
                        )}
                        {isMonitoring && (
                            <Text fontSize="$2" color="#10B981">
                                ● Live updates active
                            </Text>
                        )}
                    </YStack>

                    <TouchableOpacity 
                        onPress={handleRefresh}
                        disabled={refreshing || loading}
                        style={{
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor: refreshing ? '#F3F4F6' : '#EFF6FF'
                        }}
                    >
                        {refreshing ? (
                            <ActivityIndicator size="small" color="#0066CC" />
                        ) : (
                            <Refresh width={20} height={20} color="#0066CC" />
                        )}
                    </TouchableOpacity>
                </XStack>
            )}

            <Separator />

            {/* ETA List */}
            <YStack padding="$3">
                {etaList.map((stop, index) => renderStopETA(stop, index))}
            </YStack>

            {/* Footer info */}
            {currentETAs?.calculated_at && (
                <YStack padding="$3" backgroundColor="#F9FAFB">
                    <XStack alignItems="center" justifyContent="center">
                        <Navigation width={12} height={12} color="#6B7280" />
                        <Text fontSize="$1" color="#6B7280" marginLeft="$1">
                            ETAs calculated using real-time traffic data
                        </Text>
                    </XStack>
                </YStack>
            )}
        </YStack>
    );
};

export default ETADisplay;