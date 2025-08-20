/**
 * CONVERSATION CONTROLLER
 * 
 * Main Purpose: Handle HTTP endpoints for customer conversations and AI interactions
 * 
 * Key Responsibilities:
 * - Conversation Lifecycle: Create, manage, and track customer conversations
 * - Message Processing: Store customer messages and generate AI responses
 * - AI Integration: Generate AI suggestions for agent responses using RAG technology
 * - Agent Assignment: Automatically assign conversations to available agents
 * - Context Management: Build conversation history for AI understanding
 * - WebSocket Broadcasting: Notify agents of new customer messages in real-time
 * 
 * Dependencies:
 * - Conversation service for data persistence and retrieval
 * - AI service for generating intelligent responses and suggestions
 * - Agent service for automatic agent assignment logic
 * - Socket.io for real-time notifications to agent dashboard
 * - UUID library for unique conversation and message identifiers
 * 
 * Features:
 * - RAG-enhanced AI suggestions with document context
 * - Multi-turn conversation context building
 * - Automatic agent assignment based on availability
 * - Pending message system for agent responses
 * - Admin conversation monitoring and statistics
 * - Conversation history retrieval with message filtering
 * 
 * Endpoints:
 * - POST /conversations - Create new conversation
 * - POST /messages - Send customer message and get AI suggestion
 * - GET /conversations/:id/messages - Retrieve conversation history
 * - GET /conversations/:id/pending-suggestion - Get AI suggestion for agent
 * - POST /conversations/:id/assign - Assign conversation to agent
 * - POST /conversations/:id/end - End conversation
 * - GET /admin/conversations - Admin view of all conversations
 * 
 * AI Suggestion System:
 * - Uses full conversation context for better understanding
 * - Integrates with RAG system for document-based responses
 * - Tracks conversation complexity with message counting
 * - Provides confidence scores and metadata for agent decision-making
 * 
 * Notes:
 * - Conversations auto-create if they don't exist when messages are sent
 * - AI suggestions include metadata about customer message count and context
 * - System messages track conversation state changes and agent assignments
 * - WebSocket events ensure real-time updates to agent dashboards
 */
const { v4: uuidv4 } = require('uuid');
const conversationService = require('../services/conversationService');
const aiService = require('../services/aiService');
const agentService = require('../services/agentService');

class ConversationController {
    constructor(io) {
        this.io = io;
    }

    /**
     * Create new conversation
     */
    async createConversation(req, res) {
        try {
            const conversationId = uuidv4();
            const conversation = {
                id: conversationId,
                visitorId: req.body.visitorId || uuidv4(),
                startedAt: new Date(),
                metadata: req.body.metadata || {}
            };
            
            await conversationService.createConversation(conversationId, conversation);
            
            res.json({ conversationId, conversation });
        } catch (error) {
            console.error('Error creating conversation:', error);
            res.status(500).json({ error: 'Failed to create conversation' });
        }
    }

