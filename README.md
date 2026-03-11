# College Bus Tracking & Attendance System

[![Status](https://img.shields.io/badge/Status-100%25%20Complete-brightgreen.svg)]()
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-blue.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-61dafb.svg)]()
[![Database](https://img.shields.io/badge/Database-SQLite-003b57.svg)]()
[![Real-time](https://img.shields.io/badge/Real--time-Socket.io-black.svg)]()

A production-grade, real-time bus tracking and attendance management system designed for modern educational institutions. The platform automates attendance using real-time ETA calculations powered by advanced data structures and algorithms.

---

## Features

### Real-Time GPS Tracking
- Live bus location updates via Socket.IO
- Animated bus markers on an interactive Leaflet map
- Low-latency real-time communication between drivers, students, and admins

### ETA-Based Attendance Lock
- Attendance can only be marked if the bus is more than 10 minutes away
- Accurate ETA calculation using Dijkstra’s Algorithm and Haversine Distance
- Prevents proxy or late attendance marking

### Role-Based Dashboards
- Student: View bus location, ETA, and mark attendance
- Driver: Share live GPS, manage trip lifecycle, view student list
- Admin: Monitor system, manage routes, buses, and analytics

### Smart Notification System
- FIFO-based notification queue
- Real-time WebSocket alerts and browser notifications
- Event-driven alerts for trip start, delays, and attendance windows

---

## Data Structures & Algorithms

| Data Structure | Implementation | Purpose |
|---------------|---------------|---------|
| Graph | Adjacency List | Route and stop representation |
| Hash Map | Custom | O(1) lookups for users and sessions |
| Priority Queue | Min Heap | Optimized Dijkstra ETA calculation |
| Queue | FIFO | Notification and event processing |

### Algorithms Used
- Dijkstra’s Algorithm (shortest path)
- Haversine Formula (GPS distance)
- Dynamic attendance locking based on ETA

---

## UI & Design
- Premium dark mode interface
- Glassmorphism effects and smooth transitions
- Mobile-first responsive design

---

## Project Structure

.
├── backend/
│   ├── dataStructures/
│   ├── services/
│   ├── routes/
│   ├── database/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   └── services/
│   └── index.html
└── docs/

---

## Quick Start

### Prerequisites
- Node.js v18+
- npm or yarn

### Backend Setup
cd backend
npm install
npm run init-db
npm run seed
npm run dev

### Frontend Setup
cd frontend
npm install
npm run dev

---

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | password123 |
| Driver | driver1 | password123 |
| Student | student1 | password123 |

---

## Security & Performance
- JWT-based authentication with RBAC
- Password hashing using bcrypt
- SQL injection prevention and input validation
- Optimized O(1) lookups and cached ETA calculations

---

## Documentation
- ARCHITECTURE.md
- QUICKSTART.md
- PROJECT_SUMMARY.md

---

## Contributing
Pull requests and issues are welcome.

---

## License
ISC License

---

Built with ❤️ for college communities.
