/**
 * DASHBOARD STATS SERVICE
 *
 * Aggregates operational metrics for the agent/admin dashboard.
 * Provides conversation, messaging, AI suggestion, and template usage insights.
 */
const { PrismaClient } = require('@prisma/client');

class DashboardStatsService {
    constructor(prismaClient = null) {
        this.prisma = prismaClient || new PrismaClient();
    }

    /**
     * Build display name from user record.
     */
    buildAgentDisplayName(agent) {
        if (!agent) return 'Nežinomas agentas';
        const parts = [agent.first_name, agent.last_name].filter(Boolean);
        if (parts.length) {
            return parts.join(' ');
        }
        return agent.email || agent.id;
    }

    /**
     * Extract template metadata from message JSON payload.
     */
    extractTemplateMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') {
            return null;
        }

        const attribution = metadata.responseAttribution || {};
        const directTemplate = metadata.template || metadata.usedTemplate || attribution.template || attribution.usedTemplate;

        const possibleId = metadata.templateId || attribution.templateId || (directTemplate && directTemplate.id);
        const possibleName = metadata.templateName || attribution.templateName || (directTemplate && (directTemplate.name || directTemplate.title)) || (typeof directTemplate === 'string' ? directTemplate : null);

        if (!possibleId && !possibleName) {
            return null;
        }

        const templateId = possibleId || (possibleName ? possibleName.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') : 'unknown-template');
        const templateName = possibleName || templateId;

        return { templateId, templateName };
    }

    clampPercentage(value) {
        if (!Number.isFinite(value)) return 0;
        if (value < 0) return 0;
        if (value > 100) return 100;
        return Number(value.toFixed(1));
    }

    /**
     * Aggregate statistics for dashboard view.
     */
    async getAgentDashboardStats(options = {}) {
        const rangeDays = Number.isFinite(options.rangeDays) && options.rangeDays > 0 ? options.rangeDays : 30;
        const now = new Date();
        const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const activeAgentCutoff = new Date(now.getTime() - 5 * 60 * 1000);

        const agentMessageBaseWhere = {
            senderType: 'agent',
            sender_id: { not: null },
            NOT: [
                { metadata: { path: ['responseAttribution', 'responseType'], equals: 'autopilot' } },
                { metadata: { path: ['isAutopilotResponse'], equals: true } }
            ]
        };

        const agentMessageRangeWhere = {
            ...agentMessageBaseWhere,
            created_at: { gte: rangeStart }
        };

        const agentMessage24hWhere = {
            ...agentMessageBaseWhere,
            created_at: { gte: last24Hours }
        };

        const [
            totalConversations,
            openConversations,
            conversationsLast7Days,
            conversationsLast24Hours,
            conversationsInRange,
            totalMessages,
            messagesLast24Hours,
            customerMessagesLast24Hours,
            agentResponsesLast24Hours,
            totalAgentMessagesInRange,
            agentMessageGroups,
            asIsCount,
            editedCount,
            fromScratchCount,
            suggestionsGeneratedTotal,
            suggestionsGeneratedInRange,
            suggestionsGeneratedLast7Days,
            suggestionsGeneratedLast24Hours,
            templateMetadata,
            activeAgentsCount
        ] = await Promise.all([
            this.prisma.tickets.count(),
            this.prisma.tickets.count({ where: { archived: false } }),
            this.prisma.tickets.count({ where: { created_at: { gte: last7Days } } }),
            this.prisma.tickets.count({ where: { created_at: { gte: last24Hours } } }),
            this.prisma.tickets.count({ where: { created_at: { gte: rangeStart } } }),
            this.prisma.messages.count({ where: { senderType: { in: ['user', 'agent'] } } }),
            this.prisma.messages.count({ where: { created_at: { gte: last24Hours }, senderType: { in: ['user', 'agent'] } } }),
            this.prisma.messages.count({ where: { created_at: { gte: last24Hours }, senderType: 'user' } }),
            this.prisma.messages.count({ where: agentMessage24hWhere }),
            this.prisma.messages.count({ where: agentMessageRangeWhere }),
            this.prisma.messages.groupBy({
                by: ['sender_id'],
                where: agentMessageRangeWhere,
                _count: { _all: true },
                _max: { created_at: true }
            }),
            this.prisma.messages.count({
                where: {
                    ...agentMessageRangeWhere,
                    metadata: { path: ['suggestionAction'], equals: 'as-is' }
                }
            }),
            this.prisma.messages.count({
                where: {
                    ...agentMessageRangeWhere,
                    metadata: { path: ['suggestionAction'], equals: 'edited' }
                }
            }),
            this.prisma.messages.count({
                where: {
                    ...agentMessageRangeWhere,
                    OR: [
                        { metadata: { path: ['suggestionAction'], equals: 'from-scratch' } },
                        { metadata: { path: ['suggestionAction'], equals: 'custom' } }
                    ]
                }
            }),
            this.prisma.messages.count({
                where: {
                    metadata: { path: ['aiSuggestion'], not: null }
                }
            }),
            this.prisma.messages.count({
                where: {
                    created_at: { gte: rangeStart },
                    metadata: { path: ['aiSuggestion'], not: null }
                }
            }),
            this.prisma.messages.count({
                where: {
                    created_at: { gte: last7Days },
                    metadata: { path: ['aiSuggestion'], not: null }
                }
            }),
            this.prisma.messages.count({
                where: {
                    created_at: { gte: last24Hours },
                    metadata: { path: ['aiSuggestion'], not: null }
                }
            }),
            this.prisma.messages.findMany({
                where: agentMessageRangeWhere,
                select: { metadata: true }
            }),
            this.prisma.agent_status.count({
                where: {
                    status: { in: ['online', 'busy'] },
                    updated_at: { gte: activeAgentCutoff }
                }
            })
        ]);

        const agentIds = (agentMessageGroups || [])
            .map((group) => group.sender_id)
            .filter(Boolean);

        const agentDetails = agentIds.length
            ? await this.prisma.users.findMany({
                where: { id: { in: agentIds } },
                select: { id: true, first_name: true, last_name: true, email: true }
            })
            : [];

        const agentLookup = new Map(agentDetails.map((agent) => [agent.id, agent]));

        const leaderboard = (agentMessageGroups || [])
            .filter((group) => group.sender_id)
            .map((group) => {
                const agent = agentLookup.get(group.sender_id);
                const count = group._count?._all || 0;
                const percentage = totalAgentMessagesInRange > 0 ? (count / totalAgentMessagesInRange) * 100 : 0;
                return {
                    agentId: group.sender_id,
                    name: this.buildAgentDisplayName(agent),
                    email: agent?.email || null,
                    count,
                    percentage: this.clampPercentage(percentage),
                    lastMessageAt: group._max?.created_at || null
                };
            })
            .sort((a, b) => b.count - a.count);

        const recordedSuggestionActions = asIsCount + editedCount + fromScratchCount;
        const unknownSuggestionActions = Math.max(totalAgentMessagesInRange - recordedSuggestionActions, 0);

        const suggestionUsage = {
            totals: {
                asIs: asIsCount,
                edited: editedCount,
                fromScratch: fromScratchCount,
                recorded: recordedSuggestionActions,
                withoutMetadata: unknownSuggestionActions
            },
            percentages: {
                asIs: this.clampPercentage(recordedSuggestionActions > 0 ? (asIsCount / recordedSuggestionActions) * 100 : 0),
                edited: this.clampPercentage(recordedSuggestionActions > 0 ? (editedCount / recordedSuggestionActions) * 100 : 0),
                fromScratch: this.clampPercentage(recordedSuggestionActions > 0 ? (fromScratchCount / recordedSuggestionActions) * 100 : 0),
                withoutMetadata: this.clampPercentage(totalAgentMessagesInRange > 0 ? (unknownSuggestionActions / totalAgentMessagesInRange) * 100 : 0)
            },
            adoptionRate: this.clampPercentage(recordedSuggestionActions > 0 ? ((asIsCount + editedCount) / recordedSuggestionActions) * 100 : 0),
            aiSuggestions: {
                range: suggestionsGeneratedInRange,
                last7Days: suggestionsGeneratedLast7Days,
                last24Hours: suggestionsGeneratedLast24Hours,
                allTime: suggestionsGeneratedTotal
            }
        };

        const templateBreakdownMap = new Map();
        for (const record of templateMetadata || []) {
            const info = this.extractTemplateMetadata(record.metadata);
            if (!info) continue;
            const key = info.templateId;
            if (!templateBreakdownMap.has(key)) {
                templateBreakdownMap.set(key, {
                    templateId: info.templateId,
                    templateName: info.templateName,
                    count: 0
                });
            }
            const entry = templateBreakdownMap.get(key);
            entry.count += 1;
        }

        const templateBreakdown = Array.from(templateBreakdownMap.values())
            .sort((a, b) => b.count - a.count)
            .map((entry) => ({
                ...entry,
                percentageOfAgentMessages: this.clampPercentage(totalAgentMessagesInRange > 0 ? (entry.count / totalAgentMessagesInRange) * 100 : 0)
            }));

        const totalTemplateMessages = templateBreakdown.reduce((sum, item) => sum + item.count, 0);
        const templateUsage = {
            totalMessagesUsingTemplates: totalTemplateMessages,
            rate: this.clampPercentage(totalAgentMessagesInRange > 0 ? (totalTemplateMessages / totalAgentMessagesInRange) * 100 : 0),
            breakdown: templateBreakdown
        };

        const averageMessagesPerConversation = totalConversations > 0 ? Number((totalMessages / totalConversations).toFixed(2)) : 0;
        const agentResponsesPerConversationInRange = conversationsInRange > 0 ? Number((totalAgentMessagesInRange / conversationsInRange).toFixed(2)) : 0;

        return {
            generatedAt: now.toISOString(),
            range: {
                days: rangeDays,
                start: rangeStart.toISOString(),
                end: now.toISOString()
            },
            totals: {
                conversations: totalConversations,
                openConversations,
                conversationsLast7Days,
                conversationsLast24Hours,
                messages: totalMessages,
                averageMessagesPerConversation,
                agentResponsesInRange: totalAgentMessagesInRange,
                activeAgents: activeAgentsCount,
                agentResponsesPerConversationInRange,
                suggestionsGeneratedInRange,
                suggestionsGeneratedAllTime: suggestionsGeneratedTotal
            },
            agentLeaderboard: leaderboard,
            suggestionUsage,
            templateUsage,
            activity: {
                newConversationsLast7Days: conversationsLast7Days,
                newConversationsLast24Hours: conversationsLast24Hours,
                messagesLast24Hours,
                customerMessagesLast24Hours,
                agentResponsesLast24Hours,
                aiSuggestionsGeneratedLast24Hours: suggestionsGeneratedLast24Hours
            }
        };
    }
}

module.exports = new DashboardStatsService();
module.exports.DashboardStatsService = DashboardStatsService;
