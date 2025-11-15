/**
 * ChromaDB Integration Tests
 * Tests the ChromaDB service with both local and cloud mode detection
 */

const chromaService = require('../../src/services/chromaService');

describe('ChromaDB Integration Tests', () => {
  beforeAll(async () => {
    // Clean up any existing connection
    chromaService.isConnected = false;
    chromaService.client = null;
    chromaService.collection = null;
  });

  afterAll(async () => {
    // Clean up test data after all tests
    if (chromaService.isConnected) {
      try {
        await chromaService.clearAll();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Client Type Detection', () => {
    it('should detect local mode when CHROMA_TENANT is not set', () => {
      // The current .env.test has no CHROMA_TENANT, so it should use local mode
      const hasCloudConfig = !!process.env.CHROMA_TENANT;
      expect(hasCloudConfig).toBe(false);
    });

    it('should initialize ChromaDB successfully', async () => {
      const result = await chromaService.initialize();

      // ChromaDB might not be running in CI/CD, so we handle both cases
      if (result) {
        expect(chromaService.isConnected).toBe(true);
        expect(chromaService.client).not.toBeNull();
        expect(chromaService.clientType).toBe('local');
      } else {
        // If ChromaDB is not available, initialization should fail gracefully
        expect(chromaService.isConnected).toBe(false);
      }
    }, 10000);
  });

  describe('Collection Operations', () => {
    beforeAll(async () => {
      // Ensure initialized
      if (!chromaService.isConnected) {
        await chromaService.initialize();
      }
    });

    it('should get collection stats', async () => {
      // Skip if ChromaDB not connected
      if (!chromaService.isConnected) {
        console.log('⚠️ Skipping test - ChromaDB not available');
        return;
      }

      const stats = await chromaService.getStats();

      expect(stats.connected).toBe(true);
      expect(stats.collectionName).toBe('lizdeika-collection-2025');
      expect(typeof stats.count).toBe('number');
    });

    it('should add documents to collection', async () => {
      // Skip if ChromaDB not connected
      if (!chromaService.isConnected) {
        console.log('⚠️ Skipping test - ChromaDB not available');
        return;
      }

      const testDocuments = [
        {
          id: 'test-doc-1',
          content: 'This is a test document about integration testing.',
          metadata: { source: 'test', type: 'integration' }
        },
        {
          id: 'test-doc-2',
          content: 'Another test document about ChromaDB functionality.',
          metadata: { source: 'test', type: 'integration' }
        }
      ];

      const result = await chromaService.addDocuments(testDocuments);
      expect(result).toBe(true);

      // Verify documents were added
      const stats = await chromaService.getStats();
      expect(stats.count).toBeGreaterThanOrEqual(2);
    }, 15000);

    it('should search for relevant documents', async () => {
      // Skip if ChromaDB not connected
      if (!chromaService.isConnected) {
        console.log('⚠️ Skipping test - ChromaDB not available');
        return;
      }

      const query = 'integration testing';
      const results = await chromaService.searchContext(query, 2);

      expect(Array.isArray(results)).toBe(true);

      // If documents were added, we should get results
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('content');
        expect(results[0]).toHaveProperty('metadata');
        expect(results[0]).toHaveProperty('distance');
        expect(results[0]).toHaveProperty('id');
      }
    }, 15000);

    it('should retrieve all documents', async () => {
      // Skip if ChromaDB not connected
      if (!chromaService.isConnected) {
        console.log('⚠️ Skipping test - ChromaDB not available');
        return;
      }

      const result = await chromaService.getAllDocuments(10);

      expect(result.connected).toBe(true);
      expect(Array.isArray(result.documents)).toBe(true);
      expect(result.collectionName).toBe('lizdeika-collection-2025');

      // If documents exist, verify structure
      if (result.documents.length > 0) {
        const doc = result.documents[0];
        expect(doc).toHaveProperty('id');
        expect(doc).toHaveProperty('content');
        expect(doc).toHaveProperty('metadata');
      }
    });

    it('should delete specific chunks', async () => {
      // Skip if ChromaDB not connected
      if (!chromaService.isConnected) {
        console.log('⚠️ Skipping test - ChromaDB not available');
        return;
      }

      // First, get some documents to delete
      const allDocs = await chromaService.getAllDocuments(5);

      if (allDocs.documents.length > 0) {
        const idsToDelete = allDocs.documents
          .slice(0, 2)
          .map(doc => doc.id);

        const result = await chromaService.deleteChunks(idsToDelete);
        expect(result.deleted).toBe(idsToDelete.length);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle search when not connected gracefully', async () => {
      const tempService = { ...chromaService };
      tempService.isConnected = false;
      tempService.collection = null;

      const results = await chromaService.searchContext.call(tempService, 'test query');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle stats when not connected', async () => {
      const tempService = { ...chromaService };
      tempService.isConnected = false;
      tempService.collection = null;

      const stats = await chromaService.getStats.call(tempService);

      expect(stats.connected).toBe(false);
      expect(stats.count).toBe(0);
    });
  });

  describe('Embedding Function', () => {
    it('should initialize Mistral embedding function if API key is set', async () => {
      // Skip if ChromaDB not connected
      if (!chromaService.isConnected) {
        console.log('⚠️ Skipping test - ChromaDB not available');
        return;
      }

      const hasMistralKey = !!process.env.MISTRAL_API_KEY &&
                            process.env.MISTRAL_API_KEY !== 'test-mistral-key';

      if (hasMistralKey) {
        expect(chromaService.embeddingFunction).not.toBeNull();
      } else {
        // In test environment with fake key, embedding function might be null
        // This is expected and acceptable
        console.log('ℹ️ Mistral API key not configured - using default embeddings');
      }
    });
  });
});
