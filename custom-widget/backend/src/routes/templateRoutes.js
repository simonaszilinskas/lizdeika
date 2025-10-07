const express = require('express');
const router = express.Router();
const databaseClient = require('../utils/database');
const { authenticateToken, requireAgent, requireAdmin } = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');

// Get all active templates (agents and admins)
router.get('/', authenticateToken, requireAgent, async (req, res) => {
    try {
        const templates = await databaseClient.getClient().response_templates.findMany({
            where: { is_active: true },
            include: {
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                title: 'asc'
            }
        });

        res.json({ success: true, templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch templates'
        });
    }
});

// Get all templates including inactive (admin only)
router.get('/all', authenticateToken, requireAgent, requireAdmin, async (req, res) => {
    try {
        const templates = await databaseClient.getClient().response_templates.findMany({
            include: {
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                }
            },
            orderBy: [
                { is_active: 'desc' },
                { title: 'asc' }
            ]
        });

        res.json({ success: true, templates });
    } catch (error) {
        console.error('Error fetching all templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch templates'
        });
    }
});

// Create new template (admin only)
router.post('/', authenticateToken, requireAgent, requireAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Title and content are required'
            });
        }

        if (title.length > 200) {
            return res.status(400).json({
                success: false,
                error: 'Title must not exceed 200 characters'
            });
        }

        if (content.length > 10000) {
            return res.status(400).json({
                success: false,
                error: 'Content must not exceed 10,000 characters'
            });
        }

        const template = await databaseClient.getClient().response_templates.create({
            data: {
                id: uuidv4(),
                title,
                content,
                created_by: req.user.id,
                is_active: true
            },
            include: {
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                }
            }
        });

        res.json({ success: true, template });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create template'
        });
    }
});

// Update template (admin only)
router.put('/:id', authenticateToken, requireAgent, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, is_active } = req.body;

        if (title !== undefined && title.length > 200) {
            return res.status(400).json({
                success: false,
                error: 'Title must not exceed 200 characters'
            });
        }

        if (content !== undefined && content.length > 10000) {
            return res.status(400).json({
                success: false,
                error: 'Content must not exceed 10,000 characters'
            });
        }

        const updateData = {
            updated_by: req.user.id
        };

        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (is_active !== undefined) updateData.is_active = is_active;

        const template = await databaseClient.getClient().response_templates.update({
            where: { id },
            data: updateData,
            include: {
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                }
            }
        });

        res.json({ success: true, template });
    } catch (error) {
        console.error('Error updating template:', error);
        if (error && error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to update template'
        });
    }
});

// Delete template (admin only) - soft delete by setting is_active to false
router.delete('/:id', authenticateToken, requireAgent, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const template = await databaseClient.getClient().response_templates.update({
            where: { id },
            data: {
                is_active: false,
                updated_by: req.user.id
            },
            include: {
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true
                    }
                }
            }
        });

        res.json({ success: true, template });
    } catch (error) {
        console.error('Error deleting template:', error);
        if (error && error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: 'Template not found'
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to delete template'
        });
    }
});

module.exports = router;
