# Database Directory

This directory contains the SQLite database file for the College Bus Tracking & Attendance System.

## Files

- `bus_tracker.db` - The main SQLite database file (auto-generated, not tracked in git)
- `bus_tracker.db-shm` - Shared memory file (auto-generated)
- `bus_tracker.db-wal` - Write-Ahead Log file (auto-generated)

## Database Initialization

The database is automatically initialized when you run the application for the first time. You can also manually initialize it using:

```bash
node backend/scripts/initDatabase.js
```

## Seeding Data

To populate the database with demo data (routes, stops, users, etc.), run:

```bash
node backend/scripts/seedData.js
```

This will create:
- 3 bus routes with multiple stops each
- Demo accounts for students, drivers, and admins
- Sample attendance records

## Important Notes

- The `.db` files are intentionally **not tracked in git** (see `.gitignore`)
- Each developer/deployment should initialize their own database
- The database schema is defined in `backend/scripts/initDatabase.js`
- Demo credentials are available in `LOGIN_GUIDE.md`

## Database Schema

The database includes the following tables:
- `users` - User accounts (students, drivers, admins)
- `routes` - Bus routes
- `stops` - Bus stops with coordinates
- `route_stops` - Junction table linking routes and stops
- `attendance` - Student attendance records
- `trips` - Active/completed bus trips
- `complaints` - Student complaints/feedback
- `polls` - Community polls and voting
- `notifications` - System notifications

For detailed schema information, see `backend/scripts/initDatabase.js`.
