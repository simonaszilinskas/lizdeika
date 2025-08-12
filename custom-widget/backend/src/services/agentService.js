/**
 * Agent Service
 * Handles agent data management and business logic
 */

// In-memory storage (use PostgreSQL/Redis in production)
const agents = new Map();

class AgentService {
    /**
     * Update agent status
     */
    updateAgentStatus(agentId, status) {
        const conversationService = require('./conversationService');
        
        agents.set(agentId, {
            id: agentId,
            status: status, // online, busy, offline
            lastSeen: new Date(),
            activeChats: conversationService.getAgentConversations(agentId).length
        });
        
        return agents.get(agentId);
    }

    /**
     * Get agent by ID
     */
    getAgent(agentId) {
        return agents.get(agentId);
    }

    /**
     * Get all agents
     */
    getAllAgents() {
        return Array.from(agents.values());
    }

    /**
     * Get active agents
     */
    getActiveAgents() {
        return Array.from(agents.values()).filter(agent => 
            agent.status !== 'offline' && 
            (new Date() - agent.lastSeen) < 60000 // Active in last minute
        );
    }

    /**
     * Get online agents
     */
    getOnlineAgents() {
        return Array.from(agents.values()).filter(agent => 
            agent.status === 'online' && 
            (new Date() - agent.lastSeen) < 60000 // Active in last minute
        );
    }

    /**
     * Set agent as online with socket info
     */
    setAgentOnline(agentId, socketId = null) {
        const conversationService = require('./conversationService');
        
        const agent = {
            id: agentId,
            status: 'online',
            lastSeen: new Date(),
            socketId: socketId,
            activeChats: conversationService.getAgentConversations(agentId).length
        };
        
        agents.set(agentId, agent);
        return agent;
    }

    /**
     * Set agent as offline
     */
    setAgentOffline(agentId) {
        const agent = agents.get(agentId);
        if (agent) {
            agent.status = 'offline';
            agent.lastSeen = new Date();
            agents.set(agentId, agent);
        }
        return agent;
    }

    /**
     * Update agent's last seen timestamp
     */
    updateLastSeen(agentId) {
        const agent = agents.get(agentId);
        if (agent) {
            agent.lastSeen = new Date();
            agents.set(agentId, agent);
        }
        return agent;
    }

    /**
     * Get agent count
     */
    getAgentCount() {
        return agents.size;
    }

    /**
     * Clear all agent data (for testing)
     */
    clearAllData() {
        agents.clear();
    }

    /**
     * Get agent statistics
     */
    getAgentStats() {
        const allAgents = Array.from(agents.values());
        const now = new Date();
        
        const stats = {
            total: allAgents.length,
            online: allAgents.filter(a => a.status === 'online' && (now - a.lastSeen) < 60000).length,
            busy: allAgents.filter(a => a.status === 'busy' && (now - a.lastSeen) < 60000).length,
            offline: allAgents.filter(a => a.status === 'offline' || (now - a.lastSeen) >= 60000).length,
            totalActiveChats: allAgents.reduce((sum, agent) => sum + (agent.activeChats || 0), 0)
        };
        
        return stats;
    }

    /**
     * Get agent performance metrics
     */
    getAgentPerformance(agentId) {
        const conversationService = require('./conversationService');
        const agent = agents.get(agentId);
        
        if (!agent) return null;
        
        const agentConversations = conversationService.getAgentConversations(agentId);
        const resolvedConversations = agentConversations.filter(c => c.status === 'resolved');
        
        return {
            agentId: agentId,
            totalConversations: agentConversations.length,
            resolvedConversations: resolvedConversations.length,
            activeConversations: agentConversations.filter(c => c.status === 'active').length,
            resolutionRate: agentConversations.length > 0 
                ? ((resolvedConversations.length / agentConversations.length) * 100).toFixed(2)
                : 0,
            averageResolutionTime: this.calculateAverageResolutionTime(resolvedConversations),
            currentStatus: agent.status,
            lastActive: agent.lastSeen
        };
    }

    /**
     * Calculate average resolution time for conversations
     */
    calculateAverageResolutionTime(conversations) {
        if (conversations.length === 0) return 0;
        
        const resolutionTimes = conversations
            .filter(c => c.startedAt && c.endedAt)
            .map(c => new Date(c.endedAt) - new Date(c.startedAt));
        
        if (resolutionTimes.length === 0) return 0;
        
        const averageMs = resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length;
        return Math.round(averageMs / (1000 * 60)); // Return in minutes
    }

    /**
     * Find best available agent for assignment
     */
    findBestAvailableAgent() {
        const onlineAgents = this.getOnlineAgents();
        
        if (onlineAgents.length === 0) return null;
        
        // Sort by least active chats, then by last seen (most recent first)
        onlineAgents.sort((a, b) => {
            if (a.activeChats !== b.activeChats) {
                return a.activeChats - b.activeChats;
            }
            return new Date(b.lastSeen) - new Date(a.lastSeen);
        });
        
        return onlineAgents[0];
    }
}

module.exports = new AgentService();