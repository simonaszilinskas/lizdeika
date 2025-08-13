/**
 * Document Processing Service
 * Handles file uploads, text extraction, and chunking for RAG
 */
const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const { v4: uuidv4 } = require('uuid');

class DocumentService {
    constructor() {
        this.uploadDir = path.join(__dirname, '../../uploads');
        this.ensureUploadDirectory();
    }

    /**
     * Ensure upload directory exists
     */
    async ensureUploadDirectory() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create upload directory:', error);
        }
    }

    /**
     * Process uploaded file and extract text
     */
    async processFile(file, uploadSource = 'manual') {
        const fileId = uuidv4();
        const uploadTime = new Date();
        
        try {
            let extractedText = '';
            
            // Extract text based on file type
            if (file.mimetype === 'text/plain') {
                extractedText = file.buffer.toString('utf-8');
            } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const result = await mammoth.extractRawText({ buffer: file.buffer });
                extractedText = result.value;
                
                if (result.messages.length > 0) {
                    console.warn('Word document processing warnings:', result.messages);
                }
            } else {
                throw new Error(`Unsupported file type: ${file.mimetype}`);
            }

            // Clean and validate text
            extractedText = this.cleanText(extractedText);
            
            if (!extractedText || extractedText.length < 10) {
                throw new Error('File contains insufficient text content');
            }

            // Create document metadata
            const documentInfo = {
                id: fileId,
                originalName: file.originalname,
                fileName: `${fileId}_${file.originalname}`,
                fileType: file.mimetype,
                size: file.size,
                uploadSource: uploadSource, // 'manual' or 'api'
                uploadTime: uploadTime,
                textLength: extractedText.length,
                status: 'processed'
            };

            // Save original file
            const filePath = path.join(this.uploadDir, documentInfo.fileName);
            await fs.writeFile(filePath, file.buffer);

            // Save extracted text
            const textPath = path.join(this.uploadDir, `${fileId}_extracted.txt`);
            await fs.writeFile(textPath, extractedText, 'utf-8');

            // Chunk the text
            const chunks = this.chunkText(extractedText, documentInfo);

            console.log(`Processed file: ${file.originalname} -> ${chunks.length} chunks`);

            return {
                document: documentInfo,
                text: extractedText,
                chunks: chunks
            };
            
        } catch (error) {
            console.error('Failed to process file:', error);
            throw error;
        }
    }

    /**
     * Clean extracted text
     */
    cleanText(text) {
        return text
            .replace(/\r\n/g, '\n')      // Normalize line endings
            .replace(/\n\s*\n/g, '\n\n')  // Normalize multiple line breaks
            .replace(/\t/g, ' ')          // Replace tabs with spaces
            .replace(/ +/g, ' ')          // Normalize multiple spaces
            .trim();                      // Remove leading/trailing whitespace
    }

    /**
     * Enhanced chunk text with phrase awareness and larger sizes
     * Uses intelligent boundary detection to maintain context integrity
     */
    chunkText(text, documentInfo, chunkSize = 3000, minChunkSize = 1500, overlap = 300) {
        const cleanText = this.normalizeText(text);
        
        // For very short text, return as single chunk
        if (cleanText.length <= minChunkSize) {
            return [this.createChunk(cleanText, documentInfo, 0)];
        }

        const chunks = [];
        let currentPosition = 0;
        let chunkIndex = 0;

        while (currentPosition < cleanText.length) {
            // Find optimal chunk end position
            const chunkEnd = this.findOptimalChunkEnd(
                cleanText, 
                currentPosition, 
                chunkSize, 
                minChunkSize
            );

            // Extract chunk content
            const chunkContent = cleanText.substring(currentPosition, chunkEnd).trim();
            
            if (chunkContent.length > 0) {
                chunks.push(this.createChunk(chunkContent, documentInfo, chunkIndex));
                chunkIndex++;
            }

            // Calculate next position with overlap
            const nextPosition = Math.max(
                chunkEnd - overlap,
                currentPosition + minChunkSize
            );
            
            // Ensure we make progress
            if (nextPosition <= currentPosition) {
                currentPosition = chunkEnd;
            } else {
                currentPosition = nextPosition;
            }
        }

        return chunks.length > 0 ? chunks : [this.createChunk(cleanText, documentInfo, 0)];
    }

    /**
     * Find optimal position to end chunk respecting phrase boundaries
     */
    findOptimalChunkEnd(text, startPos, targetSize, minSize) {
        const targetEnd = startPos + targetSize;
        const minEnd = startPos + minSize;
        
        // If target position is beyond text, return text end
        if (targetEnd >= text.length) {
            return text.length;
        }

        // Find the best boundary within acceptable range
        const searchStart = Math.min(targetEnd, text.length);
        const searchEnd = Math.max(minEnd, startPos + 1);

        // Priority 1: Paragraph boundaries (\n\n)
        let boundary = this.findLastOccurrence(text, /\n\n/g, searchEnd, searchStart);
        if (boundary !== -1) return boundary;

        // Priority 2: Sentence boundaries (. ! ?)
        boundary = this.findLastOccurrence(text, /[.!?]\s+/g, searchEnd, searchStart);
        if (boundary !== -1) return boundary + 1; // Include punctuation

        // Priority 3: Clause boundaries (, ; :)
        boundary = this.findLastOccurrence(text, /[,;:]\s+/g, searchEnd, searchStart);
        if (boundary !== -1) return boundary + 1;

        // Priority 4: Line breaks
        boundary = this.findLastOccurrence(text, /\n/g, searchEnd, searchStart);
        if (boundary !== -1) return boundary;

        // Priority 5: Word boundaries (spaces)
        boundary = this.findLastOccurrence(text, /\s+/g, searchEnd, searchStart);
        if (boundary !== -1) return boundary;

        // Last resort: use target position (avoid splitting words)
        return this.avoidWordSplit(text, targetEnd);
    }

    /**
     * Find last occurrence of pattern within range
     */
    findLastOccurrence(text, pattern, minPos, maxPos) {
        let lastMatch = -1;
        let match;
        
        pattern.lastIndex = 0; // Reset regex
        
        while ((match = pattern.exec(text)) !== null) {
            const matchPos = match.index;
            
            if (matchPos >= maxPos) break;
            if (matchPos >= minPos) {
                lastMatch = matchPos;
            }
        }
        
        return lastMatch;
    }

    /**
     * Ensure we don't split in the middle of a word
     */
    avoidWordSplit(text, position) {
        if (position >= text.length) return text.length;
        
        // If we're at a space, we're good
        if (/\s/.test(text[position])) return position;
        
        // Find previous space
        for (let i = position; i >= 0; i--) {
            if (/\s/.test(text[i])) {
                return i;
            }
        }
        
        // If no space found, use position (shouldn't happen with minSize)
        return position;
    }

    /**
     * Create a chunk object
     */
    createChunk(text, documentInfo, chunkIndex) {
        return {
            id: `${documentInfo.id}_chunk_${chunkIndex}`,
            content: text,
            metadata: {
                source_document_id: documentInfo.id,
                source_document_name: documentInfo.originalName || 'Document',
                chunk_index: chunkIndex,
                chunk_length: text.length,
                document_type: documentInfo.fileType || 'text/plain',
                upload_source: documentInfo.uploadSource || 'api',
                upload_time: documentInfo.uploadTime ? documentInfo.uploadTime.toISOString() : new Date().toISOString(),
                category: 'uploaded_document'
            }
        };
    }

    /**
     * Normalize text for consistent processing
     */
    normalizeText(text) {
        return text
            .replace(/\r\n/g, '\n')      // Normalize line endings
            .replace(/\n\s*\n/g, '\n\n')  // Normalize multiple line breaks
            .replace(/\t/g, ' ')          // Replace tabs with spaces
            .replace(/ +/g, ' ')          // Normalize multiple spaces
            .trim();                      // Remove leading/trailing whitespace
    }

    /**
     * Get supported file types
     */
    getSupportedFileTypes() {
        return {
            'text/plain': {
                extension: '.txt',
                description: 'Plain text file',
                maxSize: 10 * 1024 * 1024 // 10MB
            },
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
                extension: '.docx',
                description: 'Microsoft Word document',
                maxSize: 50 * 1024 * 1024 // 50MB
            }
        };
    }

    /**
     * Validate file before processing
     */
    validateFile(file) {
        const supportedTypes = this.getSupportedFileTypes();
        
        if (!supportedTypes[file.mimetype]) {
            throw new Error(`Unsupported file type: ${file.mimetype}. Supported types: .txt, .docx`);
        }

        const maxSize = supportedTypes[file.mimetype].maxSize;
        if (file.size > maxSize) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            throw new Error(`File too large. Maximum size: ${maxSizeMB}MB`);
        }

        if (!file.originalname || file.originalname.trim().length === 0) {
            throw new Error('File must have a valid name');
        }

        return true;
    }

    /**
     * Delete uploaded file and associated data
     */
    async deleteFile(documentId) {
        try {
            // Find files associated with this document
            const files = await fs.readdir(this.uploadDir);
            const documentFiles = files.filter(file => file.startsWith(documentId));

            // Delete all associated files
            for (const file of documentFiles) {
                const filePath = path.join(this.uploadDir, file);
                await fs.unlink(filePath);
            }

            console.log(`Deleted ${documentFiles.length} files for document ${documentId}`);
            return true;
        } catch (error) {
            console.error('Failed to delete document files:', error);
            return false;
        }
    }

    /**
     * Get file info (for debugging/admin purposes)
     */
    async getFileInfo(documentId) {
        try {
            const files = await fs.readdir(this.uploadDir);
            const documentFiles = files.filter(file => file.startsWith(documentId));
            
            const fileInfos = [];
            for (const file of documentFiles) {
                const filePath = path.join(this.uploadDir, file);
                const stats = await fs.stat(filePath);
                fileInfos.push({
                    fileName: file,
                    size: stats.size,
                    modified: stats.mtime
                });
            }

            return fileInfos;
        } catch (error) {
            console.error('Failed to get file info:', error);
            return [];
        }
    }
}

module.exports = new DocumentService();