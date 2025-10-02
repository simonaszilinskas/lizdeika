/**
 * CATEGORY MANAGEMENT CONTROLLER
 *
 * Main Purpose: Handle ticket category management operations for agents and administrators
 *
 * Key Responsibilities:
 * - Category CRUD: Create, read, update, and archive categories
 * - Permission Management: Enforce ownership and role-based access control
 * - Category Assignment: Handle ticket-category relationships
 * - Scope Management: Handle personal vs global category visibility
 * - Usage Statistics: Track category usage and provide insights
 *
 * Security Features:
 * - Role-based access control (agents can manage own categories, admins manage all)
 * - Ownership validation for personal categories
 * - Soft delete (archiving) to preserve ticket relationships
 * - Input validation and sanitization
 *
 * Endpoints:
 * - GET /categories - List categories with filtering and pagination
 * - POST /categories - Create new category (agents + admins)
 * - PUT /categories/:id - Update category (owner + admins)
 * - DELETE /categories/:id - Archive category (admins only)
 * - GET /categories/stats - Category usage statistics (admins only)
 *
 * Dependencies:
 * - Prisma client for database operations
 * - Auth middleware for role and ownership validation
 * - WebSocket for real-time updates
 */

const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Import WebSocket service for real-time updates
let websocketService = null;
const getWebSocketService = () => {
    if (!websocketService) {
        try {
            websocketService = require('../services/websocketService');
        } catch (error) {
            console.warn('WebSocket service not available for category broadcasts:', error.message);
        }
    }
    return websocketService;
};

class CategoryController {
    /**
     * Get all categories with filtering and pagination
     * @route GET /api/categories?scope=all&include_archived=false&page=1&limit=50&search=
     * @access Agent/Admin
     */
    getCategories = asyncHandler(async (req, res) => {
        const {
            include_archived = 'false',
            page = '1',
            limit = '50',
            search = ''
        } = req.query;

        const { user } = req;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 100); // Max 100 per page
        const skip = (pageNum - 1) * limitNum;

        // Build filters - all categories are global now
        const filters = {
            is_archived: include_archived === 'true' ? undefined : false
        };

        // Add search filter
        if (search.trim()) {
            filters.name = {
                contains: search.trim(),
                mode: 'insensitive'
            };
        }

        // Get categories with ticket counts
        const categories = await prisma.ticket_categories.findMany({
            where: filters,
            include: {
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                },
                _count: {
                    select: { tickets: true }
                }
            },
            orderBy: [
                { name: 'asc' }
            ],
            skip,
            take: limitNum
        });

        // Get total count for pagination
        const total = await prisma.ticket_categories.count({ where: filters });

        // Transform response to include permissions and metadata
        const transformedCategories = categories.map(category => ({
            id: category.id,
            name: category.name,
            description: category.description,
            color: category.color,
            created_by: category.created_by,
            creator: category.creator,
            creator_name: `${category.creator.first_name} ${category.creator.last_name}`,
            is_archived: category.is_archived,
            _count: category._count,
            ticket_count: category._count.tickets,
            created_at: category.created_at,
            updated_at: category.updated_at,
            can_edit: user.role === 'admin',
            can_delete: user.role === 'admin' && category._count.tickets === 0
        }));

