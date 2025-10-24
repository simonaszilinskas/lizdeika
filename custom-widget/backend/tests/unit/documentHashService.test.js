const DocumentHashService = require('../../src/services/documentHashService');

describe('DocumentHashService', () => {
  describe('computeHash', () => {
    it('should compute SHA256 hash of content', () => {
      const content = 'Hello World';
      const hash = DocumentHashService.computeHash(content);
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA256 hex = 64 chars
    });

    it('should return same hash for same content', () => {
      const content = 'Test content for hashing';
      const hash1 = DocumentHashService.computeHash(content);
      const hash2 = DocumentHashService.computeHash(content);
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different content', () => {
      const hash1 = DocumentHashService.computeHash('Content 1');
      const hash2 = DocumentHashService.computeHash('Content 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for empty content', () => {
      expect(() => {
        DocumentHashService.computeHash('');
      }).toThrow('Content must be a non-empty string');
    });

    it('should throw error for non-string content', () => {
      expect(() => {
        DocumentHashService.computeHash(null);
      }).toThrow('Content must be a non-empty string');

      expect(() => {
        DocumentHashService.computeHash(123);
      }).toThrow('Content must be a non-empty string');
    });

    it('should produce correct hash', () => {
      // Verify against known SHA256 hash
      const content = 'test';
      const hash = DocumentHashService.computeHash(content);
      // SHA256 of 'test' = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
      const expectedHash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b';
      expect(hash.substring(0, 40)).toBe(expectedHash);
    });
  });

  describe('compareContent', () => {
    it('should return true for identical content', () => {
      const content = 'Same content';
      const result = DocumentHashService.compareContent(content, content);
      expect(result).toBe(true);
    });

    it('should return false for different content', () => {
      const result = DocumentHashService.compareContent('Content 1', 'Content 2');
      expect(result).toBe(false);
    });

    it('should return false when one content is empty', () => {
      const result = DocumentHashService.compareContent('Content', '');
      expect(result).toBe(false);
    });
  });

  describe('compareHash', () => {
    it('should return true when hash matches content', () => {
      const content = 'Test content';
      const hash = DocumentHashService.computeHash(content);
      const result = DocumentHashService.compareHash(hash, content);
      expect(result).toBe(true);
    });

    it('should return false when hash does not match content', () => {
      const hash = DocumentHashService.computeHash('Original content');
      const result = DocumentHashService.compareHash(hash, 'Different content');
      expect(result).toBe(false);
    });

    it('should return false with wrong hash', () => {
      const result = DocumentHashService.compareHash(
        '0000000000000000000000000000000000000000000000000000000000000000',
        'Any content'
      );
      expect(result).toBe(false);
    });
  });

  describe('normalizeContent', () => {
    it('should normalize Windows line endings to Unix', () => {
      const content = 'Line 1\r\nLine 2\r\nLine 3';
      const normalized = DocumentHashService.normalizeContent(content);
      expect(normalized).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should normalize old Mac line endings to Unix', () => {
      const content = 'Line 1\rLine 2\rLine 3';
      const normalized = DocumentHashService.normalizeContent(content);
      expect(normalized).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should trim leading and trailing whitespace', () => {
      const content = '  \n  Test content  \n  ';
      const normalized = DocumentHashService.normalizeContent(content);
      expect(normalized).toBe('Test content');
    });

    it('should return empty string for null content', () => {
      const normalized = DocumentHashService.normalizeContent(null);
      expect(normalized).toBe('');
    });

    it('should return empty string for empty content', () => {
      const normalized = DocumentHashService.normalizeContent('');
      expect(normalized).toBe('');
    });

    it('should handle whitespace-only content', () => {
      const normalized = DocumentHashService.normalizeContent('   \n\n\t  ');
      expect(normalized).toBe('');
    });
  });

  describe('computeNormalizedHash', () => {
    it('should produce same hash for content with different line endings', () => {
      const content1 = 'Line 1\r\nLine 2\r\nLine 3';
      const content2 = 'Line 1\nLine 2\nLine 3';
      const hash1 = DocumentHashService.computeNormalizedHash(content1);
      const hash2 = DocumentHashService.computeNormalizedHash(content2);
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash for content with old Mac line endings', () => {
      const content1 = 'Line 1\rLine 2\rLine 3';
      const content2 = 'Line 1\nLine 2\nLine 3';
      const hash1 = DocumentHashService.computeNormalizedHash(content1);
      const hash2 = DocumentHashService.computeNormalizedHash(content2);
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash for content with different whitespace', () => {
      const content1 = '  Test content  ';
      const content2 = 'Test content';
      const hash1 = DocumentHashService.computeNormalizedHash(content1);
      const hash2 = DocumentHashService.computeNormalizedHash(content2);
      expect(hash1).toBe(hash2);
    });
  });
});
