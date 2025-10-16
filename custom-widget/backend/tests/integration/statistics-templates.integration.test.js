/**
 * Template Statistics Integration Tests
 *
 * Tests the complete flow: Template usage → Message Statistics → Statistics API
 * Uses real database operations and actual API calls (no mocks).
 *
 * Test Scenarios:
 * 1. Basic template usage increments statistics
 * 2. Multiple template usages are tracked correctly
 * 3. Different templates are counted separately
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
  getTestClient,
} = require('./setup/testDatabase');
const {
  createTestAdmin,
  createTestAgent,
  createTestTemplate,
  createTestTicket,
  createTestMessage,
  createTestMessageStats,
} = require('./helpers/testData');
const { authenticatedGet, authenticateAsAgent } = require('./helpers/apiHelpers');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Template Statistics Integration Tests', () => {
  let prisma;
  let app;
  let adminUser;
  let agentUser;
  let agentToken;

  beforeAll(async () => {
    // Initialize test database
    prisma = await initializeTestDatabase();

    // Load Express app for testing
    app = require('../../server');
  });

  afterAll(async () => {
    // Close database connection
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean database before each test
    await resetTestDatabase();

    // Create test users
    adminUser = await createTestAdmin(prisma);
    agentUser = await createTestAgent(prisma);

    // Authenticate as agent
    const authResult = await authenticateAsAgent(app, prisma, agentUser.email, agentUser.plainPassword);
    agentToken = authResult.token;
  });

  describe('Basic Template Usage', () => {
    test('template usage increments statistics', async () => {
      // 1. Create a template
      const template = await createTestTemplate(prisma, adminUser.id, {
        title: 'Welcome Message',
        content: 'Welcome! How can I help you today?',
      });

      // 2. Create a conversation
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
      });

      // 3. Create a message using the template
      const message = await createTestMessage(prisma, ticket.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        content: template.content,
      });

      // 4. Record message statistics with template usage
      await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
        template_used: true,
        template_id: template.id,
        system_mode: 'HITL',
      });

      // 5. Query the statistics API
      const response = await authenticatedGet(app, agentToken, '/api/statistics/templates');

      // 6. Assert: Template usage count should be 1
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview.total_messages_with_templates).toBe(1);
      expect(response.body.data.overview.unique_templates_used).toBe(1);

      // 7. Assert: Our specific template should appear in the list
      const templateStats = response.body.data.top_templates;
      expect(templateStats).toHaveLength(1);
      expect(templateStats[0].template_id).toBe(template.id);
      expect(templateStats[0].template_title).toBe('Welcome Message');
      expect(templateStats[0].usage_count).toBe(1);
    });

    test('message without template does not increment statistics', async () => {
      // 1. Create a template (but don't use it)
      const template = await createTestTemplate(prisma, adminUser.id);

      // 2. Create conversation and message WITHOUT template
      const ticket = await createTestTicket(prisma, {
        assigned_agent_id: agentUser.id,
      });

      const message = await createTestMessage(prisma, ticket.id, {
        sender_id: agentUser.id,
        senderType: 'agent',
        content: 'Custom message without template',
      });

      // 3. Record stats WITHOUT template usage
      await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
        template_used: false,
        template_id: null,
      });

      // 4. Query statistics API
      const response = await authenticatedGet(app, agentToken, '/api/statistics/templates');

      // 5. Assert: No template usage recorded
      expect(response.status).toBe(200);
      expect(response.body.data.overview.total_messages_with_templates).toBe(0);
      expect(response.body.data.overview.unique_templates_used).toBe(0);
      expect(response.body.data.top_templates).toHaveLength(0);
    });
  });

  describe('Multiple Template Usages', () => {
    test('tracks multiple usages of same template correctly', async () => {
      // 1. Create a template
      const template = await createTestTemplate(prisma, adminUser.id, {
        title: 'FAQ Response',
      });

      // 2. Use the template 3 times
      for (let i = 0; i < 3; i++) {
        const ticket = await createTestTicket(prisma, {
          assigned_agent_id: agentUser.id,
          ticket_number: `TEST-${Date.now()}-${i}`,
        });

        const message = await createTestMessage(prisma, ticket.id, {
          sender_id: agentUser.id,
          senderType: 'agent',
          content: template.content,
        });

        await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
          template_used: true,
          template_id: template.id,
        });
      }

      // 3. Query statistics API
      const response = await authenticatedGet(app, agentToken, '/api/statistics/templates');

      // 4. Assert: Template used 3 times
      expect(response.status).toBe(200);
      expect(response.body.data.overview.total_messages_with_templates).toBe(3);
      expect(response.body.data.overview.unique_templates_used).toBe(1);

      const templateStats = response.body.data.top_templates;
      expect(templateStats).toHaveLength(1);
      expect(templateStats[0].template_id).toBe(template.id);
      expect(templateStats[0].usage_count).toBe(3);
    });

    test('tracks different templates separately', async () => {
      // 1. Create two different templates
      const welcomeTemplate = await createTestTemplate(prisma, adminUser.id, {
        title: 'Welcome',
        content: 'Welcome message',
      });

      const farewellTemplate = await createTestTemplate(prisma, adminUser.id, {
        title: 'Farewell',
        content: 'Goodbye message',
      });

      // 2. Use welcome template 2 times
      for (let i = 0; i < 2; i++) {
        const ticket = await createTestTicket(prisma, {
          assigned_agent_id: agentUser.id,
          ticket_number: `WELCOME-${Date.now()}-${i}`,
        });

        const message = await createTestMessage(prisma, ticket.id, {
          sender_id: agentUser.id,
          senderType: 'agent',
        });

        await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
          template_used: true,
          template_id: welcomeTemplate.id,
        });
      }

      // 3. Use farewell template 3 times
      for (let i = 0; i < 3; i++) {
        const ticket = await createTestTicket(prisma, {
          assigned_agent_id: agentUser.id,
          ticket_number: `FAREWELL-${Date.now()}-${i}`,
        });

        const message = await createTestMessage(prisma, ticket.id, {
          sender_id: agentUser.id,
          senderType: 'agent',
        });

        await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
          template_used: true,
          template_id: farewellTemplate.id,
        });
      }

      // 4. Query statistics API
      const response = await authenticatedGet(app, agentToken, '/api/statistics/templates');

      // 5. Assert: Both templates tracked separately
      expect(response.status).toBe(200);
      expect(response.body.data.overview.total_messages_with_templates).toBe(5);
      expect(response.body.data.overview.unique_templates_used).toBe(2);

      const templateStats = response.body.data.top_templates;
      expect(templateStats).toHaveLength(2);

      // Farewell should be first (3 uses > 2 uses)
      expect(templateStats[0].template_id).toBe(farewellTemplate.id);
      expect(templateStats[0].usage_count).toBe(3);

      // Welcome should be second
      expect(templateStats[1].template_id).toBe(welcomeTemplate.id);
      expect(templateStats[1].usage_count).toBe(2);
    });
  });
});
