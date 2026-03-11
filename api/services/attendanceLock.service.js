/**
 * Attendance Lock Service
 * Implements the core attendance locking algorithm based on ETA
 */

const { getInstance } = require('./database.service');
const Graph = require('../dataStructures/Graph');
const HashMap = require('../dataStructures/HashMap');

class AttendanceLockService {
    constructor() {
        this.db = getInstance();
        this.routeGraphs = new HashMap(); // routeId -> Graph
        this.lockThreshold = parseInt(process.env.ATTENDANCE_LOCK_THRESHOLD) || 10; // minutes
        this.initializeRouteGraphs();
    }

    /**
     * Initialize route graphs from database
     * Builds adjacency list representation of all routes
     */
    initializeRouteGraphs() {
        const routes = this.db.query('SELECT id FROM routes WHERE is_active = 1');

        routes.forEach(route => {
            const graph = new Graph();

            // Get all stops for this route, ordered by sequence
            const stops = this.db.query(
                `SELECT id, name, latitude, longitude, sequence_order, distance_from_previous
                 FROM stops WHERE route_id = ? ORDER BY sequence_order`,
                [route.id]
            );

            // Add stops as vertices
            stops.forEach(stop => {
                graph.addStop(stop.id, {
                    name: stop.name,
                    latitude: stop.latitude,
                    longitude: stop.longitude,
                    sequence: stop.sequence_order
                });
            });

            // Add edges between consecutive stops
            for (let i = 0; i < stops.length - 1; i++) {
                const currentStop = stops[i];
                const nextStop = stops[i + 1];

                // Use distance_from_previous as weight
                const weight = nextStop.distance_from_previous || 2.0; // default 2km

                graph.addRoute(currentStop.id, nextStop.id, weight, false);
            }

            this.routeGraphs.set(route.id, graph);
        });

        console.log(`📊 Initialized ${this.routeGraphs.getSize()} route graphs`);
    }

    /**
     * Calculate ETA to a specific stop
     * @param {number} routeId - Route ID
     * @param {Object} currentLocation - { lat, lng }
     * @param {number} targetStopId - Target stop ID
     * @returns {number} - ETA in minutes
     */
    calculateETA(routeId, currentLocation, targetStopId) {
        const graph = this.routeGraphs.get(routeId);

        if (!graph) {
            console.error(`Route graph not found for route ${routeId}`);
            return Infinity;
        }

        return graph.calculateETA(currentLocation, targetStopId, 30); // 30 km/h avg speed
    }

    /**
     * Check if attendance should be locked for a stop
     * @param {number} routeId - Route ID
     * @param {Object} currentLocation - Current bus location
     * @param {number} stopId - Stop ID to check
     * @returns {boolean} - True if attendance should be locked
     */
    shouldLockAttendance(routeId, currentLocation, stopId) {
        const eta = this.calculateETA(routeId, currentLocation, stopId);
        return eta <= this.lockThreshold;
    }

    /**
     * Get all stops with their lock status for a route
     * @param {number} routeId - Route ID
     * @param {Object} currentLocation - Current bus location
     * @returns {Array} - Array of stops with ETA and lock status
     */
    getStopsWithLockStatus(routeId, currentLocation) {
        const graph = this.routeGraphs.get(routeId);

        if (!graph) {
            return [];
        }

        const stops = graph.getAllStops();

        return stops.map(stop => {
            const eta = this.calculateETA(routeId, currentLocation, stop.id);
            const isLocked = eta <= this.lockThreshold;

            return {
                stopId: stop.id,
                name: stop.name,
                latitude: stop.latitude,
                longitude: stop.longitude,
                eta: eta === Infinity ? null : eta,
                isLocked,
                lockThreshold: this.lockThreshold
            };
        });
    }

    /**
     * Update attendance lock status in database
     * @param {number} tripId - Current trip ID
     * @param {number} routeId - Route ID
     * @param {Object} currentLocation - Current bus location
     */
    updateAttendanceLocks(tripId, routeId, currentLocation) {
        const today = new Date().toISOString().split('T')[0];
        const stopsStatus = this.getStopsWithLockStatus(routeId, currentLocation);

        stopsStatus.forEach(stop => {
            if (stop.isLocked) {
                // Lock attendance for this stop
                this.db.execute(
                    `UPDATE attendance 
                     SET is_locked = 1 
                     WHERE stop_id = ? AND date = ? AND is_locked = 0`,
                    [stop.stopId, today]
                );
            }
        });

        return stopsStatus;
    }

    /**
     * Confirm student attendance
     * @param {number} studentId - Student ID
     * @param {number} stopId - Stop ID
     * @param {number} tripId - Current trip ID
     * @returns {Object} - Success status and message
     */
    confirmAttendance(studentId, stopId, tripId) {
        const today = new Date().toISOString().split('T')[0];

        // Check if attendance record exists
        const attendance = this.db.queryOne(
            `SELECT id, is_locked FROM attendance 
             WHERE student_id = ? AND stop_id = ? AND date = ?`,
            [studentId, stopId, today]
        );

        if (!attendance) {
            // Create new attendance record
            this.db.execute(
                `INSERT INTO attendance (student_id, stop_id, trip_id, date, status, confirmed_at, is_locked)
                 VALUES (?, ?, ?, ?, 'present', CURRENT_TIMESTAMP, 0)`,
                [studentId, stopId, tripId, today]
            );

            return {
                success: true,
                message: 'Attendance confirmed successfully'
            };
        }

        // Check if already locked
        if (attendance.is_locked) {
            return {
                success: false,
                message: 'Attendance is locked. Bus is too close to your stop.'
            };
        }

        // Update attendance to present
        this.db.execute(
            `UPDATE attendance 
             SET status = 'present', confirmed_at = CURRENT_TIMESTAMP, trip_id = ?
             WHERE id = ?`,
            [tripId, attendance.id]
        );

        return {
            success: true,
            message: 'Attendance confirmed successfully'
        };
    }

    /**
     * Get student count per stop for driver manifest
     * @param {number} routeId - Route ID
     * @param {string} date - Date (YYYY-MM-DD)
     * @returns {Array} - Stops with student counts
     */
    getStudentCountsPerStop(routeId, date = null) {
        const today = date || new Date().toISOString().split('T')[0];

        const query = `
            SELECT 
                s.id as stop_id,
                s.name as stop_name,
                s.sequence_order,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
                COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
                COUNT(*) as total_students
            FROM stops s
            LEFT JOIN attendance a ON s.id = a.stop_id AND a.date = ?
            WHERE s.route_id = ?
            GROUP BY s.id, s.name, s.sequence_order
            ORDER BY s.sequence_order
        `;

        return this.db.query(query, [today, routeId]);
    }

    /**
     * Get attendance status for a student
     * @param {number} studentId - Student ID
     * @param {string} date - Date (YYYY-MM-DD)
     * @returns {Object} - Attendance details
     */
    getStudentAttendance(studentId, date = null) {
        const today = date || new Date().toISOString().split('T')[0];

        return this.db.queryOne(
            `SELECT a.*, s.name as stop_name, s.latitude, s.longitude
             FROM attendance a
             JOIN stops s ON a.stop_id = s.id
             WHERE a.student_id = ? AND a.date = ?`,
            [studentId, today]
        );
    }

    /**
     * Reload route graphs (call after route/stop changes)
     */
    reloadRouteGraphs() {
        this.routeGraphs.clear();
        this.initializeRouteGraphs();
    }
}

module.exports = new AttendanceLockService();
