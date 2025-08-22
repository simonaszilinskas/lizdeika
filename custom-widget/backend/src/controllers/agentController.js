/**
 * AGENT CONTROLLER
 * 
 * Main Purpose: Handle HTTP endpoints for agent management and agent-customer communication
 * 
 * Key Responsibilities:
 * - Agent Status Management: Update and track agent availability (online, busy, offline)
 * - Agent Message Handling: Process and route agent responses to customers
 * - Authorization Control: Ensure agents can only respond to assigned conversations
 * - WebSocket Integration: Emit agent messages to customers via real-time channels
 * - Suggestion Tracking: Track how agents use AI suggestions (as-is, edited, from-scratch)
 * 
 * Dependencies:
 * - Conversation service for message storage and conversation management
 * - Agent service for agent status tracking and assignment logic
 * - Socket.io for real-time message broadcasting
 * - UUID library for unique message identifiers
 * 
 * Features:
 * - Multi-agent support with conversation assignment
 * - Real-time message delivery via WebSocket events
 * - AI suggestion usage analytics and metadata tracking
 * - Conversation authorization and access control
 * - Pending message cleanup when agents respond
 * 
 * Endpoints:
 * - POST /agent/status - Update agent availability status
 * - POST /agent/respond - Send agent response with suggestion metadata
 * - GET /agents/active - List currently active agents
 * 
 * Notes:
 * - Agents must be assigned to conversations before responding
 * - All agent messages include metadata about AI suggestion usage
 * - WebSocket events notify customers of new agent messages immediately
 * - Suggestion actions are tracked for analytics and system improvement
 */
const { v4: uuidv4 } = require('uuid');
const conversationService = require('../services/conversationService');
const agentService = require('../services/agentService');
const { asyncHandler } = require('../utils/errors');

class AgentController {
    constructor(io) {
        this.io = io;
    }

    /**
     * Get current agent status
     */
    async getStatus(req, res) {
        try {
            const allAgents = await agentService.getAllAgents();
            const recentAgents = allAgents.filter(agent => 
                (new Date() - agent.lastSeen) < 60000 // Active in last minute
            );
            
            // Determine the current operational mode
            let currentStatus = 'hitl'; // default
            if (recentAgents.length > 0) {
                // Check for OFF mode first (highest priority)
                const offAgents = recentAgents.filter(agent => agent.status === 'off');
                if (offAgents.length > 0) {
                    currentStatus = 'off';
                } else {
                    // Check for autopilot mode
                    const autopilotAgents = recentAgents.filter(agent => agent.status === 'autopilot');
                    if (autopilotAgents.length > 0) {
                        currentStatus = 'autopilot';
                    }
                    // Otherwise stay in HITL mode
                }
            }
            
            res.json({ 
                success: true, 
                status: currentStatus,
                agentCount: recentAgents.length
            });
        } catch (error) {
            console.error('Error getting agent status:', error);
            res.status(500).json({ error: 'Failed to get agent status' });
        }
    }

    /**
     * Update agent status
     */
    async updateStatus(req, res) {
        try {
            const { agentId, status } = req.body;
            
            await agentService.updateAgentStatus(agentId, status, conversationService);
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error updating agent status:', error);
            res.status(500).json({ error: 'Failed to update agent status' });
        }
    }

