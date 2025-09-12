/**
 * SOCKET MANAGER
 * Simple WebSocket connection manager for agent dashboard
 * 
 * Extracted from monolithic agent-dashboard.js for better maintainability
 * Handles WebSocket connection, events, and heartbeat functionality
 * 
 * @fileoverview Simple Socket.io connection manager with minimal complexity
 */

// Import constants conditionally for browser vs test environments
let TIMING, WEBSOCKET_EVENTS;
if (typeof window !== 'undefined') {
    try {
        const constants = require('../ui/constants.js');
        TIMING = constants.TIMING;
        WEBSOCKET_EVENTS = constants.WEBSOCKET_EVENTS;
    } catch (e) {
        // Fallback for tests - define minimal constants
        TIMING = { HEARTBEAT_INTERVAL: 30000 };
        WEBSOCKET_EVENTS = { HEARTBEAT: 'heartbeat' };
    }
} else {
    // Test environment fallbacks
    TIMING = { HEARTBEAT_INTERVAL: 30000 };
    WEBSOCKET_EVENTS = { HEARTBEAT: 'heartbeat' };
}

/**
 * SocketManager - Simple WebSocket connection service
 * 
 * Responsibilities:
 * - Socket.io connection management
 * - Event handler setup and cleanup
 * - Heartbeat mechanism
 * - Simple, focused interface
 */
class SocketManager {
    /**
     * Create socket manager
     * @param {Object} config - Configuration object
     * @param {string} config.apiUrl - Base API URL
     * @param {string} config.agentId - Agent identifier
     * @param {Object} config.eventHandlers - Event handler callbacks
     */
    constructor(config = {}) {
        this.apiUrl = config.apiUrl;
        this.agentId = config.agentId;
        this.eventHandlers = config.eventHandlers || {};
        
        this.socket = null;
        this.heartbeatInterval = null;
        this.isConnected = false;
        
        console.log(`🔌 SocketManager initialized for agent: ${this.agentId}`);
    }

    /**
     * Initialize WebSocket connection using direct Socket.io
     * Maintains exact same logic as original implementation
     */
    async initialize() {
        try {
            const wsUrl = this.apiUrl.replace('http', 'ws');
            
            // Direct Socket.io connection (like settings.js)
            this.socket = io(wsUrl);
            
            // Set up event handlers for dashboard functionality
            this.setupEventHandlers();
            
            // Start heartbeat to keep connection alive
            this.startHeartbeat();
            
            console.log('✅ Direct Socket.io WebSocket initialized successfully');
            
        } catch (error) {
            console.error('💥 Failed to initialize WebSocket connection:', error);
            // Let the dashboard handle the fallback
            if (this.eventHandlers.onError) {
                this.eventHandlers.onError(error);
            }
        }
    }

    /**
     * Setup WebSocket event handlers for dashboard functionality
     * Maintains exact same event handling as original
     */
    setupEventHandlers() {
        // Connection events using direct Socket.io
        this.socket.on('connect', () => {
            console.log('✅ Connected to WebSocket server via direct Socket.io');
            this.isConnected = true;
            
            // Call dashboard's registration method
            if (this.eventHandlers.onConnect) {
                this.eventHandlers.onConnect();
            }
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from WebSocket server');
            this.isConnected = false;
            
            if (this.eventHandlers.onDisconnect) {
                this.eventHandlers.onDisconnect();
            }
        });
        
        // Application events - delegate to dashboard handlers
        this.socket.on(WEBSOCKET_EVENTS.NEW_MESSAGE, (data) => {
            console.log('📨 NEW MESSAGE WEBSOCKET EVENT RECEIVED:', data);
            console.log('🔥 DEBUG: About to call eventHandlers.onNewMessage with data:', JSON.stringify(data, null, 2));
            if (this.eventHandlers.onNewMessage) {
                this.eventHandlers.onNewMessage(data);
            } else {
                console.error('❌ onNewMessage handler not found!');
            }
        });
        
        this.socket.on(WEBSOCKET_EVENTS.CONNECTED_AGENTS_UPDATE, (data) => {
            console.log('👥 Connected agents update:', data);
            if (this.eventHandlers.onAgentsUpdate) {
                this.eventHandlers.onAgentsUpdate(data);
            }
        });
        
        this.socket.on(WEBSOCKET_EVENTS.SYSTEM_MODE_UPDATE, (data) => {
            console.log('⚙️ System mode update:', data);
            if (this.eventHandlers.onSystemModeUpdate) {
                this.eventHandlers.onSystemModeUpdate(data);
            }
        });
        
        this.socket.on('tickets-reassigned', (data) => {
            console.log('🔄 Tickets reassigned:', data);
            if (this.eventHandlers.onTicketReassignments) {
                this.eventHandlers.onTicketReassignments(data);
            }
        });
        
        this.socket.on('customer-typing-status', (data) => {
            if (this.eventHandlers.onCustomerTyping) {
                this.eventHandlers.onCustomerTyping(data);
            }
        });

        this.socket.on('new-conversation', (data) => {
            console.log('🆕 New conversation created:', data);
            if (this.eventHandlers.onNewConversation) {
                this.eventHandlers.onNewConversation(data);
            }
        });
        
        // Listen for agent-sent messages to update UI immediately
        this.socket.on('agent-sent-message', (data) => {
            console.log('📤 Agent sent message:', data);
            if (this.eventHandlers.onAgentSentMessage) {
                this.eventHandlers.onAgentSentMessage(data);
            }
        });
        
        // Socket.io error handling
        this.socket.on('error', (error) => {
            console.error('💥 WebSocket error:', error);
            if (this.eventHandlers.onError) {
                this.eventHandlers.onError(error);
            }
        });
    }

    /**
     * Start heartbeat to keep WebSocket connection alive
     * Maintains exact same heartbeat logic as original
     */
    startHeartbeat() {
        // Send heartbeat every 15 seconds to keep connection active
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit(WEBSOCKET_EVENTS.HEARTBEAT, { 
                    timestamp: Date.now(),
                    agentId: this.agentId 
                });
                console.log('💓 Agent dashboard heartbeat sent');
            }
        }, TIMING.HEARTBEAT_INTERVAL);
    }

    /**
     * Stop heartbeat interval
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('💓 Heartbeat stopped');
        }
    }

    /**
     * Emit event to server
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn('⚠️ Cannot emit event, socket not connected:', event);
        }
    }

    /**
     * Get connection status
     * @returns {boolean} Whether socket is connected
     */
    isSocketConnected() {
        return this.socket && this.socket.connected;
    }

    /**
     * Disconnect socket
     */
    disconnect() {
        this.stopHeartbeat();
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        console.log('🔌 Socket disconnected');
    }

    /**
     * Update agent ID (for authentication refresh)
     * @param {string} newAgentId - New agent ID
     */
    updateAgentId(newAgentId) {
        this.agentId = newAgentId;
        console.log(`🔄 Socket manager agent ID updated to: ${this.agentId}`);
    }
}

// CommonJS exports for tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SocketManager };
}