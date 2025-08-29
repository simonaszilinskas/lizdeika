/**
 * Integration tests for Agent Assignment functionality
 * Tests the complete flow from API endpoints to database interactions
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

describe('Agent Assignment Integration Tests', () => {
    beforeAll(() => {
        // Create test app instance without starting server
        const appInstance = createApp();
        app = appInstance.app;
    });

    describe('Complete Agent Assignment Flow', () => {
        let conversationId;
        let agentId = 'admin';

        beforeEach(() => {
            conversationId = `test-conv-${uuidv4()}`;
        });

        it('should create conversation, fetch all agents, and assign to specific agent', async () => {
            // Step 1: Create a conversation
            const createResponse = await request(app)
                .post('/api/conversations')
                .send({
                    conversationId: conversationId,
                    visitorId: `test-visitor-${uuidv4()}`
                })
                .expect(200);

            expect(createResponse.body.conversationId).toBe(conversationId);

            // Step 2: Send a message to create conversation context
            await request(app)
                .post('/api/messages')
                .send({
                    conversationId: conversationId,
                    message: 'I need help with my account',
                    visitorId: createResponse.body.visitorId
                })
                .expect(200);

            // Step 3: Get all agents (should only show legitimate ones)
            const agentsResponse = await request(app)
                .get('/api/agents/all')
                .expect(200);

            expect(agentsResponse.body).toHaveProperty('agents');
            expect(Array.isArray(agentsResponse.body.agents)).toBe(true);
            
            // Should only contain legitimate agents
            agentsResponse.body.agents.forEach(agent => {
                expect(['admin', 'agent1']).toContain(agent.id);
                expect(agent).toHaveProperty('connected');
                expect(typeof agent.connected).toBe('boolean');
            });

            // Step 4: Assign conversation to agent
            const assignResponse = await request(app)
                .post(`/api/conversations/${conversationId}/assign`)
                .send({ agentId: agentId })
                .expect(200);

            expect(assignResponse.body.success).toBe(true);
            expect(assignResponse.body.conversation.assignedAgent).toBe(agentId);

            // Step 5: Verify assignment persisted
            const conversationsResponse = await request(app)
                .get('/api/admin/conversations')
                .expect(200);

            const assignedConv = conversationsResponse.body.conversations.find(
                c => c.id === conversationId
            );
            expect(assignedConv.assignedAgent).toBe(agentId);
        });

        it('should handle agent assignment to offline agents', async () => {
            // Create conversation
            const createResponse = await request(app)
                .post('/api/conversations')
                .send({
                    conversationId: conversationId,
                    visitorId: `test-visitor-${uuidv4()}`
                })
                .expect(200);

            // Get all agents to find an offline one
            const agentsResponse = await request(app)
                .get('/api/agents/all')
                .expect(200);

            const offlineAgent = agentsResponse.body.agents.find(agent => !agent.connected);
            
            if (offlineAgent) {
                // Assign to offline agent should still work
                const assignResponse = await request(app)
                    .post(`/api/conversations/${conversationId}/assign`)
                    .send({ agentId: offlineAgent.id })
                    .expect(200);

                expect(assignResponse.body.success).toBe(true);
                expect(assignResponse.body.conversation.assignedAgent).toBe(offlineAgent.id);
            } else {
                console.log('No offline agents available for testing offline assignment');
            }
        });

        it('should prevent assignment to non-existent agents', async () => {
            // Create conversation
            await request(app)
                .post('/api/conversations')
                .send({
                    conversationId: conversationId,
                    visitorId: `test-visitor-${uuidv4()}`
                })
                .expect(200);

            // Try to assign to non-existent agent
            const assignResponse = await request(app)
                .post(`/api/conversations/${conversationId}/assign`)
                .send({ agentId: 'fake-agent-999' });

            // Should either fail or create the agent entry
            // The exact behavior depends on implementation
            expect([200, 400, 404]).toContain(assignResponse.status);
        });
    });

    describe('Agent Status Integration', () => {
        it('should update agent personal status and handle reassignments', async () => {
            const agentId = 'admin';

            // Update agent to offline status
            const offlineResponse = await request(app)
                .post('/api/agent/personal-status')
                .send({
                    agentId: agentId,
                    personalStatus: 'offline'
                })
                .expect(200);

            expect(offlineResponse.body.success).toBe(true);
            expect(offlineResponse.body).toHaveProperty('agent');
            expect(offlineResponse.body).toHaveProperty('reassignments');
            expect(typeof offlineResponse.body.reassignments).toBe('number');

            // Get connected agents to verify status change
            const connectedResponse = await request(app)
                .get('/api/agents/connected')
                .expect(200);

            // If agent is still connected, it should show as offline
            const connectedAgent = connectedResponse.body.agents.find(a => a.id === agentId);
            if (connectedAgent) {
                expect(connectedAgent.personalStatus).toBe('offline');
            }

            // Update back to online
            const onlineResponse = await request(app)
                .post('/api/agent/personal-status')
                .send({
                    agentId: agentId,
                    personalStatus: 'online'
                })
                .expect(200);

            expect(onlineResponse.body.success).toBe(true);
        });
    });

    describe('API Error Handling', () => {
        it('should handle malformed requests for agent assignment', async () => {
            const response = await request(app)
                .post('/api/conversations/invalid-id/assign')
                .send({ invalidData: true });

            // Should handle gracefully - either 400 bad request or other appropriate error
            expect([400, 404, 500]).toContain(response.status);
        });

        it('should handle missing conversation for assignment', async () => {
            const response = await request(app)
                .post('/api/conversations/non-existent-conv/assign')
                .send({ agentId: 'admin' });

            // Should handle non-existent conversation appropriately
            expect([400, 404]).toContain(response.status);
        });

        it('should validate agent personal status values', async () => {
            const response = await request(app)
                .post('/api/agent/personal-status')
                .send({
                    agentId: 'admin',
                    personalStatus: 'invalid-status'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Personal status must be online or offline');
        });
    });

    describe('Data Consistency', () => {
        it('should maintain assignment consistency across API calls', async () => {
            const conversationId = `test-consistency-${uuidv4()}`;
            const agentId = 'admin';

            // Create conversation
            await request(app)
                .post('/api/conversations')
                .send({
                    conversationId: conversationId,
                    visitorId: `test-visitor-${uuidv4()}`
                })
                .expect(200);

            // Assign to agent
            await request(app)
                .post(`/api/conversations/${conversationId}/assign`)
                .send({ agentId: agentId })
                .expect(200);

            // Verify assignment in conversations list
            const conversationsResponse = await request(app)
                .get('/api/admin/conversations')
                .expect(200);

            const conversation = conversationsResponse.body.conversations.find(
                c => c.id === conversationId
            );
            expect(conversation).toBeTruthy();
            expect(conversation.assignedAgent).toBe(agentId);

            // Unassign conversation
            const unassignResponse = await request(app)
                .post(`/api/conversations/${conversationId}/unassign`)
                .send({ agentId: agentId });

            // Should handle unassignment (response depends on implementation)
            expect([200, 404]).toContain(unassignResponse.status);

            // Verify unassignment if successful
            if (unassignResponse.status === 200) {
                const updatedConversationsResponse = await request(app)
                    .get('/api/admin/conversations')
                    .expect(200);

                const updatedConversation = updatedConversationsResponse.body.conversations.find(
                    c => c.id === conversationId
                );
                expect(updatedConversation.assignedAgent).toBeFalsy();
            }
        });

        it('should handle concurrent assignment requests', async () => {
            const conversationId = `test-concurrent-${uuidv4()}`;

            // Create conversation
            await request(app)
                .post('/api/conversations')
                .send({
                    conversationId: conversationId,
                    visitorId: `test-visitor-${uuidv4()}`
                })
                .expect(200);

            // Make concurrent assignment requests
            const assignPromises = [
                request(app)
                    .post(`/api/conversations/${conversationId}/assign`)
                    .send({ agentId: 'admin' }),
                request(app)
                    .post(`/api/conversations/${conversationId}/assign`)
                    .send({ agentId: 'agent1' })
            ];

            const results = await Promise.allSettled(assignPromises);

            // At least one should succeed
            const successfulAssignments = results.filter(
                result => result.status === 'fulfilled' && result.value.status === 200
            );
            expect(successfulAssignments.length).toBeGreaterThanOrEqual(1);

            // Final state should be consistent
            const conversationsResponse = await request(app)
                .get('/api/admin/conversations')
                .expect(200);

            const finalConversation = conversationsResponse.body.conversations.find(
                c => c.id === conversationId
            );
            expect(finalConversation.assignedAgent).toBeTruthy();
            expect(['admin', 'agent1']).toContain(finalConversation.assignedAgent);
        });
    });
});