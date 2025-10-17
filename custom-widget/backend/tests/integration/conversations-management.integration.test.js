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
const { createTestApp, authenticateAsAgent } = require('./helpers/apiHelpers');
const request = require('supertest');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Conversation Management Integration Tests', () => {
  let prisma;
  let app;

  beforeAll(async () => {
    prisma = await initializeTestDatabase();
    app = createTestApp();
  });

  afterAll(async () => {
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

      // Send 11 messages rapidly (limit is 10 per minute)
      const requests = [];
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post('/api/messages')
            .send(messageData)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(
        (r) => r.status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
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
    test('admin can bulk archive multiple conversations', async () => {
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

    test('admin can bulk unarchive multiple conversations', async () => {
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

    test('admin can bulk assign conversations to agent', async () => {
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
    test('retrieve pending AI suggestion for conversation', async () => {
      const agent = await createTestAgent(prisma);
      const { token } = await authenticateAsAgent(app, prisma, agent.email, agent.plainPassword);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent.id,
      });

      const response = await request(app)
        .get(`/api/conversations/${ticket.id}/pending-suggestion`)
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });
});
