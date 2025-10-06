/**
 * WEBSOCKET SERVICE
 *
 * Main Purpose: Manage real-time bidirectional communication between clients and server
 *
 * Key Responsibilities:
 * - Connection Management: Handle Socket.IO client connections and disconnections
 * - Room Management: Organize clients into rooms (conversations, agents, settings)
 * - Event Routing: Route and broadcast events to appropriate clients
 * - Agent Lifecycle: Track agent online/offline status with grace periods
 * - Real-time Updates: Emit messages, typing indicators, and status changes
 * - Heartbeat Monitoring: Keep agent connections alive and detect stale connections
 *
 * Dependencies:
 * - Socket.IO for WebSocket server functionality
 * - Agent service for agent status and assignment management
 * - Conversation service for ticket redistribution
 * - Logger for structured event logging with correlation IDs
 *
 * Features:
 * - Multi-room support for isolated communication channels
 * - Automatic ticket redistribution when agents join
 * - Graceful disconnection handling with reconnection support
 * - Heartbeat-based connection monitoring
 * - Typing indicators for both agents and customers
 * - Real-time system mode and status broadcasts
 *
 * WebSocket Rooms:
 * - 'agents': All connected agents receive broadcasts (new messages, status updates)
 * - 'settings': Settings page clients receive configuration updates
 * - [conversationId]: Customers and assigned agents in specific conversations
 *
 * WebSocket Events (Client → Server):
 * - 'join-conversation': Customer joins their conversation room
 * - 'join-agent-dashboard': Agent connects to dashboard (triggers online status)
 * - 'join-room': Generic room joining (for settings page)
 * - 'agent-typing': Agent typing indicator
 * - 'customer-typing': Customer typing indicator
 * - 'heartbeat': Keep-alive signal from agents (includes 'source' field: 'dashboard' or 'settings')
 * - 'request-current-state': Request current system state (agents, mode)
 * - 'disconnect': Client disconnection (handled by Socket.IO)
 *
 * WebSocket Events (Server → Client):
 * - 'new-message': Broadcast customer message to agents
 * - 'agent-message': Send agent response to customer
 * - 'agent-typing-status': Typing indicator to customer
 * - 'customer-typing-status': Typing indicator to agents
 * - 'system-mode-update': System mode change broadcast
 * - 'connected-agents-update': Agent status update broadcast
 * - 'tickets-reassigned': Ticket reassignment notification
 * - 'categories-updated': Category configuration changes
 * - 'heartbeat-ack': Heartbeat acknowledgment
 * - 'current-state': Response to state request
 *
 * Heartbeat Source Tracking (Issue #28 fix):
 * - Dashboard heartbeats (source='dashboard'): Update agent status → marks as actively working
 * - Settings heartbeats (source='settings'): Keep socket alive only → doesn't claim active work
 * - This prevents agents browsing settings from being marked as handling conversations
 * - Agents marked offline after 5 minutes without dashboard heartbeat (changed from 120 min)
 * - Periodic broadcast (30s) ensures dashboards reflect timeout changes in real-time
 *
 * Grace Period Handling:
 * - Agents are not immediately marked offline on disconnect
 * - Heartbeat timeout (5 minutes) determines actual offline status
 * - Allows seamless reconnection when switching browser tabs
 *
 * Ticket Redistribution:
 * - When agents join, orphaned tickets are gradually reassigned
 * - Limits redistribution to 2 tickets at a time to prevent overload
 * - Broadcasts reassignments to all agents for UI updates
 *
 * Notes:
 * - Each socket receives a correlation ID for request tracing
 * - Event listeners are logged in debug mode for troubleshooting
 * - Agent activity timestamps are updated on typing and heartbeat
 * - Socket.agentId is stored for agent identification across events
 */
const agentService = require('./agentService');
const conversationService = require('./conversationService');
const { createLogger } = require('../utils/logger');

class WebSocketService {
    /**
     * Initialize WebSocket service with Socket.IO instance
     *
     * @param {Object} io - Socket.IO server instance
     */
    constructor(io) {
        this.io = io;
        this.logger = createLogger('websocketService');
        this.setupSocketHandlers();
        this.setupPeriodicBroadcast();
    }

