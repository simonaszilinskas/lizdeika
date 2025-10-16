/**
 * AI Suggestion Statistics Integration Tests
 *
 * Tests the complete flow: AI Suggestions → Message Statistics → Statistics API
 * Uses real database operations and actual API calls (no mocks).
 *
 * Test Scenarios:
 * 1. AI suggestion acceptance tracked correctly
 * 2. AI suggestion editing tracked correctly
 * 3. From-scratch messages tracked correctly
 * 4. HITL mode filtering (excludes autopilot)
 * 5. Suggestion percentages calculated correctly
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAdmin,
  createTestAgent,
  createTestTicket,
  createTestMessage,
  createTestMessageStats,
} = require('./helpers/testData');
const { authenticatedGet, authenticateAsAgent, createTestApp } = require('./helpers/apiHelpers');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('AI Suggestion Statistics Integration Tests', () => {
  let prisma;
  let app;
  let adminUser;
  let agentUser;
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
    agentUser = await createTestAgent(prisma);
    const authResult = await authenticateAsAgent(app, prisma, agentUser.email, agentUser.plainPassword);
    agentToken = authResult.token;
  });

  describe('AI Suggestion Tracking', () => {
    test('tracks sent-as-is suggestions', async () => {
      // 1. Create conversation
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
      });

      // 2. Agent uses AI suggestion without editing
      const message = await createTestMessage(prisma, ticket.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        content: 'AI suggested response',
      });

      await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
        ai_suggestion_used: true,
        suggestion_action: 'sent_as_is',
        system_mode: 'hitl',
      });

      // 3. Query AI suggestions statistics
      const response = await authenticatedGet(app, agentToken, '/api/statistics/ai-suggestions');

      // 4. Assert: Sent-as-is tracked
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview.totalSuggestions).toBe(1);
      expect(response.body.data.breakdown.sent_as_is.count).toBe(1);
      expect(response.body.data.breakdown.sent_as_is.percentage).toBe(100);
    });

    test('tracks edited suggestions', async () => {
      // 1. Create conversation
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
      });

      // 2. Agent edits AI suggestion
      const message = await createTestMessage(prisma, ticket.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        content: 'Modified AI response',
      });

      await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
        ai_suggestion_used: true,
        suggestion_action: 'edited',
        suggestion_edit_ratio: 0.3,
        original_suggestion: 'Original AI response',
        system_mode: 'hitl',
      });

      // 3. Query statistics
      const response = await authenticatedGet(app, agentToken, '/api/statistics/ai-suggestions');

      // 4. Assert: Edited suggestion tracked
      expect(response.status).toBe(200);
      expect(response.body.data.overview.totalSuggestions).toBe(1);
      expect(response.body.data.breakdown.edited.count).toBe(1);
      expect(response.body.data.breakdown.edited.percentage).toBe(100);
    });

    test('tracks from-scratch messages', async () => {
      // 1. Create conversation
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
      });

      // 2. Agent writes from scratch (ignores AI suggestion)
      const message = await createTestMessage(prisma, ticket.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        content: 'Agent wrote this manually',
      });

      await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
        ai_suggestion_used: false,
        suggestion_action: 'from_scratch',
        system_mode: 'hitl',
      });

      // 3. Query statistics
      const response = await authenticatedGet(app, agentToken, '/api/statistics/ai-suggestions');

      // 4. Assert: From-scratch tracked
      expect(response.status).toBe(200);
      expect(response.body.data.overview.totalSuggestions).toBe(1);
      expect(response.body.data.breakdown.from_scratch.count).toBe(1);
      expect(response.body.data.breakdown.from_scratch.percentage).toBe(100);
    });
  });

  describe('Mixed Suggestion Actions', () => {
    test('calculates percentages correctly with mixed actions', async () => {
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
      });

      // 1. Create 10 messages with different actions
      // 5 sent-as-is
      for (let i = 0; i < 5; i++) {
        const msg = await createTestMessage(prisma, ticket.id, {
          sender_id: agentUser.id,
          senderType: 'agent',
        });
        await createTestMessageStats(prisma, msg.id, agentUser.id, ticket.id, {
          ai_suggestion_used: true,
          suggestion_action: 'sent_as_is',
          system_mode: 'hitl',
        });
      }

      // 3 edited
      for (let i = 0; i < 3; i++) {
        const msg = await createTestMessage(prisma, ticket.id, {
          sender_id: agentUser.id,
          senderType: 'agent',
        });
        await createTestMessageStats(prisma, msg.id, agentUser.id, ticket.id, {
          ai_suggestion_used: true,
          suggestion_action: 'edited',
          system_mode: 'hitl',
        });
      }

      // 2 from-scratch
      for (let i = 0; i < 2; i++) {
        const msg = await createTestMessage(prisma, ticket.id, {
          sender_id: agentUser.id,
          senderType: 'agent',
        });
        await createTestMessageStats(prisma, msg.id, agentUser.id, ticket.id, {
          ai_suggestion_used: false,
          suggestion_action: 'from_scratch',
          system_mode: 'hitl',
        });
      }

      // 2. Query statistics
      const response = await authenticatedGet(app, agentToken, '/api/statistics/ai-suggestions');

      // 3. Assert: Correct counts and percentages
      expect(response.status).toBe(200);
      expect(response.body.data.overview.totalSuggestions).toBe(10);

      const breakdown = response.body.data.breakdown;

      expect(breakdown.sent_as_is.count).toBe(5);
      expect(breakdown.sent_as_is.percentage).toBe(50);

      expect(breakdown.edited.count).toBe(3);
      expect(breakdown.edited.percentage).toBe(30);

      expect(breakdown.from_scratch.count).toBe(2);
      expect(breakdown.from_scratch.percentage).toBe(20);
    });
  });

  describe('HITL Mode Filtering', () => {
    test('excludes autopilot messages from statistics', async () => {
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
      });

      // 1. Create HITL message (should be counted)
      const hitlMessage = await createTestMessage(prisma, ticket.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
      });
      await createTestMessageStats(prisma, hitlMessage.id, agentUser.id, ticket.id, {
        ai_suggestion_used: true,
        suggestion_action: 'sent_as_is',
        system_mode: 'hitl',
      });

      // 2. Create autopilot message (should NOT be counted)
      const autopilotMessage = await createTestMessage(prisma, ticket.id, {
        sender_id: null,
        senderType: 'ai',
      });
      await createTestMessageStats(prisma, autopilotMessage.id, agentUser.id, ticket.id, {
        ai_suggestion_used: true,
        suggestion_action: 'sent_as_is',
        system_mode: 'autopilot',
      });

      // 3. Query statistics
      const response = await authenticatedGet(app, agentToken, '/api/statistics/ai-suggestions');

      // 4. Assert: Only HITL message counted
      expect(response.status).toBe(200);
      expect(response.body.data.overview.totalSuggestions).toBe(1);
      expect(response.body.data.breakdown.sent_as_is.count).toBe(1);
    });

    test('handles OFF mode messages', async () => {
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
      });

      // 1. Create message in OFF mode (no AI)
      const message = await createTestMessage(prisma, ticket.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
      });
      await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
        ai_suggestion_used: false,
        suggestion_action: null,
        system_mode: 'off',
      });

      // 2. Query statistics
      const response = await authenticatedGet(app, agentToken, '/api/statistics/ai-suggestions');

      // 3. Assert: OFF mode messages not counted
      expect(response.status).toBe(200);
      expect(response.body.data.overview.totalSuggestions).toBe(0);
    });
  });

  describe('Empty State', () => {
    test('returns zero statistics when no AI suggestions', async () => {
      // 1. Query with no data
      const response = await authenticatedGet(app, agentToken, '/api/statistics/ai-suggestions');

      // 2. Assert: All counts zero
      expect(response.status).toBe(200);
      expect(response.body.data.overview.totalSuggestions).toBe(0);
      expect(response.body.data.breakdown.sent_as_is.count).toBe(0);
      expect(response.body.data.breakdown.edited.count).toBe(0);
      expect(response.body.data.breakdown.from_scratch.count).toBe(0);
    });
  });
});
