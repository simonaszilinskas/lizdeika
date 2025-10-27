const { z } = require('zod');
const { createLogger } = require('../utils/logger');
const logger = createLogger('validationMiddleware');

/**
 * Validation middleware for document ingestion
 * Validates batch of documents with required fields and size limits
 */
const validateIngestDocuments = (req, res, next) => {
  try {
    const schema = z.object({
      documents: z
        .array(
          z.object({
            body: z
              .string()
              .min(1, 'Document body must be non-empty')
              .max(1000000, 'Document exceeds maximum size (1MB)')
              .transform(val => val.trim()),  // Sanitize: remove leading/trailing whitespace
            title: z
              .string()
              .optional()
              .transform(val => val ? val.trim() : val),  // Sanitize: trim if provided
            sourceUrl: z.string().url('Invalid URL format').optional(),
            date: z.string().datetime().optional(),
            sourceType: z
              .enum(['scraper', 'api', 'manual_upload'])
              .default('api'),
          })
        )
        .min(1, 'At least one document is required')
        .max(100, 'Batch size cannot exceed 100 documents'),
    });

    const validationResult = schema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      logger.warn('Document ingestion validation failed:', {
        errors,
        ip: req.ip,
        userId: req.user?.id,
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    // Attach validated data to request
    req.validatedData = validationResult.data;
    next();
  } catch (error) {
    logger.error('Validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation error',
      details: error.message,
    });
  }
};

/**
 * Validation middleware for orphan detection
 * Validates currentUrls array and optional dryRun flag
 *
 * Note: currentUrls can be empty to detect ALL scraper documents as orphans
 * If currentUrls is empty: All scraper documents are considered orphaned
 * If currentUrls has values: Only scraper documents NOT in this list are orphaned
 */
const validateDetectOrphans = (req, res, next) => {
  try {
    const schema = z.object({
      currentUrls: z
        .array(z.string().url('Each URL must be valid'))
        .default([], 'Empty array detects all scraper documents as orphans'),
      dryRun: z.boolean().default(false),
    });

    const validationResult = schema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      logger.warn('Orphan detection validation failed:', {
        errors,
        ip: req.ip,
        userId: req.user?.id,
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    // Attach validated data to request
    req.validatedData = validationResult.data;
    next();
  } catch (error) {
    logger.error('Validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation error',
      details: error.message,
    });
  }
};

module.exports = {
  validateIngestDocuments,
  validateDetectOrphans,
};
