/**
 * Knowledge Management Routes
 * Routes for document upload, management, and knowledge base operations
 */
const express = require('express');
const KnowledgeController = require('../controllers/knowledgeController');

function createKnowledgeRoutes() {
    const router = express.Router();
    const knowledgeController = new KnowledgeController();

    // File upload endpoint
    router.post('/documents/upload', 
        knowledgeController.getUploadMiddleware(), 
        (req, res) => {
            knowledgeController.uploadDocument(req, res);
        }
    );

    // Get all documents
    router.get('/documents', (req, res) => {
        knowledgeController.getAllDocuments(req, res);
    });

    // Search documents
    router.get('/documents/search', (req, res) => {
        knowledgeController.searchDocuments(req, res);
    });

    // Get document by ID
    router.get('/documents/:documentId', (req, res) => {
        knowledgeController.getDocument(req, res);
    });

    // Delete document
    router.delete('/documents/:documentId', (req, res) => {
        knowledgeController.deleteDocument(req, res);
    });

    // Knowledge base statistics
    router.get('/stats', (req, res) => {
        knowledgeController.getKnowledgeStats(req, res);
    });

    // Clear all documents (admin function)
    router.post('/documents/clear', (req, res) => {
        knowledgeController.clearAllDocuments(req, res);
    });

    // Re-index all documents (admin function)
    router.post('/documents/reindex', (req, res) => {
        knowledgeController.reindexDocuments(req, res);
    });

    // Get supported file types
    router.get('/file-types', (req, res) => {
        knowledgeController.getSupportedFileTypes(req, res);
    });

    return router;
}

module.exports = createKnowledgeRoutes;