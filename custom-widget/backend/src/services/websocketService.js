/**
 * WebSocket Service
 * Handles WebSocket connections and events
 */
const agentService = require('./agentService');
const conversationService = require('./conversationService');
const afkDetectionService = require('./afkDetectionService');

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
            socket.on('join-agent-dashboard', async (agentId) => {
                socket.join('agents');
                socket.agentId = agentId;
                
                // Update agent status to online
                await agentService.setAgentOnline(agentId, socket.id);
                
                // Record activity for AFK detection
                await afkDetectionService.recordActivity(agentId);
                
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
                
                // Record activity for AFK detection
                if (socket.agentId) {
                    await afkDetectionService.recordActivity(socket.agentId);
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
            
            // Smart polling subscription - agents can subscribe to specific updates
            socket.on('subscribe-smart-updates', (subscriptions) => {
                console.log(`Socket ${socket.id} subscribed to smart updates:`, subscriptions);
                
                // Join specific rooms based on subscriptions
                if (subscriptions.includes('agent-status')) {
                    socket.join('agent-status-updates');
                }
                if (subscriptions.includes('conversation-updates')) {
                    socket.join('conversation-updates');
                }
                if (subscriptions.includes('system-mode')) {
                    socket.join('system-mode-updates');
                }
            });
            
            // Client requesting current state (instead of polling)
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
                    
                    // Also emit to smart update subscribers
                    this.io.to('agent-status-updates').emit('smart-update', {
                        type: 'agent-status',
                        data: connectedAgents,
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

    /**
     * Emit smart update to subscribed clients
     * This reduces the need for polling by pushing updates when they actually happen
     */
    emitSmartUpdate(updateType, data) {
        const timestamp = new Date();
        const update = { type: updateType, data, timestamp };
        
        console.log(`📡 Smart update: ${updateType}`);
        
        switch (updateType) {
            case 'agent-status':
                this.io.to('agent-status-updates').emit('smart-update', update);
                break;
            case 'conversation-updates':
                this.io.to('conversation-updates').emit('smart-update', update);
                break;
            case 'system-mode':
                this.io.to('system-mode-updates').emit('smart-update', update);
                break;
            default:
                console.log(`Unknown smart update type: ${updateType}`);
        }
    }

    /**
     * Enhanced agent status update with smart polling integration
     */
    emitAgentStatusUpdateSmart(agentId, status, connectedAgents = null) {
        // Emit the traditional event
        this.emitAgentStatusUpdate(agentId, status);
        
        // Also emit smart update if we have connected agents data
        if (connectedAgents) {
            this.emitSmartUpdate('agent-status', connectedAgents);
        }
    }

    /**
     * Get smart update subscribers count
     */
    getSmartUpdateStats() {
        const rooms = ['agent-status-updates', 'conversation-updates', 'system-mode-updates'];
        const stats = {};
        
        rooms.forEach(room => {
            const roomObj = this.io.sockets.adapter.rooms.get(room);
            stats[room] = roomObj ? roomObj.size : 0;
        });
        
        return {
            totalSubscribers: Object.values(stats).reduce((a, b) => a + b, 0),
            byType: stats
        };
    }
}

module.exports = WebSocketService;