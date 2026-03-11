/**
 * Admin Dashboard Component
 * Monitor all buses, view logs, and analytics
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import AdminMap from '../components/AdminMap';
import websocketService from '../services/websocket.service';
import ThemeToggle from '../components/ThemeToggle';
import './AdminDashboard.css';

function AdminDashboard() {
    const { user, logout } = useAuth();
    // Get token directly to ensure it's available for requests
    const token = localStorage.getItem('token');
    // OR const { token } = useAuth(); if exposed. useAuth returns { token } 
    // Let's use localStorage to be safe or update useAuth destructuring.

    const [stats, setStats] = useState(null);
    const [buses, setBuses] = useState([]);
    const [logs, setLogs] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    // Notification sound ref (optional)
    const audioRef = useRef(null);

    useEffect(() => {
        fetchDashboardData();
        connectWebSocket();

        // Fallback: Refresh data every 30 seconds
        const interval = setInterval(fetchDashboardData, 30000);

        return () => {
            clearInterval(interval);
            websocketService.disconnect();
        };
    }, []);

    const connectWebSocket = () => {
        const token = localStorage.getItem('token');
        websocketService.connect(token);

        // Listen for all bus locations
        websocketService.onLocationUpdate((data) => {
            setBuses(currentBuses => {
                return currentBuses.map(bus => {
                    if (bus.id === data.busId) {
                        return {
                            ...bus,
                            current_lat: data.latitude,
                            current_lng: data.longitude,
                            last_updated: data.timestamp
                        };
                    }
                    return bus;
                });
            });
        });

        // Listen for new logs/alerts
        websocketService.onNotification((notification) => {
            // Add to logs immediately
            const newLog = {
                id: Date.now(), // Temporary ID
                event_type: notification.type || 'alert',
                description: notification.message,
                created_at: new Date().toISOString()
            };

            setLogs(prevLogs => [newLog, ...prevLogs].slice(0, 50));

            // Optionally refresh stats if it's a major event
            if (notification.type === 'breakdown' || notification.type === 'trip_start') {
                fetchDashboardData();
            }
        });
    };

    const fetchDashboardData = async () => {
        try {
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            const [statsRes, busesRes, logsRes, analyticsRes] = await Promise.all([
                axios.get('/api/admin/dashboard', config),
                axios.get('/api/admin/buses', config),
                axios.get('/api/admin/logs?limit=50', config),
                axios.get('/api/admin/analytics', config)
            ]);

            setStats(statsRes.data.data);

            // Preserve map location data if we already have it to avoid jitter
            // logic: merge new bus data but keep latest lat/lng from websocket if newer
            // For simplicity, we just overwrite for now, websocket will update immediately after
            setBuses(busesRes.data.data);

            setLogs(logsRes.data.data);
            setAnalytics(analyticsRes.data.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            setLoading(false);
        }
    };

    const getBusStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return <span className="badge badge-success">Active</span>;
            case 'breakdown':
                return <span className="badge badge-error">Breakdown</span>;
            case 'maintenance':
                return <span className="badge badge-warning">Maintenance</span>;
            default:
                return <span className="badge badge-info">Idle</span>;
        }
    };

    const getEventIcon = (eventType) => {
        switch (eventType) {
            case 'trip_started': return '🚀';
            case 'trip_ended': return '🏁';
            case 'breakdown': return '⚠️';
            case 'delay_updated': return '⏰';
            case 'bus_arrival': return '📍';
            case 'attendance_locked': return '🔒';
            default: return '📝';
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spin">⏳</div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="dashboard-error">
                <h2>⚠️ Failed to load data</h2>
                <button className="btn btn-primary" onClick={fetchDashboardData}>Retry</button>
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="header-left">
                        <h1 className="dashboard-title">
                            <span className="title-icon">👨‍💼</span>
                            Admin Dashboard
                        </h1>
                        <p className="dashboard-subtitle">System Overview & Management</p>
                    </div>
                    <div className="header-right">
                        <ThemeToggle />
                        <button className="btn btn-secondary" onClick={logout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="dashboard-content">
                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card card">
                        <div className="stat-icon">🚌</div>
                        <div className="stat-content">
                            <h3 className="stat-label">Total Buses</h3>
                            <p className="stat-value">{stats.totalBuses}</p>
                            <p className="stat-meta">
                                <span className="text-success">{stats.activeBuses} active</span>
                            </p>
                        </div>
                    </div>

                    <div className="stat-card card">
                        <div className="stat-icon">🎓</div>
                        <div className="stat-content">
                            <h3 className="stat-label">Total Students</h3>
                            <p className="stat-value">{stats.totalStudents}</p>
                            <p className="stat-meta">Registered users</p>
                        </div>
                    </div>

                    <div className="stat-card card">
                        <div className="stat-icon">🚗</div>
                        <div className="stat-content">
                            <h3 className="stat-label">Total Drivers</h3>
                            <p className="stat-value">{stats.totalDrivers}</p>
                            <p className="stat-meta">Active drivers</p>
                        </div>
                    </div>

                    <div className="stat-card card">
                        <div className="stat-icon">🗺️</div>
                        <div className="stat-content">
                            <h3 className="stat-label">Active Routes</h3>
                            <p className="stat-value">{stats.totalRoutes}</p>
                            <p className="stat-meta">Operational routes</p>
                        </div>
                    </div>

                    <div className="stat-card card">
                        <div className="stat-icon">🚦</div>
                        <div className="stat-content">
                            <h3 className="stat-label">Active Trips</h3>
                            <p className="stat-value">{stats.activeTrips}</p>
                            <p className="stat-meta">Currently running</p>
                        </div>
                    </div>

                    <div className="stat-card card">
                        <div className="stat-icon">✅</div>
                        <div className="stat-content">
                            <h3 className="stat-label">Today's Attendance</h3>
                            <p className="stat-value">
                                {analytics?.attendance?.present_count || 0}
                            </p>
                            <p className="stat-meta">
                                of {analytics?.attendance?.total_records || 0} students
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tabs-container card">
                    <div className="tabs-header">
                        <button
                            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            🚌 Buses
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                            onClick={() => setActiveTab('logs')}
                        >
                            📋 Logs
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                            onClick={() => setActiveTab('analytics')}
                        >
                            📊 Analytics
                        </button>
                    </div>

                    <div className="tabs-content">
                        {/* Buses Tab */}
                        {activeTab === 'overview' && (
                            <div className="buses-table">
                                <h2 className="section-title">Live Fleet Monitor</h2>
                                <AdminMap buses={buses} height="400px" />

                                <h2 className="section-title" style={{ marginTop: '2rem' }}>Fleet Status</h2>
                                <div className="table-responsive">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Bus Number</th>
                                                <th>Route</th>
                                                <th>Driver</th>
                                                <th>Status</th>
                                                <th>Trip Status</th>
                                                <th>Last Updated</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {buses.map((bus) => (
                                                <tr key={bus.id}>
                                                    <td><strong>{bus.bus_number}</strong></td>
                                                    <td>{bus.route_name}</td>
                                                    <td>{bus.driver_name || 'Not Assigned'}</td>
                                                    <td>{getBusStatusBadge(bus.status)}</td>
                                                    <td>
                                                        {bus.active_trip_id ? (
                                                            <span className="badge badge-success">In Trip</span>
                                                        ) : (
                                                            <span className="badge badge-info">Idle</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {bus.last_updated
                                                            ? new Date(bus.last_updated).toLocaleString()
                                                            : 'N/A'
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Logs Tab */}
                        {activeTab === 'logs' && (
                            <div className="logs-section">
                                <h2 className="section-title">System Logs</h2>
                                <div className="logs-list">
                                    {logs.map((log) => (
                                        <div key={log.id} className="log-item">
                                            <div className="log-icon">{getEventIcon(log.event_type)}</div>
                                            <div className="log-content">
                                                <h4 className="log-title">{log.event_type.replace(/_/g, ' ').toUpperCase()}</h4>
                                                <p className="log-description">{log.description}</p>
                                                <div className="log-meta">
                                                    {log.bus_number && <span>Bus: {log.bus_number}</span>}
                                                    {log.driver_name && <span>Driver: {log.driver_name}</span>}
                                                    <span>{new Date(log.created_at).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Analytics Tab */}
                        {activeTab === 'analytics' && (
                            <div className="analytics-section">
                                <h2 className="section-title">Analytics & Insights</h2>

                                {/* Attendance Stats */}
                                <div className="analytics-card card-glass">
                                    <h3 className="analytics-title">📊 Attendance Overview</h3>
                                    <div className="analytics-grid">
                                        <div className="analytics-item">
                                            <span className="analytics-label">Present</span>
                                            <span className="analytics-value text-success">
                                                {analytics?.attendance?.present_count || 0}
                                            </span>
                                        </div>
                                        <div className="analytics-item">
                                            <span className="analytics-label">Absent</span>
                                            <span className="analytics-value text-error">
                                                {analytics?.attendance?.absent_count || 0}
                                            </span>
                                        </div>
                                        <div className="analytics-item">
                                            <span className="analytics-label">Total</span>
                                            <span className="analytics-value">
                                                {analytics?.attendance?.total_records || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Route Distribution */}
                                <div className="analytics-card card-glass">
                                    <h3 className="analytics-title">🗺️ Route Distribution</h3>
                                    <div className="route-list">
                                        {analytics?.routeDistribution?.map((route, index) => (
                                            <div key={index} className="route-item">
                                                <span className="route-name">{route.route_name}</span>
                                                <span className="route-count badge badge-info">
                                                    {route.student_count} students
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Trip Statistics */}
                                <div className="analytics-card card-glass">
                                    <h3 className="analytics-title">🚦 Recent Trip Statistics</h3>
                                    <div className="trips-table">
                                        {analytics?.trips?.map((trip, index) => (
                                            <div key={index} className="trip-row">
                                                <span className="trip-date">{trip.date}</span>
                                                <span className="trip-stat">
                                                    {trip.trip_count} trips
                                                </span>
                                                <span className="trip-stat">
                                                    Avg delay: {trip.avg_delay?.toFixed(1) || 0} min
                                                </span>
                                                {trip.breakdown_count > 0 && (
                                                    <span className="trip-stat text-error">
                                                        {trip.breakdown_count} breakdowns
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;
