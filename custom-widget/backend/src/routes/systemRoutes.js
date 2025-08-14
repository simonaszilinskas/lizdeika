/**
 * SYSTEM ROUTES
 * 
 * Main Purpose: Define HTTP endpoints for system administration, health monitoring, and configuration
 * 
 * Key Responsibilities:
 * - Health Monitoring: System health checks and status reporting
 * - Configuration Management: AI provider and system prompt configuration
 * - Admin Functions: System reset and data management operations
 * - RAG Testing: Knowledge base testing and debugging endpoints
 * 
 * Health Routes:
 * - GET /health - Comprehensive system health check
 * 
 * Configuration Routes:
 * - GET /config/system-prompt - Get current system prompt
 * - GET /config/system - Get full system configuration (display-only)
 * - POST /config/settings - Update system prompt (AI provider read-only from env)
 * 
 * Admin Routes:
 * - POST /reset - Clear all system data (development/testing)
 * - GET /knowledge/stats - Knowledge base statistics
 * - POST /knowledge/search - Search knowledge base
 * - POST /knowledge/reset - Reset knowledge base with sample data
 * 
 * RAG Testing Routes:
 * - POST /test-rag - Full RAG functionality test
 * - POST /debug-rag - RAG context generation debugging
 * - POST /simple-rag-test - Direct AI test with enhanced context
 * - POST /context-test - Preview context without AI call
 * 
 * Notes:
 * - Health endpoint is available at root level (/health)
 * - Configuration endpoints are under /api/config/*
 * - Testing endpoints are designed for development environments
 * - Routes support both development and production configurations
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

    // Get full system configuration (display-only)
    router.get('/config/system', (req, res) => {
        systemController.getSystemConfig(req, res);
    });

    // Update system settings (system prompt only - AI provider is read-only)
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