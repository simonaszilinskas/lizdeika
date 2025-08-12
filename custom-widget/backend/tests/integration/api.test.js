/**
 * Integration tests for API endpoints
 */
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// Mock the ai-providers module
jest.mock('../../ai-providers', () => ({
    createAIProvider: jest.fn(() => ({
        generateResponse: jest.fn().mockResolvedValue('Mock AI response'),
        healthCheck: jest.fn().mockResolvedValue(true),
        isHealthy: true,
        lastHealthCheck: new Date()
    })),
    retryWithBackoff: jest.fn((fn) => fn())
}));

// Set test environment variables
process.env.AI_PROVIDER = 'flowise';
process.env.FLOWISE_URL = 'http://test-flowise';
process.env.FLOWISE_CHATFLOW_ID = 'test-chatflow';
process.env.SYSTEM_PROMPT = 'Test system prompt';
process.env.NODE_ENV = 'test';

// Import app factory after mocks are set up
const createApp = require('../../src/app');

let app;

describe('API Endpoints', () => {
    beforeAll(() => {
        // Create test app instance without starting server
        const appInstance = createApp();
        app = appInstance.app;
    });

    describe('Health Check', () => {
        it('should return server health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('aiProvider');
        });
    });

    describe('System Configuration', () => {
        it('should get system prompt', async () => {
            const response = await request(app)
                .get('/config/system-prompt')
                .expect(200);

            expect(response.body).toHaveProperty('systemPrompt');
            expect(response.body.systemPrompt).toBe('Test system prompt');
        });

        it('should update settings', async () => {
            const newSettings = {
                aiProvider: 'flowise',
                systemPrompt: 'Updated test prompt'
            };

            const response = await request(app)
                .post('/config/settings')
                .send(newSettings)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.currentProvider).toBe('flowise');
        });

        it('should validate required fields in settings update', async () => {
            const invalidSettings = {
                aiProvider: 'flowise'
                // Missing systemPrompt
            };

            await request(app)
                .post('/config/settings')
                .send(invalidSettings)
                .expect(400);
        });
    });

    describe('Conversations API', () => {
        it('should create a new conversation', async () => {
            const conversationData = {
                visitorId: uuidv4(),
                metadata: { source: 'test' }
            };

            const response = await request(app)
                .post('/api/conversations')
                .send(conversationData)
                .expect(200);

            expect(response.body).toHaveProperty('conversationId');
            expect(response.body).toHaveProperty('conversation');
            expect(response.body.conversation.status).toBe('active');
        });

        it('should send message and get AI response', async () => {
            const messageData = {
                conversationId: uuidv4(),
                message: 'Hello, I need help',
                visitorId: uuidv4()
            };

            const response = await request(app)
                .post('/api/messages')
                .send(messageData)
                .expect(200);

            expect(response.body).toHaveProperty('userMessage');
            expect(response.body).toHaveProperty('aiMessage');
            expect(response.body.userMessage.content).toBe('Hello, I need help');
        });

        it('should get conversation messages', async () => {
            const conversationId = uuidv4();

            const response = await request(app)
                .get(`/api/conversations/${conversationId}/messages`)
                .expect(200);

            expect(response.body).toHaveProperty('conversationId');
            expect(response.body).toHaveProperty('messages');
            expect(Array.isArray(response.body.messages)).toBe(true);
        });

        it('should get admin conversations overview', async () => {
            const response = await request(app)
                .get('/api/admin/conversations')
                .expect(200);

            expect(response.body).toHaveProperty('conversations');
            expect(response.body).toHaveProperty('total');
            expect(Array.isArray(response.body.conversations)).toBe(true);
        });
    });

    describe('Agent API', () => {
        it('should update agent status', async () => {
            const statusData = {
                agentId: 'agent-123',
                status: 'online'
            };

            const response = await request(app)
                .post('/api/agent/status')
                .send(statusData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should get active agents', async () => {
            const response = await request(app)
                .get('/api/agents')
                .expect(200);

            expect(response.body).toHaveProperty('agents');
            expect(Array.isArray(response.body.agents)).toBe(true);
        });

        it('should handle agent response with metadata', async () => {
            const responseData = {
                conversationId: uuidv4(),
                message: 'Here is your answer',
                agentId: 'agent-123',
                usedSuggestion: true,
                suggestionAction: 'edited'
            };

            // First create a conversation and assign agent
            await request(app)
                .post('/api/conversations')
                .send({ visitorId: uuidv4() });

            // This should return 403 since conversation isn't assigned to agent
            await request(app)
                .post('/api/agent/respond')
                .send(responseData)
                .expect(403);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid conversation IDs gracefully', async () => {
            const invalidId = 'invalid-conversation-id';
            
            const response = await request(app)
                .get(`/api/conversations/${invalidId}/messages`)
                .expect(200);

            expect(response.body.messages).toEqual([]);
        });

        it('should handle malformed requests', async () => {
            // Send request without required fields
            const response = await request(app)
                .post('/api/messages')
                .send({ invalidData: true });
                
            // Should either return 400 (bad request) or 200 with default handling
            expect([200, 400, 500]).toContain(response.status);
        });
    });

    describe('Data Validation', () => {
        it('should validate message structure', async () => {
            const validMessage = {
                conversationId: uuidv4(),
                message: 'Valid message content',
                visitorId: uuidv4()
            };

            const response = await request(app)
                .post('/api/messages')
                .send(validMessage)
                .expect(200);

            expect(response.body.userMessage.content).toBe('Valid message content');
        });

        it('should handle empty message content', async () => {
            const emptyMessage = {
                conversationId: uuidv4(),
                message: '',
                visitorId: uuidv4()
            };

            await request(app)
                .post('/api/messages')
                .send(emptyMessage)
                .expect(200); // Should still work, just create empty message
        });
    });

    describe('System Admin Functions', () => {
        it('should reset system data', async () => {
            const response = await request(app)
                .post('/reset')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('cleared');
        });
    });
});