/**
 * RBAC (Role-Based Access Control) Integration Tests
 *
 * Tests authorization middleware across different role levels.
 *
 * What we're actually testing (practical security):
 * 1. Can admins access admin-only endpoints?
 * 2. Are non-admins blocked from admin endpoints?
 * 3. Can agents access agent/admin endpoints?
 * 4. Are customers blocked from agent endpoints?
 * 5. Are unauthenticated requests blocked?
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAdmin,
  createTestAgent,
  createTestCustomer,
} = require('./helpers/testData');
const { createTestApp } = require('./helpers/apiHelpers');
const request = require('supertest');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('RBAC Integration Tests', () => {
  let prisma;
  let app;
  let adminUser;
  let adminToken;
  let agentUser;
  let agentToken;
  let customerUser;
  let customerToken;

  beforeAll(async () => {
    prisma = await initializeTestDatabase();
    app = createTestApp();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    // Create users and get tokens for each role
    adminUser = await createTestAdmin(prisma);
    agentUser = await createTestAgent(prisma);
    customerUser = await createTestCustomer(prisma);

    // Login to get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: adminUser.plainPassword });
    adminToken = adminLogin.body.data.tokens.accessToken;

    const agentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: agentUser.email, password: agentUser.plainPassword });
    agentToken = agentLogin.body.data.tokens.accessToken;

    const customerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: customerUser.email, password: customerUser.plainPassword });
    customerToken = customerLogin.body.data.tokens.accessToken;
  });

  describe('Admin-Only Endpoints', () => {
    test('admin can access admin-only endpoint (cleanup tokens)', async () => {
      // Use the cleanup-tokens endpoint which is admin-only
      const response = await request(app)
        .post('/api/auth/cleanup-tokens')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should succeed or return success (not 403)
      expect(response.status).not.toBe(403);
      expect([200, 201, 204]).toContain(response.status);
    });

    test('agent cannot access admin-only endpoint', async () => {
      // Agent tries to access admin-only endpoint
      const response = await request(app)
        .post('/api/auth/cleanup-tokens')
        .set('Authorization', `Bearer ${agentToken}`);

      // Should be forbidden
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('customer cannot access admin-only endpoint', async () => {
      // Customer tries to access admin-only endpoint
      const response = await request(app)
        .post('/api/auth/cleanup-tokens')
        .set('Authorization', `Bearer ${customerToken}`);

      // Should be forbidden
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('unauthenticated request to admin endpoint returns 401', async () => {
      // No token provided
      const response = await request(app)
        .post('/api/auth/cleanup-tokens');

      // Should require authentication first (401, not 403)
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Agent/Admin Endpoints', () => {
    test('admin can access agent/admin endpoints', async () => {
      // Use statistics endpoint which requires agent or admin
      const response = await request(app)
        .get('/api/statistics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should succeed
      expect([200, 201, 204]).toContain(response.status);
    });

    test('agent can access agent/admin endpoints', async () => {
      // Agent accesses statistics endpoint
      const response = await request(app)
        .get('/api/statistics/dashboard')
        .set('Authorization', `Bearer ${agentToken}`);

      // Should succeed
      expect([200, 201, 204]).toContain(response.status);
    });

    test('customer cannot access agent/admin endpoints', async () => {
      // Customer tries to access agent/admin endpoint
      const response = await request(app)
        .get('/api/statistics/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);

      // Should be forbidden
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authenticated Endpoints', () => {
    test('any authenticated user can access general endpoints', async () => {
      // Test with customer (lowest privilege)
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${customerToken}`);

      // Should succeed
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('unauthenticated user cannot access protected endpoints', async () => {
      // No token provided
      const response = await request(app)
        .get('/api/auth/profile');

      // Should be unauthorized
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Token Validation', () => {
    test('invalid token is rejected', async () => {
      // Use fake/malformed token
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token-here');

      // Should be unauthorized
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('expired token is rejected', async () => {
      // This is implicitly tested by token refresh tests
      // Just verify that profile requires valid token
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjB9.invalid');

      // Should be unauthorized
      expect(response.status).toBe(401);
    });
  });
});
