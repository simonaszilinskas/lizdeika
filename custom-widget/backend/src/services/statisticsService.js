/**
 * STATISTICS SERVICE
 *
 * Main Purpose: Calculate and aggregate statistics for support operations
 *
 * Key Responsibilities:
 * - Conversation Analytics: Track conversation volumes, trends, and distributions
 * - Agent Performance: Measure agent activity and contribution
 * - AI Usage Metrics: Monitor AI suggestion adoption and effectiveness (HITL only)
 * - Recording: Store message-level statistics for detailed analysis
 *
 * Features:
 * - Date range filtering for all queries
 * - Optimized aggregation queries using Prisma
 * - HITL-only AI tracking (excludes autopilot mode)
 * - Efficient indexing for performance
 *
 * Notes:
 * - Statistics accumulate from implementation date (no historical backfill)
 * - All date comparisons use UTC timezone
 * - System mode filtering ensures accurate AI metrics
 */

const databaseClient = require('../utils/database');
const agentService = require('./agentService');
let prisma;

class StatisticsService {
    constructor() {
        // Defer Prisma initialization until first use
    }

    // ========================================================================
    // CONVERSATION STATISTICS
    // ========================================================================

    /**
     * Get total conversation count with optional filters
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @param {Object} filters - Optional filters (category_id, archived)
     * @returns {Promise<number>} Total conversation count
     */
    async getTotalConversations(startDate, endDate, filters = {}) {
        if (!prisma) prisma = databaseClient.getClient();

        const whereConditions = {
            created_at: {
                gte: startDate,
                lte: endDate
            }
        };

        // Apply optional filters
        if (filters.category_id) {
            whereConditions.category_id = filters.category_id;
        }
        if (typeof filters.archived === 'boolean') {
            whereConditions.archived = filters.archived;
        }

        return await prisma.tickets.count({
            where: whereConditions
        });
    }

    /**
     * Get conversation counts grouped by category
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @returns {Promise<Array>} Array of {category, count}
     */
    async getConversationsByCategory(startDate, endDate) {
        if (!prisma) prisma = databaseClient.getClient();

        const results = await prisma.tickets.groupBy({
            by: ['category_id'],
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _count: {
                id: true
            }
        });

        // Fetch category details for non-null category_ids
        const categoryIds = results
            .filter(r => r.category_id)
            .map(r => r.category_id);

        const categories = await prisma.ticket_categories.findMany({
            where: {
                id: { in: categoryIds }
            },
            select: {
                id: true,
                name: true,
                color: true
            }
        });

        const categoryMap = Object.fromEntries(
            categories.map(c => [c.id, c])
        );

        return results.map(result => ({
            category: result.category_id ? categoryMap[result.category_id] : { name: 'Uncategorized', color: '#6B7280' },
            count: result._count.id
        }));
    }

    /**
     * Get conversation volume trends over time
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @param {String} granularity - 'day' | 'week' | 'month'
     * @returns {Promise<Array>} Array of {date, count}
     */
    async getConversationTrends(startDate, endDate, granularity = 'day') {
        if (!prisma) prisma = databaseClient.getClient();

        // Get all conversations in range
        const conversations = await prisma.tickets.findMany({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                created_at: true
            }
        });

        // Group by date based on granularity
        const dateMap = new Map();

