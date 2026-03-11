/**
 * Driver Routes
 * Handles driver-specific operations
 */

const express = require('express');
const router = express.Router();
const { getInstance } = require('../services/database.service');
const attendanceLockService = require('../services/attendanceLock.service');
const notificationService = require('../services/notification.service');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const db = getInstance();

/**
 * GET /api/driver/dashboard
 * Get driver dashboard data
 */
router.get('/dashboard', authenticate, authorize('driver'), (req, res, next) => {
    try {
        const driverId = req.user.id;

        // Get driver's assigned bus
        const bus = db.queryOne(
            `SELECT b.*, r.name as route_name, r.id as route_id
             FROM buses b
             JOIN routes r ON b.route_id = r.id
             WHERE b.driver_id = ?`,
            [driverId]
        );

        if (!bus) {
            return res.status(404).json({
                success: false,
                message: 'No bus assigned to this driver'
            });
        }

        // Get active trip
        const activeTrip = db.queryOne(
            `SELECT * FROM trips
             WHERE driver_id = ? AND status = 'active'
             ORDER BY started_at DESC LIMIT 1`,
            [driverId]
        );

        // Get route stops
        const stops = db.query(
            `SELECT id, name, latitude, longitude, sequence_order
             FROM stops WHERE route_id = ? ORDER BY sequence_order`,
            [bus.route_id]
        );

        res.json({
            success: true,
            data: {
                driver: {
                    id: req.user.id,
                    name: req.user.full_name,
                    username: req.user.username
                },
                bus: {
                    id: bus.id,
                    busNumber: bus.bus_number,
                    status: bus.status,
                    routeName: bus.route_name,
                    routeId: bus.route_id,
                    currentLocation: bus.current_lat && bus.current_lng ? {
                        latitude: bus.current_lat,
                        longitude: bus.current_lng
                    } : null
                },
                activeTrip,
                stops
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/driver/trip/start
 * Start a new trip
 */
router.post('/trip/start', authenticate, authorize('driver'), (req, res, next) => {
    try {
        const driverId = req.user.id;

        // Get driver's bus
        const bus = db.queryOne(
            'SELECT id, route_id FROM buses WHERE driver_id = ?',
            [driverId]
        );

        if (!bus) {
            return res.status(404).json({
                success: false,
                message: 'No bus assigned'
            });
        }

        // Check if there's already an active trip
        const activeTrip = db.queryOne(
            `SELECT id FROM trips WHERE driver_id = ? AND status = 'active'`,
            [driverId]
        );

        if (activeTrip) {
            return res.status(400).json({
                success: false,
                message: 'Trip already in progress'
            });
        }

        // Create new trip
        const result = db.execute(
            `INSERT INTO trips (bus_id, driver_id, route_id, started_at, status)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'active')`,
            [bus.id, driverId, bus.route_id]
        );

        // Update bus status
        db.execute(
            `UPDATE buses SET status = 'active' WHERE id = ?`,
            [bus.id]
        );

        // Log event
        db.execute(
            `INSERT INTO logs (trip_id, event_type, description)
             VALUES (?, 'trip_started', 'Driver started trip')`,
            [result.lastInsertRowid]
        );

        res.json({
            success: true,
            data: {
                tripId: result.lastInsertRowid,
                message: 'Trip started successfully'
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/driver/trip/end
 * End current trip
 */
router.post('/trip/end', authenticate, authorize('driver'), (req, res, next) => {
    try {
        const driverId = req.user.id;

        // Get active trip
        const trip = db.queryOne(
            `SELECT t.*, b.id as bus_id FROM trips t
             JOIN buses b ON t.bus_id = b.id
             WHERE t.driver_id = ? AND t.status = 'active'`,
            [driverId]
        );

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'No active trip found'
            });
        }

        // End trip
        db.execute(
            `UPDATE trips SET status = 'completed', ended_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [trip.id]
        );

        // Update bus status
        db.execute(
            `UPDATE buses SET status = 'idle', current_lat = NULL, current_lng = NULL
             WHERE id = ?`,
            [trip.bus_id]
        );

        // Log event
        db.execute(
            `INSERT INTO logs (trip_id, event_type, description)
             VALUES (?, 'trip_ended', 'Driver ended trip')`,
            [trip.id]
        );

        res.json({
            success: true,
            message: 'Trip ended successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/driver/breakdown
 * Report bus breakdown
 */
router.post('/breakdown', authenticate, authorize('driver'), (req, res, next) => {
    try {
        const driverId = req.user.id;
        const { message } = req.body;

        // Get active trip
        const trip = db.queryOne(
            `SELECT t.*, b.id as bus_id, b.route_id FROM trips t
             JOIN buses b ON t.bus_id = b.id
             WHERE t.driver_id = ? AND t.status = 'active'`,
            [driverId]
        );

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'No active trip found'
            });
        }

        // Update trip
        db.execute(
            `UPDATE trips SET breakdown_reported = 1, breakdown_message = ?
             WHERE id = ?`,
            [message || 'Bus breakdown reported', trip.id]
        );

        // Update bus status
        db.execute(
            `UPDATE buses SET status = 'breakdown' WHERE id = ?`,
            [trip.bus_id]
        );

        // Log event
        db.execute(
            `INSERT INTO logs (trip_id, event_type, description)
             VALUES (?, 'breakdown', ?)`,
            [trip.id, message || 'Bus breakdown reported']
        );

        // Notify all students on this route
        notificationService.notifyBreakdown(trip.route_id, message);

        res.json({
            success: true,
            message: 'Breakdown reported and students notified'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/driver/delay
 * Update delay time
 */
router.post('/delay', authenticate, authorize('driver'), (req, res, next) => {
    try {
        const driverId = req.user.id;
        const { delayMinutes } = req.body;

        if (!delayMinutes || delayMinutes < 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid delay time'
            });
        }

        // Get active trip
        const trip = db.queryOne(
            `SELECT t.*, b.route_id FROM trips t
             JOIN buses b ON t.bus_id = b.id
             WHERE t.driver_id = ? AND t.status = 'active'`,
            [driverId]
        );

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'No active trip found'
            });
        }

        // Update delay
        db.execute(
            `UPDATE trips SET delay_minutes = ? WHERE id = ?`,
            [delayMinutes, trip.id]
        );

        // Log event
        db.execute(
            `INSERT INTO logs (trip_id, event_type, description)
             VALUES (?, 'delay_updated', ?)`,
            [trip.id, `Delay updated to ${delayMinutes} minutes`]
        );

        // Notify students
        notificationService.notifyDelay(trip.route_id, delayMinutes);

        res.json({
            success: true,
            message: 'Delay updated and students notified'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/driver/manifest
 * Get student count per stop
 */
router.get('/manifest', authenticate, authorize('driver'), (req, res, next) => {
    try {
        const driverId = req.user.id;

        // Get driver's route
        const bus = db.queryOne(
            'SELECT route_id FROM buses WHERE driver_id = ?',
            [driverId]
        );

        if (!bus) {
            return res.status(404).json({
                success: false,
                message: 'No bus assigned'
            });
        }

        const manifest = attendanceLockService.getStudentCountsPerStop(bus.route_id);

        res.json({
            success: true,
            data: manifest
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
