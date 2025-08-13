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
                status: 'active',
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
            if (!conversationService.conversationExists(conversationId)) {
                const conversation = {
                    id: conversationId,
                    visitorId: visitorId || uuidv4(),
                    startedAt: new Date(),
                    status: 'active'
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
            
            const conversationMessages = conversationService.getMessages(conversationId);
            
            // Get conversation context for AI
            const conversationContext = this.buildConversationContext(conversationMessages, message);
            
            // Generate AI suggestion with full conversation context and RAG
            const aiSuggestion = await aiService.generateAISuggestion(conversationId, conversationContext, enableRAG !== false);
            
            // First, add the user message atomically
            conversationService.addMessage(conversationId, userMessage);
            
            // Remove any existing pending messages to avoid duplicates
            conversationService.removePendingMessages(conversationId);
            
            // Count customer messages for context (including current message)
            const updatedMessages = conversationService.getMessages(conversationId);
            const customerMessageCount = updatedMessages.filter(msg => msg.sender === 'visitor').length;
            
            // Create new pending message with AI suggestion
            const aiMessage = {
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
                    conversationContext: conversationContext.substring(0, 200) + '...' // Store summary for debugging
                }
            };
            
            // Add AI suggestion message atomically
            conversationService.addMessage(conversationId, aiMessage);
            
            console.log(`Generated AI suggestion for conversation ${conversationId} with ${customerMessageCount} customer messages`);
            
            // Auto-assign to available agent if not assigned
            const conversation = conversationService.getConversation(conversationId);
            if (!conversation.assignedAgent) {
                const availableAgent = conversationService.getAvailableAgent(agentService);
                if (availableAgent) {
                    conversation.assignedAgent = availableAgent.id;
                    conversation.assignedAt = new Date();
                    conversationService.updateConversation(conversationId, conversation);
                    
                    // Add system message about assignment
                    const assignmentMessage = {
                        id: uuidv4(),
                        conversationId,
                        content: `Conversation assigned to agent ${availableAgent.id}`,
                        sender: 'system',
                        timestamp: new Date(),
                        metadata: { assignmentMessage: true }
                    };
                    conversationService.addMessage(conversationId, assignmentMessage);
                }
            }
            
            // Emit new message to agents via WebSocket
            this.io.to('agents').emit('new-message', {
                conversationId,
                message: userMessage,
                aiSuggestion: aiMessage,
                timestamp: new Date()
            });
            
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
            const conversationMessages = conversationService.getMessages(conversationId);
            
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
            const allConversations = conversationService.getAllConversationsWithStats();
            
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
     * Get AI suggestion for a pending message
     */
    async getPendingSuggestion(req, res) {
        try {
            const { conversationId } = req.params;
            
            const conversationMessages = conversationService.getMessages(conversationId);
            
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
            
            const conversation = conversationService.getConversation(conversationId);
            if (conversation) {
                conversation.assignedAgent = agentId;
                conversation.assignedAt = new Date();
                conversationService.updateConversation(conversationId, conversation);
                
                // Add system message about assignment
                conversationService.addMessage(conversationId, {
                    id: uuidv4(),
                    conversationId,
                    content: `Agent has joined the conversation`,
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: { systemMessage: true }
                });
                
                res.json({ success: true, conversation });
            } else {
                res.status(404).json({ error: 'Conversation not found' });
            }
        } catch (error) {
            console.error('Error assigning conversation:', error);
            res.status(500).json({ error: 'Failed to assign conversation' });
        }
    }

    /**
     * End conversation
     */
    async endConversation(req, res) {
        try {
            const { conversationId } = req.params;
            const { agentId } = req.body;
            
            const conversation = conversationService.getConversation(conversationId);
            if (conversation && conversation.assignedAgent === agentId) {
                conversation.status = 'resolved';
                conversation.endedAt = new Date();
                conversationService.updateConversation(conversationId, conversation);
                
                // Add system message
                conversationService.addMessage(conversationId, {
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
    buildConversationContext(conversationMessages, currentMessage) {
        // Get only customer and agent messages (exclude system messages)
        const relevantMessages = conversationMessages.filter(msg => 
            msg.sender === 'visitor' || msg.sender === 'agent'
        );
        
        // Add current message to context
        const allMessages = [
            ...relevantMessages,
            { sender: 'visitor', content: currentMessage, timestamp: new Date() }
        ];
        
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