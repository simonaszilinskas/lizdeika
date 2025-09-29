/**
 * CONVERSATION CONTROLLER CATEGORY UNIT TESTS
 *
 * Tests category-related functionality in conversation controller including:
 * - Category assignment to conversations/tickets
 * - Bulk category assignment operations
 * - WebSocket event handling for category changes
 * - Permission validation for category operations
 */

const ConversationController = require('../../src/controllers/conversationController');
const conversationService = require('../../src/services/conversationService');
const categoryService = require('../../src/services/categoryService');

// Mock services
jest.mock('../../src/services/conversationService', () => ({
    getConversationByTicketId: jest.fn(),
    updateConversationCategory: jest.fn()
}));

jest.mock('../../src/services/categoryService', () => ({
    canUseCategory: jest.fn(),
    getCategoryById: jest.fn()
}));

describe('ConversationController - Category Operations', () => {
    let req;
    let res;
    let mockIo;
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
            body: {}
        };

        res = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        };

        mockIo = {
            emit: jest.fn(),
            to: jest.fn().mockReturnThis()
        };

        controller = new ConversationController(mockIo);
        jest.clearAllMocks();
    });

    describe('assignCategory', () => {
        it('should assign category to conversation successfully', async () => {
            req.params.conversationId = 'conv123';
            req.body.categoryId = 'cat123';

            const mockConversation = {
                id: 'conv123',
                ticket_id: 'ticket123',
                category_id: null
            };

            const mockCategory = {
                id: 'cat123',
                name: 'Bug Report',
                color: '#FF0000'
            };

            const mockUpdatedConversation = {
                ...mockConversation,
                category_id: 'cat123',
                categoryData: mockCategory
            };

            conversationService.getConversationByTicketId.mockResolvedValue(mockConversation);
            categoryService.canUseCategory.mockResolvedValue(true);
            categoryService.getCategoryById.mockResolvedValue(mockCategory);
            conversationService.updateConversationCategory.mockResolvedValue(mockUpdatedConversation);

            await controller.assignCategory(req, res);

            expect(categoryService.canUseCategory).toHaveBeenCalledWith('cat123', req.user);
            expect(conversationService.updateConversationCategory).toHaveBeenCalledWith(
                'conv123',
                'cat123',
                req.user
            );

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                conversation: mockUpdatedConversation,
                message: 'Category assigned successfully'
            });

            expect(mockIo.emit).toHaveBeenCalledWith('conversationCategoryUpdated', {
                conversationId: 'conv123',
                category_id: 'cat123',
                categoryData: mockCategory,
                assignedBy: req.user
            });
        });

        it('should remove category assignment when categoryId is null', async () => {
            req.params.conversationId = 'conv123';
            req.body.categoryId = null;

            const mockConversation = {
                id: 'conv123',
                category_id: 'old_cat123'
            };

            const mockUpdatedConversation = {
                ...mockConversation,
                category_id: null,
                categoryData: null
            };

            conversationService.getConversationByTicketId.mockResolvedValue(mockConversation);
            conversationService.updateConversationCategory.mockResolvedValue(mockUpdatedConversation);

            await controller.assignCategory(req, res);

            expect(conversationService.updateConversationCategory).toHaveBeenCalledWith(
                'conv123',
                null,
                req.user
            );

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                conversation: mockUpdatedConversation,
                message: 'Category removed successfully'
            });

            expect(mockIo.emit).toHaveBeenCalledWith('conversationCategoryUpdated', {
                conversationId: 'conv123',
                category_id: null,
                categoryData: null,
                assignedBy: req.user
            });
        });

        it('should return 404 if conversation not found', async () => {
            req.params.conversationId = 'nonexistent';
            req.body.categoryId = 'cat123';

            conversationService.getConversationByTicketId.mockResolvedValue(null);

            await controller.assignCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Conversation not found'
            });
        });

        it('should return 403 if user cannot use category', async () => {
            req.params.conversationId = 'conv123';
            req.body.categoryId = 'cat123';

            conversationService.getConversationByTicketId.mockResolvedValue({ id: 'conv123' });
            categoryService.canUseCategory.mockResolvedValue(false);

            await controller.assignCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'You do not have permission to use this category'
            });
        });

        it('should handle service errors gracefully', async () => {
            req.params.conversationId = 'conv123';
            req.body.categoryId = 'cat123';

            const error = new Error('Database connection failed');
            conversationService.getConversationByTicketId.mockRejectedValue(error);

            await controller.assignCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to assign category',
                details: 'Database connection failed'
            });
        });
    });

    describe('bulkAssignCategory', () => {
        it('should assign category to multiple conversations', async () => {
            req.body = {
                conversationIds: ['conv1', 'conv2', 'conv3'],
                categoryId: 'cat123'
            };

            const mockCategory = {
                id: 'cat123',
                name: 'Bug Report',
                color: '#FF0000'
            };

            const mockConversations = [
                { id: 'conv1', ticket_id: 'ticket1' },
                { id: 'conv2', ticket_id: 'ticket2' },
                { id: 'conv3', ticket_id: 'ticket3' }
            ];

            categoryService.canUseCategory.mockResolvedValue(true);
            categoryService.getCategoryById.mockResolvedValue(mockCategory);

            conversationService.getConversationByTicketId
                .mockResolvedValueOnce(mockConversations[0])
                .mockResolvedValueOnce(mockConversations[1])
                .mockResolvedValueOnce(mockConversations[2]);

            const mockUpdatedConversations = mockConversations.map(conv => ({
                ...conv,
                category_id: 'cat123',
                categoryData: mockCategory
            }));

            conversationService.updateConversationCategory
                .mockResolvedValueOnce(mockUpdatedConversations[0])
                .mockResolvedValueOnce(mockUpdatedConversations[1])
                .mockResolvedValueOnce(mockUpdatedConversations[2]);

            await controller.bulkAssignCategory(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                updated: 3,
                failed: 0,
                results: mockUpdatedConversations,
                message: 'Category assigned to 3 conversations'
            });

            expect(mockIo.emit).toHaveBeenCalledTimes(3);
            expect(mockIo.emit).toHaveBeenCalledWith('conversationCategoryUpdated', {
                conversationId: 'conv1',
                category_id: 'cat123',
                categoryData: mockCategory,
                assignedBy: req.user
            });
        });

        it('should handle partial failures gracefully', async () => {
            req.body = {
                conversationIds: ['conv1', 'conv2'],
                categoryId: 'cat123'
            };

            const mockCategory = { id: 'cat123', name: 'Bug Report' };

            categoryService.canUseCategory.mockResolvedValue(true);
            categoryService.getCategoryById.mockResolvedValue(mockCategory);

            conversationService.getConversationByTicketId
                .mockResolvedValueOnce({ id: 'conv1' })
                .mockResolvedValueOnce(null); // Second conversation not found

            const mockUpdatedConv = {
                id: 'conv1',
                category_id: 'cat123',
                categoryData: mockCategory
            };

            conversationService.updateConversationCategory
                .mockResolvedValueOnce(mockUpdatedConv);

            await controller.bulkAssignCategory(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                updated: 1,
                failed: 1,
                results: [mockUpdatedConv],
                errors: ['Conversation conv2 not found'],
                message: 'Category assigned to 1 of 2 conversations'
            });
        });

        it('should validate conversationIds array', async () => {
            req.body = {
                conversationIds: [],
                categoryId: 'cat123'
            };

            await controller.bulkAssignCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'No conversation IDs provided'
            });
        });

        it('should enforce maximum bulk operation limit', async () => {
            req.body = {
                conversationIds: new Array(101).fill().map((_, i) => `conv${i}`),
                categoryId: 'cat123'
            };

            await controller.bulkAssignCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Maximum 100 conversations can be processed at once'
            });
        });

        it('should return 403 if user cannot use category', async () => {
            req.body = {
                conversationIds: ['conv1'],
                categoryId: 'cat123'
            };

            categoryService.canUseCategory.mockResolvedValue(false);

            await controller.bulkAssignCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'You do not have permission to use this category'
            });
        });

        it('should handle bulk category removal (null categoryId)', async () => {
            req.body = {
                conversationIds: ['conv1', 'conv2'],
                categoryId: null
            };

            const mockConversations = [
                { id: 'conv1', category_id: 'old_cat' },
                { id: 'conv2', category_id: 'old_cat' }
            ];

            conversationService.getConversationByTicketId
                .mockResolvedValueOnce(mockConversations[0])
                .mockResolvedValueOnce(mockConversations[1]);

            const mockUpdatedConversations = mockConversations.map(conv => ({
                ...conv,
                category_id: null,
                categoryData: null
            }));

            conversationService.updateConversationCategory
                .mockResolvedValueOnce(mockUpdatedConversations[0])
                .mockResolvedValueOnce(mockUpdatedConversations[1]);

            await controller.bulkAssignCategory(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                updated: 2,
                failed: 0,
                results: mockUpdatedConversations,
                message: 'Category removed from 2 conversations'
            });

            expect(mockIo.emit).toHaveBeenCalledWith('conversationCategoryUpdated', {
                conversationId: 'conv1',
                category_id: null,
                categoryData: null,
                assignedBy: req.user
            });
        });
    });

    describe('WebSocket event handling', () => {
        it('should emit proper event structure for category assignment', async () => {
            req.params.conversationId = 'conv123';
            req.body.categoryId = 'cat123';

            const mockCategory = {
                id: 'cat123',
                name: 'Bug Report',
                color: '#FF0000'
            };

            conversationService.getConversationByTicketId.mockResolvedValue({ id: 'conv123' });
            categoryService.canUseCategory.mockResolvedValue(true);
            categoryService.getCategoryById.mockResolvedValue(mockCategory);
            conversationService.updateConversationCategory.mockResolvedValue({
                id: 'conv123',
                category_id: 'cat123',
                categoryData: mockCategory
            });

            await controller.assignCategory(req, res);

            expect(mockIo.emit).toHaveBeenCalledWith('conversationCategoryUpdated', {
                conversationId: 'conv123',
                category_id: 'cat123',
                categoryData: {
                    id: 'cat123',
                    name: 'Bug Report',
                    color: '#FF0000'
                },
                assignedBy: {
                    id: 'user123',
                    role: 'agent',
                    first_name: 'John',
                    last_name: 'Doe'
                }
            });
        });

        it('should emit proper event for category removal', async () => {
            req.params.conversationId = 'conv123';
            req.body.categoryId = null;

            conversationService.getConversationByTicketId.mockResolvedValue({ id: 'conv123' });
            conversationService.updateConversationCategory.mockResolvedValue({
                id: 'conv123',
                category_id: null,
                categoryData: null
            });

            await controller.assignCategory(req, res);

            expect(mockIo.emit).toHaveBeenCalledWith('conversationCategoryUpdated', {
                conversationId: 'conv123',
                category_id: null,
                categoryData: null,
                assignedBy: req.user
            });
        });
    });
});