    /**
     * Send message and get AI response
     */
    async sendMessage(req, res) {
        const { conversationId, message, visitorId, requestHuman, enableRAG } = req.body;
        
        try {
            // Create conversation if doesn't exist
            if (!(await conversationService.conversationExists(conversationId))) {
                const conversation = {
                    id: conversationId,
                    visitorId: visitorId || uuidv4(),
                    startedAt: new Date(),
                };
                await conversationService.createConversation(conversationId, conversation);
            }
            
            // Store user message
            const userMessage = {
                id: uuidv4(),
                conversationId,
                content: message,
                sender: 'visitor',
                timestamp: new Date()
            };
            
            // First, add the user message atomically
            await await conversationService.addMessage(conversationId, userMessage);
            
            // Get global system mode from agent service
            const currentMode = agentService ? await agentService.getSystemMode() : 'hitl';
            
            console.log(`Processing message in mode: ${currentMode}`);
            
            // Get conversation context for AI (don't pass currentMessage since it's already added)
            const conversationMessages = await await conversationService.getMessages(conversationId);
            const conversationContext = this.buildConversationContext(conversationMessages);
            
            // Generate AI response/suggestion based on mode
            const aiSuggestion = await aiService.generateAISuggestion(conversationId, conversationContext, enableRAG !== false);
            
            // Count customer messages for context (including current message)
            const updatedMessages = await conversationService.getMessages(conversationId);
            const customerMessageCount = updatedMessages.filter(msg => msg.sender === 'visitor').length;
            
            let aiMessage;
            
            if (currentMode === 'autopilot') {
                // AUTOPILOT MODE: Send AI response directly, NO agent assignment
                aiMessage = {
                    id: uuidv4(),
                    conversationId,
                    content: aiSuggestion,
                    sender: 'agent',
                    timestamp: new Date(),
                    metadata: { 
                        isAutopilotResponse: true,
                        displayDisclaimer: true,
                        originalSuggestion: aiSuggestion,
                        messageCount: customerMessageCount
                    }
                };
                
                await conversationService.addMessage(conversationId, aiMessage);
                console.log(`Sent autopilot AI response for conversation ${conversationId}`);
                
            } else if (currentMode === 'off') {
                // Check if we already sent an offline message to this conversation
                const existingMessages = await conversationService.getMessages(conversationId);
                const hasOfflineMessage = existingMessages.some(msg => 
                    msg.metadata && msg.metadata.messageType === 'offline_notification'
                );
                
                if (hasOfflineMessage) {
                    // Already sent offline message, don't send again - just keep the AI suggestion
                    console.log(`Skipping duplicate offline message for conversation ${conversationId}`);
                } else {
                    // First time - send offline message
                    const offlineMessage = {
                        id: uuidv4(),
                        conversationId,
                        content: 'Labas! Šiuo metu klientų aptarnavimo specialistai neprieinami.\n\nMes grįšime ir jums atsakysime darbo valandomis. Prašome:\n• Neuždarykite šio lango - mes su jumis susisieksime\n• Arba palikite savo el. paštą ar telefono numerį žemiau, ir mes su jumis susisieksime\n\nAčiū už kantrybę! 🙏',
                        sender: 'agent',
                        timestamp: new Date(),
                        metadata: { 
                            isSystemMessage: true,
                            messageType: 'offline_notification'
                        }
                    };
                    
                    // Replace the AI suggestion with offline message
                    conversationService.replaceLastMessage(conversationId, offlineMessage);
                    aiMessage = offlineMessage;
                    
                    console.log(`Sent offline message to conversation ${conversationId}`);
                }
                
            } else {
                // HITL MODE: Create AI suggestion for agent review (no automatic assignment)
                // Remove any existing pending messages to avoid duplicates
                conversationService.removePendingMessages(conversationId);
                
                // No automatic assignment - agents must manually assign themselves
                
                aiMessage = {
                    id: uuidv4(),
                    conversationId,
                    content: '[Message pending agent response - AI suggestion available]',
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: { 
                        pendingAgent: true,
                        aiSuggestion: aiSuggestion,
                        confidence: 0.85,
                        customerMessage: message,
                        messageCount: customerMessageCount,
                        conversationContext: conversationContext.substring(0, 200) + '...'
                    }
                };
                
                await conversationService.addMessage(conversationId, aiMessage);
                console.log(`Generated AI suggestion for conversation ${conversationId} (HITL mode)`);
            }
            
            // Emit new message to agents via WebSocket (only for HITL mode)
            if (currentMode === 'hitl') {
                this.io.to('agents').emit('new-message', {
                    conversationId,
                    message: userMessage,
                    aiSuggestion: aiMessage,
                    timestamp: new Date()
                });
            }
            // In autopilot and off modes, agents don't need to see these messages
            
            res.json({
                userMessage,
                aiMessage,
                conversationId
            });
            
        } catch (error) {
            console.error('Error processing message:', error);
            res.status(500).json({
                error: 'Failed to process message',
                details: error.message
            });
        }
    }

    /**
     * Get conversation history
     */
    async getMessages(req, res) {
        try {
            const { conversationId } = req.params;
            const conversationMessages = await conversationService.getMessages(conversationId);
            
            res.json({
                conversationId,
                messages: conversationMessages
            });
        } catch (error) {
            console.error('Error getting messages:', error);
            res.status(500).json({ error: 'Failed to get messages' });
        }
    }

    /**
     * Admin endpoint to view all conversations
     */
    async getAllConversations(req, res) {
        try {
            const allConversations = await conversationService.getAllConversationsWithStats();
            
            res.json({
                conversations: allConversations,
                total: allConversations.length
            });
        } catch (error) {
            console.error('Error getting all conversations:', error);
            res.status(500).json({ error: 'Failed to get conversations' });
        }
    }

    /**
     * Get debug information for AI suggestion generation
     */
    async getDebugInfo(req, res) {
        try {
            const { conversationId } = req.params;
            
            const conversationMessages = await conversationService.getMessages(conversationId);
            
            // Find the most recent message with debug metadata
            const debugMessage = conversationMessages
                .filter(msg => msg.metadata && msg.metadata.debugInfo)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

            if (debugMessage) {
                res.json(debugMessage.metadata.debugInfo);
            } else {
                res.status(404).json({ error: 'No debug information available' });
            }
        } catch (error) {
            console.error('Error getting debug info:', error);
            res.status(500).json({ error: 'Failed to get debug information' });
        }
    }

    /**
     * Get AI suggestion for a pending message
     */
    async getPendingSuggestion(req, res) {
        try {
            const { conversationId } = req.params;
            
            const conversationMessages = await conversationService.getMessages(conversationId);
            
            // Find the most recent message with AI suggestion
            const pendingMessages = conversationMessages
                .filter(msg => msg.metadata && msg.metadata.pendingAgent && msg.metadata.aiSuggestion);
            
            const pendingMessage = pendingMessages.length > 0 
                ? pendingMessages.reduce((latest, current) => {
                    const latestTime = latest.metadata.lastUpdated || latest.timestamp;
                    const currentTime = current.metadata.lastUpdated || current.timestamp;
                    return new Date(currentTime) > new Date(latestTime) ? current : latest;
                })
                : null;
            
            if (pendingMessage) {
                res.json({
                    suggestion: pendingMessage.metadata.aiSuggestion,
                    confidence: pendingMessage.metadata.confidence || 0.8,
                    messageId: pendingMessage.id,
                    timestamp: pendingMessage.timestamp,
                    metadata: {
                        messageCount: pendingMessage.metadata.messageCount || 1,
                        customerMessages: pendingMessage.metadata.customerMessages
                    }
                });
            } else {
                res.status(404).json({ error: 'No pending suggestion found' });
            }
        } catch (error) {
            console.error('Error getting pending suggestion:', error);
            res.status(500).json({ error: 'Failed to get pending suggestion' });
        }
    }

