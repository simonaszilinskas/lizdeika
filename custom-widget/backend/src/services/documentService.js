/**
 * DOCUMENT PROCESSING SERVICE
 *
 * Main Purpose: Process uploaded documents for RAG knowledge base integration
 *
 * Key Responsibilities:
 * - File Upload Handling: Manage document uploads with validation and storage
 * - Text Extraction: Extract plain text from .txt and .docx files
 * - Intelligent Chunking: Split documents into optimal-sized chunks for embedding
 * - Boundary Detection: Respect paragraph, sentence, and phrase boundaries during chunking
 * - Fallback Strategy: Automatically retry with smaller chunks if embedding fails
 * - File Management: Store, retrieve, and delete uploaded documents
 *
 * Dependencies:
 * - fs (promises) for async file system operations
 * - mammoth for .docx text extraction
 * - UUID for unique document identifiers
 * - Node.js path module for file path management
 *
 * Features:
 * - Supported formats: .txt (plain text), .docx (Microsoft Word)
 * - Intelligent chunk size selection with 6-tier fallback strategy
 * - Context-preserving chunking (respects paragraphs, sentences, phrases)
 * - Configurable overlap between chunks for context continuity
 * - Automatic text normalization (line endings, whitespace, tabs)
 * - File size validation (10MB for .txt, 50MB for .docx)
 * - Metadata tracking for each chunk (source, index, length, timestamp)
 *
 * Chunking Strategy:
 * 1. Maximum: 25,000 chars (min 12,000) - Best for comprehensive context
 * 2. Large: 15,000 chars (min 8,000) - Good balance
 * 3. Medium: 8,000 chars (min 4,000) - Standard size
 * 4. Standard: 4,000 chars (min 2,000) - Safe default
 * 5. Small: 2,000 chars (min 1,000) - Conservative
 * 6. Fallback: 1,000 chars (min 500) - Last resort
 *
 * Boundary Priority (when splitting chunks):
 * 1. Paragraph breaks (\n\n) - Highest priority
 * 2. Sentence endings (. ! ?) - Maintain complete thoughts
 * 3. Clause boundaries (, ; :) - Preserve sub-sentences
 * 4. Line breaks (\n) - Visual separations
 * 5. Word boundaries (spaces) - Avoid word splitting
 * 6. Character position - Last resort
 *
 * Chunk Metadata:
 * - source_document_id: Original document UUID
 * - source_document_name: Original filename
 * - chunk_index: Sequential chunk number (0-based)
 * - chunk_length: Character count
 * - upload_source: 'manual' (UI) or 'api' (programmatic)
 * - upload_time: ISO 8601 timestamp
 * - category: Always 'uploaded_document'
 *
 * File Storage:
 * - Original files: uploads/[uuid]_[filename]
 * - Extracted text: uploads/[uuid]_extracted.txt
 * - Directory: custom-widget/backend/uploads/
 *
 * Validation Limits:
 * - Minimum text content: 10 characters
 * - Maximum chunk size for embeddings: ~32,000 chars (~8,000 tokens)
 * - File size limits: 10MB (.txt), 50MB (.docx)
 *
 * Notes:
 * - Chunks overlap by 100-500 chars to maintain context across boundaries
 * - mammoth warnings are logged but don't fail processing
 * - Empty or whitespace-only files are rejected
 * - Text normalization ensures consistent processing
 * - Fallback system ensures documents always get processed
 */
const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');
const logger = createLogger('documentService');

class DocumentService {
    constructor() {
        this.uploadDir = process.env.UPLOADS_DIR
            ? path.resolve(process.env.UPLOADS_DIR)
            : path.join(__dirname, '../../uploads');
        this.ensureUploadDirectory();
    }

