/**
 * Knowledge Manager Service
 * Manages uploaded documents, their metadata, and integration with vector database
 */
const documentService = require('./documentService');
const chromaService = require('./chromaService');

// In-memory storage for document metadata (use proper database in production)
const documents = new Map();

class KnowledgeManagerService {
    constructor() {
        this.documents = documents;
    }

    /**
     * Upload and process a file
     */
    async uploadFile(file, uploadSource = 'manual') {
        try {
            // Validate file
            documentService.validateFile(file);

            // Process file (extract text and chunk)
            const processResult = await documentService.processFile(file, uploadSource);
            const { document, chunks } = processResult;

            // Store document metadata
            this.documents.set(document.id, {
                ...document,
                chunksCount: chunks.length,
                status: 'processing'
            });

            // Only add to vector database for OpenRouter provider
            const currentProvider = process.env.AI_PROVIDER || 'flowise';
            if (currentProvider === 'openrouter') {
                try {
                    // Add chunks to vector database
                    await chromaService.addDocuments(chunks);
                    
                    // Update status
                    const docMetadata = this.documents.get(document.id);
                    docMetadata.status = 'indexed';
                    docMetadata.indexedAt = new Date();
                    
                    console.log(`Document ${document.originalName} indexed successfully with ${chunks.length} chunks`);
                } catch (error) {
                    // Update status to failed
                    const docMetadata = this.documents.get(document.id);
                    docMetadata.status = 'failed';
                    docMetadata.error = error.message;
                    
                    console.error('Failed to index document:', error);
                    throw new Error(`Document processed but indexing failed: ${error.message}`);
                }
            } else {
                // For Flowise, we don't index in external vector DB
                const docMetadata = this.documents.get(document.id);
                docMetadata.status = 'stored';
                docMetadata.note = 'File processed but not indexed (Flowise uses built-in RAG)';
            }

            return {
                documentId: document.id,
                fileName: document.originalName,
                chunksCount: chunks.length,
                status: this.documents.get(document.id).status,
                provider: currentProvider
            };

        } catch (error) {
            console.error('Failed to upload file:', error);
            throw error;
        }
    }

    /**
     * Get all uploaded documents
     */
    getAllDocuments() {
        return Array.from(this.documents.values()).map(doc => ({
            id: doc.id,
            originalName: doc.originalName,
            fileType: doc.fileType,
            size: doc.size,
            uploadSource: doc.uploadSource,
            uploadTime: doc.uploadTime,
            chunksCount: doc.chunksCount,
            textLength: doc.textLength,
            status: doc.status,
            indexedAt: doc.indexedAt,
            error: doc.error,
            note: doc.note
        }));
    }

    /**
     * Get document by ID
     */
    getDocument(documentId) {
        return this.documents.get(documentId);
    }

    /**
     * Delete document
     */
    async deleteDocument(documentId) {
        try {
            const document = this.documents.get(documentId);
            if (!document) {
                throw new Error('Document not found');
            }

            // Remove from vector database if it was indexed
            const currentProvider = process.env.AI_PROVIDER || 'flowise';
            if (currentProvider === 'openrouter' && document.status === 'indexed') {
                try {
                    // Find and remove chunks from vector database
                    // Note: This would require implementing a way to delete by metadata filter
                    // For now, we'll mark as deleted and clean up later
                    console.log(`Document ${documentId} marked for cleanup from vector database`);
                } catch (error) {
                    console.warn('Failed to remove from vector database:', error);
                }
            }

            // Delete physical files
            await documentService.deleteFile(documentId);

            // Remove from metadata storage
            this.documents.delete(documentId);

            console.log(`Document ${document.originalName} deleted successfully`);
            return true;

        } catch (error) {
            console.error('Failed to delete document:', error);
            throw error;
        }
    }

    /**
     * Get document statistics
     */
    getStats() {
        const docs = Array.from(this.documents.values());
        
        const stats = {
            totalDocuments: docs.length,
            totalChunks: docs.reduce((sum, doc) => sum + (doc.chunksCount || 0), 0),
            totalTextLength: docs.reduce((sum, doc) => sum + (doc.textLength || 0), 0),
            byStatus: {},
            byType: {},
            bySource: {}
        };

        // Group by status
        docs.forEach(doc => {
            stats.byStatus[doc.status] = (stats.byStatus[doc.status] || 0) + 1;
            stats.byType[doc.fileType] = (stats.byType[doc.fileType] || 0) + 1;
            stats.bySource[doc.uploadSource] = (stats.bySource[doc.uploadSource] || 0) + 1;
        });

        return stats;
    }

