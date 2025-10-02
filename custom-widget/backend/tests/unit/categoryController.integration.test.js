/**
 * CATEGORY CONTROLLER INTEGRATION TESTS
 *
 * Tests the real CategoryController with actual database operations
 * Uses in-memory/test database to avoid affecting production data
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const { app } = require('../../server');
const jwt = require('jsonwebtoken');

describe('CategoryController Integration Tests', () => {
    let prisma;
    let agentToken;
    let adminToken;
    let testUserId;
    let adminUserId;

    beforeAll(async () => {
        // Initialize Prisma client for test database
        prisma = new PrismaClient();

        // Ensure test database is clean
        await prisma.ticket_categories.deleteMany({});
        await prisma.users.deleteMany({});

        // Create test users
        testUserId = 'test-agent-123';
        adminUserId = 'test-admin-456';

        await prisma.users.create({
            data: {
                id: testUserId,
                first_name: 'Test',
                last_name: 'Agent',
                email: 'agent@test.com',
                password: 'hashedpassword',
                role: 'agent'
            }
        });

        await prisma.users.create({
            data: {
                id: adminUserId,
                first_name: 'Test',
                last_name: 'Admin',
                email: 'admin@test.com',
                password: 'hashedpassword',
                role: 'admin'
            }
        });

        // Generate JWT tokens for testing
        agentToken = jwt.sign(
            { id: testUserId, email: 'agent@test.com', role: 'agent' },
            process.env.JWT_SECRET || 'test-secret'
        );

        adminToken = jwt.sign(
            { id: adminUserId, email: 'admin@test.com', role: 'admin' },
            process.env.JWT_SECRET || 'test-secret'
        );
    });

    beforeEach(async () => {
        // Clean categories before each test
        await prisma.ticket_categories.deleteMany({});
    });

    afterAll(async () => {
        // Cleanup
        await prisma.ticket_categories.deleteMany({});
        await prisma.users.deleteMany({});
        await prisma.$disconnect();
    });

    describe('GET /api/categories', () => {
        it('should return empty categories list initially', async () => {
            const response = await request(app)
                .get('/api/categories')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.categories).toEqual([]);
            expect(response.body.pagination.total).toBe(0);
        });

        it('should return categories created by user and global categories', async () => {
            // Create test categories
            await prisma.ticket_categories.create({
                data: {
                    id: 'cat1',
                    name: 'Personal Category',
                    description: 'Test personal category',
                    color: '#FF0000',
                    created_by: testUserId
                }
            });

            await prisma.ticket_categories.create({
                data: {
                    id: 'cat2',
                    name: 'Global Category',
                    description: 'Test global category',
                    color: '#00FF00',
                    created_by: adminUserId
                }
            });

            const response = await request(app)
                .get('/api/categories')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.categories).toHaveLength(2);
        });

        it('should handle pagination correctly', async () => {
            // Create test categories
            await prisma.ticket_categories.createMany({
                data: [
                    {
                        id: 'cat1',
                        name: 'Category 1',
                        created_by: testUserId,
                        color: '#FF0000'
                    },
                    {
                        id: 'cat2',
                        name: 'Category 2',
                        created_by: adminUserId,
                        color: '#00FF00'
                    }
                ]
            });

            // Test pagination
            const response = await request(app)
                .get('/api/categories?limit=1')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(response.status).toBe(200);
            expect(response.body.categories).toHaveLength(1);
            expect(response.body.pagination.total).toBe(2);
        });

        it('should search categories by name', async () => {
            await prisma.ticket_categories.createMany({
                data: [
                    {
                        id: 'cat1',
                        name: 'Bug Report',
                            created_by: testUserId,
                        color: '#FF0000'
                    },
                    {
                        id: 'cat2',
                        name: 'Feature Request',
                            created_by: testUserId,
                        color: '#00FF00'
                    }
                ]
            });

            const response = await request(app)
                .get('/api/categories?search=Bug')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(response.status).toBe(200);
            expect(response.body.categories).toHaveLength(1);
            expect(response.body.categories[0].name).toBe('Bug Report');
        });
    });

    describe('POST /api/categories', () => {
        it('should create a personal category for agent', async () => {
            const categoryData = {
                name: 'Test Category',
                description: 'Test description',
                color: '#FF0000',
            };

            const response = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${agentToken}`)
                .send(categoryData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.category.name).toBe(categoryData.name);
            expect(response.body.category.created_by).toBe(testUserId);
        });

        it('should allow agent to create category', async () => {
            const categoryData = {
                name: 'Agent Category',
                description: 'Created by agent',
                color: '#FF0000'
            };

            const response = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${agentToken}`)
                .send(categoryData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.category.name).toBe(categoryData.name);
        });

        it('should allow admin to create category', async () => {
            const categoryData = {
                name: 'Global Category',
                description: 'Admin created',
                color: '#00FF00',
            };

            const response = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(categoryData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('required');
        });

        it('should validate color format', async () => {
            const response = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({
                    name: 'Test Category',
                    color: 'invalid-color'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('hex color');
        });

        it('should prevent duplicate category names', async () => {
            // Create first category
            await prisma.ticket_categories.create({
                data: {
                    id: 'cat1',
                    name: 'Duplicate Name',
                    created_by: testUserId,
                    color: '#FF0000'
                }
            });

            // Try to create another with same name
            const response = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({
                    name: 'Duplicate Name',
                    });

            expect(response.status).toBe(409);
            expect(response.body.error).toContain('already exists');
        });
    });

    describe('PUT /api/categories/:id', () => {
        let categoryId;

        beforeEach(async () => {
            const category = await prisma.ticket_categories.create({
                data: {
                    id: 'test-category',
                    name: 'Original Name',
                    description: 'Original description',
                    color: '#FF0000',
                    created_by: testUserId
                }
            });
            categoryId = category.id;
        });

        it('should allow owner to update their category', async () => {
            const updateData = {
                name: 'Updated Name',
                description: 'Updated description',
                color: '#00FF00'
            };

            const response = await request(app)
                .put(`/api/categories/${categoryId}`)
                .set('Authorization', `Bearer ${agentToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.category.name).toBe(updateData.name);
            expect(response.body.category.description).toBe(updateData.description);
            expect(response.body.category.color).toBe(updateData.color);
        });

        it('should not allow non-owner agent to update category', async () => {
            // Create another user
            const otherUserId = 'other-user';
            await prisma.users.create({
                data: {
                    id: otherUserId,
                    first_name: 'Other',
                    last_name: 'User',
                    email: 'other@test.com',
                    password: 'hashedpassword',
                    role: 'agent'
                }
            });

            const otherToken = jwt.sign(
                { id: otherUserId, email: 'other@test.com', role: 'agent' },
                process.env.JWT_SECRET || 'test-secret'
            );

            const response = await request(app)
                .put(`/api/categories/${categoryId}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .send({ name: 'Hacked Name' });

            expect(response.status).toBe(403);
            expect(response.body.error).toContain('own categories');
        });

        it('should allow admin to update any category', async () => {
            const response = await request(app)
                .put(`/api/categories/${categoryId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Admin Updated' });

            expect(response.status).toBe(200);
            expect(response.body.category.name).toBe('Admin Updated');
        });

        it('should return 404 for non-existent category', async () => {
            const response = await request(app)
                .put('/api/categories/non-existent')
                .set('Authorization', `Bearer ${agentToken}`)
                .send({ name: 'Test' });

            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /api/categories/:id', () => {
        let categoryId;

        beforeEach(async () => {
            const category = await prisma.ticket_categories.create({
                data: {
                    id: 'test-category',
                    name: 'To Delete',
                    created_by: testUserId,
                    color: '#FF0000'
                }
            });
            categoryId = category.id;
        });

        it('should only allow admins to archive categories', async () => {
            const response = await request(app)
                .delete(`/api/categories/${categoryId}`)
                .set('Authorization', `Bearer ${agentToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error).toContain('administrators');
        });

        it('should allow admin to archive category', async () => {
            const response = await request(app)
                .delete(`/api/categories/${categoryId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.tickets_affected).toBe(0);

            // Verify category is archived
            const archivedCategory = await prisma.ticket_categories.findUnique({
                where: { id: categoryId }
            });
            expect(archivedCategory.is_archived).toBe(true);
        });

        it('should return 404 for non-existent category', async () => {
            const response = await request(app)
                .delete('/api/categories/non-existent')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/categories/stats', () => {
        beforeEach(async () => {
            // Create test categories and tickets for stats
            await prisma.ticket_categories.createMany({
                data: [
                    {
                        id: 'cat1',
                        name: 'Bug Report',
                            created_by: testUserId,
                        color: '#FF0000'
                    },
                    {
                        id: 'cat2',
                        name: 'Feature Request',
                            created_by: adminUserId,
                        color: '#00FF00'
                    },
                    {
                        id: 'cat3',
                        name: 'Archived Category',
                            created_by: testUserId,
                        color: '#0000FF',
                        is_archived: true
                    }
                ]
            });
        });

        it('should only allow admins to access stats', async () => {
            const response = await request(app)
                .get('/api/categories/stats')
                .set('Authorization', `Bearer ${agentToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error).toContain('Administrator');
        });

        it('should return category statistics for admin', async () => {
            const response = await request(app)
                .get('/api/categories/stats')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.stats.totals.total_categories).toBe(3);
            expect(response.body.stats.totals.active_categories).toBe(2);
            expect(response.body.stats.totals.archived_categories).toBe(1);
        });
    });

    describe('Authentication', () => {
        it('should require authentication for all endpoints', async () => {
            const endpoints = [
                { method: 'get', path: '/api/categories' },
                { method: 'post', path: '/api/categories' },
                { method: 'put', path: '/api/categories/test' },
                { method: 'delete', path: '/api/categories/test' },
                { method: 'get', path: '/api/categories/stats' }
            ];

            for (const { method, path } of endpoints) {
                const response = await request(app)[method](path);
                expect(response.status).toBe(401);
            }
        });

        it('should reject invalid tokens', async () => {
            const response = await request(app)
                .get('/api/categories')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(401);
        });
    });
});