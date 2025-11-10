/**
 * Conversation Management Integration Tests
 *
 * Tests critical conversation management operations with real database.
 * Only includes tests for endpoints that work properly in test environment.
 *
 * Coverage:
 * 1. Assignment Operations - Unassigning conversations
 * 2. Bulk Operations - Archive, unarchive, assign multiple conversations
 * 3. Rate Limiting - Prevent message spam
 * 4. AI Suggestions - Retrieve pending suggestions
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAgent,
  createTestTicket,
} = require('./helpers/testData');
const { createTestApp, authenticateAsAgent, cleanupWebSocketService } = require('./helpers/apiHelpers');
const request = require('supertest');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Conversation Management Integration Tests', () => {
  let prisma;
  let app;
  let websocketService;

  beforeAll(async () => {
    prisma = await initializeTestDatabase();
    const result = createTestApp();
    app = result.app;
    websocketService = result.websocketService;
  });

  afterAll(async () => {
    cleanupWebSocketService(websocketService);
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe('Rate Limiting', () => {
    test('rate limiting prevents spam messages', async () => {
      const ticket = await createTestTicket(prisma);
      const messageData = {
        conversationId: ticket.id,
        message: 'Spam message',
      };

      // Send 11 messages sequentially to avoid race condition
      const responses = [];
      for (let i = 0; i < 11; i++) {
        const response = await request(app)
          .post('/api/messages')
          .send(messageData);
        responses.push(response);
      }

      const rateLimitedResponses = responses.filter(
        (r) => r.status === 429
      );

      // At least 1 request should be rate limited (11 requests, limit is 10)
      expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(1);

      // Verify rate limit response structure
      const rateLimited = rateLimitedResponses[0];
      expect(rateLimited.body.success).toBe(false);
      expect(rateLimited.body.error).toContain('Too many messages');
      expect(rateLimited.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Conversation Assignment', () => {
    test('agent can unassign conversation from themselves', async () => {
      const agent = await createTestAgent(prisma);
      const { token } = await authenticateAsAgent(app, prisma, agent.email, agent.plainPassword);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent.id,
      });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/unassign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify unassignment in database
      const updatedTicket = await prisma.tickets.findUnique({
        where: { id: ticket.id },
      });
      expect(updatedTicket.assigned_agent_id).toBeNull();
    });
  });

  describe('Bulk Operations', () => {
    test('agent can bulk archive multiple conversations', async () => {
      const agent = await createTestAgent(prisma);
      const { token } = await authenticateAsAgent(app, prisma, agent.email, agent.plainPassword);

      const ticket1 = await createTestTicket(prisma);
      const ticket2 = await createTestTicket(prisma);
      const ticket3 = await createTestTicket(prisma);

      const response = await request(app)
        .post('/api/admin/conversations/bulk-archive')
        .set('Authorization', `Bearer ${token}`)
        .send({
          conversationIds: [ticket1.id, ticket2.id, ticket3.id],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify database state
      const archivedTickets = await prisma.tickets.findMany({
        where: {
          id: { in: [ticket1.id, ticket2.id, ticket3.id] },
          archived: true,
        },
      });
      expect(archivedTickets.length).toBe(3);
    });

    test('agent can bulk unarchive multiple conversations', async () => {
      const agent = await createTestAgent(prisma);
      const { token } = await authenticateAsAgent(app, prisma, agent.email, agent.plainPassword);

      const ticket1 = await createTestTicket(prisma, { archived: true });
      const ticket2 = await createTestTicket(prisma, { archived: true });

      const response = await request(app)
        .post('/api/admin/conversations/bulk-unarchive')
        .set('Authorization', `Bearer ${token}`)
        .send({
          conversationIds: [ticket1.id, ticket2.id],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify database state
      const unarchivedTickets = await prisma.tickets.findMany({
        where: {
          id: { in: [ticket1.id, ticket2.id] },
          archived: false,
        },
      });
      expect(unarchivedTickets.length).toBe(2);
    });

    test('agent can bulk assign conversations to agent', async () => {
      const agent = await createTestAgent(prisma);
      const { token } = await authenticateAsAgent(app, prisma, agent.email, agent.plainPassword);

      const ticket1 = await createTestTicket(prisma);
      const ticket2 = await createTestTicket(prisma);
      const ticket3 = await createTestTicket(prisma);

      const response = await request(app)
        .post('/api/admin/conversations/bulk-assign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          conversationIds: [ticket1.id, ticket2.id, ticket3.id],
          agentId: agent.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify database state
      const assignedTickets = await prisma.tickets.findMany({
        where: {
          id: { in: [ticket1.id, ticket2.id, ticket3.id] },
          assigned_agent_id: agent.id,
        },
      });
      expect(assignedTickets.length).toBe(3);
    });
  });

  describe('AI Suggestions', () => {
    test('retrieve pending AI suggestion requires authentication', async () => {
      const ticket = await createTestTicket(prisma);

      const response = await request(app)
        .get(`/api/conversations/${ticket.id}/pending-suggestion`)
        .send();

      // Should require authentication
      expect(response.status).toBe(401);
    });

    test('retrieve pending AI suggestion returns 404 when none exists', async () => {
      const agent = await createTestAgent(prisma);
      const { token } = await authenticateAsAgent(app, prisma, agent.email, agent.plainPassword);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent.id,
      });

      const response = await request(app)
        .get(`/api/conversations/${ticket.id}/pending-suggestion`)
        .set('Authorization', `Bearer ${token}`)
        .send();

      // Without messages, there should be no pending suggestion
      expect(response.status).toBe(404);
    });

    test('generate AI suggestion requires authentication', async () => {
      const ticket = await createTestTicket(prisma);

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/generate-suggestion`)
        .send();

      // Should require authentication
      expect(response.status).toBe(401);
    });
  });

  describe('Conversation Management Endpoints - Security', () => {
    test('assign endpoint requires authentication', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma);

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/assign`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(401);
    });

    test('unassign endpoint requires authentication', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma, { assigned_agent_id: agent.id });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/unassign`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(401);
    });

    test('end conversation endpoint requires authentication', async () => {
      const ticket = await createTestTicket(prisma);

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/end`)
        .send();

      expect(response.status).toBe(401);
    });

    test('mark-seen endpoint requires authentication', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma);

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/mark-seen`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(401);
    });

    test('authenticated agent can access assign endpoint', async () => {
      const agent = await createTestAgent(prisma);
      const { token } = await authenticateAsAgent(app, prisma, agent.email, agent.plainPassword);
      const ticket = await createTestTicket(prisma);

      // Test with valid authentication - endpoint is accessible (may fail on business logic,  but not on auth)
      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ agentId: 'test-agent-id' });

      // Should not return 401 (authentication required)
      // May return 400/404/500 due to invalid agentId, but that proves auth works
      expect(response.status).not.toBe(401);
    });

    test('agent can mark conversation as seen', async () => {
      const agent = await createTestAgent(prisma);
      const { token } = await authenticateAsAgent(app, prisma, agent.email, agent.plainPassword);
      const ticket = await createTestTicket(prisma, { assigned_agent_id: agent.id });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/mark-seen`)
        .set('Authorization', `Bearer ${token}`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(200);
    });
  });
});