    /**
     * Assign conversation to agent
     */
    async assignConversation(req, res) {
        try {
            const { conversationId } = req.params;
            const { agentId } = req.body;
            
            // Check if system is in autopilot or off mode - prevent assignment
            const currentMode = agentService ? await agentService.getSystemMode() : 'hitl';
            if (currentMode === 'autopilot') {
                return res.status(403).json({ 
                    error: 'Cannot assign conversations in autopilot mode',
                    mode: currentMode
                });
            }
            if (currentMode === 'off') {
                return res.status(403).json({ 
                    error: 'Cannot assign conversations when system is offline',
                    mode: currentMode
                });
            }
            
            const conversation = await conversationService.getConversation(conversationId);
            if (conversation) {
                // Use the proper assignConversation method which handles agent ID to user ID conversion
                await conversationService.assignConversation(conversationId, agentId);
                
                // Add system message about assignment
                await conversationService.addMessage(conversationId, {
                    id: uuidv4(),
                    conversationId,
                    content: `Agent has joined the conversation`,
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: { systemMessage: true }
                });
                
                // Get updated conversation for response
                const updatedConversation = await conversationService.getConversation(conversationId);
                res.json({ success: true, conversation: updatedConversation });
            } else {
                res.status(404).json({ error: 'Conversation not found' });
            }
        } catch (error) {
            console.error('Error assigning conversation:', error);
            res.status(500).json({ error: 'Failed to assign conversation' });
        }
    }

    /**
     * Unassign conversation from agent
     */
    async unassignConversation(req, res) {
        try {
            const { conversationId } = req.params;
            const { agentId } = req.body;
            
            const conversation = await conversationService.getConversation(conversationId);
            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }
            
            // Check if agent is authorized to unassign (must be assigned to them)
            if (conversation.assignedAgent !== agentId) {
                return res.status(403).json({ error: 'Not authorized - conversation not assigned to you' });
            }
            
            // Unassign the conversation
            conversation.assignedAgent = null;
            conversation.assignedAt = null;
            await conversationService.updateConversation(conversationId, conversation);
            
            // Add system message about unassignment
            await conversationService.addMessage(conversationId, {
                id: uuidv4(),
                conversationId,
                content: `Agent has left the conversation`,
                sender: 'system',
                timestamp: new Date(),
                metadata: { systemMessage: true }
            });
            
            res.json({ success: true, conversation });
        } catch (error) {
            console.error('Error unassigning conversation:', error);
            res.status(500).json({ error: 'Failed to unassign conversation' });
        }
    }

    /**
     * End conversation
     */
    async endConversation(req, res) {
        try {
            const { conversationId } = req.params;
            const { agentId } = req.body;
            
            const conversation = await conversationService.getConversation(conversationId);
            if (conversation && conversation.assignedAgent === agentId) {
                conversation.endedAt = new Date();
                await conversationService.updateConversation(conversationId, conversation);
                
                // Add system message
                await conversationService.addMessage(conversationId, {
                    id: uuidv4(),
                    conversationId,
                    content: `Conversation ended by agent`,
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: { systemMessage: true }
                });
                
                res.json({ success: true });
            } else {
                res.status(403).json({ error: 'Not authorized' });
            }
        } catch (error) {
            console.error('Error ending conversation:', error);
            res.status(500).json({ error: 'Failed to end conversation' });
        }
    }



    /**
     * Build conversation context for AI from message history
     */
    buildConversationContext(conversationMessages) {
        // Get only customer and agent messages (exclude system messages)
        const allMessages = conversationMessages.filter(msg => 
            msg.sender === 'visitor' || msg.sender === 'agent'
        );
        
        // Format messages as conversation
        const conversationHistory = allMessages
            .map(msg => {
                const sender = msg.sender === 'visitor' ? 'Customer' : 'Agent';
                return `${sender}: ${msg.content}`;
            })
            .join('\\n\\n');
        
        // If conversation is getting long, include only recent messages
        if (conversationHistory.length > 2000) {
            const recentMessages = allMessages.slice(-5); // Last 5 messages
            return recentMessages
                .map(msg => {
                    const sender = msg.sender === 'visitor' ? 'Customer' : 'Agent';
                    return `${sender}: ${msg.content}`;
                })
                .join('\\n\\n');
        }
        
        return conversationHistory;
    }
}

module.exports = ConversationController;