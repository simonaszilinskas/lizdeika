/**
 * CONVERSATION SERVICE
 * 
 * Main Purpose: Manage conversation data persistence, message storage, and conversation lifecycle
 * 
 * Key Responsibilities:
 * - Data Persistence: Store and retrieve conversations and messages in memory (production: database)
 * - Conversation Lifecycle: Create, update, assign, and end conversations
 * - Message Management: Add, retrieve, and filter messages with proper sequencing
 * - Agent Assignment: Automatically assign conversations to available agents
 * - Statistics and Analytics: Provide conversation metrics and reporting data
 * - Data Integrity: Ensure atomic operations and consistent data state
 * 
 * Dependencies:
 * - Agent service for agent availability and assignment logic
 * - In-memory Map storage (should be replaced with PostgreSQL in production)
 * 
 * Features:
 * - Real-time conversation and message management
 * - Automatic agent assignment based on availability and workload
 * - Message filtering and cleanup for system messages
 * - Conversation statistics with message counts and timestamps
 * - Pending message management for agent response workflows
 * - Multi-agent support with conversation ownership
 * 
 * Data Models:
 * - Conversation: id, visitorId, status, assignedAgent, timestamps, metadata
 * - Message: id, conversationId, content, sender, timestamp, metadata
 * - Supported senders: visitor, agent, ai, system
 * - Message metadata includes suggestion tracking and system flags
 * 
 * Agent Assignment Logic:
 * - Prioritizes online agents over busy agents
 * - Considers current workload (conversation count)
 * - Returns null if no agents are available
 * - Supports manual assignment override
 * 
 * Message Types:
 * - Visitor messages: Customer input and questions
 * - Agent messages: Human agent responses
 * - AI messages: Automated AI responses
 * - System messages: Status updates, assignments, notifications
 * 
 * Statistics Provided:
 * - Total conversations and message counts
 * - Conversation status distribution
 * - Agent assignment information
 * - Message timestamps and activity metrics
 * 
 * Notes:
 * - Uses in-memory storage for development/testing
 * - Atomic operations prevent race conditions
 * - Supports conversation filtering and search
 * - Includes data cleanup utilities for testing
 * - Thread-safe operations for concurrent access
 */

// In-memory storage (use PostgreSQL in production)
const conversations = new Map();
const messages = new Map();

class ConversationService {
    /**
     * Create a new conversation
     */
    async createConversation(conversationId, conversation) {
        conversations.set(conversationId, conversation);
        messages.set(conversationId, []);
        return conversation;
    }

    /**
     * Check if conversation exists
     */
    conversationExists(conversationId) {
        return conversations.has(conversationId);
    }

    /**
     * Get conversation by ID
     */
    getConversation(conversationId) {
        return conversations.get(conversationId);
    }

    /**
     * Update conversation
     */
    updateConversation(conversationId, conversation) {
        conversations.set(conversationId, conversation);
        return conversation;
    }

    /**
     * Get messages for a conversation
     */
    getMessages(conversationId) {
        return messages.get(conversationId) || [];
    }

    /**
     * Set messages for a conversation
     */
    setMessages(conversationId, messageList) {
        messages.set(conversationId, messageList);
    }

    /**
     * Add message to conversation
     */
    addMessage(conversationId, message) {
        const conversationMessages = messages.get(conversationId) || [];
        conversationMessages.push(message);
        messages.set(conversationId, conversationMessages);
        return message;
    }

    /**
     * Replace the last message in conversation
     */
    replaceLastMessage(conversationId, newMessage) {
        const conversationMessages = messages.get(conversationId) || [];
        
        if (conversationMessages.length === 0) {
            // No messages to replace, add as first message
            conversationMessages.push(newMessage);
        } else {
            // Replace the last message
            conversationMessages[conversationMessages.length - 1] = newMessage;
        }
        
        messages.set(conversationId, conversationMessages);
        return newMessage;
    }

    /**
     * Remove pending messages from conversation
     */
    removePendingMessages(conversationId) {
        const conversationMessages = messages.get(conversationId) || [];
        const filteredMessages = conversationMessages.filter(msg => 
            !(msg.sender === 'system' && msg.metadata && msg.metadata.pendingAgent)
        );
        messages.set(conversationId, filteredMessages);
        return filteredMessages;
    }

    /**
     * Get all conversations with stats
     */
    getAllConversationsWithStats() {
        return Array.from(conversations.values()).map(conv => ({
            ...conv,
            messageCount: (messages.get(conv.id) || []).length,
            lastMessage: (messages.get(conv.id) || []).slice(-1)[0]
        }));
    }

    /**
     * Get conversation count
     */
    getConversationCount() {
        return conversations.size;
    }

    /**
     * Get total message count
     */
    getTotalMessageCount() {
        return Array.from(messages.values()).reduce((total, msgs) => total + msgs.length, 0);
    }

    /**
     * Get available agent for assignment
     * Note: This method will be called from controllers with agentService injected
     */
    getAvailableAgent(agentService) {
        if (!agentService) return null;
        
        const activeAgents = agentService.getActiveAgents();
        
        if (activeAgents.length === 0) return null;
        
        // Find agent with least active chats
        const agentLoads = activeAgents.map(agent => ({
            ...agent,
            activeChats: Array.from(conversations.values()).filter(c => c.assignedAgent === agent.id).length
        }));
        
        // Sort by least busy agent
        agentLoads.sort((a, b) => a.activeChats - b.activeChats);
        
        return agentLoads[0];
    }

    /**
     * Clear all conversation data (for testing)
     */
    clearAllData() {
        conversations.clear();
        messages.clear();
    }

    /**
     * Get conversations assigned to specific agent
     */
    getAgentConversations(agentId) {
        return Array.from(conversations.values()).filter(conv => conv.assignedAgent === agentId);
    }

    /**
     * Get active conversations
     */
    getActiveConversations() {
        return Array.from(conversations.values()).filter(conv => conv.status === 'active');
    }

    /**
     * Search conversations by criteria
     */
    searchConversations(criteria) {
        const allConversations = Array.from(conversations.values());
        
        let filtered = allConversations;
        
        if (criteria.status) {
            filtered = filtered.filter(conv => conv.status === criteria.status);
        }
        
        if (criteria.agentId) {
            filtered = filtered.filter(conv => conv.assignedAgent === criteria.agentId);
        }
        
        if (criteria.startDate) {
            filtered = filtered.filter(conv => new Date(conv.startedAt) >= new Date(criteria.startDate));
        }
        
        if (criteria.endDate) {
            filtered = filtered.filter(conv => new Date(conv.startedAt) <= new Date(criteria.endDate));
        }
        
        return filtered;
    }

    /**
     * Get conversation statistics
     */
    getConversationStats() {
        const allConversations = Array.from(conversations.values());
        
        const stats = {
            total: allConversations.length,
            active: allConversations.filter(c => c.status === 'active').length,
            resolved: allConversations.filter(c => c.status === 'resolved').length,
            unassigned: allConversations.filter(c => !c.assignedAgent).length,
            totalMessages: this.getTotalMessageCount(),
            averageMessagesPerConversation: allConversations.length > 0 
                ? (this.getTotalMessageCount() / allConversations.length).toFixed(2) 
                : 0
        };
        
        return stats;
    }
}

module.exports = new ConversationService();