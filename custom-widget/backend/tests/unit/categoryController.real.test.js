/**
 * CATEGORY CONTROLLER REAL UNIT TESTS
 *
 * Tests the actual CategoryController methods with real implementations
 * Uses mocked Prisma client but tests real controller logic
 */

// Mock database client before requiring anything
jest.mock('../../src/utils/database');

const databaseClient = require('../../src/utils/database');

describe('CategoryController Real Implementation Tests', () => {
    let mockPrisma;
    let req;
    let res;
    let categoryController;

    beforeAll(() => {
        // Create mock Prisma instance
        mockPrisma = {
            ticket_categories: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                count: jest.fn(),
                groupBy: jest.fn()
            },
            tickets: {
                count: jest.fn()
            }
        };

        // Mock databaseClient.getClient() to return mockPrisma
        databaseClient.getClient.mockReturnValue(mockPrisma);

        // Now require the controller after mocking
        categoryController = require('../../src/controllers/categoryController');
    });

    beforeEach(() => {

        // Setup request/response objects
        req = {
            user: {
                id: 'user123',
                role: 'agent',
                first_name: 'John',
                last_name: 'Doe'
            },
            params: {},
            body: {},
            query: {}
        };

        res = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
    });

    describe('getCategories method', () => {
        it('should call Prisma with correct filters for agent', async () => {
            req.query = { limit: '10' };

            // Mock Prisma responses
            mockPrisma.ticket_categories.findMany.mockResolvedValue([]);
            mockPrisma.ticket_categories.count.mockResolvedValue(0);

            try {
                await categoryController.getCategories(req, res);
            } catch (error) {
                // asyncHandler might wrap errors
                console.log('Controller error:', error);
            }

            // Verify Prisma was called with correct parameters
            expect(mockPrisma.ticket_categories.findMany).toHaveBeenCalledWith({
                where: {
                    is_archived: false
                },
                include: {
                    creator: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true
                        }
                    },
                    _count: {
                        select: { tickets: true }
                    }
                },
                orderBy: [
                    { name: 'asc' }
                ],
                skip: 0,
                take: 10
            });

            // Verify response format
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                categories: [],
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 0,
                    has_more: false
                }
            });
        });

        it('should apply search filter when provided', async () => {
            req.query = { search: 'Bug Report' };
            req.user.role = 'admin';

            mockPrisma.ticket_categories.findMany.mockResolvedValue([]);
            mockPrisma.ticket_categories.count.mockResolvedValue(0);

            await categoryController.getCategories(req, res);

            expect(mockPrisma.ticket_categories.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        name: {
                            contains: 'Bug Report',
                            mode: 'insensitive'
                        }
                    })
                })
            );
        });

        it('should handle search filter correctly', async () => {
            req.query = { search: 'Bug Report' };

            mockPrisma.ticket_categories.findMany.mockResolvedValue([]);
            mockPrisma.ticket_categories.count.mockResolvedValue(0);

            await categoryController.getCategories(req, res);

            expect(mockPrisma.ticket_categories.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        name: {
                            contains: 'Bug Report',
                            mode: 'insensitive'
                        }
                    })
                })
            );
        });

        it('should transform category data correctly', async () => {
            const mockCategories = [{
                id: 'cat1',
                name: 'Test Category',
                description: 'Test description',
                color: '#FF0000',
                created_by: 'user123',
                is_archived: false,
                created_at: '2023-01-01T00:00:00.000Z',
                updated_at: '2023-01-01T00:00:00.000Z',
                creator: {
                    id: 'user123',
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com'
                },
                _count: { tickets: 5 }
            }];

            mockPrisma.ticket_categories.findMany.mockResolvedValue(mockCategories);
            mockPrisma.ticket_categories.count.mockResolvedValue(1);

            await categoryController.getCategories(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                categories: [{
                    id: 'cat1',
                    name: 'Test Category',
                    description: 'Test description',
                    color: '#FF0000',
                    created_by: 'user123',
                    creator: mockCategories[0].creator,
                    creator_name: 'John Doe',
                    is_archived: false,
                    _count: { tickets: 5 },
                    ticket_count: 5,
                    created_at: '2023-01-01T00:00:00.000Z',
                    updated_at: '2023-01-01T00:00:00.000Z',
                    can_edit: true,
                    can_delete: true
                }],
                pagination: {
                    page: 1,
                    limit: 50,
                    total: 1,
                    has_more: false
                }
            });
        });
    });

    describe('createCategory method', () => {
        it('should create category successfully', async () => {
            req.body = {
                name: 'Test Category',
                description: 'Test description',
                color: '#FF0000'
            };

            const mockCreatedCategory = {
                id: 'new-cat',
                name: 'Test Category',
                description: 'Test description',
                color: '#FF0000',
                created_by: 'user123',
                is_archived: false,
                created_at: new Date(),
                updated_at: new Date(),
                creator: {
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com'
                },
                _count: { tickets: 0 }
            };

            mockPrisma.ticket_categories.findFirst.mockResolvedValue(null); // No duplicate
            mockPrisma.ticket_categories.create.mockResolvedValue(mockCreatedCategory);

            await categoryController.createCategory(req, res);

            // Verify create was called with correct data
            expect(mockPrisma.ticket_categories.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    name: 'Test Category',
                    description: 'Test description',
                    color: '#FF0000',
                        created_by: 'user123'
                }),
                include: {
                    creator: {
                        select: {
                            first_name: true,
                            last_name: true,
                            email: true
                        }
                    },
                    _count: {
                        select: { tickets: true }
                    }
                }
            });

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                category: expect.objectContaining({
                    name: 'Test Category',
                    description: 'Test description',
                    creator_name: 'John Doe'
                })
            });
        });

        it('should reject empty category name', async () => {
            req.body = { name: '' };

            await categoryController.createCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Category name is required'
            });
        });

        it('should reject invalid color format', async () => {
            req.body = {
                name: 'Test Category',
                color: 'invalid-color'
            };

            await categoryController.createCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Color must be a valid hex color (e.g., #FF0000)'
            });
        });

        it('should allow agents to create categories', async () => {
            req.body = {
                name: 'Agent Category'
            };

            const mockCreatedCategory = {
                id: 'new-cat',
                name: 'Agent Category',
                created_by: 'user123',
                is_archived: false,
                created_at: new Date(),
                updated_at: new Date(),
                creator: {
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com'
                },
                _count: { tickets: 0 }
            };

            mockPrisma.ticket_categories.findFirst.mockResolvedValue(null);
            mockPrisma.ticket_categories.create.mockResolvedValue(mockCreatedCategory);

            await categoryController.createCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('should detect duplicate category names', async () => {
            req.body = {
                name: 'Duplicate Name'
            };

            // Mock finding existing category
            mockPrisma.ticket_categories.findFirst.mockResolvedValue({
                id: 'existing-cat',
                name: 'Duplicate Name'
            });

            await categoryController.createCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                error: 'A category with this name already exists'
            });
        });
    });

    describe('updateCategory method', () => {
        const categoryId = 'test-category';

        beforeEach(() => {
            req.params = { id: categoryId };
        });

        it('should update category successfully', async () => {
            req.body = {
                name: 'Updated Name',
                description: 'Updated description',
                color: '#00FF00'
            };

            const mockExistingCategory = {
                id: categoryId,
                name: 'Original Name',
                description: 'Original description',
                color: '#FF0000',
                created_by: 'user123',
                creator: {
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com'
                },
                _count: { tickets: 2 }
            };

            const mockUpdatedCategory = {
                ...mockExistingCategory,
                ...req.body,
                updated_at: new Date()
            };

            mockPrisma.ticket_categories.findUnique.mockResolvedValue(mockExistingCategory);
            mockPrisma.ticket_categories.findFirst.mockResolvedValue(null); // No duplicate
            mockPrisma.ticket_categories.update.mockResolvedValue(mockUpdatedCategory);

            await categoryController.updateCategory(req, res);

            // Verify update was called with correct data
            expect(mockPrisma.ticket_categories.update).toHaveBeenCalledWith({
                where: { id: categoryId },
                data: expect.objectContaining({
                    name: 'Updated Name',
                    description: 'Updated description',
                    color: '#00FF00',
                    updated_by: 'user123'
                }),
                include: expect.any(Object)
            });

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                category: expect.objectContaining({
                    name: 'Updated Name',
                    description: 'Updated description',
                    color: '#00FF00'
                })
            });
        });

        it('should return 404 for non-existent category', async () => {
            mockPrisma.ticket_categories.findUnique.mockResolvedValue(null);

            await categoryController.updateCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Category not found'
            });
        });

        it('should prevent non-owner from editing category', async () => {
            req.user.id = 'different-user';

            const mockExistingCategory = {
                id: categoryId,
                created_by: 'original-owner',
                creator: { first_name: 'Original', last_name: 'Owner' },
                _count: { tickets: 0 }
            };

            mockPrisma.ticket_categories.findUnique.mockResolvedValue(mockExistingCategory);

            await categoryController.updateCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'You can only edit your own categories'
            });
        });

        it('should allow admin to edit any category', async () => {
            req.user.role = 'admin';
            req.user.id = 'admin-user';
            req.body = { name: 'Admin Updated' };

            const mockExistingCategory = {
                id: categoryId,
                name: 'Original Name',
                created_by: 'different-user',
                creator: { first_name: 'John', last_name: 'Doe' },
                _count: { tickets: 0 }
            };

            const mockUpdatedCategory = {
                ...mockExistingCategory,
                name: 'Admin Updated'
            };

            mockPrisma.ticket_categories.findUnique.mockResolvedValue(mockExistingCategory);
            mockPrisma.ticket_categories.findFirst.mockResolvedValue(null);
            mockPrisma.ticket_categories.update.mockResolvedValue(mockUpdatedCategory);

            await categoryController.updateCategory(req, res);

            expect(mockPrisma.ticket_categories.update).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    category: expect.objectContaining({
                        name: 'Admin Updated'
                    })
                })
            );
        });
    });

    describe('archiveCategory method', () => {
        const categoryId = 'test-category';

        beforeEach(() => {
            req.params = { id: categoryId };
        });

        it('should only allow admin to archive categories', async () => {
            const mockCategory = {
                id: categoryId,
                name: 'Test Category',
                _count: { tickets: 0 }
            };

            mockPrisma.ticket_categories.findUnique.mockResolvedValue(mockCategory);

            await categoryController.archiveCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Only administrators can archive categories'
            });
        });

        it('should archive category successfully as admin', async () => {
            req.user.role = 'admin';

            const mockCategory = {
                id: categoryId,
                name: 'Test Category',
                _count: { tickets: 3 }
            };

            mockPrisma.ticket_categories.findUnique.mockResolvedValue(mockCategory);
            mockPrisma.ticket_categories.update.mockResolvedValue({});

            await categoryController.archiveCategory(req, res);

            expect(mockPrisma.ticket_categories.update).toHaveBeenCalledWith({
                where: { id: categoryId },
                data: {
                    is_archived: true,
                    updated_by: req.user.id,
                    updated_at: expect.any(Date)
                }
            });

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                tickets_affected: 3
            });
        });
    });

    describe('getCategoryStats method', () => {
        it('should only allow admin to access stats', async () => {
            await categoryController.getCategoryStats(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Administrator access required'
            });
        });

        it('should return statistics for admin', async () => {
            req.user.role = 'admin';

            // Mock Promise.all responses
            mockPrisma.ticket_categories.count
                .mockResolvedValueOnce(10) // total
                .mockResolvedValueOnce(8)  // active
                .mockResolvedValueOnce(2); // archived
            mockPrisma.tickets.count.mockResolvedValue(50); // categorized tickets

            mockPrisma.ticket_categories.findMany.mockResolvedValue([
                {
                    id: 'cat1',
                    name: 'Bug Report',
                        creator: { first_name: 'John', last_name: 'Doe' },
                    _count: { tickets: 25 }
                }
            ]);

            mockPrisma.ticket_categories.groupBy.mockResolvedValue([]);

            await categoryController.getCategoryStats(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                stats: {
                    totals: {
                        total_categories: 10,
                        active_categories: 8,
                        archived_categories: 2,
                        categorized_tickets: 50
                    },
                    top_categories: [{
                        id: 'cat1',
                        name: 'Bug Report',
                        creator_name: 'John Doe',
                        ticket_count: 25
                    }]
                }
            });
        });
    });

    describe('Input validation', () => {
        it('should validate category name length', async () => {
            req.body = {
                name: 'x'.repeat(101) // 101 characters
            };

            await categoryController.createCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Category name must be 100 characters or less'
            });
        });

        it('should accept valid hex colors', async () => {
            const validColors = ['#FF0000', '#00ff00', '#0000FF', '#AbCdEf'];

            for (const color of validColors) {
                req.body = {
                    name: 'Test Category',
                    color
                };

                mockPrisma.ticket_categories.findFirst.mockResolvedValue(null);
                mockPrisma.ticket_categories.create.mockResolvedValue({
                    id: 'test',
                    name: 'Test Category',
                    color,
                        created_by: 'user123',
                    creator: { first_name: 'John', last_name: 'Doe' },
                    _count: { tickets: 0 },
                    created_at: new Date(),
                    updated_at: new Date(),
                    is_archived: false
                });

                await categoryController.createCategory(req, res);

                expect(res.status).toHaveBeenCalledWith(201);
                jest.clearAllMocks();
            }
        });

        it('should reject invalid hex colors', async () => {
            const invalidColors = ['#GG0000', 'FF0000', '#12345', '#1234567', 'red'];

            for (const color of invalidColors) {
                req.body = {
                    name: 'Test Category',
                    color
                };

                await categoryController.createCategory(req, res);

                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith({
                    error: 'Color must be a valid hex color (e.g., #FF0000)'
                });
                jest.clearAllMocks();
            }
        });
    });
});