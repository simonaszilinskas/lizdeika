/**
 * USER ACTIVITY LOGGING SERVICE
 * 
 * Main Purpose: Track and log all user activities for audit and security purposes
 * 
 * Key Responsibilities:
 * - Log authentication activities (login, logout, password changes)
 * - Track user management operations (create, update, delete users)
 * - Monitor conversation and ticket activities
 * - Record system and profile changes
 * - Provide activity retrieval and filtering capabilities
 * 
 * Security Features:
 * - IP address and user agent tracking
 * - Failed attempt logging
 * - Automatic cleanup of old activities
 * - Privacy-conscious logging (no sensitive data)
 * 
 * Activity Types:
 * - auth: Login, logout, password changes, registration
 * - user_management: User CRUD operations
 * - conversation: Message sending, ticket assignment
 * - system: Settings changes, mode switches
 * - profile: Profile updates, preference changes
 * - security: Security-related activities
 */

const databaseClient = require('../utils/database');
const { v4: uuidv4 } = require('uuid');

let prisma;

class ActivityService {
    
    /**
     * Log a user activity
     * @param {Object} activityData - Activity data to log
     * @param {string} activityData.userId - User ID (null for anonymous activities)
     * @param {string} activityData.actionType - Type from UserActivityType enum
     * @param {string} activityData.action - Specific action description
     * @param {string} activityData.resource - Resource being acted upon (optional)
     * @param {string} activityData.resourceId - ID of the resource (optional)
     * @param {string} activityData.ipAddress - User's IP address (optional)
     * @param {string} activityData.userAgent - User's browser/client info (optional)
     * @param {Object} activityData.details - Additional details (optional)
     * @param {boolean} activityData.success - Whether the activity was successful (default: true)
     * @returns {Promise<Object>} The created activity log entry
     */
    async logActivity({
        userId = null,
        actionType,
        action,
        resource = null,
        resourceId = null,
        ipAddress = null,
        userAgent = null,
        details = null,
        success = true
    }) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const activity = await prisma.user_activities.create({
                data: {
                    id: uuidv4(),
                    user_id: userId,
                    action_type: actionType,
                    action: action,
                    resource: resource,
                    resource_id: resourceId,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    details: details,
                    success: success,
                    created_at: new Date()
                },
                include: {
                    users: {
                        select: {
                            email: true,
                            first_name: true,
                            last_name: true,
                            role: true
                        }
                    }
                }
            });

            console.log(`[ACTIVITY] ${actionType}:${action} by ${userId || 'anonymous'} - ${success ? 'SUCCESS' : 'FAILED'}`);
            
