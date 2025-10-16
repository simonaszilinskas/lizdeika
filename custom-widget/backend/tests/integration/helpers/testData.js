/**
 * Test Data Utilities
 *
 * Utilities for creating and managing test data in integration tests.
 * Provides factories for creating users, templates, categories, and other entities.
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Create test admin user
 * @param {Object} prisma - Prisma client instance
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created user
 */
async function createTestAdmin(prisma, overrides = {}) {
  const userId = overrides.id || uuidv4();
  const email = overrides.email || `admin-${Date.now()}@test.com`;
  const password = overrides.password || 'Admin123!';

  const user = await prisma.users.create({
    data: {
      id: userId,
      email,
      password_hash: await bcrypt.hash(password, 10),
      first_name: overrides.first_name || 'Test',
      last_name: overrides.last_name || 'Admin',
      role: 'admin',
      is_active: overrides.is_active !== undefined ? overrides.is_active : true,
      email_verified: overrides.email_verified !== undefined ? overrides.email_verified : true,
      created_at: overrides.created_at || new Date(),
      updated_at: overrides.updated_at || new Date(),
    },
  });

  return { ...user, plainPassword: password };
}

/**
 * Create test agent user
 * @param {Object} prisma - Prisma client instance
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created user
 */
async function createTestAgent(prisma, overrides = {}) {
  const userId = overrides.id || uuidv4();
  const email = overrides.email || `agent-${Date.now()}@test.com`;
  const password = overrides.password || 'Agent123!';

  const user = await prisma.users.create({
    data: {
      id: userId,
      email,
      password_hash: await bcrypt.hash(password, 10),
      first_name: overrides.first_name || 'Test',
      last_name: overrides.last_name || 'Agent',
      role: 'agent',
      is_active: overrides.is_active !== undefined ? overrides.is_active : true,
      email_verified: overrides.email_verified !== undefined ? overrides.email_verified : true,
      created_at: overrides.created_at || new Date(),
      updated_at: overrides.updated_at || new Date(),
    },
  });

  return { ...user, plainPassword: password };
}

/**
 * Create test customer user
 * @param {Object} prisma - Prisma client instance
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created user
 */
async function createTestCustomer(prisma, overrides = {}) {
  const userId = overrides.id || uuidv4();
  const email = overrides.email || `customer-${Date.now()}@test.com`;
  const password = overrides.password || 'Customer123!';

  const user = await prisma.users.create({
    data: {
      id: userId,
      email,
      password_hash: await bcrypt.hash(password, 10),
      first_name: overrides.first_name || 'Test',
      last_name: overrides.last_name || 'Customer',
      role: 'user',
      is_active: overrides.is_active !== undefined ? overrides.is_active : true,
      email_verified: overrides.email_verified !== undefined ? overrides.email_verified : true,
      created_at: overrides.created_at || new Date(),
      updated_at: overrides.updated_at || new Date(),
    },
  });

  return { ...user, plainPassword: password };
}

/**
 * Create test response template
 * @param {Object} prisma - Prisma client instance
 * @param {string} creatorId - User ID of template creator
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created template
 */
async function createTestTemplate(prisma, creatorId, overrides = {}) {
  const templateId = overrides.id || uuidv4();

  const template = await prisma.response_templates.create({
    data: {
      id: templateId,
      title: overrides.title || `Test Template ${Date.now()}`,
      content: overrides.content || 'This is a test template for integration tests.',
      created_by: creatorId,
      is_active: overrides.is_active !== undefined ? overrides.is_active : true,
      created_at: overrides.created_at || new Date(),
      updated_at: overrides.updated_at || new Date(),
    },
  });

  return template;
}

/**
 * Create test ticket category
 * @param {Object} prisma - Prisma client instance
 * @param {string} creatorId - User ID of category creator
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created category
 */
async function createTestCategory(prisma, creatorId, overrides = {}) {
  const categoryId = overrides.id || uuidv4();

  const category = await prisma.ticket_categories.create({
    data: {
      id: categoryId,
      name: overrides.name || `Test Category ${Date.now()}`,
      description: overrides.description || 'Test category for integration tests',
      color: overrides.color || '#6B7280',
      created_by: creatorId,
      is_archived: overrides.is_archived !== undefined ? overrides.is_archived : false,
      created_at: overrides.created_at || new Date(),
      updated_at: overrides.updated_at || new Date(),
    },
  });

  return category;
}

