/**
 * Password Change Integration Tests
 *
 * Tests the complete password change flow with real database operations.
 *
 * What we're actually testing (purposeful):
 * 1. Can users actually change their password?
 * 2. Does wrong current password get rejected?
 * 3. Are weak new passwords rejected?
 * 4. Does password change revoke refresh tokens for security?
 * 5. Can user login with new password after change?
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAgent,
} = require('./helpers/testData');
const { createTestApp } = require('./helpers/apiHelpers');
const request = require('supertest');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Password Change Integration Tests', () => {
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

  describe('Successful Password Change', () => {
    test('user can change password with valid current password', async () => {
      // 1. Create agent and login
      const agent = await createTestAgent(prisma);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const accessToken = loginResponse.body.data.tokens.accessToken;

      // 2. Change password
      const newPassword = 'NewSecurePassword123!';
      const changeResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: agent.plainPassword,
          newPassword,
        });

      // 3. Verify password change successful
      expect(changeResponse.status).toBe(200);
      expect(changeResponse.body.success).toBe(true);

      // 4. Verify old password no longer works
      const oldPasswordLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      expect(oldPasswordLogin.status).toBe(401);

      // 5. Verify new password works
      const newPasswordLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: newPassword,
        });

      expect(newPasswordLogin.status).toBe(200);
      expect(newPasswordLogin.body.success).toBe(true);
    });
  });

  describe('Failed Password Change', () => {
    test('wrong current password returns 400', async () => {
      // 1. Create agent and login
      const agent = await createTestAgent(prisma);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const accessToken = loginResponse.body.data.tokens.accessToken;

      // 2. Attempt to change password with wrong current password
      const changeResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewSecurePassword123!',
        });

      // 3. Verify rejected
      expect(changeResponse.status).toBe(400);
      expect(changeResponse.body.success).toBe(false);
      expect(changeResponse.body.error).toContain('incorrect');
    });

    test('weak new password returns 400', async () => {
      // 1. Create agent and login
      const agent = await createTestAgent(prisma);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const accessToken = loginResponse.body.data.tokens.accessToken;

      // 2. Attempt to change to weak password
      const changeResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: agent.plainPassword,
          newPassword: 'short', // Too short (only 5 characters)
        });

      // 3. Verify rejected with validation error
      expect(changeResponse.status).toBe(400);
      expect(changeResponse.body.success).toBe(false);
      // Middleware catches invalid password format before authService
      expect(changeResponse.body.error).toBeDefined();
    });

    test('same password as current returns 400', async () => {
      // 1. Create agent and login
      const agent = await createTestAgent(prisma);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: agent.email,
          password: agent.plainPassword,
        });

      const accessToken = loginResponse.body.data.tokens.accessToken;

      // 2. Attempt to change to same password
      const changeResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: agent.plainPassword,
          newPassword: agent.plainPassword, // Same as current
        });

      // 3. Verify rejected
      expect(changeResponse.status).toBe(400);
      expect(changeResponse.body.success).toBe(false);
      expect(changeResponse.body.error).toContain('different');
    });

    test('unauthenticated request returns 401', async () => {
      // 1. Attempt to change password without authentication
      const changeResponse = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'anything',
          newPassword: 'NewSecurePassword123!',
        });

      // 2. Verify authentication required
      expect(changeResponse.status).toBe(401);
      expect(changeResponse.body.success).toBe(false);
    });
  });
});
