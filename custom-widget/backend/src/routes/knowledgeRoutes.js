/**
 * KNOWLEDGE MANAGEMENT ROUTES
 * 
 * Main Purpose: Define HTTP endpoints for document upload, processing, and RAG knowledge base operations
 * 
 * Key Responsibilities:
 * - Document Upload: Handle file upload with validation and processing
 * - Knowledge Base Management: CRUD operations for documents and metadata
 * - Search and Analytics: Provide document search and statistics endpoints
 * - Admin Operations: Bulk operations like clear all and re-indexing
 * 
 * Routes:
 * - POST /documents/upload - Upload and process documents (.txt, .docx)
 * - POST /documents/index - Index single document with metadata via API
 * - POST /documents/index-batch - Index multiple documents in batch via API
 * - POST /documents/ingest - Smart ingest with deduplication and change detection
 * - POST /documents/detect-orphans - Detect and clean up orphaned documents
 * - GET /documents/ingest-stats - Get ingestion statistics
 * - GET /documents - List all documents with metadata
 * - GET /documents/:id - Get specific document details
 * - DELETE /documents/:id - Remove document from knowledge base
 * - GET /stats - Knowledge base statistics and metrics
 * - GET /search - Search documents by text query
 * - POST /documents/clear - Clear all documents
 * - POST /documents/reindex - Re-index all documents
 * - GET /supported-types - List supported file formats
 * 
 * Features:
 * - Multer middleware integration for file upload handling
 * - File validation and processing pipeline
 * - Vector database operations for semantic search
 * - Comprehensive error handling with user-friendly messages
 * 
 * Notes:
 * - Routes are prefixed with /api/knowledge when mounted
 * - Upload middleware handles file validation and memory storage
 * - Controller manages business logic and service integration
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');
const { validateIngestDocuments, validateDetectOrphans } = require('../middleware/validationMiddleware');
const KnowledgeController = require('../controllers/knowledgeController');

function createKnowledgeRoutes() {
    const router = express.Router();
    const knowledgeController = new KnowledgeController();

    // Rate limiter for document operations (10 requests per minute per user/IP)
    // Uses user ID when authenticated, falls back to IP for anonymous requests
    const documentLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 10,
        message: 'Too many document operations, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.user?.id || req.ip,  // User-based when possible, IP fallback
    });

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

    // Get ingestion statistics (must come before /:documentId to avoid pattern matching)
    // Requires authentication to access statistics
    router.get('/documents/ingest-stats',
        authenticateToken,
        (req, res) => {
            knowledgeController.getIngestStatistics(req, res);
        }
    );

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

    // Get all indexed documents from Chroma vector database
    router.get('/indexed', (req, res) => {
        knowledgeController.getIndexedDocuments(req, res);
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

    // API endpoint for direct document indexing with metadata
    router.post('/documents/index', (req, res) => {
        knowledgeController.indexDocument(req, res);
    });

    // API endpoint for batch document indexing
    router.post('/documents/index-batch', (req, res) => {
        knowledgeController.indexDocumentsBatch(req, res);
    });

    // Smart document ingestion endpoint (for scraper integration)
    router.post('/documents/ingest',
        authenticateToken,
        documentLimiter,
        validateIngestDocuments,
        (req, res) => {
            knowledgeController.ingestDocuments(req, res);
        }
    );

    // Detect and clean up orphaned documents
    router.post('/documents/detect-orphans',
        authenticateToken,
        requireAdmin,
        documentLimiter,
        validateDetectOrphans,
        (req, res) => {
            knowledgeController.detectOrphans(req, res);
        }
    );

    return router;
}

module.exports = createKnowledgeRoutes;