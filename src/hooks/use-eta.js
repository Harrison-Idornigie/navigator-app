import { useState, useEffect, useCallback, useRef } from 'react';
import etaService from '../services/ETAService';
import useFleetbase from './use-fleetbase';

/**
 * Hook for managing real-time ETA data
 */
const useETA = (options = {}) => {
    const { adapter } = useFleetbase();
    const [etas, setETAs] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isMonitoring, setIsMonitoring] = useState(false);
    
    const listenersRef = useRef([]);
    const monitoringTripsRef = useRef(new Set());

    // Initialize ETA service
    useEffect(() => {
        if (adapter && !etaService.isInitialized) {
            etaService.initialize(adapter);
        }
    }, [adapter]);

    // Calculate ETA for a specific destination
    const calculateETA = useCallback(async (busId, destination, etaOptions = {}) => {
        if (!adapter) {
            throw new Error('Fleetbase adapter not available');
        }

        setLoading(true);
        setError(null);

        try {
            const result = await etaService.calculateBusETA(busId, destination, etaOptions);
            
            // Update local state
            setETAs(prev => ({
                ...prev,
                [`${busId}_${destination.lat}_${destination.lng}`]: result
            }));

            setLoading(false);
            return result;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, [adapter]);

    // Get ETAs for all stops on a route
    const getRouteETAs = useCallback(async (tripId, etaOptions = {}) => {
        if (!adapter) {
            throw new Error('Fleetbase adapter not available');
        }

        setLoading(true);
        setError(null);

        try {
            const result = await etaService.getRouteETAs(tripId, etaOptions);
            
            // Update local state
            setETAs(prev => ({
                ...prev,
                [`route_${tripId}`]: result
            }));

            setLoading(false);
            return result;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, [adapter]);

    // Get ETA for a specific stop
    const getStopETA = useCallback(async (routeId, stopId, etaOptions = {}) => {
        if (!adapter) {
            throw new Error('Fleetbase adapter not available');
        }

        setLoading(true);
        setError(null);

        try {
            const result = await etaService.getStopETA(routeId, stopId, etaOptions);
            
            // Update local state
            setETAs(prev => ({
                ...prev,
                [`stop_${routeId}_${stopId}`]: result
            }));

            setLoading(false);
            return result;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, [adapter]);

    // Check proximity of bus to stop
    const checkProximity = useCallback(async (busId, stopCoordinates, thresholdKm = 0.5) => {
        if (!adapter) {
            throw new Error('Fleetbase adapter not available');
        }

        try {
            const result = await etaService.checkProximity(busId, stopCoordinates, thresholdKm);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [adapter]);

    // Start monitoring ETAs for a trip
    const startMonitoring = useCallback(async (tripId, monitoringOptions = {}) => {
        if (!adapter) {
            console.warn('Fleetbase adapter not available for ETA monitoring');
            return null;
        }

        try {
            const subscriptionKey = await etaService.startETAMonitoring(tripId, {
                updateInterval: options.updateInterval || 30,
                provider: options.provider || 'google',
                ...monitoringOptions
            });

            monitoringTripsRef.current.add(tripId);
            setIsMonitoring(true);

            // Set up event listener for this trip
            const listener = etaService.onTripETAUpdate(tripId, (data) => {
                setETAs(prev => ({
                    ...prev,
                    [`route_${tripId}`]: data.etas
                }));
            });

            listenersRef.current.push({ listener, tripId });

            return subscriptionKey;
        } catch (err) {
            setError(err.message);
            console.error('Failed to start ETA monitoring:', err);
            return null;
        }
    }, [adapter, options.updateInterval, options.provider]);

    // Stop monitoring ETAs for a trip
    const stopMonitoring = useCallback((tripId) => {
        etaService.stopETAMonitoring(tripId);
        monitoringTripsRef.current.delete(tripId);

        // Remove event listener for this trip
        listenersRef.current = listenersRef.current.filter(({ listener, tripId: listenerTripId }) => {
            if (listenerTripId === tripId) {
                etaService.removeListener(listener);
                return false;
            }
            return true;
        });

        if (monitoringTripsRef.current.size === 0) {
            setIsMonitoring(false);
        }

        console.log(`Stopped monitoring ETA for trip: ${tripId}`);
    }, []);

    // Stop all monitoring
    const stopAllMonitoring = useCallback(() => {
        etaService.stopAllMonitoring();
        
        // Remove all event listeners
        listenersRef.current.forEach(({ listener }) => {
            etaService.removeListener(listener);
        });
        listenersRef.current = [];

        monitoringTripsRef.current.clear();
        setIsMonitoring(false);

        console.log('Stopped all ETA monitoring');
    }, []);

    // Get ETA data for a specific key
    const getETAData = useCallback((key) => {
        return etas[key] || null;
    }, [etas]);

    // Get ETA for bus to destination
    const getBusETA = useCallback((busId, destination) => {
        const key = `${busId}_${destination.lat}_${destination.lng}`;
        return etas[key] || null;
    }, [etas]);

    // Get route ETAs
    const getRouteETAData = useCallback((tripId) => {
        const key = `route_${tripId}`;
        return etas[key] || null;
    }, [etas]);

    // Get stop ETA data
    const getStopETAData = useCallback((routeId, stopId) => {
        const key = `stop_${routeId}_${stopId}`;
        return etas[key] || null;
    }, [etas]);

    // Format ETA for display
    const formatETA = useCallback((minutes) => {
        return etaService.formatETA(minutes);
    }, []);

    // Get arrival time
    const getArrivalTime = useCallback((etaMinutes) => {
        return etaService.getArrivalTime(etaMinutes);
    }, []);

    // Check if arriving now
    const isArrivingNow = useCallback((etaMinutes, thresholdMinutes = 2) => {
        return etaService.isArrivingNow(etaMinutes, thresholdMinutes);
    }, []);

    // Get status color for ETA
    const getETAStatusColor = useCallback((etaMinutes) => {
        return etaService.getETAStatusColor(etaMinutes);
    }, []);

    // Format distance
    const formatDistance = useCallback((distanceKm) => {
        return etaService.formatDistance(distanceKm);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Remove all listeners
            listenersRef.current.forEach(({ listener }) => {
                etaService.removeListener(listener);
            });
            
            // Stop all monitoring for this component
            monitoringTripsRef.current.forEach(tripId => {
                etaService.stopETAMonitoring(tripId);
            });
        };
    }, []);

    return {
        // State
        etas,
        loading,
        error,
        isMonitoring,

        // Actions
        calculateETA,
        getRouteETAs,
        getStopETA,
        checkProximity,
        startMonitoring,
        stopMonitoring,
        stopAllMonitoring,

        // Getters
        getETAData,
        getBusETA,
        getRouteETAData,
        getStopETAData,

        // Formatters
        formatETA,
        getArrivalTime,
        isArrivingNow,
        getETAStatusColor,
        formatDistance,

        // Utils
        clearError: () => setError(null)
    };
};

export default useETA;