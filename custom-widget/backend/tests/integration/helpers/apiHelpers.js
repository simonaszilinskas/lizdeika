/**
 * API Test Helpers
 *
 * Common utilities for making authenticated API requests in integration tests.
 * Provides helpers for authentication, request building, and common operations.
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const { createTestApp: createApp } = require('./testApp');

/**
 * Create Express app instance for testing
 * Creates minimal app without external dependencies
 * Returns { app, websocketService } for proper cleanup
 */
function createTestApp() {
  const { app, websocketService } = createApp();
  return { app, websocketService };
}

/**
 * Login and get JWT access token
 * @param {Object} app - Express app instance
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<string>} JWT access token
 */
async function login(app, email, password) {
  console.log('[TEST DEBUG] Attempting login with:', { email, passwordLength: password?.length });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  console.log('[TEST DEBUG] Login response:', {
    status: response.status,
    hasToken: !!response.body?.data?.tokens?.accessToken,
    tokenLength: response.body?.data?.tokens?.accessToken?.length
  });

  if (response.status !== 200) {
    console.error('[TEST DEBUG] Login failed! Full response:', JSON.stringify(response.body, null, 2));
    throw new Error(`Login failed: ${response.body.error || 'Unknown error'}`);
  }

  // Extract access token from nested response structure
  const accessToken = response.body.data?.tokens?.accessToken || response.body.accessToken;
  if (!accessToken) {
    console.error('[TEST DEBUG] No access token in response:', JSON.stringify(response.body, null, 2));
    throw new Error('Login succeeded but no access token found in response');
  }

  return accessToken;
}

/**
 * Authenticate as admin user
 * @param {Object} app - Express app instance
 * @param {string} email - Admin email (default: admin@vilnius.lt)
 * @param {string} password - Admin password (default: admin123)
 * @returns {Promise<string>} JWT access token
 */
async function authenticateAsAdmin(app, email = 'admin@vilnius.lt', password = 'admin123') {
  return await login(app, email, password);
}

/**
 * Authenticate as agent user
 * Creates a test agent if credentials not provided
 * @param {Object} app - Express app instance
 * @param {Object} prisma - Prisma client instance
 * @param {string} email - Agent email (optional)
 * @param {string} password - Agent password (optional)
 * @returns {Promise<{token: string, userId: string}>} Token and user ID
 */
