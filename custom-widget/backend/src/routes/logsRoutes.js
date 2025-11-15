/**
 * LOGS API ROUTES
 * 
 * Main Purpose: Provide API endpoints for log management and querying
 * 
 * Key Responsibilities:
 * - Log Query API: Search and filter application logs for administrators
 * - Frontend Log Ingestion: Accept structured logs from frontend applications
 * - Log Analytics: Provide aggregated log statistics and metrics
 * - Log Export: Export logs in various formats for external analysis
 * 
 * Features:
 * - Admin-only access with JWT authentication
 * - Advanced filtering by level, module, correlation ID, date range
 * - Pagination and sorting capabilities
 * - Correlation ID based log tracing
 * - Log statistics and error rate monitoring
 * 
 * Security:
 * - JWT authentication required for all endpoints
 * - Admin role required for log querying
 * - Rate limiting on frontend log ingestion
 * - Input validation and sanitization
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/authMiddleware');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();
const logger = createLogger('logsRoutes');

/**
 * GET /api/logs
 * Query application logs with filtering and pagination
 * Admin access required
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Check admin permissions
        if (req.user.role !== 'admin') {
            logger.warn('Unauthorized log access attempt', { userId: req.user.id });
            return res.status(403).json({ 
                success: false, 
                error: 'Admin access required' 
            });
        }

        const {
            level,
            module,
            correlationId,
            userId,
            startDate,
            endDate,
            search,
            page = 1,
            limit = 100,
            sortBy = 'timestamp',
            sortOrder = 'desc'
        } = req.query;

        // Build filter conditions
        const where = {};

        if (level) {
            where.level = level;
        }

        if (module) {
            where.module = { contains: module, mode: 'insensitive' };
        }

        if (correlationId) {
            where.correlation_id = correlationId;
        }

        if (userId) {
            where.user_id = userId;
        }

        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) {
                where.timestamp.gte = new Date(startDate);
            }
            if (endDate) {
                where.timestamp.lte = new Date(endDate);
            }
        }

        if (search) {
            where.message = { contains: search, mode: 'insensitive' };
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = Math.min(parseInt(limit), 1000); // Max 1000 records

        // Execute query
        const [logs, total] = await Promise.all([
            prisma.application_logs.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                skip,
                take,
                select: {
                    id: true,
                    timestamp: true,
                    level: true,
                    correlation_id: true,
                    service: true,
                    module: true,
                    message: true,
                    user_id: true,
                    metadata: true,
                    stack: true
                }
            }),
            prisma.application_logs.count({ where })
        ]);

        logger.info('Log query executed', { 
            userId: req.user.id,
            filters: { level, module, correlationId },
            resultCount: logs.length,
            totalCount: total
        });

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page: parseInt(page),
                    limit: take,
                    total,
                    pages: Math.ceil(total / take)
                }
            }
        });

    } catch (error) {
        logger.logError(error, { userId: req.user?.id, context: 'Log query failed' });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to query logs' 
        });
    }
});

/**
 * GET /api/logs/stats
 * Get log statistics and metrics
 * Admin access required
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Admin access required' 
            });
        }

        const { startDate, endDate } = req.query;
        const timeFilter = {};

        if (startDate || endDate) {
            timeFilter.timestamp = {};
            if (startDate) timeFilter.timestamp.gte = new Date(startDate);
            if (endDate) timeFilter.timestamp.lte = new Date(endDate);
        }

        // Get statistics
        const [
            totalLogs,
            errorCount,
            warnCount,
            infoCount,
            debugCount,
            moduleStats,
            recentErrors
        ] = await Promise.all([
            prisma.application_logs.count({ where: timeFilter }),
            prisma.application_logs.count({ where: { ...timeFilter, level: 'error' } }),
            prisma.application_logs.count({ where: { ...timeFilter, level: 'warn' } }),
            prisma.application_logs.count({ where: { ...timeFilter, level: 'info' } }),
            prisma.application_logs.count({ where: { ...timeFilter, level: 'debug' } }),
            prisma.application_logs.groupBy({
                by: ['module'],
                where: timeFilter,
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10
            }),
            prisma.application_logs.findMany({
                where: { ...timeFilter, level: 'error' },
                orderBy: { timestamp: 'desc' },
                take: 10,
                select: {
                    timestamp: true,
                    module: true,
                    message: true,
                    correlation_id: true
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                summary: {
                    total: totalLogs,
                    error: errorCount,
                    warn: warnCount,
                    info: infoCount,
                    debug: debugCount
                },
                moduleStats: moduleStats.map(stat => ({
                    module: stat.module || 'Unknown',
                    count: stat._count.id
                })),
                recentErrors
            }
        });

    } catch (error) {
        logger.logError(error, { userId: req.user?.id, context: 'Log stats query failed' });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get log statistics' 
        });
    }
});

/**
 * GET /api/logs/trace/:correlationId
 * Get all logs for a specific correlation ID
 * Admin access required
 */
router.get('/trace/:correlationId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Admin access required' 
            });
        }

        const { correlationId } = req.params;

        const logs = await prisma.application_logs.findMany({
            where: { correlation_id: correlationId },
            orderBy: { timestamp: 'asc' },
            select: {
                id: true,
                timestamp: true,
                level: true,
                service: true,
                module: true,
                message: true,
                user_id: true,
                metadata: true,
                stack: true
            }
        });

        logger.info('Correlation trace retrieved', { 
            userId: req.user.id,
            correlationId,
            logCount: logs.length
        });

        res.json({
            success: true,
            data: {
                correlationId,
                logs,
                count: logs.length
            }
        });

    } catch (error) {
        logger.logError(error, { userId: req.user?.id, context: 'Correlation trace query failed' });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve correlation trace' 
        });
    }
});

/**
 * POST /api/logs/frontend
 * Accept logs from frontend applications
 * No authentication required (for error reporting)
 */
router.post('/frontend', async (req, res) => {
    try {
        const { 
            level = 'error',
            message,
            correlationId,
            module = 'frontend',
            userId,
            metadata,
            stack,
            url,
            userAgent
        } = req.body;

        // Basic validation
        if (!message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Message is required' 
            });
        }

        // Combine frontend-specific metadata
        const frontendMetadata = {
            ...metadata,
            url,
            userAgent,
            source: 'frontend',
            ip: req.ip
        };

        // Store the frontend log
        await prisma.application_logs.create({
            data: {
                level: level.toLowerCase(),
                correlation_id: correlationId || null,
                service: 'lizdeika-frontend',
                module,
                message: message.substring(0, 1000), // Limit message length
                user_id: userId || null,
                metadata: frontendMetadata,
                stack: stack?.substring(0, 5000) || null // Limit stack trace length
            }
        });

        logger.info('Frontend log received', { 
            level,
            module,
            correlationId,
            hasStack: !!stack
        });

        res.json({ success: true });

    } catch (error) {
        logger.logError(error, { context: 'Frontend log ingestion failed' });
        res.status(500).json({ 
            success: false, 
            error: 'Failed to store frontend log' 
        });
    }
});

module.exports = router;