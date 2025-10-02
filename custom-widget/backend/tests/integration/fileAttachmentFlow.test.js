/**
 * Integration Tests for File Attachment Flow
 *
 * End-to-end testing of file upload/download functionality including:
 * - Customer upload → message → download flow
 * - Agent upload → response → download flow
 * - Security validation (XSS, path traversal, MIME types)
 * - Database persistence and retrieval
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// Mock AI providers
jest.mock('../../ai-providers', () => ({
    createAIProvider: jest.fn(() => ({
        generateResponse: jest.fn().mockResolvedValue('Mock AI response'),
        healthCheck: jest.fn().mockResolvedValue(true),
        isHealthy: true,
        lastHealthCheck: new Date()
    })),
    retryWithBackoff: jest.fn((fn) => fn())
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('$2b$12$mocked.hash.value'),
    compare: jest.fn().mockResolvedValue(true)
}));

// Set test environment
process.env.AI_PROVIDER = 'flowise';
process.env.FLOWISE_URL = 'http://test-flowise';
process.env.FLOWISE_CHATFLOW_ID = 'test-chatflow';
process.env.NODE_ENV = 'test';

const createApp = require('../../src/app');

describe('File Attachment Integration Flow', () => {
    let app;
    let adminToken;
    let agentToken;

    beforeAll(async () => {
        // Create test app instance
        const appInstance = createApp();
        app = appInstance.app;

        // Login as admin to get token
        const adminResponse = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@vilnius.lt', password: 'admin123' });

        adminToken = adminResponse.body.token;

        // Login as agent
        const agentResponse = await request(app)
            .post('/auth/login')
            .send({ email: 'agent@vilnius.lt', password: 'agent123' });

        agentToken = agentResponse.body.token || adminToken; // Fallback to admin if agent doesn't exist
    });

    describe('Customer Upload Flow', () => {
        it('should complete full customer upload-message-download flow', async () => {
            const conversationId = `test-conv-${uuidv4()}`;

            // Step 1: Upload file
            const uploadResponse = await request(app)
                .post('/api/upload')
                .attach('file', Buffer.from('test-image-data'), {
                    filename: 'customer-upload.png',
                    contentType: 'image/png'
                });

            expect(uploadResponse.status).toBe(200);
            expect(uploadResponse.body.success).toBe(true);
            const fileMetadata = uploadResponse.body.file;
            expect(fileMetadata.url).toMatch(/^\/api\/uploads\//);

            // Step 2: Send message with file metadata
            const messageResponse = await request(app)
                .post('/api/messages')
                .send({
                    conversationId,
                    message: 'Here is my screenshot',
                    visitorId: 'test-visitor',
                    messageType: 'file',
                    fileMetadata
                });

            expect(messageResponse.status).toBe(200);
            expect(messageResponse.body.userMessage).toBeDefined();
            expect(messageResponse.body.userMessage.metadata.file).toMatchObject({
                filename: 'customer-upload.png',
                mimetype: 'image/png',
                url: fileMetadata.url
            });

            // Step 3: Retrieve conversation messages
            const messagesResponse = await request(app)
                .get(`/api/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(messagesResponse.status).toBe(200);
            const messages = messagesResponse.body;
            const fileMessage = messages.find(m => m.messageType === 'file');
            expect(fileMessage).toBeDefined();
            expect(fileMessage.metadata.file.filename).toBe('customer-upload.png');

            // Step 4: Download file (verify it exists)
            const filename = fileMetadata.url.split('/').pop();
            const downloadResponse = await request(app)
                .get(`/api/uploads/${filename}`);

            expect(downloadResponse.status).toBe(200);
        });

        it('should store PDF with caption correctly', async () => {
            const conversationId = `test-conv-${uuidv4()}`;

            // Upload PDF
            const uploadResponse = await request(app)
                .post('/api/upload')
                .attach('file', Buffer.from('%PDF-1.4 test'), {
                    filename: 'document.pdf',
                    contentType: 'application/pdf'
                });

            const fileMetadata = uploadResponse.body.file;

            // Send with custom caption
            const messageResponse = await request(app)
                .post('/api/messages')
                .send({
                    conversationId,
                    message: 'Important contract document',
                    visitorId: 'test-visitor',
                    messageType: 'file',
                    fileMetadata
                });

            expect(messageResponse.status).toBe(200);
            expect(messageResponse.body.userMessage.content).toBe('Important contract document');
            expect(messageResponse.body.userMessage.metadata.file.filename).toBe('document.pdf');
        });

        it('should handle multiple file uploads in same conversation', async () => {
            const conversationId = `test-conv-${uuidv4()}`;
            const files = [];

            // Upload 3 files
            for (let i = 0; i < 3; i++) {
                const uploadResponse = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from(`test-file-${i}`), {
                        filename: `file-${i}.png`,
                        contentType: 'image/png'
                    });

                files.push(uploadResponse.body.file);

                await request(app)
                    .post('/api/messages')
                    .send({
                        conversationId,
                        message: `File ${i}`,
                        visitorId: 'test-visitor',
                        messageType: 'file',
                        fileMetadata: uploadResponse.body.file
                    });
            }

            // Verify all files in conversation
            const messagesResponse = await request(app)
                .get(`/api/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${adminToken}`);

            const fileMessages = messagesResponse.body.filter(m => m.messageType === 'file');
            expect(fileMessages.length).toBe(3);

            // Verify all files downloadable
            for (const file of files) {
                const filename = file.url.split('/').pop();
                const downloadResponse = await request(app)
                    .get(`/api/uploads/${filename}`);

                expect(downloadResponse.status).toBe(200);
            }
        });
    });

    describe('Agent Upload Flow', () => {
        it('should complete agent upload-response-download flow', async () => {
            const conversationId = `test-conv-${uuidv4()}`;

            // Create conversation first
            await request(app)
                .post('/api/messages')
                .send({
                    conversationId,
                    message: 'Customer question',
                    visitorId: 'test-visitor'
                });

            // Upload file as agent
            const uploadResponse = await request(app)
                .post('/api/upload')
                .set('Authorization', `Bearer ${agentToken}`)
                .attach('file', Buffer.from('agent-screenshot'), {
                    filename: 'agent-screenshot.png',
                    contentType: 'image/png'
                });

            expect(uploadResponse.status).toBe(200);
            const fileMetadata = uploadResponse.body.file;

            // Send agent response with file
            const responseMsg = await request(app)
                .post('/api/agent/respond')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({
                    conversationId,
                    message: 'Here is the screenshot',
                    agentId: 'agent1',
                    messageType: 'file',
                    fileMetadata
                });

            expect(responseMsg.status).toBe(200);

            // Verify message in conversation
            const messagesResponse = await request(app)
                .get(`/api/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${adminToken}`);

            const agentMessage = messagesResponse.body.find(m =>
                m.sender === 'agent' && m.messageType === 'file'
            );

            expect(agentMessage).toBeDefined();
            expect(agentMessage.metadata.file.filename).toBe('agent-screenshot.png');
            expect(agentMessage.metadata.responseAttribution).toBeDefined();

            // Verify file downloadable
            const filename = fileMetadata.url.split('/').pop();
            const downloadResponse = await request(app)
                .get(`/api/uploads/${filename}`);

            expect(downloadResponse.status).toBe(200);
        });

        it('should include attribution metadata in agent file uploads', async () => {
            const conversationId = `test-conv-${uuidv4()}`;

            await request(app)
                .post('/api/messages')
                .send({
                    conversationId,
                    message: 'Customer message',
                    visitorId: 'test-visitor'
                });

            const uploadResponse = await request(app)
                .post('/api/upload')
                .attach('file', Buffer.from('test'), {
                    filename: 'test.pdf',
                    contentType: 'application/pdf'
                });

            await request(app)
                .post('/api/agent/respond')
                .send({
                    conversationId,
                    message: 'Agent response',
                    agentId: 'agent1',
                    messageType: 'file',
                    fileMetadata: uploadResponse.body.file,
                    suggestionAction: 'custom'
                });

            const messagesResponse = await request(app)
                .get(`/api/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${adminToken}`);

            const agentMessage = messagesResponse.body.find(m =>
                m.sender === 'agent' && m.messageType === 'file'
            );

            expect(agentMessage.metadata.responseAttribution).toMatchObject({
                responseType: 'custom',
                systemMode: expect.any(String)
            });
        });
    });

    describe('Security Validation', () => {
        it('should reject javascript: URL in customer message', async () => {
            const response = await request(app)
                .post('/api/messages')
                .send({
                    conversationId: `test-conv-${uuidv4()}`,
                    message: 'XSS attack',
                    visitorId: 'test-visitor',
                    messageType: 'file',
                    fileMetadata: {
                        filename: 'xss.png',
                        mimetype: 'image/png',
                        size: 100,
                        url: 'javascript:alert(document.cookie)'
                    }
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('File URL must start with /api/uploads/');
        });

        it('should reject external URL in customer message', async () => {
            const response = await request(app)
                .post('/api/messages')
                .send({
                    conversationId: `test-conv-${uuidv4()}`,
                    message: 'External file',
                    visitorId: 'test-visitor',
                    messageType: 'file',
                    fileMetadata: {
                        filename: 'external.png',
                        mimetype: 'image/png',
                        size: 100,
                        url: 'http://evil.com/malware.png'
                    }
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('File URL must start with /api/uploads/');
        });

        it('should reject invalid MIME type in agent response', async () => {
            const conversationId = `test-conv-${uuidv4()}`;

            await request(app)
                .post('/api/messages')
                .send({
                    conversationId,
                    message: 'Test',
                    visitorId: 'test-visitor'
                });

            const response = await request(app)
                .post('/api/agent/respond')
                .send({
                    conversationId,
                    message: 'Response',
                    agentId: 'agent1',
                    messageType: 'file',
                    fileMetadata: {
                        filename: 'virus.exe',
                        mimetype: 'application/x-executable',
                        size: 1000,
                        url: '/api/uploads/virus.exe'
                    }
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid or disallowed file type');
        });

        it('should reject path traversal in download', async () => {
            const response = await request(app)
                .get('/api/uploads/../../../etc/passwd');

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Access denied');
        });

        it('should reject executable file upload', async () => {
            const response = await request(app)
                .post('/api/upload')
                .attach('file', Buffer.from('fake-exe-data'), {
                    filename: 'virus.exe',
                    contentType: 'application/x-msdownload'
                });

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle missing file metadata gracefully', async () => {
            const response = await request(app)
                .post('/api/messages')
                .send({
                    conversationId: `test-conv-${uuidv4()}`,
                    message: 'No file metadata',
                    visitorId: 'test-visitor',
                    messageType: 'file'
                    // fileMetadata missing
                });

            // Should either accept without file or reject with 400
            expect([200, 400]).toContain(response.status);
        });

        it('should handle missing URL in file metadata', async () => {
            const response = await request(app)
                .post('/api/messages')
                .send({
                    conversationId: `test-conv-${uuidv4()}`,
                    message: 'No URL',
                    visitorId: 'test-visitor',
                    messageType: 'file',
                    fileMetadata: {
                        filename: 'test.png',
                        mimetype: 'image/png'
                        // url missing
                    }
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid file URL');
        });

        it('should handle non-existent file download', async () => {
            const response = await request(app)
                .get('/api/uploads/nonexistent-file-12345.png');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('File not found');
        });
    });
});
