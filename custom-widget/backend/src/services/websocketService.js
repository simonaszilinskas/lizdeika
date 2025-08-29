/**
 * WebSocket Service
 * Handles WebSocket connections and events
 */
const agentService = require('./agentService');
const conversationService = require('./conversationService');

class WebSocketService {
    constructor(io) {
        this.io = io;
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            
            // Debug: log all events from this socket
            const originalOn = socket.on.bind(socket);
            socket.on = function(event, handler) {
                console.log(`🐛 Socket ${socket.id} registered listener for: ${event}`);
                return originalOn(event, handler);
            };
            
            // Join conversation room
            socket.on('join-conversation', (conversationId) => {
                socket.join(conversationId);
                console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
            });
            
            // Join agent dashboard
            socket.on('join-agent-dashboard', async (agentId) => {
                socket.join('agents');
                socket.agentId = agentId;
                
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
                
                // Update agent status if this was an agent
                if (socket.agentId) {
                    await agentService.setAgentOffline(socket.agentId);
                    
                    // Broadcast updated connected agents list
                    const connectedAgents = await agentService.getConnectedAgents();
                    this.io.to('agents').emit('connected-agents-update', { agents: connectedAgents });
                }
            });
            
            // Handle heartbeat to keep agent status updated
            socket.on('heartbeat', async (data) => {
                if (socket.agentId) {
                    try {
                        // Update agent status timestamp to keep them "online"
                        await agentService.updateAgentActivity(socket.agentId);
                        
                        // Send heartbeat acknowledgment
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
     * Emit new message to agents
     */
    emitNewMessage(messageData) {
        this.io.to('agents').emit('new-message', messageData);
    }

    /**
     * Emit agent message to customer
     */
    emitAgentMessage(conversationId, messageData) {
        this.io.to(conversationId).emit('agent-message', messageData);
    }

    /**
     * Emit agent status update
     */
    emitAgentStatusUpdate(agentId, status) {
        this.io.to('agents').emit('agent-status-update', {
            agentId,
            status,
            timestamp: new Date()
        });
    }

    /**
     * Emit typing status
     */
    emitTypingStatus(target, data) {
        if (target === 'agents') {
            this.io.to('agents').emit('customer-typing-status', data);
        } else {
            this.io.to(target).emit('agent-typing-status', data);
        }
    }

    /**
     * Get connected clients count
     */
    getConnectedClientsCount() {
        return this.io.engine.clientsCount;
    }

    /**
     * Get agents room size
     */
    getAgentsRoomSize() {
        const agentsRoom = this.io.sockets.adapter.rooms.get('agents');
        return agentsRoom ? agentsRoom.size : 0;
    }

    // Smart update functionality removed for simplicity - using direct WebSocket events
}

module.exports = WebSocketService;