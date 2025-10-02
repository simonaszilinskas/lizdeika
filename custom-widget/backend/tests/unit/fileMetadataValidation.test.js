/**
 * Unit Tests for File Metadata Validation
 *
 * Tests the validateFileMetadata() function used in:
 * - conversationController.js (customer uploads)
 * - agentController.js (agent uploads)
 *
 * Validates security-critical checks for:
 * - URL scheme validation (prevent javascript:, data:, external URLs)
 * - MIME type allowlisting
 * - Filename sanitization
 * - Field whitelisting (prevent metadata injection)
 */

// We need to extract the validation function from the controllers
// Since it's defined inline, we'll test it through the controller
const ConversationController = require('../../src/controllers/conversationController');
const AgentController = require('../../src/controllers/agentController');
const conversationService = require('../../src/services/conversationService');
const agentService = require('../../src/services/agentService');
const aiService = require('../../src/services/aiService');

// Mock dependencies
jest.mock('../../src/services/conversationService');
jest.mock('../../src/services/agentService');
jest.mock('../../src/services/aiService');

describe('File Metadata Validation', () => {
    let conversationController;
    let agentController;
    let mockIo;
    let mockReq;
    let mockRes;

    beforeEach(() => {
        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn()
        };

        conversationController = new ConversationController(mockIo);
        agentController = new AgentController(mockIo);

        mockReq = {
            body: {},
            user: { id: 'agent1', role: 'agent' },
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('Mozilla/5.0')
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        // Mock service responses
        conversationService.conversationExists.mockResolvedValue(true);
        conversationService.getConversation.mockResolvedValue({
            id: 'conv1',
            assignedAgent: null
        });
        conversationService.addMessage.mockResolvedValue({ id: 'msg1' });
        agentService.getSystemMode.mockResolvedValue('hitl');
        agentService.getAgent.mockResolvedValue({ id: 'agent1', name: 'Agent' });
        aiService.generateSuggestion.mockResolvedValue({
            response: 'AI response',
            metadata: {}
        });

        jest.clearAllMocks();
    });

    describe('ConversationController - Customer Upload Validation', () => {
        it('should accept valid file metadata with /api/uploads/ URL', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'Here is a file',
                visitorId: 'visitor1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'test.png',
                    storedFilename: 'uuid-123-test.png',
                    mimetype: 'image/png',
                    size: 1024,
                    url: '/api/uploads/uuid-123-test.png'
                }
            };

            await conversationController.sendMessage(mockReq, mockRes);

            expect(mockRes.status).not.toHaveBeenCalledWith(400);
            expect(conversationService.addMessage).toHaveBeenCalled();

            const messageArg = conversationService.addMessage.mock.calls[0][1];
            expect(messageArg.metadata.file).toHaveProperty('url', '/api/uploads/uuid-123-test.png');
        });

        it('should reject javascript: URL scheme', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'XSS attack',
                visitorId: 'visitor1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'xss.png',
                    mimetype: 'image/png',
                    size: 100,
                    url: 'javascript:alert(1)'
                }
            };

            await conversationController.sendMessage(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: expect.stringContaining('File URL must start with /api/uploads/')
            });
            expect(conversationService.addMessage).not.toHaveBeenCalled();
        });

        it('should reject data: URL scheme', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'Data URI',
                visitorId: 'visitor1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'data.png',
                    mimetype: 'image/png',
                    size: 100,
                    url: 'data:image/png;base64,iVBORw0KGgo='
                }
            };

            await conversationController.sendMessage(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: expect.stringContaining('File URL must start with /api/uploads/')
            });
        });

        it('should reject external HTTP URLs', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'External URL',
                visitorId: 'visitor1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'external.png',
                    mimetype: 'image/png',
                    size: 100,
                    url: 'http://evil.com/malware.png'
                }
            };

            await conversationController.sendMessage(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: expect.stringContaining('File URL must start with /api/uploads/')
            });
        });

        it('should reject missing URL field', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'No URL',
                visitorId: 'visitor1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'test.png',
                    mimetype: 'image/png',
                    size: 100
                    // url missing
                }
            };

            await conversationController.sendMessage(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: expect.stringContaining('Invalid file URL')
            });
        });

        it('should reject invalid MIME type', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'Invalid MIME',
                visitorId: 'visitor1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'virus.exe',
                    mimetype: 'application/x-executable',
                    size: 100,
                    url: '/api/uploads/uuid-virus.exe'
                }
            };

            await conversationController.sendMessage(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: expect.stringContaining('Invalid or disallowed file type')
            });
        });

        it('should reject missing MIME type', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'No MIME type',
                visitorId: 'visitor1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'test.png',
                    size: 100,
                    url: '/api/uploads/uuid-test.png'
                    // mimetype missing
                }
            };

            await conversationController.sendMessage(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: expect.stringContaining('Invalid or disallowed file type')
            });
        });

        it('should sanitize filename to 255 characters', async () => {
            const longFilename = 'a'.repeat(300) + '.png';

            mockReq.body = {
                conversationId: 'conv1',
                message: 'Long filename',
                visitorId: 'visitor1',
                messageType: 'file',
                fileMetadata: {
                    filename: longFilename,
                    storedFilename: 'uuid-123-' + longFilename,
                    mimetype: 'image/png',
                    size: 1024,
                    url: '/api/uploads/uuid-123-file.png'
                }
            };

            await conversationController.sendMessage(mockReq, mockRes);

            expect(mockRes.status).not.toHaveBeenCalledWith(400);
            expect(conversationService.addMessage).toHaveBeenCalled();

            const messageArg = conversationService.addMessage.mock.calls[0][1];
            expect(messageArg.metadata.file.filename.length).toBeLessThanOrEqual(255);
        });

        it('should accept all allowed MIME types', async () => {
            const allowedTypes = [
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

            for (const mimetype of allowedTypes) {
                jest.clearAllMocks();

                mockReq.body = {
                    conversationId: 'conv1',
                    message: 'File',
                    visitorId: 'visitor1',
                    messageType: 'file',
                    fileMetadata: {
                        filename: 'test-file',
                        storedFilename: 'uuid-test-file',
                        mimetype: mimetype,
                        size: 1024,
                        url: '/api/uploads/uuid-test-file'
                    }
                };

                await conversationController.sendMessage(mockReq, mockRes);

                expect(mockRes.status).not.toHaveBeenCalledWith(400);
                expect(conversationService.addMessage).toHaveBeenCalled();
            }
        });
    });

    describe('AgentController - Agent Upload Validation', () => {
        it('should accept valid file metadata from agent', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'Agent response with file',
                agentId: 'agent1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'screenshot.png',
                    storedFilename: 'uuid-456-screenshot.png',
                    mimetype: 'image/png',
                    size: 2048,
                    url: '/api/uploads/uuid-456-screenshot.png'
                }
            };

            await agentController.sendResponse(mockReq, mockRes);

            expect(mockRes.status).not.toHaveBeenCalledWith(400);
            expect(conversationService.addMessage).toHaveBeenCalled();

            const messageArg = conversationService.addMessage.mock.calls[0][0];
            expect(messageArg.metadata.file).toHaveProperty('url', '/api/uploads/uuid-456-screenshot.png');
        });

        it('should reject javascript: URL from agent', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'XSS attempt',
                agentId: 'agent1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'xss.png',
                    mimetype: 'image/png',
                    size: 100,
                    url: 'javascript:alert(document.cookie)'
                }
            };

            await agentController.sendResponse(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: expect.stringContaining('File URL must start with /api/uploads/')
            });
            expect(conversationService.addMessage).not.toHaveBeenCalled();
        });

        it('should reject invalid MIME type from agent', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'Invalid file',
                agentId: 'agent1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'script.sh',
                    mimetype: 'application/x-sh',
                    size: 500,
                    url: '/api/uploads/uuid-script.sh'
                }
            };

            await agentController.sendResponse(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: expect.stringContaining('Invalid or disallowed file type')
            });
        });
    });

    describe('Field Whitelisting', () => {
        it('should only return trusted fields (prevent metadata injection)', async () => {
            mockReq.body = {
                conversationId: 'conv1',
                message: 'File with extra fields',
                visitorId: 'visitor1',
                messageType: 'file',
                fileMetadata: {
                    filename: 'test.png',
                    storedFilename: 'uuid-test.png',
                    mimetype: 'image/png',
                    size: 1024,
                    url: '/api/uploads/uuid-test.png',
                    // Extra malicious fields
                    maliciousScript: '<script>alert(1)</script>',
                    adminFlag: true,
                    injectSQL: "'; DROP TABLE messages; --"
                }
            };

            await conversationController.sendMessage(mockReq, mockRes);

            expect(mockRes.status).not.toHaveBeenCalledWith(400);
            expect(conversationService.addMessage).toHaveBeenCalled();

            const messageArg = conversationService.addMessage.mock.calls[0][1];
            const sanitizedMetadata = messageArg.metadata.file;

            // Should only have whitelisted fields
            expect(sanitizedMetadata).toHaveProperty('filename');
            expect(sanitizedMetadata).toHaveProperty('storedFilename');
            expect(sanitizedMetadata).toHaveProperty('mimetype');
            expect(sanitizedMetadata).toHaveProperty('size');
            expect(sanitizedMetadata).toHaveProperty('url');

            // Should NOT have injected fields
            expect(sanitizedMetadata).not.toHaveProperty('maliciousScript');
            expect(sanitizedMetadata).not.toHaveProperty('adminFlag');
            expect(sanitizedMetadata).not.toHaveProperty('injectSQL');
        });
    });
});
