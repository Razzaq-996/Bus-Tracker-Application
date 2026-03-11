/**
 * Seed Data Script
 * Populates database with provided route data
 */

const bcrypt = require('bcryptjs');

/**
 * Seed database with demo data
 * @param {object} db - Database instance
 */
const seedDatabase = (db) => {
    console.log('🌱 Seeding database with demo data...');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Hash password for demo users
    const hashedPassword = bcrypt.hashSync('password123', 10);

    // Insert demo users
    const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (username, password, role, full_name, email, phone)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Admin user
    insertUser.run('admin', hashedPassword, 'admin', 'Admin User', 'admin@college.edu', '9876543210');

    // Driver users
    insertUser.run('driver1', hashedPassword, 'driver', 'Rajesh Kumar', 'rajesh@college.edu', '9876543211');
    insertUser.run('driver2', hashedPassword, 'driver', 'Suresh Sharma', 'suresh@college.edu', '9876543212');
    insertUser.run('driver3', hashedPassword, 'driver', 'Ramesh Gupta', 'ramesh@college.edu', '9876543213');
    insertUser.run('driver4', hashedPassword, 'driver', 'Mahesh Babu', 'mahesh@college.edu', '9876543214');
    insertUser.run('driver5', hashedPassword, 'driver', 'Naresh Reddy', 'naresh@college.edu', '9876543215');

    // Student users
    insertUser.run('student1', hashedPassword, 'student', 'Amit Patel', 'amit@student.edu', '9876543216');
    insertUser.run('student2', hashedPassword, 'student', 'Priya Singh', 'priya@student.edu', '9876543217');
    insertUser.run('student3', hashedPassword, 'student', 'Rahul Verma', 'rahul@student.edu', '9876543218');
    insertUser.run('student4', hashedPassword, 'student', 'Sneha Reddy', 'sneha@student.edu', '9876543219');
    insertUser.run('student5', hashedPassword, 'student', 'Vikram Joshi', 'vikram@student.edu', '9876543220');

    console.log('✅ Created demo users');

    // Route Data
    const routesData = [
        {
            "routeId": "22K",
            "name": "Suchitra to GNITS",
            "stops": [
                { "stopNo": 1, "name": "Suchitra", "lat": 17.4950, "lng": 78.4727 },
                { "stopNo": 2, "name": "Dairy Farm", "lat": 17.4815, "lng": 78.4740 },
                { "stopNo": 3, "name": "KPHB", "lat": 17.4837, "lng": 78.3915 },
                { "stopNo": 4, "name": "JNTU", "lat": 17.4933, "lng": 78.3914 },
                { "stopNo": 5, "name": "Nizampet", "lat": 17.4996, "lng": 78.3853 },
                { "stopNo": 6, "name": "Miyapur", "lat": 17.4968, "lng": 78.3484 },
                { "stopNo": 7, "name": "GNITS", "lat": 17.4124, "lng": 78.3970 }
            ]
        },
        {
            "routeId": "1D",
            "name": "Hayathnagar to GNITS",
            "stops": [
                { "stopNo": 1, "name": "Hayathnagar", "lat": 17.3237, "lng": 78.6041 },
                { "stopNo": 2, "name": "L.B. Nagar", "lat": 17.3457, "lng": 78.5522 },
                { "stopNo": 3, "name": "Chaitanyapuri", "lat": 17.3688, "lng": 78.5342 },
                { "stopNo": 4, "name": "Malakpet", "lat": 17.3719, "lng": 78.4972 },
                { "stopNo": 5, "name": "Koti", "lat": 17.3824, "lng": 78.4827 },
                { "stopNo": 6, "name": "Lakdikapool", "lat": 17.4020, "lng": 78.4653 },
                { "stopNo": 7, "name": "Mehdipatnam", "lat": 17.3916, "lng": 78.4402 },
                { "stopNo": 8, "name": "GNITS", "lat": 17.4124, "lng": 78.3970 }
            ]
        },
        {
            "routeId": "23K",
            "name": "Bachupally to GNITS",
            "stops": [
                { "stopNo": 1, "name": "Bachupally", "lat": 17.5358, "lng": 78.3615 },
                { "stopNo": 2, "name": "Coca Cola Company", "lat": 17.5029, "lng": 78.3491 },
                { "stopNo": 3, "name": "MyHome", "lat": 17.4930, "lng": 78.3470 },
                { "stopNo": 4, "name": "Lingampally", "lat": 17.4841, "lng": 78.3243 },
                { "stopNo": 5, "name": "HCU", "lat": 17.4580, "lng": 78.3370 },
                { "stopNo": 6, "name": "GNITS", "lat": 17.4124, "lng": 78.3970 }
            ]
        },
        {
            "routeId": "27P",
            "name": "Patancheru to GNITS",
            "stops": [
                { "stopNo": 1, "name": "Patancheru", "lat": 17.5255, "lng": 78.2678 },
                { "stopNo": 2, "name": "Bairamguda", "lat": 17.5350, "lng": 78.3050 },
                { "stopNo": 3, "name": "Ashok Nagar", "lat": 17.5011, "lng": 78.3187 },
                { "stopNo": 4, "name": "Miyapur", "lat": 17.4968, "lng": 78.3484 },
                { "stopNo": 5, "name": "JNTU", "lat": 17.4933, "lng": 78.3914 },
                { "stopNo": 6, "name": "Madhapur PS", "lat": 17.4475, "lng": 78.3912 },
                { "stopNo": 7, "name": "Mindspace", "lat": 17.4411, "lng": 78.3820 },
                { "stopNo": 8, "name": "Raidurga", "lat": 17.4262, "lng": 78.3780 },
                { "stopNo": 9, "name": "GNITS", "lat": 17.4124, "lng": 78.3970 }
            ]
        },
        {
            "routeId": "7D",
            "name": "Balapur to GNITS",
            "stops": [
                { "stopNo": 1, "name": "Balapur", "lat": 17.3060, "lng": 78.5135 },
                { "stopNo": 2, "name": "Karmanghat", "lat": 17.3392, "lng": 78.5317 },
                { "stopNo": 3, "name": "Champapet", "lat": 17.3458, "lng": 78.5186 },
                { "stopNo": 4, "name": "Midani", "lat": 17.3323, "lng": 78.4983 },
                { "stopNo": 5, "name": "Chandrayangutta", "lat": 17.3117, "lng": 78.4746 },
                { "stopNo": 6, "name": "Attapur", "lat": 17.3653, "lng": 78.4344 },
                { "stopNo": 7, "name": "GNITS", "lat": 17.4124, "lng": 78.3970 }
            ]
        }
    ];

    // Insert routes
    const insertRoute = db.prepare(`
        INSERT OR IGNORE INTO routes (id, name, description, is_active)
        VALUES (?, ?, ?, ?)
    `);

    // Insert stops
    const insertStop = db.prepare(`
        INSERT OR IGNORE INTO stops (route_id, name, latitude, longitude, sequence_order, distance_from_previous)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Helper to calculate distance
    const haversineDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Insert routes and stops
    routesData.forEach(route => {
        insertRoute.run(route.routeId, route.name, `${route.name} Route`, 1);

        let previousStop = null;
        route.stops.forEach((stop, index) => {
            let distance = 0;
            if (previousStop) {
                distance = haversineDistance(previousStop.lat, previousStop.lng, stop.lat, stop.lng);
            }

            insertStop.run(route.routeId, stop.name, stop.lat, stop.lng, stop.stopNo, distance);
            previousStop = stop;
        });
    });

    console.log('✅ Created routes and stops');

    // Insert buses
    const insertBus = db.prepare(`
        INSERT OR IGNORE INTO buses (bus_number, route_id, driver_id, status)
        VALUES (?, ?, ?, ?)
    `);

    // Assigning buses to routes (1 bus per route for demo)
    insertBus.run('BUS-22K', '22K', 2, 'idle');
    insertBus.run('BUS-1D', '1D', 3, 'idle');
    insertBus.run('BUS-23K', '23K', 4, 'idle');
    insertBus.run('BUS-27P', '27P', 5, 'idle');
    insertBus.run('BUS-7D', '7D', 6, 'idle');

    console.log('✅ Created buses');

    // Assign students to stops
    const insertStudentStop = db.prepare(`
        INSERT OR IGNORE INTO student_stops (student_id, stop_id)
        VALUES (?, ?)
    `);

    // Fetch stop IDs for assignment
    const getStopId = db.prepare(`SELECT id FROM stops WHERE route_id = ? AND sequence_order = ?`);

    // Assign demo students
    const studentAssignments = [
        { studentId: 7, routeId: '22K', seq: 3 },
        { studentId: 8, routeId: '1D', seq: 4 },
        { studentId: 9, routeId: '23K', seq: 4 },
        { studentId: 10, routeId: '27P', seq: 5 },
        { studentId: 11, routeId: '7D', seq: 4 }
    ];

    studentAssignments.forEach(asgn => {
        const stop = getStopId.get(asgn.routeId, asgn.seq);
        if (stop) insertStudentStop.run(asgn.studentId, stop.id);
    });

    console.log('✅ Assigned students to stops');
};

module.exports = seedDatabase;

// Support running directly
if (require.main === module) {
    const Database = require('better-sqlite3');
    const path = require('path');
    
    const dbPath = path.join(__dirname, '..', 'database', 'bus_tracker.db');
    const db = new Database(dbPath);
    
    try {
        seedDatabase(db);
        console.log('🎉 Database seeding complete!');
    } catch (error) {
        console.error('❌ Database seeding failed:', error);
    } finally {
        db.close();
    }
}