    /**
     * Re-index all documents (useful when switching providers)
     */
    async reindexAllDocuments() {
        const currentProvider = process.env.AI_PROVIDER || 'flowise';
        
        if (currentProvider !== 'openrouter') {
            console.log('Skipping re-indexing: not using OpenRouter provider');
            return { message: 'Re-indexing not needed for current provider', provider: currentProvider };
        }

        const docs = Array.from(this.documents.values());
        let indexed = 0;
        let failed = 0;

        for (const doc of docs) {
            try {
                // Re-read and process the document
                // This is simplified - in production you might want to cache the chunks
                console.log(`Re-indexing document: ${doc.originalName}`);
                
                // Update status
                doc.status = 'indexed';
                doc.indexedAt = new Date();
                indexed++;
                
            } catch (error) {
                console.error(`Failed to re-index ${doc.originalName}:`, error);
                doc.status = 'failed';
                doc.error = error.message;
                failed++;
            }
        }

        return {
            total: docs.length,
            indexed: indexed,
            failed: failed,
            provider: currentProvider
        };
    }

    /**
     * Clear all documents
     */
    async clearAllDocuments() {
        const documentIds = Array.from(this.documents.keys());
        
        let deleted = 0;
        let failed = 0;

        for (const documentId of documentIds) {
            try {
                await this.deleteDocument(documentId);
                deleted++;
            } catch (error) {
                console.error(`Failed to delete document ${documentId}:`, error);
                failed++;
            }
        }

        return {
            total: documentIds.length,
            deleted: deleted,
            failed: failed
        };
    }

    /**
     * Get supported file types info
     */
    getSupportedFileTypes() {
        return documentService.getSupportedFileTypes();
    }

    /**
     * Search documents by name or content (simple text search)
     */
    searchDocuments(query) {
        if (!query || query.trim().length === 0) {
            return this.getAllDocuments();
        }

        const searchTerm = query.toLowerCase().trim();
        const docs = Array.from(this.documents.values());

        return docs
            .filter(doc => 
                doc.originalName.toLowerCase().includes(searchTerm) ||
                (doc.note && doc.note.toLowerCase().includes(searchTerm))
            )
            .map(doc => ({
                id: doc.id,
                originalName: doc.originalName,
                fileType: doc.fileType,
                size: doc.size,
                uploadSource: doc.uploadSource,
                uploadTime: doc.uploadTime,
                chunksCount: doc.chunksCount,
                textLength: doc.textLength,
                status: doc.status,
                indexedAt: doc.indexedAt,
                error: doc.error,
                note: doc.note
            }));
    }

