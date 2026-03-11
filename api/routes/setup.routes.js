/**
 * Setup Routes
 * Endpoints for initializing and seeding the database
 * These should be protected or removed in production
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { execSync } = require('child_process');

/**
 * POST /api/setup/init-db
 * Initialize database schema
 */
router.post('/init-db', async (req, res, next) => {
    try {
        const initScript = path.join(__dirname, '../scripts/initDatabase.js');
        execSync(`node "${initScript}"`, { stdio: 'inherit' });

        res.json({
            success: true,
            message: 'Database initialized successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/setup/seed-db
 * Seed database with demo data
 */
router.post('/seed-db', async (req, res, next) => {
    try {
        const seedScript = path.join(__dirname, '../scripts/seedData.js');
        execSync(`node "${seedScript}"`, { stdio: 'inherit' });

        res.json({
            success: true,
            message: 'Database seeded successfully with demo accounts'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/setup/status
 * Check database status
 */
router.get('/status', async (req, res, next) => {
    try {
        const { getInstance } = require('../services/database.service');
        const db = getInstance();

        // Check if users table exists and has data
        const userCount = db.queryOne('SELECT COUNT(*) as count FROM users');
        const routeCount = db.queryOne('SELECT COUNT(*) as count FROM routes');

        res.json({
            success: true,
            data: {
                databaseInitialized: true,
                userCount: userCount.count,
                routeCount: routeCount.count,
                ready: userCount.count > 0 && routeCount.count > 0
            }
        });
    } catch (error) {
        res.json({
            success: false,
            data: {
                databaseInitialized: false,
                ready: false,
                error: error.message
            }
        });
    }
});

module.exports = router;
