/**
 * File Validation Utilities
 *
 * Security-critical validation functions for file upload functionality.
 * Used by conversationController and agentController to validate file metadata.
 */

/**
 * Validate file metadata to prevent security vulnerabilities
 *
 * Security checks performed:
 * - URL validation: Must start with /api/uploads/
 * - MIME type allowlisting: Only approved file types
 * - Field whitelisting: Returns only trusted fields
 * - Filename sanitization: Truncates to 255 characters
 *
 * @param {Object} fileMetadata - File metadata from upload
 * @param {string} fileMetadata.url - Relative URL to file (must start with /api/uploads/)
 * @param {string} fileMetadata.mimetype - MIME type of file
 * @param {string} fileMetadata.filename - Original filename
 * @param {string} fileMetadata.storedFilename - UUID-prefixed stored filename
 * @param {number} fileMetadata.size - File size in bytes
 * @returns {Object|null} Sanitized file metadata or null if invalid
 * @throws {Error} If validation fails
 */
function validateFileMetadata(fileMetadata) {
    if (!fileMetadata) return null;

    // Validate URL - must start with /api/uploads/
    if (!fileMetadata.url || typeof fileMetadata.url !== 'string') {
        throw new Error('Invalid file URL');
    }
    if (!fileMetadata.url.startsWith('/api/uploads/')) {
        throw new Error('File URL must start with /api/uploads/');
    }

    // Validate mimetype against allowlist
    const allowedMimetypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ];

    if (!fileMetadata.mimetype || !allowedMimetypes.includes(fileMetadata.mimetype)) {
        throw new Error('Invalid or disallowed file type');
    }

    // Return sanitized metadata (only trusted fields)
    return {
        filename: String(fileMetadata.filename || '').substring(0, 255),
        storedFilename: String(fileMetadata.storedFilename || '').substring(0, 255),
        mimetype: fileMetadata.mimetype,
        size: parseInt(fileMetadata.size) || 0,
        url: fileMetadata.url
    };
}

module.exports = {
    validateFileMetadata
};
