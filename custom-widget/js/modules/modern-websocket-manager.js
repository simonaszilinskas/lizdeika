/**
 * Modern WebSocket Manager
 * Replaces monolithic WebSocket handling with modular, testable implementation
 */

class ModernWebSocketManager {
    constructor(config = {}) {
        this.config = {
            url: config.url || 'ws://localhost:3002',
            agentId: config.agentId || 'unknown',
            reconnectionAttempts: config.reconnectionAttempts || 5,
            reconnectionDelay: config.reconnectionDelay || 1000,
            maxReconnectionDelay: config.maxReconnectionDelay || 30000,
            heartbeatInterval: config.heartbeatInterval || 15000,
            maxErrors: config.maxErrors || 3,
            ...config
        };
        
        // State management
        this.socket = null;
        this.isConnected = false;
        this.reconnectionAttempts = 0;
        this.reconnectionTimer = null;
        this.heartbeatTimer = null;
        
        // Event management
        this.eventHandlers = new Map();
        this.connectionListeners = [];
        this.errorListeners = [];
        
        // Logging
        this.logger = config.logger || console;
        
        // Circuit breaker for fallback
        this.errorCount = 0;
        this.circuitBreakerOpen = false;
        
        // Page visibility handling for better connection management
        this.setupPageVisibilityHandler();
        
        console.log('🔧 ModernWebSocketManager initialized:', this.config.url);
    }
    
    /**
     * Establish WebSocket connection
     */
    async connect() {
        if (this.circuitBreakerOpen) {
            this.logger.warn('🚨 Circuit breaker open, falling back to legacy implementation');
            throw new Error('Circuit breaker open');
        }
        
        if (this.isConnected || this.socket) {
            this.logger.warn('⚠️ Already connected or connecting');
            return;
        }
        
        try {
            this.logger.log('🔌 Connecting to WebSocket server:', this.config.url);
            this.logger.log('🔧 Agent ID for connection:', this.config.agentId);
            
            // Check if Socket.IO is available
            if (typeof io === 'undefined') {
                throw new Error('Socket.IO library not loaded');
            }
            
            // Use Socket.IO (same as legacy implementation)
            this.socket = io(this.config.url);
            
            this.setupSocketEventHandlers();
            this.startHeartbeat();
            
        } catch (error) {
            this.logger.error('💥 Connection error details:', error);
            this.handleError('Connection failed', error);
            throw error;
        }
    }
    
    /**
     * Setup Socket.IO event handlers
     */
    setupSocketEventHandlers() {
        if (!this.socket) return;
        
        // Connection events
        this.socket.on('connect', () => {
            this.logger.log('✅ Connected to WebSocket server');
            this.logger.log('🔧 Socket ID:', this.socket.id);
            this.isConnected = true;
            this.reconnectionAttempts = 0;
            this.errorCount = 0;
            this.circuitBreakerOpen = false;
            
            // Join agent dashboard
            this.logger.log('📡 Emitting join-agent-dashboard with agentId:', this.config.agentId);
            this.socket.emit('join-agent-dashboard', this.config.agentId);
            this.logger.log('✅ join-agent-dashboard event emitted');
            
            // Send immediate heartbeat to establish agent status
            this.logger.log('💓 Emitting heartbeat');
            this.send('heartbeat', { timestamp: Date.now() });
            
            this.notifyConnectionListeners('connected');
            this.emit('connect');
        });
        
        this.socket.on('disconnect', () => {
            this.logger.log('❌ Disconnected from WebSocket server');
            this.isConnected = false;
            this.notifyConnectionListeners('disconnected');
            this.emit('disconnect');
        });
        
        // Error handling
        this.socket.on('connect_error', (error) => {
            this.logger.error('💥 Connection error:', error);
            this.handleError('Connection error', error);
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            this.logger.log(`🔄 Reconnected after ${attemptNumber} attempts`);
            this.isConnected = true;
            this.errorCount = 0;
            this.circuitBreakerOpen = false;
            
            // Re-join agent dashboard and send heartbeat
            this.socket.emit('join-agent-dashboard', this.config.agentId);
            this.send('heartbeat', { timestamp: Date.now() });
            
            this.notifyConnectionListeners('reconnected');
            this.emit('reconnect', attemptNumber);
        });
        
        this.socket.on('reconnect_error', (error) => {
            this.logger.error('💥 Reconnection error:', error);
            this.handleError('Reconnection error', error);
        });
        
        this.socket.on('reconnect_failed', () => {
            this.logger.error('💥 Reconnection failed completely');
            this.handleError('Reconnection failed', new Error('Max reconnection attempts reached'));
            this.openCircuitBreaker();
        });
        
        // Application events (these will be forwarded to the dashboard)
        const appEvents = [
            'new-message',
            'connected-agents-update', 
            'system-mode-update',
            'tickets-reassigned',
            'customer-typing-status'
        ];
        
        appEvents.forEach(eventName => {
            this.socket.on(eventName, (data) => {
                this.logger.log(`📨 Received ${eventName}:`, data);
                this.emit(eventName, data);
            });
        });
    }
    
    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        this.logger.log('🔌 Disconnecting from WebSocket server');
        
