const DocumentRepository = require('../repositories/documentRepository');
const DocumentHashService = require('./documentHashService');
const documentService = require('./documentService');
const chromaService = require('./chromaService');
const logger = require('../utils/logger');

/**
 * Main service for intelligent document ingestion
 * Handles deduplication, change detection, and orphan management
 */
class DocumentIngestService {
  /**
   * Ingest a single document with deduplication and change detection
   * @param {Object} params - Ingestion parameters
   * @param {string} params.body - Document content (required)
   * @param {string} params.title - Document title (optional, auto-generated if not provided)
   * @param {string} params.sourceUrl - Source URL for scraped documents (optional)
   * @param {string} params.date - Document date (optional, defaults to now)
   * @param {string} params.sourceType - 'scraper', 'api', 'manual_upload' (default: 'api')
   * @returns {Promise<Object>} - Ingestion result with status and document ID
   */
  static async ingestDocument(params) {
    const {
      body,
      title,
      sourceUrl = null,
      date = new Date().toISOString(),
      sourceType = 'api',
    } = params;

    try {
      // Validate input
      if (!body || typeof body !== 'string' || body.trim().length === 0) {
        throw new Error('Document body is required and must be non-empty');
      }

      // Normalize and hash content
      const normalizedContent = DocumentHashService.normalizeContent(body);
      const contentHash = DocumentHashService.computeHash(normalizedContent);

      // Check for duplicate by hash
      const existingByHash = await DocumentRepository.findByHash(contentHash);
      if (existingByHash) {
        return {
          success: false,
          status: 'duplicate_rejected',
          documentId: existingByHash.id,
          title: existingByHash.title,
          reason: 'Document with identical content already exists',
          duplicateHash: contentHash,
        };
      }

      // Check for duplicate by URL (if provided)
      let existingByUrl = null;
      if (sourceUrl) {
        existingByUrl = await DocumentRepository.findBySourceUrl(sourceUrl);
        if (existingByUrl && existingByUrl.content_hash === contentHash) {
          return {
            success: false,
            status: 'duplicate_rejected',
            documentId: existingByUrl.id,
            reason: 'Document with same URL and content already exists',
          };
        }
      }

      // Generate title if not provided
      const generatedTitle =
        title || `${normalizedContent.substring(0, 50)}${normalizedContent.length > 50 ? '...' : ''}`;

      // Process document: extract text, chunk, embed
      const processingResult = await documentService.processTextContent(
        normalizedContent,
        {
          sourceDocumentId: undefined,
          sourceDocumentName: generatedTitle,
          uploadSource: sourceType,
          uploadTime: date,
          sourceUrl,
        }
      );

      if (!processingResult || !processingResult.chunkIds || processingResult.chunkIds.length === 0) {
        throw new Error('Document processing failed: no chunks created');
      }

      // Handle content change if URL exists
      let replacedDocumentId = null;
      if (existingByUrl && existingByUrl.id !== (existingByHash?.id || null)) {
        // URL exists but content changed - delete old chunks from ChromaDB
        if (existingByUrl.chroma_ids && Array.isArray(existingByUrl.chroma_ids)) {
          await chromaService.deleteChunks(existingByUrl.chroma_ids);
        }
        // Mark old document as updated
        await DocumentRepository.deleteDocument(existingByUrl.id);
        replacedDocumentId = existingByUrl.id;
      }

      // Save document metadata to database
      const documentRecord = await DocumentRepository.createDocument({
        title: generatedTitle,
        content_hash: contentHash,
        source_type: sourceType,
        source_url: sourceUrl,
        status: 'indexed',
        chunks_count: processingResult.chunkIds.length,
        total_chars: normalizedContent.length,
        chroma_ids: processingResult.chunkIds,
        metadata: {
          date,
          sourceUrl,
          generatedTitle: !title,
        },
      });

      return {
        success: true,
        status: 'indexed',
        documentId: documentRecord.id,
        title: generatedTitle,
        sourceUrl,
        date,
        chunksCount: processingResult.chunkIds.length,
        totalLength: normalizedContent.length,
        replacedDocument: replacedDocumentId,
        generatedTitle: !title,
      };
    } catch (error) {
      logger.error('[DocumentIngestService.ingestDocument]', error);
      return {
        success: false,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Ingest batch of documents
   * @param {Array<Object>} documents - Array of documents to ingest
   * @returns {Promise<Object>} - Batch result with statistics
   */
  static async ingestBatch(documents) {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error('Documents array is required and must be non-empty');
    }

    const results = {
      total: documents.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      details: [],
    };

    for (const doc of documents) {
      const result = await this.ingestDocument({
        body: doc.body,
        title: doc.title,
        sourceUrl: doc.sourceUrl,
        date: doc.date,
        sourceType: doc.sourceType || 'api',
      });

      results.details.push(result);

      if (result.success) {
        results.successful += 1;
      } else if (result.status === 'duplicate_rejected') {
        results.duplicates += 1;
      } else {
        results.failed += 1;
      }
    }

    return {
      success: results.failed === 0,
      batch: results,
    };
  }

  /**
   * Detect and handle orphaned documents from scraper
   * Documents not in the current list are marked as orphaned and can be deleted
   * @param {Array<string>} currentScraperUrls - List of URLs currently in scraper
   * @returns {Promise<Object>} - Orphan detection result
   */
  static async detectOrphans(currentScraperUrls = []) {
    try {
      // Find all scraper documents not in current URLs
      const orphanedDocs = await DocumentRepository.findDocumentsNotInUrls(
        currentScraperUrls,
        'scraper'
      );

      if (orphanedDocs.length === 0) {
        return {
          found: 0,
          deleted: 0,
          details: [],
        };
      }

      // Extract ChromaDB IDs for deletion
      const chromaIdsToDelete = [];
      orphanedDocs.forEach((doc) => {
        if (doc.chroma_ids && Array.isArray(doc.chroma_ids)) {
          chromaIdsToDelete.push(...doc.chroma_ids);
        }
      });

      // Delete chunks from ChromaDB
      if (chromaIdsToDelete.length > 0) {
        try {
          await chromaService.deleteChunks(chromaIdsToDelete);
        } catch (error) {
          logger.error('[DocumentIngestService.detectOrphans] ChromaDB deletion error:', error);
        }
      }

      // Delete documents from database
      const orphanIds = orphanedDocs.map((doc) => doc.id);
      await DocumentRepository.deleteOrphaned(orphanIds);

      return {
        found: orphanedDocs.length,
        deleted: orphanedDocs.length,
        details: orphanedDocs.map((doc) => ({
          id: doc.id,
          title: doc.title,
          sourceUrl: doc.source_url,
          chunksDeleted: doc.chroma_ids ? doc.chroma_ids.length : 0,
        })),
      };
    } catch (error) {
      logger.error('[DocumentIngestService.detectOrphans]', error);
      throw error;
    }
  }

  /**
   * Get ingestion statistics
   * @returns {Promise<Object>} - Statistics
   */
  static async getStatistics() {
    try {
      const dbStats = await DocumentRepository.getStatistics();
      return {
        database: dbStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[DocumentIngestService.getStatistics]', error);
      throw error;
    }
  }
}

module.exports = DocumentIngestService;
