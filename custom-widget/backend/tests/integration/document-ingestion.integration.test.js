/**
 * Document Ingestion Integration Tests
 * Tests the smart document ingestion system with deduplication and change detection
 */

const request = require('supertest');
const app = require('../../server');
const { PrismaClient } = require('@prisma/client');
const DocumentHashService = require('../../src/services/documentHashService');
const DocumentRepository = require('../../src/repositories/documentRepository');

const prisma = new PrismaClient();

describe('Document Ingestion API', () => {
  beforeAll(async () => {
    // Clean up test data before running tests
    await prisma.knowledge_documents.deleteMany({});
  });

  afterAll(async () => {
    await prisma.knowledge_documents.deleteMany({});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up between test suites
    await prisma.knowledge_documents.deleteMany({});
  });

  describe('POST /api/knowledge/documents/ingest', () => {
    it('should ingest a single document successfully', async () => {
      const response = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body: 'This is test content for document ingestion',
              title: 'Test Document',
              sourceUrl: 'https://example.com/test1',
            },
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.batch.successful).toBe(1);
      expect(response.body.batch.total).toBe(1);
      expect(response.body.batch.details[0].documentId).toBeDefined();
      expect(response.body.batch.details[0].title).toBe('Test Document');
      expect(response.body.batch.details[0].sourceUrl).toBe('https://example.com/test1');
    });

    it('should ingest batch of multiple documents', async () => {
      const response = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body: 'First document content',
              title: 'Doc 1',
              sourceUrl: 'https://example.com/doc1',
            },
            {
              body: 'Second document content',
              title: 'Doc 2',
              sourceUrl: 'https://example.com/doc2',
            },
            {
              body: 'Third document content',
              title: 'Doc 3',
              sourceUrl: 'https://example.com/doc3',
            },
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.batch.successful).toBe(3);
      expect(response.body.batch.total).toBe(3);
      expect(response.body.batch.failed).toBe(0);
    });

    it('should reject duplicate content by hash', async () => {
      const contentA = 'Unique content that will be duplicated';

      // First ingestion
      const response1 = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body: contentA,
              title: 'Original',
              sourceUrl: 'https://example.com/original',
            },
          ],
        })
        .expect(200);

      expect(response1.body.batch.successful).toBe(1);

      // Attempt duplicate ingestion (same content)
      const response2 = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body: contentA,
              title: 'Duplicate Attempt',
              sourceUrl: 'https://example.com/duplicate',
            },
          ],
        })
        .expect(200);

      expect(response2.body.batch.duplicates).toBe(1);
      expect(response2.body.batch.details[0].status).toBe('duplicate_rejected');
    });

    it('should auto-generate title if not provided', async () => {
      const longContent = 'This is a document with a very long content that should be auto-generated as title from the first 50 characters or so';

      const response = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body: longContent,
              sourceUrl: 'https://example.com/autotitle',
            },
          ],
        })
        .expect(200);

      expect(response.body.batch.successful).toBe(1);
      expect(response.body.batch.details[0].generatedTitle).toBe(true);
      expect(response.body.batch.details[0].title).toBeDefined();
      expect(response.body.batch.details[0].title.length).toBeGreaterThan(0);
    });

    it('should reject invalid request missing documents array', async () => {
      const response = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          data: 'something',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.message).toContain('documents');
    });

    it('should reject empty documents array', async () => {
      const response = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [],
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle mixed successful and duplicate documents in batch', async () => {
      const duplicateContent = 'Content that appears twice';

      // Ingest first
      await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body: duplicateContent,
              title: 'Original',
            },
          ],
        });

      // Batch with mix
      const response = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body: 'Unique new content 1',
              title: 'New 1',
            },
            {
              body: duplicateContent,
              title: 'Duplicate',
            },
            {
              body: 'Unique new content 2',
              title: 'New 2',
            },
          ],
        })
        .expect(200);

      expect(response.body.batch.total).toBe(3);
      expect(response.body.batch.successful).toBe(2);
      expect(response.body.batch.duplicates).toBe(1);
      expect(response.body.batch.failed).toBe(0);
    });
  });

  describe('POST /api/knowledge/documents/detect-orphans', () => {
    it('should detect orphaned documents when URLs are removed', async () => {
      // Ingest scraper documents
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
      ];

      for (const url of urls) {
        await request(app)
          .post('/api/knowledge/documents/ingest')
          .send({
            documents: [
              {
                body: `Content from ${url}`,
                title: `Page from ${url}`,
                sourceUrl: url,
                sourceType: 'scraper',
              },
            ],
          });
      }

      // Report that only page1 and page2 still exist
      const response = await request(app)
        .post('/api/knowledge/documents/detect-orphans')
        .send({
          currentUrls: ['https://example.com/page1', 'https://example.com/page2'],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orphans.found).toBe(1);
      expect(response.body.orphans.deleted).toBe(1);
      expect(response.body.orphans.details[0].sourceUrl).toBe('https://example.com/page3');
    });

    it('should handle empty current URLs list (implies all are orphaned)', async () => {
      // Ingest scraper documents
      await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body: 'Page 1 content',
              title: 'Page 1',
              sourceUrl: 'https://example.com/page-orphan-1',
              sourceType: 'scraper',
            },
            {
              body: 'Page 2 content',
              title: 'Page 2',
              sourceUrl: 'https://example.com/page-orphan-2',
              sourceType: 'scraper',
            },
          ],
        });

      // Report empty current URLs
      const response = await request(app)
        .post('/api/knowledge/documents/detect-orphans')
        .send({
          currentUrls: [],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orphans.found).toBeGreaterThan(0);
    });

    it('should return zero orphans when all documents are present', async () => {
      const urls = [
        'https://example.com/keep1',
        'https://example.com/keep2',
      ];

      // Ingest scraper documents
      for (const url of urls) {
        await request(app)
          .post('/api/knowledge/documents/ingest')
          .send({
            documents: [
              {
                body: `Content for ${url}`,
                title: `Title for ${url}`,
                sourceUrl: url,
                sourceType: 'scraper',
              },
            ],
          });
      }

      // Report all URLs still exist
      const response = await request(app)
        .post('/api/knowledge/documents/detect-orphans')
        .send({
          currentUrls: urls,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orphans.found).toBe(0);
      expect(response.body.orphans.deleted).toBe(0);
    });

    it('should reject invalid currentUrls format', async () => {
      const response = await request(app)
        .post('/api/knowledge/documents/detect-orphans')
        .send({
          currentUrls: 'not-an-array',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/knowledge/documents/ingest-stats', () => {
    it('should return ingestion statistics', async () => {
      // Ingest some documents
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/knowledge/documents/ingest')
          .send({
            documents: [
              {
                body: `Document ${i} content`,
                title: `Doc ${i}`,
              },
            ],
          });
      }

      const response = await request(app)
        .get('/api/knowledge/documents/ingest-stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.timestamp).toBeDefined();
      expect(response.body.statistics.database).toBeDefined();
      expect(response.body.statistics.database.total).toBe(3);
      expect(response.body.statistics.database.indexed).toBe(3);
    });

    it('should show zero documents when none ingested', async () => {
      const response = await request(app)
        .get('/api/knowledge/documents/ingest-stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.statistics.database.total).toBe(0);
    });
  });

  describe('Database Persistence', () => {
    it('should persist documents to knowledge_documents table', async () => {
      const response = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body: 'Content to persist',
              title: 'Persistence Test',
              sourceUrl: 'https://example.com/persist',
            },
          ],
        })
        .expect(200);

      const documentId = response.body.batch.details[0].documentId;

      // Query database directly
      const dbDoc = await DocumentRepository.findById(documentId);

      expect(dbDoc).toBeDefined();
      expect(dbDoc.title).toBe('Persistence Test');
      expect(dbDoc.source_url).toBe('https://example.com/persist');
      expect(dbDoc.status).toBe('indexed');
      expect(dbDoc.chunks_count).toBeGreaterThan(0);
      expect(dbDoc.content_hash).toBeDefined();
      expect(dbDoc.chroma_ids).toBeDefined();
      expect(Array.isArray(dbDoc.chroma_ids)).toBe(true);
    });

    it('should track document metadata correctly', async () => {
      const body = 'Test content for metadata tracking';
      const response = await request(app)
        .post('/api/knowledge/documents/ingest')
        .send({
          documents: [
            {
              body,
              title: 'Metadata Test',
              sourceUrl: 'https://example.com/metadata',
              sourceType: 'scraper',
            },
          ],
        })
        .expect(200);

      const documentId = response.body.batch.details[0].documentId;
      const dbDoc = await DocumentRepository.findById(documentId);

      expect(dbDoc.content_hash).toBe(DocumentHashService.computeHash(
        DocumentHashService.normalizeContent(body)
      ));
      expect(dbDoc.source_type).toBe('scraper');
      expect(dbDoc.source_url).toBe('https://example.com/metadata');
      expect(dbDoc.total_chars).toBe(body.length);
    });
  });
});