        this.stopHeartbeat();
        this.clearReconnectionTimer();
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.notifyConnectionListeners('disconnected');
    }
    
    /**
     * Emit event to server
     */
    send(event, data) {
        if (!this.socket || !this.isConnected) {
            this.logger.warn(`⚠️ Cannot emit ${event}: not connected`);
            return false;
        }
        
        try {
            this.socket.emit(event, data);
            this.logger.log(`📤 Emitted ${event}:`, data);
            return true;
        } catch (error) {
            this.logger.error(`💥 Error emitting ${event}:`, error);
            this.handleError(`Emit ${event} failed`, error);
            return false;
        }
    }
    
    /**
     * Register event handler
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
        
        this.logger.log(`📝 Registered handler for ${event}`);
    }
    
    /**
     * Unregister event handler
     */
    off(event, handler) {
        if (!this.eventHandlers.has(event)) return;
        
        const handlers = this.eventHandlers.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
            this.logger.log(`🗑️ Unregistered handler for ${event}`);
        }
    }
    
    /**
     * Emit event to registered handlers
     */
    emit(event, data) {
        if (!this.eventHandlers.has(event)) return;
        
        const handlers = this.eventHandlers.get(event);
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                this.logger.error(`💥 Error in ${event} handler:`, error);
            }
        });
    }
    
    /**
     * Get current connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectionAttempts: this.reconnectionAttempts,
            errorCount: this.errorCount,
            circuitBreakerOpen: this.circuitBreakerOpen
        };
    }
    
    /**
     * Register connection state change listener
     */
    onConnectionChange(callback) {
        this.connectionListeners.push(callback);
    }
    
    /**
     * Register error listener
     */
    onError(callback) {
        this.errorListeners.push(callback);
    }
    
    /**
     * Notify connection listeners
     */
    notifyConnectionListeners(status) {
        this.connectionListeners.forEach(callback => {
            try {
                callback(status, this.getConnectionStatus());
            } catch (error) {
                this.logger.error('💥 Error in connection listener:', error);
            }
        });
    }
    
    /**
     * Centralized error handling
     */
    handleError(type, error) {
        this.errorCount++;
        
        const errorInfo = {
            type,
            error: error.message || error,
            timestamp: new Date().toISOString(),
            errorCount: this.errorCount
        };
        
        this.logger.error(`💥 WebSocket error (${this.errorCount}/${this.maxErrors}):`, errorInfo);
        
        // Notify error listeners
        this.errorListeners.forEach(callback => {
            try {
                callback(errorInfo);
            } catch (callbackError) {
                this.logger.error('💥 Error in error listener:', callbackError);
            }
        });
        
        // Open circuit breaker if too many errors
        if (this.errorCount >= this.config.maxErrors) {
            this.openCircuitBreaker();
        }
    }
    
    /**
     * Open circuit breaker (fallback to legacy)
     */
    openCircuitBreaker() {
        this.circuitBreakerOpen = true;
        this.logger.error('🚨 Circuit breaker opened - falling back to legacy WebSocket implementation');
        
        // Notify that fallback is needed
        this.emit('circuit-breaker-open', {
            errorCount: this.errorCount,
            reason: 'Too many errors'
        });
    }
    
    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected) {
                this.send('heartbeat', { timestamp: Date.now() });
            }
        }, this.config.heartbeatInterval);
    }
    
    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    
    /**
     * Clear reconnection timer
     */
    clearReconnectionTimer() {
        if (this.reconnectionTimer) {
            clearTimeout(this.reconnectionTimer);
            this.reconnectionTimer = null;
        }
    }
    
    /**
     * Setup page visibility handler for better connection management
     */
    setupPageVisibilityHandler() {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && this.isConnected) {
                    // Page became visible again, send immediate heartbeat
                    this.send('heartbeat', { timestamp: Date.now() });
                    this.logger.log('👁️ Page became visible, sent heartbeat');
                }
            });
            
            // Also handle focus events
            window.addEventListener('focus', () => {
                if (this.isConnected) {
                    this.send('heartbeat', { timestamp: Date.now() });
                    this.logger.log('🎯 Page regained focus, sent heartbeat');
                }
            });
        }
    }
}

// Export for use in tests and main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernWebSocketManager;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.ModernWebSocketManager = ModernWebSocketManager;
}