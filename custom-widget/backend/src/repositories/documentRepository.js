const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Constants for pagination and limits
const MAX_DOCUMENT_LIMIT = 10000;
const DEFAULT_DOCUMENT_LIMIT = 100;
const LARGE_URL_ARRAY_THRESHOLD = 500;

/**
 * Repository for knowledge_documents database operations
 */
class DocumentRepository {
  /**
   * Create a new knowledge document record
   * @param {Object} data - Document data
   * @param {string} data.title - Document title
   * @param {string} data.content_hash - SHA256 hash of content
   * @param {string} data.source_type - 'manual_upload', 'scraper', 'api'
   * @param {string} data.source_url - Optional URL for scraped documents
   * @param {string} data.status - Document status (default: 'indexed')
   * @param {number} data.chunks_count - Number of chunks created
   * @param {number} data.total_chars - Total character count
   * @param {string} data.file_path - Optional file path
   * @param {number} data.size - Optional file size in bytes
   * @param {Object} data.metadata - Optional additional metadata
   * @param {Array} data.chroma_ids - Optional array of ChromaDB chunk IDs
   * @returns {Promise<Object>} - Created document
   */
  static async createDocument(data) {
    return prisma.knowledge_documents.create({
      data: {
        title: data.title,
        content_hash: data.content_hash,
        source_type: data.source_type || 'manual_upload',
        source_url: data.source_url || null,
        status: data.status || 'indexed',
        chunks_count: data.chunks_count || 0,
        total_chars: data.total_chars || 0,
        file_path: data.file_path || null,
        size: data.size || null,
        metadata: data.metadata || null,
        chroma_ids: data.chroma_ids || null,
        indexed_at: new Date(),
      },
    });
  }

  /**
   * Find document by content hash
   * @param {string} hash - SHA256 content hash
   * @returns {Promise<Object|null>} - Document or null
   */
  static async findByHash(hash) {
    return prisma.knowledge_documents.findUnique({
      where: { content_hash: hash },
    });
  }

  /**
   * Find document by source URL
   * @param {string} sourceUrl - Source URL
   * @returns {Promise<Object|null>} - Document or null
   */
  static async findBySourceUrl(sourceUrl) {
    return prisma.knowledge_documents.findUnique({
      where: { source_url: sourceUrl },
    });
  }

  /**
   * Find document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object|null>} - Document or null
   */
  static async findById(id) {
    return prisma.knowledge_documents.findUnique({
      where: { id },
    });
  }

  /**
   * Update document status and metadata
   * @param {string} id - Document ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} - Updated document
   */
  static async updateDocument(id, data) {
    return prisma.knowledge_documents.update({
      where: { id },
      data: {
        status: data.status,
        chunks_count: data.chunks_count !== undefined ? data.chunks_count : undefined,
        total_chars: data.total_chars !== undefined ? data.total_chars : undefined,
        error_message: data.error_message || null,
        chroma_ids: data.chroma_ids !== undefined ? data.chroma_ids : undefined,
        indexed_at: data.indexed_at || undefined,
      },
    });
  }

  /**
   * Delete document by ID
   * @param {string} id - Document ID
   * @returns {Promise<void>}
   */
  static async deleteDocument(id) {
    await prisma.knowledge_documents.delete({
      where: { id },
    });
  }

