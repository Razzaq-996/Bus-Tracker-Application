const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'backend', 'database', 'bus_tracker.db');
const db = new Database(dbPath);

const admin = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
console.log('Admin User:', admin);

const users = db.prepare('SELECT * FROM users').all();
console.log('Total Users:', users.length);
