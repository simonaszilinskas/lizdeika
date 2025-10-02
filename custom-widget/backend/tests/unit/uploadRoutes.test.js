/**
 * Unit Tests for Upload Routes
 *
 * Tests file upload/download functionality including:
 * - Upload success cases (images, PDFs, documents)
 * - Upload failure cases (size limits, invalid types)
 * - Download security (path traversal, authentication)
 * - Metadata generation and validation
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies
jest.mock('../../src/middleware/authMiddleware', () => ({
    optionalAuth: (req, res, next) => {
        // Mock auth middleware - check for authorization header
        if (req.headers.authorization) {
            const token = req.headers.authorization.replace('Bearer ', '');
            if (token === 'admin-token') {
                req.user = { id: 'admin', role: 'admin' };
            } else if (token === 'agent-token') {
                req.user = { id: 'agent1', role: 'agent' };
            }
        }
        next();
    }
}));

jest.mock('../../utils/database', () => ({
    getClient: jest.fn(() => ({
        messages: {
            findFirst: jest.fn()
        }
    }))
}));

describe('Upload Routes', () => {
    let app;
    let testUploadsDir;

    beforeAll(() => {
        // Create test Express app
        app = express();
        app.use(express.json());

        // Create temporary uploads directory for tests
        testUploadsDir = path.join(__dirname, '../fixtures/test-uploads');
        if (!fs.existsSync(testUploadsDir)) {
            fs.mkdirSync(testUploadsDir, { recursive: true });
        }

        // Mock the uploads directory path
        const uploadRoutes = require('../../src/routes/uploadRoutes');

        // Replace uploadsDir with test directory
        const originalModule = require.cache[require.resolve('../../src/routes/uploadRoutes')];
        if (originalModule) {
            delete require.cache[require.resolve('../../src/routes/uploadRoutes')];
        }

        app.use('/api', uploadRoutes);
    });

    afterAll(() => {
        // Clean up test uploads directory
        if (fs.existsSync(testUploadsDir)) {
            const files = fs.readdirSync(testUploadsDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(testUploadsDir, file));
            });
            fs.rmdirSync(testUploadsDir);
        }
    });

    describe('POST /api/upload', () => {
        describe('Success Cases', () => {
            it('should upload valid image (JPEG)', async () => {
                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from('fake-image-data'), {
                        filename: 'test-image.jpg',
                        contentType: 'image/jpeg'
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.file).toHaveProperty('filename', 'test-image.jpg');
                expect(response.body.file).toHaveProperty('mimetype', 'image/jpeg');
                expect(response.body.file).toHaveProperty('url');
                expect(response.body.file.url).toMatch(/^\/api\/uploads\//);
                expect(response.body.file).toHaveProperty('storedFilename');
                expect(response.body.file.storedFilename).toMatch(/^[a-f0-9-]+-test-image\.jpg$/);
            });

            it('should upload valid PNG image', async () => {
                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from('fake-png-data'), {
                        filename: 'screenshot.png',
                        contentType: 'image/png'
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.file.mimetype).toBe('image/png');
            });

            it('should upload valid PDF', async () => {
                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from('%PDF-1.4 fake pdf'), {
                        filename: 'document.pdf',
                        contentType: 'application/pdf'
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.file.mimetype).toBe('application/pdf');
            });

            it('should upload valid DOCX document', async () => {
                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from('fake-docx-data'), {
                        filename: 'report.docx',
                        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.file.mimetype).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            });

            it('should generate UUID-prefixed filename', async () => {
                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from('test'), {
                        filename: 'myfile.png',
                        contentType: 'image/png'
                    });

                const storedFilename = response.body.file.storedFilename;
                const parts = storedFilename.split('-');

                // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-filename.ext
                expect(parts.length).toBeGreaterThan(5);
                expect(storedFilename).toMatch(/^[a-f0-9-]+-myfile\.png$/);
            });

            it('should sanitize special characters in filename', async () => {
                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from('test'), {
                        filename: 'file with spaces & special!.png',
                        contentType: 'image/png'
                    });

                expect(response.status).toBe(200);
                const storedFilename = response.body.file.storedFilename;
                expect(storedFilename).toMatch(/^[a-f0-9-]+_file_with_spaces___special_\.png$/);
            });
        });

        describe('Failure Cases', () => {
            it('should reject file larger than 10MB', async () => {
                // Create buffer larger than 10MB
                const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', largeBuffer, {
                        filename: 'large-file.png',
                        contentType: 'image/png'
                    });

                expect(response.status).toBe(500);
                expect(response.body.success).toBe(false);
            });

            it('should reject disallowed MIME type (executable)', async () => {
                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from('fake-exe-data'), {
                        filename: 'virus.exe',
                        contentType: 'application/x-executable'
                    });

                expect(response.status).toBe(500);
                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('Invalid file type');
            });

            it('should reject disallowed MIME type (JavaScript)', async () => {
                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from('alert(1)'), {
                        filename: 'script.js',
                        contentType: 'application/javascript'
                    });

                expect(response.status).toBe(500);
                expect(response.body.success).toBe(false);
            });

            it('should reject when no file provided', async () => {
                const response = await request(app)
                    .post('/api/upload')
                    .send({});

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('No file uploaded');
            });
        });
    });

    describe('GET /api/uploads/:filename', () => {
        let testFilename;

        beforeAll(() => {
            // Create a test file
            testFilename = `${uuidv4()}-test.png`;
            const testFilePath = path.join(testUploadsDir, testFilename);
            fs.writeFileSync(testFilePath, 'test-file-content');
        });

        describe('Path Traversal Protection', () => {
            it('should reject path traversal with ../', async () => {
                const response = await request(app)
                    .get('/api/uploads/../secret.log');

                expect(response.status).toBe(403);
                expect(response.body.success).toBe(false);
                expect(response.body.error).toBe('Access denied');
            });

            it('should reject path traversal to sibling directory', async () => {
                const response = await request(app)
                    .get('/api/uploads/../uploads_secret/secret.txt');

                expect(response.status).toBe(403);
                expect(response.body.success).toBe(false);
            });

            it('should reject URL-encoded path traversal', async () => {
                const response = await request(app)
                    .get('/api/uploads/..%2F..%2Fetc%2Fpasswd');

                expect(response.status).toBe(403);
                expect(response.body.success).toBe(false);
            });

            it('should accept valid file path', async () => {
                const response = await request(app)
                    .get(`/api/uploads/${testFilename}`);

                expect(response.status).toBe(200);
                expect(response.text).toBe('test-file-content');
            });
        });

        describe('File Not Found', () => {
            it('should return 404 for non-existent file', async () => {
                const response = await request(app)
                    .get('/api/uploads/nonexistent-file.png');

                expect(response.status).toBe(404);
                expect(response.body.success).toBe(false);
                expect(response.body.error).toBe('File not found');
            });
        });

        describe('Access Control', () => {
            it('should allow admin to access files', async () => {
                const response = await request(app)
                    .get(`/api/uploads/${testFilename}`)
                    .set('Authorization', 'Bearer admin-token');

                expect(response.status).toBe(200);
            });

            it('should allow agent to access files', async () => {
                const response = await request(app)
                    .get(`/api/uploads/${testFilename}`)
                    .set('Authorization', 'Bearer agent-token');

                expect(response.status).toBe(200);
            });

            it('should allow unauthenticated customer to access files', async () => {
                const response = await request(app)
                    .get(`/api/uploads/${testFilename}`);

                expect(response.status).toBe(200);
            });
        });
    });
});
