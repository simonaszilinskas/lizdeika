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

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

class ConversationService {
    /**
     * Create a new conversation (ticket)
     */
    async createConversation(conversationId, conversation) {
        try {
            // Generate a user-friendly ticket number
            const ticketNumber = await this.generateTicketNumber();
            
            const ticket = await prisma.ticket.create({
                data: {
                    id: conversationId,
                    ticketNumber: ticketNumber,
                    userId: conversation.visitorId ? await this.getOrCreateUser(conversation.visitorId) : null,
                    subject: conversation.subject || 'Customer Support Request',
                    description: conversation.description || '',
                    source: 'widget',
                    priority: 'medium',
                    category: conversation.category || 'general'
                },
                include: {
                    user: true,
                    assignedAgent: true,
                    messages: true
                }
            });
            
            // Return in the expected format for backward compatibility
            return {
                id: ticket.id,
                visitorId: conversation.visitorId,
                assignedAgent: ticket.assignedAgentId,
                startedAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
                ticketNumber: ticket.ticketNumber,
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
        try {
            const ticket = await prisma.ticket.findUnique({
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
        try {
            const ticket = await prisma.ticket.findUnique({
                where: { id: conversationId },
                include: {
                    user: true,
                    assignedAgent: true,
                    _count: {
                        select: { messages: true }
                    }
                }
            });
            
            if (!ticket) return null;
            
            // Convert user ID back to agent ID if assigned
            let assignedAgentId = null;
            if (ticket.assignedAgent) {
                const agentService = require('./agentService');
                assignedAgentId = agentService.getUserAgentId(ticket.assignedAgent);
            }
            
            // Return in expected format
            return {
                id: ticket.id,
                visitorId: ticket.user?.email || ticket.userId,
                userNumber: ticket.user?.userNumber,
                assignedAgent: assignedAgentId,
                startedAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
                category: ticket.category,
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
        try {
            const updateData = {};
            
            // Map fields
            if (updates.assignedAgent !== undefined) updateData.assignedAgentId = updates.assignedAgent;
            if (updates.subject) updateData.subject = updates.subject;
            if (updates.category) updateData.category = updates.category;
            if (updates.priority) updateData.priority = updates.priority;
            
            const ticket = await prisma.ticket.update({
                where: { id: conversationId },
                data: updateData,
                include: {
                    user: true,
                    assignedAgent: true
                }
            });
            
            // Convert user ID back to agent ID if assigned
            let assignedAgentId = null;
            if (ticket.assignedAgent) {
                const agentService = require('./agentService');
                assignedAgentId = agentService.getUserAgentId(ticket.assignedAgent);
            }
            
            // Return in expected format
            return {
                id: ticket.id,
                visitorId: ticket.user?.email || ticket.userId,
                userNumber: ticket.user?.userNumber,
                assignedAgent: assignedAgentId,
                startedAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
                ticketNumber: ticket.ticketNumber,
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
        try {
            const messages = await prisma.message.findMany({
                where: { ticketId: conversationId },
                orderBy: { createdAt: 'asc' },
                include: {
                    sender: true
                }
            });
            
            return messages.map(msg => ({
                id: msg.id,
                conversationId: msg.ticketId,
                content: msg.content,
                sender: this.mapSenderType(msg.senderType),
                timestamp: msg.createdAt,
                metadata: msg.metadata,
                senderId: msg.senderId,
                messageType: msg.messageType
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
        try {
            // Delete existing messages and recreate (for testing)
            await prisma.message.deleteMany({
                where: { ticketId: conversationId }
            });
            
            if (messageList.length === 0) return [];
            
            const createData = messageList.map(msg => ({
                id: msg.id || uuidv4(),
                ticketId: conversationId,
                senderId: msg.senderId || null,
                senderType: this.mapSenderTypeToEnum(msg.sender),
                content: msg.content,
                messageType: msg.messageType || 'text',
                metadata: msg.metadata || null
            }));
            
            await prisma.message.createMany({
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
        try {
            // Ensure conversation exists
            await this.ensureConversationExists(conversationId, message);
            
            const newMessage = await prisma.message.create({
                data: {
                    id: message.id || uuidv4(),
                    ticketId: conversationId,
                    senderId: message.senderId || null,
                    senderType: this.mapSenderTypeToEnum(message.sender),
                    content: message.content || '',
                    messageType: message.messageType || 'text',
                    metadata: message.metadata || null
                },
                include: {
                    sender: true
                }
            });
            
            // Update ticket timestamp
            await prisma.ticket.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
            });
            
            return {
                id: newMessage.id,
                conversationId: newMessage.ticketId,
                content: newMessage.content,
                sender: this.mapSenderType(newMessage.senderType),
                timestamp: newMessage.createdAt,
                metadata: newMessage.metadata,
                senderId: newMessage.senderId,
                messageType: newMessage.messageType
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
        try {
            // Get the last message
            const lastMessage = await prisma.message.findFirst({
                where: { ticketId: conversationId },
                orderBy: { createdAt: 'desc' }
            });
            
            if (lastMessage) {
                // Update the existing message
                const updatedMessage = await prisma.message.update({
                    where: { id: lastMessage.id },
                    data: {
                        content: newMessage.content,
                        metadata: newMessage.metadata || lastMessage.metadata
                    },
                    include: {
                        sender: true
                    }
                });
                
                return {
                    id: updatedMessage.id,
                    conversationId: updatedMessage.ticketId,
                    content: updatedMessage.content,
                    sender: this.mapSenderType(updatedMessage.senderType),
                    timestamp: updatedMessage.createdAt,
                    metadata: updatedMessage.metadata,
                    senderId: updatedMessage.senderId,
                    messageType: updatedMessage.messageType
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
     * Remove pending messages from conversation
     */
    async removePendingMessages(conversationId) {
        try {
            const deleted = await prisma.message.deleteMany({
                where: {
                    ticketId: conversationId,
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
     * Get all conversations with statistics
     */
    async getAllConversationsWithStats() {
        try {
            const tickets = await prisma.ticket.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    user: true,
                    assignedAgent: true,
                    messages: {
                        where: {
                            senderType: {
                                in: ['user', 'agent']
                            }
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 1
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
                visitorId: ticket.user?.email || ticket.userId,
                userNumber: ticket.user?.userNumber,
                userNumber: ticket.user?.userNumber,
                assignedAgent: ticket.assignedAgent ? this.mapUserIdToAgentId(ticket.assignedAgent) : null,
                startedAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
                messageCount: ticket._count.messages,
                lastMessage: ticket.messages[0] ? {
                    id: ticket.messages[0].id,
                    content: ticket.messages[0].content,
                    sender: this.mapSenderType(ticket.messages[0].senderType),
                    timestamp: ticket.messages[0].createdAt
                } : null
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
        try {
            return await prisma.ticket.count();
        } catch (error) {
            console.error('Failed to get conversation count:', error);
            return 0;
        }
    }

    /**
     * Get total message count
     */
    async getTotalMessageCount() {
        try {
            return await prisma.message.count({
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
        if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
            throw new Error('clearAllData can only be used in test/development environment');
        }
        
        try {
            // Delete in proper order due to foreign key constraints
            await prisma.message.deleteMany();
            await prisma.ticketAction.deleteMany();
            await prisma.ticket.deleteMany();
            
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
            
            const tickets = await prisma.ticket.findMany({
                where: { 
                    assignedAgentId: userId  // Use the database user ID
                },
                include: {
                    user: true,
                    assignedAgent: true,
                    _count: {
                        select: { messages: true }
                    }
                },
                orderBy: { updatedAt: 'desc' }
            });
            
            return tickets.map(ticket => ({
                id: ticket.id,
                visitorId: ticket.user?.email || ticket.userId,
                userNumber: ticket.user?.userNumber,
                assignedAgent: agentId,  // Return the original agent ID for compatibility
                startedAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
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
            const tickets = await prisma.ticket.findMany({
                include: {
                    user: true,
                    assignedAgent: true
                },
                orderBy: { updatedAt: 'desc' }
            });
            
            return tickets.map(ticket => ({
                id: ticket.id,
                visitorId: ticket.user?.email || ticket.userId,
                userNumber: ticket.user?.userNumber,
                assignedAgent: ticket.assignedAgentId,
                startedAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
                ticketNumber: ticket.ticketNumber,
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
                where.assignedAgentId = criteria.agentId;
            }
            
            if (criteria.startDate) {
                where.createdAt = {
                    gte: new Date(criteria.startDate)
                };
            }
            
            if (criteria.endDate) {
                where.createdAt = {
                    ...where.createdAt,
                    lte: new Date(criteria.endDate)
                };
            }
            
            const tickets = await prisma.ticket.findMany({
                where,
                include: {
                    user: true,
                    assignedAgent: true
                },
                orderBy: { createdAt: 'desc' }
            });
            
            return tickets.map(ticket => ({
                id: ticket.id,
                visitorId: ticket.user?.email || ticket.userId,
                userNumber: ticket.user?.userNumber,
                assignedAgent: ticket.assignedAgentId,
                startedAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
                ticketNumber: ticket.ticketNumber,
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
        try {
            // Get or create the agent user to get the proper database user ID
            const agentService = require('./agentService');
            const agentUser = await agentService.getOrCreateAgentUser(agentId);
            const userId = agentUser.id;
            
            const ticket = await prisma.ticket.update({
                where: { id: conversationId },
                data: { 
                    assignedAgentId: userId  // Use the database user ID
                },
                include: {
                    user: true,
                    assignedAgent: true
                }
            });
            
            // Log the assignment action only if we have a valid agent
            if (userId) {
                try {
                    await prisma.ticketAction.create({
                        data: {
                            ticketId: conversationId,
                            performedBy: userId,  // Use the database user ID
                            action: 'assigned',
                            newValue: agentId,    // Store the original agent ID as the value
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
                visitorId: ticket.user?.email || ticket.userId,
                userNumber: ticket.user?.userNumber,
                assignedAgent: agentId,  // Return the original agent ID for compatibility
                startedAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
                ticketNumber: ticket.ticketNumber,
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
            const tickets = await prisma.ticket.findMany({
                where: {
                    assignedAgentId: null
                },
                include: {
                    user: true
                },
                orderBy: { createdAt: 'asc' }
            });
            
            return tickets.map(ticket => ({
                id: ticket.id,
                visitorId: ticket.user?.email || ticket.userId,
                userNumber: ticket.user?.userNumber,
                assignedAgent: ticket.assignedAgentId,
                startedAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
                ticketNumber: ticket.ticketNumber,
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
        return this.getAllConversationsWithStats();
    }

    // HELPER METHODS

    /**
     * Map database user object to agent ID for backward compatibility
     */
    mapUserIdToAgentId(user) {
        if (!user) return null;
        
        // Extract agent ID from email or use fallback logic
        if (user.email && user.email.includes('@vilnius.lt')) {
            return user.email.split('@')[0];
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
        
        const dailyCount = await prisma.ticket.count({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lt: endOfDay
                }
            }
        });
        
        const sequence = (dailyCount + 1).toString().padStart(4, '0');
        return `VIL-${dateStr}-${sequence}`;
    }

    /**
     * Get next available user number
     */
    async getNextUserNumber() {
        try {
            const lastUser = await prisma.user.findFirst({
                where: {
                    userNumber: { not: null },
                    role: 'user'
                },
                orderBy: { userNumber: 'desc' },
                select: { userNumber: true }
            });
            
            return (lastUser?.userNumber || 0) + 1;
        } catch (error) {
            console.error('Failed to get next user number:', error);
            return 1; // Default to 1 if there's an error
        }
    }

    /**
     * Get or create user for visitor ID
     */
    async getOrCreateUser(visitorId) {
        try {
            // For now, treat visitorId as email or create anonymous user
            const isEmail = visitorId.includes('@');
            
            if (isEmail) {
                const user = await prisma.user.upsert({
                    where: { email: visitorId },
                    update: {},
                    create: {
                        email: visitorId,
                        firstName: 'Anonymous',
                        lastName: 'User',
                        passwordHash: 'anonymous',
                        role: 'user',
                        userNumber: await this.getNextUserNumber()
                    }
                });
                return user.id;
            } else {
                // Create anonymous user with unique email
                const anonymousEmail = `anonymous+${visitorId}@vilnius.lt`;
                const user = await prisma.user.upsert({
                    where: { email: anonymousEmail },
                    update: {},
                    create: {
                        email: anonymousEmail,
                        firstName: 'Anonymous',
                        lastName: 'Visitor',
                        passwordHash: 'anonymous',
                        role: 'user',
                        userNumber: await this.getNextUserNumber()
                    }
                });
                return user.id;
            }
        } catch (error) {
            console.error('Failed to get or create user:', error);
            return null;
        }
    }

    /**
     * Ensure conversation exists, create if not
     */
    async ensureConversationExists(conversationId, message) {
        const exists = await this.conversationExists(conversationId);
        if (!exists) {
            // Create conversation from message context
            await this.createConversation(conversationId, {
                visitorId: message.senderId || 'anonymous',
                subject: 'Customer Support Request',
                category: 'general'
            });
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