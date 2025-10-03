/**
 * Integration tests for customer message rate limiting
 */
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// Mock AI provider
jest.mock('../../ai-providers', () => ({
    createAIProvider: jest.fn(() => ({
        generateResponse: jest.fn().mockResolvedValue('Mock AI response'),
        healthCheck: jest.fn().mockResolvedValue(true),
        isHealthy: true,
        lastHealthCheck: new Date()
    })),
    retryWithBackoff: jest.fn((fn) => fn())
}));

// Set test environment
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'flowise';

const createApp = require('../../src/app');

let app;
let conversationId;

describe('Customer Message Rate Limiting', () => {
    beforeAll(() => {
        const appInstance = createApp();
        app = appInstance.app;
    });

    beforeEach(async () => {
        // Create a test conversation
        const response = await request(app)
            .post('/api/conversations')
            .send({ userId: 'test-user-' + Date.now() });

        conversationId = response.body.conversationId;
    });

    it('should allow up to 10 messages within 1 minute', async () => {
        const promises = [];

        // Use unique IP for this test to isolate rate limit quota
        const testIP = '10.0.1.1';

        // Send 10 messages
        for (let i = 0; i < 10; i++) {
            promises.push(
                request(app)
                    .post('/api/messages')
                    .set('X-Forwarded-For', testIP)
                    .send({
                        conversationId,
                        content: `Test message ${i}`,
                        userId: 'test-user'
                    })
            );
        }

        const responses = await Promise.all(promises);

        // All 10 should succeed
        const successfulResponses = responses.filter(res => res.status === 200);
        expect(successfulResponses.length).toBe(10);
    });

    it('should block the 11th message within 1 minute', async () => {
        // Use unique IP for this test to isolate rate limit quota
        const testIP = '10.0.1.2';

        // Send 10 messages first
        for (let i = 0; i < 10; i++) {
            await request(app)
                .post('/api/messages')
                .set('X-Forwarded-For', testIP)
                .send({
                    conversationId,
                    content: `Test message ${i}`,
                    userId: 'test-user'
                });
        }

        // 11th message should be rate limited
        const response = await request(app)
            .post('/api/messages')
            .set('X-Forwarded-For', testIP)
            .send({
                conversationId,
                content: 'Message that should be blocked',
                userId: 'test-user'
            });

        expect(response.status).toBe(429);
        expect(response.body.error).toContain('Too many messages');
        expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should include rate limit headers in response', async () => {
        // Use unique IP for this test to isolate rate limit quota
        const testIP = '10.0.1.3';

        const response = await request(app)
            .post('/api/messages')
            .set('X-Forwarded-For', testIP)
            .send({
                conversationId,
                content: 'Test message',
                userId: 'test-user'
            });

        expect(response.headers['ratelimit-limit']).toBeDefined();
        expect(response.headers['ratelimit-remaining']).toBeDefined();
        expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should reset rate limit after 1 minute', async () => {
        jest.useFakeTimers();

        // Use unique IP for this test to isolate rate limit quota
        const testIP = '10.0.1.4';

        try {
            // Send 10 messages
            for (let i = 0; i < 10; i++) {
                await request(app)
                    .post('/api/messages')
                    .set('X-Forwarded-For', testIP)
                    .send({
                        conversationId,
                        content: `Test message ${i}`,
                        userId: 'test-user'
                    });
            }

            // Advance time by 1 minute + buffer
            jest.advanceTimersByTime(61000);

            // Should be able to send another message
            const response = await request(app)
                .post('/api/messages')
                .set('X-Forwarded-For', testIP)
                .send({
                    conversationId,
                    content: 'Message after reset',
                    userId: 'test-user'
                });

            expect(response.status).toBe(200);
        } finally {
            jest.useRealTimers();
        }
    });

    it('should track rate limits per IP address independently', async () => {
        // Send 10 messages from first IP
        for (let i = 0; i < 10; i++) {
            await request(app)
                .post('/api/messages')
                .set('X-Forwarded-For', '192.168.1.1')
                .send({
                    conversationId,
                    content: `Test message IP1 ${i}`,
                    userId: 'test-user-1'
                });
        }

        // Message from second IP should still work
        const response = await request(app)
            .post('/api/messages')
            .set('X-Forwarded-For', '192.168.1.2')
            .send({
                conversationId,
                content: 'Message from different IP',
                userId: 'test-user-2'
            });

        expect(response.status).toBe(200);

        // But first IP should still be blocked
        const blockedResponse = await request(app)
            .post('/api/messages')
            .set('X-Forwarded-For', '192.168.1.1')
            .send({
                conversationId,
                content: 'Should be blocked',
                userId: 'test-user-1'
            });

        expect(blockedResponse.status).toBe(429);
    });
});
