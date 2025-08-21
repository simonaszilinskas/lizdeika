/**
 * Unit tests for Conversation Controller Archive Operations
 */
const ConversationController = require('../../src/controllers/conversationController');
const conversationService = require('../../src/services/conversationService');
const activityService = require('../../src/services/activityService');

// Mock services
jest.mock('../../src/services/conversationService');
jest.mock('../../src/services/activityService');

describe('ConversationController - Archive Operations', () => {
    let controller;
    let mockReq;
    let mockRes;
    let mockIo;

    beforeEach(() => {
        mockIo = {
            emit: jest.fn()
        };
        controller = new ConversationController(mockIo);
        
        mockReq = {
            body: {},
            user: { id: 'agent123' },
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('Mozilla/5.0')
        };
        
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.clearAllMocks();
    });

    describe('bulkArchiveConversations', () => {
        it('should successfully archive multiple conversations', async () => {
            const conversationIds = ['conv1', 'conv2', 'conv3'];
            mockReq.body = { conversationIds };
            
            conversationService.bulkArchiveConversations.mockResolvedValue({ count: 3 });
            activityService.logActivity.mockResolvedValue({ id: 'activity1' });

            await controller.bulkArchiveConversations(mockReq, mockRes);

            expect(conversationService.bulkArchiveConversations).toHaveBeenCalledWith(conversationIds);
            expect(activityService.logActivity).toHaveBeenCalledTimes(3);
            expect(activityService.logActivity).toHaveBeenCalledWith({
                userId: 'agent123',
                actionType: 'conversation',
                action: 'archive',
                details: { conversationId: 'conv1' },
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0'
            });
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Archived 3 conversations',
                data: { archivedCount: 3 }
            });
        });

        it('should handle empty conversation list', async () => {
            mockReq.body = { conversationIds: [] };
            
            await controller.bulkArchiveConversations(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'conversationIds must be a non-empty array'
            });
        });

        it('should handle service errors', async () => {
            const conversationIds = ['conv1'];
            mockReq.body = { conversationIds };
            
            conversationService.bulkArchiveConversations.mockRejectedValue(new Error('Database error'));

            await controller.bulkArchiveConversations(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to archive conversations'
            });
        });
    });

    describe('bulkUnarchiveConversations', () => {
        it('should successfully unarchive multiple conversations', async () => {
            const conversationIds = ['conv1', 'conv2'];
            mockReq.body = { conversationIds };
            
            conversationService.bulkUnarchiveConversations.mockResolvedValue({ count: 2 });
            activityService.logActivity.mockResolvedValue({ id: 'activity1' });

            await controller.bulkUnarchiveConversations(mockReq, mockRes);

            expect(conversationService.bulkUnarchiveConversations).toHaveBeenCalledWith(conversationIds);
            expect(activityService.logActivity).toHaveBeenCalledTimes(2);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Unarchived 2 conversations',
                data: { unarchivedCount: 2 }
            });
        });
    });

    describe('bulkAssignConversations', () => {
        it('should successfully assign multiple conversations', async () => {
            const conversationIds = ['conv1', 'conv2'];
            const agentId = 'agent456';
            mockReq.body = { conversationIds, agentId };
            
            conversationService.bulkAssignConversations.mockResolvedValue({ count: 2 });
            activityService.logActivity.mockResolvedValue({ id: 'activity1' });

            await controller.bulkAssignConversations(mockReq, mockRes);

            expect(conversationService.bulkAssignConversations).toHaveBeenCalledWith(conversationIds, agentId);
            expect(activityService.logActivity).toHaveBeenCalledTimes(2);
            expect(activityService.logActivity).toHaveBeenCalledWith({
                userId: 'agent123',
                actionType: 'conversation',
                action: 'assign',
                details: { conversationId: 'conv1', agentId: 'agent456' },
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0'
            });
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Assigned 2 conversations to agent',
                data: { assignedCount: 2 }
            });
        });

        it('should handle missing agentId', async () => {
            mockReq.body = { conversationIds: ['conv1'] };
            
            await controller.bulkAssignConversations(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'agentId is required'
            });
        });
    });
});