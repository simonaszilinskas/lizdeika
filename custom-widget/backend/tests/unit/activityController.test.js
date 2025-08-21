/**
 * ActivityController Unit Tests
 * Tests for activity logging API endpoints
 */

const activityController = require('../../src/controllers/activityController');
const activityService = require('../../src/services/activityService');

// Mock dependencies
jest.mock('../../src/services/activityService');

describe('ActivityController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = testUtils.mockRequest();
    mockRes = testUtils.mockResponse();
    mockNext = jest.fn();

    // Mock ActivityService getRequestMetadata
    activityService.constructor.getRequestMetadata = jest.fn().mockReturnValue({
      ipAddress: '192.168.1.1',
      userAgent: 'Jest Test Agent',
    });
  });

  describe('getAllActivities', () => {
    it('should get all activities with filters successfully', async () => {
      const mockActivities = [testUtils.testActivity];
      const mockResult = {
        activities: mockActivities,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockReq.query = {
        userId: testUtils.testUser.id,
        actionType: 'auth',
        success: 'true',
        page: '1',
        limit: '50',
      };
      mockReq.user = testUtils.testAdmin; // Admin user for authorization

      activityService.getUserActivities.mockResolvedValue(mockResult);

      await activityController.getAllActivities(mockReq, mockRes);

      expect(activityService.getUserActivities).toHaveBeenCalledWith({
        userId: testUtils.testUser.id,
        actionType: 'auth',
        success: true,
        page: 1,
        limit: 50,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should handle date range filters', async () => {
      const mockResult = {
        activities: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockReq.query = {
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };
      mockReq.user = testUtils.testAdmin;

      activityService.getUserActivities.mockResolvedValue(mockResult);

      await activityController.getAllActivities(mockReq, mockRes);

      expect(activityService.getUserActivities).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: new Date('2025-01-01T00:00:00Z'),
          endDate: new Date('2025-01-31T23:59:59Z'),
        })
      );
    });

    it('should use default pagination values', async () => {
      const mockResult = {
        activities: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockReq.query = {};
      mockReq.user = testUtils.testAdmin;

      activityService.getUserActivities.mockResolvedValue(mockResult);

      await activityController.getAllActivities(mockReq, mockRes);

      expect(activityService.getUserActivities).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
      });
    });

    it('should validate query parameters', async () => {
      mockReq.query = {
        actionType: 'invalid_type', // Invalid enum value
      };
      mockReq.user = testUtils.testAdmin;

      // This should throw a validation error from Zod
      await expect(activityController.getAllActivities(mockReq, mockRes))
        .rejects.toThrow();
    });
  });

  describe('getMyActivities', () => {
    it('should get current user activities successfully', async () => {
      const mockActivities = [testUtils.testActivity];
      
      mockReq.query = { limit: '10' };
      mockReq.user = testUtils.testUser;

      activityService.getRecentUserActivities.mockResolvedValue(mockActivities);

      await activityController.getMyActivities(mockReq, mockRes);

      expect(activityService.getRecentUserActivities).toHaveBeenCalledWith(
        testUtils.testUser.id,
        10
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockActivities,
      });
    });

    it('should use default limit when not specified', async () => {
      const mockActivities = [];
      
      mockReq.query = {};
      mockReq.user = testUtils.testUser;

      activityService.getRecentUserActivities.mockResolvedValue(mockActivities);

      await activityController.getMyActivities(mockReq, mockRes);

      expect(activityService.getRecentUserActivities).toHaveBeenCalledWith(
        testUtils.testUser.id,
        20
      );
    });

    it('should enforce maximum limit of 100', async () => {
      const mockActivities = [];
      
      mockReq.query = { limit: '200' }; // Exceeds maximum
      mockReq.user = testUtils.testUser;

      activityService.getRecentUserActivities.mockResolvedValue(mockActivities);

      await activityController.getMyActivities(mockReq, mockRes);

      expect(activityService.getRecentUserActivities).toHaveBeenCalledWith(
        testUtils.testUser.id,
        100 // Should be capped at 100
      );
    });
  });

  describe('getUserActivities', () => {
    it('should get specific user activities successfully', async () => {
      const targetUserId = 'target-user-id';
      const mockResult = {
        activities: [testUtils.testActivity],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockReq.params = { userId: targetUserId };
      mockReq.query = {
        actionType: 'auth',
        success: 'true',
      };
      mockReq.user = testUtils.testAdmin; // Admin user for authorization

      activityService.getUserActivities.mockResolvedValue(mockResult);

      await activityController.getUserActivities(mockReq, mockRes);

      expect(activityService.getUserActivities).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: targetUserId,
          actionType: 'auth',
          success: true,
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });
  });

  describe('getActivityStats', () => {
    it('should get activity statistics successfully', async () => {
      const mockStats = {
        totalActivities: 100,
        breakdown: [
          { action_type: 'auth', success: true, _count: { id: 80 } },
          { action_type: 'auth', success: false, _count: { id: 20 } },
        ],
      };

      mockReq.query = {
        userId: testUtils.testUser.id,
        actionType: 'auth',
      };
      mockReq.user = testUtils.testAdmin;

      activityService.getActivityStats.mockResolvedValue(mockStats);

      await activityController.getActivityStats(mockReq, mockRes);

      expect(activityService.getActivityStats).toHaveBeenCalledWith({
        userId: testUtils.testUser.id,
        actionType: 'auth',
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });

    it('should handle date range filters in stats', async () => {
      const mockStats = { totalActivities: 0, breakdown: [] };

      mockReq.query = {
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      };
      mockReq.user = testUtils.testAdmin;

      activityService.getActivityStats.mockResolvedValue(mockStats);

      await activityController.getActivityStats(mockReq, mockRes);

      expect(activityService.getActivityStats).toHaveBeenCalledWith({
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2025-01-31T23:59:59Z'),
      });
    });
  });

  describe('cleanupOldActivities', () => {
    it('should cleanup old activities successfully', async () => {
      const deletedCount = 150;
      const daysToKeep = 30;

      mockReq.body = { daysToKeep };
      mockReq.user = testUtils.testAdmin;

      activityService.cleanupOldActivities.mockResolvedValue(deletedCount);
      activityService.logSystem.mockResolvedValue({});

      await activityController.cleanupOldActivities(mockReq, mockRes);

      expect(activityService.cleanupOldActivities).toHaveBeenCalledWith(daysToKeep);
      expect(activityService.logSystem).toHaveBeenCalledWith(
        testUtils.testAdmin.id,
        'cleanup_activities_30_days',
        true,
        '192.168.1.1',
        { deletedCount }
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Successfully cleaned up 150 old activity records',
        data: { deletedCount, daysToKeep },
      });
    });

    it('should use default retention period', async () => {
      const deletedCount = 50;

      mockReq.body = {}; // No daysToKeep specified
      mockReq.user = testUtils.testAdmin;

      activityService.cleanupOldActivities.mockResolvedValue(deletedCount);
      activityService.logSystem.mockResolvedValue({});

      await activityController.cleanupOldActivities(mockReq, mockRes);

      expect(activityService.cleanupOldActivities).toHaveBeenCalledWith(90); // Default
      expect(activityService.logSystem).toHaveBeenCalledWith(
        testUtils.testAdmin.id,
        'cleanup_activities_90_days',
        true,
        '192.168.1.1',
        { deletedCount }
      );
    });

    it('should validate days to keep range', async () => {
      mockReq.body = { daysToKeep: 500 }; // Exceeds maximum of 365
      mockReq.user = testUtils.testAdmin;

      await activityController.cleanupOldActivities(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'daysToKeep must be between 1 and 365',
      });
      expect(activityService.cleanupOldActivities).not.toHaveBeenCalled();
    });

    it('should validate minimum days to keep', async () => {
      mockReq.body = { daysToKeep: 0 }; // Below minimum of 1
      mockReq.user = testUtils.testAdmin;

      await activityController.cleanupOldActivities(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'daysToKeep must be between 1 and 365',
      });
    });
  });

  describe('getActivityDashboard', () => {
    it('should get activity dashboard data successfully', async () => {
      const mockOverallStats = { totalActivities: 1000, breakdown: [] };
      const mockLast24HStats = { totalActivities: 50, breakdown: [] };
      const mockLast7DStats = { totalActivities: 200, breakdown: [] };
      const mockLast30DStats = { totalActivities: 500, breakdown: [] };
      const mockRecentFailures = { activities: [] };

      mockReq.user = testUtils.testAdmin;

      // Mock all the parallel calls
      activityService.getActivityStats
        .mockResolvedValueOnce(mockOverallStats)
        .mockResolvedValueOnce(mockLast24HStats)
        .mockResolvedValueOnce(mockLast7DStats)
        .mockResolvedValueOnce(mockLast30DStats);

      activityService.getUserActivities.mockResolvedValue(mockRecentFailures);

      await activityController.getActivityDashboard(mockReq, mockRes);

      expect(activityService.getActivityStats).toHaveBeenCalledTimes(4);
      expect(activityService.getUserActivities).toHaveBeenCalledWith({
        success: false,
        limit: 10,
        page: 1,
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          overview: mockOverallStats,
          timeRanges: {
            last24Hours: mockLast24HStats,
            last7Days: mockLast7DStats,
            last30Days: mockLast30DStats,
          },
          recentFailures: [],
        },
      });
    });

    it('should handle errors in parallel data fetching', async () => {
      mockReq.user = testUtils.testAdmin;

      // Mock one of the calls to fail
      activityService.getActivityStats
        .mockResolvedValueOnce({ totalActivities: 1000, breakdown: [] })
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(activityController.getActivityDashboard(mockReq, mockRes))
        .rejects.toThrow('Database error');
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockReq.query = {};
      mockReq.user = testUtils.testAdmin;

      const error = new Error('Database connection failed');
      activityService.getUserActivities.mockRejectedValue(error);

      await expect(activityController.getAllActivities(mockReq, mockRes))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle validation errors for invalid enum values', async () => {
      mockReq.query = {
        actionType: 'invalid_action_type',
      };
      mockReq.user = testUtils.testAdmin;

      await expect(activityController.getAllActivities(mockReq, mockRes))
        .rejects.toThrow(); // Zod validation error
    });

    it('should handle invalid date formats', async () => {
      mockReq.query = {
        startDate: 'invalid-date',
      };
      mockReq.user = testUtils.testAdmin;

      await expect(activityController.getAllActivities(mockReq, mockRes))
        .rejects.toThrow(); // Zod validation error
    });
  });

  describe('pagination handling', () => {
    it('should enforce minimum page number', async () => {
      mockReq.query = { page: '0' }; // Invalid page number
      mockReq.user = testUtils.testAdmin;

      await expect(activityController.getAllActivities(mockReq, mockRes))
        .rejects.toThrow(); // Zod validation error for minimum page
    });

    it('should enforce maximum limit', async () => {
      mockReq.query = { limit: '200' }; // Exceeds maximum of 100
      mockReq.user = testUtils.testAdmin;

      await expect(activityController.getAllActivities(mockReq, mockRes))
        .rejects.toThrow(); // Zod validation error for maximum limit
    });

    it('should enforce minimum limit', async () => {
      mockReq.query = { limit: '0' }; // Below minimum of 1
      mockReq.user = testUtils.testAdmin;

      await expect(activityController.getAllActivities(mockReq, mockRes))
        .rejects.toThrow(); // Zod validation error for minimum limit
    });
  });
});