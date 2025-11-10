/**
 * Upload Security Integration Tests
 *
 * Tests complete upload flow with real database and filesystem:
 * - File storage in external volume (/var/uploads)
 * - File retrieval with access control
 * - Authentication requirements
 * - Rate limiting enforcement
 * - File type validation
 * - Directory traversal prevention
 *
 * These tests verify the end-to-end security of the upload system.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');

const {
  createTestAgent,
  createTestCustomer,
  createTestConversation,
} = require('./helpers/testData');

const { createTestApp, cleanupWebSocketService } = require('./helpers/apiHelpers');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Upload Security Integration Tests', () => {
  let prisma;
  let app;
  let websocketService;
  let testUploadsDir;
  let agent;
  let customer;
  let conversation;

  beforeAll(async () => {
    // CRITICAL: Set UPLOADS_DIR BEFORE creating the app
    // The app loads routes at module level which read UPLOADS_DIR
    // Setting it after app creation will cause stale config
    testUploadsDir = path.join(os.tmpdir(), `uploads-test-${Date.now()}`);
    fs.mkdirSync(testUploadsDir, { recursive: true });
    process.env.UPLOADS_DIR = testUploadsDir;

    // Now initialize database and create app (which reads UPLOADS_DIR from env)
    prisma = await initializeTestDatabase();
    const result = createTestApp();
    app = result.app;
    websocketService = result.websocketService;
  });

  afterAll(async () => {
    // Clean up WebSocket service to prevent timer leaks
    cleanupWebSocketService(websocketService);
    await closeTestDatabase();

    // Clean up test uploads directory
    if (fs.existsSync(testUploadsDir)) {
      fs.rmSync(testUploadsDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    await resetTestDatabase();

    // Clear test uploads directory
    if (fs.existsSync(testUploadsDir)) {
      const files = fs.readdirSync(testUploadsDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testUploadsDir, file));
      });
    }

    // Create test data
    agent = await createTestAgent(prisma);
    customer = await createTestCustomer(prisma);
    conversation = await createTestConversation(prisma, customer.id);
  });

  describe('File Upload - External Volume Storage', () => {
    test('should store uploaded text file in external volume', async () => {
      const fileContent = 'This is a test file for upload security testing.';
      const fileName = 'test-document.txt';

      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from(fileContent), fileName);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file).toBeDefined();
      expect(response.body.file.storedFilename).toBeDefined();

      // Verify file exists in external volume, NOT in codebase
      const storedFilename = response.body.file.storedFilename;
      const filePath = path.join(testUploadsDir, storedFilename);

      expect(fs.existsSync(filePath)).toBe(true);

      // Verify file content
      const fileContentOnDisk = fs.readFileSync(filePath, 'utf-8');
      expect(fileContentOnDisk).toBe(fileContent);

      // Verify NOT in codebase
      const codebaseUploadPath = path.join(__dirname, '../../uploads', storedFilename);
      expect(fs.existsSync(codebaseUploadPath)).toBe(false);
    });

    test('should store uploaded image file in external volume', async () => {
      // 1x1 PNG image (smallest valid PNG)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
        0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
        0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0xf8, 0x0f, 0x00, 0x00, 0x01, 0x01,
        0x01, 0x00, 0x1b, 0xb6, 0xee, 0x56, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', pngBuffer, 'test-image.png');

      expect(response.status).toBe(200);
      expect(response.body.file.mimetype).toBe('image/png');

      // Verify file on disk
      const filePath = path.join(testUploadsDir, response.body.file.storedFilename);
      expect(fs.existsSync(filePath)).toBe(true);

      const fileOnDisk = fs.readFileSync(filePath);
      expect(fileOnDisk).toEqual(pngBuffer);
    });

    test('should assign UUID prefix to prevent filename collisions', async () => {
      const fileContent = 'Test file 1';

      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from(fileContent), 'test.txt');

      expect(response.body.file.storedFilename).toMatch(/^[0-9a-f-]+-test\.txt$/);
      // UUID pattern: 8-4-4-4-12 hex digits
      expect(response.body.file.storedFilename).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-/);
    });

    test('should sanitize special characters in filenames', async () => {
      const fileContent = 'Test';
      const dirtyFilename = 'test file (final#2).txt';

      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from(fileContent), dirtyFilename);

      expect(response.status).toBe(200);
      // Original filename preserved
      expect(response.body.file.filename).toBe(dirtyFilename);
      // Stored filename has special chars sanitized
      expect(response.body.file.storedFilename).not.toContain('#');
      expect(response.body.file.storedFilename).not.toContain('(');
    });
  });

  describe('File Retrieval - Access Control', () => {
    test('authenticated agent should retrieve uploaded file', async () => {
      // Agent uploads file
      const fileContent = 'Secret agent document';
      const uploadResponse = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from(fileContent), 'test.txt');

      expect(uploadResponse.status).toBe(200);

      // Agent retrieves file with token
      const retrieveResponse = await request(app)
        .get(`/api/uploads/${uploadResponse.body.file.storedFilename}`)
        .set('Authorization', `Bearer ${agent.token}`);

      expect(retrieveResponse.status).toBe(200);
      expect(retrieveResponse.text).toBe(fileContent);
    });

    test('unauthenticated user should not retrieve file without conversationId', async () => {
      const uploadResponse = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from('test'), 'test.txt');

      expect(uploadResponse.status).toBe(200);

      // Try to retrieve without auth or conversationId
      const retrieveResponse = await request(app)
        .get(`/api/uploads/${uploadResponse.body.file.storedFilename}`);

      expect(retrieveResponse.status).toBe(403);
      expect(retrieveResponse.body.error).toContain('Access denied');
    });

    test('customer with valid conversationId should retrieve file', async () => {
      // Upload file to conversation
      const uploadResponse = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from('customer file'), 'test.txt');

      expect(uploadResponse.status).toBe(200);

      // Customer retrieves with conversationId
      const retrieveResponse = await request(app)
        .get(`/api/uploads/${uploadResponse.body.file.storedFilename}`)
        .query({ conversationId: conversation.id });

      expect(retrieveResponse.status).toBe(200);
    });

    test('should reject requests with invalid conversationId', async () => {
      const uploadResponse = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from('test'), 'test.txt');

      // Try with wrong conversation ID
      const retrieveResponse = await request(app)
        .get(`/api/uploads/${uploadResponse.body.file.storedFilename}`)
        .query({ conversationId: 'wrong-conversation-id' });

      expect(retrieveResponse.status).toBe(403);
    });
  });

  describe('Authentication Requirements', () => {
    test('should reject upload without authentication or conversationId', async () => {
      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test'), 'test.txt');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication');
    });

    test('authenticated agent should upload without conversationId', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${agent.token}`)
        .attach('file', Buffer.from('agent file'), 'test.txt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('customer should upload with valid conversationId', async () => {
      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from('customer file'), 'test.txt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('File Type Validation', () => {
    test('should accept image files', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
        0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
        0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0xf8, 0x0f, 0x00, 0x00, 0x01, 0x01,
        0x01, 0x00, 0x1b, 0xb6, 0xee, 0x56, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', pngBuffer, 'image.png');

      expect(response.status).toBe(200);
    });

    test('should accept text files', async () => {
      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from('plain text'), 'document.txt');

      expect(response.status).toBe(200);
    });

    test('should accept PDF files', async () => {
      // Minimal PDF header
      const pdfBuffer = Buffer.from('%PDF-1.4\n%EOF');

      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', pdfBuffer, 'document.pdf');

      expect(response.status).toBe(200);
    });

    test('should reject executable files', async () => {
      const executableBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // ELF header

      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', executableBuffer, 'malware.elf');

      // Should reject based on file extension or MIME type
      // The actual behavior depends on file detection method
      expect([400, 413]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    test('should allow 5 uploads per minute', async () => {
      const results = [];

      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/upload')
          .field('conversationId', conversation.id)
          .attach('file', Buffer.from(`file ${i}`), `test${i}.txt`);

        results.push(response.status);
      }

      // All 5 should succeed
      expect(results).toEqual([200, 200, 200, 200, 200]);
    });

    test('should block 6th upload within same minute', async () => {
      // Upload 5 files successfully
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/upload')
          .field('conversationId', conversation.id)
          .attach('file', Buffer.from(`file ${i}`), `test${i}.txt`);
      }

      // 6th upload should be blocked
      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from('blocked'), 'blocked.txt');

      expect(response.status).toBe(429); // Too Many Requests
      expect(response.body.error).toContain('Too many upload attempts');
    });

    test('rate limit should be per IP address', async () => {
      // Both requests from same IP should share rate limit
      const results = [];

      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/upload')
          .field('conversationId', conversation.id)
          .attach('file', Buffer.from(`file ${i}`), `test${i}.txt`);

        results.push(response.status);
      }

      // 6th request should be blocked
      const blockedResponse = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from('blocked'), 'blocked.txt');

      expect(blockedResponse.status).toBe(429);
    });
  });

  describe('Directory Traversal Prevention', () => {
    test('should prevent directory traversal in filename', async () => {
      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id)
        .attach('file', Buffer.from('malicious'), '../../../etc/passwd');

      expect(response.status).toBe(200);

      // File should be stored with traversal chars sanitized
      const storedFilename = response.body.file.storedFilename;
      expect(storedFilename).not.toContain('..');
      expect(storedFilename).not.toContain('/');

      // Verify actual file location
      const filePath = path.join(testUploadsDir, storedFilename);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('file retrieval should prevent directory traversal attacks', async () => {
      // Try to retrieve file outside allowed directory
      const response = await request(app)
        .get('/api/uploads/../../../../etc/passwd')
        .set('Authorization', `Bearer ${agent.token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });
  });

  describe('Error Handling', () => {
    test('should return 400 when no file provided', async () => {
      const response = await request(app)
        .post('/api/upload')
        .field('conversationId', conversation.id);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No file uploaded');
    });

    test('should return 404 when retrieving non-existent file', async () => {
      const response = await request(app)
        .get('/api/uploads/non-existent-file.txt')
        .set('Authorization', `Bearer ${agent.token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });
});
