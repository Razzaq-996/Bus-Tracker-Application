/**
 * Add Stop Visits Table
 * Tracks when drivers reach each stop (daily reset)
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'bus_tracker.db');
const db = new Database(dbPath);

console.log('📊 Adding stop_visits table...');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create Stop Visits table
db.exec(`
    CREATE TABLE IF NOT EXISTS stop_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER NOT NULL,
        stop_id INTEGER NOT NULL,
        visited_at DATETIME NOT NULL,
        date DATE NOT NULL,
        driver_lat REAL NOT NULL,
        driver_lng REAL NOT NULL,
        distance_meters REAL NOT NULL,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
        FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE,
        UNIQUE(trip_id, stop_id, date)
    )
`);

console.log('✅ Created stop_visits table');

// Create index for better query performance
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stop_visits_trip ON stop_visits(trip_id);
    CREATE INDEX IF NOT EXISTS idx_stop_visits_date ON stop_visits(date);
    CREATE INDEX IF NOT EXISTS idx_stop_visits_stop ON stop_visits(stop_id);
`);

console.log('✅ Created indexes for stop_visits');

db.close();

console.log('🎉 Stop visits table added successfully!');
