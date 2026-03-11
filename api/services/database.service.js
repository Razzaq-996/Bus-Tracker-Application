/**
 * Database Connection and Query Wrapper
 * Provides a clean interface for database operations
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseService {
    constructor() {
        const dbDir = path.join(__dirname, '..', 'database');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const dbPath = path.join(dbDir, 'bus_tracker.db');
        this.db = new Database(dbPath);
        this.db.pragma('foreign_keys = ON');

        console.log('📦 Database connected');
    }

    /**
     * Execute a query that returns multiple rows
     */
    query(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            return stmt.all(params);
        } catch (error) {
            console.error('Query error:', error);
            throw error;
        }
    }

    /**
     * Execute a query that returns a single row
     */
    queryOne(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            return stmt.get(params);
        } catch (error) {
            console.error('QueryOne error:', error);
            throw error;
        }
    }

    /**
     * Execute an INSERT, UPDATE, or DELETE query
     */
    execute(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            return stmt.run(params);
        } catch (error) {
            console.error('Execute error:', error);
            throw error;
        }
    }

    /**
     * Execute multiple queries in a transaction
     */
    transaction(callback) {
        const transaction = this.db.transaction(callback);
        return transaction();
    }

    /**
     * Close database connection
     */
    close() {
        this.db.close();
        console.log('📦 Database connection closed');
    }

    /**
     * Get database instance for advanced operations
     */
    getDb() {
        return this.db;
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getInstance: () => {
        if (!instance) {
            instance = new DatabaseService();
        }
        return instance;
    },
    DatabaseService
};
