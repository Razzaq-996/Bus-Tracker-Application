/**
 * Vercel Serverless API Handler
 * This is a simplified version for Vercel deployment
 * Note: WebSocket functionality is not supported on Vercel
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Services
const { getInstance } = require('./services/database.service');
const authService = require('./services/auth.service');

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

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/setup', setupRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running (Vercel Serverless)',
        timestamp: new Date().toISOString(),
        note: 'WebSocket features are not available in this deployment'
    });
});

// Error handler
app.use(errorHandler);

// Initialize database
try {
    getInstance();
    console.log('📦 Database initialized for Vercel');
} catch (error) {
    console.error('Database initialization error:', error);
}

// Export for Vercel
module.exports = app;