async function authenticateAsAgent(app, prisma, email = null, password = null) {
  if (!email) {
    // Create test agent
    const bcrypt = require('bcryptjs');
    const userId = uuidv4();
    email = `agent-${Date.now()}@test.com`;
    password = 'Test123!';

    await prisma.users.create({
      data: {
        id: userId,
        email,
        password_hash: await bcrypt.hash(password, 10),
        first_name: 'Test',
        last_name: 'Agent',
        role: 'agent',
        is_active: true,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create required agent_status row for authentication
    await prisma.agent_status.create({
      data: {
        id: `agent_status_${userId}`,
        user_id: userId,
        status: 'offline',
        updated_at: new Date(),
      },
    });

    const token = await login(app, email, password);
    return { token, userId };
  }

  const token = await login(app, email, password);
  const user = await prisma.users.findUnique({ where: { email } });
  return { token, userId: user.id };
}

/**
 * Make authenticated GET request
 * @param {Object} app - Express app instance
 * @param {string} token - JWT access token
 * @param {string} path - API endpoint path
 * @param {Object} query - Query parameters (optional)
 * @returns {Promise<Object>} Response object
 */
async function authenticatedGet(app, token, path, query = {}) {
  console.log('[TEST DEBUG] Making GET request:', { path, hasToken: !!token, tokenLength: token?.length });

  let req = request(app)
    .get(path)
    .set('Authorization', `Bearer ${token}`);

  if (Object.keys(query).length > 0) {
    req = req.query(query);
  }

  const response = await req;

  if (response.status === 401) {
    console.error('[TEST DEBUG] 401 Unauthorized on GET', path, '- Response:', response.body);
  }

  // Log response for debugging
  if (response.status !== 200 || !response.body.success) {
    console.error('[TEST DEBUG] API Error on GET', path, '- Status:', response.status, '- Body:', JSON.stringify(response.body, null, 2));
  }

  return response;
}

/**
 * Make authenticated POST request
 * @param {Object} app - Express app instance
 * @param {string} token - JWT access token
 * @param {string} path - API endpoint path
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Response object
 */
async function authenticatedPost(app, token, path, body) {
  return await request(app)
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/**
 * Make authenticated PUT request
 * @param {Object} app - Express app instance
 * @param {string} token - JWT access token
 * @param {string} path - API endpoint path
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Response object
 */
async function authenticatedPut(app, token, path, body) {
  return await request(app)
    .put(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/**
 * Make authenticated DELETE request
 * @param {Object} app - Express app instance
 * @param {string} token - JWT access token
 * @param {string} path - API endpoint path
 * @returns {Promise<Object>} Response object
 */
async function authenticatedDelete(app, token, path) {
  return await request(app)
    .delete(path)
    .set('Authorization', `Bearer ${token}`);
}

/**
 * Create a test conversation
 * @param {Object} prisma - Prisma client instance
 * @param {string} assignedAgentId - Agent user ID (optional)
 * @param {string} categoryId - Category ID (optional)
 * @returns {Promise<Object>} Created ticket
 */
async function createTestConversation(prisma, assignedAgentId = null, categoryId = null) {
  const ticketId = uuidv4();
  const ticketNumber = `TEST-${Date.now()}`;

  const ticket = await prisma.tickets.create({
    data: {
      id: ticketId,
      ticket_number: ticketNumber,
      subject: 'Test Conversation',
      description: 'Test conversation for integration tests',
      priority: 'medium',
      source: 'widget',
      archived: false,
      assigned_agent_id: assignedAgentId,
      category_id: categoryId,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  return ticket;
}

/**
 * Create a test message
 * @param {Object} prisma - Prisma client instance
 * @param {string} ticketId - Ticket ID
 * @param {string} senderId - Sender user ID (optional for AI messages)
 * @param {string} content - Message content
 * @param {string} senderType - Sender type: 'agent', 'user', or 'ai'
 * @param {Object} options - Additional options (template_id, etc.)
 * @returns {Promise<Object>} Created message
 */
async function createTestMessage(
  prisma,
  ticketId,
  senderId,
  content,
  senderType = 'agent',
  options = {}
) {
  const messageId = uuidv4();

  const message = await prisma.messages.create({
    data: {
      id: messageId,
      ticket_id: ticketId,
      sender_id: senderId,
      senderType,
      content,
      message_type: 'text',
      created_at: new Date(),
    },
  });

  // Create message statistics if options provided
  if (options.template_id || options.ai_suggestion_used) {
    await prisma.message_statistics.create({
      data: {
        id: uuidv4(),
        message_id: messageId,
        agent_id: senderId,
        ticket_id: ticketId,
        ai_suggestion_used: options.ai_suggestion_used || false,
        suggestion_action: options.suggestion_action || null,
        template_used: !!options.template_id,
        template_id: options.template_id || null,
        system_mode: options.system_mode || 'HITL',
        response_time_seconds: options.response_time_seconds || 0,
        created_at: new Date(),
      },
    });
  }

  return message;
}

/**
 * Cleanup WebSocket service to prevent memory leaks
 * Should be called in afterAll() hook
 * @param {Object} websocketService - WebSocket service instance
 */
function cleanupWebSocketService(websocketService) {
  if (websocketService && typeof websocketService.destroy === 'function') {
    websocketService.destroy();
  }
}

module.exports = {
  createTestApp,
  login,
  authenticateAsAdmin,
  authenticateAsAgent,
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
  createTestConversation,
  createTestMessage,
  cleanupWebSocketService,
};
