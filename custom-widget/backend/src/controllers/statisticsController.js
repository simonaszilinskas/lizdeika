/**
 * STATISTICS CONTROLLER
 *
 * Main Purpose: Handle HTTP endpoints for support statistics and analytics
 *
 * Key Responsibilities:
 * - Statistics Retrieval: Fetch and format statistics data for dashboard
 * - Date Range Management: Parse and validate date range parameters
 * - Data Aggregation: Combine multiple statistics for overview endpoints
 * - Access Control: Ensure only agents and admins can access statistics
 *
 * Security Features:
 * - Role-based access control (agents + admins only)
 * - Input validation for date ranges
 * - Error handling for invalid parameters
 *
 * Endpoints:
 * - GET /statistics/dashboard - Combined overview of all key metrics
 * - GET /statistics/conversations - Detailed conversation statistics
 * - GET /statistics/agents - Agent performance and activity
 * - GET /statistics/ai-suggestions - AI suggestion usage patterns
 * - GET /statistics/templates - Template usage analytics
 * - GET /statistics/trends - Time-series data for charts
 *
 * Query Parameters:
 * - startDate: ISO 8601 date string (default: 30 days ago)
 * - endDate: ISO 8601 date string (default: now)
 * - agentId: Filter by specific agent (optional)
 * - category_id: Filter by category (optional)
 * - granularity: 'day' | 'week' | 'month' (for trends)
 * - limit: Number of results (for templates)
 *
 * Dependencies:
 * - Statistics service for all calculations
 * - Auth middleware for role validation
 */

const statisticsService = require('../services/statisticsService');
const { asyncHandler, ValidationError } = require('../utils/errors');

class StatisticsController {
    /**
     * Get dashboard overview with all key metrics
     * @route GET /api/statistics/dashboard?startDate=...&endDate=...
     * @access Agent/Admin
     */
    getDashboardStats = asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.parseDateRange(req.query);

        // Fetch all key metrics in parallel
        const [
            totalConversations,
            conversationStatus,
            agentCounts,
            suggestionUsage,
            templateOverview,
            avgMessages
        ] = await Promise.all([
            statisticsService.getTotalConversations(startDate, endDate),
            statisticsService.getConversationStatus(startDate, endDate),
            statisticsService.getAgentMessageCounts(startDate, endDate),
            statisticsService.getAISuggestionUsage(startDate, endDate),
            statisticsService.getTemplateUsageOverview(startDate, endDate),
            statisticsService.getAverageMessagesPerConversation(startDate, endDate)
        ]);

        // Calculate total messages from agent counts
        const totalMessages = agentCounts.reduce((sum, agent) => sum + agent.messageCount, 0);

