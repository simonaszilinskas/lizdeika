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

    return router;
}

module.exports = createSystemRoutes;