  /**
   * Get all documents of specific source type
   * @param {string} sourceType - 'manual_upload', 'scraper', 'api'
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum results
   * @param {number} options.offset - Skip results
   * @returns {Promise<Object[]>} - Documents
   */
  static async getDocumentsBySourceType(sourceType, options = {}) {
    const { limit = 100, offset = 0 } = options;
    return prisma.knowledge_documents.findMany({
      where: { source_type: sourceType },
      take: limit,
      skip: offset,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get all documents from scraper source that are indexed
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum results (default: 100, max: 10000)
   * @param {number} options.offset - Skip results (default: 0)
   * @returns {Promise<Object[]>} - Scraper documents
   */
  static async getAllScraperDocuments(options = {}) {
    const { limit = DEFAULT_DOCUMENT_LIMIT, offset = 0 } = options;
    // Enforce safe limits to prevent memory issues
    const safeLimited = Math.min(Math.max(1, limit), MAX_DOCUMENT_LIMIT);
    return prisma.knowledge_documents.findMany({
      where: {
        source_type: 'scraper',
        status: 'indexed',
      },
      take: safeLimited,
      skip: offset,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get all documents by status
   * @param {string} status - Document status
   * @returns {Promise<Object[]>} - Documents
   */
  static async getDocumentsByStatus(status) {
    return prisma.knowledge_documents.findMany({
      where: { status },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Count documents by source type
   * @param {string} sourceType - Source type
   * @returns {Promise<number>} - Count
   */
  static async countBySourceType(sourceType) {
    return prisma.knowledge_documents.count({
      where: { source_type: sourceType },
    });
  }

  /**
   * Count all documents
   * @returns {Promise<number>} - Total count
   */
  static async countAll() {
    return prisma.knowledge_documents.count();
  }

  /**
   * Get document statistics
   * @returns {Promise<Object>} - Statistics
   */
  static async getStatistics() {
    const [total, indexed, failed, bySourceType] = await Promise.all([
      prisma.knowledge_documents.count(),
      prisma.knowledge_documents.count({ where: { status: 'indexed' } }),
      prisma.knowledge_documents.count({ where: { status: 'failed' } }),
      prisma.knowledge_documents.groupBy({
        by: ['source_type'],
        _count: true,
      }),
    ]);

    const sourceTypeStats = {};
    bySourceType.forEach((item) => {
      sourceTypeStats[item.source_type] = item._count;
    });

    return {
      total,
      indexed,
      failed,
      bySourceType: sourceTypeStats,
    };
  }

  /**
   * Mark documents as orphaned (for cleanup)
   * @param {Array<string>} ids - Document IDs to mark as orphaned
   * @returns {Promise<Object>} - Update result
   */
  static async markAsOrphaned(ids) {
    if (ids.length === 0) {
      return { count: 0 };
    }

    return prisma.knowledge_documents.updateMany({
      where: { id: { in: ids } },
      data: { status: 'orphaned' },
    });
  }

  /**
   * Get orphaned documents
   * @returns {Promise<Object[]>} - Orphaned documents
   */
  static async getOrphanedDocuments() {
    return prisma.knowledge_documents.findMany({
      where: { status: 'orphaned' },
      orderBy: { updated_at: 'asc' },
    });
  }

  /**
   * Permanently delete orphaned documents
   * @param {Array<string>} ids - Document IDs
   * @returns {Promise<Object>} - Delete result
   */
  static async deleteOrphaned(ids) {
    if (ids.length === 0) {
      return { count: 0 };
    }

    return prisma.knowledge_documents.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Find documents not in a list of URLs (for orphan detection)
   * Uses smart batching strategy to prevent memory issues with large URL arrays
   * @param {Array<string>} currentUrls - Current URLs from scraper
   * @param {string} sourceType - Source type to filter by
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum results (default: 1000, max: 10000)
   * @param {number} options.offset - Skip results (default: 0)
   * @returns {Promise<Object[]>} - Documents not in current list (paginated)
   */
  static async findDocumentsNotInUrls(currentUrls, sourceType = 'scraper', options = {}) {
    const { limit = 1000, offset = 0 } = options;
    const safeLimited = Math.min(Math.max(1, limit), MAX_DOCUMENT_LIMIT);

    if (currentUrls.length === 0) {
      // If no URLs provided, return paginated documents of that type
      return this.getDocumentsBySourceType(sourceType, { limit: safeLimited, offset });
    }

    // For small URL arrays (≤500), use direct notIn query - more efficient
    if (currentUrls.length <= LARGE_URL_ARRAY_THRESHOLD) {
      return prisma.knowledge_documents.findMany({
        where: {
          source_type: sourceType,
          source_url: { notIn: currentUrls },
        },
        take: safeLimited,
        skip: offset,
        orderBy: { created_at: 'desc' },
      });
    }

    // For large arrays (>500), fetch documents in batches and filter in-memory
    // This prevents OOM errors from huge notIn arrays in the database
    const urlSet = new Set(currentUrls);
    let allOrphanedDocs = [];
    const FETCH_BATCH_SIZE = 1000;
    let currentOffset = 0;

    // Fetch documents in chunks until we have enough for pagination
    while (allOrphanedDocs.length < offset + safeLimited) {
      const batch = await prisma.knowledge_documents.findMany({
        where: { source_type: sourceType },
        take: FETCH_BATCH_SIZE,
        skip: currentOffset,
        orderBy: { created_at: 'desc' },
      });

      if (batch.length === 0) break; // No more documents

      // Filter out documents in the URL set
      const orphanedBatch = batch.filter((doc) => !urlSet.has(doc.source_url));
      allOrphanedDocs = allOrphanedDocs.concat(orphanedBatch);
      currentOffset += FETCH_BATCH_SIZE;

      // Optimization: stop fetching if we have enough for this page
      if (allOrphanedDocs.length >= offset + safeLimited) {
        break;
      }
    }

    // Apply pagination and return
    return allOrphanedDocs.slice(offset, offset + safeLimited);
  }
}

module.exports = DocumentRepository;
