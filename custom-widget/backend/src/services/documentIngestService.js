const DocumentRepository = require('../repositories/documentRepository');
const DocumentHashService = require('./documentHashService');
const documentService = require('./documentService');
const chromaService = require('./chromaService');
const { createLogger } = require('../utils/logger');
const logger = createLogger('documentIngestService');

// Retry configuration for ChromaDB operations
const CHROMA_MAX_RETRIES = 3;
const CHROMA_RETRY_DELAY_MS = 1000;

/**
 * Determine if an error is retryable (transient) or non-retryable (permanent)
 * @param {Error} error - The error to check
 * @returns {boolean} - True if the error should be retried
 */
function isRetryableError(error) {
  // Non-retryable: authentication, validation, authorization
  if (
    error.message?.includes('auth') ||
    error.message?.includes('Auth') ||
    error.message?.includes('Unauthorized') ||
    error.message?.includes('Forbidden') ||
    error.message?.includes('validation') ||
    error.message?.includes('Validation')
  ) {
    return false;
  }

  // Retryable: network, timeout, connection issues
  const retryablePatterns = ['timeout', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'network'];
  return retryablePatterns.some((pattern) =>
    error.message?.includes(pattern) || error.message?.includes(pattern.toLowerCase())
  );
}

/**
 * Retry wrapper for ChromaDB operations with exponential backoff
 * Non-retryable errors (auth, validation) fail immediately
 * Retryable errors (network, timeout) retry with exponential backoff
 * @param {Function} operation - Async operation to retry
 * @param {string} operationName - Name for logging
 * @returns {Promise<any>} - Result of operation
 */
