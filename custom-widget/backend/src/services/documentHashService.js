const crypto = require('crypto');

/**
 * Service for computing and comparing document hashes
 * Used for deduplication and change detection
 */
class DocumentHashService {
  /**
   * Compute SHA256 hash of document content
   * @param {string} content - The document content to hash
   * @returns {string} - SHA256 hash as hex string
   */
  static computeHash(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Compare two content pieces and return if they're identical
   * @param {string} content1 - First content
   * @param {string} content2 - Second content
   * @returns {boolean} - True if content is identical
   */
  static compareContent(content1, content2) {
    try {
      const hash1 = this.computeHash(content1);
      const hash2 = this.computeHash(content2);
      return hash1 === hash2;
    } catch {
      return false;
    }
  }

  /**
   * Compare hash with computed hash of content
   * @param {string} hash - Previously computed hash
   * @param {string} content - Content to compare
   * @returns {boolean} - True if hash matches content
   */
  static compareHash(hash, content) {
    const computedHash = this.computeHash(content);
    return hash === computedHash;
  }

  /**
   * Normalize content before hashing for consistent comparison
   * Removes extra whitespace, normalizes line endings
   * @param {string} content - Raw content
   * @returns {string} - Normalized content
   */
  static normalizeContent(content) {
    if (!content || typeof content !== 'string') {
      return '';
    }
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  /**
   * Compute hash of normalized content
   * Useful when comparing content that may have line ending differences
   * @param {string} content - Raw content
   * @returns {string} - SHA256 hash of normalized content
   */
  static computeNormalizedHash(content) {
    const normalized = this.normalizeContent(content);
    return this.computeHash(normalized);
  }
}

module.exports = DocumentHashService;
