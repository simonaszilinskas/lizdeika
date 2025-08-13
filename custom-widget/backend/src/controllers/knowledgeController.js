/**
 * Knowledge Management Controller
 * Handles file uploads, document management, and knowledge base operations
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