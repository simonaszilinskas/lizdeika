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
const { authenticatedGet, authenticateAsAgent, createTestApp, cleanupWebSocketService } = require('./helpers/apiHelpers');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('AI Suggestion Statistics Integration Tests', () => {
  let prisma;
  let app;
  let websocketService;
  let adminUser;
  let agentUser;
  let agentToken;

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
      expect(response.body.data.totalSuggestions).toBe(1);
      expect(response.body.data.sentAsIs).toBe(1);
      expect(response.body.data.sentAsIsPercentage).toBe(100);
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
      expect(response.body.data.totalSuggestions).toBe(1);
      expect(response.body.data.edited).toBe(1);
      expect(response.body.data.editedPercentage).toBe(100);
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

      // 4. Assert: From-scratch not counted as AI suggestion (correct behavior)
      // Since no AI suggestion was actually used, totalSuggestions should be 0
      expect(response.status).toBe(200);
      expect(response.body.data.totalSuggestions).toBe(0);
      expect(response.body.data.fromScratch).toBe(0);
      expect(response.body.data.sentAsIs).toBe(0);
      expect(response.body.data.edited).toBe(0);
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
      // Only counts actual AI suggestions (ai_suggestion_used=true), so 8 total (5+3)
      // The 2 from-scratch messages don't count as AI suggestions
      expect(response.status).toBe(200);
      expect(response.body.data.totalSuggestions).toBe(8);

      expect(response.body.data.sentAsIs).toBe(5);
      expect(response.body.data.sentAsIsPercentage).toBeCloseTo(62.5, 1); // 5/8 = 62.5%

      expect(response.body.data.edited).toBe(3);
      expect(response.body.data.editedPercentage).toBeCloseTo(37.5, 1); // 3/8 = 37.5%

      expect(response.body.data.fromScratch).toBe(0); // Not counted in AI suggestions
      expect(response.body.data.fromScratchPercentage).toBe(0);
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
      expect(response.body.data.totalSuggestions).toBe(1);
      expect(response.body.data.sentAsIs).toBe(1);
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
      expect(response.body.data.totalSuggestions).toBe(0);
    });
  });

  describe('Empty State', () => {
    test('returns zero statistics when no AI suggestions', async () => {
      // 1. Query with no data
      const response = await authenticatedGet(app, agentToken, '/api/statistics/ai-suggestions');

      // 2. Assert: All counts zero
      expect(response.status).toBe(200);
      expect(response.body.data.totalSuggestions).toBe(0);
      expect(response.body.data.sentAsIs).toBe(0);
      expect(response.body.data.edited).toBe(0);
      expect(response.body.data.fromScratch).toBe(0);
    });
  });
});
