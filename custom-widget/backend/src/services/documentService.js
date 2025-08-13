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
     * Chunk text into smaller pieces for embeddings
     */
    chunkText(text, documentInfo, chunkSize = 1000, overlap = 200) {
        const chunks = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        let currentChunk = '';
        let chunkIndex = 0;

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim() + '.';
            
            // If adding this sentence would exceed chunk size, save current chunk
            if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
                chunks.push(this.createChunk(currentChunk.trim(), documentInfo, chunkIndex));
                
                // Start new chunk with overlap
                const words = currentChunk.split(' ');
                const overlapWords = Math.min(Math.floor(overlap / 5), words.length); // ~5 chars per word
                currentChunk = words.slice(-overlapWords).join(' ') + ' ' + sentence;
                chunkIndex++;
            } else {
                currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
            }
        }

        // Add final chunk if it has content
        if (currentChunk.trim().length > 0) {
            chunks.push(this.createChunk(currentChunk.trim(), documentInfo, chunkIndex));
        }

        // If no chunks were created (very short text), create one chunk
        if (chunks.length === 0 && text.trim().length > 0) {
            chunks.push(this.createChunk(text.trim(), documentInfo, 0));
        }

        return chunks;
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
                source_document_name: documentInfo.originalName,
                chunk_index: chunkIndex,
                chunk_length: text.length,
                document_type: documentInfo.fileType,
                upload_source: documentInfo.uploadSource,
                upload_time: documentInfo.uploadTime.toISOString(),
                category: 'uploaded_document'
            }
        };
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