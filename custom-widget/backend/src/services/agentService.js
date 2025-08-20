/**
 * AGENT SERVICE - PostgreSQL-Only Implementation
 * Handles agent data management and business logic using PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { handleServiceError, createError } = require('../utils/errors');

const prisma = new PrismaClient();

// System mode is now stored in database

class AgentService {
    /**
     * Generate a simple display name for an agent (simplified approach)
     */
    getAgentDisplayName(agentId) {
        // Simple approach: extract meaningful name from agentId
        if (agentId.includes('admin') || agentId.includes('Admin')) {
            return 'Admin User';
        }
        
        // For agent IDs, try to extract a readable name
        if (agentId.includes('agent') || agentId.includes('Agent')) {
            return 'Agent User';
        }
        
        // For email-like IDs, extract the local part
        if (agentId.includes('@')) {
            const localPart = agentId.split('@')[0];
            // Capitalize first letter and replace underscores/dots with spaces
            return localPart.charAt(0).toUpperCase() + localPart.slice(1).replace(/[_.-]/g, ' ');
        }
        
        // Default: capitalize and clean up the ID
        return agentId.charAt(0).toUpperCase() + agentId.slice(1).replace(/[_.-]/g, ' ');
    }

    /**
     * Update agent personal status (online/afk) with database persistence
     */
    async updateAgentPersonalStatus(agentId, personalStatus, includeActiveChats = false) {
        try {
            // Get or create user for this agent
            const user = await this.getOrCreateAgentUser(agentId);
            
            // Count active chats for this agent if requested
            const activeChats = includeActiveChats ? await this.getAgentActiveChatsCount(agentId) : 0;
            
            // Update agent status in database
            const agentStatus = await prisma.agentStatus.upsert({
                where: { userId: user.id },
                update: {
                    status: personalStatus === 'online' ? 'online' : personalStatus === 'afk' ? 'busy' : 'offline',
                    updatedAt: new Date()
                },
                create: {
                    userId: user.id,
                    status: personalStatus === 'online' ? 'online' : personalStatus === 'afk' ? 'busy' : 'offline'
                },
                include: {
                    user: true
                }
            });
            
            // Return agent data in expected format
            const agent = {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                status: this.mapStatusToLegacy(agentStatus.status),
                personalStatus: personalStatus,
                lastSeen: agentStatus.updatedAt,
                activeChats: activeChats,
                connected: personalStatus !== 'offline',
                userId: user.id
            };
            
            return agent;
        } catch (error) {
            console.error('Failed to update agent personal status:', error);
            // Return a basic agent object for compatibility
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                status: personalStatus === 'online' ? 'online' : 'offline',
                personalStatus: personalStatus,
                lastSeen: new Date(),
                activeChats: 0,
                connected: personalStatus !== 'offline'
            };
        }
    }

    /**
     * Legacy method for backward compatibility
     */
    async updateAgentStatus(agentId, status, includeActiveChats = false) {
        return this.updateAgentPersonalStatus(agentId, status, includeActiveChats);
    }

    /**
     * Get agent by ID from database
     */
    async getAgent(agentId) {
        try {
            const user = await this.findAgentUser(agentId, true);
            
            if (!user) return null;
            
            return await this.mapUserToAgent(user);
        } catch (error) {
            console.error('Failed to get agent:', error);
            return null;
        }
    }

    /**
     * Get all agents from database
     */
    async getAllAgents() {
        try {
            const users = await prisma.user.findMany({
                where: {
                    role: { in: ['agent', 'admin'] }
                },
                include: {
                    agentStatus: true
                },
                orderBy: { createdAt: 'asc' }
            });
            
            return Promise.all(users.map(user => this.mapUserToAgent(user)));
        } catch (error) {
            console.error('Failed to get all agents:', error);
            return [];
        }
    }

    /**
     * Get available agents (connected and not AFK)
     */
    async getAvailableAgents() {
        try {
            const users = await this.findActiveAgents(['online']);
            
            return Promise.all(users.map(user => this.mapUserToAgent(user)));
        } catch (error) {
            console.error('Failed to get available agents:', error);
            return [];
        }
    }

    /**
     * Get active agents (legacy - for backward compatibility)
     */
    async getActiveAgents() {
        return this.getAvailableAgents();
    }

    /**
     * Get online agents (HITL and Autopilot modes)
     */
    async getOnlineAgents() {
        try {
            const users = await this.findActiveAgents(['online', 'busy']);
            
            return Promise.all(users.map(user => this.mapUserToAgent(user)));
        } catch (error) {
            console.error('Failed to get online agents:', error);
            return [];
        }
    }

    /**
     * Set agent as online with socket info
     */
    async setAgentOnline(agentId, socketId = null, includeActiveChats = false) {
        try {
            const agent = await this.updateAgentPersonalStatus(agentId, 'online', includeActiveChats);
            agent.socketId = socketId;
            return agent;
        } catch (error) {
            console.error('Failed to set agent online:', error);
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                status: 'online',
                lastSeen: new Date(),
                socketId: socketId,
                activeChats: 0
            };
        }
    }

    /**
     * Set agent as offline (cleanup)
     */
    async setAgentOffline(agentId) {
        try {
            const user = await this.getOrCreateAgentUser(agentId);
            
            const agentStatus = await prisma.agentStatus.upsert({
                where: { userId: user.id },
                update: {
                    status: 'offline',
                    updatedAt: new Date()
                },
                create: {
                    userId: user.id,
                    status: 'offline'
                }
            });
            
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                connected: false,
                personalStatus: 'offline',
                status: 'offline',
                lastSeen: agentStatus.updatedAt,
                userId: user.id
            };
        } catch (error) {
            console.error('Failed to set agent offline:', error);
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                connected: false,
                personalStatus: 'offline',
                status: 'offline',
                lastSeen: new Date()
            };
        }
    }

    /**
     * Get best available agent for new conversation (simplified)
     */
    async getBestAvailableAgent() {
        try {
            const availableAgents = await this.getAvailableAgents();
            
            if (availableAgents.length === 0) {
                return null;
            }
            
            // Simple: return first available agent
            return availableAgents[0];
        } catch (error) {
            console.error('Failed to get best available agent:', error);
            return null;
        }
    }

    /**
     * Get global system mode from database
     */
    async getSystemMode() {
        try {
            const setting = await prisma.systemSetting.findUnique({
                where: { key: 'system_mode' }
            });
            return setting?.value || 'hitl';
        } catch (error) {
            throw handleServiceError(error, 'getSystemMode');
        }
    }

    /**
     * Set global system mode in database
     */
    async setSystemMode(mode) {
        if (!['hitl', 'autopilot', 'off'].includes(mode)) {
            throw createError.validation(`Invalid system mode: ${mode}. Must be 'hitl', 'autopilot', or 'off'`);
        }
        
        try {
            await prisma.systemSetting.upsert({
                where: { key: 'system_mode' },
                update: { 
                    value: mode,
                    updatedBy: 'system' // Could be replaced with actual user ID
                },
                create: {
                    key: 'system_mode',
                    value: mode,
                    updatedBy: 'system'
                }
            });
            return true;
        } catch (error) {
            throw handleServiceError(error, 'setSystemMode');
        }
    }

    /**
     * Get connected agents (for display)
     */
    async getConnectedAgents() {
        try {
            const users = await this.findActiveAgents(['online', 'busy']);
            
            return Promise.all(users.map(user => this.mapUserToAgent(user)));
        } catch (error) {
            console.error('Failed to get connected agents:', error);
            return [];
        }
    }

    /**
     * Handle agent going AFK - simplified (no automatic reassignment)
     */
    async handleAgentAFK(agentId, conversationService) {
        // Simplified: just return empty array, no automatic reassignment
        return [];
    }

    /**
     * Handle agent coming back online - simplified (no automatic reclaiming)
     */
    async handleAgentBackOnline(agentId, conversationService) {
        // Simplified: just return empty array, no automatic reclaiming
        return [];
    }

    /**
     * Redistribute orphaned tickets - simplified (disabled)
     */
    async redistributeOrphanedTickets(conversationService, maxTicketsPerAgent = 3) {
        // Simplified: disabled automatic redistribution
        return [];
    }


    /**
     * Update agent's last seen timestamp
     */
    async updateLastSeen(agentId) {
        try {
            const user = await this.getOrCreateAgentUser(agentId);
            
            const agentStatus = await prisma.agentStatus.upsert({
                where: { userId: user.id },
                update: { updatedAt: new Date() },
                create: {
                    userId: user.id,
                    status: 'offline'
                }
            });
            
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                lastSeen: agentStatus.updatedAt,
                userId: user.id
            };
        } catch (error) {
            console.error('Failed to update last seen:', error);
            return null;
        }
    }

    /**
     * Get agent count
     */
    async getAgentCount() {
        try {
            return await prisma.user.count({
                where: {
                    role: { in: ['agent', 'admin'] }
                }
            });
        } catch (error) {
            console.error('Failed to get agent count:', error);
            return 0;
        }
    }

    /**
     * Clear all agent data (for testing)
     */
    async clearAllData() {
        if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
            throw new Error('clearAllData can only be used in test/development environment');
        }
        
        try {
            // Clear agent status data
            await prisma.agentStatus.deleteMany();
            
            return true;
        } catch (error) {
            console.error('Failed to clear all agent data:', error);
            return false;
        }
    }

    /**
     * Get agent statistics
     */
    async getAgentStats() {
        try {
            const cutoffTime = new Date(Date.now() - 60000); // Active in last minute
            
            const [total, onlineCount, busyCount] = await Promise.all([
                prisma.user.count({ where: { role: { in: ['agent', 'admin'] } } }),
                prisma.agentStatus.count({ 
                    where: { 
                        status: 'online',
                        updatedAt: { gte: cutoffTime }
                    }
                }),
                prisma.agentStatus.count({ 
                    where: { 
                        status: 'busy',
                        updatedAt: { gte: cutoffTime }
                    }
                })
            ]);
            
            const stats = {
                total,
                online: onlineCount,
                busy: busyCount,
                offline: total - onlineCount - busyCount,
                totalActiveChats: 0 // Would need conversation service to calculate this
            };
            
            return stats;
        } catch (error) {
            console.error('Failed to get agent stats:', error);
            return {
                total: 0,
                online: 0,
                busy: 0,
                offline: 0,
                totalActiveChats: 0
            };
        }
    }

    /**
     * Get agent performance metrics
     */
    async getAgentPerformance(agentId, conversationService = null) {
        try {
            const user = await this.getOrCreateAgentUser(agentId);
            
            if (!conversationService) {
                return {
                    agentId: agentId,
                    totalConversations: 0,
                    resolvedConversations: 0,
                    activeConversations: 0,
                    resolutionRate: 0,
                    averageResolutionTime: 0,
                    currentStatus: 'offline',
                    lastActive: new Date()
                };
            }
            
            const agentConversations = await conversationService.getAgentConversations(agentId);
            
            return {
                agentId: agentId,
                totalConversations: agentConversations.length,
                currentStatus: 'online', // Would get from database in real implementation
                lastActive: new Date()
            };
        } catch (error) {
            console.error('Failed to get agent performance:', error);
            return null;
        }
    }

    /**
     * Calculate average resolution time for conversations
     */
    calculateAverageResolutionTime(conversations) {
        // Resolution time tracking removed with status system
        return 0;
    }

    /**
     * Find best available agent for assignment
     */
    async findBestAvailableAgent() {
        try {
            const onlineAgents = await this.getOnlineAgents();
            
            if (onlineAgents.length === 0) return null;
            
            // Sort by least active chats, then by last seen (most recent first)
            onlineAgents.sort((a, b) => {
                if (a.activeChats !== b.activeChats) {
                    return a.activeChats - b.activeChats;
                }
                return new Date(b.lastSeen) - new Date(a.lastSeen);
            });
            
            return onlineAgents[0];
        } catch (error) {
            console.error('Failed to find best available agent:', error);
            return null;
        }
    }

    // HELPER METHODS

    /**
     * Common user lookup pattern for agents - optimized query
     */
    async findAgentUser(agentId, includeAgentStatus = false) {
        const include = includeAgentStatus ? { agentStatus: true } : undefined;
        
        return await prisma.user.findFirst({
            where: {
                OR: [
                    { id: agentId },
                    { email: { contains: agentId } }
                ],
                role: { in: ['agent', 'admin'] }
            },
            include
        });
    }

    /**
     * Common query for active agents with status filtering - optimized
     */
    async findActiveAgents(statusFilter = ['online', 'busy'], minutesAgo = 1) {
        const cutoffTime = new Date(Date.now() - (minutesAgo * 60000));
        
        return await prisma.user.findMany({
            where: {
                role: { in: ['agent', 'admin'] },
                agentStatus: {
                    status: { in: statusFilter },
                    updatedAt: { gte: cutoffTime }
                }
            },
            include: {
                agentStatus: true
            },
            orderBy: { updatedAt: 'desc' }
        });
    }

    /**
     * Get active conversation count for agent directly from database
     */
    async getAgentActiveChatsCount(agentId) {
        try {
            return await prisma.ticket.count({
                where: {
                    assignedAgentId: agentId
                }
            });
        } catch (error) {
            console.error('Failed to get agent active chats count:', error);
            return 0;
        }
    }

    /**
     * Map user database object to agent response format - reduces duplication
     */
    async mapUserToAgent(user, includeActiveChats = false) {
        const agentId = this.getUserAgentId(user);
        let activeChats = 0;
        
        if (includeActiveChats) {
            activeChats = await this.getAgentActiveChatsCount(agentId);
        }
        
        return {
            id: agentId,
            name: this.getAgentDisplayName(agentId),
            status: user.agentStatus ? this.mapStatusToLegacy(user.agentStatus.status) : 'offline',
            personalStatus: user.agentStatus ? this.mapStatusToPersonal(user.agentStatus.status) : 'offline',
            lastSeen: user.agentStatus?.updatedAt || user.updatedAt,
            activeChats,
            connected: user.agentStatus ? user.agentStatus.status !== 'offline' : false,
            userId: user.id
        };
    }

    /**
     * Get or create agent user in database
     */
    async getOrCreateAgentUser(agentId) {
        try {
            // First try to find existing user by agent pattern
            let user = await this.findAgentUser(agentId);
            
            if (!user) {
                // Create new agent user using upsert to avoid duplicates
                const isAdmin = agentId.includes('admin') || agentId.includes('Admin');
                const email = `${agentId}@vilnius.lt`;
                
                const displayName = this.getAgentDisplayName(agentId);
                const nameParts = displayName.split(' ');
                
                user = await prisma.user.upsert({
                    where: { email: email },
                    update: {
                        // Update existing user if found
                        firstName: nameParts[0],
                        lastName: nameParts.slice(1).join(' ') || '',
                        role: isAdmin ? 'admin' : 'agent'
                    },
                    create: {
                        email: email,
                        firstName: nameParts[0],
                        lastName: nameParts.slice(1).join(' ') || '',
                        passwordHash: 'temp', // Should be set by admin
                        role: isAdmin ? 'admin' : 'agent'
                    }
                });
            }
            
            return user;
        } catch (error) {
            console.error('Failed to get or create agent user:', error);
            throw error;
        }
    }

    /**
     * Get agent ID from user object
     */
    getUserAgentId(user) {
        // Extract agent ID from email or use user ID
        if (user.email.includes('@vilnius.lt')) {
            return user.email.split('@')[0];
        }
        return user.id;
    }

    /**
     * Map database status enum to legacy status
     */
    mapStatusToLegacy(dbStatus) {
        const mapping = {
            'online': 'online',
            'busy': 'busy',
            'offline': 'offline'
        };
        return mapping[dbStatus] || 'offline';
    }

    /**
     * Map database status to personal status
     */
    mapStatusToPersonal(dbStatus) {
        const mapping = {
            'online': 'online',
            'busy': 'afk',
            'offline': 'offline'
        };
        return mapping[dbStatus] || 'offline';
    }
}

module.exports = new AgentService();