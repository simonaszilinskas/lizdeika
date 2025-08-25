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

    // Get all agents (including offline ones)
    router.get('/agents/all', (req, res) => {
        agentController.getAllAgents(req, res);
    });

    // NEW: Update personal agent status (online/afk)
    router.post('/agent/personal-status', (req, res) => {
        agentController.updatePersonalStatus(req, res);
    });

    // NEW: Get/Set global system mode
    router.get('/system/mode', (req, res) => {
        agentController.getSystemMode(req, res);
    });

    router.post('/system/mode', (req, res) => {
        agentController.setSystemMode(req, res);
    });

    // NEW: Get connected agents
    router.get('/agents/connected', (req, res) => {
        agentController.getConnectedAgents(req, res);
    });

    // NEW: AFK detection configuration
    router.get('/system/afk-config', (req, res) => {
        agentController.getAFKConfig(req, res);
    });

    router.post('/system/afk-timeout', (req, res) => {
        agentController.setAFKTimeout(req, res);
    });

    return router;
}

module.exports = createAgentRoutes;