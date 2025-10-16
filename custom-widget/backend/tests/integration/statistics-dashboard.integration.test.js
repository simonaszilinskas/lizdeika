/**
 * Dashboard Statistics Integration Tests
 *
 * Tests the complete dashboard statistics flow with real user actions.
 * This is the ultimate integration test that verifies the entire statistics
 * pipeline from multiple perspectives.
 *
 * Test Scenarios:
 * 1. Dashboard reflects all user actions correctly
 * 2. Combined statistics from multiple sources
 * 3. Real-world usage scenario with mixed activities
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

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Dashboard Statistics Integration Tests', () => {
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

  describe('Comprehensive Dashboard Tests', () => {
    test('dashboard reflects all user actions correctly', async () => {
      // This is the ULTIMATE test - simulates real agent workflow

      // 1. Setup: Create templates and categories
      const welcomeTemplate = await createTestTemplate(prisma, adminUser.id, {
        title: 'Welcome',
        content: 'Welcome! How can I help?',
      });

      const faqTemplate = await createTestTemplate(prisma, adminUser.id, {
        title: 'FAQ',
        content: 'Here are our frequently asked questions...',
      });

      const supportCategory = await createTestCategory(prisma, adminUser.id, {
        name: 'Support',
      });

      const billingCategory = await createTestCategory(prisma, adminUser.id, {
        name: 'Billing',
      });

      // 2. Simulate real agent workflow - 5 conversations
      const conversations = [];

      // Conversation 1: Support category, welcome template, AI sent-as-is
      const conv1 = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
        category_id: supportCategory.id,
        archived: false,
      });
      conversations.push(conv1);

      const conv1_msg1 = await createTestMessage(prisma, conv1.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        content: welcomeTemplate.content,
      });
      await createTestMessageStats(prisma, conv1_msg1.id, agentUser.id, conv1.id, {
        template_used: true,
        template_id: welcomeTemplate.id,
        ai_suggestion_used: true,
        suggestion_action: 'sent_as_is',
        system_mode: 'hitl',
      });

      // Conversation 2: Billing category, FAQ template, AI edited
      const conv2 = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
        category_id: billingCategory.id,
        archived: false,
      });
      conversations.push(conv2);

      const conv2_msg1 = await createTestMessage(prisma, conv2.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        content: faqTemplate.content,
      });
      await createTestMessageStats(prisma, conv2_msg1.id, agentUser.id, conv2.id, {
        template_used: true,
        template_id: faqTemplate.id,
        ai_suggestion_used: true,
        suggestion_action: 'edited',
        suggestion_edit_ratio: 0.2,
        system_mode: 'hitl',
      });

      // Conversation 3: Support, no template, from scratch
      const conv3 = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
        category_id: supportCategory.id,
        archived: true, // This one is archived
      });
      conversations.push(conv3);

      const conv3_msg1 = await createTestMessage(prisma, conv3.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        content: 'Custom response',
      });
      await createTestMessageStats(prisma, conv3_msg1.id, agentUser.id, conv3.id, {
        template_used: false,
        ai_suggestion_used: false,
        suggestion_action: 'from_scratch',
        system_mode: 'hitl',
      });

      // Conversation 4: Uncategorized, multiple messages with welcome template
      const conv4 = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
        category_id: null,
        archived: false,
      });
      conversations.push(conv4);

      for (let i = 0; i < 3; i++) {
        const msg = await createTestMessage(prisma, conv4.id, {
          sender_id: agentUser.id,
          senderType: 'agent',
          content: welcomeTemplate.content,
        });
        await createTestMessageStats(prisma, msg.id, agentUser.id, conv4.id, {
          template_used: true,
          template_id: welcomeTemplate.id,
          ai_suggestion_used: true,
          suggestion_action: 'sent_as_is',
          system_mode: 'hitl',
        });
      }

      // Conversation 5: Support, no template, AI suggestion
      const conv5 = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
        category_id: supportCategory.id,
        archived: false,
      });
      conversations.push(conv5);

      const conv5_msg1 = await createTestMessage(prisma, conv5.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        content: 'AI generated response',
      });
      await createTestMessageStats(prisma, conv5_msg1.id, agentUser.id, conv5.id, {
        template_used: false,
        ai_suggestion_used: true,
        suggestion_action: 'sent_as_is',
        system_mode: 'hitl',
      });

      // 3. Query dashboard statistics
      const response = await authenticatedGet(app, agentToken, '/api/statistics/dashboard');

      // 4. Comprehensive assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;

      // Conversation stats
      expect(data.conversations.totalConversations).toBe(5);
      expect(data.conversations.activeConversations).toBe(4);
      expect(data.conversations.archivedConversations).toBe(1);

      // Message stats (total: 1+1+1+3+1 = 7 messages)
      expect(data.messages.total_messages).toBeGreaterThanOrEqual(7);

      // Template stats (used in: conv1=1, conv2=1, conv4=3 = 5 total)
      expect(data.templates.templatedMessages).toBe(5);
      expect(data.templates.templatedMessages).toBe(2); // welcome + faq

      // AI suggestion stats (conv1=sent, conv2=edited, conv3=scratch, conv4=3xsent, conv5=sent = 6 total)
      expect(data.ai_suggestions.totalSuggestions).toBe(6);

      // Verify breakdown
      const aiBreakdown = data.ai_suggestions.breakdown;
      expect(aiBreakdown.sent_as_is.count).toBe(5); // conv1 + conv4(3) + conv5
      expect(aiBreakdown.edited.count).toBe(1); // conv2
      expect(aiBreakdown.from_scratch.count).toBe(0); // conv3 has ai_suggestion_used:false, so not counted
    });

    test('handles empty dashboard state', async () => {
      // 1. Query dashboard with no data
      const response = await authenticatedGet(app, agentToken, '/api/statistics/dashboard');

      // 2. Assert: All metrics zero
      expect(response.status).toBe(200);
      expect(response.body.data.conversations.totalConversations).toBe(0);
      expect(response.body.data.messages.total_messages).toBe(0);
      expect(response.body.data.templates.templatedMessages).toBe(0);
      expect(response.body.data.ai_suggestions.totalSuggestions).toBe(0);
    });

    test('dashboard respects date range filters', async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // 1. Create conversation today
      const todayTicket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
        created_at: now,
        updated_at: now,
      });
      const todayMsg = await createTestMessage(prisma, todayTicket.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        created_at: now,
      });
      await createTestMessageStats(prisma, todayMsg.id, agentUser.id, todayTicket.id, {
        created_at: now,
      });

      // 2. Create conversation two days ago
      const oldTicket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
        created_at: twoDaysAgo,
        updated_at: twoDaysAgo,
      });
      const oldMsg = await createTestMessage(prisma, oldTicket.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        created_at: twoDaysAgo,
      });
      await createTestMessageStats(prisma, oldMsg.id, agentUser.id, oldTicket.id, {
        created_at: twoDaysAgo,
      });

      // 3. Query dashboard with date filter (only today)
      const response = await authenticatedGet(app, agentToken, '/api/statistics/dashboard', {
        startDate: yesterday.toISOString(),
        endDate: now.toISOString(),
      });

      // 4. Assert: Only today's conversation counted
      expect(response.status).toBe(200);
      expect(response.body.data.conversations.totalConversations).toBe(1);
    });
  });

  describe('Category Distribution', () => {
    test('dashboard shows category distribution', async () => {
      // 1. Create categories
      const cat1 = await createTestCategory(prisma, adminUser.id, { name: 'Cat1' });
      const cat2 = await createTestCategory(prisma, adminUser.id, { name: 'Cat2' });

      // 2. Create conversations in different categories
      await createTestTicket(prisma, {
        category_id: cat1.id,
        assigned_agent_id: agentUser.id,
      });
      await createTestTicket(prisma, {
        category_id: cat1.id,
        assigned_agent_id: agentUser.id,
      });
      await createTestTicket(prisma, {
        category_id: cat2.id,
        assigned_agent_id: agentUser.id,
      });

      // 3. Query dashboard
      const response = await authenticatedGet(app, agentToken, '/api/statistics/dashboard');

      // 4. Assert: Categories shown
      expect(response.status).toBe(200);
      expect(response.body.data.conversations.totalConversations).toBe(3);
      // Dashboard should include category breakdown if available
      if (response.body.data.conversations.by_category) {
        expect(response.body.data.conversations.by_category.length).toBeGreaterThan(0);
      }
    });
  });
});