    /**
     * Agent send message
     */
    async sendMessage(req, res) {
        try {
            const { conversationId, message, agentId } = req.body;
            
            const conversation = await conversationService.getConversation(conversationId);
            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }
            
            // If conversation is assigned to a different agent, reassign it
            if (conversation.assignedAgent !== agentId) {
                console.log(`Reassigning conversation ${conversationId} from ${conversation.assignedAgent} to ${agentId}`);
                await conversationService.assignConversation(conversationId, agentId);
            }
            
            // Store agent message
            const agentMessage = {
                id: uuidv4(),
                conversationId,
                content: message,
                sender: 'agent',
                timestamp: new Date(),
                agentId
            };
            
            await conversationService.addMessage(conversationId, agentMessage);
            
            res.json({ success: true, message: agentMessage });
            
        } catch (error) {
            console.error('Error sending agent message:', error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    }

    /**
     * Agent sends response (using AI suggestion, edited, or from scratch)
     */
    async sendResponse(req, res) {
        try {
            const { conversationId, message, agentId, usedSuggestion, suggestionAction, autoAssign } = req.body;
            // suggestionAction: 'as-is', 'edited', 'from-scratch'
            // autoAssign: true to automatically assign conversation to responding agent
            
            const conversation = await conversationService.getConversation(conversationId);
            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }
            
            // Auto-assign conversation to responding agent if requested or if already assigned to different agent
            if (autoAssign || (conversation.assignedAgent && conversation.assignedAgent !== agentId)) {
                console.log(`Auto-assigning conversation ${conversationId} to agent ${agentId}`);
                await conversationService.assignConversation(conversationId, agentId);
            } else if (conversation.assignedAgent !== agentId) {
                console.log(`Reassigning conversation ${conversationId} from ${conversation.assignedAgent} to ${agentId}`);
                await conversationService.assignConversation(conversationId, agentId);
            }
            
            // Get agent details for attribution
            const agent = await agentService.getAgent(agentId);
            const agentName = agent ? (agent.name || agentId) : agentId;
            
            // Store agent message with detailed attribution
            const agentMessage = {
                id: uuidv4(),
                conversationId,
                content: message,
                sender: 'agent',
                timestamp: new Date(),
                agentId,
                metadata: {
                    suggestionAction: suggestionAction,
                    usedSuggestion: usedSuggestion,
                    // Response attribution for admin interface
                    responseAttribution: {
                        respondedBy: agentName, // Agent username/display name
                        responseType: suggestionAction || 'custom', // 'as-is', 'edited', 'custom'
                        systemMode: await agentService.getSystemMode(),
                        timestamp: new Date()
                    }
                }
            };
            
            // Remove any pending system messages for this conversation
            await conversationService.removePendingMessages(conversationId);
            
            // Add agent message atomically
            await conversationService.addMessage(conversationId, agentMessage);
            
            // Score agent action in Langfuse for observability (excludes autopilot mode)
            if (suggestionAction && (suggestionAction === 'as-is' || suggestionAction === 'edited' || suggestionAction === 'from-scratch')) {
                try {
                    const LangChainRAG = require('../services/langchainRAG');
                    const langchainRAG = new LangChainRAG();
                    
                    await langchainRAG.scoreAgentAction(
                        conversationId, 
                        suggestionAction,
                        usedSuggestion // Original suggestion for metadata
                    );
                } catch (error) {
                    console.error('Failed to score agent action:', error);
                    // Don't fail the request if scoring fails
                }
            }
            
            // Emit agent message to customer via WebSocket
            this.io.to(conversationId).emit('agent-message', {
                message: agentMessage,
                timestamp: new Date()
            });
            
            console.log(`Agent ${agentId} sent message to conversation ${conversationId}: ${message.substring(0, 50)}...`);
            
            res.json({ success: true, message: agentMessage });
            
        } catch (error) {
            console.error('Error sending agent response:', error);
            res.status(500).json({ error: 'Failed to send response' });
        }
    }

    /**
     * Get active agents
     */
    async getActiveAgents(req, res) {
        try {
            const activeAgents = await agentService.getActiveAgents();
            res.json({ agents: activeAgents });
        } catch (error) {
            console.error('Error getting active agents:', error);
            res.status(500).json({ error: 'Failed to get active agents' });
        }
    }