        res.json({
            success: true,
            categories: transformedCategories,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                has_more: skip + limitNum < total
            }
        });
    });

    /**
     * Create new category
     * @route POST /api/categories
     * @access Admin only
     * @body { name, description?, color? }
     */
    createCategory = asyncHandler(async (req, res) => {
        const { name, description, color = '#6B7280' } = req.body;
        const { user } = req;

        // Only admins can create categories
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Only administrators can create categories' });
        }

        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({ error: 'Category name must be 100 characters or less' });
        }

        // Validate color format (hex)
        const colorRegex = /^#[0-9A-F]{6}$/i;
        if (color && !colorRegex.test(color)) {
            return res.status(400).json({ error: 'Color must be a valid hex color (e.g., #FF0000)' });
        }

        // Check for duplicate names
        const existingCategory = await prisma.ticket_categories.findFirst({
            where: {
                name: name.trim(),
                is_archived: false
            }
        });

        if (existingCategory) {
            return res.status(409).json({
                error: 'A category with this name already exists'
            });
        }

        // Create category
        const category = await prisma.ticket_categories.create({
            data: {
                id: uuidv4(),
                name: name.trim(),
                description: description?.trim() || null,
                color: color,
                created_by: user.id
            },
            include: {
                creator: {
                    select: {
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                },
                _count: {
                    select: { tickets: true }
                }
            }
        });

        // Transform response
        const response = {
            success: true,
            category: {
                id: category.id,
                name: category.name,
                description: category.description,
                color: category.color,
                created_by: category.created_by,
                creator: category.creator,
                creator_name: `${category.creator.first_name} ${category.creator.last_name}`,
                is_archived: category.is_archived,
                _count: category._count,
                ticket_count: category._count.tickets,
                created_at: category.created_at,
                updated_at: category.updated_at,
                can_edit: true,
                can_delete: true
            }
        };

        res.status(201).json({
            success: true,
            ...response
        });

        // Broadcast category update via WebSocket
        const wsService = getWebSocketService();
        if (wsService && typeof wsService.broadcastCategoryUpdate === 'function') {
            try {
                // Load all categories for broadcast
                const allCategories = await prisma.ticket_categories.findMany({
                    where: { is_archived: false },
                    include: {
                        creator: { select: { first_name: true, last_name: true, email: true } },
                        _count: { select: { tickets: true } }
                    },
                    orderBy: [{ name: 'asc' }]
                });
                wsService.broadcastCategoryUpdate(allCategories);
            } catch (error) {
                console.error('Error broadcasting category creation:', error);
            }
        }
    });

    /**
     * Update category
     * @route PUT /api/categories/:id
     * @access Admin only
     * @body { name?, description?, color? }
     */
    updateCategory = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { name, description, color } = req.body;
        const { user } = req;

        // Only admins can update categories
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Only administrators can update categories' });
        }

        // Get existing category
        const existingCategory = await prisma.ticket_categories.findUnique({
            where: { id },
            include: {
                creator: {
                    select: {
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                },
                _count: {
                    select: { tickets: true }
                }
            }
        });

        if (!existingCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Validate updates
        const updates = {};

        if (name !== undefined) {
            if (!name || name.trim().length === 0) {
                return res.status(400).json({ error: 'Category name cannot be empty' });
            }
            if (name.trim().length > 100) {
                return res.status(400).json({ error: 'Category name must be 100 characters or less' });
            }

            // Check for duplicate names
            if (name.trim() !== existingCategory.name) {
                const duplicate = await prisma.ticket_categories.findFirst({
                    where: {
                        name: name.trim(),
                        is_archived: false,
                        NOT: { id }
                    }
                });

                if (duplicate) {
                    return res.status(409).json({
                        error: 'A category with this name already exists'
                    });
                }
            }

            updates.name = name.trim();
        }

        if (description !== undefined) {
            updates.description = description?.trim() || null;
        }

        if (color !== undefined) {
            const colorRegex = /^#[0-9A-F]{6}$/i;
            if (color && !colorRegex.test(color)) {
                return res.status(400).json({ error: 'Color must be a valid hex color (e.g., #FF0000)' });
            }
            updates.color = color;
        }


        // Add metadata
        updates.updated_by = user.id;
        updates.updated_at = new Date();

        // Update category
        const updatedCategory = await prisma.ticket_categories.update({
            where: { id },
            data: updates,
            include: {
                creator: {
                    select: {
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                },
                _count: {
                    select: { tickets: true }
                }
            }
        });

        // Transform response
        const response = {
            success: true,
            category: {
                id: updatedCategory.id,
                name: updatedCategory.name,
                description: updatedCategory.description,
                color: updatedCategory.color,
                created_by: updatedCategory.created_by,
                creator: updatedCategory.creator,
                creator_name: `${updatedCategory.creator.first_name} ${updatedCategory.creator.last_name}`,
                is_archived: updatedCategory.is_archived,
                _count: updatedCategory._count,
                ticket_count: updatedCategory._count.tickets,
                created_at: updatedCategory.created_at,
                updated_at: updatedCategory.updated_at,
                can_edit: user.role === 'admin',
                can_delete: user.role === 'admin' && updatedCategory._count.tickets === 0
            }
        };

        res.json({
            success: true,
            ...response
        });

        // Broadcast category update via WebSocket
        const wsService = getWebSocketService();
        if (wsService && typeof wsService.broadcastCategoryUpdate === 'function') {
            try {
                // Load all categories for broadcast
                const allCategories = await prisma.ticket_categories.findMany({
                    where: { is_archived: false },
                    include: {
                        creator: { select: { first_name: true, last_name: true, email: true } },
                        _count: { select: { tickets: true } }
                    },
                    orderBy: [{ name: 'asc' }]
                });
                wsService.broadcastCategoryUpdate(allCategories);
            } catch (error) {
                console.error('Error broadcasting category update:', error);
            }
        }
    });

    /**
     * Archive category (soft delete)
     * @route DELETE /api/categories/:id
     * @access Admin only
     */
    archiveCategory = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { user } = req;

        // Get category with ticket count
        const category = await prisma.ticket_categories.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { tickets: true }
                }
            }
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Only admins can archive categories
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Only administrators can archive categories' });
        }

        // Archive the category
        await prisma.ticket_categories.update({
            where: { id },
            data: {
                is_archived: true,
                updated_by: user.id,
                updated_at: new Date()
            }
        });

        res.json({
            success: true,
            tickets_affected: category._count.tickets
        });

        // Broadcast category update via WebSocket (archive changes the list)
        const wsService = getWebSocketService();
        if (wsService && typeof wsService.broadcastCategoryUpdate === 'function') {
            try {
                // Load all active categories for broadcast
                const allCategories = await prisma.ticket_categories.findMany({
                    where: { is_archived: false },
                    include: {
                        creator: { select: { first_name: true, last_name: true, email: true } },
                        _count: { select: { tickets: true } }
                    },
                    orderBy: [{ name: 'asc' }]
                });
                wsService.broadcastCategoryUpdate(allCategories);
            } catch (error) {
                console.error('Error broadcasting category archive:', error);
            }
        }
    });

    /**
     * Get category usage statistics
     * @route GET /api/categories/stats
     * @access Admin only
     */
    getCategoryStats = asyncHandler(async (req, res) => {
        const { user } = req;

        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Administrator access required' });
        }

        // Get overall statistics
        const [totalCategories, activeCategories, archivedCategories, totalCategorizedTickets] = await Promise.all([
            prisma.ticket_categories.count(),
            prisma.ticket_categories.count({ where: { is_archived: false } }),
            prisma.ticket_categories.count({ where: { is_archived: true } }),
            prisma.tickets.count({ where: { category_id: { not: null } } })
        ]);

        // Get category usage breakdown
        const categoryUsage = await prisma.ticket_categories.findMany({
            where: { is_archived: false },
            include: {
                _count: {
                    select: { tickets: true }
                },
                creator: {
                    select: {
                        first_name: true,
                        last_name: true
                    }
                }
            },
            orderBy: {
                tickets: {
                    _count: 'desc'
                }
            },
            take: 10 // Top 10 most used categories
        });

        // Get creator breakdown
        const creatorBreakdown = await prisma.ticket_categories.groupBy({
            by: ['created_by'],
            where: { is_archived: false },
            _count: {
                _all: true
            }
        });

        res.json({
            success: true,
            stats: {
                totals: {
                    total_categories: totalCategories,
                    active_categories: activeCategories,
                    archived_categories: archivedCategories,
                    categorized_tickets: totalCategorizedTickets
                },
                creator_breakdown: creatorBreakdown.reduce((acc, item) => {
                    acc[item.created_by] = item._count._all;
                    return acc;
                }, {}),
                top_categories: categoryUsage.map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    creator_name: `${cat.creator.first_name} ${cat.creator.last_name}`,
                    ticket_count: cat._count.tickets
                }))
            }
        });
    });
}

module.exports = new CategoryController();