    /**
     * Setup all WebSocket event handlers
     *
     * Registers handlers for connection, disconnection, and all custom events.
     * Called once during service initialization.
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            this.logger.info('WebSocket client connected', { 
                socketId: socket.id,
                correlationId: socket.correlationId 
            });
            
            // Debug: log all events from this socket
            const originalOn = socket.on.bind(socket);
            socket.on = function(event, handler) {
                this.logger.debug('Socket event listener registered', { 
                    socketId: socket.id,
                    event,
                    correlationId: socket.correlationId 
                });
                return originalOn(event, handler);
            }.bind(this);
            
            // Join conversation room
            socket.on('join-conversation', (conversationId) => {
                socket.join(conversationId);
                this.logger.info('Socket joined conversation', { 
                    socketId: socket.id,
                    conversationId,
                    correlationId: socket.correlationId 
                });
            });
            
            // Join settings room
            socket.on('join-room', (room) => {
                socket.join(room);
                console.log(`Socket ${socket.id} joined room: ${room}`);
            });

            // Join agent dashboard
            socket.on('join-agent-dashboard', async (agentId) => {
                socket.join('agents');
                socket.join('settings');
                socket.agentId = agentId;
                console.log('🔥 DEBUG: Socket', socket.id, 'joined agents room for agent:', agentId);

                // Update agent status to online
                await agentService.setAgentOnline(agentId, socket.id);

                console.log(`Agent ${agentId} connected with socket ${socket.id}`);

                // Send current system mode and connected agents to the joining agent
                const systemMode = await agentService.getSystemMode();
                socket.emit('system-mode-update', { mode: systemMode });

                // Handle gradual ticket redistribution when agents join
                const redistributions = await agentService.redistributeOrphanedTickets(conversationService, 2);
                if (redistributions.length > 0) {
                    console.log(`Redistributed ${redistributions.length} tickets to new agent ${agentId}`);
                    this.io.to('agents').emit('tickets-reassigned', {
                        reassignments: redistributions,
                        reason: 'agent_joined'
                    });
                }

                // Broadcast connected agents update to all agents
                const connectedAgents = await agentService.getConnectedAgents();
                this.io.to('agents').emit('connected-agents-update', { agents: connectedAgents });
            });
            
            // Handle agent typing
            socket.on('agent-typing', async (data) => {
                const { conversationId, isTyping } = data;
                
                // Update agent activity timestamp
                if (socket.agentId) {
                    await agentService.updateAgentActivity(socket.agentId);
                }
                
                socket.to(conversationId).emit('agent-typing-status', {
                    isTyping,
                    timestamp: new Date()
                });
            });
            
            // Handle customer typing
            socket.on('customer-typing', (data) => {
                const { conversationId, isTyping } = data;
                this.io.to('agents').emit('customer-typing-status', {
                    conversationId,
                    isTyping,
                    timestamp: new Date()
                });
            });
            
            // Request current state (simplified)
            socket.on('request-current-state', async (stateType) => {
                try {
                    switch (stateType) {
                        case 'connected-agents':
                            const agents = await agentService.getConnectedAgents();
                            socket.emit('current-state', { type: 'connected-agents', data: agents });
                            break;
                        case 'system-mode':
                            const mode = await agentService.getSystemMode();
                            socket.emit('current-state', { type: 'system-mode', data: mode });
                            break;
                        default:
                            console.log(`Unknown state type requested: ${stateType}`);
                    }
                } catch (error) {
                    console.error('Error handling state request:', error);
                }
            });

            socket.on('disconnect', async () => {
                console.log('Client disconnected:', socket.id);
                
                // Don't immediately set agent to offline - rely on heartbeat timeout
                // This allows agents to reconnect when switching pages without being marked offline
                if (socket.agentId) {
                    console.log(`🟡 Agent ${socket.agentId} disconnected but not marking offline (grace period)`);
                    
                    // Still broadcast the update so UI can reflect potential change
                    const connectedAgents = await agentService.getConnectedAgents();
                    this.io.to('agents').emit('connected-agents-update', { agents: connectedAgents });
                }
            });
            
            // Handle heartbeat to keep agent status updated
            // Heartbeat source determines whether agent is actively working:
            // - 'dashboard': Agent is actively handling conversations → update agent_status
            // - 'settings': Agent is browsing settings → keep socket alive only
            // - undefined/unknown: Backward compatibility → update agent_status (safe default)
            socket.on('heartbeat', async (data) => {
                if (socket.agentId) {
                    try {
                        const source = data?.source ?? 'unknown';

                        // Only update agent status if heartbeat is from dashboard
                        // Settings heartbeats just keep socket alive without claiming "actively working"
                        // This prevents agents from being marked as online when they're only in settings
                        if (source === 'dashboard') {
                            await agentService.updateAgentActivity(socket.agentId);
                            console.log(`💓 Dashboard heartbeat from ${socket.agentId} - updating status`);
                        } else if (source === 'settings') {
                            console.log(`💓 Settings heartbeat from ${socket.agentId} - socket keepalive only`);
                        } else {
                            // Backward compatibility: unknown source defaults to updating status
                            await agentService.updateAgentActivity(socket.agentId);
                        }

                        // Always send heartbeat acknowledgment
                        socket.emit('heartbeat-ack', {
                            timestamp: new Date(),
                            agentId: socket.agentId
                        });
                    } catch (error) {
                        console.error('Error handling heartbeat for agent', socket.agentId, ':', error);
                    }
                }
            });
        });
    }

    /**
     * Setup periodic broadcast of agent status
     *
     * Broadcasts connected-agents-update every 30 seconds to ensure dashboards
     * reflect agent timeout changes (5-minute inactive threshold).
     *
     * Without this, agents who timeout are only removed from the list when
     * another agent connects/disconnects, which could take hours in quiet periods.
     *
     * Interval matches frontend polling (AgentStatusModule: 30s) for consistency.
     */
    setupPeriodicBroadcast() {
        setInterval(async () => {
            try {
                const connectedAgents = await agentService.getConnectedAgents();
                this.io.to('agents').emit('connected-agents-update', { agents: connectedAgents });
                console.log(`📊 Periodic agent status broadcast: ${connectedAgents.length} agents online`);
            } catch (error) {
                console.error('Error in periodic agent status broadcast:', error);
            }
        }, 30000); // 30 seconds
    }

