/**
 * System Routes
 * Routes for system-related endpoints (health, config, admin)
 */
const express = require('express');
const SystemController = require('../controllers/systemController');

function createSystemRoutes() {
    const router = express.Router();
    const systemController = new SystemController();

    // Health check
    router.get('/health', (req, res) => {
        systemController.healthCheck(req, res);
    });

    // Get current system prompt configuration
    router.get('/config/system-prompt', (req, res) => {
        systemController.getSystemPrompt(req, res);
    });

    // Update system settings (AI provider, system prompt)
    router.post('/config/settings', (req, res) => {
        systemController.updateSettings(req, res);
    });


    // Reset endpoint for testing (clears all data)
    router.post('/reset', (req, res) => {
        systemController.resetSystem(req, res);
    });

    // RAG/Knowledge base testing endpoints
    router.get('/knowledge/stats', (req, res) => {
        systemController.getKnowledgeStats(req, res);
    });

    router.post('/knowledge/search', (req, res) => {
        systemController.searchKnowledge(req, res);
    });

    router.post('/knowledge/reset', (req, res) => {
        systemController.resetKnowledge(req, res);
    });

    // Test RAG functionality directly
    router.post('/test-rag', (req, res) => {
        systemController.testRAG(req, res);
    });

    // Debug RAG context generation only
    router.post('/debug-rag', (req, res) => {
        systemController.debugRAG(req, res);
    });

    // Simple RAG test that directly calls AI with enhanced context
    router.post('/simple-rag-test', (req, res) => {
        systemController.simpleRAGTest(req, res);
    });

    // Context-only test - just check what context would be sent to AI
    router.post('/context-test', (req, res) => {
        systemController.contextTest(req, res);
    });

    return router;
}

module.exports = createSystemRoutes;