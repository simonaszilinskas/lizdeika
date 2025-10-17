/**
 * CONVERSATION ROUTES
 * 
 * Main Purpose: Define HTTP route endpoints for customer conversations and message handling
 * 
 * Key Responsibilities:
 * - Route Definition: Map conversation-related URLs to controller methods
 * - Message Flow: Handle customer message submission and AI response generation
 * - Admin Access: Provide administrative endpoints for conversation monitoring
 * - Agent Integration: Support agent assignment and conversation management
 * 
 * Customer Routes:
 * - POST /conversations - Create new conversation
 * - POST /messages - Send customer message and get AI response
 * - GET /conversations/:id/messages - Retrieve conversation history
 * 
 * Agent Routes:
 * - GET /conversations/:id/pending-suggestion - Get AI suggestion for agent
 * - POST /conversations/:id/assign - Assign conversation to agent
 * - POST /conversations/:id/end - End conversation
 * 
 * Admin Routes:
 * - GET /admin/conversations - View all conversations with statistics
 * 
 * Notes:
 * - WebSocket instance enables real-time notifications to agents
 * - Routes handle both customer-facing and agent-facing functionality
 * - Controller manages business logic, routes focus on HTTP mapping
 * - All routes are prefixed with /api when mounted in main application
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const ConversationController = require('../controllers/conversationController');
const { authenticateToken, requireAgentOrAdmin } = require('../middleware/authMiddleware');

/**
 * Rate limiting for customer messages to prevent spam
 *
 * Limits: 10 messages per minute per IP address
 *
 * IP Detection:
 * - Uses req.ip which is validated by Express when trust proxy is enabled (see app.js)
 * - When behind reverse proxy/load balancer, Express parses X-Forwarded-For header
 * - Prevents IP spoofing by trusting only validated proxy headers
 *
 * Limitations:
 * - Users behind same NAT/proxy share the same rate limit bucket (e.g., office networks)
 * - In-memory storage: rate limits reset on server restart
 *
 * TODO: For multi-instance deployments (horizontal scaling), consider using Redis store:
 *   const RedisStore = require('rate-limit-redis');
 *   store: new RedisStore({ client: redisClient })
 */
const customerMessageRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 messages per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many messages. Please wait before sending more.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        // Use req.ip which is validated by Express when trust proxy is enabled
        // This prevents clients from spoofing x-forwarded-for header
        return req.ip || 'unknown';
    }
});

function createConversationRoutes(io) {
    const router = express.Router();
    const conversationController = new ConversationController(io);

    // Create new conversation
    router.post('/conversations', (req, res) => {
        conversationController.createConversation(req, res);
    });

    // Send message and get AI response (with rate limiting)
    router.post('/messages', customerMessageRateLimit, (req, res) => {
        conversationController.sendMessage(req, res);
    });

    // Get conversation history
    router.get('/conversations/:conversationId/messages', (req, res) => {
        conversationController.getMessages(req, res);
    });

    // Admin endpoint to view all conversations
    router.get('/admin/conversations', (req, res) => {
        conversationController.getAllConversations(req, res);
    });

    // Get AI suggestion for a pending message
    router.get('/conversations/:conversationId/pending-suggestion', (req, res) => {
        conversationController.getPendingSuggestion(req, res);
    });

    // Generate new AI suggestion (agent-initiated)
    router.post('/conversations/:conversationId/generate-suggestion', (req, res) => {
        conversationController.generateAISuggestion(req, res);
    });


    // Assign conversation to agent
    router.post('/conversations/:conversationId/assign', (req, res) => {
        conversationController.assignConversation(req, res);
    });

    // Unassign conversation from agent
    router.post('/conversations/:conversationId/unassign', (req, res) => {
        conversationController.unassignConversation(req, res);
    });

    // End conversation
    router.post('/conversations/:conversationId/end', (req, res) => {
        conversationController.endConversation(req, res);
    });

    // Mark messages as seen by agent
    router.post('/conversations/:conversationId/mark-seen', (req, res) => {
        conversationController.markMessagesAsSeen(req, res);
    });

    // Category assignment endpoints (authenticated agents/admins only)
    router.patch('/conversations/:conversationId/category', authenticateToken, requireAgentOrAdmin, (req, res) => {
        conversationController.assignCategory(req, res);
    });

    // Bulk operations (admin-only endpoints)
    router.post('/admin/conversations/bulk-archive', authenticateToken, requireAgentOrAdmin, (req, res) => {
        conversationController.bulkArchiveConversations(req, res);
    });

    router.post('/admin/conversations/bulk-unarchive', authenticateToken, requireAgentOrAdmin, (req, res) => {
        conversationController.bulkUnarchiveConversations(req, res);
    });

    router.post('/admin/conversations/bulk-assign', authenticateToken, requireAgentOrAdmin, (req, res) => {
        conversationController.bulkAssignConversations(req, res);
    });

    router.patch('/admin/conversations/bulk-category', authenticateToken, requireAgentOrAdmin, (req, res) => {
        conversationController.bulkAssignCategory(req, res);
    });

    // AI Auto-Categorization endpoints
    router.post('/conversations/:conversationId/categorize', authenticateToken, requireAgentOrAdmin, (req, res) => {
        conversationController.triggerAutoCategorization(req, res);
    });

    router.get('/categorization/stats', authenticateToken, requireAgentOrAdmin, (req, res) => {
        conversationController.getCategorizationStats(req, res);
    });

    router.post('/admin/categorization/trigger-job', authenticateToken, requireAgentOrAdmin, (req, res) => {
        conversationController.triggerCategorizationJob(req, res);
    });

    router.put('/conversations/:id/category-override', authenticateToken, requireAgentOrAdmin, (req, res) => {
        conversationController.toggleCategoryOverride(req, res);
    });

    return router;
}

module.exports = createConversationRoutes;