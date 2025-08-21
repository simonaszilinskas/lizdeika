/**
 * ActivityService Unit Tests
 * Tests for the comprehensive activity logging system
 */

const activityService = require('../../src/services/activityService');
const databaseClient = require('../../src/utils/database');

// Mock the database client
jest.mock('../../src/utils/database');

describe('ActivityService', () => {
  let mockPrisma;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Prisma client
    mockPrisma = {
      user_activities: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      users: {
        findUnique: jest.fn(),
      },
    };
    
    databaseClient.getClient.mockReturnValue(mockPrisma);
  });

  describe('logActivity', () => {
    it('should log activity successfully with all parameters', async () => {
      const mockActivity = {
        ...testUtils.testActivity,
        id: testUtils.generateUuid(),
      };
      
      mockPrisma.user_activities.create.mockResolvedValue(mockActivity);

      const result = await activityService.logActivity({
        userId: testUtils.testUser.id,
        actionType: 'auth',
        action: 'login_success',
        resource: 'user',
        resourceId: testUtils.testUser.id,
        ipAddress: '192.168.1.1',
        userAgent: 'Jest Test Agent',
        details: { role: 'user' },
        success: true,
      });

      expect(mockPrisma.user_activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: testUtils.testUser.id,
          action_type: 'auth',
          action: 'login_success',
          resource: 'user',
          resource_id: testUtils.testUser.id,
          ip_address: '192.168.1.1',
          user_agent: 'Jest Test Agent',
          details: { role: 'user' },
          success: true,
        }),
      });
      expect(result).toEqual(mockActivity);
    });

    it('should log activity with minimal parameters', async () => {
      const mockActivity = {
        id: testUtils.generateUuid(),
        user_id: null,
        action_type: 'system',
        action: 'cleanup',
        success: true,
      };
      
      mockPrisma.user_activities.create.mockResolvedValue(mockActivity);

      const result = await activityService.logActivity({
        actionType: 'system',
        action: 'cleanup',
      });

      expect(mockPrisma.user_activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: null,
          action_type: 'system',
          action: 'cleanup',
          resource: null,
          resource_id: null,
          ip_address: null,
          user_agent: null,
          details: null,
          success: true,
        }),
      });
      expect(result).toEqual(mockActivity);
    });

    it('should return null on database error', async () => {
      mockPrisma.user_activities.create.mockRejectedValue(new Error('Database error'));

      const result = await activityService.logActivity({
        actionType: 'auth',
        action: 'login_failed',
      });

      expect(result).toBeNull();
    });
  });

  describe('logAuth', () => {
    it('should log successful authentication', async () => {
      const mockActivity = { id: testUtils.generateUuid() };
      mockPrisma.user_activities.create.mockResolvedValue(mockActivity);

      await activityService.logAuth(
        testUtils.testUser.id,
        'login_success',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
        { role: 'user' }
      );

      expect(mockPrisma.user_activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: testUtils.testUser.id,
          action_type: 'auth',
          action: 'login_success',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          details: { role: 'user' },
          success: true,
        }),
      });
    });

    it('should log failed authentication with anonymous user', async () => {
      const mockActivity = { id: testUtils.generateUuid() };
      mockPrisma.user_activities.create.mockResolvedValue(mockActivity);

      await activityService.logAuth(
        null,
        'login_failed',
        false,
        '192.168.1.1',
        'Mozilla/5.0',
        { email: 'test@example.com', error: 'Invalid credentials' }
      );

      expect(mockPrisma.user_activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: null,
          action_type: 'auth',
          action: 'login_failed',
          success: false,
          details: { email: 'test@example.com', error: 'Invalid credentials' },
        }),
      });
    });
  });

  describe('logUserManagement', () => {
    it('should log user management action', async () => {
      const mockActivity = { id: testUtils.generateUuid() };
      mockPrisma.user_activities.create.mockResolvedValue(mockActivity);

      await activityService.logUserManagement(
        testUtils.testAdmin.id,
        'user_created',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
        { targetUserId: testUtils.testUser.id, role: 'user' }
      );

      expect(mockPrisma.user_activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: testUtils.testAdmin.id,
          action_type: 'user_management',
          action: 'user_created',
          resource: 'user',
          success: true,
          details: { targetUserId: testUtils.testUser.id, role: 'user' },
        }),
      });
    });
  });

  describe('logConversation', () => {
    it('should log conversation action', async () => {
      const mockActivity = { id: testUtils.generateUuid() };
      mockPrisma.user_activities.create.mockResolvedValue(mockActivity);

      await activityService.logConversation(
        testUtils.testUser.id,
        'conversation_started',
        true,
        '192.168.1.1',
        'conversation-123',
        { visitorId: 'visitor-456' }
      );

      expect(mockPrisma.user_activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: testUtils.testUser.id,
          action_type: 'conversation',
          action: 'conversation_started',
          resource: 'conversation',
          resource_id: 'conversation-123',
          success: true,
          details: { visitorId: 'visitor-456' },
        }),
      });
    });
  });

  describe('logSecurity', () => {
    it('should log security action', async () => {
      const mockActivity = { id: testUtils.generateUuid() };
      mockPrisma.user_activities.create.mockResolvedValue(mockActivity);

      await activityService.logSecurity(
        testUtils.testUser.id,
        'password_changed',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
        { method: 'self_service' }
      );

      expect(mockPrisma.user_activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: testUtils.testUser.id,
          action_type: 'security',
          action: 'password_changed',
          success: true,
          details: { method: 'self_service' },
        }),
      });
    });
  });

  describe('getUserActivities', () => {
    it('should retrieve activities with filters and pagination', async () => {
      const mockActivities = [testUtils.testActivity];
      const mockCount = 1;

      mockPrisma.user_activities.findMany.mockResolvedValue(mockActivities);
      mockPrisma.user_activities.count.mockResolvedValue(mockCount);

      const result = await activityService.getUserActivities({
        userId: testUtils.testUser.id,
        actionType: 'auth',
        success: true,
        page: 1,
        limit: 50,
      });

      expect(mockPrisma.user_activities.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id: testUtils.testUser.id,
            action_type: 'auth',
            success: true,
          },
          take: 50,
          skip: 0,
          orderBy: { created_at: 'desc' },
        })
      );

      expect(result).toEqual({
        activities: mockActivities,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('should handle date range filters', async () => {
      const mockActivities = [];
      const mockCount = 0;
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockPrisma.user_activities.findMany.mockResolvedValue(mockActivities);
      mockPrisma.user_activities.count.mockResolvedValue(mockCount);

      await activityService.getUserActivities({
        startDate,
        endDate,
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.user_activities.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            created_at: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });
  });

  describe('getRecentUserActivities', () => {
    it('should retrieve recent activities for a user', async () => {
      const mockActivities = [testUtils.testActivity];
      mockPrisma.user_activities.findMany.mockResolvedValue(mockActivities);

      const result = await activityService.getRecentUserActivities(testUtils.testUser.id, 10);

      expect(mockPrisma.user_activities.findMany).toHaveBeenCalledWith({
        where: { user_id: testUtils.testUser.id },
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          users: {
            select: {
              email: true,
              first_name: true,
              last_name: true,
              role: true,
            },
          },
        },
      });
      expect(result).toEqual(mockActivities);
    });
  });

  describe('getActivityStats', () => {
    it('should return activity statistics', async () => {
      const mockStats = [
        { action_type: 'auth', success: true, _count: { id: 10 } },
        { action_type: 'auth', success: false, _count: { id: 2 } },
      ];

      mockPrisma.user_activities.count.mockResolvedValue(12);
      mockPrisma.user_activities.findMany.mockResolvedValue(mockStats);

      const result = await activityService.getActivityStats({});

      expect(result).toEqual({
        totalActivities: 12,
        breakdown: mockStats,
      });
    });
  });

  describe('cleanupOldActivities', () => {
    it('should delete old activities', async () => {
      const mockDeleteResult = { count: 150 };
      mockPrisma.user_activities.deleteMany.mockResolvedValue(mockDeleteResult);

      const result = await activityService.cleanupOldActivities(90);

      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 90);

      expect(mockPrisma.user_activities.deleteMany).toHaveBeenCalledWith({
        where: {
          created_at: {
            lt: expect.any(Date),
          },
        },
      });
      expect(result).toBe(150);
    });

    it('should use default retention period', async () => {
      const mockDeleteResult = { count: 50 };
      mockPrisma.user_activities.deleteMany.mockResolvedValue(mockDeleteResult);

      const result = await activityService.cleanupOldActivities();

      expect(result).toBe(50);
    });
  });

  describe('getRequestMetadata', () => {
    it('should extract IP address and user agent from request', () => {
      const mockReq = {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0 Test Browser',
        },
      };

      const result = activityService.constructor.getRequestMetadata(mockReq);

      expect(result).toEqual({
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      });
    });

    it('should handle missing metadata gracefully', () => {
      const mockReq = {
        headers: {},
      };

      const result = activityService.constructor.getRequestMetadata(mockReq);

      expect(result).toEqual({
        ipAddress: undefined,
        userAgent: undefined,
      });
    });

    it('should handle x-forwarded-for header', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '10.0.0.1, 192.168.1.1',
          'user-agent': 'Test Agent',
        },
      };

      const result = activityService.constructor.getRequestMetadata(mockReq);

      expect(result.ipAddress).toBe('10.0.0.1');
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockPrisma.user_activities.create.mockRejectedValue(new Error('Connection failed'));

      const result = await activityService.logActivity({
        actionType: 'auth',
        action: 'login_success',
      });

      expect(result).toBeNull();
    });

    it('should handle invalid enum values gracefully', async () => {
      mockPrisma.user_activities.create.mockRejectedValue(new Error('Invalid enum value'));

      const result = await activityService.logActivity({
        actionType: 'invalid_type',
        action: 'test_action',
      });

      expect(result).toBeNull();
    });
  });
});