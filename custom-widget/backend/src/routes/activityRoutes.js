/**
 * ACTIVITY ROUTES
 * 
 * Main Purpose: Define HTTP routes for user activity logging and retrieval
 * 
 * Route Structure:
 * - GET /activities - Get all activities (admin only, with filtering)
 * - GET /activities/me - Get current user's activities
 * - GET /activities/stats - Get activity statistics (admin only)
 * - GET /activities/dashboard - Get activity dashboard data (admin only)
 * - POST /activities/cleanup - Cleanup old activities (admin only)
 * - GET /activities/:userId - Get specific user's activities (admin only)
 * 
 * Security:
 * - All routes require authentication
 * - Admin-only routes are protected with requireAdmin middleware
 * - Rate limiting applied to prevent abuse
 * 
 * Notes:
 * - Activity logging happens automatically in other controllers
 * - These routes are for retrieving and managing existing activity data
 * - Pagination is supported for large result sets
 */

const express = require('express');
const activityController = require('../controllers/activityController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for activity endpoints
const activityRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
        error: 'Too many activity requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting to all activity routes
router.use(activityRateLimit);

// All activity routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/activities
 * @desc    Get all activities with filtering and pagination
 * @access  Admin only
 * @query   ?userId=string&actionType=enum&success=boolean&startDate=date&endDate=date&page=number&limit=number
 */
router.get('/', requireAdmin, activityController.getAllActivities);

/**
 * @route   GET /api/activities/me
 * @desc    Get current user's recent activities
 * @access  Authenticated users
 * @query   ?limit=number (max 100, default 20)
 */
router.get('/me', activityController.getMyActivities);

/**
 * @route   GET /api/activities/stats
 * @desc    Get activity statistics
 * @access  Admin only
 * @query   ?userId=string&actionType=enum&startDate=date&endDate=date
 */
router.get('/stats', requireAdmin, activityController.getActivityStats);

/**
 * @route   GET /api/activities/dashboard
 * @desc    Get comprehensive activity dashboard data
 * @access  Admin only
 */
router.get('/dashboard', requireAdmin, activityController.getActivityDashboard);

/**
 * @route   POST /api/activities/cleanup
 * @desc    Clean up old activity records
 * @access  Admin only
 * @body    { daysToKeep: number } (default 90, range 1-365)
 */
router.post('/cleanup', requireAdmin, activityController.cleanupOldActivities);

/**
 * @route   GET /api/activities/:userId
 * @desc    Get specific user's activities
 * @access  Admin only
 * @param   userId - User ID to get activities for
 * @query   ?actionType=enum&success=boolean&startDate=date&endDate=date&page=number&limit=number
 */
router.get('/:userId', requireAdmin, activityController.getUserActivities);

module.exports = router;