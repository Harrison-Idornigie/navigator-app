import { EventRegister } from 'react-native-event-listeners';
import { config } from '../utils';
import useFleetbase from '../hooks/use-fleetbase';
import useAuth from '../hooks/use-auth';

/**
 * ETA Service for real-time estimated time of arrival calculations
 */
class ETAService {
    constructor() {
        this.adapter = null;
        this.isInitialized = false;
        this.activeSubscriptions = new Map();
        this.updateInterval = null;
        this.listeners = [];
    }

    /**
     * Initialize the ETA service
     */
    initialize(adapter) {
        this.adapter = adapter;
        this.isInitialized = true;
        console.log('ETA Service initialized');
    }

    /**
     * Calculate ETA for bus to destination
     */
    async calculateBusETA(busId, destination, options = {}) {
        if (!this.adapter) {
            throw new Error('ETA service not initialized');
        }

        try {
            const response = await this.adapter.post('/school-transport/tracking/calculate-eta', {
                bus_id: busId,
                destination_lat: destination.lat || destination.latitude,
                destination_lng: destination.lng || destination.longitude,
                provider: options.provider || 'google'
            });

            return response;
        } catch (error) {
            console.error('Failed to calculate ETA:', error);
            throw error;
        }
    }

    /**
     * Get ETAs for all stops on a route
     */
    async getRouteETAs(tripId, options = {}) {
        if (!this.adapter) {
            throw new Error('ETA service not initialized');
        }

        try {
            const response = await this.adapter.get(`/school-transport/tracking/routes/${tripId}/etas`, {
                params: {
                    provider: options.provider || 'google'
                }
            });

            return response;
        } catch (error) {
            console.error('Failed to get route ETAs:', error);
            throw error;
        }
    }

    /**
     * Get ETA for a specific stop
     */
    async getStopETA(routeId, stopId, options = {}) {
        if (!this.adapter) {
            throw new Error('ETA service not initialized');
        }

        try {
            const response = await this.adapter.get(
                `/school-transport/tracking/routes/${routeId}/stops/${stopId}/eta`,
                {
                    params: {
                        provider: options.provider || 'google'
                    }
                }
            );

            return response;
        } catch (error) {
            console.error('Failed to get stop ETA:', error);
            throw error;
        }
    }

    /**
     * Check if bus is near a stop
     */
    async checkProximity(busId, stopCoordinates, thresholdKm = 0.5) {
        if (!this.adapter) {
            throw new Error('ETA service not initialized');
        }

        try {
            const response = await this.adapter.post('/school-transport/tracking/check-proximity', {
                bus_id: busId,
                stop_lat: stopCoordinates.lat || stopCoordinates.latitude,
                stop_lng: stopCoordinates.lng || stopCoordinates.longitude,
                threshold_km: thresholdKm
            });

            return response;
        } catch (error) {
            console.error('Failed to check proximity:', error);
            throw error;
        }
    }

    /**
     * Get cached ETA if available
     */
    async getCachedETA(busId, destination) {
        if (!this.adapter) {
            throw new Error('ETA service not initialized');
        }

        try {
            const response = await this.adapter.get('/school-transport/tracking/cached-eta', {
                params: {
                    bus_id: busId,
                    destination_lat: destination.lat || destination.latitude,
                    destination_lng: destination.lng || destination.longitude
                }
            });

            return response;
        } catch (error) {
            console.warn('Failed to get cached ETA:', error);
            return null;
        }
    }

    /**
     * Start real-time ETA monitoring for a trip
     */
    async startETAMonitoring(tripId, options = {}) {
        if (!this.isInitialized) {
            throw new Error('ETA service not initialized');
        }

        const intervalSeconds = options.updateInterval || 30;
        const subscriptionKey = `eta_${tripId}`;

        // Clear existing subscription
        this.stopETAMonitoring(tripId);

        console.log(`Starting ETA monitoring for trip ${tripId}`);

        // Initial ETA fetch
        try {
            const etas = await this.getRouteETAs(tripId, options);
            this.emitETAUpdate(tripId, etas);
        } catch (error) {
            console.error('Failed to get initial ETAs:', error);
        }

        // Set up periodic updates
        const interval = setInterval(async () => {
            try {
                const etas = await this.getRouteETAs(tripId, options);
                this.emitETAUpdate(tripId, etas);
            } catch (error) {
                console.error('Failed to update ETAs:', error);
            }
        }, intervalSeconds * 1000);

        this.activeSubscriptions.set(subscriptionKey, {
            tripId,
            interval,
            options,
            startedAt: new Date()
        });

        return subscriptionKey;
    }