            return activity;
        } catch (error) {
            console.error('Failed to log activity:', error);
            // Don't throw - activity logging should never break the main flow
            return null;
        }
    }

    /**
     * Log authentication activities
     */
    async logAuth(userId, action, success = true, ipAddress = null, userAgent = null, details = null) {
        if (!prisma) prisma = databaseClient.getClient();
        return this.logActivity({
            userId,
            actionType: 'auth',
            action,
            ipAddress,
            userAgent,
            details,
            success
        });
    }

    /**
     * Log user management activities
     */
    async logUserManagement(adminUserId, action, targetUserId = null, success = true, ipAddress = null, details = null) {
        if (!prisma) prisma = databaseClient.getClient();
        return this.logActivity({
            userId: adminUserId,
            actionType: 'user_management',
            action,
            resource: 'user',
            resourceId: targetUserId,
            ipAddress,
            details,
            success
        });
    }

    /**
     * Log conversation activities
     */
    async logConversation(userId, action, conversationId = null, success = true, details = null) {
        if (!prisma) prisma = databaseClient.getClient();
        return this.logActivity({
            userId,
            actionType: 'conversation',
            action,
            resource: 'conversation',
            resourceId: conversationId,
            details,
            success
        });
    }

    /**
     * Log system activities
     */
    async logSystem(userId, action, success = true, ipAddress = null, details = null) {
        if (!prisma) prisma = databaseClient.getClient();
        return this.logActivity({
            userId,
            actionType: 'system',
            action,
            ipAddress,
            details,
            success
        });
    }

    /**
     * Log profile activities
     */
    async logProfile(userId, action, success = true, ipAddress = null, details = null) {
        if (!prisma) prisma = databaseClient.getClient();
        return this.logActivity({
            userId,
            actionType: 'profile',
            action,
            ipAddress,
            details,
            success
        });
    }

    /**
     * Log security activities
     */
    async logSecurity(userId, action, success = true, ipAddress = null, userAgent = null, details = null) {
        if (!prisma) prisma = databaseClient.getClient();
        return this.logActivity({
            userId,
            actionType: 'security',
            action,
            ipAddress,
            userAgent,
            details,
            success
        });
    }

    /**
     * Get user activities with pagination and filtering
     * @param {Object} filters - Filter options
     * @param {string} filters.userId - Filter by specific user
     * @param {string} filters.actionType - Filter by action type
     * @param {boolean} filters.success - Filter by success status
     * @param {Date} filters.startDate - Filter activities after this date
     * @param {Date} filters.endDate - Filter activities before this date
     * @param {number} filters.page - Page number (default: 1)
     * @param {number} filters.limit - Number of records per page (default: 50)
     * @returns {Promise<Object>} Paginated activities with metadata
     */
    async getUserActivities(filters = {}) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const {
                userId = null,
                actionType = null,
                success = null,
                startDate = null,
                endDate = null,
                page = 1,
                limit = 50
            } = filters;

            const offset = (page - 1) * limit;

            // Build where clause
            const where = {};
            if (userId) where.user_id = userId;
            if (actionType) where.action_type = actionType;
            if (success !== null) where.success = success;
            if (startDate || endDate) {
                where.created_at = {};
                if (startDate) where.created_at.gte = startDate;
                if (endDate) where.created_at.lte = endDate;
            }

            // Get total count for pagination
            const totalCount = await prisma.user_activities.count({ where });

            // Get activities
            const activities = await prisma.user_activities.findMany({
                where,
                include: {
                    users: {
                        select: {
                            email: true,
                            first_name: true,
                            last_name: true,
                            role: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
                skip: offset,
                take: limit
            });

            const totalPages = Math.ceil(totalCount / limit);

            return {
                activities: activities.map(this.formatActivity),
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };
        } catch (error) {
            console.error('Failed to get user activities:', error);
            throw error;
        }
    }

    /**
     * Get recent activities for a specific user
     * @param {string} userId - User ID
     * @param {number} limit - Number of activities to return (default: 20)
     * @returns {Promise<Array>} Recent activities
     */
    async getRecentUserActivities(userId, limit = 20) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const activities = await prisma.user_activities.findMany({
                where: { user_id: userId },
                include: {
                    users: {
                        select: {
                            email: true,
                            first_name: true,
                            last_name: true,
                            role: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
                take: limit
            });

            return activities.map(this.formatActivity);
        } catch (error) {
            console.error('Failed to get recent user activities:', error);
            throw error;
        }
    }

    /**
     * Get activity statistics
     * @param {Object} filters - Filter options (same as getUserActivities)
     * @returns {Promise<Object>} Activity statistics
     */
    async getActivityStats(filters = {}) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const {
                userId = null,
                actionType = null,
                startDate = null,
                endDate = null
            } = filters;

            const where = {};
            if (userId) where.user_id = userId;
            if (actionType) where.action_type = actionType;
            if (startDate || endDate) {
                where.created_at = {};
                if (startDate) where.created_at.gte = startDate;
                if (endDate) where.created_at.lte = endDate;
            }

            const [
                totalActivities,
                successfulActivities,
                failedActivities,
                activityTypeStats,
                recentActivities
            ] = await Promise.all([
                prisma.user_activities.count({ where }),
                prisma.user_activities.count({ where: { ...where, success: true } }),
                prisma.user_activities.count({ where: { ...where, success: false } }),
                prisma.user_activities.groupBy({
                    by: ['action_type'],
                    where,
                    _count: { _all: true }
                }),
                prisma.user_activities.count({
                    where: {
                        ...where,
                        created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                    }
                })
            ]);

            return {
                totalActivities,
                successfulActivities,
                failedActivities,
                successRate: totalActivities > 0 ? (successfulActivities / totalActivities * 100).toFixed(2) : 0,
                activityTypeBreakdown: activityTypeStats.reduce((acc, stat) => {
                    acc[stat.action_type] = stat._count._all;
                    return acc;
                }, {}),
                recentActivities24h: recentActivities
            };
        } catch (error) {
            console.error('Failed to get activity stats:', error);
            throw error;
        }
    }

    /**
     * Clean up old activities (older than specified days)
     * @param {number} daysToKeep - Number of days to keep (default: 90)
     * @returns {Promise<number>} Number of deleted records
     */
    async cleanupOldActivities(daysToKeep = 90) {
        if (!prisma) prisma = databaseClient.getClient();
        try {
            const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
            
            const result = await prisma.user_activities.deleteMany({
                where: {
                    created_at: { lt: cutoffDate }
                }
            });

            console.log(`Cleaned up ${result.count} old activity records (older than ${daysToKeep} days)`);
            return result.count;
        } catch (error) {
            console.error('Failed to cleanup old activities:', error);
            throw error;
        }
    }

    /**
     * Format activity for consistent output
     * @param {Object} activity - Raw activity from database
     * @returns {Object} Formatted activity
     */
    formatActivity(activity) {
        return {
            id: activity.id,
            userId: activity.user_id,
            user: activity.users ? {
                email: activity.users.email,
                name: `${activity.users.first_name} ${activity.users.last_name}`,
                role: activity.users.role
            } : null,
            actionType: activity.action_type,
            action: activity.action,
            resource: activity.resource,
            resourceId: activity.resource_id,
            ipAddress: activity.ip_address,
            userAgent: activity.user_agent,
            details: activity.details,
            success: activity.success,
            createdAt: activity.created_at
        };
    }

    /**
     * Extract request metadata for activity logging
     * @param {Object} req - Express request object
     * @returns {Object} Request metadata
     */
    static getRequestMetadata(req) {
        return {
            ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
            userAgent: req.headers['user-agent'] || null
        };
    }
}

module.exports = new ActivityService();