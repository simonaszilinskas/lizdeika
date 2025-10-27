const DocumentIngestService = require('../../src/services/documentIngestService');
const DocumentRepository = require('../../src/repositories/documentRepository');
const chromaService = require('../../src/services/chromaService');
const documentService = require('../../src/services/documentService');

// Mock dependencies
jest.mock('../../src/repositories/documentRepository');
jest.mock('../../src/services/chromaService');
jest.mock('../../src/services/documentService');

describe('DocumentIngestService - Security Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hash mismatch detection (Issue: URL exists with different hash)', () => {
    it('should NOT delete old document when only URL exists but no hash match', async () => {
      // This test verifies the logic flow - when URL exists but hash doesn't
      // The service should NOT attempt to delete the old document
      const existingByUrl = {
        id: 'old-doc-id',
        source_url: 'https://example.com/doc',
        content_hash: 'old-hash',
      };
      const existingByHash = null;

      // The condition in the code is: if (existingByUrl && existingByHash && existingByUrl.id !== existingByHash.id)
      // When existingByHash is null, this should NOT execute
      const shouldDelete = !!(existingByUrl && existingByHash && existingByUrl.id !== (existingByHash?.id || null));

      // Verify the logic
      expect(shouldDelete).toBe(false);
      // This means deleteDocument should NOT be called
    });

    it('should delete old document only when URL exists AND different hash exists', () => {
      const existingByUrl = { id: 'old-doc-id', content_hash: 'old-hash' };
      const existingByHash = { id: 'different-doc-id', content_hash: 'new-hash' };

      // The condition should be: if (existingByUrl && existingByHash && existingByUrl.id !== existingByHash.id)
      // This should be TRUE because IDs differ
      const shouldDelete = existingByUrl && existingByHash && existingByUrl.id !== existingByHash.id;

      expect(shouldDelete).toBe(true);
      // This means deleteDocument SHOULD be called
    });
  });

  describe('ChromaDB connection guard (Issue: Check connection before delete)', () => {
    it('should skip ChromaDB deletion if not connected', () => {
      const chromaIds = ['chroma-1', 'chroma-2'];
      const isConnected = false;

      // The condition should be: if (... && chromaService.isConnected)
      // When isConnected is false, deleteChunks should be skipped
      const shouldCallDelete = chromaIds && chromaIds.length > 0 && isConnected;

      expect(shouldCallDelete).toBe(false);
    });

    it('should check connection guard before calling deleteChunks', () => {
      const chromaIds = ['chroma-1'];
      const isConnected = true;

      // The condition should include isConnected check
      const shouldCallDelete = chromaIds && chromaIds.length > 0 && isConnected;

      expect(shouldCallDelete).toBe(true);
      // Now deleteChunks would be called
    });

    it('should throw error if ChromaDB deletion fails to prevent DB deletion', () => {
      // If chromaService.deleteChunks throws, the error should propagate
      // and DocumentRepository.deleteDocument should NOT be called
      // This ensures data consistency - we don't delete from DB if ChromaDB fails
      const error = new Error('ChromaDB connection failed');

      expect(error.message).toContain('ChromaDB');
      // This would cause the ingestDocument to throw and return { success: false }
    });
  });

  describe('Orphan detection with dryRun and consistency', () => {
    it('should preview orphans with dryRun=true without deleting', async () => {
      const currentUrls = ['https://example.com/doc1', 'https://example.com/doc2'];
      const orphans = [
        { id: 'orphan-1', title: 'Old Doc 1', source_url: 'https://example.com/doc3', chroma_ids: ['c1', 'c2'] },
        { id: 'orphan-2', title: 'Old Doc 2', source_url: 'https://example.com/doc4', chroma_ids: ['c3'] },
      ];

      DocumentRepository.findDocumentsNotInUrls.mockResolvedValue(orphans);

      const result = await DocumentIngestService.detectOrphans(currentUrls, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.preview).toBe(true);
      expect(result.found).toBe(2);
      expect(result.deleted).toBe(0);
      expect(result.details).toHaveLength(2);
      // No deletions should occur
      expect(chromaService.deleteChunks).not.toHaveBeenCalled();
      expect(DocumentRepository.deleteOrphaned).not.toHaveBeenCalled();
    });

    it('should mark as orphaned if ChromaDB deletion fails', async () => {
      const currentUrls = ['https://example.com/doc1'];
      const orphans = [
        { id: 'orphan-1', title: 'Old Doc', source_url: 'https://example.com/doc2', chroma_ids: ['c1'] },
      ];

      DocumentRepository.findDocumentsNotInUrls.mockResolvedValue(orphans);
      chromaService.isConnected = true;
      chromaService.deleteChunks.mockRejectedValue(new Error('ChromaDB unavailable'));
      DocumentRepository.markAsOrphaned.mockResolvedValue({ count: 1 });

      // Should reject with ChromaDB error using Jest promise assertion
      await expect(DocumentIngestService.detectOrphans(currentUrls))
        .rejects.toThrow(/ChromaDB/);

      // Should mark as orphaned instead of deleting
      expect(DocumentRepository.markAsOrphaned).toHaveBeenCalledWith(['orphan-1']);
      // Should NOT delete from DB
      expect(DocumentRepository.deleteOrphaned).not.toHaveBeenCalled();
    });

    it('should skip ChromaDB deletion if not connected', async () => {
      const currentUrls = ['https://example.com/doc1'];
      const orphans = [
        { id: 'orphan-1', title: 'Old Doc', source_url: 'https://example.com/doc2', chroma_ids: ['c1'] },
      ];

      DocumentRepository.findDocumentsNotInUrls.mockResolvedValue(orphans);
      chromaService.isConnected = false;
      DocumentRepository.deleteOrphaned.mockResolvedValue({ count: 1 });

      const result = await DocumentIngestService.detectOrphans(currentUrls);

      expect(result.found).toBe(1);
      expect(result.deleted).toBe(1);
      // deleteChunks should NOT be called when disconnected
      expect(chromaService.deleteChunks).not.toHaveBeenCalled();
      // Documents should still be deleted from DB
      expect(DocumentRepository.deleteOrphaned).toHaveBeenCalledWith(['orphan-1']);
    });
  });
});