        res.json({
            success: true,
            data: {
                conversations: {
                    total: totalConversations,
                    active: conversationStatus.active,
                    archived: conversationStatus.archived
                },
                messages: {
                    total: totalMessages,
                    averagePerConversation: avgMessages
                },
                agents: {
                    activeAgents: agentCounts.length,
                    topAgent: agentCounts[0] || null
                },
                aiSuggestions: suggestionUsage,
                templates: templateOverview
            },
            meta: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                generatedAt: new Date().toISOString()
            }
        });
    });

    /**
     * Get detailed conversation statistics
     * @route GET /api/statistics/conversations?startDate=...&endDate=...&category_id=...
     * @access Agent/Admin
     */
    getConversationStats = asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.parseDateRange(req.query);
        const { category_id, archived } = req.query;

        const filters = {};
        if (category_id) filters.category_id = category_id;
        if (archived !== undefined) filters.archived = archived === 'true';

        const [
            total,
            byCategory,
            status
        ] = await Promise.all([
            statisticsService.getTotalConversations(startDate, endDate, filters),
            statisticsService.getConversationsByCategory(startDate, endDate),
            statisticsService.getConversationStatus(startDate, endDate)
        ]);

        res.json({
            success: true,
            data: {
                total,
                byCategory,
                status
            },
            meta: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                generatedAt: new Date().toISOString()
            }
        });
    });

    /**
     * Get agent performance and activity statistics
     * @route GET /api/statistics/agents?startDate=...&endDate=...&agentId=...
     * @access Agent/Admin
     */
    getAgentStats = asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.parseDateRange(req.query);
        const { agentId } = req.query;

        if (agentId) {
            // Get detailed stats for specific agent
            const [
                agentDetails,
                suggestionBreakdown,
                templateUsage
            ] = await Promise.all([
                statisticsService.getAgentActivityDetails(agentId, startDate, endDate),
                statisticsService.getAgentSuggestionBreakdown(agentId, startDate, endDate),
                statisticsService.getTemplateUsageByAgent(agentId, startDate, endDate)
            ]);

            res.json({
                success: true,
                data: {
                    agent: agentDetails,
                    suggestions: suggestionBreakdown,
                    templates: templateUsage
                },
                meta: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString()
                }
            });
        } else {
            // Get all agents ranking and overview
            const [
                messageCounts,
                activityDetails
            ] = await Promise.all([
                statisticsService.getAgentMessageCounts(startDate, endDate),
                statisticsService.getAgentActivityDetails(null, startDate, endDate)
            ]);

            // Merge message counts with activity details
            const agents = messageCounts.map(agent => {
                const details = activityDetails.find(d => d.agentId === agent.agentId);
                return {
                    ...agent,
                    suggestionUsage: details?.suggestionUsagePercentage || 0,
                    templateUsage: details?.templateUsagePercentage || 0
                };
            });

            res.json({
                success: true,
                data: { agents },
                meta: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString()
                }
            });
        }
    });

    /**
     * Get AI suggestion usage statistics (HITL mode only)
     * @route GET /api/statistics/ai-suggestions?startDate=...&endDate=...&agentId=...
     * @access Agent/Admin
     */
    getAISuggestionStats = asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.parseDateRange(req.query);
        const { agentId } = req.query;

        if (agentId) {
            // Get agent-specific breakdown
            const breakdown = await statisticsService.getAgentSuggestionBreakdown(
                agentId,
                startDate,
                endDate
            );

            res.json({
                success: true,
                data: breakdown,
                meta: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString()
                }
            });
        } else {
            // Get overall usage
            const usage = await statisticsService.getAISuggestionUsage(startDate, endDate);

            res.json({
                success: true,
                data: usage,
                meta: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString(),
                    note: 'Statistics include HITL mode only (excludes autopilot)'
                }
            });
        }
    });

    /**
     * Get template usage statistics
     * @route GET /api/statistics/templates?startDate=...&endDate=...&agentId=...&limit=10
     * @access Agent/Admin
     */
    getTemplateStats = asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.parseDateRange(req.query);
        const { agentId, limit = '10' } = req.query;
        const parsed = parseInt(limit, 10);
        const limitNum = Math.min(Number.isFinite(parsed) ? parsed : 10, 50); // Max 50 templates

        if (agentId) {
            // Get agent-specific template usage
            const templates = await statisticsService.getTemplateUsageByAgent(
                agentId,
                startDate,
                endDate
            );

            res.json({
                success: true,
                data: { templates },
                meta: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString()
                }
            });
        } else {
            // Get overall template usage
            const [
                overview,
                topTemplates
            ] = await Promise.all([
                statisticsService.getTemplateUsageOverview(startDate, endDate),
                statisticsService.getMostPopularTemplates(startDate, endDate, limitNum)
            ]);

            res.json({
                success: true,
                data: {
                    overview,
                    topTemplates
                },
                meta: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString()
                }
            });
        }
    });

    /**
     * Get time-series trend data for charts
     * @route GET /api/statistics/trends?startDate=...&endDate=...&granularity=day
     * @access Agent/Admin
     */
    getTrendStats = asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.parseDateRange(req.query);
        const { granularity = 'day' } = req.query;

        // Validate granularity
        const validGranularities = ['day', 'week', 'month'];
        if (!validGranularities.includes(granularity)) {
            return res.status(400).json({
                success: false,
                error: `Invalid granularity. Must be one of: ${validGranularities.join(', ')}`
            });
        }

        const [
            conversationTrends,
            peakHours
        ] = await Promise.all([
            statisticsService.getConversationTrends(startDate, endDate, granularity),
            statisticsService.getPeakHoursAnalysis(startDate, endDate)
        ]);

        res.json({
            success: true,
            data: {
                conversationTrends,
                peakHours
            },
            meta: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                granularity,
                generatedAt: new Date().toISOString()
            }
        });
    });

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Parse and validate date range from query parameters
     * @param {Object} query - Request query parameters
     * @returns {Object} {startDate, endDate}
     */
    parseDateRange(query) {
        const { startDate: startDateStr, endDate: endDateStr } = query;

        let startDate, endDate;

        // Parse start date or default to 30 days ago
        if (startDateStr) {
            startDate = new Date(startDateStr);
            if (isNaN(startDate.getTime())) {
                throw new ValidationError('Invalid startDate format. Use ISO 8601 format.');
            }
        } else {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
        }

        // Parse end date or default to now
        if (endDateStr) {
            endDate = new Date(endDateStr);
            if (isNaN(endDate.getTime())) {
                throw new ValidationError('Invalid endDate format. Use ISO 8601 format.');
            }
        } else {
            endDate = new Date();
        }

        // Normalize to UTC day boundaries
        startDate.setUTCHours(0, 0, 0, 0);
        endDate.setUTCHours(23, 59, 59, 999);

        // Validate date range
        if (startDate > endDate) {
            throw new ValidationError('startDate must be before endDate');
        }

        // Prevent excessively long date ranges (more than 1 year)
        const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > 365) {
            throw new ValidationError('Date range cannot exceed 365 days');
        }

        return { startDate, endDate };
    }
}

module.exports = new StatisticsController();
