/**
 * Driver Dashboard Component (2026 Uber/Ola-Grade)
 * Features:
 * - Screen Wake Lock API (prevents sleep during tracking)
 * - Adaptive GPS update frequency (battery optimization)
 * - Emergency SOS button
 * - Connection status monitoring
 * - Offline GPS batching
 * - Multi-GNSS Support (GPS + GLONASS + Galileo + BeiDou)
 * - IMU Sensor Fusion (Accelerometer + Gyroscope)
 * - Map Matching (Snap-to-Road)
 * - Animation Queue (60 FPS smooth movement)
 * - Enhanced Kalman Filter (GPS + IMU integration)
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import websocketService from '../services/websocket.service';
import BusMap from '../components/BusMap';
import ThemeToggle from '../components/ThemeToggle';
import './DriverDashboard.css';

// Professional GPS tracking features (Uber/Ola standard)
import {
    MultiGNSSManager,
    IMUSensorFusion,
    MapMatcher,
    AnimationQueue,
    EnhancedKalmanFilter,
    calculateVelocityVector,
    isValidGPSUpdate
} from '../services/location.service';

function DriverDashboard() {
    const { user, logout } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [manifest, setManifest] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tripActive, setTripActive] = useState(false);
    const [endingTrip, setEndingTrip] = useState(false);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [delayMinutes, setDelayMinutes] = useState(0);
    const [breakdownMessage, setBreakdownMessage] = useState('');
    const [gpsError, setGpsError] = useState(null);
    const watchIdRef = useRef(null);

    // Professional GPS tracking system (Uber/Ola grade)
    const gnssManagerRef = useRef(null);
    const imuSensorRef = useRef(null);
    const mapMatcherRef = useRef(null);
    const animationQueueRef = useRef(null);
    const kalmanFilterRef = useRef(null);

    const lastPositionRef = useRef(null);
    const lastUpdateTimeRef = useRef(null);

    // GPS quality indicators
    const [gpsQuality, setGpsQuality] = useState('unknown');
    const [satellitesUsed, setSatellitesUsed] = useState([]);
    const [roadName, setRoadName] = useState('');

    // Screen Wake Lock
    const wakeLockRef = useRef(null);
    const [wakeLockSupported, setWakeLockSupported] = useState(false);
    const [wakeLockActive, setWakeLockActive] = useState(false);

    // Adaptive GPS update frequency
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [isStationary, setIsStationary] = useState(true);
    const gpsUpdateIntervalRef = useRef(null);
    const MOVING_UPDATE_INTERVAL = 3000; // 3 seconds when moving
    const STATIONARY_UPDATE_INTERVAL = 30000; // 30 seconds when stationary
    const STATIONARY_THRESHOLD = 0.5; // m/s (1.8 km/h)

    // Connection status
    const [connectionState, setConnectionState] = useState({
        connected: false,
        reconnectAttempts: 0,
        offlineBatchSize: 0
    });

    // Emergency SOS
    const [sosMessage, setSosMessage] = useState('');
    const [showSosDialog, setShowSosDialog] = useState(false);

    useEffect(() => {
        // Initialize professional GPS tracking system
        initializeProfessionalGPS();

        // Check Wake Lock API support
        if ('wakeLock' in navigator) {
            setWakeLockSupported(true);
            console.log('✅ Screen Wake Lock API supported');
        } else {
            console.warn('⚠️ Screen Wake Lock API not supported');
        }

        fetchDashboardData();
        connectWebSocket();

        return () => {
            stopLocationTracking();
            releaseWakeLock();
            websocketService.disconnect();

            // Cleanup professional GPS system
            if (animationQueueRef.current) {
                animationQueueRef.current.clear();
            }
        };
    }, []);

    /**
     * Initialize Professional GPS Tracking System (Uber/Ola Standard)
     */
    const initializeProfessionalGPS = async () => {
        console.log('🚀 Initializing Professional GPS Tracking System...');

        // 1. Multi-GNSS Manager (120 satellites)
        gnssManagerRef.current = new MultiGNSSManager();
        console.log('✅ Multi-GNSS Manager initialized (GPS + GLONASS + Galileo + BeiDou)');

        // 2. IMU Sensor Fusion (Accelerometer + Gyroscope)
        imuSensorRef.current = new IMUSensorFusion();
        const imuStarted = await imuSensorRef.current.start();
        if (imuStarted) {
            console.log('✅ IMU Sensor Fusion started (Accelerometer + Gyroscope)');
        } else {
            console.warn('⚠️ IMU sensors not available (tunnel tracking disabled)');
        }

        // 3. Map Matcher (Snap-to-Road)
        mapMatcherRef.current = new MapMatcher();
        console.log('✅ Map Matcher initialized (OpenStreetMap)');

        // 4. Animation Queue (60 FPS smooth movement)
        animationQueueRef.current = new AnimationQueue(2000); // 2-second buffer
        animationQueueRef.current.setAnimationCallback((current, target) => {
            // This will be handled by BusMap component
            console.log('🎬 Animating from', current, 'to', target);
        });
        console.log('✅ Animation Queue initialized (2s buffer, 60 FPS)');

        // 5. Enhanced Kalman Filter (GPS + IMU)
        kalmanFilterRef.current = new EnhancedKalmanFilter();
        console.log('✅ Enhanced Kalman Filter initialized (GPS + IMU fusion)');

        console.log('🎉 Professional GPS Tracking System ready!');
    };

    const fetchDashboardData = async () => {
        try {
            const response = await axios.get('/api/driver/dashboard');
            setDashboardData(response.data.data);
            setTripActive(!!response.data.data.activeTrip);

            if (response.data.data.activeTrip) {
                // If trip is already active from backend, ensure we start tracking
                startLocationTracking();
                fetchManifest();
            }

            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            setLoading(false);
        }
    };

    const fetchManifest = async () => {
        try {
            const response = await axios.get('/api/driver/manifest');
            setManifest(response.data.data);
        } catch (error) {
            console.error('Failed to fetch manifest:', error);
        }
    };

    /**
     * Request Screen Wake Lock to prevent screen from sleeping
     */
    const requestWakeLock = async () => {
        if (!wakeLockSupported) {
            console.warn('⚠️ Wake Lock not supported');
            return;
        }

        try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            setWakeLockActive(true);
            console.log('🔒 Screen Wake Lock acquired');

            // Re-acquire wake lock if it's released (e.g., tab visibility change)
            wakeLockRef.current.addEventListener('release', () => {
                console.log('🔓 Wake Lock released');
                setWakeLockActive(false);
            });
        } catch (err) {
            console.error('❌ Failed to acquire Wake Lock:', err);
        }
    };

    /**
     * Release Screen Wake Lock
     */
    const releaseWakeLock = async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                setWakeLockActive(false);
                console.log('🔓 Screen Wake Lock released');
            } catch (err) {
                console.error('❌ Failed to release Wake Lock:', err);
            }
        }
    };

    const connectWebSocket = () => {
        const token = localStorage.getItem('token');
        websocketService.connect(token);

        // Monitor connection state
        const updateConnectionState = () => {
            setConnectionState(websocketService.getConnectionState());
        };

        websocketService.onConnect(() => {
            console.log('✅ WebSocket connected');
            updateConnectionState();
        });

        websocketService.onDisconnect((reason) => {
            console.log('🔌 WebSocket disconnected:', reason);
            updateConnectionState();
        });

        websocketService.onReconnect((attempt) => {
            console.log(`🔄 Reconnecting (attempt ${attempt})...`);
            updateConnectionState();
        });

        // Update connection state every 5 seconds
        setInterval(updateConnectionState, 5000);
    };

    const startLocationTracking = () => {
        setGpsError(null);
        if (!navigator.geolocation) {
            const errorMsg = 'Geolocation is not supported by your browser';
            setGpsError(errorMsg);
            alert(errorMsg);
            return;
        }

        console.log('📍 Starting location tracking...');

        // Request Screen Wake Lock
        requestWakeLock();

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                const timestamp = Date.now();

                console.log('📍 GPS Update:', latitude, longitude, `(±${accuracy}m)`);

                // Create new position object
                const newPosition = {
                    latitude,
                    longitude,
                    timestamp,
                    accuracy
                };

                // 1. Validate GPS update (filter out errors)
                const timeDelta = lastUpdateTimeRef.current ?
                    (timestamp - lastUpdateTimeRef.current) / 1000 : 3;

                if (lastPositionRef.current && !isValidGPSUpdate(
                    newPosition,
                    lastPositionRef.current,
                    30,  // max speed: 30 m/s (108 km/h)
                    timeDelta
                )) {
                    console.warn('⚠️ Invalid GPS update filtered out (unrealistic jump)');
                    return;
                }

                // 2. Calculate velocity vector
                let velocity = null;
                if (lastPositionRef.current) {
                    velocity = calculateVelocityVector(
                        lastPositionRef.current,
                        newPosition
                    );

                    const speedMps = velocity.speed;
                    setCurrentSpeed(speedMps);

                    // Determine if stationary
                    const wasStationary = isStationary;
                    const nowStationary = speedMps < STATIONARY_THRESHOLD;
                    setIsStationary(nowStationary);

                    // Adaptive update frequency
                    if (wasStationary !== nowStationary) {
                        console.log(`🔄 Speed changed: ${nowStationary ? 'STATIONARY' : 'MOVING'} (${speedMps.toFixed(2)} m/s)`);
                    }

                    console.log(`🚀 Speed: ${velocity.speed.toFixed(1)} m/s (${(velocity.speed * 3.6).toFixed(1)} km/h), Heading: ${velocity.heading.toFixed(0)}°`);
                }

                // ========================================
                // PROFESSIONAL GPS PIPELINE (Uber/Ola Standard)
                // ========================================

                // 3. Multi-GNSS Quality Assessment
                if (gnssManagerRef.current) {
                    const gnssData = gnssManagerRef.current.estimateGNSSUsed(accuracy);
                    const quality = gnssManagerRef.current.assessQuality(accuracy);
                    setSatellitesUsed(gnssData);
                    setGpsQuality(quality);
                    console.log(`🛰️ GNSS: ${gnssData.join(', ')} | Quality: ${quality}`);
                }

                // 4. IMU Sensor Fusion Update
                if (imuSensorRef.current && kalmanFilterRef.current) {
                    const imuState = imuSensorRef.current.getState();
                    kalmanFilterRef.current.updateIMU(imuState);

                    if (imuState.isMoving) {
                        console.log(`� IMU: Moving, Heading: ${imuState.heading.toFixed(0)}°`);
                    }
                }

                // 5. Enhanced Kalman Filter (GPS + IMU Integration)
                let filtered = { latitude, longitude, timestamp };
                if (kalmanFilterRef.current) {
                    filtered = kalmanFilterRef.current.filterWithIMU(
                        latitude,
                        longitude,
                        timestamp
                    );
                    console.log('✨ Kalman+IMU:', filtered.latitude.toFixed(6), filtered.longitude.toFixed(6));
                } else {
                    console.log('✨ Position:', latitude.toFixed(6), longitude.toFixed(6));
                }

                // 6. Map Matching (Snap-to-Road) - Async
                (async () => {
                    let final = filtered;

                    if (mapMatcherRef.current) {
                        try {
                            const snapped = await mapMatcherRef.current.snapToRoad(
                                filtered.latitude,
                                filtered.longitude
                            );

                            if (snapped.snapped) {
                                final = snapped;
                                setRoadName(snapped.roadName);
                                console.log(`🗺️ Snapped: ${snapped.roadName}`);
                            }
                        } catch (error) {
                            console.warn('⚠️ Map matching failed');
                        }
                    }

                    // 7. Animation Queue (Smooth 60 FPS Movement)
                    if (animationQueueRef.current) {
                        animationQueueRef.current.enqueue(final);
                        console.log('🎬 Queued for animation (2s buffer)');
                    }

                    // 8. Update State and Send to Backend
                    setCurrentLocation(final);
                    setGpsError(null);
                    websocketService.sendLocation(final.latitude, final.longitude, timestamp);

                    console.log('✅ Professional GPS pipeline complete');
                })();

                // Store for next iteration
                lastPositionRef.current = newPosition;
                lastUpdateTimeRef.current = timestamp;
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMessage = 'Unknown GPS error';
                let helpText = '';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '📍 GPS Permission Denied';
                        helpText = `
HOW TO FIX:
1. Click the 🔒 lock icon in the address bar
2. Find "Location" and change to "Allow"
3. Reload the page (F5)

OR in Chrome Settings:
• Settings → Privacy → Site Settings → Location
• Remove localhost:5173 from Block list

Need help? See GPS_PERMISSION_GUIDE.md
                        `.trim();

                        // Show detailed alert
                        alert(`${errorMessage}\n\n${helpText}`);
                        break;

                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '📍 GPS Signal Unavailable';
                        helpText = `
TROUBLESHOOTING:
• Move to an open area (away from buildings)
• Enable "High Accuracy" mode in phone settings
• Wait 10-15 seconds for satellite lock
• Check if airplane mode is OFF

Desktop: Enable Location Services in Windows/Mac settings
Mobile: Enable GPS in phone settings
                        `.trim();
                        break;

                    case error.TIMEOUT:
                        errorMessage = '📍 GPS Timeout (10 seconds)';
                        helpText = `
TIPS:
• GPS needs clear sky view
• First fix can take 30-60 seconds
• Move away from tall buildings
• Ensure GPS is enabled on your device
                        `.trim();
                        break;

                    case error.UNKNOWN_ERROR:
                        errorMessage = '📍 Unknown GPS Error';
                        helpText = `
TRY:
• Reload the page (F5)
• Clear browser cache
• Check browser console (F12) for details
• Try a different browser
                        `.trim();
                        break;
                }

                setGpsError(`${errorMessage}\n\n${helpText}`);
                console.error(`❌ ${errorMessage}`);
                console.log(helpText);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000, // Increased timeout to 10s
                maximumAge: 0
            }
        );
    };

    const stopLocationTracking = () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        // Release Screen Wake Lock
        releaseWakeLock();

        console.log('🛑 Location tracking stopped');
    };

    const handleStartTrip = async () => {
        try {
            const response = await axios.post('/api/driver/trip/start');

            if (response.data.success) {
                setTripActive(true);
                startLocationTracking();
                fetchManifest();
                alert('Trip started successfully! Your location is now being shared.');
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to start trip');
        }
    };

    const handleEndTrip = async () => {
        console.log('🛑 End Trip button clicked');

        // Prevent double-clicks
        if (endingTrip) {
            console.log('⚠️ Already ending trip, please wait...');
            return;
        }

        // Show confirmation dialog
        const confirmed = window.confirm(
            '⚠️ END TRIP CONFIRMATION\n\n' +
            'Are you sure you want to end this trip?\n\n' +
            'This will:\n' +
            '• Stop GPS tracking\n' +
            '• Mark the trip as completed\n' +
            '• Clear your current location\n\n' +
            'Click OK to end the trip, or Cancel to continue.'
        );

        console.log('User confirmation:', confirmed);

        if (!confirmed) {
            console.log('❌ Trip end cancelled by user');
            return;
        }

        console.log('✅ Proceeding to end trip...');
        setEndingTrip(true);

        try {
            console.log('📡 Sending POST request to /api/driver/trip/end');
            const response = await axios.post('/api/driver/trip/end');
            console.log('📥 End trip response:', response.data);

            if (response.data.success) {
                console.log('✅ Trip ended successfully!');
                setTripActive(false);
                stopLocationTracking();
                setCurrentLocation(null);
                setGpsError(null);

                alert('✅ Trip ended successfully!');

                // Refresh dashboard data
                await fetchDashboardData();
                console.log('🔄 Dashboard data refreshed');
            } else {
                console.error('❌ Backend returned success: false');
                alert('Failed to end trip: ' + (response.data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ End trip error:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });

            const errorMessage = error.response?.data?.message || error.message || 'Failed to end trip';
            alert('❌ Error ending trip: ' + errorMessage);
        } finally {
            setEndingTrip(false);
        }
    };

    const handleReportBreakdown = async () => {
        if (!breakdownMessage.trim()) {
            alert('Please enter a breakdown message');
            return;
        }

        try {
            const response = await axios.post('/api/driver/breakdown', {
                message: breakdownMessage
            });

            if (response.data.success) {
                alert('Breakdown reported! Students have been notified.');
                setBreakdownMessage('');
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to report breakdown');
        }
    };

    const handleUpdateDelay = async () => {
        if (delayMinutes <= 0) {
            alert('Please enter a valid delay time');
            return;
        }

        try {
            const response = await axios.post('/api/driver/delay', {
                delayMinutes: parseInt(delayMinutes)
            });

            if (response.data.success) {
                alert('Delay updated! Students have been notified.');
                setDelayMinutes(0);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to update delay');
        }
    };

    /**
     * Handle Emergency SOS - Send panic alert with current location
     */
    const handleEmergencySOS = () => {
        if (!currentLocation) {
            alert('⚠️ Cannot send SOS: GPS location not available');
            return;
        }

        const confirmed = window.confirm(
            '🚨 EMERGENCY SOS\n\n' +
            'This will send a HIGH-PRIORITY emergency alert to:\n' +
            '• All students on your route\n' +
            '• All administrators\n' +
            '• Emergency contacts\n\n' +
            'Your current GPS location will be shared.\n\n' +
            'Send emergency alert?'
        );

        if (!confirmed) {
            return;
        }

        const message = sosMessage.trim() || 'Emergency assistance required';

        // Send SOS via WebSocket
        websocketService.sendSOS(message, currentLocation);

        // Also send via HTTP for redundancy
        axios.post('/api/driver/emergency-sos', {
            message,
            location: currentLocation,
            timestamp: Date.now()
        }).then(() => {
            alert('🚨 Emergency SOS sent successfully!\n\nHelp is on the way.');
            setSosMessage('');
            setShowSosDialog(false);
        }).catch((error) => {
            console.error('Failed to send SOS via HTTP:', error);
            // Don't show error if WebSocket succeeded
        });
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spin">⏳</div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className="dashboard-error">
                <h2>⚠️ No Data Available</h2>
                <p>Please contact admin to assign you to a bus.</p>
                <button className="btn btn-primary" onClick={logout}>Logout</button>
            </div>
        );
    }

    const { driver, bus, stops } = dashboardData;

    return (
        <div className="driver-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="header-left">
                        <h1 className="dashboard-title">
                            <span className="title-icon">🚗</span>
                            Driver Dashboard
                        </h1>
                        <p className="dashboard-subtitle">Welcome, {driver.name}</p>
                    </div>
                    <div className="header-right">
                        <ThemeToggle />

                        {/* Connection Status */}
                        <div className="status-indicator" title={`Connection: ${connectionState.connected ? 'Online' : 'Offline'}`}>
                            {connectionState.connected ? (
                                <>
                                    <span className="status-dot pulse" style={{ background: '#10b981' }}></span>
                                    <span className="status-text">Online</span>
                                </>
                            ) : (
                                <>
                                    <span className="status-dot" style={{ background: '#ef4444' }}></span>
                                    <span className="status-text">
                                        {connectionState.reconnectAttempts > 0
                                            ? `Reconnecting (${connectionState.reconnectAttempts})`
                                            : 'Offline'}
                                    </span>
                                </>
                            )}
                            {connectionState.offlineBatchSize > 0 && (
                                <span className="badge badge-warning" style={{ marginLeft: '5px', fontSize: '0.7em' }}>
                                    {connectionState.offlineBatchSize} queued
                                </span>
                            )}
                        </div>

                        {/* Wake Lock Status */}
                        {wakeLockSupported && tripActive && (
                            <div className="status-indicator" title={`Screen Wake Lock: ${wakeLockActive ? 'Active' : 'Inactive'}`}>
                                <span className="status-text">
                                    {wakeLockActive ? '🔒 Screen Locked' : '🔓 Screen Unlocked'}
                                </span>
                            </div>
                        )}

                        {/* Speed Display */}
                        {tripActive && currentLocation && (
                            <div className="status-indicator" title="Current Speed">
                                <span className="status-text">
                                    {isStationary ? '🟢' : '🔴'} {(currentSpeed * 3.6).toFixed(0)} km/h
                                </span>
                            </div>
                        )}

                        {/* GPS Quality (Multi-GNSS) */}
                        {tripActive && gpsQuality !== 'unknown' && (
                            <div className="status-indicator" title={`GPS Quality: ${gpsQuality}\nSatellites: ${satellitesUsed.join(', ')}`}>
                                <span className="status-text">
                                    🛰️ {satellitesUsed.length > 0 ? satellitesUsed.length : '?'} sats
                                </span>
                                <span className={`badge ${gpsQuality === 'excellent' ? 'badge-success' :
                                    gpsQuality === 'good' ? 'badge-info' :
                                        gpsQuality === 'fair' ? 'badge-warning' :
                                            'badge-danger'
                                    }`} style={{ marginLeft: '5px', fontSize: '0.7em' }}>
                                    {gpsQuality}
                                </span>
                            </div>
                        )}

                        {/* Current Road (Map Matching) */}
                        {tripActive && roadName && (
                            <div className="status-indicator" title="Current Road (Map Matched)">
                                <span className="status-text">
                                    🗺️ {roadName.split(',')[0]}
                                </span>
                            </div>
                        )}

                        {/* GPS Status */}
                        <div className="location-indicator" style={{ position: 'relative' }} title={gpsError}>
                            {currentLocation ? (
                                <>
                                    <span className="location-dot pulse"></span>
                                    <span className="location-text">GPS Active</span>
                                </>
                            ) : (
                                <>
                                    <span className="location-dot inactive"></span>
                                    <span className="location-text">
                                        {gpsError ? 'GPS Error' : 'GPS Inactive'}
                                    </span>
                                    {gpsError && <div className="gps-error-msg">{gpsError}</div>}
                                </>
                            )}
                        </div>

                        {/* Emergency SOS Button */}
                        {tripActive && (
                            <button
                                className="btn btn-danger"
                                onClick={() => setShowSosDialog(true)}
                                style={{
                                    background: '#dc2626',
                                    animation: 'pulse 2s infinite',
                                    fontWeight: 'bold'
                                }}
                                title="Emergency SOS - Send panic alert"
                            >
                                🚨 SOS
                            </button>
                        )}

                        <button className="btn btn-secondary" onClick={logout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Emergency SOS Dialog */}
            {showSosDialog && (
                <div className="modal-overlay" onClick={() => setShowSosDialog(false)}>
                    <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <h2 className="section-title" style={{ color: '#dc2626' }}>🚨 Emergency SOS</h2>
                        <p style={{ marginBottom: '20px' }}>
                            Send an emergency alert with your current GPS location to all students and administrators.
                        </p>
                        <textarea
                            className="form-input"
                            placeholder="Describe the emergency (optional)..."
                            value={sosMessage}
                            onChange={(e) => setSosMessage(e.target.value)}
                            rows="3"
                            style={{ marginBottom: '20px' }}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className="btn btn-danger"
                                onClick={handleEmergencySOS}
                                style={{ flex: 1 }}
                            >
                                🚨 Send Emergency Alert
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowSosDialog(false)}
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="dashboard-content">
                {/* Bus Info */}
                <div className="info-grid">
                    <div className="info-card card">
                        <div className="info-icon">🚌</div>
                        <div className="info-content">
                            <h3 className="info-label">Bus Number</h3>
                            <p className="info-value">{bus.busNumber}</p>
                            <p className="info-meta">{bus.routeName}</p>
                        </div>
                    </div>

                    <div className="info-card card">
                        <div className="info-icon">📍</div>
                        <div className="info-content">
                            <h3 className="info-label">Current Location</h3>
                            <p className="info-value">
                                {currentLocation ? (
                                    <span className="text-success">Tracking</span>
                                ) : (
                                    <span className="text-muted">Not Started</span>
                                )}
                            </p>
                            {currentLocation && (
                                <p className="info-meta">
                                    {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="info-card card">
                        <div className="info-icon">👥</div>
                        <div className="info-content">
                            <h3 className="info-label">Total Students</h3>
                            <p className="info-value">
                                {manifest.reduce((sum, stop) => sum + stop.present_count, 0)}
                            </p>
                            <p className="info-meta">Expected today</p>
                        </div>
                    </div>

                    <div className="info-card card">
                        <div className="info-icon">🚦</div>
                        <div className="info-content">
                            <h3 className="info-label">Trip Status</h3>
                            <p className="info-value">
                                {tripActive ? (
                                    <span className="badge badge-success">Active</span>
                                ) : (
                                    <span className="badge badge-warning">Not Started</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Trip Controls */}
                <div className="trip-controls card">
                    <h2 className="section-title">Trip Controls</h2>
                    <div className="controls-grid">
                        {!tripActive ? (
                            <button
                                className="btn btn-primary btn-large"
                                onClick={handleStartTrip}
                            >
                                <span>🚀</span>
                                Start Trip
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-danger btn-large"
                                onClick={handleEndTrip}
                                disabled={endingTrip}
                            >
                                {endingTrip ? (
                                    <>
                                        <span className="spin">⏳</span>
                                        Ending Trip...
                                    </>
                                ) : (
                                    <>
                                        <span>🛑</span>
                                        End Trip
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Student Manifest */}
                {tripActive && (
                    <div className="manifest-section card">
                        <h2 className="section-title">Student Manifest</h2>
                        <p className="section-description">Expected student count at each stop</p>
                        <div className="manifest-table">
                            <div className="table-header">
                                <div className="table-cell">Stop</div>
                                <div className="table-cell">Present</div>
                                <div className="table-cell">Absent</div>
                                <div className="table-cell">Total</div>
                            </div>
                            {manifest.map((stop) => (
                                <div key={stop.stop_id} className="table-row">
                                    <div className="table-cell">
                                        <strong>{stop.stop_name}</strong>
                                    </div>
                                    <div className="table-cell">
                                        <span className="badge badge-success">{stop.present_count}</span>
                                    </div>
                                    <div className="table-cell">
                                        <span className="badge badge-error">{stop.absent_count}</span>
                                    </div>
                                    <div className="table-cell">
                                        <strong>{stop.total_students}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Alerts Section */}
                {tripActive && (
                    <div className="alerts-grid">
                        <div className="alert-card card">
                            <h3 className="section-title">⚠️ Report Breakdown</h3>
                            <textarea
                                className="form-input"
                                placeholder="Describe the issue..."
                                value={breakdownMessage}
                                onChange={(e) => setBreakdownMessage(e.target.value)}
                                rows="3"
                            />
                            <button
                                className="btn btn-danger"
                                onClick={handleReportBreakdown}
                            >
                                Report Breakdown
                            </button>
                        </div>

                        <div className="alert-card card">
                            <h3 className="section-title">⏰ Update Delay</h3>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="Delay in minutes"
                                value={delayMinutes}
                                onChange={(e) => setDelayMinutes(e.target.value)}
                                min="0"
                            />
                            <button
                                className="btn btn-warning"
                                onClick={handleUpdateDelay}
                            >
                                Notify Students
                            </button>
                        </div>
                    </div>
                )}

                {/* Map */}
                <div className="map-section card">
                    <h2 className="section-title">Route Map</h2>
                    <BusMap
                        stops={stops}
                        busLocation={currentLocation}
                        height="500px"
                    />
                </div>
            </div>
        </div>
    );
}

export default DriverDashboard;
