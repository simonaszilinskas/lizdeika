/**
 * Agent Statistics Integration Tests
 *
 * Tests the /api/statistics/agents endpoint with real user actions.
 * This file was created specifically to catch bugs in agent attribution
 * and ranking that were missed in initial test coverage.
 *
 * Test Scenarios:
 * 1. All agents ranked by message count
 * 2. Specific agent details with activity breakdown
 * 3. Empty state handling
 * 4. AI suggestion usage integration
 * 5. Date range filtering
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAdmin,
  createTestAgent,
  createTestTemplate,
  createTestCategory,
  createTestTicket,
  createTestMessage,
  createTestMessageStats,
} = require('./helpers/testData');
const { authenticatedGet, authenticateAsAgent, createTestApp } = require('./helpers/apiHelpers');

require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Agent Statistics Integration Tests', () => {
  let prisma;
  let app;
  let adminUser;
  let agent1;
  let agent2;
  let agent3;
  let agentToken;

  beforeAll(async () => {
    prisma = await initializeTestDatabase();
    app = createTestApp();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    adminUser = await createTestAdmin(prisma);
    agent1 = await createTestAgent(prisma, { email: 'agent1@test.com', first_name: 'Agent', last_name: 'One' });
    agent2 = await createTestAgent(prisma, { email: 'agent2@test.com', first_name: 'Agent', last_name: 'Two' });
    agent3 = await createTestAgent(prisma, { email: 'agent3@test.com', first_name: 'Agent', last_name: 'Three' });
    const authResult = await authenticateAsAgent(app, prisma, agent1.email, agent1.plainPassword);
    agentToken = authResult.token;
  });

  describe('GET /api/statistics/agents - All Agents Ranking', () => {
    test('returns all agents ranked by message count', async () => {
      // Create tickets for each agent
      const ticket1 = await createTestTicket(prisma, { assigned_agent_id: agent1.id });
      const ticket2 = await createTestTicket(prisma, { assigned_agent_id: agent2.id });
      const ticket3 = await createTestTicket(prisma, { assigned_agent_id: agent3.id });

      // Agent1: 5 messages (highest)
      for (let i = 0; i < 5; i++) {
        const msg = await createTestMessage(prisma, ticket1.id, {
          sender_id: agent1.id,
          senderType: 'agent',
          content: `Message ${i} from agent1`,
        });
        await createTestMessageStats(prisma, msg.id, agent1.id, ticket1.id, {
          ai_suggestion_used: false,
          template_used: false,
          system_mode: 'hitl',
        });
      }

      // Agent2: 3 messages (middle)
      for (let i = 0; i < 3; i++) {
        const msg = await createTestMessage(prisma, ticket2.id, {
          sender_id: agent2.id,
          senderType: 'agent',
          content: `Message ${i} from agent2`,
        });
        await createTestMessageStats(prisma, msg.id, agent2.id, ticket2.id, {
          ai_suggestion_used: false,
          template_used: false,
          system_mode: 'hitl',
        });
      }

      // Agent3: 2 messages (lowest)
      for (let i = 0; i < 2; i++) {
        const msg = await createTestMessage(prisma, ticket3.id, {
          sender_id: agent3.id,
          senderType: 'agent',
          content: `Message ${i} from agent3`,
        });
        await createTestMessageStats(prisma, msg.id, agent3.id, ticket3.id, {
          ai_suggestion_used: false,
          template_used: false,
          system_mode: 'hitl',
        });
      }

      // Query agents endpoint
      const response = await authenticatedGet(app, agentToken, '/api/statistics/agents');

      console.log('[TEST] Agents API response:', JSON.stringify(response.body, null, 2));

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const agents = response.body.data.agents;
      expect(agents).toBeDefined();
      expect(agents.length).toBe(3);

      // Verify ranking order (highest to lowest)
      expect(agents[0].agentId).toBe(agent1.id);
      expect(agents[0].name).toBe('Agent One');
      expect(agents[0].email).toBe('agent1@test.com');
      expect(agents[0].messageCount).toBe(5);
      expect(agents[0].percentage).toBeCloseTo(50, 0); // 5/10 * 100 = 50%

      expect(agents[1].agentId).toBe(agent2.id);
      expect(agents[1].name).toBe('Agent Two');
      expect(agents[1].messageCount).toBe(3);
      expect(agents[1].percentage).toBeCloseTo(30, 0); // 3/10 * 100 = 30%

      expect(agents[2].agentId).toBe(agent3.id);
      expect(agents[2].name).toBe('Agent Three');
      expect(agents[2].messageCount).toBe(2);
      expect(agents[2].percentage).toBeCloseTo(20, 0); // 2/10 * 100 = 20%

      // Verify percentages add up to 100%
      const totalPercentage = agents.reduce((sum, agent) => sum + agent.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100, 0);
    });

    test('handles no agent activity gracefully', async () => {
      // Query with no message_statistics records
      const response = await authenticatedGet(app, agentToken, '/api/statistics/agents');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.agents).toEqual([]);
    });

    test('calculates AI suggestion usage percentage correctly', async () => {
      const template = await createTestTemplate(prisma, adminUser.id, {
        title: 'Test Template',
        content: 'Template content',
      });
      const ticket = await createTestTicket(prisma, { assigned_agent_id: agent1.id });

      // Create 4 messages with different AI suggestion patterns
      // Message 1: Template + AI suggestion (counts toward AI usage)
      const msg1 = await createTestMessage(prisma, ticket.id, {
        sender_id: agent1.id,
        senderType: 'agent',
        content: 'Message with template and AI',
      });
      await createTestMessageStats(prisma, msg1.id, agent1.id, ticket.id, {
        ai_suggestion_used: true,
        suggestion_action: 'sent_as_is',
        template_used: true,
        template_id: template.id,
        system_mode: 'hitl',
      });

      // Message 2: Only AI suggestion (counts toward AI usage)
      const msg2 = await createTestMessage(prisma, ticket.id, {
        sender_id: agent1.id,
        senderType: 'agent',
        content: 'Message with AI only',
      });
      await createTestMessageStats(prisma, msg2.id, agent1.id, ticket.id, {
        ai_suggestion_used: true,
        suggestion_action: 'edited',
        template_used: false,
        system_mode: 'hitl',
      });

      // Message 3: Only template (no AI)
      const msg3 = await createTestMessage(prisma, ticket.id, {
        sender_id: agent1.id,
        senderType: 'agent',
        content: 'Message with template only',
      });
      await createTestMessageStats(prisma, msg3.id, agent1.id, ticket.id, {
        ai_suggestion_used: false,
        template_used: true,
        template_id: template.id,
        system_mode: 'hitl',
      });

      // Message 4: Manual message (no AI, no template)
      const msg4 = await createTestMessage(prisma, ticket.id, {
        sender_id: agent1.id,
        senderType: 'agent',
        content: 'Manual message',
      });
      await createTestMessageStats(prisma, msg4.id, agent1.id, ticket.id, {
        ai_suggestion_used: false,
        template_used: false,
        system_mode: 'hitl',
      });

      // Query agents endpoint
      const response = await authenticatedGet(app, agentToken, '/api/statistics/agents');

      expect(response.status).toBe(200);
      const agents = response.body.data.agents;
      expect(agents.length).toBe(1);

      // Verify AI suggestion usage percentage (2 out of 4 messages used AI)
      expect(agents[0].messageCount).toBe(4);
      expect(agents[0].suggestionUsage).toBeCloseTo(50, 0); // 2/4 * 100 = 50%
    });
  });

  describe('GET /api/statistics/agents?agentId=xxx - Specific Agent', () => {
    test('returns specific agent details with activity breakdown', async () => {
      const template = await createTestTemplate(prisma, adminUser.id, {
        title: 'Test Template',
        content: 'Template content',
      });
      const ticket = await createTestTicket(prisma, { assigned_agent_id: agent1.id });

      // Create various messages for agent1
      const msg1 = await createTestMessage(prisma, ticket.id, {
        sender_id: agent1.id,
        senderType: 'agent',
        content: 'Sent as is',
      });
      await createTestMessageStats(prisma, msg1.id, agent1.id, ticket.id, {
        ai_suggestion_used: true,
        suggestion_action: 'sent_as_is',
        template_used: false,
        system_mode: 'hitl',
      });

      const msg2 = await createTestMessage(prisma, ticket.id, {
        sender_id: agent1.id,
        senderType: 'agent',
        content: 'Edited suggestion',
      });
      await createTestMessageStats(prisma, msg2.id, agent1.id, ticket.id, {
        ai_suggestion_used: true,
        suggestion_action: 'edited',
        template_used: false,
        system_mode: 'hitl',
      });

      const msg3 = await createTestMessage(prisma, ticket.id, {
        sender_id: agent1.id,
        senderType: 'agent',
        content: 'Template message',
      });
      await createTestMessageStats(prisma, msg3.id, agent1.id, ticket.id, {
        ai_suggestion_used: false,
        template_used: true,
        template_id: template.id,
        system_mode: 'hitl',
      });

      // Query specific agent
      const response = await authenticatedGet(app, agentToken, `/api/statistics/agents?agentId=${agent1.id}`);

      console.log('[TEST] Specific agent API response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data.agent).toBeDefined();
      expect(data.agent.agentId).toBe(agent1.id);
      expect(data.agent.totalMessages).toBe(3);

      expect(data.suggestions).toBeDefined();
      expect(data.suggestions.totalSuggestions).toBe(2);
      expect(data.suggestions.sentAsIs).toBe(1);
      expect(data.suggestions.edited).toBe(1);
    });
  });

  describe('Date Range Filtering', () => {
    test('filters agent statistics by date range', async () => {
      const ticket = await createTestTicket(prisma, { assigned_agent_id: agent1.id });

      // Create message 5 days ago
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 5);
      const oldMsg = await createTestMessage(prisma, ticket.id, {
        sender_id: agent1.id,
        senderType: 'agent',
        content: 'Old message',
        created_at: oldDate,
      });
      await createTestMessageStats(prisma, oldMsg.id, agent1.id, ticket.id, {
        ai_suggestion_used: false,
        template_used: false,
        system_mode: 'hitl',
        created_at: oldDate,
      });

      // Create message today
      const newMsg = await createTestMessage(prisma, ticket.id, {
        sender_id: agent1.id,
        senderType: 'agent',
        content: 'New message',
      });
      await createTestMessageStats(prisma, newMsg.id, agent1.id, ticket.id, {
        ai_suggestion_used: false,
        template_used: false,
        system_mode: 'hitl',
      });

      // Query with date range excluding old message
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 2); // 2 days ago
      const endDate = new Date();

      const response = await authenticatedGet(
        app,
        agentToken,
        `/api/statistics/agents?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );

      expect(response.status).toBe(200);
      const agents = response.body.data.agents;
      expect(agents.length).toBe(1);
      expect(agents[0].messageCount).toBe(1); // Only the new message
    });
  });
});
