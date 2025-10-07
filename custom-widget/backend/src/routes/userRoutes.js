/**
 * User Management Routes
 * Admin-only endpoints for managing user accounts
 */

const express = require('express');
const userController = require('../controllers/userController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Self-service 2FA routes (any authenticated user for their own account)
router.post('/:id/totp/initiate', userController.initiateTOTP);
router.post('/:id/totp/verify', userController.verifyTOTP);

// Admin-only routes
router.use(requireAdmin);

/**
 * @route GET /api/users
 * @desc Get all users
 * @access Admin only
 */
router.get('/', userController.getAllUsers);

/**
 * @route POST /api/users
 * @desc Create a new user
 * @access Admin only
 * @body { email, firstName, lastName, role }
 */
router.post('/', userController.createUser);

/**
 * @route GET /api/users/stats
 * @desc Get user statistics
 * @access Admin only
 */
router.get('/stats', userController.getUserStats);

/**
 * @route GET /api/users/:id
 * @desc Get specific user by ID
 * @access Admin only
 */
router.get('/:id', userController.getUserById);

/**
 * @route PUT /api/users/:id
 * @desc Update user profile
 * @access Admin only
 * @body { email, firstName, lastName, role, isActive }
 */
router.put('/:id', userController.updateUser);

/**
 * @route POST /api/users/:id/regenerate-password
 * @desc Generate new password for user
 * @access Admin only
 * @returns New password (one-time display)
 */
router.post('/:id/regenerate-password', userController.regeneratePassword);

/**
 * @route POST /api/users/:id/deactivate
 * @desc Deactivate user account
 * @access Admin only
 */
router.post('/:id/deactivate', userController.deactivateUser);

/**
 * @route POST /api/users/:id/reactivate
 * @desc Reactivate user account
 * @access Admin only
 */
router.post('/:id/reactivate', userController.reactivateUser);

/**
 * @route DELETE /api/users/:id
 * @desc Delete user account permanently
 * @access Admin only
 */
router.delete('/:id', userController.deleteUser);

/**
 * @route POST /api/users/:id/totp/backup-codes
 * @desc Regenerate backup codes for a user
 * @access Admin only
 */
router.post('/:id/totp/backup-codes', userController.regenerateBackupCodes);

module.exports = router;