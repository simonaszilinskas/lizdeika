/**
 * Document Ingestion Integration Tests
 * Tests the smart document ingestion system with deduplication and change detection
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const DocumentHashService = require('../../src/services/documentHashService');
const DocumentIngestService = require('../../src/services/documentIngestService');
const DocumentRepository = require('../../src/repositories/documentRepository');

const prisma = new PrismaClient();

describe('Document Ingestion System', () => {
  beforeAll(async () => {
    // Clean up test data before running tests
    await prisma.knowledge_documents.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.knowledge_documents.deleteMany({});
  });

  describe('DocumentHashService', () => {
    it('should create consistent hashes for content', () => {
      const content = 'Test document content';
      const hash1 = DocumentHashService.computeHash(content);
      const hash2 = DocumentHashService.computeHash(content);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex
    });

    it('should handle line ending normalization', () => {
      const content1 = 'Line 1\r\nLine 2\r\nLine 3';
      const content2 = 'Line 1\nLine 2\nLine 3';
      const hash1 = DocumentHashService.computeNormalizedHash(content1);
      const hash2 = DocumentHashService.computeNormalizedHash(content2);
      expect(hash1).toBe(hash2);
    });
  });

  describe('DocumentRepository', () => {
    it('should create and find documents by hash', async () => {
      const content = 'Test document content';
      const hash = DocumentHashService.computeHash(content);

      const created = await DocumentRepository.createDocument({
        title: 'Test Doc',
        content_hash: hash,
        source_type: 'test',
        chunks_count: 5,
        total_chars: content.length,
      });

      expect(created.id).toBeDefined();
      expect(created.content_hash).toBe(hash);

      const found = await DocumentRepository.findByHash(hash);
      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
    });

    it('should find documents by source URL', async () => {
      const sourceUrl = 'https://example.com/doc1';
      const hash = DocumentHashService.computeHash('Content 1');

      const created = await DocumentRepository.createDocument({
        title: 'Doc with URL',
        content_hash: hash,
        source_type: 'scraper',
        source_url: sourceUrl,
        chunks_count: 3,
        total_chars: 100,
      });

      const found = await DocumentRepository.findBySourceUrl(sourceUrl);
      expect(found).toBeDefined();
      expect(found.source_url).toBe(sourceUrl);
    });

    it('should track document statistics', async () => {
      // Create multiple documents
      for (let i = 0; i < 3; i++) {
        await DocumentRepository.createDocument({
          title: `Doc ${i}`,
          content_hash: DocumentHashService.computeHash(`Content ${i}`),
          source_type: 'test',
          chunks_count: 2,
          total_chars: 50,
          status: i === 2 ? 'failed' : 'indexed',
        });
      }

      const stats = await DocumentRepository.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.indexed).toBe(2);
      expect(stats.failed).toBe(1);
    });
  });

  describe('DocumentIngestService - Single Document Ingestion', () => {
    it('should ingest a new document successfully', async () => {
      const result = await DocumentIngestService.ingestDocument({
        body: 'This is a test document content for ingestion testing',
        title: 'Test Document',
        sourceUrl: 'https://example.com/test1',
        sourceType: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('indexed');
      expect(result.documentId).toBeDefined();
      expect(result.title).toBe('Test Document');
      expect(result.sourceUrl).toBe('https://example.com/test1');
    });

    it('should auto-generate title if not provided', async () => {
      const content =
        'This is a long document that should have an auto-generated title based on the first 50 characters';
      const result = await DocumentIngestService.ingestDocument({
        body: content,
        sourceType: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.generatedTitle).toBe(true);
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.title.length).toBeLessThanOrEqual(53); // 50 chars + "..."
    });

    it('should reject duplicate documents by hash', async () => {
      const content = 'Duplicate content for testing';

      // Ingest first time
      const result1 = await DocumentIngestService.ingestDocument({
        body: content,
        title: 'Original',
        sourceUrl: 'https://example.com/dup1',
        sourceType: 'test',
      });

      expect(result1.success).toBe(true);

      // Try to ingest same content again
      const result2 = await DocumentIngestService.ingestDocument({
        body: content,
        title: 'Duplicate',
        sourceUrl: 'https://example.com/dup2',
        sourceType: 'test',
      });

      expect(result2.success).toBe(false);
      expect(result2.status).toBe('duplicate_rejected');
      expect(result2.duplicateHash).toBeDefined();
    });

    it('should reject empty documents', async () => {
      const result = await DocumentIngestService.ingestDocument({
        body: '',
        title: 'Empty',
        sourceType: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });

    it('should reject non-string content', async () => {
      const result = await DocumentIngestService.ingestDocument({
        body: null,
        title: 'Invalid',
        sourceType: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });
  });

  describe('DocumentIngestService - Batch Ingestion', () => {
    it('should ingest batch of documents', async () => {
      const documents = [
        {
          body: 'Document 1 content for batch testing',
          title: 'Doc 1',
          sourceUrl: 'https://example.com/batch1',
        },
        {
          body: 'Document 2 content for batch testing',
          title: 'Doc 2',
          sourceUrl: 'https://example.com/batch2',
        },
        {
          body: 'Document 3 content for batch testing',
          title: 'Doc 3',
          sourceUrl: 'https://example.com/batch3',
        },
      ];

      const result = await DocumentIngestService.ingestBatch(documents);

      expect(result.success).toBe(true);
      expect(result.batch.total).toBe(3);
      expect(result.batch.successful).toBe(3);
      expect(result.batch.failed).toBe(0);
      expect(result.batch.details.length).toBe(3);
    });

    it('should handle mixed successful and duplicate documents in batch', async () => {
      const content = 'Shared content for testing duplicates';

      // First ingest one document
      await DocumentIngestService.ingestDocument({
        body: content,
        title: 'Original',
        sourceUrl: 'https://example.com/orig',
        sourceType: 'test',
      });

      // Try batch with duplicate
      const batch = [
        {
          body: 'New unique document 1',
          title: 'New Doc 1',
        },
        {
          body: content, // Duplicate
          title: 'Duplicate',
        },
        {
          body: 'New unique document 2',
          title: 'New Doc 2',
        },
      ];

      const result = await DocumentIngestService.ingestBatch(batch);

      expect(result.batch.total).toBe(3);
      expect(result.batch.successful).toBe(2);
      expect(result.batch.duplicates).toBe(1);
      expect(result.batch.failed).toBe(0);
    });
  });

  describe('DocumentIngestService - Orphan Detection', () => {
    it('should detect orphaned documents', async () => {
      // Create some scraper documents
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
      ];

      for (const url of urls) {
        await DocumentIngestService.ingestDocument({
          body: `Content from ${url}`,
          title: `Page ${url}`,
          sourceUrl: url,
          sourceType: 'scraper',
        });
      }

      // Now only report that page1 and page2 exist
      const currentUrls = ['https://example.com/page1', 'https://example.com/page2'];

      const orphanResult = await DocumentIngestService.detectOrphans(currentUrls);

      expect(orphanResult.found).toBe(1);
      expect(orphanResult.deleted).toBe(1);
      expect(orphanResult.details.length).toBe(1);
      expect(orphanResult.details[0].sourceUrl).toBe('https://example.com/page3');
    });

    it('should handle no orphans found', async () => {
      const urls = ['https://example.com/active1', 'https://example.com/active2'];

      for (const url of urls) {
        await DocumentIngestService.ingestDocument({
          body: `Content from ${url}`,
          title: `Active Page ${url}`,
          sourceUrl: url,
          sourceType: 'scraper',
        });
      }

      // Report all documents as still active
      const orphanResult = await DocumentIngestService.detectOrphans(urls);

      expect(orphanResult.found).toBe(0);
      expect(orphanResult.deleted).toBe(0);
      expect(orphanResult.details.length).toBe(0);
    });
  });

  describe('DocumentIngestService - Statistics', () => {
    it('should return ingestion statistics', async () => {
      // Create various documents
      for (let i = 0; i < 5; i++) {
        await DocumentIngestService.ingestDocument({
          body: `Document ${i} content`,
          title: `Doc ${i}`,
          sourceType: 'test',
        });
      }

      const stats = await DocumentIngestService.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.timestamp).toBeDefined();
      expect(stats.database).toBeDefined();
      expect(stats.database.total).toBe(5);
      expect(stats.database.indexed).toBe(5);
    });
  });
});
