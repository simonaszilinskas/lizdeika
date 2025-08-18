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

class AgentController {
    constructor(io) {
        this.io = io;
    }

    /**
     * Get current agent status
     */
    async getStatus(req, res) {
        try {
            const allAgents = agentService.getAllAgents();
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
            
            const conversation = conversationService.getConversation(conversationId);
            if (!conversation || conversation.assignedAgent !== agentId) {
                return res.status(403).json({ error: 'Not authorized for this conversation' });
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
            
            conversationService.addMessage(conversationId, agentMessage);
            
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
            const { conversationId, message, agentId, usedSuggestion, suggestionAction } = req.body;
            // suggestionAction: 'as-is', 'edited', 'from-scratch'
            
            const conversation = conversationService.getConversation(conversationId);
            if (!conversation || conversation.assignedAgent !== agentId) {
                return res.status(403).json({ error: 'Not authorized for this conversation' });
            }
            
            // Store agent message
            const agentMessage = {
                id: uuidv4(),
                conversationId,
                content: message,
                sender: 'agent',
                timestamp: new Date(),
                agentId,
                metadata: {
                    suggestionAction: suggestionAction,
                    usedSuggestion: usedSuggestion
                }
            };
            
            // Remove any pending system messages for this conversation
            conversationService.removePendingMessages(conversationId);
            
            // Add agent message atomically
            conversationService.addMessage(conversationId, agentMessage);
            
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
            const activeAgents = agentService.getActiveAgents();
            res.json({ agents: activeAgents });
        } catch (error) {
            console.error('Error getting active agents:', error);
            res.status(500).json({ error: 'Failed to get active agents' });
        }
    }
}

module.exports = AgentController;