async function retryChromaOperation(operation, operationName = 'ChromaDB operation') {
  let lastError;
  for (let attempt = 1; attempt <= CHROMA_MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Exit immediately on non-retryable errors
      if (!isRetryableError(error)) {
        logger.error(`${operationName} failed with non-retryable error:`, error.message);
        throw error;
      }

      if (attempt < CHROMA_MAX_RETRIES) {
        const delayMs = CHROMA_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn(`${operationName} attempt ${attempt} failed, retrying in ${delayMs}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new Error(`${operationName} failed after ${CHROMA_MAX_RETRIES} attempts: ${lastError.message}`);
}

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

      // Create document info for chunking
      const documentInfo = {
        sourceDocumentId: 'ingested',
        sourceDocumentName: generatedTitle,
        uploadSource: sourceType,
        uploadTime: date instanceof Date ? date : new Date(date), // Type-safe date conversion
        fileType: 'text',
        category: sourceType === 'scraper' ? 'scraped_document' : 'ingested_document',
        source_url: sourceUrl,
      };

      // Chunk the text with fallback strategies
      const chunkingResult = await documentService.chunkTextWithFallback(normalizedContent, documentInfo);
      const chunks = chunkingResult.chunks;

      if (!chunks || chunks.length === 0) {
        throw new Error('Document chunking failed: no chunks created');
      }

      // Add chunks to ChromaDB with retry logic
      if (chromaService.isConnected) {
        try {
          await retryChromaOperation(
            () => chromaService.addDocuments(chunks),
            'Adding document chunks to ChromaDB'
          );
        } catch (error) {
          logger.error('Failed to add chunks to ChromaDB after retries:', error);
          throw new Error(`Failed to embed chunks in vector database: ${error.message}`);
        }
      } else {
        logger.warn('ChromaDB not connected, skipping chunk embedding (document still created locally)');
      }

      // Extract chunk IDs for tracking
      const chunkIds = chunks.map((c) => c.id);

      // Handle content change: replace old document if URL exists but hash differs
      // This fires when: (1) URL exists with no matching hash anywhere, OR (2) URL exists but hash is different
      let replacedDocumentId = null;
      if (existingByUrl && (!existingByHash || existingByUrl.id !== existingByHash.id)) {
        // URL exists but content changed - delete old chunks from ChromaDB with retry
        if (existingByUrl.chroma_ids && Array.isArray(existingByUrl.chroma_ids) && chromaService.isConnected) {
          try {
            await retryChromaOperation(
              () => chromaService.deleteChunks(existingByUrl.chroma_ids),
              'Deleting old document chunks from ChromaDB'
            );
          } catch (error) {
            logger.error('[DocumentIngestService.ingestDocument] ChromaDB deletion error, not deleting DB record:', error);
            // Don't proceed with DB deletion if ChromaDB fails - maintain consistency
            throw new Error(`Failed to delete old chunks from ChromaDB: ${error.message}`);
          }
        }
        // Delete old document record only after successful ChromaDB cleanup
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
        chunks_count: chunkIds.length,
        total_chars: normalizedContent.length,
        chroma_ids: chunkIds,
        metadata: {
          date,
          sourceUrl,
          generatedTitle: !title,
          chunkingStrategy: chunkingResult.strategy,
        },
      });

      return {
        success: true,
        status: 'indexed',
        documentId: documentRecord.id,
        title: generatedTitle,
        sourceUrl,
        date,
        chunksCount: chunkIds.length,
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

    // Process documents in parallel for better performance with large batches
    const promises = documents.map((doc) =>
      this.ingestDocument({
        body: doc.body,
        title: doc.title,
        sourceUrl: doc.sourceUrl,
        date: doc.date,
        sourceType: doc.sourceType || 'api',
      })
    );

    // Use Promise.allSettled to handle all results (success or failure)
    const settled = await Promise.allSettled(promises);

    // Process results and count by status
    const results = {
      total: documents.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      details: [],
    };

    settled.forEach((settlement) => {
      let result;
      if (settlement.status === 'fulfilled') {
        result = settlement.value;
      } else {
        // Convert rejection to error result
        result = {
          success: false,
          status: 'failed',
          error: settlement.reason.message,
        };
      }

      results.details.push(result);

      if (result.success) {
        results.successful += 1;
      } else if (result.status === 'duplicate_rejected') {
        results.duplicates += 1;
      } else {
        results.failed += 1;
      }
    });

    return {
      success: results.failed === 0,
      batch: results,
    };
  }

  /**
   * Detect and handle orphaned documents from scraper
   * Documents not in the current list are marked as orphaned and can be deleted
   * @param {Array<string>} currentScraperUrls - List of URLs currently in scraper
   * @param {Object} options - Optional settings
   * @param {boolean} options.dryRun - Preview deletions without executing (default: false)
   * @returns {Promise<Object>} - Orphan detection result
   */
  static async detectOrphans(currentScraperUrls = [], options = {}) {
    const { dryRun = false } = options;

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
          dryRun,
          details: [],
        };
      }

      // If dryRun, return preview without modifications
      if (dryRun) {
        return {
          found: orphanedDocs.length,
          deleted: 0,
          dryRun: true,
          preview: true,
          details: orphanedDocs.map((doc) => ({
            id: doc.id,
            title: doc.title,
            sourceUrl: doc.source_url,
            chunksToDelete: doc.chroma_ids ? doc.chroma_ids.length : 0,
          })),
        };
      }

      // Extract ChromaDB IDs for deletion
      const chromaIdsToDelete = [];
      orphanedDocs.forEach((doc) => {
        if (doc.chroma_ids && Array.isArray(doc.chroma_ids)) {
          chromaIdsToDelete.push(...doc.chroma_ids);
        }
      });

      // Delete chunks from ChromaDB with retry (only if connected)
      if (chromaIdsToDelete.length > 0 && chromaService.isConnected) {
        try {
          await retryChromaOperation(
            () => chromaService.deleteChunks(chromaIdsToDelete),
            'Deleting orphaned document chunks from ChromaDB'
          );
        } catch (error) {
          logger.error('[DocumentIngestService.detectOrphans] ChromaDB deletion error:', error);
          // Mark as orphaned instead of deleting to maintain consistency
          const orphanIds = orphanedDocs.map((doc) => doc.id);
          await DocumentRepository.markAsOrphaned(orphanIds);
          throw new Error(`Failed to delete chunks from ChromaDB, documents marked as orphaned: ${error.message}`);
        }
      }

      // Delete documents from database only if ChromaDB cleanup succeeded
      const orphanIds = orphanedDocs.map((doc) => doc.id);
      await DocumentRepository.deleteOrphaned(orphanIds);

      return {
        found: orphanedDocs.length,
        deleted: orphanedDocs.length,
        dryRun,
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
