/**
 * Agent Routes
 * Routes for agent-related endpoints
 */
const express = require('express');
const AgentController = require('../controllers/agentController');

function createAgentRoutes(io) {
    const router = express.Router();
    const agentController = new AgentController(io);

    // Update agent status
    router.post('/agent/status', (req, res) => {
        agentController.updateStatus(req, res);
    });

    // Agent send message
    router.post('/agent/message', (req, res) => {
        agentController.sendMessage(req, res);
    });

    // Agent sends response (using AI suggestion, edited, or from scratch)
    router.post('/agent/respond', (req, res) => {
        agentController.sendResponse(req, res);
    });

    // Get active agents
    router.get('/agents', (req, res) => {
        agentController.getActiveAgents(req, res);
    });

    return router;
}

module.exports = createAgentRoutes;