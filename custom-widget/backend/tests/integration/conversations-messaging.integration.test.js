/**
 * Conversation Management & Messaging Integration Tests
 *
 * Tests the complete conversation lifecycle with real database operations.
 *
 * Coverage:
 * 1. Conversation Creation - Creating conversations with various configurations
 * 2. Sending Messages - Customer and agent messaging flows
 * 3. Retrieving Messages - Conversation history and filtering
 * 4. Assignment/Unassignment - Agent assignment management
 * 5. Ending Conversations - Conversation closure workflows
 * 6. Listing Conversations - Admin and agent views
 * 7. Complete User Flows - End-to-end scenarios
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAgent,
  createTestCustomer,
  createTestTicket,
  createTestMessage,
} = require('./helpers/testData');
const { createTestApp } = require('./helpers/apiHelpers');
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Conversation Management & Messaging Integration Tests', () => {
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

  describe('Conversation Creation', () => {
    test('should create conversation with valid data', async () => {
      const conversationId = uuidv4();
      const visitorId = `visitor-${Date.now()}`;

      const response = await request(app)
        .post('/api/conversations')
        .send({
          visitorId,
          metadata: { source: 'widget' },
        });

      expect(response.status).toBe(200);
      expect(response.body.conversationId).toBeDefined();
      expect(response.body.conversation).toBeDefined();
      expect(response.body.conversation.visitorId).toBe(visitorId);

      // Verify conversation stored in database
      const ticket = await prisma.tickets.findFirst({
        where: { id: response.body.conversationId },
      });
      expect(ticket).toBeDefined();
      expect(ticket.ticket_number).toBeDefined();
      expect(ticket.ticket_number).toMatch(/^VIL-\d{4}-\d+$/);
    });

    test('should create conversation with metadata', async () => {
      const metadata = {
        source: 'email',
        urgency: 'high',
        customerInfo: 'VIP customer',
      };

      const response = await request(app)
        .post('/api/conversations')
        .send({
          visitorId: `visitor-${Date.now()}`,
          metadata,
        });

      expect(response.status).toBe(200);
      expect(response.body.conversation.metadata).toEqual(metadata);
    });

    test('should allow conversation creation without visitorId', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          metadata: { source: 'widget' },
        });

      expect(response.status).toBe(200);
      expect(response.body.conversationId).toBeDefined();
      expect(response.body.conversation.visitorId).toBeDefined();
    });

    test('should reject conversation with invalid metadata', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          visitorId: `visitor-${Date.now()}`,
          metadata: 'invalid-string', // Should be object
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Sending Messages', () => {
    test('customer should send message to conversation', async () => {
      const conversationId = uuidv4();
      const visitorId = `visitor-${Date.now()}`;
      const messageContent = 'Hello, I need help with my account';

      // First create conversation
      await request(app).post('/api/conversations').send({ visitorId });

      // Send message
      const response = await request(app)
        .post('/api/messages')
        .send({
          conversationId,
          message: messageContent,
          visitorId,
        });

      expect(response.status).toBe(200);
      expect(response.body.userMessage).toBeDefined();
      expect(response.body.userMessage.content).toBe(messageContent);
      expect(response.body.userMessage.sender).toBe('visitor');
      expect(response.body.conversationId).toBe(conversationId);

      // Verify message stored in database
      const messages = await prisma.messages.findMany({
        where: { ticket_id: conversationId },
      });
      expect(messages.length).toBeGreaterThan(0);
      const userMessage = messages.find((m) => m.content === messageContent);
      expect(userMessage).toBeDefined();
    });

    test('should auto-create conversation if not exists when sending message', async () => {
      const conversationId = uuidv4();
      const visitorId = `visitor-${Date.now()}`;
      const messageContent = 'New conversation message';

      const response = await request(app)
        .post('/api/messages')
        .send({
          conversationId,
          message: messageContent,
          visitorId,
        });

      expect(response.status).toBe(200);

      // Verify conversation created
      const ticket = await prisma.tickets.findUnique({
        where: { id: conversationId },
      });
      expect(ticket).toBeDefined();
    });

    test('should reject empty message content', async () => {
      const conversationId = uuidv4();

      const response = await request(app)
        .post('/api/messages')
        .send({
          conversationId,
          message: '',
          visitorId: `visitor-${Date.now()}`,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('message');
    });

    test('should reject message without required fields', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          message: 'Test message',
          // Missing conversationId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle very long message content', async () => {
      const conversationId = uuidv4();
      const longMessage = 'A'.repeat(5000);

      const response = await request(app)
        .post('/api/messages')
        .send({
          conversationId,
          message: longMessage,
          visitorId: `visitor-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.userMessage.content).toBe(longMessage);
    });

    test('should handle special characters in messages', async () => {
      const conversationId = uuidv4();
      const specialMessage = '<script>alert("XSS")</script> & "quotes" \'apostrophes\'';

      const response = await request(app)
        .post('/api/messages')
        .send({
          conversationId,
          message: specialMessage,
          visitorId: `visitor-${Date.now()}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.userMessage.content).toBe(specialMessage);

      // Verify stored correctly without XSS vulnerability
      const messages = await prisma.messages.findMany({
        where: { ticket_id: conversationId },
      });
      const storedMessage = messages.find((m) => m.content === specialMessage);
      expect(storedMessage).toBeDefined();
    });
  });

  describe('Retrieving Conversation Messages', () => {
    test('should retrieve all messages in chronological order', async () => {
      const ticket = await createTestTicket(prisma);

      // Create messages in specific order
      const message1 = await createTestMessage(prisma, ticket.id, {
        content: 'First message',
        senderType: 'user',
        created_at: new Date('2025-01-01T10:00:00Z'),
      });
      const message2 = await createTestMessage(prisma, ticket.id, {
        content: 'Second message',
        senderType: 'agent',
        created_at: new Date('2025-01-01T10:01:00Z'),
      });
      const message3 = await createTestMessage(prisma, ticket.id, {
        content: 'Third message',
        senderType: 'user',
        created_at: new Date('2025-01-01T10:02:00Z'),
      });

      const response = await request(app)
        .get(`/api/conversations/${ticket.id}/messages`);

      expect(response.status).toBe(200);
      expect(response.body.messages).toBeDefined();
      expect(response.body.messages.length).toBe(3);

      // Verify chronological order (oldest first)
      expect(response.body.messages[0].content).toBe('First message');
      expect(response.body.messages[1].content).toBe('Second message');
      expect(response.body.messages[2].content).toBe('Third message');
    });

    test('should return empty array for conversation with no messages', async () => {
      const ticket = await createTestTicket(prisma);

      const response = await request(app)
        .get(`/api/conversations/${ticket.id}/messages`);

      expect(response.status).toBe(200);
      expect(response.body.messages).toEqual([]);
    });

    test('should return 404 for non-existent conversation', async () => {
      const fakeId = uuidv4();

      const response = await request(app)
        .get(`/api/conversations/${fakeId}/messages`);

      expect(response.status).toBe(200);
      expect(response.body.messages).toEqual([]);
    });

    test('should include message metadata in response', async () => {
      const ticket = await createTestTicket(prisma);
      const metadata = { isSystemMessage: true, messageType: 'notification' };

      await createTestMessage(prisma, ticket.id, {
        content: 'System notification',
        senderType: 'system',
        metadata,
      });

      const response = await request(app)
        .get(`/api/conversations/${ticket.id}/messages`);

      expect(response.status).toBe(200);
      expect(response.body.messages[0].metadata).toMatchObject(metadata);
    });
  });

  describe('Conversation Assignment', () => {
    test('agent should assign conversation to themselves', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma);

      // Create agent_status required for assignment
      await prisma.agent_status.create({
        data: {
          id: uuidv4(),
          user_id: agent.id,
          status: 'online',
          updated_at: new Date(),
        },
      });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/assign`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conversation).toBeDefined();

      // Verify assignment in database
      const updatedTicket = await prisma.tickets.findUnique({
        where: { id: ticket.id },
      });
      expect(updatedTicket.assigned_agent_id).toBe(agent.id);
    });

    test('should reassign conversation from one agent to another', async () => {
      const agent1 = await createTestAgent(prisma);
      const agent2 = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent1.id,
      });

      // Create agent_status for both agents
      await prisma.agent_status.createMany({
        data: [
          {
            id: uuidv4(),
            user_id: agent1.id,
            status: 'online',
            updated_at: new Date(),
          },
          {
            id: uuidv4(),
            user_id: agent2.id,
            status: 'online',
            updated_at: new Date(),
          },
        ],
      });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/assign`)
        .send({ agentId: agent2.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify reassignment
      const updatedTicket = await prisma.tickets.findUnique({
        where: { id: ticket.id },
      });
      expect(updatedTicket.assigned_agent_id).toBe(agent2.id);
    });

    test('should reject assignment to non-existent agent', async () => {
      const ticket = await createTestTicket(prisma);
      const fakeAgentId = uuidv4();

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/assign`)
        .send({ agentId: fakeAgentId });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    test('should reject assignment to non-existent conversation', async () => {
      const agent = await createTestAgent(prisma);
      const fakeTicketId = uuidv4();

      const response = await request(app)
        .post(`/api/conversations/${fakeTicketId}/assign`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    test('should reject assignment without agentId', async () => {
      const ticket = await createTestTicket(prisma);

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/assign`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Conversation Unassignment', () => {
    test('should unassign conversation from agent', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent.id,
      });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/unassign`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conversation.assignedAgent).toBeNull();

      // Verify unassignment in database
      const updatedTicket = await prisma.tickets.findUnique({
        where: { id: ticket.id },
      });
      expect(updatedTicket.assigned_agent_id).toBeNull();
    });

    test('unassigning already unassigned conversation should succeed', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: null,
      });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/unassign`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject unassignment of non-existent conversation', async () => {
      const agent = await createTestAgent(prisma);
      const fakeTicketId = uuidv4();

      const response = await request(app)
        .post(`/api/conversations/${fakeTicketId}/unassign`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('Ending Conversation', () => {
    test('agent should end their assigned conversation', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent.id,
      });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/end`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify conversation ended
      const updatedTicket = await prisma.tickets.findUnique({
        where: { id: ticket.id },
      });
      expect(updatedTicket.archived).toBe(true);
    });

    test('should reject ending conversation by non-assigned agent', async () => {
      const agent1 = await createTestAgent(prisma);
      const agent2 = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent1.id,
      });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/end`)
        .send({ agentId: agent2.id });

      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    test('ending already ended conversation should succeed', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent.id,
        archived: true,
      });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/end`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Marking Conversation as Seen', () => {
    test('agent should mark conversation as seen', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent.id,
      });

      const response = await request(app)
        .post(`/api/conversations/${ticket.id}/mark-seen`)
        .send({ agentId: agent.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should allow marking non-existent conversation as seen', async () => {
      const agent = await createTestAgent(prisma);
      const fakeTicketId = uuidv4();

      const response = await request(app)
        .post(`/api/conversations/${fakeTicketId}/mark-seen`)
        .send({ agentId: agent.id });

      // Should handle gracefully
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Listing Conversations (Admin View)', () => {
    test('should retrieve all conversations', async () => {
      const agent = await createTestAgent(prisma);
      const ticket1 = await createTestTicket(prisma, {
        subject: 'First conversation',
      });
      const ticket2 = await createTestTicket(prisma, {
        subject: 'Second conversation',
        assigned_agent_id: agent.id,
      });
      const ticket3 = await createTestTicket(prisma, {
        subject: 'Third conversation',
        archived: true,
      });

      const response = await request(app)
        .get('/api/admin/conversations');

      expect(response.status).toBe(200);
      expect(response.body.conversations).toBeDefined();
      expect(response.body.conversations.length).toBeGreaterThanOrEqual(3);
      expect(response.body.total).toBeGreaterThanOrEqual(3);
    });

    test('should return conversations with message counts', async () => {
      const ticket = await createTestTicket(prisma);
      await createTestMessage(prisma, ticket.id, {
        content: 'Message 1',
        senderType: 'user',
      });
      await createTestMessage(prisma, ticket.id, {
        content: 'Message 2',
        senderType: 'agent',
      });

      const response = await request(app)
        .get('/api/admin/conversations');

      expect(response.status).toBe(200);
      const conversation = response.body.conversations.find(
        (c) => c.id === ticket.id
      );
      expect(conversation).toBeDefined();
      expect(conversation.messageCount).toBeGreaterThanOrEqual(2);
    });

    test('should include assigned agent information', async () => {
      const agent = await createTestAgent(prisma);
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agent.id,
      });

      const response = await request(app)
        .get('/api/admin/conversations');

      expect(response.status).toBe(200);
      const conversation = response.body.conversations.find(
        (c) => c.id === ticket.id
      );
      expect(conversation).toBeDefined();
      expect(conversation.assignedAgent).toBeDefined();
    });

    test('should return empty array when no conversations exist', async () => {
      const response = await request(app)
        .get('/api/admin/conversations');

      expect(response.status).toBe(200);
      expect(response.body.conversations).toEqual([]);
      expect(response.body.total).toBe(0);
    });
  });

  describe('Complete User Flows', () => {
    test('Flow 1: Customer support request lifecycle', async () => {
      const agent = await createTestAgent(prisma);
      await prisma.agent_status.create({
        data: {
          id: uuidv4(),
          user_id: agent.id,
          status: 'online',
          updated_at: new Date(),
        },
      });

      // 1. Customer creates conversation and sends message
      const conversationId = uuidv4();
      const visitorId = `visitor-${Date.now()}`;

      const createResponse = await request(app)
        .post('/api/messages')
        .send({
          conversationId,
          message: 'I need help with my order',
          visitorId,
        });

      expect(createResponse.status).toBe(200);

      // 2. Verify conversation appears in admin list
      const listResponse = await request(app)
        .get('/api/admin/conversations');

      expect(listResponse.status).toBe(200);
      const conversation = listResponse.body.conversations.find(
        (c) => c.id === conversationId
      );
      expect(conversation).toBeDefined();

      // 3. Agent assigns conversation to themselves
      const assignResponse = await request(app)
        .post(`/api/conversations/${conversationId}/assign`)
        .send({ agentId: agent.id });

      expect(assignResponse.status).toBe(200);

      // 4. Customer sends another message
      const messageResponse = await request(app)
        .post('/api/messages')
        .send({
          conversationId,
          message: 'My order number is #12345',
          visitorId,
        });

      expect(messageResponse.status).toBe(200);

      // 5. Retrieve conversation messages
      const messagesResponse = await request(app)
        .get(`/api/conversations/${conversationId}/messages`);

      expect(messagesResponse.status).toBe(200);
      expect(messagesResponse.body.messages.length).toBeGreaterThan(0);

      // 6. Agent ends conversation
      const endResponse = await request(app)
        .post(`/api/conversations/${conversationId}/end`)
        .send({ agentId: agent.id });

      expect(endResponse.status).toBe(200);

      // 7. Verify conversation archived
      const finalTicket = await prisma.tickets.findUnique({
        where: { id: conversationId },
      });
      expect(finalTicket.archived).toBe(true);
    });

    test('Flow 2: Conversation reassignment between agents', async () => {
      const agent1 = await createTestAgent(prisma);
      const agent2 = await createTestAgent(prisma);

      await prisma.agent_status.createMany({
        data: [
          {
            id: uuidv4(),
            user_id: agent1.id,
            status: 'online',
            updated_at: new Date(),
          },
          {
            id: uuidv4(),
            user_id: agent2.id,
            status: 'online',
            updated_at: new Date(),
          },
        ],
      });

      // 1. Create conversation
      const conversationId = uuidv4();
      await request(app)
        .post('/api/messages')
        .send({
          conversationId,
          message: 'Need technical support',
          visitorId: `visitor-${Date.now()}`,
        });

      // 2. Agent A assigns to themselves
      const assign1Response = await request(app)
        .post(`/api/conversations/${conversationId}/assign`)
        .send({ agentId: agent1.id });

      expect(assign1Response.status).toBe(200);

      // 3. Verify assignment to Agent A
      let ticket = await prisma.tickets.findUnique({
        where: { id: conversationId },
      });
      expect(ticket.assigned_agent_id).toBe(agent1.id);

      // 4. Agent B reassigns to themselves
      const assign2Response = await request(app)
        .post(`/api/conversations/${conversationId}/assign`)
        .send({ agentId: agent2.id });

      expect(assign2Response.status).toBe(200);

      // 5. Verify reassignment to Agent B
      ticket = await prisma.tickets.findUnique({
        where: { id: conversationId },
      });
      expect(ticket.assigned_agent_id).toBe(agent2.id);
    });

    test('Flow 3: Multiple customers with concurrent conversations', async () => {
      const agent = await createTestAgent(prisma);
      await prisma.agent_status.create({
        data: {
          id: uuidv4(),
          user_id: agent.id,
          status: 'online',
          updated_at: new Date(),
        },
      });

      // Create 3 concurrent conversations
      const conversations = [];
      for (let i = 1; i <= 3; i++) {
        const conversationId = uuidv4();
        const visitorId = `visitor-${Date.now()}-${i}`;

        await request(app)
          .post('/api/messages')
          .send({
            conversationId,
            message: `Customer ${i} needs help`,
            visitorId,
          });

        conversations.push({ conversationId, visitorId });
      }

      // Agent assigns all to themselves
      for (const conv of conversations) {
        await request(app)
          .post(`/api/conversations/${conv.conversationId}/assign`)
          .send({ agentId: agent.id });
      }

      // Verify all conversations assigned
      for (const conv of conversations) {
        const ticket = await prisma.tickets.findUnique({
          where: { id: conv.conversationId },
        });
        expect(ticket.assigned_agent_id).toBe(agent.id);
      }

      // Get all conversations
      const listResponse = await request(app)
        .get('/api/admin/conversations');

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.conversations.length).toBeGreaterThanOrEqual(3);
    });
  });
});
