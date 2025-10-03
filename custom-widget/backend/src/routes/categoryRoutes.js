/**
 * Category Management Routes
 * Endpoints for managing ticket categories with role-based access control
 */

const express = require('express');
const categoryController = require('../controllers/categoryController');
const { authenticateToken, requireAgentOrAdmin, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication and agent/admin role
router.use(authenticateToken);
router.use(requireAgentOrAdmin);

/**
 * @route GET /api/categories
 * @desc Get all categories with filtering and pagination
 * @access Agent/Admin
 * @query {boolean} include_archived - Include archived categories
 * @query {number} page - Page number for pagination
 * @query {number} limit - Results per page (max 100)
 * @query {string} search - Search by category name
 */
router.get('/', categoryController.getCategories);

/**
 * @route GET /api/categories/stats
 * @desc Get category usage statistics
 * @access Admin only
 */
router.get('/stats', requireAdmin, categoryController.getCategoryStats);

/**
 * @route POST /api/categories
 * @desc Create a new category
 * @access Admin only
 * @body {string} name - Category name (required, max 100 chars)
 * @body {string} description - Category description (optional)
 * @body {string} color - Hex color code (optional, default: #6B7280)
 */
router.post('/', requireAdmin, categoryController.createCategory);

/**
 * @route PUT /api/categories/:id
 * @desc Update category
 * @access Admin only
 * @param {string} id - Category ID
 * @body {string} name - Category name (optional)
 * @body {string} description - Category description (optional)
 * @body {string} color - Hex color code (optional)
 */
router.put('/:id', requireAdmin, categoryController.updateCategory);

/**
 * @route DELETE /api/categories/:id
 * @desc Archive category (soft delete)
 * @access Admin only
 * @param {string} id - Category ID
 */
router.delete('/:id', requireAdmin, categoryController.archiveCategory);

module.exports = router;