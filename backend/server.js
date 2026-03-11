/**
 * Main Server File
 * Integrates Express, Socket.IO, and all services
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');

// Services
const { getInstance } = require('./services/database.service');
const attendanceLockService = require('./services/attendanceLock.service');
const notificationService = require('./services/notification.service');
const authService = require('./services/auth.service');
const stopVerificationService = require('./services/stopVerification.service');

// Middleware
const errorHandler = require('./middleware/error.middleware');

// Routes
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const driverRoutes = require('./routes/driver.routes');
const adminRoutes = require('./routes/admin.routes');
const setupRoutes = require('./routes/setup.routes');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIO(server, {
    cors: {
        origin: "*", // Allow all origins for development (mobile/IP access)
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors({
    origin: true, // Reflect request origin
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes (MUST come before static file serving)
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/setup', setupRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Serve index.html for all non-API routes (React Router)
// This MUST be after API routes to avoid catching API requests
app.get('*', (req, res, next) => {
    // Skip if it's an API request
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Error handler (must be last)
app.use(errorHandler);

// Set Socket.IO for notification service
notificationService.setSocketIO(io);

// Database instance
const db = getInstance();

// Store active connections
const activeConnections = new Map(); // socketId -> { userId, role, busId }

/**
 * Socket.IO Connection Handler
 */
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    /**
     * Authenticate socket connection
     */
    socket.on('authenticate', async (data) => {
        try {
            const { token } = data;

            if (!token) {
                socket.emit('auth-error', { message: 'No token provided' });
                return;
            }

            const user = authService.verifyToken(token);

            // Store connection info
            activeConnections.set(socket.id, {
                userId: user.id,
                role: user.role,
                socketId: socket.id
            });

            // Join user-specific room for notifications
            socket.join(`user-${user.id}`);

            socket.emit('authenticated', {
                userId: user.id,
                role: user.role
            });

            console.log(`✅ User authenticated: ${user.username} (${user.role})`);
        } catch (error) {
            socket.emit('auth-error', { message: 'Invalid token' });
        }
    });

    /**
     * Driver sends GPS location
     */
    socket.on('send-location', async (data) => {
        try {
            const connection = activeConnections.get(socket.id);

            if (!connection || connection.role !== 'driver') {
                return;
            }

            const { latitude, longitude } = data;

            // Get driver's bus and active trip
            const bus = db.queryOne(
                `SELECT b.id, b.route_id, t.id as trip_id
                 FROM buses b
                 LEFT JOIN trips t ON b.id = t.bus_id AND t.status = 'active'
                 WHERE b.driver_id = ?`,
                [connection.userId]
            );

            if (!bus || !bus.trip_id) {
                return;
            }

            // Update bus location in database
            db.execute(
                `UPDATE buses 
                 SET current_lat = ?, current_lng = ?, last_updated = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [latitude, longitude, bus.id]
            );

            // ✅ FEATURE 1: Check for stop visits (geofencing)
            const newlyVisitedStops = stopVerificationService.checkStopVisits(
                bus.trip_id,
                bus.route_id,
                latitude,
                longitude
            );

            // Calculate ETA and update attendance locks
            const stopsStatus = attendanceLockService.updateAttendanceLocks(
                bus.trip_id,
                bus.route_id,
                { lat: latitude, lng: longitude }
            );

            // Get all visited stops for this trip
            const visitedStops = stopVerificationService.getVisitedStops(bus.trip_id);
            const visitedStopIds = visitedStops.map(v => v.stopId);

            // Broadcast location to all clients watching this bus
            io.emit('receive-location', {
                busId: bus.id,
                latitude,
                longitude,
                timestamp: new Date().toISOString()
            });

            // Broadcast ETA updates with visited stop information
            io.emit('eta-update', {
                busId: bus.id,
                routeId: bus.route_id,
                stops: stopsStatus,
                visitedStops: visitedStopIds // ✅ Include visited stops
            });

            // Broadcast newly visited stops
            if (newlyVisitedStops.length > 0) {
                io.emit('stop-visited', {
                    busId: bus.id,
                    routeId: bus.route_id,
                    stops: newlyVisitedStops
                });
            }

            // Check for newly locked stops and send notifications
            stopsStatus.forEach(stop => {
                if (stop.isLocked && stop.eta <= 10 && stop.eta > 8) {
                    // Send notification when ETA is between 8-10 minutes (lock threshold)
                    notificationService.notifyBusArrival(stop.stopId, stop.eta);
                }

                if (stop.isLocked && stop.eta <= 10 && stop.eta > 9) {
                    // Send lock notification
                    notificationService.notifyAttendanceLock(stop.stopId);
                }
            });

        } catch (error) {
            console.error('Error processing location:', error);
        }
    });

    /**
     * Join a specific room (for targeted broadcasts)
     */
    socket.on('join-room', (data) => {
        const { room } = data;
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    /**
     * Leave a room
     */
    socket.on('leave-room', (data) => {
        const { room } = data;
        socket.leave(room);
        console.log(`Socket ${socket.id} left room: ${room}`);
    });

    /**
     * Heartbeat ping/pong to keep connection alive
     */
    socket.on('ping', () => {
        socket.emit('pong');
    });

    /**
     * Handle batch location upload (offline GPS points)
     */
    socket.on('send-location-batch', async (data) => {
        try {
            const connection = activeConnections.get(socket.id);

            if (!connection || connection.role !== 'driver') {
                return;
            }

            const { points } = data;

            if (!Array.isArray(points) || points.length === 0) {
                return;
            }

            console.log(`📦 Received ${points.length} offline GPS points from driver ${connection.userId}`);

            // Get driver's bus
            const bus = db.queryOne(
                `SELECT b.id, b.route_id, t.id as trip_id
                 FROM buses b
                 LEFT JOIN trips t ON b.id = t.bus_id AND t.status = 'active'
                 WHERE b.driver_id = ?`,
                [connection.userId]
            );

            if (!bus || !bus.trip_id) {
                return;
            }

            // Process each point (could be optimized with batch insert)
            points.forEach(point => {
                const { latitude, longitude, timestamp } = point;

                // Update bus location with the latest point
                db.execute(
                    `UPDATE buses 
                     SET current_lat = ?, current_lng = ?, last_updated = ?
                     WHERE id = ?`,
                    [latitude, longitude, new Date(timestamp).toISOString(), bus.id]
                );
            });

            // Use the latest point for ETA calculation
            const latestPoint = points[points.length - 1];
            const stopsStatus = attendanceLockService.updateAttendanceLocks(
                bus.trip_id,
                bus.route_id,
                { lat: latestPoint.latitude, lng: latestPoint.longitude }
            );

            // Broadcast the latest location
            io.emit('receive-location', {
                busId: bus.id,
                latitude: latestPoint.latitude,
                longitude: latestPoint.longitude,
                timestamp: new Date(latestPoint.timestamp).toISOString()
            });

            // Broadcast ETA update
            io.emit('eta-update', {
                busId: bus.id,
                routeId: bus.route_id,
                stops: stopsStatus
            });

            console.log(`✅ Processed ${points.length} offline GPS points`);

        } catch (error) {
            console.error('Error processing batch location:', error);
        }
    });

    /**
     * Handle Emergency SOS
     */
    socket.on('emergency-sos', async (data) => {
        try {
            const connection = activeConnections.get(socket.id);

            if (!connection || connection.role !== 'driver') {
                return;
            }

            const { message, location, timestamp } = data;

            console.log(`🚨 EMERGENCY SOS from driver ${connection.userId}: ${message}`);

            // Get driver info
            const driver = db.queryOne(
                `SELECT u.id, u.name, b.bus_number, b.route_id, r.name as route_name
                 FROM users u
                 JOIN buses b ON b.driver_id = u.id
                 JOIN routes r ON r.id = b.route_id
                 WHERE u.id = ?`,
                [connection.userId]
            );

            if (!driver) {
                return;
            }

            // Create SOS notification in database
            const sosData = {
                driverId: driver.id,
                driverName: driver.name,
                busNumber: driver.bus_number,
                routeName: driver.route_name,
                message: message || 'Emergency assistance required',
                latitude: location.latitude,
                longitude: location.longitude,
                timestamp: new Date(timestamp).toISOString()
            };

            // Broadcast SOS to ALL users (students, drivers, admins)
            io.emit('sos-alert', sosData);

            // Send notifications to all students on this route
            const students = db.queryAll(
                `SELECT DISTINCT u.id
                 FROM users u
                 JOIN student_stops ss ON ss.student_id = u.id
                 JOIN stops s ON s.id = ss.stop_id
                 WHERE s.route_id = ? AND u.role = 'student'`,
                [driver.route_id]
            );

            students.forEach(student => {
                notificationService.createNotification(
                    student.id,
                    'emergency',
                    '🚨 EMERGENCY ALERT',
                    `Driver ${driver.name} (${driver.bus_number}) has sent an emergency SOS: ${sosData.message}`
                );
            });

            // Notify all admins
            const admins = db.queryAll(
                `SELECT id FROM users WHERE role = 'admin'`
            );

            admins.forEach(admin => {
                notificationService.createNotification(
                    admin.id,
                    'emergency',
                    '🚨 DRIVER EMERGENCY SOS',
                    `Driver ${driver.name} (${driver.bus_number}, ${driver.route_name}) sent SOS: ${sosData.message}. Location: ${location.latitude}, ${location.longitude}`
                );
            });

            console.log(`✅ SOS broadcasted to all users`);

        } catch (error) {
            console.error('Error processing SOS:', error);
        }
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
        const connection = activeConnections.get(socket.id);

        if (connection) {
            console.log(`👋 User disconnected: ${connection.userId} (${connection.role})`);
            activeConnections.delete(socket.id);
        } else {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        }

        io.emit('user-disconnected', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log('\n🚀 ========================================');
    console.log(`   College Bus Tracker Backend`);
    console.log('   ========================================');
    console.log(`   🌐 Server running on port ${PORT}`);
    console.log(`   📡 WebSocket enabled`);
    console.log(`   🗄️  Database connected`);
    console.log(`   🔐 JWT authentication enabled`);
    console.log('   ========================================\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    db.close();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };
