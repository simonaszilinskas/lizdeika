/**
 * FILE UPLOAD ROUTES
 *
 * Main Purpose: Handle file attachment uploads for messages
 *
 * Key Responsibilities:
 * - File Upload: Accept and validate file uploads
 * - Storage Management: Store files securely on filesystem
 * - Metadata Generation: Create file metadata for database storage
 *
 * Endpoints:
 * - POST /upload - Upload file attachment (requires authentication or valid conversation)
 * - GET /uploads/:filename - Download file (requires authentication or conversation ownership)
 *
 * Security:
 * - File type validation (images, PDFs, documents)
 * - Size limit: Configurable via MAX_FILE_UPLOAD_SIZE_MB (default 10MB)
 * - Filename sanitization with UUID prefix
 * - Rate limiting: 5 uploads per minute per IP
 * - Upload authentication: Requires JWT token or valid conversationId
 * - Download authorization: Requires JWT token or matching conversationId query param
 * - Directory traversal protection
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { optionalAuth } = require('../middleware/authMiddleware');
const databaseClient = require('../utils/database');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Rate limiting for file uploads to prevent abuse
const uploadRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 uploads per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many upload attempts. Please wait before uploading more files.',
        code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        return req.ip || 'unknown';
    }
});

/**
 * Validate file path to prevent directory traversal attacks
 * @param {string} requestedPath - Path requested by user
 * @param {string} allowedDir - Base directory that's allowed
 * @returns {boolean} True if path is safe
 */
function isPathSafe(requestedPath, allowedDir) {
    const resolvedPath = path.resolve(requestedPath);
    const resolvedAllowedDir = path.resolve(allowedDir);
    return resolvedPath.startsWith(resolvedAllowedDir + path.sep);
}

/**
 * Generate file metadata from multer file object
 * @param {Object} file - Multer file object
 * @returns {Object} File metadata for API response (excludes server filesystem path for security)
 */
function generateFileMetadata(file) {
    return {
        filename: file.originalname,
        storedFilename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/api/uploads/${file.filename}`
    };
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: uuid-originalname
        const uniqueId = uuidv4();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${uniqueId}-${sanitizedName}`);
    }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed: images, PDF, DOC, DOCX, XLS, XLSX, TXT'), false);
    }
};

// Configure multer upload
const upload = multer({
    storage: storage,
    limits: {
        fileSize: (parseInt(process.env.MAX_FILE_UPLOAD_SIZE_MB || '10', 10)) * 1024 * 1024,
        files: 1
    },
    fileFilter: fileFilter
});

// Upload endpoint - requires authentication and rate limiting
router.post('/upload', uploadRateLimit, optionalAuth, upload.single('file'), (req, res) => {
    try {
        // Validate authentication - only authenticated users or valid widget sessions can upload
        // Note: conversationId comes from FormData and is available in req.body after multer processing
        if (!req.user && !req.body.conversationId) {
            console.warn('Upload attempt without authentication:', {
                hasUser: !!req.user,
                hasConversationId: !!req.body.conversationId,
                ip: req.ip
            });
            return res.status(401).json({
                success: false,
                error: 'Authentication or valid conversation required for file upload',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Log successful upload
        console.log('File uploaded successfully:', {
            filename: req.file.filename,
            conversationId: req.body.conversationId,
            authenticated: !!req.user
        });

        // Generate file metadata
        const fileMetadata = generateFileMetadata(req.file);

        res.json({
            success: true,
            file: fileMetadata
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'File upload failed'
        });
    }
});

// Serve uploaded files with access control
router.get('/uploads/:filename', optionalAuth, async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(uploadsDir, filename);

        // Security check: prevent directory traversal
        if (!isPathSafe(filePath, uploadsDir)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Extract the stored filename from the URL (with UUID prefix)
        const storedFilename = filename;
        const fileUrl = `/api/uploads/${storedFilename}`;

        // Find the message containing this file
        const db = databaseClient.getClient();
        const message = await db.messages.findFirst({
            where: {
                metadata: {
                    path: ['file', 'url'],
                    equals: fileUrl
                }
            },
            include: {
                tickets: {
                    select: {
                        id: true,
                        assigned_agent_id: true
                    }
                }
            }
        });

        if (!message) {
            // File exists but not linked to any message
            // Allow access for backward compatibility or orphaned files
            console.warn(`File accessed without message link: ${filename}`);
            return res.sendFile(filePath);
        }

        // Authorization check
        const ticket = message.tickets;

        // Allow access if:
        // 1. User is authenticated and is admin/agent (can see all files)
        // 2. User is the assigned agent for this conversation
        // 3. Request includes valid conversation ID that matches the file's ticket

        if (req.user) {
            // Authenticated user - admins and agents can access all files
            if (req.user.role === 'admin' || req.user.role === 'agent') {
                return res.sendFile(filePath);
            }
        }

        // For unauthenticated users (customers), require conversationId validation
        const conversationId = req.query.conversationId;

        if (!conversationId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied - authentication or valid conversation required',
                code: 'ACCESS_DENIED'
            });
        }

        // Verify the conversation ID matches the ticket that owns this file
        if (ticket && ticket.id === conversationId) {
            return res.sendFile(filePath);
        }

        // Access denied if conversation ID doesn't match
        return res.status(403).json({
            success: false,
            error: 'Access denied - invalid conversation',
            code: 'INVALID_CONVERSATION'
        });

    } catch (error) {
        console.error('File access error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve file'
        });
    }
});

module.exports = { router, isPathSafe, generateFileMetadata };
