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
            const agentStatus = await prisma.agent_status.upsert({
                where: { user_id: user.id },
                update: {
                    status: personalStatus === 'online' ? 'online' : personalStatus === 'afk' ? 'busy' : 'offline',
                    updated_at: new Date()
                },
                create: {
                    id: uuidv4(),
                    user_id: user.id,
                    status: personalStatus === 'online' ? 'online' : personalStatus === 'afk' ? 'busy' : 'offline',
                    updated_at: new Date()
                },
                include: {
                    users: true
                }
            });
            
            // Return agent data in expected format
            const agent = {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                status: this.mapStatusToLegacy(agentStatus.status),
                personalStatus: personalStatus,
                lastSeen: agentStatus.updated_at,
                activeChats: activeChats,
                connected: personalStatus !== 'offline',
                user_id: user.id
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
            const users = await prisma.users.findMany({
                where: {
                    role: { in: ['agent', 'admin'] }
                },
                include: {
                    agent_status: true
                },
                orderBy: { created_at: 'asc' }
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
     * Set agent as online with socket info (simplified: connection = online)
     */
    async setAgentOnline(agentId, socketId = null, includeActiveChats = false) {
        try {
            const user = await this.getOrCreateAgentUser(agentId);
            const activeChats = includeActiveChats ? await this.getAgentActiveChatsCount(agentId) : 0;
            
            await prisma.agent_status.upsert({
                where: { user_id: user.id },
                update: {
                    status: 'online',
                    updated_at: new Date()
                },
                create: {
                    id: uuidv4(),
                    user_id: user.id,
                    status: 'online',
                    updated_at: new Date()
                }
            });
            
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                status: 'online',
                personalStatus: 'online',
                lastSeen: new Date(),
                activeChats: activeChats,
                connected: true,
                socketId: socketId,
                user_id: user.id
            };
        } catch (error) {
            console.error('Failed to set agent online:', error);
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                status: 'online',
                lastSeen: new Date(),
                socketId: socketId,
                activeChats: 0,
                connected: true
            };
        }
    }

    /**
     * Update agent activity timestamp (for heartbeat)
     */
    async updateAgentActivity(agentId) {
        try {
            const user = await this.getOrCreateAgentUser(agentId);
            
            await prisma.agent_status.upsert({
                where: { user_id: user.id },
                update: { 
                    updated_at: new Date(),
                    // Keep current status, just update timestamp
                },
                create: {
                    id: uuidv4(),
                    user_id: user.id,
                    status: 'online',
                    updated_at: new Date()
                }
            });
            
            return true;
        } catch (error) {
            console.error('Failed to update agent activity:', error);
            return false;
        }
    }

    /**
     * Set agent as offline (cleanup) with grace period for reconnections
     */
    async setAgentOffline(agentId) {
        try {
            const user = await this.getOrCreateAgentUser(agentId);
            
            await prisma.agent_status.upsert({
                where: { user_id: user.id },
                update: {
                    status: 'offline',
                    updated_at: new Date()
                },
                create: {
                    id: uuidv4(),
                    user_id: user.id,
                    status: 'offline',
                    updated_at: new Date()
                }
            });
            
            console.log(`🔴 Agent ${agentId} set to offline`);
            
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                status: 'offline',
                personalStatus: 'offline',
                lastSeen: new Date(),
                connected: false,
                user_id: user.id
            };
        } catch (error) {
            console.error('Failed to set agent offline:', error);
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                status: 'offline',
                lastSeen: new Date(),
                connected: false
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
            const setting = await prisma.system_settings.findUnique({
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
            await prisma.system_settings.upsert({
                where: { key: 'system_mode' },
                update: { 
                    value: mode,
                    updated_by: 'system', // Could be replaced with actual user ID
                    updated_at: new Date()
                },
                create: {
                    id: uuidv4(),
                    key: 'system_mode',
                    value: mode,
                    updated_by: 'system',
                    updated_at: new Date()
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
            
            const agentStatus = await prisma.agent_status.upsert({
                where: { user_id: user.id },
                update: { updated_at: new Date() },
                create: {
                    id: uuidv4(),
                    user_id: user.id,
                    status: 'offline',
                    updated_at: new Date()
                }
            });
            
            return {
                id: agentId,
                name: this.getAgentDisplayName(agentId),
                lastSeen: agentStatus.updated_at,
                user_id: user.id
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
            return await prisma.users.count({
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
            await prisma.agent_status.deleteMany();
            
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
                prisma.users.count({ where: { role: { in: ['agent', 'admin'] } } }),
                prisma.agent_status.count({ 
                    where: { 
                        status: 'online',
                        updated_at: { gte: cutoffTime }
                    }
                }),
                prisma.agent_status.count({ 
                    where: { 
                        status: 'busy',
                        updated_at: { gte: cutoffTime }
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
        const include = includeAgentStatus ? { agent_status: true } : undefined;
        
        return await prisma.users.findFirst({
            where: {
                OR: [
                    { id: agentId },
                    { email: agentId }, // Exact email match first
                    { email: { contains: agentId } } // Partial match fallback
                ],
                role: { in: ['agent', 'admin'] }
            },
            include
        });
    }

    /**
     * Common query for active agents with status filtering - optimized
     */
    async findActiveAgents(statusFilter = ['online', 'busy'], minutesAgo = 120) {
        const cutoffTime = new Date(Date.now() - (minutesAgo * 60000));
        
        return await prisma.users.findMany({
            where: {
                role: { in: ['agent', 'admin'] },
                agent_status: {
                    status: { in: statusFilter },
                    updated_at: { gte: cutoffTime }
                }
            },
            include: {
                agent_status: true
            },
            orderBy: { updated_at: 'desc' }
        });
    }

    /**
     * Get active conversation count for agent directly from database
     */
    async getAgentActiveChatsCount(agentId) {
        try {
            return await prisma.tickets.count({
                where: {
                    assigned_agent_id: agentId
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
            status: user.agent_status ? this.mapStatusToLegacy(user.agent_status.status) : 'offline',
            personalStatus: user.agent_status ? this.mapStatusToPersonal(user.agent_status.status) : 'offline',
            lastSeen: user.agent_status?.updated_at || user.updated_at,
            activeChats,
            connected: user.agent_status ? user.agent_status.status !== 'offline' : false,
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
                const email = agentId.includes('@') ? agentId : `${agentId}@vilnius.lt`;
                
                const displayName = this.getAgentDisplayName(agentId);
                const nameParts = displayName.split(' ');
                
                user = await prisma.users.upsert({
                    where: { email: email },
                    update: {
                        // Update existing user if found
                        first_name: nameParts[0],
                        last_name: nameParts.slice(1).join(' ') || '',
                        role: isAdmin ? 'admin' : 'agent'
                    },
                    create: {
                        email: email,
                        first_name: nameParts[0],
                        last_name: nameParts.slice(1).join(' ') || '',
                        password_hash: 'temp', // Should be set by admin
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
        // Use full email as agent ID for consistency
        if (user.email.includes('@vilnius.lt')) {
            return user.email; // Return full email instead of truncated
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