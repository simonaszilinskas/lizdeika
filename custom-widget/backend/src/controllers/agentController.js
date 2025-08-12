/**
 * Agent Controller
 * Handles agent-related endpoints
 */
const { v4: uuidv4 } = require('uuid');
const conversationService = require('../services/conversationService');
const agentService = require('../services/agentService');

class AgentController {
    constructor(io) {
        this.io = io;
    }

    /**
     * Update agent status
     */
    async updateStatus(req, res) {
        try {
            const { agentId, status } = req.body;
            
            await agentService.updateAgentStatus(agentId, status);
            
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
            
            const conversationMessages = conversationService.getMessages(conversationId);
            conversationMessages.push(agentMessage);
            conversationService.setMessages(conversationId, conversationMessages);
            
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
            
            const conversationMessages = conversationService.getMessages(conversationId);
            
            // Remove any pending system messages for this conversation
            const filteredMessages = conversationMessages.filter(msg => 
                !(msg.sender === 'system' && msg.metadata && msg.metadata.pendingAgent)
            );
            
            filteredMessages.push(agentMessage);
            conversationService.setMessages(conversationId, filteredMessages);
            
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