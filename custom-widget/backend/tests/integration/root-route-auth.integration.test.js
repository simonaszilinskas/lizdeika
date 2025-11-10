/**
 * Root Route Authentication Integration Tests
 *
 * Tests the /api/auth/verify and /api/auth/refresh endpoints used by index.html
 * to determine where to redirect authenticated vs unauthenticated users.
 *
 * What we're testing:
 * 1. Token verification with valid access tokens
 * 2. Token refresh when access token is expired
 * 3. Rejection of invalid/malformed tokens
 * 4. Proper error responses with no information leakage
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAgent,
  createTestAdmin,
} = require('./helpers/testData');
const { createTestApp, cleanupWebSocketService } = require('./helpers/apiHelpers');
const request = require('supertest');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: __dirname + '/../../.env.test' });

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined. Check your .env.test file.');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is not defined. Check your .env.test file.');
}

describe('Root Route Authentication Integration Tests', () => {
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

  describe('Token Verification Endpoint (/api/auth/verify)', () => {
    test('accepts valid token and returns 200', async () => {
      // 1. Create test agent and login
      const agent = await createTestAgent(prisma);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const accessToken = loginResponse.body.data?.tokens?.accessToken || loginResponse.body.accessToken;
      expect(accessToken).toBeDefined();

      // 2. Verify token
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${accessToken}`);

      // 3. Assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('rejects missing authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('rejects invalid token format', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'InvalidToken');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('rejects malformed Bearer token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer notavalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('rejects expired access token', async () => {
      // 1. Create expired token
      const agent = await createTestAgent(prisma);
      const expiredToken = jwt.sign(
        { id: agent.id, email: agent.email, role: agent.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      // 2. Attempt verification with expired token
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${expiredToken}`);

      // 3. Assertions
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('rejects token with invalid signature', async () => {
      // 1. Create token signed with wrong key
      const agent = await createTestAgent(prisma);
      const invalidToken = jwt.sign(
        { id: agent.id, email: agent.email, role: agent.role },
        'wrong-secret-key',
        { expiresIn: '1h' }
      );

      // 2. Attempt verification
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${invalidToken}`);

      // 3. Assertions
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('rejects token for deactivated user', async () => {
      // 1. Create and login agent
      const agent = await createTestAgent(prisma);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const accessToken = loginResponse.body.data?.tokens?.accessToken || loginResponse.body.accessToken;
      expect(accessToken).toBeDefined();

      // 2. Deactivate user
      await prisma.users.update({
        where: { id: agent.id },
        data: { is_active: false },
      });

      // 3. Attempt verification with deactivated user
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${accessToken}`);

      // 4. Assertions
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('accepts token from admin user', async () => {
      // 1. Create admin and login
      const admin = await createTestAdmin(prisma);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: admin.email,
          password: admin.plainPassword,
        });

      const accessToken = loginResponse.body.data?.tokens?.accessToken || loginResponse.body.accessToken;
      expect(accessToken).toBeDefined();

      // 2. Verify token
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${accessToken}`);

      // 3. Assertions
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Token Refresh Endpoint (/api/auth/refresh)', () => {
    test('refreshes expired access token with valid refresh token', async () => {
      // 1. Create agent and login
      const agent = await createTestAgent(prisma);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const refreshToken = loginResponse.body.data?.tokens?.refreshToken || loginResponse.body.refreshToken;
      expect(refreshToken).toBeDefined();

      // 2. Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      // 3. Assertions
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.tokens.accessToken).toBeDefined();
      expect(refreshResponse.body.data.tokens.refreshToken).toBeDefined();
    });

    test('rejects invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('rejects expired refresh token', async () => {
      // 1. Create expired refresh token
      const agent = await createTestAgent(prisma);
      const expiredRefreshToken = jwt.sign(
        { id: agent.id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '-1h' }
      );

      // 2. Attempt refresh
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: expiredRefreshToken });

      // 3. Assertions
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('rejects refresh token for deactivated user', async () => {
      // 1. Create and login agent
      const agent = await createTestAgent(prisma);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const refreshToken = loginResponse.body.data?.tokens?.refreshToken || loginResponse.body.refreshToken;
      expect(refreshToken).toBeDefined();

      // 2. Deactivate user
      await prisma.users.update({
        where: { id: agent.id },
        data: { is_active: false },
      });

      // 3. Attempt refresh with deactivated user
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      // 4. Assertions
      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body.success).toBe(false);
    });

    test('new access token is valid for verification', async () => {
      // 1. Create and login agent
      const agent = await createTestAgent(prisma);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const refreshToken = loginResponse.body.data?.tokens?.refreshToken || loginResponse.body.refreshToken;
      expect(refreshToken).toBeDefined();

      // 2. Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      const newAccessToken = refreshResponse.body.data?.tokens?.accessToken || refreshResponse.body.accessToken;
      expect(newAccessToken).toBeDefined();

      // 3. Verify new access token
      const verifyResponse = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${newAccessToken}`);

      // 4. Assertions
      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
    });
  });

  describe('Redirect Flow Simulation', () => {
    test('unauthenticated user would redirect to login', async () => {
      // Unauthenticated = no token, so /api/auth/verify returns 401
      const response = await request(app)
        .get('/api/auth/verify');

      expect(response.status).toBe(401);
      // Client would redirect to login.html
    });

    test('authenticated user with valid token would redirect to dashboard', async () => {
      // 1. Create and login
      const agent = await createTestAgent(prisma);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const accessToken = loginResponse.body.data?.tokens?.accessToken || loginResponse.body.accessToken;
      expect(accessToken).toBeDefined();

      // 2. Verify
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      // Client would redirect to agent-dashboard.html
    });

    test('user with expired token but valid refresh would refresh then redirect', async () => {
      // 1. Create and login
      const agent = await createTestAgent(prisma);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const refreshToken = loginResponse.body.data?.tokens?.refreshToken || loginResponse.body.refreshToken;
      expect(refreshToken).toBeDefined();

      // 2. Simulate expired access token (401 response)
      const expiredToken = jwt.sign(
        { id: agent.id, email: agent.email, role: agent.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const verifyResponse = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(verifyResponse.status).toBe(401);

      // 3. Client would attempt refresh
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      // Client would redirect to agent-dashboard.html with new token
    });
  });
});
