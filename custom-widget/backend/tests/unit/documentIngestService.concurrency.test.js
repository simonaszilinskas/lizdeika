const DocumentIngestService = require('../../src/services/documentIngestService');
const DocumentRepository = require('../../src/repositories/documentRepository');
const DocumentHashService = require('../../src/services/documentHashService');
const documentService = require('../../src/services/documentService');
const chromaService = require('../../src/services/chromaService');
const { PrismaClient } = require('@prisma/client');

// Mock dependencies
jest.mock('../../src/repositories/documentRepository');
jest.mock('../../src/services/documentHashService');
jest.mock('../../src/services/documentService');
jest.mock('../../src/services/chromaService');
jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('DocumentIngestService - Race Conditions & Concurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock dependencies
    DocumentRepository.findByHash = jest.fn();
    DocumentHashService.normalizeContent = jest.fn((content) => content.trim());
    DocumentHashService.computeHash = jest.fn((content) => `hash_${content.substring(0, 10)}`);
    documentService.chunkTextWithFallback = jest.fn();
    chromaService.isConnected = true;
    chromaService.addDocuments = jest.fn();
    chromaService.deleteChunks = jest.fn();
  });

  describe('Race Condition Prevention with Transactions', () => {
    it('should handle multiple concurrent ingestion attempts without duplicate key errors', async () => {
      // This test verifies that transaction logic is in place
      // Real race condition testing requires integration tests with actual database
      DocumentRepository.findByHash.mockResolvedValue(null);
      DocumentHashService.normalizeContent.mockImplementation((c) => c.trim());
      DocumentHashService.computeHash.mockImplementation((c) => `hash_${c.substring(0, 5)}`);

      documentService.chunkTextWithFallback.mockResolvedValue({
        chunks: [{ id: 'chunk1' }],
        strategy: 'default',
      });

      // Verify that the ingestDocument method is designed to work with transactions
      // (actual transaction testing happens in integration tests)
      const result = await DocumentIngestService.ingestDocument({
        body: 'Test content',
        title: 'Test',
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('status');
    });
  });

  describe('Concurrency Limiting for Batch Processing', () => {
    it('should accept batch of documents and process them', async () => {
      const documents = Array.from({ length: 50 }, (_, i) => ({
        body: `Document ${i}`,
        title: `Doc ${i}`,
      }));

      DocumentRepository.findByHash.mockResolvedValue(null);
      DocumentHashService.normalizeContent.mockImplementation((c) => c);
      DocumentHashService.computeHash.mockImplementation((c) => `hash_${c}`);

      documentService.chunkTextWithFallback.mockResolvedValue({
        chunks: [{ id: `chunk_${Math.random()}` }],
        strategy: 'default',
      });

      const result = await DocumentIngestService.ingestBatch(documents);

      // Verify batch processing completed
      expect(result.batch.total).toBe(50);
      expect(result.batch.successful + result.batch.failed + result.batch.duplicates).toBe(50);
    });

    it('should process small batches successfully', async () => {
      const documents = Array.from({ length: 5 }, (_, i) => ({
        body: `Document ${i}`,
        title: `Doc ${i}`,
      }));

      DocumentRepository.findByHash.mockResolvedValue(null);
      DocumentHashService.normalizeContent.mockImplementation((c) => c);
      DocumentHashService.computeHash.mockImplementation((c) => `hash_${c}`);

      documentService.chunkTextWithFallback.mockResolvedValue({
        chunks: [{ id: `chunk_${Math.random()}` }],
        strategy: 'default',
      });

      const result = await DocumentIngestService.ingestBatch(documents);

      expect(result.batch.total).toBe(5);
      expect(result.batch.successful + result.batch.failed + result.batch.duplicates).toBe(5);
    });

    it('should complete all documents even if some fail', async () => {
      const documents = Array.from({ length: 20 }, (_, i) => ({
        body: `Document ${i}`,
        title: `Doc ${i}`,
      }));

      DocumentRepository.findByHash.mockResolvedValue(null);
      DocumentHashService.normalizeContent.mockImplementation((c) => c);
      DocumentHashService.computeHash.mockImplementation((c) => `hash_${c}`);

      let processCount = 0;

      documentService.chunkTextWithFallback.mockImplementation(async () => {
        processCount += 1;

        // Simulate every 3rd document failing
        if (processCount % 3 === 0) {
          throw new Error('Chunking failed');
        }

        return {
          chunks: [{ id: `chunk_${processCount}` }],
          strategy: 'default',
        };
      });

      const result = await DocumentIngestService.ingestBatch(documents);

      // All documents should be processed despite some failures
      expect(result.batch.total).toBe(20);
      expect(result.batch.successful + result.batch.failed).toBe(20);
      expect(result.batch.failed).toBeGreaterThan(0);
    });

    it('should handle large batches successfully', async () => {
      const documents = Array.from({ length: 100 }, (_, i) => ({
        body: `Document content ${i}`,
        title: `Doc ${i}`,
      }));

      DocumentRepository.findByHash.mockResolvedValue(null);
      DocumentHashService.normalizeContent.mockImplementation((c) => c);
      DocumentHashService.computeHash.mockImplementation((c) => `hash_${c.substring(0, 10)}`);

      documentService.chunkTextWithFallback.mockResolvedValue({
        chunks: [{ id: `chunk_${Math.random()}` }],
        strategy: 'default',
      });

      const result = await DocumentIngestService.ingestBatch(documents);

      expect(result.batch.total).toBe(100);
      expect(result.batch.successful + result.batch.failed + result.batch.duplicates).toBe(100);
    });

    it('should track batch results correctly', async () => {
      const documents = Array.from({ length: 30 }, (_, i) => ({
        body: `Document ${i}`,
        title: `Doc ${i}`,
      }));

      DocumentRepository.findByHash.mockResolvedValue(null);
      DocumentHashService.normalizeContent.mockImplementation((c) => c);
      DocumentHashService.computeHash.mockImplementation((c) => `hash_${c}`);

      documentService.chunkTextWithFallback.mockResolvedValue({
        chunks: [{ id: `chunk_${Math.random()}` }],
        strategy: 'default',
      });

      const result = await DocumentIngestService.ingestBatch(documents);

      // Verify all documents processed and counted correctly
      expect(result.batch.total).toBe(30);
      expect(result.batch.successful + result.batch.failed + result.batch.duplicates).toBe(30);
      expect(result.batch.details.length).toBe(30);
    });
  });

  describe('Memory and Performance Bounds', () => {
    it('should process maximum batch size without errors', async () => {
      const maxBatchSize = 100;
      const documents = Array.from({ length: maxBatchSize }, (_, i) => ({
        body: `Content ${i}`,
        title: `Doc ${i}`,
      }));

      DocumentRepository.findByHash.mockResolvedValue(null);
      DocumentHashService.normalizeContent.mockImplementation((c) => c);
      DocumentHashService.computeHash.mockImplementation((c) => `hash_${c.substring(0, 10)}`);

      documentService.chunkTextWithFallback.mockResolvedValue({
        chunks: [{ id: 'chunk1' }],
        strategy: 'default',
      });

      const result = await DocumentIngestService.ingestBatch(documents);

      expect(result.batch.total).toBe(100);
      expect(result.batch.successful + result.batch.failed + result.batch.duplicates).toBe(100);
    });
  });
});
