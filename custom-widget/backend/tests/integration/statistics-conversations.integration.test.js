/**
 * Conversation Statistics Integration Tests
 *
 * Tests the complete flow: Conversations → Statistics API
 * Uses real database operations and actual API calls (no mocks).
 *
 * Test Scenarios:
 * 1. Conversation counts are accurate
 * 2. Archived conversations tracked separately
 * 3. Category-based statistics work correctly
 * 4. Date range filtering functions properly
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAdmin,
  createTestAgent,
  createTestCategory,
  createTestTicket,
} = require('./helpers/testData');
const { authenticatedGet, authenticateAsAgent, createTestApp } = require('./helpers/apiHelpers');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Conversation Statistics Integration Tests', () => {
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

  describe('Conversation Counts', () => {
    test('returns correct total conversation count', async () => {
      // 1. Create 5 conversations
      for (let i = 0; i < 5; i++) {
        await createTestTicket(prisma, {
          ticket_number: `TEST-${Date.now()}-${i}`,
          assigned_agent_id: agentUser.id,
        });
      }

      // 2. Query statistics API
      const response = await authenticatedGet(app, agentToken, '/api/statistics/conversations');

      // 3. Assert: Total conversations should be 5
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview.total_conversations).toBe(5);
    });

    test('tracks archived conversations separately', async () => {
      // 1. Create 3 active conversations
      for (let i = 0; i < 3; i++) {
        await createTestTicket(prisma, {
          ticket_number: `ACTIVE-${Date.now()}-${i}`,
          archived: false,
        });
      }

      // 2. Create 2 archived conversations
      for (let i = 0; i < 2; i++) {
        await createTestTicket(prisma, {
          ticket_number: `ARCHIVED-${Date.now()}-${i}`,
          archived: true,
        });
      }

      // 3. Query statistics API
      const response = await authenticatedGet(app, agentToken, '/api/statistics/conversations');

      // 4. Assert: Correct counts
      expect(response.status).toBe(200);
      expect(response.body.data.overview.total_conversations).toBe(5);
      expect(response.body.data.overview.archived_conversations).toBe(2);
      expect(response.body.data.overview.active_conversations).toBe(3);
    });

    test('empty database returns zero counts', async () => {
      // 1. Query statistics with no conversations
      const response = await authenticatedGet(app, agentToken, '/api/statistics/conversations');

      // 2. Assert: All counts should be 0
      expect(response.status).toBe(200);
      expect(response.body.data.overview.total_conversations).toBe(0);
      expect(response.body.data.overview.archived_conversations).toBe(0);
      expect(response.body.data.overview.active_conversations).toBe(0);
    });
  });

  describe('Category Statistics', () => {
    test('groups conversations by category correctly', async () => {
      // 1. Create two categories
      const categoryA = await createTestCategory(prisma, adminUser.id, {
        name: 'Category A',
      });

      const categoryB = await createTestCategory(prisma, adminUser.id, {
        name: 'Category B',
      });

      // 2. Create conversations in different categories
      // 3 in Category A
      for (let i = 0; i < 3; i++) {
        await createTestTicket(prisma, {
          ticket_number: `CATA-${Date.now()}-${i}`,
          category_id: categoryA.id,
        });
      }

      // 2 in Category B
      for (let i = 0; i < 2; i++) {
        await createTestTicket(prisma, {
          ticket_number: `CATB-${Date.now()}-${i}`,
          category_id: categoryB.id,
        });
      }

      // 1 uncategorized
      await createTestTicket(prisma, {
        ticket_number: `UNCAT-${Date.now()}`,
        category_id: null,
      });

      // 3. Query statistics API
      const response = await authenticatedGet(app, agentToken, '/api/statistics/conversations');

      // 4. Assert: Categories counted correctly
      expect(response.status).toBe(200);
      expect(response.body.data.overview.total_conversations).toBe(6);

      const byCategory = response.body.data.by_category;
      expect(byCategory).toHaveLength(3); // 2 categories + uncategorized

      // Find each category in results
      const catAStats = byCategory.find(c => c.category_id === categoryA.id);
      const catBStats = byCategory.find(c => c.category_id === categoryB.id);
      const uncatStats = byCategory.find(c => c.category_id === null);

      expect(catAStats.count).toBe(3);
      expect(catBStats.count).toBe(2);
      expect(uncatStats.count).toBe(1);
    });

    test('filters by specific category', async () => {
      // 1. Create category and conversations
      const category = await createTestCategory(prisma, adminUser.id, {
        name: 'Support',
      });

      await createTestTicket(prisma, {
        category_id: category.id,
      });

      await createTestTicket(prisma, {
        category_id: category.id,
      });

      await createTestTicket(prisma, {
        category_id: null, // Different category
      });

      // 2. Query with category filter
      const response = await authenticatedGet(app, agentToken, '/api/statistics/conversations', {
        category_id: category.id,
      });

      // 3. Assert: Only filtered category counted
      expect(response.status).toBe(200);
      expect(response.body.data.overview.total_conversations).toBe(2);
    });
  });

  describe('Date Range Filtering', () => {
    test('filters conversations by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      // 1. Create conversations at different times
      await createTestTicket(prisma, {
        ticket_number: 'TODAY',
        created_at: now,
        updated_at: now,
      });

      await createTestTicket(prisma, {
        ticket_number: 'YESTERDAY',
        created_at: yesterday,
        updated_at: yesterday,
      });

      await createTestTicket(prisma, {
        ticket_number: 'TWO-DAYS',
        created_at: twoDaysAgo,
        updated_at: twoDaysAgo,
      });

      await createTestTicket(prisma, {
        ticket_number: 'THREE-DAYS',
        created_at: threeDaysAgo,
        updated_at: threeDaysAgo,
      });

      // 2. Query with date range (last 2 days)
      const response = await authenticatedGet(app, agentToken, '/api/statistics/conversations', {
        startDate: twoDaysAgo.toISOString(),
        endDate: now.toISOString(),
      });

      // 3. Assert: Only conversations in range
      expect(response.status).toBe(200);
      // Should include: TODAY, YESTERDAY, TWO-DAYS (not THREE-DAYS)
      expect(response.body.data.overview.total_conversations).toBe(3);
    });
  });
});
