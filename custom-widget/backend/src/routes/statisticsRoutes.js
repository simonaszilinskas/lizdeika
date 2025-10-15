/**
 * Statistics Routes
 * Endpoints for support operations analytics and reporting
 *
 * All routes require authentication and agent/admin role
 * Statistics include:
 * - Conversation metrics and trends
 * - Agent performance and rankings
 * - AI suggestion usage (HITL mode only)
 * - Template popularity and adoption
 */

const express = require('express');
const statisticsController = require('../controllers/statisticsController');
const { authenticateToken, requireAgentOrAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication and agent/admin role
router.use(authenticateToken);
router.use(requireAgentOrAdmin);

/**
 * @route GET /api/statistics/dashboard
 * @desc Get combined overview of all key metrics
 * @access Agent/Admin
 * @query {string} startDate - Start of date range (ISO 8601, optional, default: 30 days ago)
 * @query {string} endDate - End of date range (ISO 8601, optional, default: now)
 * @returns {Object} Dashboard overview with conversations, messages, agents, AI, and template stats
 */
router.get('/dashboard', statisticsController.getDashboardStats);

/**
 * @route GET /api/statistics/conversations
 * @desc Get detailed conversation statistics
 * @access Agent/Admin
 * @query {string} startDate - Start of date range (ISO 8601)
 * @query {string} endDate - End of date range (ISO 8601)
 * @query {string} category_id - Filter by category ID (optional)
 * @query {boolean} archived - Filter by archived status (optional)
 * @returns {Object} Conversation metrics including total, by category, and status breakdown
 */
router.get('/conversations', statisticsController.getConversationStats);

/**
 * @route GET /api/statistics/agents
 * @desc Get agent performance and activity statistics
 * @access Agent/Admin
 * @query {string} startDate - Start of date range (ISO 8601)
 * @query {string} endDate - End of date range (ISO 8601)
 * @query {string} agentId - Get stats for specific agent (optional)
 * @returns {Object} Agent rankings, message counts, and usage patterns
 */
router.get('/agents', statisticsController.getAgentStats);

/**
 * @route GET /api/statistics/ai-suggestions
 * @desc Get AI suggestion usage patterns (HITL mode only)
 * @access Agent/Admin
 * @query {string} startDate - Start of date range (ISO 8601)
 * @query {string} endDate - End of date range (ISO 8601)
 * @query {string} agentId - Get stats for specific agent (optional)
 * @returns {Object} AI suggestion breakdown: sent as-is, edited, from-scratch percentages
 * @note Only includes suggestions from HITL mode, excludes autopilot
 */
router.get('/ai-suggestions', statisticsController.getAISuggestionStats);

/**
 * @route GET /api/statistics/templates
 * @desc Get template usage analytics
 * @access Agent/Admin
 * @query {string} startDate - Start of date range (ISO 8601)
 * @query {string} endDate - End of date range (ISO 8601)
 * @query {string} agentId - Get stats for specific agent (optional)
 * @query {number} limit - Number of top templates to return (default: 10, max: 50)
 * @returns {Object} Template usage overview and most popular templates
 */
router.get('/templates', statisticsController.getTemplateStats);

/**
 * @route GET /api/statistics/trends
 * @desc Get time-series trend data for charts
 * @access Agent/Admin
 * @query {string} startDate - Start of date range (ISO 8601)
 * @query {string} endDate - End of date range (ISO 8601)
 * @query {string} granularity - Time grouping: 'day', 'week', or 'month' (default: 'day')
 * @returns {Object} Conversation trends over time and peak activity hours
 */
router.get('/trends', statisticsController.getTrendStats);

module.exports = router;
