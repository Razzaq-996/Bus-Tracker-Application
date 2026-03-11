/**
 * Student Routes
 * Handles student-specific operations
 */

const express = require('express');
const router = express.Router();
const { getInstance } = require('../services/database.service');
const attendanceLockService = require('../services/attendanceLock.service');
const notificationService = require('../services/notification.service');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const db = getInstance();

/**
 * GET /api/student/dashboard
 * Get student dashboard data
 */
router.get('/dashboard', authenticate, authorize('student'), (req, res, next) => {
    try {
        const studentId = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        // Get student's assigned stop
        const studentStop = db.queryOne(
            `SELECT s.*, r.name as route_name, r.id as route_id
             FROM student_stops ss
             JOIN stops s ON ss.stop_id = s.id
             JOIN routes r ON s.route_id = r.id
             WHERE ss.student_id = ?`,
            [studentId]
        );

        // If no stop assigned, return available routes for selection
        if (!studentStop) {
            const availableRoutes = db.query('SELECT id, name, description FROM routes WHERE is_active = 1');
            return res.json({
                success: true,
                data: {
                    student: {
                        id: req.user.id,
                        name: req.user.full_name,
                        username: req.user.username
                    },
                    hasSelection: false,
                    availableRoutes
                }
            });
        }

        // Get attendance status
        const attendance = attendanceLockService.getStudentAttendance(studentId, today);

        // Get active bus for this route
        const bus = db.queryOne(
            `SELECT b.*, t.id as trip_id, t.status as trip_status
             FROM buses b
             LEFT JOIN trips t ON b.id = t.bus_id AND t.status = 'active'
             WHERE b.route_id = ? AND b.status = 'active'`,
            [studentStop.route_id]
        );

        // Get all stops for the route
        const routeStops = db.query(
            `SELECT id, name, latitude, longitude, sequence_order
             FROM stops WHERE route_id = ? ORDER BY sequence_order`,
            [studentStop.route_id]
        );

        res.json({
            success: true,
            data: {
                student: {
                    id: req.user.id,
                    name: req.user.full_name,
                    username: req.user.username
                },
                hasSelection: true,
                stop: {
                    id: studentStop.id,
                    name: studentStop.name,
                    latitude: studentStop.latitude,
                    longitude: studentStop.longitude,
                    routeName: studentStop.route_name,
                    routeId: studentStop.route_id
                },
                attendance: attendance || {
                    status: 'absent',
                    isLocked: false
                },
                bus: bus || null,
                routeStops
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/student/routes/:id/stops
 * Get stops for a specific route (for selection)
 */
router.get('/routes/:id/stops', authenticate, authorize('student'), (req, res, next) => {
    try {
        const routeId = req.params.id;
        const stops = db.query(
            `SELECT id, name, latitude, longitude, sequence_order 
             FROM stops WHERE route_id = ? ORDER BY sequence_order`,
            [routeId]
        );

        res.json({
            success: true,
            data: stops
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/student/select-stop
 * Select or change route/stop
 */
router.post('/select-stop', authenticate, authorize('student'), (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { stopId } = req.body;

        if (!stopId) {
            return res.status(400).json({
                success: false,
                message: 'Stop ID is required'
            });
        }

        // Verify stop exists
        const stop = db.queryOne('SELECT id, route_id FROM stops WHERE id = ?', [stopId]);
        if (!stop) {
            return res.status(404).json({
                success: false,
                message: 'Stop not found'
            });
        }

        // Upsert selection
        // Check if exists first (SQLite replace/upsert syntax can vary, safe to check)
        const existing = db.queryOne('SELECT * FROM student_stops WHERE student_id = ?', [studentId]);

        if (existing) {
            // Update
            db.execute(
                'UPDATE student_stops SET stop_id = ? WHERE student_id = ?',
                [stopId, studentId]
            );
        } else {
            // Insert
            db.execute(
                'INSERT INTO student_stops (student_id, stop_id) VALUES (?, ?)',
                [studentId, stopId]
            );
        }

        res.json({
            success: true,
            message: 'Route and stop selection saved'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/student/bus-location
 * Get current bus location and ETA
 */
router.get('/bus-location', authenticate, authorize('student'), (req, res, next) => {
    try {
        const studentId = req.user.id;

        // Get student's stop and route
        const studentStop = db.queryOne(
            `SELECT s.id as stop_id, s.route_id
             FROM student_stops ss
             JOIN stops s ON ss.stop_id = s.id
             WHERE ss.student_id = ?`,
            [studentId]
        );

        if (!studentStop) {
            return res.status(404).json({
                success: false,
                message: 'No stop assigned'
            });
        }

        // Get active bus
        const bus = db.queryOne(
            `SELECT b.*, t.id as trip_id
             FROM buses b
             JOIN trips t ON b.id = t.bus_id
             WHERE b.route_id = ? AND t.status = 'active' AND b.status = 'active'`,
            [studentStop.route_id]
        );

        if (!bus || !bus.current_lat || !bus.current_lng) {
            return res.json({
                success: true,
                data: {
                    busActive: false,
                    message: 'Bus is not currently active'
                }
            });
        }

        // Calculate ETA
        const eta = attendanceLockService.calculateETA(
            studentStop.route_id,
            { lat: bus.current_lat, lng: bus.current_lng },
            studentStop.stop_id
        );

        res.json({
            success: true,
            data: {
                busActive: true,
                location: {
                    latitude: bus.current_lat,
                    longitude: bus.current_lng
                },
                eta: eta === Infinity ? null : eta,
                busNumber: bus.bus_number
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/student/attendance
 * Confirm attendance
 */
router.post('/attendance', authenticate, authorize('student'), (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { status } = req.body; // 'present' or 'absent'

        if (!status || !['present', 'absent'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "present" or "absent"'
            });
        }

        // Get student's stop
        const studentStop = db.queryOne(
            `SELECT stop_id FROM student_stops WHERE student_id = ?`,
            [studentId]
        );

        if (!studentStop) {
            return res.status(404).json({
                success: false,
                message: 'No stop assigned'
            });
        }

        // Get active trip
        const trip = db.queryOne(
            `SELECT t.id FROM trips t
             JOIN buses b ON t.bus_id = b.id
             JOIN stops s ON b.route_id = s.route_id
             WHERE s.id = ? AND t.status = 'active'`,
            [studentStop.stop_id]
        );

        if (status === 'present') {
            const result = attendanceLockService.confirmAttendance(
                studentId,
                studentStop.stop_id,
                trip ? trip.id : null
            );

            return res.json({
                success: result.success,
                message: result.message
            });
        } else {
            // Mark as absent
            const today = new Date().toISOString().split('T')[0];
            db.execute(
                `INSERT OR REPLACE INTO attendance (student_id, stop_id, date, status)
                 VALUES (?, ?, ?, 'absent')`,
                [studentId, studentStop.stop_id, today]
            );

            return res.json({
                success: true,
                message: 'Marked as absent'
            });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/student/notifications
 * Get student notifications
 */
router.get('/notifications', authenticate, authorize('student'), (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { limit = 50, unreadOnly = false } = req.query;

        const notifications = notificationService.getUserNotifications(
            studentId,
            parseInt(limit),
            unreadOnly === 'true'
        );

        const unreadCount = notificationService.getUnreadCount(studentId);

        res.json({
            success: true,
            data: {
                notifications,
                unreadCount
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/student/notifications/:id/read
 * Mark notification as read
 */
router.put('/notifications/:id/read', authenticate, authorize('student'), (req, res, next) => {
    try {
        const notificationId = parseInt(req.params.id);
        const studentId = req.user.id;

        notificationService.markAsRead(notificationId, studentId);

        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
