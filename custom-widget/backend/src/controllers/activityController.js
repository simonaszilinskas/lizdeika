/**
 * ACTIVITY CONTROLLER
 * 
 * Main Purpose: Handle HTTP requests for user activity logging and retrieval
 * 
 * Key Responsibilities:
 * - Provide API endpoints for viewing user activities
 * - Handle activity filtering and pagination
 * - Provide activity statistics and analytics
 * - Admin-only access control for sensitive activity data
 * 
 * Security Features:
 * - Admin-only access to view all activities
 * - Users can only view their own activities
 * - IP address and user agent logging
 * - Input validation and sanitization
 * 
 * Endpoints:
 * - GET /activities - Get activities with filtering (admin only)
 * - GET /activities/me - Get current user's activities
 * - GET /activities/stats - Get activity statistics (admin only)
 * - POST /activities/cleanup - Cleanup old activities (admin only)
 * - GET /activities/:userId - Get specific user's activities (admin only)
 */

const activityService = require('../services/activityService');
const { asyncHandler } = require('../utils/errors');
const { z } = require('zod');

class ActivityController {
    
    /**
     * Get all activities with filtering and pagination (admin only)
     */
    getAllActivities = asyncHandler(async (req, res) => {
        // Validate query parameters
        const querySchema = z.object({
            userId: z.string().optional(),
            actionType: z.enum(['auth', 'user_management', 'conversation', 'system', 'profile', 'security']).optional(),
            success: z.coerce.boolean().optional(),
            startDate: z.string().datetime().optional(),
            endDate: z.string().datetime().optional(),
            page: z.coerce.number().min(1).default(1),
            limit: z.coerce.number().min(1).max(100).default(50)
        });

        const filters = querySchema.parse(req.query);

        // Convert date strings to Date objects
        if (filters.startDate) filters.startDate = new Date(filters.startDate);
        if (filters.endDate) filters.endDate = new Date(filters.endDate);

        const result = await activityService.getUserActivities(filters);
        
        res.json({
            success: true,
            data: result
        });
    });

    /**
     * Get current user's activities
     */
    getMyActivities = asyncHandler(async (req, res) => {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        
        const activities = await activityService.getRecentUserActivities(req.user.id, limit);
        
        res.json({
            success: true,
            data: activities
        });
    });

    /**
     * Get specific user's activities (admin only)
     */
    getUserActivities = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        
        // Validate query parameters
        const querySchema = z.object({
            actionType: z.enum(['auth', 'user_management', 'conversation', 'system', 'profile', 'security']).optional(),
            success: z.coerce.boolean().optional(),
            startDate: z.string().datetime().optional(),
            endDate: z.string().datetime().optional(),
            page: z.coerce.number().min(1).default(1),
            limit: z.coerce.number().min(1).max(100).default(50)
        });

        const filters = querySchema.parse(req.query);
        filters.userId = userId;

        // Convert date strings to Date objects
        if (filters.startDate) filters.startDate = new Date(filters.startDate);
        if (filters.endDate) filters.endDate = new Date(filters.endDate);

        const result = await activityService.getUserActivities(filters);
        
        res.json({
            success: true,
            data: result
        });
    });

    /**
     * Get activity statistics (admin only)
     */
    getActivityStats = asyncHandler(async (req, res) => {
        // Validate query parameters
        const querySchema = z.object({
            userId: z.string().optional(),
            actionType: z.enum(['auth', 'user_management', 'conversation', 'system', 'profile', 'security']).optional(),
            startDate: z.string().datetime().optional(),
            endDate: z.string().datetime().optional()
        });

        const filters = querySchema.parse(req.query);

        // Convert date strings to Date objects
        if (filters.startDate) filters.startDate = new Date(filters.startDate);
        if (filters.endDate) filters.endDate = new Date(filters.endDate);

        const stats = await activityService.getActivityStats(filters);
        
        res.json({
            success: true,
            data: stats
        });
    });

    /**
     * Clean up old activities (admin only)
     */
    cleanupOldActivities = asyncHandler(async (req, res) => {
        const { daysToKeep = 90 } = req.body;
        
        // Validate days parameter
        if (daysToKeep < 1 || daysToKeep > 365) {
            return res.status(400).json({
                success: false,
                error: 'daysToKeep must be between 1 and 365'
            });
        }

        const deletedCount = await activityService.cleanupOldActivities(daysToKeep);
        
        // Log the cleanup activity
        const { ipAddress, userAgent } = activityService.constructor.getRequestMetadata(req);
        await activityService.logSystem(
            req.user.id, 
            `cleanup_activities_${daysToKeep}_days`, 
            true, 
            ipAddress, 
            { deletedCount }
        );
        
        res.json({
            success: true,
            message: `Successfully cleaned up ${deletedCount} old activity records`,
            data: { deletedCount, daysToKeep }
        });
    });

    /**
     * Get activity dashboard data (admin only)
     */
    getActivityDashboard = asyncHandler(async (req, res) => {
        const now = new Date();
        const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
        const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const [
            overallStats,
            last24HStats,
            last7DStats,
            last30DStats,
            recentFailures
        ] = await Promise.all([
            activityService.getActivityStats({}),
            activityService.getActivityStats({ startDate: last24Hours }),
            activityService.getActivityStats({ startDate: last7Days }),
            activityService.getActivityStats({ startDate: last30Days }),
            activityService.getUserActivities({ 
                success: false, 
                limit: 10,
                page: 1
            })
        ]);

        res.json({
            success: true,
            data: {
                overview: overallStats,
                timeRanges: {
                    last24Hours: last24HStats,
                    last7Days: last7DStats,
                    last30Days: last30DStats
                },
                recentFailures: recentFailures.activities
            }
        });
    });
}

module.exports = new ActivityController();