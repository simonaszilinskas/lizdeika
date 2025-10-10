/**
 * CONVERSATION SERVICE - PostgreSQL-Only Implementation
 * 
 * Main Purpose: Manage conversation data persistence, message storage, and conversation lifecycle
 * 
 * Key Responsibilities:
 * - Data Persistence: Store and retrieve conversations and messages in PostgreSQL
 * - Conversation Lifecycle: Create, update, assign, and end conversations
 * - Message Management: Add, retrieve, and filter messages with proper sequencing
 * - Agent Assignment: Automatically assign conversations to available agents
 * - Statistics and Analytics: Provide conversation metrics and reporting data
 * - Data Integrity: Ensure atomic operations and consistent data state
 * 
 * Dependencies:
 * - Prisma Client for PostgreSQL database operations
 * - Agent service for agent availability and assignment logic
 * - Database transactions for data consistency
 * 
 * Features:
 * - Persistent conversation and message management
 * - Automatic agent assignment based on availability and workload
 * - Message filtering and cleanup for system messages
 * - Conversation statistics with message counts and timestamps
 * - Pending message management for agent response workflows
 * - Multi-agent support with conversation ownership
 * 
 * Data Models:
 * - Conversation: Mapped to Ticket table with proper schema
 * - Message: Native Message table with relations and indexes
 * - Supported senders: user (visitor), agent, ai, system
 * - Message metadata includes suggestion tracking and system flags
 * 
 * Performance Features:
 * - Database indexes for optimal query performance
 * - Efficient batch operations and joins
 * - Cached statistics for frequently accessed data
 * - Optimized pagination for large datasets
 */

const databaseClient = require('../utils/database');
const { v4: uuidv4 } = require('uuid');

let prisma;

class ConversationService {
    /**
     * Create a new conversation (ticket)
     */
    async createConversation(conversationId, conversation) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            // Generate a user-friendly ticket number and user number for tracking
            const ticketNumber = await this.generateTicketNumber();
            const userNumber = await this.generateUserNumber();
            
            // NO USER CREATION - All conversations are anonymous and session-based
            const ticket = await prisma.tickets.create({
                data: {
                    id: conversationId,
                    ticket_number: ticketNumber,
                    user_id: null, // Always null - no user accounts for website visitors
                    user_number: userNumber, // Sequential number for anonymous user tracking
                    subject: conversation.subject || 'Website Support Request',
                    description: conversation.description || '',
                    source: 'widget',
                    priority: 'medium',
                    category: conversation.category || 'general',
                    created_at: new Date(),
                    updated_at: new Date()
                },
                include: {
                    users_tickets_user_idTousers: true,
                    users_tickets_assigned_agent_idTousers: true,
                    messages: true
                }
            });
            
