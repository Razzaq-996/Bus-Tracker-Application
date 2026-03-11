/**
 * Student Dashboard Component
 * Shows bus location, ETA, and attendance confirmation
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import websocketService from '../services/websocket.service';
import BusMap from '../components/BusMap';
import NotificationPanel from '../components/NotificationPanel';
import ThemeToggle from '../components/ThemeToggle';
import './StudentDashboard.css';

// Advanced tracking features
import { AdaptiveGeofence } from '../services/location.service';

function StudentDashboard() {
    const { user, logout } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [busLocation, setBusLocation] = useState(null);
    const [eta, setEta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [attendanceStatus, setAttendanceStatus] = useState('absent');
    const [isLocked, setIsLocked] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [visitedStops, setVisitedStops] = useState([]); // ✅ Track visited stops

    // Geofencing
    const geofenceRef = useRef(null);
    const [busDistance, setBusDistance] = useState(null);

    // Selection State
    const [availableRoutes, setAvailableRoutes] = useState([]);
    const [selectedRouteId, setSelectedRouteId] = useState('');
    const [routeStopsForSelection, setRouteStopsForSelection] = useState([]);
    const [selectedStopId, setSelectedStopId] = useState('');
    const [isSelectionLoading, setIsSelectionLoading] = useState(false);
    const [isChangingStop, setIsChangingStop] = useState(false);

    useEffect(() => {
        fetchDashboardData();
        return () => {
            websocketService.disconnect();
        };
    }, []);

    const fetchDashboardData = async () => {
        try {
            const response = await axios.get('/api/student/dashboard');
            const data = response.data.data;
            setDashboardData(data);

            if (data.hasSelection) {
                setAttendanceStatus(data.attendance?.status || 'absent');
                setIsLocked(data.attendance?.isLocked || false);
                connectWebSocket(); // Connect only if we have a selection to finish setup

                // Fetch initial bus location
                if (data.bus) {
                    fetchBusLocation();
                }
            } else {
                setAvailableRoutes(data.availableRoutes || []);
            }

            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            setLoading(false);
        }
    };

    const fetchBusLocation = async () => {
        try {
            const response = await axios.get('/api/student/bus-location');
            if (response.data.data.busActive) {
                setBusLocation(response.data.data.location);
                setEta(response.data.data.eta);
            }
        } catch (error) {
            console.error('Failed to fetch bus location:', error);
        }
    };

    const connectWebSocket = () => {
        const token = localStorage.getItem('token');
        websocketService.connect(token);

        // Listen for bus location updates
        websocketService.onLocationUpdate((data) => {
            setBusLocation(prev => ({
                latitude: data.latitude,
                longitude: data.longitude
            }));
        });

        // Listen for ETA updates (includes visited stops)
        websocketService.onETAUpdate((data) => {
            // Update visited stops from ETA update
            if (data.visitedStops) {
                setVisitedStops(data.visitedStops);
            }

            setDashboardData(currentData => {
                if (currentData?.stop) {
                    const myStop = data.stops.find(s => s.stopId === currentData.stop.id);
                    if (myStop) {
                        setEta(myStop.eta);
                        setIsLocked(myStop.isLocked);
                    }
                }
                return currentData;
            });
        });

        // ✅ Listen for stop visit events
        websocketService.onStopVisited((data) => {
            console.log('Stop visited:', data);
            const newStopIds = data.stops.map(s => s.stopId);
            setVisitedStops(prev => [...new Set([...prev, ...newStopIds])]);
        });

        // Listen for notifications
        websocketService.onNotification((notification) => {
            if (Notification.permission === 'granted') {
                new Notification(notification.title, {
                    body: notification.message,
                    icon: '🚌'
                });
            }
        });
    };

    const requestNotificationPermission = async () => {
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    };

    useEffect(() => {
        requestNotificationPermission();
    }, []);

    // Setup geofence when stop data is available
    useEffect(() => {
        if (dashboardData?.stop && dashboardData.hasSelection) {
            const { stop } = dashboardData;

            // Create geofence around student's stop (500m radius)
            geofenceRef.current = new AdaptiveGeofence(
                { latitude: stop.latitude, longitude: stop.longitude },
                500  // 500 meters
            );

            // Register entry callback
            geofenceRef.current.onEntry((data) => {
                console.log(`🚌 Bus entered geofence! Distance: ${Math.round(data.distance)}m`);

                // Show browser notification
                if (Notification.permission === 'granted') {
                    new Notification('🚌 Bus Approaching!', {
                        body: `Your bus is ${Math.round(data.distance)} meters away from your stop`,
                        icon: '🚌',
                        tag: 'bus-proximity'
                    });
                }
            });

            // Register exit callback
            geofenceRef.current.onExit((data) => {
                console.log(`🚌 Bus left geofence! Distance: ${Math.round(data.distance)}m`);
            });

            // Adapt radius based on ETA
            if (eta !== null && eta < 5) {
                // Shrink radius when bus is very close
                geofenceRef.current.adaptRadius(0.5);  // 250m
            }
        }

        return () => {
            if (geofenceRef.current) {
                geofenceRef.current.reset();
            }
        };
    }, [dashboardData, eta]);

    // Monitor bus location with geofence
    useEffect(() => {
        if (busLocation && geofenceRef.current) {
            const status = geofenceRef.current.checkPosition(
                busLocation.latitude,
                busLocation.longitude
            );

            setBusDistance(Math.round(status.distance));

            if (status.isInside) {
                console.log(`📍 Bus is ${Math.round(status.distance)}m from your stop`);
            }
        }
    }, [busLocation]);


    // --- Selection Handlers ---

    const handleRouteSelect = async (e) => {
        const routeId = e.target.value;
        setSelectedRouteId(routeId);
        setSelectedStopId('');

        if (routeId) {
            setIsSelectionLoading(true);
            try {
                const response = await axios.get(`/api/student/routes/${routeId}/stops`);
                setRouteStopsForSelection(response.data.data);
            } catch (error) {
                console.error("Failed to fetch stops", error);
                alert("Failed to load stops for this route.");
            } finally {
                setIsSelectionLoading(false);
            }
        } else {
            setRouteStopsForSelection([]);
        }
    };

    const handleConfirmSelection = async () => {
        if (!selectedRouteId || !selectedStopId) {
            alert("Please select a route and a stop.");
            return;
        }

        try {
            const response = await axios.post('/api/student/select-stop', {
                stopId: selectedStopId
            });

            if (response.data.success) {
                alert("Selection saved!");
                setIsChangingStop(false);
                setLoading(true); // reload dashboard
                fetchDashboardData();
            }
        } catch (error) {
            alert(error.response?.data?.message || "Failed to save selection");
        }
    };

    const confirmAttendance = async (status) => {
        try {
            const response = await axios.post('/api/student/attendance', { status });
            if (response.data.success) {
                setAttendanceStatus(status);
                alert(response.data.message);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to confirm attendance');
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

    // --- RENDER: Selection View (if no selection or changing) ---
    if (!dashboardData?.hasSelection || isChangingStop) {
        // Use availableRoutes from dashboardData if not changing, or if changing we might need to fetch them?
        // Actually fetchDashboardData sets availableRoutes only if !hasSelection.
        // If isChangingStop is true, we assume user might want to change within same route or different?
        // Prompt says: "Student can change stop only within the same route".
        // So if Changing Stop, we should pre-fill selectedRouteId with current route and only allow stop change?
        // Or if simple "Selection" view:

        const routesToList = availableRoutes.length > 0 ? availableRoutes : (dashboardData?.hasSelection ? [{ id: dashboardData.stop.routeId, name: dashboardData.stop.routeName }] : []);

        // If changing stop, optimize experience:
        // If we are changing stop, we should load stops for current route immediately if not loaded.
        // But for simplicity, let's just show the standard selection UI. 
        // Note: For "Change Stop" within SAME route, we should lock Route dropdown or pre-select it.

        return (
            <div className="student-dashboard selection-mode">
                <header className="dashboard-header">
                    <h1 className="dashboard-title">🚌 Select Your Route</h1>
                    <button className="btn btn-secondary" onClick={logout}>Logout</button>
                </header>

                <div className="dashboard-content" style={{ maxWidth: '600px', margin: '40px auto' }}>
                    <div className="card">
                        <h2 className="section-title">
                            {isChangingStop ? 'Change Your Stop' : 'Setup Your Profile'}
                        </h2>

                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select Route</label>
                            <select
                                className="form-input"
                                value={selectedRouteId}
                                onChange={handleRouteSelect}
                                disabled={isChangingStop} // Lock route if changing stop only (per prompt requirement)
                            >
                                <option value="">-- Choose Route --</option>
                                {routesToList.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedRouteId && (
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select Your Stop</label>
                                {isSelectionLoading ? (
                                    <p>Loading stops...</p>
                                ) : (
                                    <select
                                        className="form-input"
                                        value={selectedStopId}
                                        onChange={(e) => setSelectedStopId(e.target.value)}
                                    >
                                        <option value="">-- Choose Stop --</option>
                                        {routeStopsForSelection.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}

                        {selectedRouteId && selectedStopId && (
                            <div className="map-preview" style={{ marginBottom: '20px', height: '200px' }}>
                                {/* Minimal map preview if we had time, for now just text */}
                                <p style={{ color: '#666', fontSize: '0.9em' }}>
                                    Selected: Stop #{routeStopsForSelection.find(s => s.id == selectedStopId)?.sequence_order}
                                    - {routeStopsForSelection.find(s => s.id == selectedStopId)?.name}
                                </p>
                            </div>
                        )}

                        <div className="actions" style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-primary" onClick={handleConfirmSelection} disabled={!selectedRouteId || !selectedStopId}>
                                Confirm Selection
                            </button>
                            {isChangingStop && (
                                <button className="btn btn-secondary" onClick={() => setIsChangingStop(false)}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: Main Dashboard ---
    const { student, stop, bus, routeStops } = dashboardData;

    return (
        <div className="student-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="header-left">
                        <h1 className="dashboard-title">
                            <span className="title-icon">🎓</span>
                            Student Dashboard
                        </h1>
                        <p className="dashboard-subtitle">Welcome, {student.name}</p>
                    </div>
                    <div className="header-right">
                        <ThemeToggle />
                        <button
                            className="btn-icon"
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            🔔
                        </button>
                        <button className="btn btn-secondary" onClick={logout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Notification Panel */}
            {showNotifications && (
                <NotificationPanel onClose={() => setShowNotifications(false)} />
            )}

            {/* Main Content */}
            <div className="dashboard-content">
                {/* Info Cards */}
                <div className="info-grid">
                    {/* Stop Info */}
                    <div className="info-card card">
                        <div className="info-icon">📍</div>
                        <div className="info-content">
                            <h3 className="info-label">Your Stop</h3>
                            <p className="info-value">{stop.name}</p>
                            <p className="info-meta">{stop.routeName}</p>
                            <button
                                className="btn-link"
                                style={{ fontSize: '0.8rem', marginTop: '5px', color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textDecoration: 'underline' }}
                                onClick={() => {
                                    setIsChangingStop(true);
                                    setSelectedRouteId(stop.routeId);
                                    // Trigger fetch of stops
                                    handleRouteSelect({ target: { value: stop.routeId } });
                                    setSelectedStopId(stop.id);
                                }}
                            >
                                Change Stop
                            </button>
                        </div>
                    </div>

                    {/* Bus Status */}
                    <div className="info-card card">
                        <div className="info-icon">🚌</div>
                        <div className="info-content">
                            <h3 className="info-label">Bus Status</h3>
                            <p className="info-value">
                                {bus ? (
                                    <span className="badge badge-success">Active</span>
                                ) : (
                                    <span className="badge badge-warning">Not Started</span>
                                )}
                            </p>
                            {bus && <p className="info-meta">Bus #{bus.bus_number}</p>}
                        </div>
                    </div>

                    {/* ETA */}
                    <div className="info-card card">
                        <div className="info-icon">⏱️</div>
                        <div className="info-content">
                            <h3 className="info-label">Estimated Arrival</h3>
                            <p className="info-value">
                                {eta !== null ? (
                                    <span className={eta <= 10 ? 'text-error' : 'text-success'}>
                                        {eta} min
                                    </span>
                                ) : (
                                    <span className="text-muted">--</span>
                                )}
                            </p>
                            {busDistance !== null && busLocation && (
                                <p className="info-meta" style={{ color: busDistance < 500 ? '#10b981' : '#6b7280' }}>
                                    📍 {busDistance}m away
                                </p>
                            )}
                            {isLocked && (
                                <p className="info-meta text-error">⚠️ Attendance Locked</p>
                            )}
                        </div>
                    </div>

                    {/* Attendance Status */}
                    <div className="info-card card">
                        <div className="info-icon">✅</div>
                        <div className="info-content">
                            <h3 className="info-label">Today's Attendance</h3>
                            <p className="info-value">
                                {attendanceStatus === 'present' ? (
                                    <span className="badge badge-success">Present</span>
                                ) : (
                                    <span className="badge badge-error">Absent</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Attendance Confirmation */}
                <div className="attendance-section card">
                    <h2 className="section-title">Confirm Your Attendance</h2>
                    <p className="section-description">
                        {isLocked
                            ? '⚠️ Attendance is locked. The bus is too close to your stop.'
                            : 'Will you be taking the bus today? Please confirm your attendance.'
                        }
                    </p>
                    <div className="attendance-buttons">
                        <button
                            className={`btn ${attendanceStatus === 'present' ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => confirmAttendance('present')}
                            disabled={isLocked || attendanceStatus === 'present'}
                        >
                            <span>✅</span>
                            I'm Coming
                        </button>
                        <button
                            className={`btn ${attendanceStatus === 'absent' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => confirmAttendance('absent')}
                        >
                            <span>❌</span>
                            Not Coming
                        </button>
                    </div>
                </div>

                {/* Map */}
                <div className="map-section card">
                    <h2 className="section-title">Live Bus Tracking</h2>
                    <BusMap
                        stops={routeStops}
                        busLocation={busLocation}
                        myStopId={stop.id}
                        visitedStops={visitedStops}
                        height="500px"
                    />
                </div>

                {/* Instructions */}
                <div className="instructions-section card">
                    <h3 className="section-title">📋 How It Works</h3>
                    <ul className="instructions-list">
                        <li>
                            <strong>Confirm Attendance:</strong> Mark yourself as "Present" if you'll be taking the bus today.
                        </li>
                        <li>
                            <strong>Attendance Lock:</strong> You can only confirm attendance when the bus is more than 10 minutes away from your stop.
                        </li>
                        <li>
                            <strong>Live Tracking:</strong> Watch the bus move in real-time on the map once the driver starts the trip.
                        </li>
                        <li>
                            <strong>Notifications:</strong> You'll receive alerts when the bus is approaching your stop.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default StudentDashboard;
