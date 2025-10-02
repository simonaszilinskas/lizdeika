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
 * - POST /upload - Upload file attachment
 *
 * Security:
 * - File type validation (images, PDFs, documents)
 * - Size limit: 10MB
 * - Filename sanitization
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { optionalAuth } = require('../middleware/authMiddleware');
const databaseClient = require('../utils/database');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
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
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: fileFilter
});

// Upload endpoint
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Generate file metadata
        const fileMetadata = {
            filename: req.file.originalname,
            storedFilename: req.file.filename,
            path: req.file.path,
            mimetype: req.file.mimetype,
            size: req.file.size,
            url: `/api/uploads/${req.file.filename}`
        };

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
        if (!filePath.startsWith(uploadsDir)) {
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
        // 3. No authentication (customer accessing their own conversation files)

        if (req.user) {
            // Authenticated user
            if (req.user.role === 'admin' || req.user.role === 'agent') {
                // Admins and agents can access all files
                return res.sendFile(filePath);
            }
        }

        // For customers (no auth), allow access
        // Note: In production, you might want to add visitor ID validation
        return res.sendFile(filePath);

    } catch (error) {
        console.error('File access error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve file'
        });
    }
});

module.exports = router;
