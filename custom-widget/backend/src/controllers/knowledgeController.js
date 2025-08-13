/**
 * KNOWLEDGE MANAGEMENT CONTROLLER
 * 
 * Main Purpose: Handle HTTP endpoints for document upload, processing, and RAG knowledge base management
 * 
 * Key Responsibilities:
 * - Document Upload Processing: Handle .txt and .docx file uploads with validation
 * - File Content Extraction: Extract text content from various document formats
 * - Knowledge Base Management: Add, update, and delete documents in the RAG system
 * - Vector Database Operations: Index documents for semantic search capabilities
 * - Statistics and Analytics: Provide insights on document storage and processing
 * - Search Functionality: Enable document search and retrieval for testing
 * 
 * Dependencies:
 * - Multer middleware for multipart file upload handling
 * - Knowledge manager service for document processing and storage
 * - ChromaDB for vector storage and semantic search
 * - Document processors for .txt and .docx file formats
 * 
 * Features:
 * - Multi-format document support (.txt, .docx)
 * - File size validation (50MB maximum)
 * - Memory-based upload processing for security
 * - Automatic text extraction and chunking
 * - Vector embedding generation using Mistral
 * - Document metadata tracking and status management
 * - Bulk operations (clear all, re-index)
 * 
 * Endpoints:
 * - POST /documents/upload - Upload and process new documents
 * - GET /documents - List all uploaded documents with metadata
 * - GET /documents/:id - Retrieve specific document details
 * - DELETE /documents/:id - Remove document from knowledge base
 * - GET /stats - Get knowledge base statistics and metrics
 * - GET /search - Search documents by text query
 * - POST /documents/clear - Clear all documents from knowledge base
 * - POST /documents/reindex - Re-index all documents for vector search
 * - GET /supported-types - List supported document formats
 * 
 * File Processing Pipeline:
 * 1. File validation (type, size, content)
 * 2. Text extraction from document format
 * 3. Content chunking for vector storage
 * 4. Vector embedding generation
 * 5. Metadata extraction and storage
 * 6. ChromaDB indexing for search
 * 
 * Error Handling:
 * - Comprehensive file validation with user-friendly messages
 * - Format-specific error handling for unsupported files
 * - Size limit enforcement with clear feedback
 * - Content validation to ensure readable text
 * 
 * Notes:
 * - Uses memory storage for security (no files saved to disk)
 * - Supports both manual uploads and programmatic document addition
 * - Tracks upload source for administrative purposes
 * - Provides detailed status tracking (uploaded, processing, indexed, failed)
 */
const multer = require('multer');
const knowledgeManagerService = require('../services/knowledgeManagerService');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(), // Store in memory for processing
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 1 // Only one file at a time
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type. Only .txt and .docx files are allowed.'));
        }
    }
});

class KnowledgeController {
    /**
     * Get multer middleware for file uploads
     */
    getUploadMiddleware() {
        return upload.single('file');
    }

