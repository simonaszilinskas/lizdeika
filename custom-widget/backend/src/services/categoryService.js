/**
 * CATEGORY SERVICE
 *
 * Main Purpose: Handle business logic for ticket category operations
 *
 * Key Responsibilities:
 * - Category Data Management: CRUD operations with business logic
 * - Permission Validation: Ensure users can only access appropriate categories
 * - Relationship Management: Handle category-ticket associations
 * - Cache Management: Optimize category lookups for performance
 *
 * Features:
 * - Role-based category filtering
 * - Soft delete support for data integrity
 * - Usage statistics and analytics
 * - Validation and sanitization
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CategoryService {
    /**
     * Get category by ID with user permission check
     * @param {string} categoryId - Category ID
     * @param {Object} user - User object (optional for permission check)
     * @returns {Object|null} Category object or null if not found/no permission
     */
    async getCategoryById(categoryId, user = null) {
        const category = await prisma.ticket_categories.findUnique({
            where: { id: categoryId },
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
            }
        });

        if (!category) {
            return null;
        }

        // If no user provided, return category without permission check
        if (!user) {
            return category;
        }

        // Check if user can access this category
        const canAccess = category.scope === 'global' ||
                         (category.scope === 'personal' && category.created_by === user.id) ||
                         user.role === 'admin';

        return canAccess ? category : null;
    }

    /**
     * Get categories accessible to user
     * @param {Object} user - User object
     * @param {Object} filters - Filter options
     * @returns {Array} Array of categories
     */
    async getCategoriesForUser(user, filters = {}) {
        const {
            scope = 'all',
            include_archived = false,
            search = '',
            limit = 50,
            offset = 0
        } = filters;

        // Build base filter
        const whereConditions = {
            is_archived: include_archived ? undefined : false
        };

        // Handle scope filtering
        if (scope === 'personal') {
            whereConditions.AND = [
                { scope: 'personal' },
                { created_by: user.id }
            ];
        } else if (scope === 'global') {
            whereConditions.scope = 'global';
        } else if (scope === 'all') {
            // Show global + user's personal categories
            if (user.role !== 'admin') {
                whereConditions.OR = [
                    { scope: 'global' },
                    { AND: [{ scope: 'personal' }, { created_by: user.id }] }
                ];
            }
        }

        // Add search filter
        if (search.trim()) {
            whereConditions.name = {
                contains: search.trim(),
                mode: 'insensitive'
            };
        }

        return await prisma.ticket_categories.findMany({
            where: whereConditions,
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
                { scope: 'asc' }, // Global first
                { name: 'asc' }
            ],
            skip: offset,
            take: Math.min(limit, 100) // Max 100 per request
        });
    }

    /**
     * Create new category
     * @param {Object} categoryData - Category data
     * @param {Object} user - User creating the category
     * @returns {Object} Created category
     */
    async createCategory(categoryData, user) {
        const { name, description, color = '#6B7280', scope = 'personal' } = categoryData;

        // Validate name
        if (!name || name.trim().length === 0) {
            throw new Error('Category name is required');
        }

        if (name.trim().length > 100) {
            throw new Error('Category name must be 100 characters or less');
        }

        // Only admins can create global categories
        if (scope === 'global' && user.role !== 'admin') {
            throw new Error('Only administrators can create global categories');
        }

        // Check for duplicate names within scope
        const existingCategory = await prisma.ticket_categories.findFirst({
            where: {
                name: name.trim(),
                scope,
                created_by: scope === 'personal' ? user.id : undefined,
                is_archived: false
            }
        });

        if (existingCategory) {
            throw new Error(`A ${scope} category with this name already exists`);
        }

        // Create category
        return await prisma.ticket_categories.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                color: color,
                scope: scope,
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
    }

    /**
     * Update category
     * @param {string} categoryId - Category ID
     * @param {Object} updates - Updates to apply
     * @param {Object} user - User making the update
     * @returns {Object} Updated category
     */
    async updateCategory(categoryId, updates, user) {
        // Get existing category
        const existingCategory = await this.getCategoryById(categoryId);
        if (!existingCategory) {
            throw new Error('Category not found');
        }

        // Check permissions
        const canEdit = user.role === 'admin' || existingCategory.created_by === user.id;
        if (!canEdit) {
            throw new Error('You can only edit your own categories');
        }

        // Validate updates
        const validatedUpdates = {};

        if (updates.name !== undefined) {
            if (!updates.name || updates.name.trim().length === 0) {
                throw new Error('Category name cannot be empty');
            }
            if (updates.name.trim().length > 100) {
                throw new Error('Category name must be 100 characters or less');
            }

            // Check for duplicate names
            if (updates.name.trim() !== existingCategory.name) {
                const duplicate = await prisma.ticket_categories.findFirst({
                    where: {
                        name: updates.name.trim(),
                        scope: existingCategory.scope,
                        created_by: existingCategory.scope === 'personal' ? existingCategory.created_by : undefined,
                        is_archived: false,
                        NOT: { id: categoryId }
                    }
                });

                if (duplicate) {
                    throw new Error(`A ${existingCategory.scope} category with this name already exists`);
                }
            }

            validatedUpdates.name = updates.name.trim();
        }

        if (updates.description !== undefined) {
            validatedUpdates.description = updates.description?.trim() || null;
        }

        if (updates.color !== undefined) {
            const colorRegex = /^#[0-9A-F]{6}$/i;
            if (updates.color && !colorRegex.test(updates.color)) {
                throw new Error('Color must be a valid hex color (e.g., #FF0000)');
            }
            validatedUpdates.color = updates.color;
        }

        // Only admins can change scope
        if (updates.scope !== undefined && updates.scope !== existingCategory.scope) {
            if (user.role !== 'admin') {
                throw new Error('Only administrators can change category scope');
            }
            validatedUpdates.scope = updates.scope;
        }

        // Add metadata
        validatedUpdates.updated_by = user.id;
        validatedUpdates.updated_at = new Date();

        // Update category
        return await prisma.ticket_categories.update({
            where: { id: categoryId },
            data: validatedUpdates,
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
    }

    /**
     * Archive category (soft delete)
     * @param {string} categoryId - Category ID
     * @param {Object} user - User archiving the category
     * @returns {Object} Result with tickets affected count
     */
    async archiveCategory(categoryId, user) {
        // Get category with ticket count
        const category = await prisma.ticket_categories.findUnique({
            where: { id: categoryId },
            include: {
                _count: {
                    select: { tickets: true }
                }
            }
        });

        if (!category) {
            throw new Error('Category not found');
        }

        // Only admins can archive categories
        if (user.role !== 'admin') {
            throw new Error('Only administrators can archive categories');
        }

        // Archive the category
        await prisma.ticket_categories.update({
            where: { id: categoryId },
            data: {
                is_archived: true,
                updated_by: user.id,
                updated_at: new Date()
            }
        });

        return {
            success: true,
            tickets_affected: category._count.tickets
        };
    }

    /**
     * Get category usage statistics
     * @param {Object} user - User requesting stats (admin only)
     * @returns {Object} Statistics object
     */
    async getCategoryStats(user) {
        if (user.role !== 'admin') {
            throw new Error('Administrator access required');
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

        // Get scope breakdown
        const scopeBreakdown = await prisma.ticket_categories.groupBy({
            by: ['scope'],
            where: { is_archived: false },
            _count: {
                _all: true
            }
        });

        return {
            totals: {
                total_categories: totalCategories,
                active_categories: activeCategories,
                archived_categories: archivedCategories,
                categorized_tickets: totalCategorizedTickets
            },
            scope_breakdown: scopeBreakdown.reduce((acc, item) => {
                acc[item.scope] = item._count._all;
                return acc;
            }, {}),
            top_categories: categoryUsage.map(cat => ({
                id: cat.id,
                name: cat.name,
                scope: cat.scope,
                creator_name: `${cat.creator.first_name} ${cat.creator.last_name}`,
                ticket_count: cat._count.tickets
            }))
        };
    }

    /**
     * Check if user can use category for assignment
     * @param {string} categoryId - Category ID
     * @param {Object} user - User object
     * @returns {boolean} True if user can use category
     */
    async canUseCategory(categoryId, user) {
        const category = await this.getCategoryById(categoryId);
        if (!category || category.is_archived) {
            return false;
        }

        return category.scope === 'global' ||
               (category.scope === 'personal' && category.created_by === user.id) ||
               user.role === 'admin';
    }
}

module.exports = new CategoryService();