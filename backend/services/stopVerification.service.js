/**
 * Stop Verification Service
 * Handles automatic stop visit detection via geofencing
 */

const { getInstance } = require('./database.service');
const { haversineDistance, isWithinGeofence } = require('../utils/haversine');

const GEOFENCE_RADIUS_METERS = 40; // Configurable radius

class StopVerificationService {
    constructor() {
        this.db = getInstance();
        // Track recently checked stops to avoid duplicate processing
        this.recentlyChecked = new Map(); // tripId -> Set of stopIds
    }

    /**
     * Check if driver has reached any unvisited stops
     * @param {number} tripId - Active trip ID
     * @param {string} routeId - Route ID
     * @param {number} driverLat - Driver's current latitude
     * @param {number} driverLng - Driver's current longitude
     * @returns {Array} Array of newly visited stops
     */
    checkStopVisits(tripId, routeId, driverLat, driverLng) {
        const today = new Date().toISOString().split('T')[0];
        const newlyVisited = [];

        try {
            // Get all stops for this route
            const stops = this.db.query(
                `SELECT id, name, latitude, longitude, sequence_order
                 FROM stops
                 WHERE route_id = ?
                 ORDER BY sequence_order`,
                [routeId]
            );

            // Get already visited stops for this trip today
            const visitedStops = this.db.query(
                `SELECT stop_id
                 FROM stop_visits
                 WHERE trip_id = ? AND date = ?`,
                [tripId, today]
            );

            const visitedStopIds = new Set(visitedStops.map(v => v.stop_id));

            // Initialize recently checked set for this trip if needed
            if (!this.recentlyChecked.has(tripId)) {
                this.recentlyChecked.set(tripId, new Set());
            }
            const recentlyCheckedSet = this.recentlyChecked.get(tripId);

            // Check each unvisited stop
            for (const stop of stops) {
                // Skip if already visited or recently checked (debounce)
                if (visitedStopIds.has(stop.id) || recentlyCheckedSet.has(stop.id)) {
                    continue;
                }

                // Calculate distance
                const distance = haversineDistance(
                    driverLat,
                    driverLng,
                    stop.latitude,
                    stop.longitude
                );

                // Check if within geofence
                if (isWithinGeofence(driverLat, driverLng, stop.latitude, stop.longitude, GEOFENCE_RADIUS_METERS)) {
                    // Mark as visited
                    this.db.execute(
                        `INSERT INTO stop_visits (trip_id, stop_id, visited_at, date, driver_lat, driver_lng, distance_meters)
                         VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
                        [tripId, stop.id, today, driverLat, driverLng, distance]
                    );

                    newlyVisited.push({
                        stopId: stop.id,
                        stopName: stop.name,
                        sequenceOrder: stop.sequence_order,
                        distance: Math.round(distance),
                        timestamp: new Date().toISOString()
                    });

                    // Add to recently checked to prevent immediate re-checking
                    recentlyCheckedSet.add(stop.id);

                    console.log(`✅ Stop verified: ${stop.name} (${Math.round(distance)}m away)`);
                }
            }

            // Clean up recently checked after 30 seconds
            setTimeout(() => {
                if (this.recentlyChecked.has(tripId)) {
                    this.recentlyChecked.get(tripId).clear();
                }
            }, 30000);

        } catch (error) {
            console.error('Error checking stop visits:', error);
        }

        return newlyVisited;
    }

    /**
     * Get visited stops for a trip
     * @param {number} tripId - Trip ID
     * @returns {Array} Array of visited stop IDs
     */
    getVisitedStops(tripId) {
        const today = new Date().toISOString().split('T')[0];

        try {
            const visited = this.db.query(
                `SELECT stop_id, visited_at, distance_meters
                 FROM stop_visits
                 WHERE trip_id = ? AND date = ?
                 ORDER BY visited_at`,
                [tripId, today]
            );

            return visited.map(v => ({
                stopId: v.stop_id,
                visitedAt: v.visited_at,
                distance: v.distance_meters
            }));
        } catch (error) {
            console.error('Error getting visited stops:', error);
            return [];
        }
    }

    /**
     * Clear trip from cache when trip ends
     * @param {number} tripId - Trip ID
     */
    clearTripCache(tripId) {
        if (this.recentlyChecked.has(tripId)) {
            this.recentlyChecked.delete(tripId);
        }
    }
}

// Singleton instance
let instance = null;

function getStopVerificationService() {
    if (!instance) {
        instance = new StopVerificationService();
    }
    return instance;
}

module.exports = getStopVerificationService();