    /**
     * Upload and process a document
     */
    async uploadDocument(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ 
                    error: 'No file provided',
                    message: 'Please select a .txt or .docx file to upload'
                });
            }

            const uploadSource = req.body.source || 'manual';
            
            console.log(`Processing uploaded file: ${req.file.originalname} (${req.file.mimetype})`);

            const result = await knowledgeManagerService.uploadFile(req.file, uploadSource);

            res.json({
                success: true,
                message: 'File uploaded and processed successfully',
                data: result
            });

        } catch (error) {
            console.error('Failed to upload document:', error);
            
            // Return appropriate error message
            if (error.message.includes('Unsupported file type')) {
                res.status(400).json({
                    error: 'Unsupported file type',
                    message: error.message
                });
            } else if (error.message.includes('File too large')) {
                res.status(400).json({
                    error: 'File too large',
                    message: error.message
                });
            } else if (error.message.includes('insufficient text content')) {
                res.status(400).json({
                    error: 'Invalid file content',
                    message: 'The file must contain readable text content'
                });
            } else {
                res.status(500).json({
                    error: 'Upload failed',
                    message: 'Failed to process the uploaded file',
                    details: error.message
                });
            }
        }
    }

    /**
     * Get all uploaded documents
     */
    async getAllDocuments(req, res) {
        try {
            const documents = knowledgeManagerService.getAllDocuments();
            
            res.json({
                success: true,
                data: documents,
                count: documents.length
            });

        } catch (error) {
            console.error('Failed to get documents:', error);
            res.status(500).json({
                error: 'Failed to retrieve documents',
                details: error.message
            });
        }
    }

    /**
     * Get document by ID
     */
    async getDocument(req, res) {
        try {
            const { documentId } = req.params;
            
            if (!documentId) {
                return res.status(400).json({
                    error: 'Document ID required'
                });
            }

            const document = knowledgeManagerService.getDocument(documentId);
            
            if (!document) {
                return res.status(404).json({
                    error: 'Document not found'
                });
            }

            res.json({
                success: true,
                data: document
            });

        } catch (error) {
            console.error('Failed to get document:', error);
            res.status(500).json({
                error: 'Failed to retrieve document',
                details: error.message
            });
        }
    }

    /**
     * Delete document
     */
    async deleteDocument(req, res) {
        try {
            const { documentId } = req.params;
            
            if (!documentId) {
                return res.status(400).json({
                    error: 'Document ID required'
                });
            }

            await knowledgeManagerService.deleteDocument(documentId);

            res.json({
                success: true,
                message: 'Document deleted successfully'
            });

        } catch (error) {
            console.error('Failed to delete document:', error);
            
            if (error.message === 'Document not found') {
                res.status(404).json({
                    error: 'Document not found'
                });
            } else {
                res.status(500).json({
                    error: 'Failed to delete document',
                    details: error.message
                });
            }
        }
    }

    /**
     * Get knowledge base statistics
     */
    async getKnowledgeStats(req, res) {
        try {
            const stats = knowledgeManagerService.getStats();
            
            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Failed to get knowledge stats:', error);
            res.status(500).json({
                error: 'Failed to retrieve statistics',
                details: error.message
            });
        }
    }

    /**
     * Search documents
     */
    async searchDocuments(req, res) {
        try {
            const { query } = req.query;
            
            const results = knowledgeManagerService.searchDocuments(query);
            
            res.json({
                success: true,
                data: results,
                count: results.length,
                query: query || ''
            });

        } catch (error) {
            console.error('Failed to search documents:', error);
            res.status(500).json({
                error: 'Search failed',
                details: error.message
            });
        }
    }

    /**
     * Clear all documents
     */
    async clearAllDocuments(req, res) {
        try {
            const result = await knowledgeManagerService.clearAllDocuments();

            res.json({
                success: true,
                message: 'All documents cleared successfully',
                data: result
            });

        } catch (error) {
            console.error('Failed to clear documents:', error);
            res.status(500).json({
                error: 'Failed to clear documents',
                details: error.message
            });
        }
    }

    /**
     * Re-index all documents
     */
    async reindexDocuments(req, res) {
        try {
            const result = await knowledgeManagerService.reindexAllDocuments();

            res.json({
                success: true,
                message: 'Re-indexing completed',
                data: result
            });

        } catch (error) {
            console.error('Failed to re-index documents:', error);
            res.status(500).json({
                error: 'Re-indexing failed',
                details: error.message
            });
        }
    }

    /**
     * Get supported file types
     */
    async getSupportedFileTypes(req, res) {
        try {
            const supportedTypes = knowledgeManagerService.getSupportedFileTypes();
            
            res.json({
                success: true,
                data: supportedTypes
            });

        } catch (error) {
            console.error('Failed to get supported file types:', error);
            res.status(500).json({
                error: 'Failed to retrieve supported file types',
                details: error.message
            });
        }
    }
}

module.exports = KnowledgeController;