    /**
     * Update personal agent status (online/afk) with ticket reassignment
     */
    async updatePersonalStatus(req, res) {
        try {
            const { agentId, personalStatus } = req.body;
            
            if (!agentId || !personalStatus) {
                return res.status(400).json({ error: 'Agent ID and personal status are required' });
            }

            if (!['online', 'afk'].includes(personalStatus)) {
                return res.status(400).json({ error: 'Personal status must be online or afk' });
            }

            const previousAgent = await agentService.getAgent(agentId);
            const previousStatus = previousAgent?.personalStatus;
            const updatedAgent = await agentService.updateAgentPersonalStatus(agentId, personalStatus, conversationService);
            
            let reassignments = [];
            
            // Handle status changes with ticket management
            if (personalStatus === 'afk' && previousStatus !== 'afk') {
                // Agent going AFK - reassign their tickets
                reassignments = await agentService.handleAgentAFK(agentId, conversationService);
                console.log(`Agent ${agentId} went AFK, reassigned ${reassignments.length} tickets`);
                
            } else if (personalStatus === 'online' && previousStatus === 'afk') {
                // Agent coming back online - reclaim appropriate tickets
                const reclaims = await agentService.handleAgentBackOnline(agentId, conversationService);
                const redistributions = await agentService.redistributeOrphanedTickets(conversationService, 2);
                reassignments = [...reclaims, ...redistributions];
                console.log(`Agent ${agentId} back online, reclaimed/redistributed ${reassignments.length} tickets`);
            }
            
            // Broadcast updates
            const connectedAgents = await agentService.getConnectedAgents();
            this.io.to('agents').emit('connected-agents-update', { agents: connectedAgents });
            
            // Notify all agents about ticket reassignments
            if (reassignments.length > 0) {
                this.io.to('agents').emit('tickets-reassigned', { 
                    reassignments,
                    reason: personalStatus === 'afk' ? 'agent_afk' : 'agent_online'
                });
            }
            
            res.json({ 
                success: true, 
                agent: updatedAgent,
                reassignments: reassignments.length
            });
        } catch (error) {
            console.error('Error updating personal status:', error);
            res.status(500).json({ error: 'Failed to update personal status' });
        }
    }

    /**
     * Get global system mode
     */
    getSystemMode = asyncHandler(async (req, res) => {
        const mode = await agentService.getSystemMode();
        res.json({ mode });
    })

    /**
     * Set global system mode
     */
    setSystemMode = asyncHandler(async (req, res) => {
        const { mode } = req.body;
        
        if (!mode) {
            return res.status(400).json({ error: 'Mode is required' });
        }

        await agentService.setSystemMode(mode);
        
        // Broadcast system mode update to all agents
        this.io.to('agents').emit('system-mode-update', { mode });
        
        res.json({ success: true, mode });
    })

    /**
     * Get connected agents
     */
    async getConnectedAgents(req, res) {
        try {
            const [connectedAgents, systemMode] = await Promise.all([
                agentService.getConnectedAgents(),
                agentService.getSystemMode()
            ]);
            res.json({ agents: connectedAgents, systemMode });
        } catch (error) {
            console.error('Error getting connected agents:', error);
            res.status(500).json({ error: 'Failed to get connected agents' });
        }
    }

    /**
     * Get all agents (including offline ones) for assignment dropdown
     */
    async getAllAgents(req, res) {
        try {
            const allAgents = await agentService.getAllAgents();
            const connectedAgents = await agentService.getConnectedAgents();
            const connectedAgentIds = new Set(connectedAgents.map(a => a.id));
            
            // Filter out test/temporary agents and only show legitimate agents
            // Keep agents that either:
            // 1. Have meaningful names (not just "Agent User")  
            // 2. Are well-known agent IDs (admin, agent1, agent2, etc.)
            // 3. Have been seen recently (last 24 hours)
            const now = new Date();
            const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
            
            const legitimateAgents = allAgents.filter(agent => {
                // Only include real users - exclude fake agent2/agent3 that were created by mistake
                const validAgentIds = ['admin', 'agent1', 'admin@vilnius.lt', 'agent1@vilnius.lt'];
                return validAgentIds.includes(agent.id);
            });
            
            // Map agents and mark their connection status
            const agentsWithStatus = legitimateAgents.map(agent => ({
                ...agent,
                connected: connectedAgentIds.has(agent.id)
            }));
            
            res.json({ agents: agentsWithStatus });
        } catch (error) {
            console.error('Error getting all agents:', error);
            res.status(500).json({ error: 'Failed to get all agents' });
        }
    }
}

module.exports = AgentController;