/**
 * Create test ticket (conversation)
 * @param {Object} prisma - Prisma client instance
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created ticket
 */
async function createTestTicket(prisma, overrides = {}) {
  const ticketId = overrides.id || uuidv4();
  const ticketNumber = overrides.ticket_number || `TEST-${Date.now()}`;

  const ticket = await prisma.tickets.create({
    data: {
      id: ticketId,
      ticket_number: ticketNumber,
      user_id: overrides.user_id || null,
      assigned_agent_id: overrides.assigned_agent_id || null,
      subject: overrides.subject || 'Test Ticket',
      description: overrides.description || 'Test ticket for integration tests',
      priority: overrides.priority || 'medium',
      category_id: overrides.category_id || null,
      source: overrides.source || 'widget',
      archived: overrides.archived !== undefined ? overrides.archived : false,
      created_at: overrides.created_at || new Date(),
      updated_at: overrides.updated_at || new Date(),
    },
  });

  return ticket;
}

/**
 * Create test message
 * @param {Object} prisma - Prisma client instance
 * @param {string} ticketId - Ticket ID
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created message
 */
async function createTestMessage(prisma, ticketId, overrides = {}) {
  const messageId = overrides.id || uuidv4();

  const message = await prisma.messages.create({
    data: {
      id: messageId,
      ticket_id: ticketId,
      sender_id: overrides.sender_id || null,
      senderType: overrides.senderType || 'agent',
      content: overrides.content || 'Test message content',
      message_type: overrides.message_type || 'text',
      metadata: overrides.metadata || null,
      created_at: overrides.created_at || new Date(),
    },
  });

  return message;
}

/**
 * Create test message statistics
 * @param {Object} prisma - Prisma client instance
 * @param {string} messageId - Message ID
 * @param {string} agentId - Agent user ID
 * @param {string} ticketId - Ticket ID
 * @param {Object} overrides - Override default values
 * @returns {Promise<Object>} Created message statistics
 */
async function createTestMessageStats(prisma, messageId, agentId, ticketId, overrides = {}) {
  const statsId = overrides.id || uuidv4();

  const stats = await prisma.message_statistics.create({
    data: {
      id: statsId,
      message_id: messageId,
      agent_id: agentId,
      ticket_id: ticketId,
      ai_suggestion_used: overrides.ai_suggestion_used !== undefined ? overrides.ai_suggestion_used : false,
      suggestion_action: overrides.suggestion_action || null,
      suggestion_edit_ratio: overrides.suggestion_edit_ratio || null,
      original_suggestion: overrides.original_suggestion || null,
      template_used: overrides.template_used !== undefined ? overrides.template_used : false,
      template_id: overrides.template_id || null,
      system_mode: overrides.system_mode || 'hitl',
      created_at: overrides.created_at || new Date(),
    },
  });

  return stats;
}

/**
 * Cleanup all test data
 * Removes all data from database in correct order
 * @param {Object} prisma - Prisma client instance
 */
async function cleanupAllTestData(prisma) {
  await prisma.$transaction([
    prisma.message_statistics.deleteMany(),
    prisma.messages.deleteMany(),
    prisma.ticket_actions.deleteMany(),
    prisma.tickets.deleteMany(),
    prisma.user_activities.deleteMany(),
    prisma.agent_status.deleteMany(),
    prisma.refresh_tokens.deleteMany(),
    prisma.response_templates.deleteMany(),
    prisma.categories.deleteMany(),
    prisma.system_logs.deleteMany(),
    prisma.application_logs.deleteMany(),
    prisma.users.deleteMany(),
  ]);
}

module.exports = {
  createTestAdmin,
  createTestAgent,
  createTestCustomer,
  createTestTemplate,
  createTestCategory,
  createTestTicket,
  createTestMessage,
  createTestMessageStats,
  cleanupAllTestData,
};