        conversations.forEach(conv => {
            let dateKey;
            const date = new Date(conv.created_at);

            if (granularity === 'day') {
                dateKey = date.toISOString().split('T')[0];
            } else if (granularity === 'week') {
                const weekStart = new Date(date);
                weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
                dateKey = weekStart.toISOString().split('T')[0];
            } else if (granularity === 'month') {
                dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
        });

        return Array.from(dateMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Get archived vs active conversation counts
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @returns {Promise<Object>} {active, archived}
     */
    async getConversationStatus(startDate, endDate) {
        if (!prisma) prisma = databaseClient.getClient();

        const [active, archived] = await Promise.all([
            prisma.tickets.count({
                where: {
                    created_at: {
                        gte: startDate,
                        lte: endDate
                    },
                    archived: false
                }
            }),
            prisma.tickets.count({
                where: {
                    created_at: {
                        gte: startDate,
                        lte: endDate
                    },
                    archived: true
                }
            })
        ]);

        return { active, archived };
    }

    // ========================================================================
    // AGENT STATISTICS
    // ========================================================================

    /**
     * Get message count per agent (ranking)
     * Uses message_statistics table for accurate agent attribution
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @returns {Promise<Array>} Array of {agentId, name, messageCount, percentage}
     */
    async getAgentMessageCounts(startDate, endDate) {
        if (!prisma) prisma = databaseClient.getClient();

        // Use message_statistics table which has agent_id properly set
        const agentMessages = await prisma.message_statistics.groupBy({
            by: ['agent_id'],
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _count: {
                id: true
            }
        });

        // Get total messages for percentage calculation
        const totalMessages = await prisma.message_statistics.count({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        // Fetch agent details
        const agentIds = agentMessages.map(am => am.agent_id);
        const agents = await prisma.users.findMany({
            where: {
                id: { in: agentIds }
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
            }
        });

        const agentMap = Object.fromEntries(
            agents.map(a => [a.id, a])
        );

        const result = agentMessages
            .map(am => {
                const agent = agentMap[am.agent_id];
                return {
                    agentId: am.agent_id,
                    name: agent ? `${agent.first_name} ${agent.last_name}` : 'Unknown',
                    email: agent?.email,
                    messageCount: am._count.id,
                    percentage: totalMessages > 0 ? (am._count.id / totalMessages) * 100 : 0
                };
            });

        return result.sort((a, b) => b.messageCount - a.messageCount);
    }

    /**
     * Get detailed agent activity including suggestion usage
     * @param {String} agentId - Specific agent or null for all
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @returns {Promise<Object|Array>} Agent activity details
     */
    async getAgentActivityDetails(agentId = null, startDate, endDate) {
        if (!prisma) prisma = databaseClient.getClient();

        const whereConditions = {
            created_at: {
                gte: startDate,
                lte: endDate
            }
        };

        if (agentId) {
            whereConditions.agent_id = agentId;
        }

        const stats = await prisma.message_statistics.findMany({
            where: whereConditions,
            include: {
                agent: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                }
            }
        });

        // Group by agent
        const agentStatsMap = new Map();

        stats.forEach(stat => {
            const agentKey = stat.agent_id;
            if (!agentStatsMap.has(agentKey)) {
                agentStatsMap.set(agentKey, {
                    agentId: stat.agent_id,
                    name: `${stat.agent.first_name} ${stat.agent.last_name}`,
                    email: stat.agent.email,
                    totalMessages: 0,
                    aiSuggestionUsed: 0,
                    sentAsIs: 0,
                    edited: 0,
                    fromScratch: 0
                });
            }

            const agentStats = agentStatsMap.get(agentKey);
            agentStats.totalMessages++;

            if (stat.ai_suggestion_used) {
                agentStats.aiSuggestionUsed++;
                if (stat.suggestion_action === 'sent_as_is') agentStats.sentAsIs++;
                else if (stat.suggestion_action === 'edited') agentStats.edited++;
                else if (stat.suggestion_action === 'from_scratch') agentStats.fromScratch++;
            }
        });

        const result = Array.from(agentStatsMap.values()).map(agentStats => ({
            ...agentStats,
            suggestionUsagePercentage: agentStats.aiSuggestionUsed > 0
                ? (agentStats.aiSuggestionUsed / agentStats.totalMessages) * 100
                : 0
        }));

        return agentId ? result[0] : result;
    }

    // ========================================================================
    // AI SUGGESTION STATISTICS
    // ========================================================================

    /**
     * Get AI suggestion usage breakdown (HITL mode only)
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @returns {Promise<Object>} Suggestion usage breakdown
     */
    async getAISuggestionUsage(startDate, endDate) {
        if (!prisma) prisma = databaseClient.getClient();

        // Only count HITL mode suggestions
        const stats = await prisma.message_statistics.findMany({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                },
                system_mode: 'hitl',
                ai_suggestion_used: true
            },
            select: {
                suggestion_action: true
            }
        });

        const totalSuggestions = stats.length;
        const sentAsIs = stats.filter(s => s.suggestion_action === 'sent_as_is').length;
        const edited = stats.filter(s => s.suggestion_action === 'edited').length;
        const fromScratch = stats.filter(s => s.suggestion_action === 'from_scratch').length;

        return {
            totalSuggestions,
            sentAsIs,
            sentAsIsPercentage: totalSuggestions > 0 ? (sentAsIs / totalSuggestions) * 100 : 0,
            edited,
            editedPercentage: totalSuggestions > 0 ? (edited / totalSuggestions) * 100 : 0,
            fromScratch,
            fromScratchPercentage: totalSuggestions > 0 ? (fromScratch / totalSuggestions) * 100 : 0
        };
    }

    /**
     * Get suggestion usage by agent
     * @param {String} agentId - Agent ID
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @returns {Promise<Object>} Agent-specific suggestion breakdown
     */
    async getAgentSuggestionBreakdown(agentId, startDate, endDate) {
        if (!prisma) prisma = databaseClient.getClient();

        const stats = await prisma.message_statistics.findMany({
            where: {
                agent_id: agentId,
                created_at: {
                    gte: startDate,
                    lte: endDate
                },
                system_mode: 'hitl',
                ai_suggestion_used: true
            },
            select: {
                suggestion_action: true,
                suggestion_edit_ratio: true
            }
        });

        const totalSuggestions = stats.length;
        const sentAsIs = stats.filter(s => s.suggestion_action === 'sent_as_is').length;
        const edited = stats.filter(s => s.suggestion_action === 'edited').length;
        const fromScratch = stats.filter(s => s.suggestion_action === 'from_scratch').length;

        // Calculate average edit ratio for edited suggestions
        const editedStats = stats.filter(s => s.suggestion_action === 'edited' && s.suggestion_edit_ratio !== null);
        const averageEditRatio = editedStats.length > 0
            ? editedStats.reduce((sum, s) => sum + s.suggestion_edit_ratio, 0) / editedStats.length
            : 0;

        return {
            agentId,
            totalSuggestions,
            sentAsIs,
            sentAsIsPercentage: totalSuggestions > 0 ? (sentAsIs / totalSuggestions) * 100 : 0,
            edited,
            editedPercentage: totalSuggestions > 0 ? (edited / totalSuggestions) * 100 : 0,
            fromScratch,
            fromScratchPercentage: totalSuggestions > 0 ? (fromScratch / totalSuggestions) * 100 : 0,
            averageEditRatio: averageEditRatio * 100 // Convert to percentage
        };
    }

    // ========================================================================
    // ADDITIONAL METRICS
    // ========================================================================

    /**
     * Get peak activity hours/days
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @returns {Promise<Object>} Distribution of messages by hour and day
     */
    async getPeakHoursAnalysis(startDate, endDate) {
        if (!prisma) prisma = databaseClient.getClient();

        const messages = await prisma.messages.findMany({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                },
                senderType: { in: ['agent', 'user'] }
            },
            select: {
                created_at: true
            }
        });

