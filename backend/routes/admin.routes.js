/**
 * Admin Routes
 * Handles admin-specific operations
 */

const express = require('express');
const router = express.Router();
const { getInstance } = require('../services/database.service');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const db = getInstance();

/**
 * GET /api/admin/dashboard
 * Get admin dashboard overview
 */
router.get('/dashboard', authenticate, authorize('admin'), (req, res, next) => {
    try {
        // Get total counts
        const stats = {
            totalBuses: db.queryOne('SELECT COUNT(*) as count FROM buses').count,
            totalStudents: db.queryOne('SELECT COUNT(*) as count FROM users WHERE role = ?', ['student']).count,
            totalDrivers: db.queryOne('SELECT COUNT(*) as count FROM users WHERE role = ?', ['driver']).count,
            totalRoutes: db.queryOne('SELECT COUNT(*) as count FROM routes WHERE is_active = 1').count,
            activeBuses: db.queryOne('SELECT COUNT(*) as count FROM buses WHERE status = ?', ['active']).count,
            activeTrips: db.queryOne('SELECT COUNT(*) as count FROM trips WHERE status = ?', ['active']).count
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/buses
 * Get all buses with their status
 */
router.get('/buses', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const buses = db.query(`
            SELECT 
                b.*,
                r.name as route_name,
                u.full_name as driver_name,
                t.id as active_trip_id,
                t.started_at as trip_started_at
            FROM buses b
            LEFT JOIN routes r ON b.route_id = r.id
            LEFT JOIN users u ON b.driver_id = u.id
            LEFT JOIN trips t ON b.id = t.bus_id AND t.status = 'active'
            ORDER BY b.bus_number
        `);

        res.json({
            success: true,
            data: buses
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/logs
 * Get system logs
 */
router.get('/logs', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { limit = 100, eventType } = req.query;

        let query = `
            SELECT 
                l.*,
                t.bus_id,
                b.bus_number,
                u.full_name as driver_name
            FROM logs l
            LEFT JOIN trips t ON l.trip_id = t.id
            LEFT JOIN buses b ON t.bus_id = b.id
            LEFT JOIN users u ON t.driver_id = u.id
        `;

        const params = [];

        if (eventType) {
            query += ' WHERE l.event_type = ?';
            params.push(eventType);
        }

        query += ' ORDER BY l.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const logs = db.query(query, params);

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/analytics
 * Get analytics data
 */
router.get('/analytics', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const today = new Date().toISOString().split('T')[0];

        // Attendance statistics
        const attendanceStats = db.queryOne(`
            SELECT 
                COUNT(*) as total_records,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count
            FROM attendance
            WHERE date = ?
        `, [today]);

        // Trip statistics
        const tripStats = db.query(`
            SELECT 
                DATE(started_at) as date,
                COUNT(*) as trip_count,
                AVG(delay_minutes) as avg_delay,
                SUM(CASE WHEN breakdown_reported = 1 THEN 1 ELSE 0 END) as breakdown_count
            FROM trips
            WHERE DATE(started_at) >= DATE('now', '-7 days')
            GROUP BY DATE(started_at)
            ORDER BY date DESC
        `);

        // Route-wise student distribution
        const routeDistribution = db.query(`
            SELECT 
                r.name as route_name,
                COUNT(DISTINCT ss.student_id) as student_count
            FROM routes r
            LEFT JOIN stops s ON r.id = s.route_id
            LEFT JOIN student_stops ss ON s.id = ss.stop_id
            WHERE r.is_active = 1
            GROUP BY r.id, r.name
        `);

        res.json({
            success: true,
            data: {
                attendance: attendanceStats,
                trips: tripStats,
                routeDistribution
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/routes
 * Get all routes
 */
router.get('/routes', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const routes = db.query(`
            SELECT 
                r.*,
                COUNT(DISTINCT s.id) as stop_count,
                COUNT(DISTINCT b.id) as bus_count
            FROM routes r
            LEFT JOIN stops s ON r.id = s.route_id
            LEFT JOIN buses b ON r.id = b.route_id
            GROUP BY r.id
            ORDER BY r.name
        `);

        res.json({
            success: true,
            data: routes
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/routes/:id/stops
 * Get stops for a route
 */
router.get('/routes/:id/stops', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const routeId = req.params.id;

        const stops = db.query(`
            SELECT 
                s.*,
                COUNT(DISTINCT ss.student_id) as student_count
            FROM stops s
            LEFT JOIN student_stops ss ON s.id = ss.stop_id
            WHERE s.route_id = ?
            GROUP BY s.id
            ORDER BY s.sequence_order
        `, [routeId]);

        res.json({
            success: true,
            data: stops
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/routes
 * Create a new route
 */
router.post('/routes', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { name, description, routeId } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Route name is required'
            });
        }

        // Generate ID if missing
        const newRouteId = routeId || (name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000));

        db.execute(
            'INSERT INTO routes (id, name, description, is_active) VALUES (?, ?, ?, 1)',
            [newRouteId, name, description || '']
        );

        res.json({
            success: true,
            data: {
                id: newRouteId,
                message: 'Route created successfully'
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/stops
 * Create a new stop
 */
router.post('/stops', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { routeId, name, latitude, longitude, sequenceOrder, distanceFromPrevious } = req.body;

        if (!routeId || !name || !latitude || !longitude || !sequenceOrder) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const result = db.execute(
            `INSERT INTO stops (route_id, name, latitude, longitude, sequence_order, distance_from_previous)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [routeId, name, latitude, longitude, sequenceOrder, distanceFromPrevious || 0]
        );

        res.json({
            success: true,
            data: {
                id: result.lastInsertRowid,
                message: 'Stop created successfully'
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/users
 * Get all users
 */
router.get('/users', authenticate, authorize('admin'), (req, res, next) => {
    try {
        const { role } = req.query;

        let query = 'SELECT id, username, role, full_name, email, phone, created_at FROM users';
        const params = [];

        if (role) {
            query += ' WHERE role = ?';
            params.push(role);
        }

        query += ' ORDER BY created_at DESC';

        const users = db.query(query, params);

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
