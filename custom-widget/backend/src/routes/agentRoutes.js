/**
 * AGENT ROUTES
 * 
 * Main Purpose: Define HTTP route endpoints for agent management and communication
 * 
 * Key Responsibilities:
 * - Route Registration: Map HTTP endpoints to agent controller methods
 * - Request Routing: Direct agent-related requests to appropriate handlers
 * - Dependency Injection: Pass WebSocket instance to controller for real-time communication
 * 
 * Routes:
 * - POST /agent/status - Update agent availability status
 * - POST /agent/message - Send agent message (legacy endpoint)
 * - POST /agent/respond - Send agent response with AI suggestion metadata
 * - GET /agents - Get list of active agents
 * 
 * Notes:
 * - Requires WebSocket instance for real-time message broadcasting
 * - Routes are prefixed with /api when mounted in main application
 * - Controller handles business logic, routes only handle HTTP mapping
 */
const express = require('express');
const AgentController = require('../controllers/agentController');

function createAgentRoutes(io) {
    const router = express.Router();
    const agentController = new AgentController(io);

    // Get current agent status
    router.get('/agent/status', (req, res) => {
        agentController.getStatus(req, res);
    });

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