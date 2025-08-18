/**
 * Widget Routes
 * Routes for widget customization and integration
 */
const express = require('express');
const WidgetController = require('../controllers/widgetController');

function createWidgetRoutes() {
    const router = express.Router();
    const widgetController = new WidgetController();

    // Get widget configuration
    router.get('/config', (req, res) => {
        widgetController.getWidgetConfig(req, res);
    });

    // Update widget configuration
    router.post('/config', (req, res) => {
        widgetController.updateWidgetConfig(req, res);
    });

    // Get integration code
    router.get('/integration-code', (req, res) => {
        widgetController.getIntegrationCode(req, res);
    });

    // Validate domain access
    router.get('/validate-domain', (req, res) => {
        widgetController.validateDomain(req, res);
    });

    return router;
}

module.exports = createWidgetRoutes;