    /**
     * Stop ETA monitoring for a trip
     */
    stopETAMonitoring(tripId) {
        const subscriptionKey = `eta_${tripId}`;
        const subscription = this.activeSubscriptions.get(subscriptionKey);

        if (subscription) {
            clearInterval(subscription.interval);
            this.activeSubscriptions.delete(subscriptionKey);
            console.log(`Stopped ETA monitoring for trip ${tripId}`);
        }
    }

    /**
     * Stop all ETA monitoring
     */
    stopAllMonitoring() {
        this.activeSubscriptions.forEach((subscription, key) => {
            clearInterval(subscription.interval);
        });
        this.activeSubscriptions.clear();
        console.log('Stopped all ETA monitoring');
    }

    /**
     * Emit ETA update event
     */
    emitETAUpdate(tripId, etas) {
        const eventData = {
            tripId,
            etas,
            timestamp: new Date().toISOString()
        };

        EventRegister.emit('eta.updated', eventData);
        EventRegister.emit(`eta.updated.${tripId}`, eventData);

        console.log('ETA update emitted:', eventData);
    }

    /**
     * Subscribe to ETA updates
     */
    onETAUpdate(callback) {
        const listener = EventRegister.addEventListener('eta.updated', callback);
        this.listeners.push(listener);
        return listener;
    }

    /**
     * Subscribe to ETA updates for specific trip
     */
    onTripETAUpdate(tripId, callback) {
        const listener = EventRegister.addEventListener(`eta.updated.${tripId}`, callback);
        this.listeners.push(listener);
        return listener;
    }

    /**
     * Unsubscribe from ETA updates
     */
    removeListener(listener) {
        EventRegister.removeEventListener(listener);
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Format ETA minutes for display
     */
    formatETA(minutes) {
        if (minutes === null || minutes === undefined) {
            return 'TBD';
        }

        if (minutes <= 0) {
            return 'Arriving now';
        }

        if (minutes < 1) {
            return 'Less than 1 min';
        }

        if (minutes < 60) {
            return `${Math.round(minutes)} min`;
        }

        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        
        if (mins === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${mins}m`;
    }

    /**
     * Get arrival time from ETA minutes
     */
    getArrivalTime(etaMinutes) {
        if (etaMinutes === null || etaMinutes === undefined) {
            return null;
        }

        const now = new Date();
        const arrivalTime = new Date(now.getTime() + (etaMinutes * 60 * 1000));
        
        return arrivalTime.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    /**
     * Check if ETA indicates imminent arrival
     */
    isArrivingNow(etaMinutes, thresholdMinutes = 2) {
        return etaMinutes !== null && etaMinutes <= thresholdMinutes;
    }

    /**
     * Get ETA status color for UI
     */
    getETAStatusColor(etaMinutes) {
        if (etaMinutes === null || etaMinutes === undefined) {
            return '#6B7280'; // Gray
        }

        if (etaMinutes <= 2) {
            return '#EF4444'; // Red - arriving now
        }

        if (etaMinutes <= 10) {
            return '#F59E0B'; // Orange - arriving soon
        }

        return '#10B981'; // Green - normal
    }

    /**
     * Calculate distance from ETA data
     */
    formatDistance(distanceKm) {
        if (!distanceKm) return '';
        
        if (distanceKm < 1) {
            return `${Math.round(distanceKm * 1000)}m`;
        }

        return `${distanceKm.toFixed(1)}km`;
    }

    /**
     * Cleanup service
     */
    cleanup() {
        this.stopAllMonitoring();
        
        // Remove all event listeners
        this.listeners.forEach(listener => {
            EventRegister.removeEventListener(listener);
        });
        this.listeners = [];

        this.isInitialized = false;
        console.log('ETA Service cleaned up');
    }
}

// Export singleton instance
const etaService = new ETAService();
export default etaService;