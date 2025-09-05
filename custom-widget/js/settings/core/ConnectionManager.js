/**
 * Connection Manager for Settings System
 * 
 * Manages WebSocket connections, real-time updates, and heartbeat functionality
 * Replaces scattered connection logic from the monolithic Settings class
 */

import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class ConnectionManager {
    constructor(apiUrl, stateManager) {
        this.apiUrl = apiUrl;
        this.stateManager = stateManager;
        this.socket = null;
        
        // Connection state
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // Heartbeat management
        this.heartbeatInterval = null;
        this.heartbeatFrequency = 15000; // 15 seconds
        
        // Event listeners
        this.eventListeners = new Map();
        
        console.log('🔌 ConnectionManager: Initialized with URL:', this.apiUrl);
    }

    /**
     * Initialize connection manager
     */
    async initialize() {
        try {
            // Initialize WebSocket connection if Socket.IO is available
            if (typeof io !== 'undefined') {
                await this.initializeWebSocket();
            } else {
                console.log('⚠️ ConnectionManager: Socket.IO not available, using polling only');
            }
            
            console.log('✅ ConnectionManager: Initialization complete');
        } catch (error) {
            ErrorHandler.logError(error, 'ConnectionManager initialization failed');
            // Don't throw - connection is optional
        }
    }

    /**
     * Initialize WebSocket connection
     */
    async initializeWebSocket() {
        try {
            console.log('🚀 ConnectionManager: Initializing WebSocket connection');
            
            this.socket = io(this.apiUrl, {
                transports: ['websocket', 'polling'],
                timeout: 5000,
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: this.reconnectDelay,
                reconnectionDelayMax: 5000,
                maxReconnectionAttempts: this.maxReconnectAttempts
            });

            this.setupWebSocketEventListeners();
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to initialize WebSocket connection');
        }
    }

    /**
     * Setup WebSocket event listeners
     */
    setupWebSocketEventListeners() {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            console.log('🔌 ConnectionManager: WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Join appropriate rooms based on user role
            this.joinRooms();
            
            // Start heartbeat
            this.startHeartbeat();
            
            // Emit connection event
            this.emit('connected');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 ConnectionManager: WebSocket disconnected:', reason);
            this.isConnected = false;
            
            // Stop heartbeat
            this.stopHeartbeat();
            
            // Emit disconnection event
            this.emit('disconnected', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('🔌 ConnectionManager: Connection error:', error);
            this.reconnectAttempts++;
            
            ErrorHandler.logError(error, 'WebSocket connection error');
            this.emit('connectionError', error);
        });

        // Reconnection events
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`🔌 ConnectionManager: Reconnected after ${attemptNumber} attempts`);
            this.emit('reconnected', attemptNumber);
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔌 ConnectionManager: Reconnection attempt ${attemptNumber}`);
            this.emit('reconnectAttempt', attemptNumber);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('🔌 ConnectionManager: Reconnection failed after maximum attempts');
            this.emit('reconnectFailed');
        });

        // Settings-specific real-time events
        this.socket.on('system-mode-changed', (data) => {
            console.log('🎛️ ConnectionManager: System mode changed via WebSocket:', data.mode);
            this.stateManager.setSystemMode(data.mode);
        });

        this.socket.on('agents-updated', (data) => {
            console.log('👥 ConnectionManager: Agents updated via WebSocket:', data.agents.length);
            this.stateManager.setConnectedAgents(data.agents);
        });

        this.socket.on('users-updated', (data) => {
            console.log('👤 ConnectionManager: Users updated via WebSocket:', data.users.length);
            if (this.stateManager.isCurrentUserAdmin()) {
                this.stateManager.setUsers(data.users);
            }
        });

        // Generic real-time update event
        this.socket.on('settings-update', (data) => {
            console.log('⚡ ConnectionManager: Settings update received:', data.type);
            this.handleSettingsUpdate(data);
        });
    }

    /**
     * Join appropriate WebSocket rooms based on user role
     */
    joinRooms() {
        if (!this.socket || !this.isConnected) return;

        const currentUser = this.stateManager.getCurrentUser();
        
        if (currentUser) {
            // Join general settings room
            this.socket.emit('join-room', 'settings');
            
            // Join agent dashboard if user is an agent or admin
            if (currentUser.role === 'agent' || currentUser.role === 'admin') {
                console.log('📡 ConnectionManager: Joining agent dashboard as:', currentUser.id);
                this.socket.emit('join-agent-dashboard', currentUser.id);
            }
            
            // Join admin room if user is admin
            if (currentUser.role === 'admin') {
                this.socket.emit('join-room', 'admin');
            }
            
            console.log('🏠 ConnectionManager: Joined rooms for user:', currentUser.email);
        }
    }

    /**
     * Handle generic settings update
     */
    handleSettingsUpdate(data) {
        switch (data.type) {
            case 'system-mode':
                this.stateManager.setSystemMode(data.payload.mode);
                break;
                
            case 'connected-agents':
                this.stateManager.setConnectedAgents(data.payload.agents);
                break;
                
            case 'users':
                if (this.stateManager.isCurrentUserAdmin()) {
                    this.stateManager.setUsers(data.payload.users);
                }
                break;
                
            case 'widget-config':
                this.stateManager.setWidgetConfiguration(data.payload.config);
                break;
                
            default:
                console.log('❓ ConnectionManager: Unknown settings update type:', data.type);
        }
    }

    // =========================
    // HEARTBEAT MANAGEMENT
    // =========================

    /**
     * Start sending periodic heartbeats
     */
    startHeartbeat() {
        if (!this.socket || !this.isConnected) return;
        
        // Clear any existing interval
        this.stopHeartbeat();
        
        // Send initial heartbeat
        this.sendHeartbeat();
        
        // Set up periodic heartbeats
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatFrequency);
        
        console.log(`💓 ConnectionManager: Heartbeat started (${this.heartbeatFrequency}ms interval)`);
    }

    /**
     * Stop sending heartbeats
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('💔 ConnectionManager: Heartbeat stopped');
        }
    }

    /**
     * Send heartbeat to server
     */
    sendHeartbeat() {
        if (!this.socket || !this.isConnected) return;
        
        const currentUser = this.stateManager.getCurrentUser();
        if (currentUser && (currentUser.role === 'agent' || currentUser.role === 'admin')) {
            this.socket.emit('heartbeat', { 
                timestamp: Date.now(),
                userId: currentUser.id,
                source: 'settings'
            });
            console.log('💓 ConnectionManager: Heartbeat sent');
        }
    }

    // =========================
    // EVENT SYSTEM
    // =========================

    /**
     * Add event listener for connection events
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
        
        console.log(`📡 ConnectionManager: Listener added for event: ${event}`);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (!this.eventListeners.has(event)) return;
        
        const callbacks = this.eventListeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Emit connection event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (!this.eventListeners.has(event)) return;
        
        this.eventListeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                ErrorHandler.logError(error, `ConnectionManager event callback failed for: ${event}`);
            }
        });
        
        console.log(`📤 ConnectionManager: Event emitted: ${event}`);
    }

    // =========================
    // PUBLIC API METHODS
    // =========================

    /**
     * Send custom message via WebSocket
     * @param {string} event - Event name
     * @param {*} data - Data to send
     */
    send(event, data) {
        if (!this.socket || !this.isConnected) {
            console.warn('⚠️ ConnectionManager: Cannot send message - not connected');
            return false;
        }
        
        this.socket.emit(event, data);
        console.log(`📤 ConnectionManager: Message sent: ${event}`);
        return true;
    }

    /**
     * Force reconnection
     */
    forceReconnect() {
        if (this.socket) {
            console.log('🔄 ConnectionManager: Forcing reconnection');
            this.socket.disconnect();
            this.socket.connect();
        }
    }

    /**
     * Get connection status
     * @returns {Object} Connection status object
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            hasSocket: !!this.socket,
            socketConnected: this.socket?.connected || false,
            heartbeatActive: !!this.heartbeatInterval
        };
    }

    /**
     * Check if connection is healthy
     * @returns {boolean} True if connection is healthy
     */
    isHealthy() {
        return this.isConnected && 
               this.socket && 
               this.socket.connected && 
               this.reconnectAttempts < this.maxReconnectAttempts;
    }

    /**
     * Update user context (call when user changes)
     */
    updateUserContext() {
        if (this.isConnected) {
            // Leave current rooms and rejoin with new user context
            this.joinRooms();
            
            // Restart heartbeat with new user context
            this.startHeartbeat();
        }
    }

    // =========================
    // DEBUGGING & UTILITIES
    // =========================

    /**
     * Get connection debug info
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        return {
            apiUrl: this.apiUrl,
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            heartbeatActive: !!this.heartbeatInterval,
            heartbeatFrequency: this.heartbeatFrequency,
            socketInfo: this.socket ? {
                connected: this.socket.connected,
                id: this.socket.id,
                transport: this.socket.io.engine.transport.name
            } : null,
            eventListenerCount: Array.from(this.eventListeners.entries()).reduce((acc, [event, callbacks]) => {
                acc[event] = callbacks.length;
                return acc;
            }, {})
        };
    }

    /**
     * Enable debug mode (more verbose logging)
     */
    enableDebugMode() {
        if (this.socket) {
            this.socket.on('*', (eventName, data) => {
                console.log(`🐛 ConnectionManager: Event received: ${eventName}`, data);
            });
        }
        console.log('🐛 ConnectionManager: Debug mode enabled');
    }

    /**
     * Test connection by sending a ping
     */
    testConnection() {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.isConnected) {
                reject(new Error('Not connected'));
                return;
            }
            
            const timeout = setTimeout(() => {
                reject(new Error('Ping timeout'));
            }, 5000);
            
            this.socket.emit('ping', { timestamp: Date.now() });
            
            this.socket.once('pong', (data) => {
                clearTimeout(timeout);
                resolve({
                    roundTripTime: Date.now() - data.timestamp,
                    serverTimestamp: data.serverTimestamp
                });
            });
        });
    }

    /**
     * Cleanup method for proper shutdown
     */
    destroy() {
        console.log('🧹 ConnectionManager: Starting cleanup');
        
        // Stop heartbeat
        this.stopHeartbeat();
        
        // Disconnect socket
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        // Clear event listeners
        this.eventListeners.clear();
        
        // Reset state
        this.isConnected = false;
        this.reconnectAttempts = 0;
        
        console.log('🧹 ConnectionManager: Cleanup complete');
    }
}