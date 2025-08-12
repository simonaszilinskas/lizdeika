/**
 * Conversation Service
 * Handles conversation data management and business logic
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