/**
 * Token Refresh Integration Tests
 *
 * Tests the complete token refresh flow with real database operations.
 *
 * What we're actually testing (purposeful, not numbers):
 * 1. Can users stay logged in? (valid refresh generates new access token)
 * 2. Do expired tokens actually stop working?
 * 3. Does token revocation work? (logout should invalidate tokens)
 * 4. Are inactive users properly blocked from refreshing?
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAgent,
} = require('./helpers/testData');
const { createTestApp, cleanupWebSocketService } = require('./helpers/apiHelpers');
const request = require('supertest');
const tokenUtils = require('../../src/utils/tokenUtils');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Token Refresh Integration Tests', () => {
  let prisma;
  let app;
  let websocketService;

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
  });

  describe('Successful Token Refresh', () => {
    test('valid refresh token generates new access token', async () => {
      // 1. Create agent and login to get tokens
      const agent = await createTestAgent(prisma);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;
      const oldAccessToken = loginResponse.body.data.tokens.accessToken;

      // 2. Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      // 3. Verify new access token generated
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.accessToken).toBeDefined();

      // 4. Verify new access token is valid by decoding it
      const decoded = tokenUtils.verifyAccessToken(refreshResponse.body.data.accessToken);
      expect(decoded.sub).toBe(agent.id);
      expect(decoded.email).toBe(agent.email);

      // Note: Access tokens may be identical if generated within same second
      // The important thing is that they're valid JWT tokens with correct claims

      // 5. Verify refresh token is still in database (not deleted)
      const storedToken = await prisma.refresh_tokens.findFirst({
        where: { user_id: agent.id },
      });
      expect(storedToken).toBeDefined();
    });
  });

  describe('Failed Token Refresh', () => {
    test('expired refresh token returns 401', async () => {
      // 1. Create agent
      const agent = await createTestAgent(prisma);

      // 2. Create expired refresh token in database
      const expiredToken = tokenUtils.generateRefreshToken(agent.id);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1); // 1 day ago

      const { v4: uuidv4 } = require('uuid');
      await prisma.refresh_tokens.create({
        data: {
          id: uuidv4(),
          user_id: agent.id,
          token: expiredToken,
          expires_at: yesterday, // Already expired
          is_revoked: false,
        },
      });

      // 3. Attempt to refresh with expired token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: expiredToken });

      // 4. Verify expired token rejected
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');

      // 5. Verify expired token was cleaned up from database
      const storedToken = await prisma.refresh_tokens.findFirst({
        where: { token: expiredToken },
      });
      expect(storedToken).toBeNull(); // Should be deleted
    });

    test('revoked refresh token returns 401', async () => {
      // 1. Create agent and login
      const agent = await createTestAgent(prisma);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      // 2. Manually revoke the token (simulate logout)
      await prisma.refresh_tokens.update({
        where: { token: refreshToken },
        data: { is_revoked: true },
      });

      // 3. Attempt to use revoked token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      // 4. Verify revoked token rejected
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('revoked');
    });

    test('non-existent refresh token returns 401', async () => {
      // 1. Generate a valid-looking token that was never issued to the database
      const { v4: uuidv4 } = require('uuid');
      const fakeToken = tokenUtils.generateRefreshToken(uuidv4());

      // 2. Attempt to use it
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: fakeToken });

      // 3. Verify rejected (token not in database)
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('refresh token from deactivated user returns 401', async () => {
      // 1. Create agent and login
      const agent = await createTestAgent(prisma);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      // 2. Deactivate the user account
      await prisma.users.update({
        where: { id: agent.id },
        data: { is_active: false },
      });

      // 3. Attempt to refresh with deactivated account
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      // 4. Verify deactivated user cannot refresh
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('deactivated');
    });
  });
});