            // Return in the expected format for backward compatibility
            return {
                id: ticket.id,
                visitorId: conversation.visitorId || 'anonymous',
                assignedAgent: ticket.assigned_agent_id,
                startedAt: ticket.created_at,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject,
                category: ticket.category
            };
        } catch (error) {
            console.error('Failed to create conversation:', error);
            throw new Error('Failed to create conversation: ' + error.message);
        }
    }

    /**
     * Check if conversation exists
     */
    async conversationExists(conversationId) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const ticket = await prisma.tickets.findUnique({
                where: { id: conversationId }
            });
            return !!ticket;
        } catch (error) {
            console.error('Failed to check conversation existence:', error);
            return false;
        }
    }

    /**
     * Get conversation by ID
     */
    async getConversation(conversationId) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const ticket = await prisma.tickets.findUnique({
                where: { id: conversationId },
                include: {
                    users_tickets_user_idTousers: true,
                    users_tickets_assigned_agent_idTousers: true,
                    ticket_category: {
                        select: {
                            id: true,
                            name: true,
                            color: true
                        }
                    },
                    _count: {
                        select: { messages: true }
                    }
                }
            });
            
            if (!ticket) return null;
            
            // Convert user ID back to agent ID if assigned
            let assignedAgentId = null;
            if (ticket.users_tickets_assigned_agent_idTousers) {
                const agentService = require('./agentService');
                assignedAgentId = agentService.getUserAgentId(ticket.users_tickets_assigned_agent_idTousers);
            }
            
            // Return in expected format with normalized category data
            return {
                id: ticket.id,
                visitorId: 'anonymous-session', // All website visitors are session-based
                userNumber: ticket.user_number, // Sequential number for anonymous user tracking
                assignedAgent: assignedAgentId,
                startedAt: ticket.created_at,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject,
                category: ticket.category, // Legacy field for backward compatibility
                categoryId: ticket.category_id, // New FK field
                category_id: ticket.category_id, // Alias for consistency
                categoryData: ticket.ticket_category ? {
                    id: ticket.ticket_category.id,
                    name: ticket.ticket_category.name,
                    color: ticket.ticket_category.color
                } : null,
                messageCount: ticket._count.messages
            };
        } catch (error) {
            console.error('Failed to get conversation:', error);
            return null;
        }
    }

    /**
     * Update conversation
     */
    async updateConversation(conversationId, updates) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const updateData = { updated_at: new Date() };
            
            // Map fields
            if (updates.assignedAgent !== undefined) updateData.assigned_agent_id = updates.assignedAgent;
            if (updates.subject) updateData.subject = updates.subject;
            if (updates.category) updateData.category = updates.category;
            if (updates.priority) updateData.priority = updates.priority;
            
            const ticket = await prisma.tickets.update({
                where: { id: conversationId },
                data: updateData,
                include: {
                    users_tickets_user_idTousers: true,
                    users_tickets_assigned_agent_idTousers: true
                }
            });
            
            // Convert user ID back to agent ID if assigned
            let assignedAgentId = null;
            if (ticket.users_tickets_assigned_agent_idTousers) {
                const agentService = require('./agentService');
                assignedAgentId = agentService.getUserAgentId(ticket.users_tickets_assigned_agent_idTousers);
            }
            
            // Return in expected format
            return {
                id: ticket.id,
                visitorId: 'anonymous-session', // All website visitors are session-based
                userNumber: ticket.user_number, // Sequential number for anonymous user tracking
                assignedAgent: assignedAgentId,
                startedAt: ticket.created_at,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject,
                category: ticket.category
            };
        } catch (error) {
            console.error('Failed to update conversation:', error);
            throw new Error('Failed to update conversation: ' + error.message);
        }
    }

    /**
     * Get messages for a conversation
     */
    async getMessages(conversationId) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const messages = await prisma.messages.findMany({
                where: { ticket_id: conversationId },
                orderBy: { created_at: 'asc' },
                include: {
                    users: true
                }
            });
            
            return messages.map(msg => ({
                id: msg.id,
                conversationId: msg.ticket_id,
                content: msg.content,
                sender: this.mapSenderType(msg.senderType),
                timestamp: msg.created_at,
                metadata: msg.metadata,
                senderId: msg.sender_id,
                messageType: msg.message_type
            }));
        } catch (error) {
            console.error('Failed to get messages:', error);
            return [];
        }
    }

    /**
     * Set messages for a conversation (for testing/migration)
     */
    async setMessages(conversationId, messageList) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            // Delete existing messages and recreate (for testing)
            await prisma.messages.deleteMany({
                where: { ticket_id: conversationId }
            });
            
            if (messageList.length === 0) return [];
            
            const createData = messageList.map(msg => ({
                id: msg.id || uuidv4(),
                ticket_id: conversationId,
                sender_id: msg.senderId || null,
                senderType: this.mapSenderTypeToEnum(msg.sender),
                content: msg.content,
                message_type: msg.messageType || 'text',
                metadata: msg.metadata || null
            }));
            
            await prisma.messages.createMany({
                data: createData
            });
            
            return this.getMessages(conversationId);
        } catch (error) {
            console.error('Failed to set messages:', error);
            return [];
        }
    }

    /**
     * Add message to conversation
     */
    async addMessage(conversationId, message) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            // Ensure conversation exists
            await this.ensureConversationExists(conversationId, message);
            
            // Auto-unarchive conversation if new message arrives from user or agent
            if (message.sender === 'visitor' || message.sender === 'user') {
                await this.autoUnarchiveOnNewMessage(conversationId, null); // User message - auto-assign
            } else if (message.sender === 'agent') {
                await this.autoUnarchiveOnNewMessage(conversationId, message.senderId); // Agent message - assign to sender
            }
            
            const newMessage = await prisma.messages.create({
                data: {
                    id: message.id || uuidv4(),
                    ticket_id: conversationId,
                    sender_id: message.senderId || null,
                    senderType: this.mapSenderTypeToEnum(message.sender),
                    content: message.content || '',
                    message_type: message.messageType || 'text',
                    metadata: message.metadata || null
                },
                include: {
                    users: true
                }
            });
            
            // Update ticket timestamp
            await prisma.tickets.update({
                where: { id: conversationId },
                data: { updated_at: new Date() }
            });
            
            return {
                id: newMessage.id,
                conversationId: newMessage.ticket_id,
                content: newMessage.content,
                sender: this.mapSenderType(newMessage.senderType),
                timestamp: newMessage.created_at,
                metadata: newMessage.metadata,
                senderId: newMessage.sender_id,
                messageType: newMessage.message_type
            };
        } catch (error) {
            console.error('Failed to add message:', error);
            throw new Error('Failed to add message: ' + error.message);
        }
    }

    /**
     * Replace the last message in a conversation
     */
    async replaceLastMessage(conversationId, newMessage) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            // Get the last message
            const lastMessage = await prisma.messages.findFirst({
                where: { ticket_id: conversationId },
                orderBy: { created_at: 'desc' }
            });
            
            if (lastMessage) {
                // Update the existing message
                const updatedMessage = await prisma.messages.update({
                    where: { id: lastMessage.id },
                    data: {
                        content: newMessage.content,
                        senderType: this.mapSenderTypeToEnum(newMessage.sender),
                        metadata: newMessage.metadata || lastMessage.metadata
                    },
                    include: {
                        users: true
                    }
                });
                
                return {
                    id: updatedMessage.id,
                    conversationId: updatedMessage.ticket_id,
                    content: updatedMessage.content,
                    sender: this.mapSenderType(updatedMessage.senderType),
                    timestamp: updatedMessage.created_at,
                    metadata: updatedMessage.metadata,
                    senderId: updatedMessage.sender_id,
                    messageType: updatedMessage.message_type
                };
            } else {
                // Add as new message if no messages exist
                return await this.addMessage(conversationId, newMessage);
            }
        } catch (error) {
            console.error('Failed to replace last message:', error);
            throw new Error('Failed to replace last message: ' + error.message);
        }
    }

    /**
     * Get existing offline notification message for a conversation
     */
    async getExistingOfflineMessage(conversationId) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const offlineMessage = await prisma.messages.findFirst({
                where: {
                    ticket_id: conversationId,
                    metadata: {
                        path: ['messageType'],
                        equals: 'offline_notification'
                    }
                },
                orderBy: { created_at: 'desc' }
            });

            if (offlineMessage) {
                return {
                    id: offlineMessage.id,
                    conversationId: offlineMessage.ticket_id,
                    content: offlineMessage.content,
                    sender: this.mapSenderType(offlineMessage.senderType),
                    timestamp: offlineMessage.created_at,
                    metadata: offlineMessage.metadata
                };
            }
            return null;
        } catch (error) {
            console.error('Failed to get existing offline message:', error);
            return null;
        }
    }

    /**
     * Remove pending messages from conversation
     */
    async removePendingMessages(conversationId) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const deleted = await prisma.messages.deleteMany({
                where: {
                    ticket_id: conversationId,
                    OR: [
                        {
                            metadata: {
                                path: ['pendingAgent'],
                                equals: true
                            }
                        },
                        {
                            content: {
                                contains: '[Message pending agent response'
                            }
                        }
                    ]
                }
            });

            return deleted.count;
        } catch (error) {
            console.error('Failed to remove pending messages:', error);
            return 0;
        }
    }

    /**
     * Clear pending AI suggestions for conversation
     */
    async clearPendingSuggestions(conversationId) {
        try {
            const deleted = await prisma.messages.deleteMany({
                where: {
                    ticket_id: conversationId,
                    OR: [
                        {
                            metadata: {
                                path: ['pendingAgent'],
                                equals: true
                            }
                        },
                        {
                            metadata: {
                                path: ['aiSuggestion'],
                                equals: true
                            }
                        },
                        {
                            senderType: 'system',
                            content: {
                                contains: '[AI Suggestion]'
                            }
                        }
                    ]
                }
            });

            console.log(`Cleared ${deleted.count} pending suggestions for conversation ${conversationId}`);
            return deleted.count;
        } catch (error) {
            console.error('Failed to clear pending suggestions:', error);
            return 0;
        }
    }

    /**
     * Get all conversations with statistics
     */
    async getAllConversationsWithStats() {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const tickets = await prisma.tickets.findMany({
                orderBy: { created_at: 'desc' },
                include: {
                    users_tickets_user_idTousers: true,
                    users_tickets_assigned_agent_idTousers: true,
                    ticket_category: {
                        select: {
                            id: true,
                            name: true,
                            color: true
                        }
                    },
                    messages: {
                        where: {
                            senderType: {
                                in: ['user', 'agent']
                            }
                        },
                        orderBy: { created_at: 'desc' },
                        take: parseInt(process.env.CONVERSATION_MESSAGES_LIMIT) || 50
                    },
                    _count: {
                        select: {
                            messages: {
                                where: {
                                    senderType: {
                                        in: ['user', 'agent']
                                    }
                                }
                            }
                        }
                    }
                }
            });
            
            return tickets.map(ticket => ({
                id: ticket.id,
                visitorId: 'anonymous-session', // All website visitors are session-based
                userNumber: ticket.user_number, // Sequential number for anonymous user tracking
                assignedAgent: ticket.users_tickets_assigned_agent_idTousers ? this.mapUserIdToAgentId(ticket.users_tickets_assigned_agent_idTousers) : null,
                startedAt: ticket.created_at,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject,
                archived: ticket.archived, // Include archived status
                category: ticket.category, // Legacy field for backward compatibility
                categoryId: ticket.category_id, // New FK field
                category_id: ticket.category_id, // Alias for consistency
                categoryData: ticket.ticket_category ? {
                    id: ticket.ticket_category.id,
                    name: ticket.ticket_category.name,
                    color: ticket.ticket_category.color
                } : null,
                messageCount: ticket._count.messages,
                lastMessage: ticket.messages[0] ? {
                    id: ticket.messages[0].id,
                    content: ticket.messages[0].content,
                    sender: this.mapSenderType(ticket.messages[0].senderType),
                    timestamp: ticket.messages[0].created_at
                } : null,
                messages: ticket.messages.map(msg => ({
                    id: msg.id,
                    content: msg.content,
                    sender: this.mapSenderType(msg.senderType),
                    timestamp: msg.created_at
                }))
            }));
        } catch (error) {
            console.error('Failed to get conversations with stats:', error);
            return [];
        }
    }

    /**
     * Get conversation count
     */
    async getConversationCount() {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            return await prisma.tickets.count();
        } catch (error) {
            console.error('Failed to get conversation count:', error);
            return 0;
        }
    }

    /**
     * Get total message count
     */
    async getTotalMessageCount() {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            return await prisma.messages.count({
                where: {
                    senderType: {
                        in: ['user', 'agent']
                    }
                }
            });
        } catch (error) {
            console.error('Failed to get total message count:', error);
            return 0;
        }
    }

    /**
     * Get available agent from agent service
     */
    async getAvailableAgent(agentService) {
        if (!agentService) return null;
        return agentService.getBestAvailableAgent();
    }

    /**
     * Clear all data (for testing only)
     */
    async clearAllData() {
        if (!prisma) prisma = databaseClient.getClient();
        if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
            throw new Error('clearAllData can only be used in test/development environment');
        }

        try {
            // Delete in proper order due to foreign key constraints
            await prisma.messages.deleteMany();
            await prisma.ticket_actions.deleteMany();
            await prisma.tickets.deleteMany();
            
            return true;
        } catch (error) {
            console.error('Failed to clear all data:', error);
            return false;
        }
    }

    /**
     * Get conversations assigned to a specific agent
     */
    async getAgentConversations(agentId) {
        try {
            // Get or create the agent user to get the proper database user ID
            const agentService = require('./agentService');
            const agentUser = await agentService.getOrCreateAgentUser(agentId);
            const userId = agentUser.id;
            
            const tickets = await prisma.tickets.findMany({
                where: {
                    assigned_agent_id: userId  // Use the database user ID
                },
                include: {
                    users_tickets_user_idTousers: true,
                    users_tickets_assigned_agent_idTousers: true,
                    ticket_category: {
                        select: {
                            id: true,
                            name: true,
                            color: true
                        }
                    },
                    _count: {
                        select: { messages: true }
                    }
                },
                orderBy: { updated_at: 'desc' }
            });
            
            return tickets.map(ticket => ({
                id: ticket.id,
                visitorId: 'anonymous-session', // All website visitors are session-based
                userNumber: ticket.user_number, // Sequential number for anonymous user tracking
                assignedAgent: agentId,  // Return the original agent ID for compatibility
                startedAt: ticket.created_at,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject,
                category: ticket.category, // Legacy field for backward compatibility
                categoryId: ticket.category_id, // New FK field
                category_id: ticket.category_id, // Alias for consistency
                categoryData: ticket.ticket_category ? {
                    id: ticket.ticket_category.id,
                    name: ticket.ticket_category.name,
                    color: ticket.ticket_category.color
                } : null,
                messageCount: ticket._count.messages
            }));
        } catch (error) {
            console.error('Failed to get agent conversations:', error);
            return [];
        }
    }

    /**
     * Get active conversations
     */
    async getActiveConversations() {
        try {
            const tickets = await prisma.tickets.findMany({
                include: {
                    users_tickets_user_idTousers: true,
                    users_tickets_assigned_agent_idTousers: true
                },
                orderBy: { updated_at: 'desc' }
            });
            
            return tickets.map(ticket => ({
                id: ticket.id,
                visitorId: 'anonymous-session', // All website visitors are session-based
                userNumber: ticket.user_number, // Sequential number for anonymous user tracking
                assignedAgent: ticket.assigned_agent_id,
                startedAt: ticket.created_at,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject
            }));
        } catch (error) {
            console.error('Failed to get active conversations:', error);
            return [];
        }
    }

    /**
     * Search conversations by criteria
     */
    async searchConversations(criteria = {}) {
        try {
            const where = {};
            
            if (criteria.agentId) {
                where.assigned_agent_id = criteria.agentId;
            }
            
            if (criteria.startDate) {
                where.created_at = {
                    gte: new Date(criteria.startDate)
                };
            }
            
            if (criteria.endDate) {
                where.created_at = {
                    ...where.created_at,
                    lte: new Date(criteria.endDate)
                };
            }
            
            const tickets = await prisma.tickets.findMany({
                where,
                include: {
                    users_tickets_user_idTousers: true,
                    users_tickets_assigned_agent_idTousers: true
                },
                orderBy: { created_at: 'desc' }
            });
            
            return tickets.map(ticket => ({
                id: ticket.id,
                visitorId: 'anonymous-session', // All website visitors are session-based
                userNumber: ticket.user_number, // Sequential number for anonymous user tracking
                assignedAgent: ticket.assigned_agent_id,
                startedAt: ticket.created_at,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject
            }));
        } catch (error) {
            console.error('Failed to search conversations:', error);
            return [];
        }
    }


    /**
     * Assign conversation to agent
     */
    async assignConversation(conversationId, agentId) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            // Get or create the agent user to get the proper database user ID
            const agentService = require('./agentService');
            const agentUser = await agentService.getOrCreateAgentUser(agentId);
            const userId = agentUser.id;
            
            const ticket = await prisma.tickets.update({
                where: { id: conversationId },
                data: { 
                    assigned_agent_id: userId,  // Use the database user ID
                    updated_at: new Date()
                },
                include: {
                    users_tickets_user_idTousers: true,
                    users_tickets_assigned_agent_idTousers: true
                }
            });
            
            // Log the assignment action only if we have a valid agent
            if (userId) {
                try {
                    await prisma.ticket_actions.create({
                        data: {
                            id: uuidv4(),
                            ticket_id: conversationId,
                            performed_by: userId,  // Use the database user ID
                            action: 'assigned',
                            new_value: agentId,    // Store the original agent ID as the value
                            reason: 'Auto-assigned by system'
                        }
                    });
                } catch (actionError) {
                    console.error('Failed to log assignment action:', actionError);
                    // Don't fail the assignment if logging fails
                }
            }
            
            return {
                id: ticket.id,
                visitorId: 'anonymous-session', // All website visitors are session-based
                userNumber: ticket.user_number, // Sequential number for anonymous user tracking
                assignedAgent: agentId,  // Return the original agent ID for compatibility
                startedAt: ticket.created_at,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject
            };
        } catch (error) {
            console.error('Failed to assign conversation:', error);
            throw new Error('Failed to assign conversation: ' + error.message);
        }
    }



    /**
     * Get orphaned conversations (no assigned agent)
     */
    async getOrphanedConversations() {
        try {
            const tickets = await prisma.tickets.findMany({
                where: {
                    assigned_agent_id: null
                },
                include: {
                    users_tickets_user_idTousers: true
                },
                orderBy: { created_at: 'asc' }
            });
            
            return tickets.map(ticket => ({
                id: ticket.id,
                visitorId: 'anonymous-session', // All website visitors are session-based
                userNumber: ticket.user_number, // Sequential number for anonymous user tracking
                assignedAgent: ticket.assigned_agent_id,
                startedAt: ticket.created_at,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject
            }));
        } catch (error) {
            console.error('Failed to get orphaned conversations:', error);
            return [];
        }
    }

    /**
     * Get all conversations (alias for compatibility)
     */
    async getAllConversations() {
        if (!prisma) prisma = databaseClient.getClient();
        return this.getAllConversationsWithStats();
    }

    // HELPER METHODS

    /**
     * Map database user object to agent ID for backward compatibility
     */
    mapUserIdToAgentId(user) {
        if (!user) return null;
        
        // Use full email as agent ID for consistency
        if (user.email && user.email.includes('@vilnius.lt')) {
            return user.email; // Return full email instead of truncated
        }
        
        // Fallback: if it's an agent/admin user, use their user ID as agent ID
        if (user.role === 'agent' || user.role === 'admin') {
            return user.id;
        }
        
        return null;
    }

    /**
     * Generate a unique ticket number
     */
    async generateTicketNumber() {
        const today = new Date();
        const dateStr = today.getFullYear().toString() + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + 
                       today.getDate().toString().padStart(2, '0');
        
        // Get count of tickets created today
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        
        const dailyCount = await prisma.tickets.count({
            where: {
                created_at: {
                    gte: startOfDay,
                    lt: endOfDay
                }
            }
        });
        
        const sequence = (dailyCount + 1).toString().padStart(4, '0');
        return `VIL-${dateStr}-${sequence}`;
    }

    /**
     * Generate next available user number for anonymous users
     */
    async generateUserNumber() {
        try {
            // Find the highest existing user number
            const result = await prisma.tickets.findFirst({
                where: {
                    user_number: {
                        not: null
                    }
                },
                orderBy: {
                    user_number: 'desc'
                },
                select: {
                    user_number: true
                }
            });
            
            // Return next available number (starting from 1)
            return (result?.user_number || 0) + 1;
        } catch (error) {
            console.error('Failed to generate user number:', error);
            // Fallback to timestamp-based number in case of error
            return Math.floor(Date.now() / 1000) % 100000;
        }
    }

    // REMOVED: No user creation methods needed
    // All website visitors are purely session-based with no database user records

    /**
     * Ensure conversation exists, create if not - Pure session-based
     */
    async ensureConversationExists(conversationId, message) {
        const exists = await this.conversationExists(conversationId);
        if (!exists) {
            // Create conversation from message context - Always anonymous session
            await this.createConversation(conversationId, {
                subject: 'Website Support Request',
                category: 'general'
                // No visitorId needed - all are anonymous sessions
            });
        }
    }

    /**
     * Bulk archive conversations
     */
    async bulkArchiveConversations(conversationIds) {
        try {
            const result = await prisma.tickets.updateMany({
                where: {
                    id: {
                        in: conversationIds
                    },
                    archived: false
                },
                data: {
                    archived: true,
                    assigned_agent_id: null, // Clear assignment when archiving
                    updated_at: new Date()
                }
            });
            
            return { count: result.count };
        } catch (error) {
            console.error('Failed to bulk archive conversations:', error);
            throw new Error('Failed to archive conversations: ' + error.message);
        }
    }

    /**
     * Bulk unarchive conversations
     */
    async bulkUnarchiveConversations(conversationIds) {
        try {
            const result = await prisma.tickets.updateMany({
                where: {
                    id: {
                        in: conversationIds
                    },
                    archived: true
                },
                data: {
                    archived: false,
                    updated_at: new Date()
                }
            });
            
            return { count: result.count };
        } catch (error) {
            console.error('Failed to bulk unarchive conversations:', error);
            throw new Error('Failed to unarchive conversations: ' + error.message);
        }
    }

    /**
     * Bulk assign conversations to agent
     */
    async bulkAssignConversations(conversationIds, agentId) {
        try {
            // Convert agent email to user ID if needed
            let userId = agentId;
            if (agentId.includes('@')) {
                const user = await prisma.users.findUnique({
                    where: { email: agentId }
                });
                if (!user) {
                    throw new Error(`Agent with email ${agentId} not found`);
                }
                userId = user.id;
            }

            const result = await prisma.tickets.updateMany({
                where: {
                    id: {
                        in: conversationIds
                    }
                },
                data: {
                    assigned_agent_id: userId,
                    updated_at: new Date()
                }
            });
            
            return { count: result.count };
        } catch (error) {
            console.error('Failed to bulk assign conversations:', error);
            throw new Error('Failed to assign conversations: ' + error.message);
        }
    }

    /**
     * Auto-unarchive conversation when new message arrives
     */
    async autoUnarchiveOnNewMessage(conversationId, assignToAgentId = null) {
        try {
            // Check if conversation is archived
            const conversation = await prisma.tickets.findUnique({
                where: { id: conversationId },
                select: { archived: true, assigned_agent_id: true }
            });
            
            if (conversation && conversation.archived) {
                let updateData = {
                    archived: false,
                    updated_at: new Date()
                };
                
                // Handle assignment based on message type
                if (assignToAgentId) {
                    // Agent message - assign to that agent
                    updateData.assigned_agent_id = assignToAgentId;
                } else {
                    // User message - try auto-assignment or leave unassigned
                    const agentService = require('./agentService');
                    try {
                        const availableAgent = await agentService.getNextAvailableAgent();
                        updateData.assigned_agent_id = availableAgent || null;
                    } catch (error) {
                        console.error('Failed to get available agent for auto-assignment:', error);
                        updateData.assigned_agent_id = null;
                    }
                }
                
                await prisma.tickets.update({
                    where: { id: conversationId },
                    data: updateData
                });
                
                // Log auto-unarchive activity
                try {
                    const activityService = require('./activityService');
                    await activityService.logActivity({
                        userId: assignToAgentId, // Log which agent caused the unarchive (if any)
                        actionType: 'conversation',
                        action: 'auto_unarchive',
                        details: { 
                            conversationId,
                            assignedTo: updateData.assigned_agent_id,
                            trigger: assignToAgentId ? 'agent_message' : 'user_message'
                        },
                        ipAddress: null // System action
                    });
                } catch (error) {
                    console.error('Failed to log auto-unarchive activity:', error);
                    // Don't fail the unarchive operation if logging fails
                }
                
                console.log(`Auto-unarchived conversation ${conversationId} due to new message`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to auto-unarchive conversation:', error);
            return false;
        }
    }

    /**
     * Mark conversation as seen by agent
     * For now, just updates the ticket's updated_at timestamp to track activity
     * In the future, could add a proper seen_by tracking table
     */
    async markConversationAsSeenByAgent(conversationId, agentId) {
        try {
            const ticket = await prisma.tickets.findUnique({
                where: { id: conversationId }
            });

            if (!ticket) {
                throw new Error(`Conversation ${conversationId} not found`);
            }

            // Simply update the ticket's updated_at timestamp
            // This is enough to reset the "unseen" status for now
            await prisma.tickets.update({
                where: { id: conversationId },
                data: {
                    updated_at: new Date()
                }
            });

            console.log(`✅ Conversation ${conversationId} marked as seen by agent ${agentId}`);
            return true;

        } catch (error) {
            console.error(`Failed to mark conversation as seen:`, error);
            throw error;
        }
    }

    /**
     * Update conversation category
     * @param {string} conversationId - Conversation ID
     * @param {string|null} categoryId - Category ID or null to remove
     * @param {boolean} isManualOverride - Whether this is a manual agent action (default: true)
     * @returns {Object} Updated conversation
     */
    async updateConversationCategory(conversationId, categoryId, isManualOverride = true) {
        try {
            const existing = await prisma.tickets.findUnique({
                where: { id: conversationId }
            });

            if (!existing) {
                throw new Error(`Conversation ${conversationId} not found`);
            }

            // Set manual_category_override when agent manually changes category
            // This prevents AI from immediately re-categorizing
            const updated = await prisma.tickets.update({
                where: { id: conversationId },
                data: {
                    category_id: categoryId,
                    manual_category_override: isManualOverride,
                    // Clear AI metadata when manually overriding
                    category_metadata: isManualOverride ? null : existing.category_metadata
                },
                include: {
                    ticket_category: {
                        select: {
                            id: true,
                            name: true,
                            color: true
                        }
                    }
                }
            });

            if (!updated) {
                throw new Error(`Failed to update category for conversation ${conversationId}`);
            }

            return updated;
        } catch (error) {
            console.error(`Failed to update conversation category: ${error.message}`);
            throw error;
        }
    }

    /**
     * Toggle manual category override flag
     * @param {string} conversationId - Conversation ID
     * @param {boolean} manualOverride - Whether manual override is enabled
     * @returns {Object} Updated ticket with override status
     */
    async toggleCategoryOverride(conversationId, manualOverride) {
        try {
            const existing = await prisma.tickets.findUnique({
                where: { id: conversationId },
                select: {
                    id: true,
                    category_metadata: true
                }
            });

            if (!existing) {
                throw new Error(`Conversation ${conversationId} not found`);
            }

            const updated = await prisma.tickets.update({
                where: { id: conversationId },
                data: {
                    manual_category_override: manualOverride,
                    // Clear AI metadata when re-enabling AI control
                    category_metadata: manualOverride === false ? null : existing.category_metadata
                },
                select: {
                    id: true,
                    manual_category_override: true,
                    category_id: true,
                    category_metadata: true
                }
            });

            return updated;
        } catch (error) {
            console.error(`Failed to toggle category override: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get conversations by category
     * @param {string} categoryId - Category ID
     * @param {Object} options - Query options
     * @returns {Array} Array of conversations
     */
    async getConversationsByCategory(categoryId, options = {}) {
        const { limit = 50, offset = 0, includeArchived = false } = options;

        try {
            return await prisma.tickets.findMany({
                where: {
                    category_id: categoryId,
                    archived: includeArchived ? undefined : false
                },
                include: {
                    ticket_category: {
                        select: {
                            id: true,
                            name: true,
                            color: true
                        }
                    },
                    users_tickets_assigned_agent_idTousers: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true
                        }
                    },
                    users_tickets_user_idTousers: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true
                        }
                    },
                    _count: {
                        select: { messages: true }
                    }
                },
                orderBy: { updated_at: 'desc' },
                skip: offset,
                take: limit
            });
        } catch (error) {
            console.error(`Failed to get conversations by category: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get conversation category statistics
     * @returns {Object} Category statistics
     */
    async getCategoryStatistics() {
        try {
            const [categorizedCount, uncategorizedCount, categoryBreakdown] = await Promise.all([
                // Count of categorized conversations
                prisma.tickets.count({
                    where: {
                        category_id: { not: null },
                        archived: false
                    }
                }),
                // Count of uncategorized conversations
                prisma.tickets.count({
                    where: {
                        category_id: null,
                        archived: false
                    }
                }),
                // Breakdown by category
                prisma.tickets.groupBy({
                    by: ['category_id'],
                    where: {
                        category_id: { not: null },
                        archived: false
                    },
                    _count: {
                        _all: true
                    }
                })
            ]);

            const total = categorizedCount + uncategorizedCount;

            return {
                total_conversations: total,
                categorized_conversations: categorizedCount,
                uncategorized_conversations: uncategorizedCount,
                categorization_rate: total > 0 ? categorizedCount / total : 0,
                category_breakdown: categoryBreakdown.map(item => ({
                    category_id: item.category_id,
                    conversation_count: item._count._all
                }))
            };
        } catch (error) {
            console.error(`Failed to get category statistics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Map sender type to database enum
     */
    mapSenderTypeToEnum(sender) {
        const mapping = {
            'visitor': 'user',
            'user': 'user',
            'agent': 'agent',
            'ai': 'ai',
            'system': 'system'
        };
        return mapping[sender] || 'user';
    }

    /**
     * Map database enum to frontend sender type
     */
    mapSenderType(senderType) {
        const mapping = {
            'user': 'visitor',
            'agent': 'agent',
            'ai': 'ai',
            'system': 'system'
        };
        return mapping[senderType] || 'visitor';
    }
}

module.exports = new ConversationService();
