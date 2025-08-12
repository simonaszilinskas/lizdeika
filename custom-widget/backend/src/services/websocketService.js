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
            
            // Join conversation room
            socket.on('join-conversation', (conversationId) => {
                socket.join(conversationId);
                console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
            });
            
            // Join agent dashboard
            socket.on('join-agent-dashboard', (agentId) => {
                socket.join('agents');
                socket.agentId = agentId;
                
                // Update agent status to online
                agentService.setAgentOnline(agentId, socket.id, conversationService);
                
                console.log(`Agent ${agentId} connected with socket ${socket.id}`);
                
                // Broadcast agent status to all agents
                this.io.to('agents').emit('agent-status-update', {
                    agentId,
                    status: 'online',
                    timestamp: new Date()
                });
            });
            
            // Handle agent typing
            socket.on('agent-typing', (data) => {
                const { conversationId, isTyping } = data;
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
            
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
                
                // Update agent status if this was an agent
                if (socket.agentId) {
                    agentService.setAgentOffline(socket.agentId);
                    
                    // Broadcast agent status to all agents
                    this.io.to('agents').emit('agent-status-update', {
                        agentId: socket.agentId,
                        status: 'offline',
                        timestamp: new Date()
                    });
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
}

module.exports = WebSocketService;