    /**
     * Ensure upload directory exists
     */
    async ensureUploadDirectory() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
        } catch (error) {
            logger.error('Failed to create upload directory:', error);
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
                    logger.warn('Word document processing warnings:', result.messages);
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

            // Chunk the text with intelligent fallback
            const chunkingResult = await this.chunkTextWithFallback(extractedText, documentInfo);
            const chunks = chunkingResult.chunks;

            logger.info(`Processed file: ${file.originalname} -> ${chunks.length} chunks using ${chunkingResult.strategy} strategy`);
            logger.info(`Average chunk size: ${chunkingResult.avgChunkSize} characters`);

            return {
                document: documentInfo,
                text: extractedText,
                chunks: chunks,
                chunkingStrategy: chunkingResult.strategy
            };
            
        } catch (error) {
            logger.error('Failed to process file:', error);
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
    chunkText(text, documentInfo, chunkSize = 25000, minChunkSize = 12000, overlap = 500) {
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
        // Essential metadata for Chroma (staying under 16-key limit)
        const chunkMetadata = {
            source_document_id: documentInfo.id,
            source_document_name: documentInfo.originalName || 'Document',
            chunk_index: chunkIndex,
            chunk_length: text.length,
            upload_source: documentInfo.uploadSource || 'api',
            upload_time: documentInfo.uploadTime ? documentInfo.uploadTime.toISOString() : new Date().toISOString(),
            category: 'uploaded_document'
        };

        // Selectively add important metadata from document (avoiding quota exceeded)
        if (documentInfo.metadata) {
            // Only include the most important additional metadata fields
            const importantFields = ['source_url', 'language', 'content_type'];
            
            importantFields.forEach(field => {
                if (documentInfo.metadata[field] !== undefined && documentInfo.metadata[field] !== null) {
                    chunkMetadata[field] = documentInfo.metadata[field];
                }
            });
        }

        return {
            id: `${documentInfo.id}_chunk_${chunkIndex}`,
            content: text,
            metadata: chunkMetadata
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
     * Intelligent chunking with fallback protection
     * Tries maximum chunk sizes first, falls back to smaller sizes if embedding fails
     * @param {string} text - Text to chunk
     * @param {Object} documentInfo - Document metadata
     * @param {string} skipStrategy - Strategy name to skip (for re-chunking)
     */
    async chunkTextWithFallback(text, documentInfo, skipStrategy = null) {
        // Define chunk size strategies from largest to smallest
        const chunkingStrategies = [
            { size: 25000, minSize: 12000, overlap: 500, name: 'Maximum' },
            { size: 15000, minSize: 8000, overlap: 400, name: 'Large' },
            { size: 8000, minSize: 4000, overlap: 300, name: 'Medium' },
            { size: 4000, minSize: 2000, overlap: 200, name: 'Standard' },
            { size: 2000, minSize: 1000, overlap: 100, name: 'Small' },
            { size: 1000, minSize: 500, overlap: 50, name: 'Fallback' }
        ];

        // Filter strategies to skip the failed one when re-chunking
        let availableStrategies = chunkingStrategies;
        if (skipStrategy) {
            const skipIndex = chunkingStrategies.findIndex(s => s.name === skipStrategy);
            if (skipIndex !== -1) {
                availableStrategies = chunkingStrategies.slice(skipIndex + 1);
                logger.info(`⏭️ Skipping ${skipStrategy} strategy and all larger ones, trying smaller strategies...`);
            }
        }

        if (availableStrategies.length === 0) {
            throw new Error('No chunking strategies available (all were skipped)');
        }

        for (const strategy of availableStrategies) {
            try {
                logger.info(`🔄 Trying ${strategy.name} chunking (${strategy.size} chars)...`);
                
                // Create chunks with current strategy
                const chunks = this.chunkText(text, documentInfo, strategy.size, strategy.minSize, strategy.overlap);
                
                logger.info(`✅ ${strategy.name} chunking successful: ${chunks.length} chunks created`);
                logger.info(`📊 Chunk sizes: ${chunks.map(c => c.content.length).join(', ')} characters`);
                
                return {
                    chunks: chunks,
                    strategy: strategy.name,
                    chunkCount: chunks.length,
                    avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length)
                };

            } catch (error) {
                logger.warn(`⚠️ ${strategy.name} chunking failed: ${error.message}`);
                
                // If this is the last available strategy, throw the error
                if (strategy === availableStrategies[availableStrategies.length - 1]) {
                    throw new Error(`All available chunking strategies failed. Last error: ${error.message}`);
                }
                
                // Continue to next strategy
                continue;
            }
        }
    }

    /**
     * Validate chunk against embedding service limits
     * This can be called by embedding services to test if a chunk is too large
     */
    validateChunkForEmbedding(chunk) {
        const maxTokens = 8000; // Mistral embedding limit
        const avgCharsPerToken = 4;
        const maxChars = maxTokens * avgCharsPerToken; // ~32,000 characters
        
        if (chunk.content.length > maxChars) {
            throw new Error(`Chunk too large for embedding: ${chunk.content.length} chars (max: ${maxChars})`);
        }
        
        return true;
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

            logger.info(`Deleted ${documentFiles.length} files for document ${documentId}`);
            return true;
        } catch (error) {
            logger.error('Failed to delete document files:', error);
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
            logger.error('Failed to get file info:', error);
            return [];
        }
    }
}

module.exports = new DocumentService();