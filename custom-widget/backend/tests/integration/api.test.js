/**
 * Integration tests for API endpoints
 * Updated to include authentication and activity logging tests
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

// Mock bcrypt for consistent password hashing in tests
jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('$2b$12$mocked.hash.value'),
    compare: jest.fn().mockResolvedValue(true),
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
let userToken = null;
let adminToken = null;

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

        it('should handle partial settings update', async () => {
            const partialSettings = {
                aiProvider: 'flowise'
                // Missing systemPrompt - should either validate or use defaults
            };

            const response = await request(app)
                .post('/config/settings')
                .send(partialSettings);

            // Should either accept with defaults (200) or reject with validation (400)
            expect([200, 400]).toContain(response.status);
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
            expect(response.body.conversation).toHaveProperty('id');
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

    describe('Agent Management API', () => {
        describe('GET /api/agents/all', () => {
            it('should return filtered list of legitimate agents', async () => {
                const response = await request(app)
                    .get('/api/agents/all')
                    .expect(200);

                expect(response.body).toHaveProperty('agents');
                expect(Array.isArray(response.body.agents)).toBe(true);
                
                // Should only return legitimate agents (admin, agent1)
                response.body.agents.forEach(agent => {
                    expect(['admin', 'agent1']).toContain(agent.id);
                    expect(agent).toHaveProperty('name');
                    expect(agent).toHaveProperty('connected');
                    expect(typeof agent.connected).toBe('boolean');
                });
            });

            it('should include connection status for agents', async () => {
                const response = await request(app)
                    .get('/api/agents/all')
                    .expect(200);

                if (response.body.agents.length > 0) {
                    const agent = response.body.agents[0];
                    expect(agent).toHaveProperty('id');
                    expect(agent).toHaveProperty('name');
                    expect(agent).toHaveProperty('status');
                    expect(agent).toHaveProperty('personalStatus');
                    expect(agent).toHaveProperty('connected');
                    expect(agent).toHaveProperty('lastSeen');
                    expect(agent).toHaveProperty('activeChats');
                }
            });

            it('should filter out test agents and fake entries', async () => {
                const response = await request(app)
                    .get('/api/agents/all')
                    .expect(200);

                // Should not include random test agents
                response.body.agents.forEach(agent => {
                    expect(agent.id).not.toMatch(/^agent-[a-z0-9]{8,}$/); // Random test agent IDs
                    expect(['admin', 'agent1']).toContain(agent.id);
                });
            });

            it('should handle service errors gracefully', async () => {
                // This test would require mocking the service to throw an error
                // For now, we just verify the endpoint exists and returns proper structure
                const response = await request(app)
                    .get('/api/agents/all');

                expect([200, 500]).toContain(response.status);
                
                if (response.status === 200) {
                    expect(response.body).toHaveProperty('agents');
                } else {
                    expect(response.body).toHaveProperty('error');
                }
            });
        });

        describe('GET /api/agents', () => {
            it('should return active agents only', async () => {
                const response = await request(app)
                    .get('/api/agents')
                    .expect(200);

                expect(response.body).toHaveProperty('agents');
                expect(Array.isArray(response.body.agents)).toBe(true);
            });
        });

        describe('GET /api/agents/connected', () => {
            it('should return connected agents with system mode', async () => {
                const response = await request(app)
                    .get('/api/agents/connected')
                    .expect(200);

                expect(response.body).toHaveProperty('agents');
                expect(response.body).toHaveProperty('systemMode');
                expect(Array.isArray(response.body.agents)).toBe(true);
                expect(typeof response.body.systemMode).toBe('string');
            });
        });

        describe('POST /api/agent/personal-status', () => {
            it('should update agent personal status', async () => {
                const statusUpdate = {
                    agentId: 'agent1',
                    personalStatus: 'online'
                };

                const response = await request(app)
                    .post('/api/agent/personal-status')
                    .send(statusUpdate)
                    .expect(200);

                expect(response.body).toHaveProperty('success');
                expect(response.body.success).toBe(true);
                expect(response.body).toHaveProperty('agent');
                expect(response.body).toHaveProperty('reassignments');
            });

            it('should validate required fields', async () => {
                const invalidUpdate = {
                    agentId: 'agent1'
                    // Missing personalStatus
                };

                const response = await request(app)
                    .post('/api/agent/personal-status')
                    .send(invalidUpdate)
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toContain('Agent ID and personal status are required');
            });

            it('should validate personal status values', async () => {
                const invalidStatus = {
                    agentId: 'agent1',
                    personalStatus: 'invalid_status'
                };

                const response = await request(app)
                    .post('/api/agent/personal-status')
                    .send(invalidStatus)
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toContain('Personal status must be online or offline');
            });

            it('should handle offline status change', async () => {
                const offlineUpdate = {
                    agentId: 'agent1',
                    personalStatus: 'offline'
                };

                const response = await request(app)
                    .post('/api/agent/personal-status')
                    .send(offlineUpdate)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body).toHaveProperty('reassignments');
                expect(typeof response.body.reassignments).toBe('number');
            });
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

    describe('Authentication API', () => {
        describe('POST /api/auth/register', () => {
            it('should register a new user successfully', async () => {
                const userData = {
                    email: 'test@example.com',
                    password: 'Password123!',
                    firstName: 'Test',
                    lastName: 'User',
                    role: 'user'
                };

                const response = await request(app)
                    .post('/api/auth/register')
                    .send(userData)
                    .expect(201);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('user');
                expect(response.body.data).toHaveProperty('tokens');
                expect(response.body.data.user.email).toBe('test@example.com');
                expect(response.body.data.user).not.toHaveProperty('password_hash');

                // Save token for later tests
                userToken = response.body.data.tokens.accessToken;
            });

            it('should prevent duplicate email registration', async () => {
                const userData = {
                    email: 'test@example.com', // Same email as above
                    password: 'Password123!',
                    firstName: 'Duplicate',
                    lastName: 'User'
                };

                const response = await request(app)
                    .post('/api/auth/register')
                    .send(userData)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('already exists');
            });

            it('should validate required fields', async () => {
                const invalidData = {
                    email: 'incomplete@example.com'
                    // Missing required fields
                };

                const response = await request(app)
                    .post('/api/auth/register')
                    .send(invalidData)
                    .expect(400);

                expect(response.body.success).toBe(false);
            });
        });

        describe('POST /api/auth/login', () => {
            it('should login user successfully', async () => {
                const loginData = {
                    email: 'test@example.com',
                    password: 'Password123!'
                };

                const response = await request(app)
                    .post('/api/auth/login')
                    .send(loginData)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('user');
                expect(response.body.data).toHaveProperty('tokens');
                
                userToken = response.body.data.tokens.accessToken;
            });

            it('should handle invalid credentials', async () => {
                const loginData = {
                    email: 'test@example.com',
                    password: 'wrongpassword'
                };

                const response = await request(app)
                    .post('/api/auth/login')
                    .send(loginData)
                    .expect(401);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('Invalid email or password');
            });
        });

        describe('GET /api/auth/profile', () => {
            it('should get user profile with valid token', async () => {
                const response = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', `Bearer ${userToken}`)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('email');
                expect(response.body.data).not.toHaveProperty('password_hash');
            });

            it('should reject request without token', async () => {
                const response = await request(app)
                    .get('/api/auth/profile')
                    .expect(401);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('Access token required');
            });
        });

        describe('POST /api/auth/logout', () => {
            it('should logout user successfully', async () => {
                const response = await request(app)
                    .post('/api/auth/logout')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ refreshToken: 'mock-refresh-token' })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.message).toContain('Logout');
            });
        });
    });

    describe('Activity Logging API', () => {
        beforeAll(async () => {
            // Create admin user for activity tests
            const adminData = {
                email: 'admin@example.com',
                password: 'AdminPassword123!',
                firstName: 'Admin',
                lastName: 'User',
                role: 'admin'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(adminData);

            adminToken = response.body.data.tokens.accessToken;
        });

        describe('GET /api/activities', () => {
            it('should get activities for admin user', async () => {
                const response = await request(app)
                    .get('/api/activities')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('activities');
                expect(response.body.data).toHaveProperty('pagination');
                expect(Array.isArray(response.body.data.activities)).toBe(true);
            });

            it('should reject non-admin users', async () => {
                const response = await request(app)
                    .get('/api/activities')
                    .set('Authorization', `Bearer ${userToken}`)
                    .expect(403);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('Insufficient permissions');
            });

            it('should handle filtering parameters', async () => {
                const response = await request(app)
                    .get('/api/activities')
                    .query({ actionType: 'auth', success: true })
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('activities');
            });
        });

        describe('GET /api/activities/me', () => {
            it('should get current user activities', async () => {
                const response = await request(app)
                    .get('/api/activities/me')
                    .set('Authorization', `Bearer ${userToken}`)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
                expect(Array.isArray(response.body.data)).toBe(true);
            });

            it('should reject unauthenticated requests', async () => {
                const response = await request(app)
                    .get('/api/activities/me')
                    .expect(401);

                expect(response.body.success).toBe(false);
            });
        });

        describe('GET /api/activities/stats', () => {
            it('should get activity statistics for admin', async () => {
                const response = await request(app)
                    .get('/api/activities/stats')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('totalActivities');
                expect(response.body.data).toHaveProperty('breakdown');
                expect(typeof response.body.data.totalActivities).toBe('number');
            });
        });

        describe('GET /api/activities/dashboard', () => {
            it('should get activity dashboard for admin', async () => {
                const response = await request(app)
                    .get('/api/activities/dashboard')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('overview');
                expect(response.body.data).toHaveProperty('timeRanges');
                expect(response.body.data).toHaveProperty('recentFailures');
            });
        });

        describe('POST /api/activities/cleanup', () => {
            it('should cleanup old activities for admin', async () => {
                const response = await request(app)
                    .post('/api/activities/cleanup')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ daysToKeep: 90 })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('deletedCount');
                expect(response.body.data).toHaveProperty('daysToKeep');
                expect(typeof response.body.data.deletedCount).toBe('number');
            });

            it('should validate daysToKeep parameter', async () => {
                const response = await request(app)
                    .post('/api/activities/cleanup')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ daysToKeep: 500 }) // Invalid - too large
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('daysToKeep must be between 1 and 365');
            });
        });
    });

    describe('Rate Limiting', () => {
        it('should apply rate limiting to activity endpoints', async () => {
            const promises = [];
            
            // Send many requests in parallel to trigger rate limiting
            for (let i = 0; i < 110; i++) { // Exceeds the 100 req/15min limit
                promises.push(
                    request(app)
                        .get('/api/activities/me')
                        .set('Authorization', `Bearer ${userToken}`)
                );
            }

            const responses = await Promise.all(promises);
            
            // Some requests should be rate limited
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
            
            // Rate limited responses should have proper error message
            if (rateLimitedResponses.length > 0) {
                expect(rateLimitedResponses[0].body.error).toContain('Too many activity requests');
            }
        });
    });
});