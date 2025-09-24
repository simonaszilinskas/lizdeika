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
const { 
    ValidationError, 
    validateRequired, 
    validateString, 
    validateUUID, 
    validateConversationId,
    validateObject, 
    validateMessage 
} = require('../utils/validation');
const { handleControllerError } = require('../utils/errorHandler');
const conversationService = require('../services/conversationService');
const aiService = require('../services/aiService');
const agentService = require('../services/agentService');
const activityService = require('../services/activityService');

class ConversationController {
    constructor(io) {
        this.io = io;
    }

    /**
     * Create new conversation
     */
    async createConversation(req, res) {
        try {
            // Input validation
            // Skip validation for visitorId - widget uses visitor-xxx format, not UUID
            
            if (req.body.metadata !== undefined) {
                validateObject(req.body.metadata, 'metadata', { allowNull: true });
            }
            
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
            return handleControllerError(error, 'Failed to create conversation', req, res);
        }
    }

    /**
     * Send message and get AI response
     */
    async sendMessage(req, res) {
        try {
            // Input validation
            validateRequired(req.body, ['conversationId', 'message']);
            validateConversationId(req.body.conversationId, 'conversationId');
            const validatedMessage = validateMessage(req.body.message);
            
            // Skip validation for visitorId - widget uses visitor-xxx format, not UUID
            
            const { conversationId, visitorId, requestHuman, enableRAG } = req.body;
            const message = validatedMessage;
            // Create conversation if doesn't exist
            if (!(await conversationService.conversationExists(conversationId))) {
                const conversation = {
                    id: conversationId,
                    visitorId: visitorId || uuidv4(),
                    startedAt: new Date(),
                };
                await conversationService.createConversation(conversationId, conversation);
                
                // Auto-assign to available agent if in HITL mode
                const currentMode = await agentService.getSystemMode();
                if (currentMode === 'hitl') {
                    try {
                        const availableAgent = await agentService.getBestAvailableAgent();
                        if (availableAgent) {
                            await conversationService.assignConversation(conversationId, availableAgent.id);
                            console.log(`🎯 Auto-assigned new conversation ${conversationId} to agent ${availableAgent.id}`);
                            conversation.assignedAgent = availableAgent.id;
                        } else {
                            console.log(`⚠️ No agents available for new conversation ${conversationId}`);
                        }
                    } catch (error) {
                        console.error('Failed to auto-assign new conversation:', error);
                        // Continue without assignment - conversation will be unassigned
                    }
                }
                
                // Emit new conversation event to agents
                console.log('🆕 New conversation created, notifying agents:', conversationId);
                this.io.to('agents').emit('new-conversation', {
                    conversationId,
                    conversation,
                    timestamp: new Date()
                });
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
            await conversationService.addMessage(conversationId, userMessage);
            
            // Get global system mode from agent service
            const currentMode = agentService ? await agentService.getSystemMode() : 'hitl';
            
            // IMPORTANT: Clear any existing pending suggestions ONLY in HITL mode
            // This prevents confusion when customers send multiple messages quickly in HITL mode
            if (currentMode === 'hitl') {
                await conversationService.removePendingMessages(conversationId);
                console.log(`🧹 Cleared old pending suggestions for conversation ${conversationId} (HITL mode)`);
            }
            
            console.log(`Processing message in mode: ${currentMode}`);
            
            // IMMEDIATE: Emit new message to agents via WebSocket (before AI processing)
            console.log('🔥 DEBUG: Current mode:', currentMode, 'checking if === hitl');
            if (currentMode === 'hitl') {
                console.log('🔥 DEBUG: Entering HITL WebSocket emission block');
                // Get current conversation details for proper assignment info
                const conversation = await conversationService.getConversation(conversationId);
                
                // Calculate unseen status: message is unseen if conversation has an assigned agent
                // (for unassigned conversations, unseen status is handled by assignment logic)
                const unseenByAgent = !!conversation?.assignedAgent;
                
                // SIMPLIFIED: Standard WebSocket event structure
                console.log('🔥 DEBUG: About to emit new-message WebSocket event to agents room');
                const agentsRoom = this.io.sockets.adapter.rooms.get('agents');
                const socketsInRoom = agentsRoom ? agentsRoom.size : 0;
                console.log('🔥 DEBUG: Agents room has', socketsInRoom, 'connected sockets');

                this.io.to('agents').emit('new-message', {
                    type: 'new-message',
                    conversationId,
                    message: {
                        id: userMessage.id,
                        content: userMessage.content,
                        sender: userMessage.sender,
                        timestamp: userMessage.timestamp
                    },
                    conversation: {
                        id: conversationId,
                        assignedAgent: conversation?.assignedAgent || null,
                        lastMessageTimestamp: userMessage.timestamp,
                        unseenByAgent: unseenByAgent
                    }
                });
                console.log(`📨 New message emitted to agents for conversation ${conversationId}, assigned to: ${conversation?.assignedAgent || 'unassigned'}, unseenByAgent: ${unseenByAgent}`);
            }
            
            // Get conversation context for AI (don't pass currentMessage since it's already added)
            const conversationMessages = await conversationService.getMessages(conversationId);
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
                        messageCount: customerMessageCount,
                        // Response attribution for admin interface
                        responseAttribution: {
                            respondedBy: 'Autopilot',
                            responseType: 'autopilot',
                            systemMode: 'autopilot',
                            timestamp: new Date()
                        }
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
                // HITL MODE: Create AI suggestion for agent review with auto-assignment to online agents
                
                // Get current conversation assignment status
                const conversation = await conversationService.getConversation(conversationId);
                let assignedAgent = conversation ? conversation.assignedAgent : null;
                
                // Auto-assign unassigned conversations to available agents
                if (!assignedAgent) {
                    try {
                        const availableAgent = await agentService.getBestAvailableAgent();
                        if (availableAgent) {
                            await conversationService.assignConversation(conversationId, availableAgent.id);
                            assignedAgent = availableAgent.id;
                            console.log(`🎯 Auto-assigned existing conversation ${conversationId} to agent ${availableAgent.id}`);
                        } else {
                            console.log(`⚠️ No online agents available for conversation ${conversationId}, marking as unseen`);
                        }
                    } catch (error) {
                        console.error('Failed to auto-assign existing conversation:', error);
                    }
                }
                
                let shouldMarkAsUnseen = !assignedAgent;
                
                aiMessage = {
                    id: uuidv4(),
                    conversationId,
                    content: shouldMarkAsUnseen ? 
                        '[No agents online - Message awaiting assignment]' : 
                        '[Message pending agent response - AI suggestion available]',
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: { 
                        pendingAgent: true,
                        aiSuggestion: aiSuggestion,
                        confidence: 0.85,
                        customerMessage: message,
                        messageCount: customerMessageCount,
                        conversationContext: conversationContext.substring(0, 200) + '...',
                        assignedAgent: assignedAgent,
                        unseenByAgents: shouldMarkAsUnseen,
                        needsManualAssignment: shouldMarkAsUnseen
                    }
                };
                
                // Pending messages already cleared when customer message arrived
                await conversationService.addMessage(conversationId, aiMessage);
                console.log(`Generated AI suggestion for conversation ${conversationId} (HITL mode)`);
            }
            
            // Note: Customer message already emitted immediately above
            // Now we could optionally emit AI suggestion completion event here
            console.log(`🔥 DEBUG: AI processing completed for conversation ${conversationId}`);
            
            res.json({
                userMessage,
                aiMessage,
                conversationId
            });
            
        } catch (error) {
            return handleControllerError(error, 'Failed to process message', req, res);
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
     * Get AI suggestion for a pending message
     */
    async getPendingSuggestion(req, res) {
        try {
            // Input validation
            validateConversationId(req.params.conversationId, 'conversationId');
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
            return handleControllerError(error, 'Failed to get pending suggestion', req, res);
        }
    }

    /**
     * Generate new AI suggestion for conversation (agent-initiated)
     */
    async generateAISuggestion(req, res) {
        try {
            // Input validation
            validateConversationId(req.params.conversationId, 'conversationId');
            const { conversationId } = req.params;

            // Get conversation messages for context
            const conversationMessages = await conversationService.getMessages(conversationId);
            if (!conversationMessages || conversationMessages.length === 0) {
                return res.status(404).json({ error: 'Conversation not found or has no messages' });
            }

            // Build conversation context (same as in sendMessage)
            const conversationContext = this.buildConversationContext(conversationMessages);

            if (!conversationContext || conversationContext.trim().length === 0) {
                return res.status(400).json({ error: 'No conversation context available for AI suggestion' });
            }

            // Generate AI suggestion using the same service as in sendMessage
            const aiSuggestion = await aiService.generateAISuggestion(conversationId, conversationContext, true);
            console.log('🔍 DEBUG: aiSuggestion received:', JSON.stringify(aiSuggestion, null, 2));

            try {
                const { suggestionText, confidence } = this._processAIServiceResponse(aiSuggestion);

                // Clear any existing pending suggestions for this conversation
                await conversationService.clearPendingSuggestions(conversationId);
                console.log(`🧹 Cleared old pending suggestions for conversation ${conversationId} (manual generation)`);

                // Create new pending message with AI suggestion
                const messageId = uuidv4();
                const agentMessage = {
                    id: messageId,
                    conversationId: conversationId,
                    content: '[Manual AI suggestion generated]',
                    sender: 'system',
                    timestamp: new Date().toISOString(),
                    metadata: {
                        pendingAgent: true,
                        aiSuggestion: suggestionText,
                        confidence: confidence,
                        lastUpdated: new Date().toISOString(),
                        messageCount: conversationMessages.length,
                        customerMessages: conversationMessages.filter(msg =>
                            msg.sender === 'visitor' || msg.sender === 'customer'
                        ).length,
                        manualGeneration: true,
                        debugInfo: (typeof aiSuggestion === 'object' ? aiSuggestion.debugInfo : {}) || {}
                    }
                };

                await conversationService.addMessage(conversationId, agentMessage);
                console.log(`Generated manual AI suggestion for conversation ${conversationId}`);

                // Return the suggestion immediately with comprehensive debug information
                res.json({
                    suggestion: suggestionText,
                    confidence: confidence,
                    messageId: messageId,
                    timestamp: agentMessage.timestamp,
                    metadata: {
                        messageCount: agentMessage.metadata.messageCount,
                        customerMessages: agentMessage.metadata.customerMessages,
                        manualGeneration: true,
                        // Enhanced metadata from aiService
                        provider: aiSuggestion?.metadata?.provider || 'unknown',
                        ragUsed: aiSuggestion?.metadata?.ragUsed || false,
                        fallbackUsed: aiSuggestion?.metadata?.fallbackUsed || false,
                        sourcesUsed: aiSuggestion?.metadata?.sourcesUsed || 0,
                        contextsUsed: aiSuggestion?.metadata?.contextsUsed || 0,
                        contextLength: aiSuggestion?.metadata?.contextLength || 0,
                        processingSteps: aiSuggestion?.metadata?.processingSteps || 0,
                        // Comprehensive debug information for browser console
                        debugInfo: aiSuggestion?.debugInfo || {}
                    }
                });

            } catch (error) {
                console.error('❌ AI suggestion processing failed:', error.message);
                return res.status(500).json({ error: error.message });
            }

        } catch (error) {
            return handleControllerError(error, 'Failed to generate AI suggestion', req, res);
        }
    }

    /**
     * Assign conversation to agent
     */
    async assignConversation(req, res) {
        try {
            // Input validation
            validateConversationId(req.params.conversationId, 'conversationId');
            validateRequired(req.body, ['agentId']);
            validateString(req.body.agentId, 'agentId', { minLength: 1 });
            
            const { conversationId } = req.params;
            const { agentId } = req.body;
            
            // Allow manual assignment in all system modes (HITL, autopilot, off)
            // Agents can always assign conversations to themselves regardless of system mode
            
            const conversation = await conversationService.getConversation(conversationId);
            if (conversation) {
                // Use the proper assignConversation method which handles agent ID to user ID conversion
                await conversationService.assignConversation(conversationId, agentId);
                
                // No system message needed for assignment
                
                // Get updated conversation for response
                const updatedConversation = await conversationService.getConversation(conversationId);
                res.json({ success: true, conversation: updatedConversation });
            } else {
                res.status(404).json({ error: 'Conversation not found' });
            }
        } catch (error) {
            return handleControllerError(error, 'Failed to assign conversation', req, res);
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
            
            // Allow any agent to unassign any conversation (same as assignment policy)
            
            // Unassign the conversation
            conversation.assignedAgent = null;
            conversation.assignedAt = null;
            await conversationService.updateConversation(conversationId, conversation);
            
            // No system message needed for unassignment
            
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
                
                // No system message needed for conversation end
                
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
     * Mark messages as seen by agent
     */
    async markMessagesAsSeen(req, res) {
        try {
            const { conversationId } = req.params;
            const { agentId } = req.body;

            console.log(`📖 Marking messages as seen for conversation ${conversationId} by agent ${agentId}`);

            // Update the conversation's last seen timestamp for this agent
            await conversationService.markConversationAsSeenByAgent(conversationId, agentId);

            // Emit WebSocket event to update real-time UI
            if (this.io) {
                this.io.to('agents').emit('conversation-seen-update', {
                    conversationId,
                    agentId,
                    seenAt: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                message: 'Messages marked as seen'
            });

        } catch (error) {
            console.error('Error marking messages as seen:', error);
            res.status(500).json({ error: 'Failed to mark messages as seen' });
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
            .join('\n\n');
        
        // If conversation is getting long, include only recent messages
        if (conversationHistory.length > 2000) {
            const recentMessages = allMessages.slice(-5); // Last 5 messages
            return recentMessages
                .map(msg => {
                    const sender = msg.sender === 'visitor' ? 'Customer' : 'Agent';
                    return `${sender}: ${msg.content}`;
                })
                .join('\n\n');
        }
        
        return conversationHistory;
    }

    /**
     * Process AI service response - handles both string and object formats
     * @param {string|Object} aiSuggestion - Raw AI service response
     * @returns {Object} { suggestionText: string, confidence: number }
     * @throws {Error} If response format is invalid or empty
     */
    _processAIServiceResponse(aiSuggestion) {
        let suggestionText;
        let confidence = 0.8;

        // Handle new structured response format from enhanced aiService
        if (aiSuggestion && typeof aiSuggestion === 'object' && aiSuggestion.response) {
            suggestionText = aiSuggestion.response;
            confidence = aiSuggestion.metadata?.confidence || 0.8;
        }
        // Handle legacy string format (for backward compatibility)
        else if (typeof aiSuggestion === 'string') {
            suggestionText = aiSuggestion;
        }
        // Handle legacy object format with 'suggestion' field
        else if (aiSuggestion && aiSuggestion.suggestion) {
            suggestionText = aiSuggestion.suggestion;
            confidence = aiSuggestion.confidence || 0.8;
        } else {
            throw new Error('AI service returned invalid format');
        }

        if (!suggestionText || suggestionText.trim().length === 0) {
            throw new Error('AI service returned empty suggestion text');
        }

        return { suggestionText, confidence };
    }

    /**
     * Bulk archive conversations
     */
    async bulkArchiveConversations(req, res) {
        try {
            const { conversationIds } = req.body;
            
            if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
                return res.status(400).json({
                    error: 'conversationIds must be a non-empty array'
                });
            }

            const result = await conversationService.bulkArchiveConversations(conversationIds);
            
            // Log activity for each archived conversation
            for (const conversationId of conversationIds) {
                activityService.logActivity({
                    userId: req.user?.id || null,
                    actionType: 'conversation',
                    action: 'archive',
                    details: { conversationId },
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });
            }

            res.status(200).json({
                success: true,
                message: `Archived ${result.count} conversations`,
                data: { archivedCount: result.count }
            });
        } catch (error) {
            console.error('Bulk archive error:', error);
            res.status(500).json({
                error: 'Failed to archive conversations'
            });
        }
    }

    /**
     * Bulk assign conversations to agent
     */
    async bulkAssignConversations(req, res) {
        try {
            const { conversationIds, agentId } = req.body;
            
            if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
                return res.status(400).json({
                    error: 'conversationIds must be a non-empty array'
                });
            }
            
            if (!agentId) {
                return res.status(400).json({
                    error: 'agentId is required'
                });
            }

            const result = await conversationService.bulkAssignConversations(conversationIds, agentId);
            
            // Log activity for each assigned conversation
            for (const conversationId of conversationIds) {
                activityService.logActivity({
                    userId: req.user?.id || null,
                    actionType: 'conversation',
                    action: 'assign',
                    details: { conversationId, agentId },
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });
            }

            res.status(200).json({
                success: true,
                message: `Assigned ${result.count} conversations to agent`,
                data: { assignedCount: result.count }
            });
        } catch (error) {
            console.error('Bulk assign error:', error);
            res.status(500).json({
                error: 'Failed to assign conversations'
            });
        }
    }

    /**
     * Bulk unarchive conversations
     */
    async bulkUnarchiveConversations(req, res) {
        try {
            const { conversationIds } = req.body;
            
            if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
                return res.status(400).json({
                    error: 'conversationIds must be a non-empty array'
                });
            }

            const result = await conversationService.bulkUnarchiveConversations(conversationIds);
            
            // Log activity for each unarchived conversation
            for (const conversationId of conversationIds) {
                activityService.logActivity({
                    userId: req.user?.id || null,
                    actionType: 'conversation',
                    action: 'unarchive',
                    details: { conversationId },
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });
            }

            res.status(200).json({
                success: true,
                message: `Unarchived ${result.count} conversations`,
                data: { unarchivedCount: result.count }
            });
        } catch (error) {
            console.error('Bulk unarchive error:', error);
            res.status(500).json({
                error: 'Failed to unarchive conversations'
            });
        }
    }
}

module.exports = ConversationController;