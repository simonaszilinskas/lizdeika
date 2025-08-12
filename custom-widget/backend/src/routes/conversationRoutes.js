/**
 * Conversation Routes
 * Routes for conversation-related endpoints
 */
const express = require('express');
const ConversationController = require('../controllers/conversationController');

function createConversationRoutes(io) {
    const router = express.Router();
    const conversationController = new ConversationController(io);

    // Create new conversation
    router.post('/conversations', (req, res) => {
        conversationController.createConversation(req, res);
    });

    // Send message and get AI response
    router.post('/messages', (req, res) => {
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

    // Assign conversation to agent
    router.post('/conversations/:conversationId/assign', (req, res) => {
        conversationController.assignConversation(req, res);
    });

    // End conversation
    router.post('/conversations/:conversationId/end', (req, res) => {
        conversationController.endConversation(req, res);
    });

    return router;
}

module.exports = createConversationRoutes;