    /**
     * Broadcast new customer message to all connected agents
     *
     * @param {Object} messageData - Message data object
     * @param {string} messageData.conversationId - Conversation ID
     * @param {string} messageData.content - Message content
     * @param {string} messageData.sender - Sender identifier
     */
    emitNewMessage(messageData) {
        this.io.to('agents').emit('new-message', messageData);
    }

    /**
     * Send agent's response to customer in specific conversation
     *
     * @param {string} conversationId - Conversation room ID
     * @param {Object} messageData - Message data object
     * @param {string} messageData.content - Message content
     * @param {string} messageData.agentId - Agent identifier
     */
    emitAgentMessage(conversationId, messageData) {
        this.io.to(conversationId).emit('agent-message', messageData);
    }

    /**
     * Broadcast agent status change to all agents
     *
     * @param {string} agentId - Agent user ID
     * @param {string} status - New status (online/offline/busy)
     */
    emitAgentStatusUpdate(agentId, status) {
        this.io.to('agents').emit('agent-status-update', {
            agentId,
            status,
            timestamp: new Date()
        });
    }

    /**
     * Emit typing status to appropriate target
     *
     * @param {string} target - Target room ('agents' or conversationId)
     * @param {Object} data - Typing indicator data
     * @param {boolean} data.isTyping - Whether user is currently typing
     * @param {string} data.conversationId - Conversation ID (for customer typing)
     */
    emitTypingStatus(target, data) {
        if (target === 'agents') {
            this.io.to('agents').emit('customer-typing-status', data);
        } else {
            this.io.to(target).emit('agent-typing-status', data);
        }
    }

    /**
     * Get total count of connected WebSocket clients
     *
     * @returns {number} Number of connected clients (agents + customers)
     */
    getConnectedClientsCount() {
        return this.io.engine.clientsCount;
    }

    /**
     * Get count of agents in the agents room
     *
     * @returns {number} Number of connected agents
     */
    getAgentsRoomSize() {
        const agentsRoom = this.io.sockets.adapter.rooms.get('agents');
        return agentsRoom ? agentsRoom.size : 0;
    }

    /**
     * Broadcast category configuration changes to settings page
     *
     * @param {Array} categories - Updated categories array
     */
    broadcastCategoryUpdate(categories) {
        this.io.to('settings').emit('categories-updated', { categories });
        console.log('📢 WebSocketService: Broadcast category update to settings room');
    }

    // Smart update functionality removed for simplicity - using direct WebSocket events
}

module.exports = WebSocketService;