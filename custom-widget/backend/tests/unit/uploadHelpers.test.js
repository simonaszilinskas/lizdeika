/**
 * Upload Helper Functions Tests
 *
 * Tests pure helper functions extracted from uploadRoutes.js:
 * - isPathSafe() - Path traversal prevention
 * - generateFileMetadata() - File metadata generation
 */

const path = require('path');
const { isPathSafe, generateFileMetadata } = require('../../src/routes/uploadRoutes');

describe('Upload Helper Functions', () => {
    describe('isPathSafe', () => {
        const uploadsDir = '/var/app/uploads';

        it('should allow valid file path within uploads directory', () => {
            const requestedPath = path.join(uploadsDir, 'test-file.png');
            expect(isPathSafe(requestedPath, uploadsDir)).toBe(true);
        });

        it('should reject path traversal with ../', () => {
            const requestedPath = path.join(uploadsDir, '../../../etc/passwd');
            expect(isPathSafe(requestedPath, uploadsDir)).toBe(false);
        });

        it('should reject sibling directory access', () => {
            const requestedPath = '/var/app/config/secrets.json';
            expect(isPathSafe(requestedPath, uploadsDir)).toBe(false);
        });

        it('should allow nested subdirectories', () => {
            const requestedPath = path.join(uploadsDir, 'subdir/nested/file.pdf');
            expect(isPathSafe(requestedPath, uploadsDir)).toBe(true);
        });
    });

    describe('generateFileMetadata', () => {
        it('should generate correct metadata from multer file object', () => {
            const multerFile = {
                originalname: 'test-image.png',
                filename: 'abc123-test-image.png',
                path: '/var/app/uploads/abc123-test-image.png',
                mimetype: 'image/png',
                size: 1024
            };

            const metadata = generateFileMetadata(multerFile);

            expect(metadata).toEqual({
                filename: 'test-image.png',
                storedFilename: 'abc123-test-image.png',
                path: '/var/app/uploads/abc123-test-image.png',
                mimetype: 'image/png',
                size: 1024,
                url: '/api/uploads/abc123-test-image.png'
            });
        });

        it('should handle files with special characters in filename', () => {
            const multerFile = {
                originalname: 'my document (final) v2.pdf',
                filename: 'xyz789-my_document__final__v2.pdf',
                path: '/var/app/uploads/xyz789-my_document__final__v2.pdf',
                mimetype: 'application/pdf',
                size: 50000
            };

            const metadata = generateFileMetadata(multerFile);

            expect(metadata.filename).toBe('my document (final) v2.pdf');
            expect(metadata.storedFilename).toBe('xyz789-my_document__final__v2.pdf');
            expect(metadata.url).toBe('/api/uploads/xyz789-my_document__final__v2.pdf');
        });
    });
});
