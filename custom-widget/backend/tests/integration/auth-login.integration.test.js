/**
 * Login Authentication Integration Tests
 *
 * Tests the complete login flow with real database operations.
 *
 * What we're actually testing (not just for numbers):
 * 1. Can users actually log in with correct credentials?
 * 2. Does the system prevent wrong password attempts?
 * 3. Does it handle non-existent users securely (no enumeration)?
 * 4. Does it respect inactive/deactivated accounts?
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAgent,
  createTestCustomer,
} = require('./helpers/testData');
const { createTestApp } = require('./helpers/apiHelpers');
const request = require('supertest');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Login Integration Tests', () => {
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

  describe('Successful Login', () => {
    test('agent can login with correct credentials and receives tokens', async () => {
      // 1. Create a test agent
      const agent = await createTestAgent(prisma);

      // 2. Attempt login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      // 3. Verify response structure
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();

      // 4. Verify user data returned
      expect(response.body.data.user.email).toBe(agent.email);
      expect(response.body.data.user.role).toBe('agent');
      expect(response.body.data.user.password_hash).toBeUndefined(); // Security: no password hash

      // 5. Verify tokens exist
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();

      // 6. Verify refresh token stored in database
      const storedToken = await prisma.refresh_tokens.findFirst({
        where: { user_id: agent.id },
      });
      expect(storedToken).toBeDefined();
      expect(storedToken.token).toBe(response.body.data.tokens.refreshToken);

      // 7. Verify last_login timestamp updated
      const updatedUser = await prisma.users.findUnique({
        where: { id: agent.id },
      });
      expect(updatedUser.last_login).toBeDefined();

      // 8. Verify login was logged in system_logs
      const loginLog = await prisma.system_logs.findFirst({
        where: {
          action: 'user_login',
        },
      });
      expect(loginLog).toBeDefined();
      expect(loginLog.details).toMatchObject({
        user_id: agent.id,
        email: agent.email,
        role: 'agent',
      });
    });

    test('customer can login with correct credentials', async () => {
      // Create customer user
      const customer = await createTestCustomer(prisma);

      // Attempt login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: customer.email,
          password: customer.plainPassword,
        });

      // Verify successful login
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('user');
    });
  });

  describe('Failed Login Attempts', () => {
    test('wrong password returns 401 with generic error message', async () => {
      // 1. Create agent with known password
      const agent = await createTestAgent(prisma);

      // 2. Attempt login with wrong password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: 'WrongPassword123!',
        });

      // 3. Verify error response
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');

      // 4. Verify no tokens returned
      expect(response.body.data).toBeUndefined();

      // 5. Verify no refresh token stored
      const storedToken = await prisma.refresh_tokens.findFirst({
        where: { user_id: agent.id },
      });
      expect(storedToken).toBeNull();
    });

    test('non-existent user returns 401 with same error message (no enumeration)', async () => {
      // 1. Attempt login with non-existent email
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doesnotexist@test.com',
          password: 'SomePassword123!',
        });

      // 2. Verify same error as wrong password (security: no user enumeration)
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    test('inactive user account returns 403 forbidden', async () => {
      // 1. Create inactive user
      const inactiveUser = await createTestAgent(prisma, {
        is_active: false,
      });

      // 2. Attempt login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: inactiveUser.email,
          password: inactiveUser.plainPassword,
        });

      // 3. Verify account deactivated error
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('deactivated');

      // 4. Verify no tokens generated
      const storedToken = await prisma.refresh_tokens.findFirst({
        where: { user_id: inactiveUser.id },
      });
      expect(storedToken).toBeNull();
    });
  });
});
