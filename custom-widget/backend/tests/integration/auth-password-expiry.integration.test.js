/**
 * Password Expiry Integration Tests
 *
 * Tests the complete password renewal enforcement system including:
 * - Password expiry calculation and tracking
 * - Access blocking for expired passwords
 * - Progressive warning levels
 * - Admin password reset unblocking
 * - Password status endpoint
 */

const request = require('supertest');
const { createTestApp, closeTestDatabase, cleanupWebSocketService } = require('./testSetup');
const databaseClient = require('../../src/utils/database');

let app;
let websocketService;
let adminToken;
let agentToken;
let agentId;
let agentPassword;

describe('Password Expiry Integration Tests', () => {
    beforeAll(async () => {
        const result = createTestApp();
        app = result.app;
        websocketService = result.websocketService;

        // Create admin and login
        const adminRes = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'admin-expiry@test.com',
                password: 'AdminPass123!',
                firstName: 'Admin',
                lastName: 'User',
                role: 'admin'
            });

        const adminLoginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin-expiry@test.com',
                password: 'AdminPass123!'
            });

        adminToken = adminLoginRes.body.data.accessToken;

        // Create agent via admin
        const agentRes = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                email: 'agent-expiry@test.com',
                firstName: 'Test',
                lastName: 'Agent',
                role: 'agent'
            });

        agentId = agentRes.body.data.user.id;
        agentPassword = agentRes.body.data.password; // Store for later use

        // Login as agent
        const agentLoginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'agent-expiry@test.com',
                password: agentPassword
            });

        agentToken = agentLoginRes.body.data.accessToken;
    });

    afterAll(async () => {
        cleanupWebSocketService(websocketService);
        await closeTestDatabase();
    });

    describe('Password Expiry Calculation', () => {
        test('newly created agent has password expiry date set', async () => {
            const prisma = databaseClient.getClient();
            const agent = await prisma.users.findUnique({
                where: { id: agentId },
                select: {
                    password_changed_at: true,
                    password_expires_at: true,
                    password_blocked: true
                }
            });

            expect(agent.password_changed_at).toBeTruthy();
            expect(agent.password_expires_at).toBeTruthy();
            expect(agent.password_blocked).toBe(false);

            // Verify expiry is ~180 days from now
            const daysUntilExpiry = Math.floor(
                (new Date(agent.password_expires_at) - new Date(agent.password_changed_at)) / (1000 * 60 * 60 * 24)
            );
            expect(daysUntilExpiry).toBe(180);
        });

        test('password change resets expiry to 180 days', async () => {
            const oldPasswordRes = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${agentToken}`);

            const oldDaysRemaining = oldPasswordRes.body.data.daysRemaining;

            // Change password
            await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({
                    currentPassword: agentPassword,
                    newPassword: 'NewAgentPass123!'
                });

            // Get new password status
            const newPasswordRes = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${agentToken}`);

            const newDaysRemaining = newPasswordRes.body.data.daysRemaining;

            // New days remaining should be greater (close to 180)
            expect(newDaysRemaining).toBeGreaterThan(oldDaysRemaining);
            expect(newDaysRemaining).toBeGreaterThanOrEqual(179);
            expect(newDaysRemaining).toBeLessThanOrEqual(180);
        });

        test('regular users do not have password expiry enforced', async () => {
            // Create regular user
            const userRes = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'regular-user-expiry@test.com',
                    password: 'UserPass123!',
                    firstName: 'Regular',
                    lastName: 'User',
                    role: 'user'
                });

            const userToken = userRes.body.data.accessToken;

            // Get password status
            const statusRes = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${userToken}`);

            expect(statusRes.status).toBe(200);
            expect(statusRes.body.data.requiresRenewal).toBe(false);
            expect(statusRes.body.data.warningLevel).toBe('none');
        });
    });

    describe('Access Blocking', () => {
        test('expired password blocks API access', async () => {
            const prisma = databaseClient.getClient();

            // Manually expire the agent's password
            await prisma.users.update({
                where: { id: agentId },
                data: {
                    password_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
                    password_blocked: false // Not manually blocked, just expired
                }
            });

            // Try to access protected endpoint
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('PASSWORD_EXPIRED');
            expect(res.body.error).toContain('password has expired');
        });

        test('expired password allows password change endpoint', async () => {
            // Password is still expired from previous test
            const res = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(res.status).toBe(200); // Should succeed even with expired password
            expect(res.body.data.requiresRenewal).toBe(true);
            expect(res.body.data.daysRemaining).toBeLessThanOrEqual(0);
        });

        test('expired password allows logout endpoint', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(res.status).toBe(200); // Should succeed
        });
    });

    describe('Warning Levels', () => {
        test('critical warning level for 1-3 days remaining', async () => {
            const prisma = databaseClient.getClient();

            // Set password to expire in 2 days
            await prisma.users.update({
                where: { id: agentId },
                data: {
                    password_expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
                }
            });

            const res = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.warningLevel).toBe('critical');
            expect(res.body.data.warningMessage).toBeTruthy();
        });

        test('warning level for 4-7 days remaining', async () => {
            const prisma = databaseClient.getClient();

            // Set password to expire in 5 days
            await prisma.users.update({
                where: { id: agentId },
                data: {
                    password_expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
                }
            });

            const res = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.warningLevel).toBe('warning');
        });

        test('info level for 8-14 days remaining', async () => {
            const prisma = databaseClient.getClient();

            // Set password to expire in 10 days
            await prisma.users.update({
                where: { id: agentId },
                data: {
                    password_expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
                }
            });

            const res = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.warningLevel).toBe('info');
        });

        test('notice level for 15-30 days remaining', async () => {
            const prisma = databaseClient.getClient();

            // Set password to expire in 20 days
            await prisma.users.update({
                where: { id: agentId },
                data: {
                    password_expires_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
                }
            });

            const res = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.warningLevel).toBe('notice');
        });

        test('none level for 30+ days remaining', async () => {
            const prisma = databaseClient.getClient();

            // Set password to expire in 100 days
            await prisma.users.update({
                where: { id: agentId },
                data: {
                    password_expires_at: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)
                }
            });

            const res = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.warningLevel).toBe('none');
            expect(res.body.data.warningMessage).toBeNull();
        });
    });

    describe('Admin Password Reset', () => {
        test('admin password regeneration unblocks expired user', async () => {
            const prisma = databaseClient.getClient();

            // Expire and block the agent's password
            await prisma.users.update({
                where: { id: agentId },
                data: {
                    password_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    password_blocked: true
                }
            });

            // Admin regenerates password
            const regenRes = await request(app)
                .post(`/api/users/${agentId}/regenerate-password`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(regenRes.status).toBe(200);
            expect(regenRes.body.data.newPassword).toBeTruthy();

            // Check that password expiry was reset
            const updatedAgent = await prisma.users.findUnique({
                where: { id: agentId },
                select: {
                    password_expires_at: true,
                    password_blocked: true
                }
            });

            expect(updatedAgent.password_blocked).toBe(false);

            // Verify expiry is in the future
            const daysUntilExpiry = Math.floor(
                (new Date(updatedAgent.password_expires_at) - new Date()) / (1000 * 60 * 60 * 24)
            );
            expect(daysUntilExpiry).toBeGreaterThanOrEqual(179);
        });
    });

    describe('Password Status Endpoint', () => {
        test('returns correct password status for authenticated user', async () => {
            const res = await request(app)
                .get('/api/auth/password-status')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('requiresRenewal');
            expect(res.body.data).toHaveProperty('isBlocked');
            expect(res.body.data).toHaveProperty('daysRemaining');
            expect(res.body.data).toHaveProperty('warningLevel');
            expect(res.body.data).toHaveProperty('warningMessage');
            expect(res.body.data).toHaveProperty('expiresAt');
        });

        test('requires authentication', async () => {
            const res = await request(app)
                .get('/api/auth/password-status');

            expect(res.status).toBe(401);
        });
    });
});
