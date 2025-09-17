/**
 * AI Provider Configuration Verification Tests
 *
 * Tests to verify that the AI provider configuration from the database
 * is actually being used in production, not falling back to environment variables.
 *
 * This addresses the user's specific requirement:
 * "add tests to check if it really works and if the model used in production
 * is actually the one that is defined in the settings and not another one"
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const { createAIProvider, getAIProviderConfig } = require('../../ai-providers');

describe('AI Provider Configuration Verification', () => {
    let prisma;
    let adminToken;
    let testServer;

    beforeAll(async () => {
        prisma = new PrismaClient({
            datasources: {
                db: {
                    url: "postgresql://vilnius_user:secure_password@localhost:5434/vilnius_support"
                }
            }
        });

        // Start test server
        const app = require('../../server');
        testServer = app.listen(0); // Use random port for testing

        // Login as admin to get auth token
        const loginResponse = await request(testServer)
            .post('/api/auth/login')
            .send({
                email: 'admin@vilnius.lt',
                password: 'admin123'
            });

        adminToken = loginResponse.body.token;
    });

    afterAll(async () => {
        await prisma.$disconnect();
        if (testServer) {
            await new Promise(resolve => testServer.close(resolve));
        }
    });

    describe('Database vs Environment Variable Priority', () => {
        test('should prioritize database settings over environment variables', async () => {
            // Set up test data in database
            const testSettings = {
                ai_provider: 'openrouter',
                openrouter_api_key: 'test-db-key-12345',
                openrouter_model: 'test/db-model',
                site_url: 'https://test-db.com',
                site_name: 'Test DB Site'
            };

            // Save test settings to database
            await request(testServer)
                .post('/api/settings/ai_providers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(testSettings);

            // Get configuration through the system
            const config = await getAIProviderConfig();

            // Verify database values are used, not environment variables
            expect(config.AI_PROVIDER).toBe('openrouter');
            expect(config.OPENROUTER_API_KEY).toBe('test-db-key-12345');
            expect(config.OPENROUTER_MODEL).toBe('test/db-model');
            expect(config.SITE_URL).toBe('https://test-db.com');
            expect(config.SITE_NAME).toBe('Test DB Site');

            // Verify these are different from any environment variables
            expect(config.OPENROUTER_API_KEY).not.toBe(process.env.OPENROUTER_API_KEY);
            expect(config.OPENROUTER_MODEL).not.toBe(process.env.OPENROUTER_MODEL);
        });

        test('should fall back to environment variables when database is empty', async () => {
            // Clear all AI provider settings from database
            await prisma.system_settings.deleteMany({
                where: {
                    category: 'ai_providers'
                }
            });

            // Get configuration through the system
            const config = await getAIProviderConfig();

            // Should fall back to environment variables or defaults
            expect(config.AI_PROVIDER).toBeDefined();
            expect(config.OPENROUTER_MODEL).toBeDefined();
        });
    });

    describe('AI Provider Instance Verification', () => {
        test('should create provider instance with database configuration', async () => {
            // Set up specific test configuration
            const testSettings = {
                ai_provider: 'openrouter',
                openrouter_api_key: 'test-verification-key',
                openrouter_model: 'google/gemini-2.5-flash-exp',
                site_url: 'https://verification-test.com',
                site_name: 'Verification Test Site'
            };

            // Save to database
            await request(testServer)
                .post('/api/settings/ai_providers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(testSettings);

            // Get config and create provider
            const config = await getAIProviderConfig();
            const provider = createAIProvider(config.AI_PROVIDER, config);

            // Verify provider instance has correct configuration
            expect(provider.apiKey).toBe('test-verification-key');
            expect(provider.model).toBe('google/gemini-2.5-flash-exp');
            expect(provider.siteUrl).toBe('https://verification-test.com');
        });

        test('should use correct Flowise configuration when selected', async () => {
            const testSettings = {
                ai_provider: 'flowise',
                flowise_url: 'https://test-flowise.com',
                flowise_chatflow_id: 'test-chatflow-123',
                flowise_api_key: 'test-flowise-key'
            };

            await request(testServer)
                .post('/api/settings/ai_providers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(testSettings);

            const config = await getAIProviderConfig();
            const provider = createAIProvider(config.AI_PROVIDER, config);

            expect(provider.url).toBe('https://test-flowise.com');
            expect(provider.chatflowId).toBe('test-chatflow-123');
            expect(provider.apiKey).toBe('test-flowise-key');
        });
    });

    describe('Production Runtime Verification', () => {
        test('should verify live AI provider matches database settings', async () => {
            // Set specific configuration in database
            const testSettings = {
                ai_provider: 'openrouter',
                openrouter_api_key: 'runtime-test-key',
                openrouter_model: 'google/gemini-2.5-flash',
                site_url: 'https://runtime-test.com',
                site_name: 'Runtime Test'
            };

            await request(testServer)
                .post('/api/settings/ai_providers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(testSettings);

            // Test the runtime system configuration endpoint
            const response = await request(testServer)
                .get('/api/system/ai-provider-status')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.currentProvider).toBe('openrouter');
            expect(response.body.configSource).toBe('database');
            expect(response.body.configuration.model).toBe('google/gemini-2.5-flash');
        });

        test('should detect configuration source (database vs environment)', async () => {
            // First test with database settings
            await request(testServer)
                .post('/api/settings/ai_providers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    ai_provider: 'openrouter',
                    openrouter_model: 'database-model-test'
                });

            let response = await request(testServer)
                .get('/api/system/ai-provider-status')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.configSource).toBe('database');
            expect(response.body.configuration.model).toBe('database-model-test');

            // Clear database settings
            await prisma.system_settings.deleteMany({
                where: { category: 'ai_providers' }
            });

            // Test fallback to environment
            response = await request(testServer)
                .get('/api/system/ai-provider-status')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.body.configSource).toBe('environment');
        });
    });

    describe('Model Usage Validation', () => {
        test('should validate that chat requests use database-configured model', async () => {
            // Set specific model in database
            const testModel = 'google/gemini-2.5-flash-exp';
            await request(testServer)
                .post('/api/settings/ai_providers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    ai_provider: 'openrouter',
                    openrouter_api_key: 'valid-test-key',
                    openrouter_model: testModel,
                    site_url: 'https://test.com',
                    site_name: 'Test Site'
                });

            // Make a test chat request and inspect the response metadata
            const chatResponse = await request(testServer)
                .post('/api/chat/suggestion')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    conversationId: 'test-conv-123',
                    context: 'Test message for model verification',
                    enableRAG: false
                });

            // The response should include metadata about which model was used
            expect(chatResponse.status).toBe(200);
            expect(chatResponse.body.metadata).toBeDefined();
            expect(chatResponse.body.metadata.modelUsed).toBe(testModel);
            expect(chatResponse.body.metadata.configSource).toBe('database');
        });
    });
});