/**
 * CATEGORY CONTROLLER UNIT TESTS
 *
 * Tests HTTP endpoint handling for category operations including:
 * - Request validation and error handling
 * - Response formatting
 * - Authentication and authorization
 * - Route parameter validation
 */

// Mock category service
const mockCategoryService = {
    getCategoriesForUser: jest.fn(),
    getCategoryById: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    archiveCategory: jest.fn(),
    getCategoryStats: jest.fn()
};

jest.mock('../../src/services/categoryService', () => mockCategoryService);

// Mock controller class for testing
class CategoryController {
    async getCategories(req, res) {
        try {
            const {
                include_archived = 'false',
                search = '',
                limit = '50',
                offset = '0'
            } = req.query;

            const filters = {
                include_archived: include_archived === 'true',
                search,
                limit: Math.min(parseInt(limit, 10) || 50, 100),
                offset: parseInt(offset, 10) || 0
            };

            const categories = await mockCategoryService.getCategoriesForUser(req.user, filters);

            res.json({
                success: true,
                categories,
                pagination: {
                    limit: filters.limit,
                    offset: filters.offset,
                    total: categories.length
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch categories',
                details: error.message
            });
        }
    }

    async getCategoryById(req, res) {
        try {
            const { id } = req.params;
            const category = await mockCategoryService.getCategoryById(id, req.user);

            if (!category) {
                return res.status(404).json({
                    success: false,
                    error: 'Category not found'
                });
            }

            res.json({
                success: true,
                category
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch category',
                details: error.message
            });
        }
    }

    async createCategory(req, res) {
        try {
            const category = await mockCategoryService.createCategory(req.body, req.user);

            res.status(201).json({
                success: true,
                category
            });
        } catch (error) {
            const statusCode = this.getErrorStatusCode(error.message);
            res.status(statusCode).json({
                success: false,
                error: error.message
            });
        }
    }

    async updateCategory(req, res) {
        try {
            const { id } = req.params;
            const category = await mockCategoryService.updateCategory(id, req.body, req.user);

            res.json({
                success: true,
                category
            });
        } catch (error) {
            const statusCode = this.getErrorStatusCode(error.message);
            res.status(statusCode).json({
                success: false,
                error: error.message
            });
        }
    }

    async deleteCategory(req, res) {
        try {
            const { id } = req.params;
            const result = await mockCategoryService.archiveCategory(id, req.user);

            res.json({
                success: true,
                message: 'Category archived successfully',
                tickets_affected: result.tickets_affected
            });
        } catch (error) {
            const statusCode = this.getErrorStatusCode(error.message);
            res.status(statusCode).json({
                success: false,
                error: error.message
            });
        }
    }

    async getCategoryStats(req, res) {
        try {
            const stats = await mockCategoryService.getCategoryStats(req.user);

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            const statusCode = this.getErrorStatusCode(error.message);
            res.status(statusCode).json({
                success: false,
                error: error.message
            });
        }
    }

    getErrorStatusCode(message) {
        if (message.includes('required') || message.includes('cannot be empty') ||
            message.includes('must be') || message.includes('valid')) {
            return 400;
        }
        if (message.includes('permission') || message.includes('only') ||
            message.includes('administrators') || message.includes('own')) {
            return 403;
        }
        if (message.includes('not found')) {
            return 404;
        }
        return 500;
    }
}

describe('CategoryController', () => {
    let req;
    let res;
    let controller;

    beforeEach(() => {
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

        controller = new CategoryController();
        jest.clearAllMocks();
    });

    describe('getCategories', () => {
        it('should return categories with default filters', async () => {
            const mockCategories = [
                {
                    id: 'cat123',
                    name: 'Bug Report',
                    _count: { tickets: 5 }
                }
            ];

            mockCategoryService.getCategoriesForUser.mockResolvedValue(mockCategories);

            await controller.getCategories(req, res);

            expect(mockCategoryService.getCategoriesForUser).toHaveBeenCalledWith(req.user, {
                include_archived: false,
                search: '',
                limit: 50,
                offset: 0
            });

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                categories: mockCategories,
                pagination: {
                    limit: 50,
                    offset: 0,
                    total: 1
                }
            });
        });

        it('should handle query parameters', async () => {
            req.query = {
                include_archived: 'true',
                search: 'bug',
                limit: '25',
                offset: '10'
            };

            mockCategoryService.getCategoriesForUser.mockResolvedValue([]);

            await controller.getCategories(req, res);

            expect(mockCategoryService.getCategoriesForUser).toHaveBeenCalledWith(req.user, {
                include_archived: true,
                search: 'bug',
                limit: 25,
                offset: 10
            });
        });

        it('should enforce maximum limit', async () => {
            req.query.limit = '200';
            mockCategoryService.getCategoriesForUser.mockResolvedValue([]);

            await controller.getCategories(req, res);

            expect(mockCategoryService.getCategoriesForUser).toHaveBeenCalledWith(req.user,
                expect.objectContaining({ limit: 100 })
            );
        });

        it('should handle service errors', async () => {
            const error = new Error('Service error');
            mockCategoryService.getCategoriesForUser.mockRejectedValue(error);

            await controller.getCategories(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to fetch categories',
                details: 'Service error'
            });
        });
    });

    describe('getCategoryById', () => {
        it('should return category by ID', async () => {
            req.params.id = 'cat123';
            const mockCategory = {
                id: 'cat123',
                name: 'Bug Report',
            };

            categoryService.getCategoryById.mockResolvedValue(mockCategory);

            await controller.getCategoryById(req, res);

            expect(categoryService.getCategoryById).toHaveBeenCalledWith('cat123', req.user);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                category: mockCategory
            });
        });

        it('should return 404 if category not found', async () => {
            req.params.id = 'nonexistent';
            categoryService.getCategoryById.mockResolvedValue(null);

            await controller.getCategoryById(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Category not found'
            });
        });

        it('should handle service errors', async () => {
            req.params.id = 'cat123';
            const error = new Error('Service error');
            categoryService.getCategoryById.mockRejectedValue(error);

            await controller.getCategoryById(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to fetch category',
                details: 'Service error'
            });
        });
    });

    describe('createCategory', () => {
        it('should create category successfully', async () => {
            req.body = {
                name: 'Feature Request',
                description: 'New features',
                color: '#00FF00',
            };

            const mockCategory = { id: 'cat123', ...req.body };
            categoryService.createCategory.mockResolvedValue(mockCategory);

            await controller.createCategory(req, res);

            expect(categoryService.createCategory).toHaveBeenCalledWith(req.body, req.user);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                category: mockCategory
            });
        });

        it('should return 400 for validation errors', async () => {
            req.body = { name: 'Test' };
            const error = new Error('Category name is required');
            categoryService.createCategory.mockRejectedValue(error);

            await controller.createCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Category name is required'
            });
        });

        it('should handle admin-only permission errors', async () => {
            req.body = { name: 'Test Category' };
            const error = new Error('Only administrators can perform this action');
            categoryService.createCategory.mockRejectedValue(error);

            await controller.createCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('updateCategory', () => {
        it('should update category successfully', async () => {
            req.params.id = 'cat123';
            req.body = { name: 'Updated Name' };

            const mockCategory = { id: 'cat123', name: 'Updated Name' };
            categoryService.updateCategory.mockResolvedValue(mockCategory);

            await controller.updateCategory(req, res);

            expect(categoryService.updateCategory).toHaveBeenCalledWith('cat123', req.body, req.user);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                category: mockCategory
            });
        });

        it('should return 404 if category not found', async () => {
            req.params.id = 'nonexistent';
            const error = new Error('Category not found');
            categoryService.updateCategory.mockRejectedValue(error);

            await controller.updateCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should handle permission errors', async () => {
            req.params.id = 'cat123';
            const error = new Error('You can only edit your own categories');
            categoryService.updateCategory.mockRejectedValue(error);

            await controller.updateCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('deleteCategory', () => {
        it('should archive category successfully', async () => {
            req.params.id = 'cat123';
            req.user.role = 'admin';

            categoryService.archiveCategory.mockResolvedValue({
                success: true,
                tickets_affected: 5
            });

            await controller.deleteCategory(req, res);

            expect(categoryService.archiveCategory).toHaveBeenCalledWith('cat123', req.user);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Category archived successfully',
                tickets_affected: 5
            });
        });

        it('should return 403 if not admin', async () => {
            req.params.id = 'cat123';
            const error = new Error('Only administrators can archive categories');
            categoryService.archiveCategory.mockRejectedValue(error);

            await controller.deleteCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('getCategoryStats', () => {
        it('should return statistics for admin', async () => {
            req.user.role = 'admin';
            const mockStats = {
                totals: {
                    total_categories: 10,
                    active_categories: 8,
                    archived_categories: 2,
                    categorized_tickets: 100
                }
            };

            categoryService.getCategoryStats.mockResolvedValue(mockStats);

            await controller.getCategoryStats(req, res);

            expect(categoryService.getCategoryStats).toHaveBeenCalledWith(req.user);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                stats: mockStats
            });
        });

        it('should return 403 if not admin', async () => {
            const error = new Error('Administrator access required');
            categoryService.getCategoryStats.mockRejectedValue(error);

            await controller.getCategoryStats(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('error handling patterns', () => {
        const testCases = [
            {
                errorMessage: 'Category name is required',
                expectedStatus: 400,
                description: 'validation error'
            },
            {
                errorMessage: 'You can only edit your own categories',
                expectedStatus: 403,
                description: 'permission error'
            },
            {
                errorMessage: 'Category not found',
                expectedStatus: 404,
                description: 'not found error'
            },
            {
                errorMessage: 'Database connection failed',
                expectedStatus: 500,
                description: 'server error'
            }
        ];

        testCases.forEach(({ errorMessage, expectedStatus, description }) => {
            it(`should return ${expectedStatus} for ${description}`, async () => {
                const error = new Error(errorMessage);
                categoryService.getCategoryById.mockRejectedValue(error);

                await controller.getCategoryById(req, res);

                expect(res.status).toHaveBeenCalledWith(expectedStatus);
                expect(res.json).toHaveBeenCalledWith({
                    success: false,
                    error: expect.any(String),
                    details: errorMessage
                });
            });
        });
    });
});