        const hourCounts = new Array(24).fill(0);
        const dayCounts = new Array(7).fill(0);

        messages.forEach(msg => {
            const date = new Date(msg.created_at);
            const hour = date.getUTCHours();
            const day = date.getUTCDay();

            if (hour >= 0 && hour < 24) hourCounts[hour]++;
            if (day >= 0 && day < 7) dayCounts[day]++;
        });

        return {
            byHour: hourCounts.map((count, hour) => ({ hour, count })),
            byDay: dayCounts.map((count, day) => ({
                day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
                count
            }))
        };
    }

    /**
     * Get total messages and average per conversation
     * Filters by message creation date (not ticket creation date) to accurately
     * reflect messages sent during the requested time period.
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @returns {Promise<Object>} {total: number, average: number}
     */
    async getTotalMessagesAndAverage(startDate, endDate) {
        if (!prisma) prisma = databaseClient.getClient();

        // Count total messages sent during the date range
        const totalMessages = await prisma.messages.count({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        // Get unique conversation IDs that had messages during the date range
        const conversationsWithMessages = await prisma.messages.findMany({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                ticket_id: true
            },
            distinct: ['ticket_id']
        });

        const conversationCount = conversationsWithMessages.length;

        if (conversationCount === 0) {
            return { total: 0, average: 0 };
        }

        return {
            total: totalMessages,
            average: totalMessages / conversationCount
        };
    }

    /**
     * Get average messages per conversation
     * @param {Date} startDate - Start of date range
     * @param {Date} endDate - End of date range
     * @returns {Promise<number>} Average messages per conversation
     */
    async getAverageMessagesPerConversation(startDate, endDate) {
        const result = await this.getTotalMessagesAndAverage(startDate, endDate);
        return result.average;
    }

    // ========================================================================
    // RECORDING FUNCTIONS
    // ========================================================================

    /**
     * Record message statistics when agent sends a message
     * @param {Object} data - Message statistics data
     * @returns {Promise<Object>} Created message statistics record
     */
    async recordMessageStatistics(data) {
        if (!prisma) prisma = databaseClient.getClient();

        const {
            messageId,
            agentId,
            ticketId,
            aiSuggestionUsed = false,
            suggestionAction = null,
            suggestionEditRatio = null,
            originalSuggestion = null,
            templateUsed = false,
            templateId = null,
            systemMode
        } = data;

        return await prisma.message_statistics.create({
            data: {
                message_id: messageId,
                agent_id: agentId,
                ticket_id: ticketId,
                ai_suggestion_used: aiSuggestionUsed,
                suggestion_action: suggestionAction,
                suggestion_edit_ratio: suggestionEditRatio,
                original_suggestion: originalSuggestion,
                template_used: templateUsed,
                template_id: templateId,
                system_mode: systemMode
            }
        });
    }

    /**
     * Determine current system mode (hitl/autopilot/off)
     * @returns {Promise<String>} Current system mode
     */
    async getCurrentSystemMode() {
        try {
            return await agentService.getSystemMode();
        } catch (error) {
            console.error('Error getting system mode:', error);
            return 'hitl';
        }
    }
}

module.exports = new StatisticsService();
