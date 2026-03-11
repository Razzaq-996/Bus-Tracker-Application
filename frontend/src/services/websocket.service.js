/**
 * Enhanced WebSocket Service (2026 Production-Grade)
 * Features:
 * - Exponential backoff reconnection
 * - Heartbeat/ping system
 * - Offline GPS batching
 * - Connection state management
 * - Automatic retry on failure
 */

import { io } from 'socket.io-client';

class WebSocketService {
    constructor() {
        this.socket = null;
        this.token = null;
        this.listeners = new Map();

        // Reconnection state
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.reconnectTimer = null;
        this.isManualDisconnect = false;

        // Heartbeat state
        this.heartbeatInterval = null;
        this.heartbeatFrequency = 30000; // 30 seconds
        this.lastPongTime = null;
        this.connectionTimeout = 60000; // 60 seconds without pong = dead connection

        // Offline batching
        this.offlineBatch = [];
        this.maxBatchSize = 100;
        this.isOnline = true;

        // Connection state callbacks
        this.onConnectCallbacks = [];
        this.onDisconnectCallbacks = [];
        this.onReconnectCallbacks = [];
    }

    /**
     * Connect to WebSocket server with exponential backoff
     */
    connect(token) {
        if (this.socket?.connected) {
            console.log('🔌 Already connected');
            return;
        }

        this.token = token;
        this.isManualDisconnect = false;

        // Create socket with reconnection disabled (we handle it manually)
        this.socket = io({
            autoConnect: false,
            reconnection: false, // We handle reconnection manually
            timeout: 10000
        });

        // Setup event listeners
        this.setupEventListeners();

        // Connect
        console.log('🔌 Connecting to WebSocket...');
        this.socket.connect();
    }

    /**
     * Setup all socket event listeners
     */
    setupEventListeners() {
        // Connection successful
        this.socket.on('connect', () => {
            console.log('✅ WebSocket connected');
            this.isOnline = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;

            // Authenticate
            if (this.token) {
                this.socket.emit('authenticate', { token: this.token });
            }

            // Start heartbeat
            this.startHeartbeat();

            // Flush offline batch
            this.flushOfflineBatch();

            // Trigger connect callbacks
            this.onConnectCallbacks.forEach(cb => cb());
        });

        // Authentication successful
        this.socket.on('authenticated', (data) => {
            console.log('✅ Authenticated:', data);
        });

        // Authentication error
        this.socket.on('auth-error', (data) => {
            console.error('❌ Auth error:', data.message);
        });

        // Disconnection
        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected:', reason);
            this.isOnline = false;
            this.stopHeartbeat();

            // Trigger disconnect callbacks
            this.onDisconnectCallbacks.forEach(cb => cb(reason));

            // Attempt reconnection if not manual disconnect
            if (!this.isManualDisconnect) {
                this.scheduleReconnect();
            }
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
            this.isOnline = false;

            if (!this.isManualDisconnect) {
                this.scheduleReconnect();
            }
        });

        // Heartbeat pong response
        this.socket.on('pong', () => {
            this.lastPongTime = Date.now();
            console.log('💓 Heartbeat pong received');
        });
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached. Giving up.');
            return;
        }

        this.reconnectAttempts++;

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );

        console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            console.log('🔄 Attempting reconnection...');
            this.socket.connect();

            // Trigger reconnect callbacks
            this.onReconnectCallbacks.forEach(cb => cb(this.reconnectAttempts));
        }, delay);
    }

    /**
     * Start heartbeat/ping system
     */
    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing interval

        this.lastPongTime = Date.now();

        this.heartbeatInterval = setInterval(() => {
            if (!this.socket?.connected) {
                this.stopHeartbeat();
                return;
            }

            // Check if we've received a pong recently
            const timeSinceLastPong = Date.now() - this.lastPongTime;
            if (timeSinceLastPong > this.connectionTimeout) {
                console.warn('⚠️ No pong received for 60s. Connection may be dead. Reconnecting...');
                this.socket.disconnect();
                this.scheduleReconnect();
                return;
            }

            // Send ping
            console.log('💓 Sending heartbeat ping');
            this.socket.emit('ping');
        }, this.heartbeatFrequency);
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Disconnect (manual)
     */
    disconnect() {
        this.isManualDisconnect = true;
        this.stopHeartbeat();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        console.log('🔌 Manually disconnected');
    }

    /**
     * Send GPS location with offline batching
     */
    sendLocation(latitude, longitude, timestamp = Date.now()) {
        const locationData = { latitude, longitude, timestamp };

        if (this.socket?.connected) {
            // Online - send immediately
            this.socket.emit('send-location', locationData);
        } else {
            // Offline - batch for later
            console.warn('📦 Offline: Batching GPS point');
            this.offlineBatch.push(locationData);

            // Limit batch size
            if (this.offlineBatch.length > this.maxBatchSize) {
                this.offlineBatch.shift(); // Remove oldest
            }
        }
    }

    /**
     * Flush offline batch when connection is restored
     */
    flushOfflineBatch() {
        if (this.offlineBatch.length === 0) return;

        console.log(`📤 Flushing ${this.offlineBatch.length} offline GPS points`);

        if (this.socket?.connected) {
            this.socket.emit('send-location-batch', { points: this.offlineBatch });
            this.offlineBatch = [];
        }
    }

    /**
     * Send emergency SOS
     */
    sendSOS(message, location) {
        if (this.socket?.connected) {
            this.socket.emit('emergency-sos', { message, location, timestamp: Date.now() });
            console.log('🚨 SOS sent:', message);
        } else {
            console.error('❌ Cannot send SOS: Not connected');
        }
    }

    // ========== Event Listeners ==========

    onLocationUpdate(callback) {
        if (this.socket) {
            this.socket.on('receive-location', callback);
        }
    }

    onETAUpdate(callback) {
        if (this.socket) {
            this.socket.on('eta-update', callback);
        }
    }

    onStopVisited(callback) {
        if (this.socket) {
            this.socket.on('stop-visited', callback);
        }
    }

    onNotification(callback) {
        if (this.socket) {
            this.socket.on('notification', callback);
        }
    }

    onSOSReceived(callback) {
        if (this.socket) {
            this.socket.on('sos-alert', callback);
        }
    }

    // Connection state callbacks
    onConnect(callback) {
        this.onConnectCallbacks.push(callback);
    }

    onDisconnect(callback) {
        this.onDisconnectCallbacks.push(callback);
    }

    onReconnect(callback) {
        this.onReconnectCallbacks.push(callback);
    }

    // Room management
    joinRoom(room) {
        if (this.socket?.connected) {
            this.socket.emit('join-room', { room });
        }
    }

    leaveRoom(room) {
        if (this.socket?.connected) {
            this.socket.emit('leave-room', { room });
        }
    }

    // Remove event listener
    off(event, callback) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    // Connection status
    isConnected() {
        return this.socket?.connected || false;
    }

    getConnectionState() {
        return {
            connected: this.isConnected(),
            reconnectAttempts: this.reconnectAttempts,
            offlineBatchSize: this.offlineBatch.length,
            isOnline: this.isOnline
        };
    }
}

// Singleton instance
const websocketService = new WebSocketService();
export default websocketService;