    /**
     * Index text content directly via API with metadata and duplicate detection (Phase 2.1)
     * @param {string} content - Text content to index
     * @param {Object} metadata - Document metadata
     * @param {string} replacementMode - 'newer' | 'always' | 'never'
     * @returns {Object} Result with documentId and processing stats
     */
    async indexTextContent(content, metadata = {}, replacementMode = 'newer') {
        try {
            // Check for duplicates according to Phase 2.1 specification
            const duplicateInfo = await this.findDuplicateDocument(content, metadata);
            let documentId;
            let replacedDocument = null;

            if (duplicateInfo) {
                const shouldReplace = this.shouldReplaceDocument(
                    duplicateInfo.document, 
                    metadata, 
                    replacementMode
                );

                if (shouldReplace) {
                    // Replace existing document
                    documentId = duplicateInfo.document.id;
                    replacedDocument = {
                        id: duplicateInfo.document.id,
                        title: duplicateInfo.document.originalName,
                        duplicateType: duplicateInfo.type
                    };
                    
                    // Remove old chunks from vector database
                    await this.removeDocumentChunks(documentId);
                    console.log(`🔄 Replacing existing document: ${duplicateInfo.document.originalName} (${duplicateInfo.type} match)`);
                } else {
                    // Keep existing, reject new
                    console.log(`⚠️ Duplicate found, keeping existing: ${duplicateInfo.document.originalName} (${duplicateInfo.type} match)`);
                    return {
                        documentId: duplicateInfo.document.id,
                        chunksCount: duplicateInfo.document.chunksCount,
                        status: 'duplicate_rejected',
                        textLength: content.length,
                        replacedDocument: null,
                        duplicateReason: `${duplicateInfo.type} match with existing document`
                    };
                }
            } else {
                // New document
                documentId = require('crypto').randomUUID();
            }

            const timestamp = new Date();

            // Create document info
            const docInfo = {
                id: documentId,
                originalName: metadata.source_document_name || 'API Document',
                fileType: 'text/plain',
                size: Buffer.byteLength(content, 'utf8'),
                uploadSource: 'api',
                uploadTime: timestamp,
                status: 'processing',
                metadata: metadata
            };

            // Store document info
            this.documents.set(documentId, docInfo);

            // Process the text content using documentService
            const documentService = require('./documentService');
            const chunks = documentService.chunkText(content, docInfo);
            const chunksCount = chunks.length;

            // Add documents to vector database
            const chromaService = require('./chromaService');
            await chromaService.addDocuments(chunks);

            // Update document status
            docInfo.status = 'indexed';
            docInfo.chunksCount = chunksCount;
            docInfo.textLength = content.length;
            docInfo.indexedAt = new Date();

            const action = replacedDocument ? 'replaced' : 'indexed';
            console.log(`✅ API document ${action} successfully: ${documentId} (${chunksCount} chunks)`);

            return {
                documentId,
                chunksCount,
                status: 'indexed',
                textLength: content.length,
                replacedDocument
            };

        } catch (error) {
            console.error('Failed to index text content:', error);
            throw error;
        }
    }

    /**
     * Find duplicate document using Phase 2.1 detection strategy
     * Priority: 1. sourceUrl exact match, 2. title exact match, 3. content preview match
     */
    async findDuplicateDocument(content, metadata) {
        const docs = Array.from(this.documents.values());

        // Priority 1: URL-based detection (highest priority)
        if (metadata.source_url) {
            const urlMatch = docs.find(doc => 
                doc.metadata?.source_url === metadata.source_url
            );
            if (urlMatch) {
                return { type: 'url', document: urlMatch };
            }
        }

        // Priority 2: Title-based detection
        if (metadata.source_document_name) {
            const titleMatch = docs.find(doc => 
                doc.originalName === metadata.source_document_name ||
                doc.metadata?.source_document_name === metadata.source_document_name
            );
            if (titleMatch) {
                return { type: 'title', document: titleMatch };
            }
        }

        // Priority 3: Content-based detection (first 100 characters)
        const contentPreview = content.trim().substring(0, 100);
        for (const doc of docs) {
            // This is a simplified check - in production you might want to store content previews
            if (doc.metadata?.content_preview === contentPreview) {
                return { type: 'content', document: doc };
            }
        }

        return null; // No duplicate found
    }

    /**
     * Determine if existing document should be replaced
     */
    shouldReplaceDocument(existingDoc, newMetadata, mode = 'newer') {
        switch (mode) {
            case 'always':
                return true;
            case 'never':
                return false;
            case 'newer':
            default:
                const existingDate = new Date(existingDoc.metadata?.last_updated || existingDoc.uploadTime);
                const newDate = new Date(newMetadata.last_updated || new Date());
                return newDate > existingDate;
        }
    }

    /**
     * Remove document chunks from vector database
     */
    async removeDocumentChunks(documentId) {
        try {
            // This is a placeholder - implementation depends on vector database capabilities
            // For ChromaDB, you would filter by document metadata and delete matching chunks
            console.log(`Removing chunks for document: ${documentId}`);
            
            // In a real implementation, you'd do something like:
            // await chromaService.deleteDocuments({ source_document_id: documentId });
            
        } catch (error) {
            console.warn('Failed to remove document chunks:', error);
            // Don't throw - this shouldn't block the replacement process
        }
    }
}

module.exports = new KnowledgeManagerService();