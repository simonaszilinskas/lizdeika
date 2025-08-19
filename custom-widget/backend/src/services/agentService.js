/**
 * Agent Service
 * Handles agent data management and business logic
 */

// In-memory storage (use PostgreSQL/Redis in production)
const agents = new Map();

// Global system state
let systemMode = 'hitl'; // hitl, autopilot, off

class AgentService {
    /**
     * Update agent personal status (online/afk)
     */
    updateAgentPersonalStatus(agentId, personalStatus, conversationService = null) {
        const activeChats = conversationService 
            ? conversationService.getAgentConversations(agentId).length 
            : 0;
        
        const existingAgent = agents.get(agentId) || {};
        
        agents.set(agentId, {
            ...existingAgent,
            id: agentId,
            personalStatus: personalStatus, // online, afk
            lastSeen: new Date(),
            activeChats: activeChats,
            connected: true
        });
        
        return agents.get(agentId);
    }

    /**
     * Legacy method for backward compatibility
     */
    updateAgentStatus(agentId, status, conversationService = null) {
        return this.updateAgentPersonalStatus(agentId, status, conversationService);
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
     * Get available agents (connected and not AFK)
     */
    getAvailableAgents() {
        const now = new Date();
        return Array.from(agents.values()).filter(agent => 
            agent.connected &&
            agent.personalStatus !== 'afk' && 
            (now - agent.lastSeen) < 60000 // Active in last minute
        );
    }

    /**
     * Get active agents (legacy - for backward compatibility)
     */
    getActiveAgents() {
        return this.getAvailableAgents();
    }

    /**
     * Get online agents (HITL and Autopilot modes)
     */
    getOnlineAgents() {
        return Array.from(agents.values()).filter(agent => 
            (agent.status === 'online' || agent.status === 'hitl' || agent.status === 'autopilot') && 
            (new Date() - agent.lastSeen) < 60000 // Active in last minute
        );
    }

    /**
     * Set agent as online with socket info
     */
    setAgentOnline(agentId, socketId = null, conversationService = null) {
        const activeChats = conversationService 
            ? conversationService.getAgentConversations(agentId).length 
            : 0;
        
        const agent = {
            id: agentId,
            status: 'online',
            lastSeen: new Date(),
            socketId: socketId,
            activeChats: activeChats
        };
        
        agents.set(agentId, agent);
        return agent;
    }

    /**
     * Set agent as offline (cleanup)
     */
    setAgentOffline(agentId) {
        const agent = agents.get(agentId);
        if (agent) {
            agent.connected = false;
            agent.personalStatus = 'offline';
            agent.lastSeen = new Date();
            agents.set(agentId, agent);
        }
        return agent;
    }

    /**
     * Get best available agent for new conversation (load balancing)
     * Returns agent with least active conversations
     */
    getBestAvailableAgent() {
        const availableAgents = this.getAvailableAgents();
        
        if (availableAgents.length === 0) {
            return null;
        }
        
        // Sort by least active chats, then by last seen (oldest first for fairness)
        return availableAgents.sort((a, b) => {
            if (a.activeChats !== b.activeChats) {
                return a.activeChats - b.activeChats; // Least active chats first
            }
            return new Date(a.lastSeen) - new Date(b.lastSeen); // Oldest first
        })[0];
    }

    /**
     * Get/Set global system mode
     */
    getSystemMode() {
        return systemMode;
    }

    setSystemMode(mode) {
        if (['hitl', 'autopilot', 'off'].includes(mode)) {
            systemMode = mode;
            return true;
        }
        return false;
    }

    /**
     * Get connected agents (for display)
     */
    getConnectedAgents() {
        const now = new Date();
        return Array.from(agents.values()).filter(agent => 
            agent.connected && (now - agent.lastSeen) < 60000
        );
    }

    /**
     * Handle agent going AFK - reassign their tickets
     */
    handleAgentAFK(agentId, conversationService) {
        if (!conversationService) return [];
        
        const agentConversations = conversationService.getAgentConversations(agentId);
        const availableAgents = this.getAvailableAgents().filter(a => a.id !== agentId);
        
        if (availableAgents.length === 0) {
            // No one available, keep tickets assigned but mark as orphaned
            return agentConversations.map(conv => ({
                conversationId: conv.id,
                action: 'orphaned',
                reason: 'No available agents'
            }));
        }

        const reassignments = [];
        
        agentConversations.forEach(conv => {
            // Use load balancing to find best agent
            const bestAgent = this.getBestAvailableAgent();
            if (bestAgent) {
                conversationService.assignConversation(conv.id, bestAgent.id);
                reassignments.push({
                    conversationId: conv.id,
                    fromAgent: agentId,
                    toAgent: bestAgent.id,
                    action: 'reassigned'
                });
            }
        });

        return reassignments;
    }

    /**
     * Handle agent coming back online - reclaim their tickets if appropriate
     */
    handleAgentBackOnline(agentId, conversationService) {
        if (!conversationService) return [];
        
        // Find conversations that were originally this agent's
        const allConversations = conversationService.getAllConversations();
        const reclaimable = allConversations.filter(conv => 
            conv.originalAgent === agentId && 
            conv.assignedAgent !== agentId &&
            !this.conversationHasRecentActivity(conv, 300000) // No activity in last 5 minutes
        );

        const reclaims = [];
        
        reclaimable.forEach(conv => {
            conversationService.assignConversation(conv.id, agentId);
            reclaims.push({
                conversationId: conv.id,
                fromAgent: conv.assignedAgent,
                toAgent: agentId,
                action: 'reclaimed'
            });
        });

        return reclaims;
    }

    /**
     * Distribute orphaned tickets gradually when agents come online
     */
    redistributeOrphanedTickets(conversationService, maxTicketsPerAgent = 3) {
        if (!conversationService) return [];
        
        const availableAgents = this.getAvailableAgents();
        const orphanedConversations = conversationService.getOrphanedConversations();
        
        if (availableAgents.length === 0 || orphanedConversations.length === 0) return [];

        const redistributions = [];
        let ticketIndex = 0;

        // Distribute tickets gradually - max N tickets per agent at a time
        availableAgents.forEach(agent => {
            const currentLoad = agent.activeChats || 0;
            const canTake = Math.min(maxTicketsPerAgent, orphanedConversations.length - ticketIndex);
            
            for (let i = 0; i < canTake && ticketIndex < orphanedConversations.length; i++) {
                const conv = orphanedConversations[ticketIndex];
                conversationService.assignConversation(conv.id, agent.id);
                
                redistributions.push({
                    conversationId: conv.id,
                    toAgent: agent.id,
                    action: 'redistributed',
                    previousLoad: currentLoad
                });
                
                ticketIndex++;
            }
        });

        return redistributions;
    }

    /**
     * Check if conversation has recent activity
     */
    conversationHasRecentActivity(conversation, thresholdMs) {
        if (!conversation.lastActivity) return false;
        return (new Date() - new Date(conversation.lastActivity)) < thresholdMs;
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
    getAgentPerformance(agentId, conversationService = null) {
        const agent = agents.get(agentId);
        
        if (!agent) return null;
        
        if (!conversationService) {
            return {
                agentId: agentId,
                totalConversations: 0,
                resolvedConversations: 0,
                activeConversations: 0,
                resolutionRate: 0,
                averageResolutionTime: 0,
                currentStatus: agent.status,
                lastActive: agent.lastSeen
            };
        }
        
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