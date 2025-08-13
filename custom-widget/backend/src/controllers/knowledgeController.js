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

    /**
     * Index document directly via API with flexible input format (Phase 2.1)
     * 
     * Expected request body:
     * {
     *   "body": "Document text content",              // REQUIRED ONLY
     *   "title": "Document Title",                    // OPTIONAL - auto-generated if missing
     *   "sourceUrl": "https://example.com/source",    // OPTIONAL - null if not provided
     *   "date": "2024-01-15T10:30:00Z"               // OPTIONAL - current date if missing
     * }
     */
    async indexDocument(req, res) {
        try {
            const { body, title, sourceUrl, date } = req.body;

            // Validate required field - only body is mandatory
            if (!body || body.trim().length === 0) {
                return res.status(400).json({
                    error: 'Body field is required and cannot be empty'
                });
            }

            // Auto-generate missing metadata according to Phase 2.1 spec
            const generatedTitle = title || this.generateTitle(body);
            const documentDate = date || new Date().toISOString();
            const documentSourceUrl = sourceUrl || null;

            // Create document metadata for internal processing
            const documentMetadata = {
                source_document_name: generatedTitle,
                source_url: documentSourceUrl,
                category: 'api_indexed',
                language: 'lt',
                content_type: 'api_document',
                upload_timestamp: new Date().toISOString(),
                last_updated: documentDate,
                generated_title: !title, // Track if title was auto-generated
                provided_source_url: !!sourceUrl // Track if URL was provided
            };

            // Process and index the document with duplicate detection
            const result = await knowledgeManagerService.indexTextContent(
                body, 
                documentMetadata,
                'newer' // Default replacement mode
            );

            res.json({
                success: true,
                message: result.status === 'duplicate_rejected' 
                    ? 'Document rejected - duplicate found' 
                    : 'Document indexed successfully',
                data: {
                    documentId: result.documentId,
                    title: generatedTitle,
                    sourceUrl: documentSourceUrl,
                    date: documentDate,
                    chunksCount: result.chunksCount,
                    totalLength: body.length,
                    status: result.status,
                    replacedDocument: result.replacedDocument,
                    generatedTitle: !title,
                    duplicateReason: result.duplicateReason
                }
            });

        } catch (error) {
            console.error('Failed to index document:', error);
            res.status(500).json({
                error: 'Failed to index document',
                details: error.message
            });
        }
    }

    /**
     * Generate title from document body (first 50 characters + "...")
     */
    generateTitle(body) {
        const cleanBody = body.trim();
        if (cleanBody.length <= 50) {
            return cleanBody;
        }
        return cleanBody.substring(0, 50) + "...";
    }

    /**
     * Index multiple documents in batch via API with flexible input format (Phase 2.1)
     * 
     * Expected request body:
     * {
     *   "documents": [
     *     {
     *       "body": "Document 1 content",               // REQUIRED ONLY
     *       "title": "Doc 1",                          // OPTIONAL
     *       "sourceUrl": "https://example.com/doc1",   // OPTIONAL
     *       "date": "2024-01-15T10:30:00Z"            // OPTIONAL
     *     },
     *     {
     *       "body": "Document 2 content",
     *       "title": "Doc 2",
     *       "sourceUrl": "https://example.com/doc2"
     *     }
     *   ]
     * }
     */
    async indexDocumentsBatch(req, res) {
        try {
            const { documents } = req.body;

            if (!Array.isArray(documents) || documents.length === 0) {
                return res.status(400).json({
                    error: 'Documents array is required and cannot be empty'
                });
            }

            if (documents.length > 10000) {
                return res.status(400).json({
                    error: 'Batch size cannot exceed 10,000 documents'
                });
            }

            const results = [];
            const errors = [];
            const batchId = `batch_${Date.now()}`;

            // Process each document
            for (let i = 0; i < documents.length; i++) {
                const { body, title, sourceUrl, date } = documents[i];

                try {
                    // Validate required field - only body is mandatory
                    if (!body || body.trim().length === 0) {
                        errors.push({
                            index: i,
                            error: 'Body field is required and cannot be empty'
                        });
                        continue;
                    }

                    // Auto-generate missing metadata according to Phase 2.1 spec
                    const generatedTitle = title || this.generateTitle(body);
                    const documentDate = date || new Date().toISOString();
                    const documentSourceUrl = sourceUrl || null;

                    // Set metadata with batch identifier
                    const documentMetadata = {
                        source_document_name: generatedTitle,
                        source_url: documentSourceUrl,
                        category: 'api_batch_indexed',
                        language: 'lt',
                        content_type: 'api_batch_document',
                        batch_id: batchId,
                        batch_index: i,
                        upload_timestamp: new Date().toISOString(),
                        last_updated: documentDate,
                        generated_title: !title,
                        provided_source_url: !!sourceUrl
                    };

                    // Process and index with duplicate detection
                    const result = await knowledgeManagerService.indexTextContent(
                        body, 
                        documentMetadata,
                        'newer' // Default replacement mode for batch
                    );

                    results.push({
                        index: i,
                        documentId: result.documentId,
                        title: generatedTitle,
                        sourceUrl: documentSourceUrl,
                        date: documentDate,
                        chunksCount: result.chunksCount,
                        totalLength: body.length,
                        status: result.status,
                        replacedDocument: result.replacedDocument,
                        generatedTitle: !title,
                        duplicateReason: result.duplicateReason
                    });

                } catch (docError) {
                    errors.push({
                        index: i,
                        error: docError.message
                    });
                }
            }

            res.json({
                success: true,
                message: `Batch indexing completed: ${results.length} successful, ${errors.length} failed`,
                data: {
                    successful: results,
                    failed: errors,
                    summary: {
                        total: documents.length,
                        successful: results.length,
                        failed: errors.length,
                        batchId: batchId
                    }
                }
            });

        } catch (error) {
            console.error('Failed to process document batch:', error);
            res.status(500).json({
                error: 'Failed to process document batch',
                details: error.message
            });
        }
    }
}

module.exports = KnowledgeController;