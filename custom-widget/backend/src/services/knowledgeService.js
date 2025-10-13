/**
 * KNOWLEDGE SERVICE
 *
 * Main Purpose: Interface for RAG (Retrieval-Augmented Generation) knowledge base operations
 *
 * Key Responsibilities:
 * - Document Management: Upload, store, and organize knowledge base documents
 * - Semantic Search: Find relevant context using vector similarity search
 * - Provider Coordination: Route between Flowise built-in RAG and external ChromaDB
 * - Context Retrieval: Provide document chunks for AI response enhancement
 * - Statistics Reporting: Track knowledge base size and usage
 *
 * Dependencies:
 * - ChromaService for external vector database operations
 * - SettingsService for AI provider configuration
 * - Mistral API for text embedding generation (1024-dimensional vectors)
 * - ChromaDB Cloud for hosted vector storage
 *
 * Features:
 * - Dual RAG mode support (Flowise built-in vs external ChromaDB)
 * - Document format support: .txt, .docx with text extraction
 * - Vector similarity search using cosine distance
 * - HNSW indexing for fast nearest neighbor search
 * - Metadata filtering and document organization
 * - Manual and automatic knowledge base initialization
 *
 * AI Provider Modes:
 * - Flowise: Uses built-in RAG, skips external vector DB setup
 * - OpenRouter/Other: Uses external ChromaDB with Mistral embeddings
 *
 * Vector Database Configuration:
 * - Collection: 'vilnius-knowledge-base-mistral-1024'
 * - Embedding Model: Mistral embeddings (1024 dimensions)
 * - Index Type: HNSW (Hierarchical Navigable Small World)
 * - Distance Metric: Cosine similarity
 * - Default k (results per query): 2-3 chunks
 *
 * Document Metadata Schema:
 * - All values must be string, number, boolean, or null
 * - No nested objects or arrays (ChromaDB limitation)
 * - Common fields: source, category, timestamp, author
 *
 * Notes:
 * - Sample data loading is skipped on startup to avoid automatic embeddings
 * - Provider detection is dynamic based on database settings
 * - External RAG is only initialized for non-Flowise providers
 * - Statistics include document count, embedding count, collection info
 */
const chromaService = require('./chromaService');
const SettingsService = require('./settingsService');
const { createLogger } = require('../utils/logger');
const logger = createLogger('knowledgeService');

// Sample data for technical testing (empty by default - no test data loaded)
// Note: Metadata values must be string, number, boolean, or null (no nested objects/arrays)
const SAMPLE_VILNIUS_DATA = [];

class KnowledgeService {
    /**
     * Get current AI provider from database settings with fallback
     *
     * @private
     * @returns {Promise<string>} AI provider name ('flowise', 'openrouter', etc.)
     */
    async _getAIProvider() {
        try {
            const settingsService = new SettingsService();
            await new Promise((resolve) => {
                settingsService.once('initialized', resolve);
                setTimeout(resolve, 1000); // fallback timeout
            });

            const aiConfig = await settingsService.getAIProviderConfig();
            return aiConfig.AI_PROVIDER || 'flowise';
        } catch (error) {
            logger.info('Warning: Could not load AI provider from database, using fallback:', error.message);
            return process.env.AI_PROVIDER || 'flowise';
        }
    }

    /**
     * Initialize knowledge base connection
     *
     * Connects to external ChromaDB for non-Flowise providers.
     * Flowise providers skip this step as they use built-in RAG.
     * Sample data loading is skipped to avoid automatic embedding generation.
     *
     * @returns {Promise<boolean>} True if initialization successful, false otherwise
     */
    async initializeSampleData() {
        const currentProvider = await this._getAIProvider();

        if (currentProvider === 'flowise') {
            logger.info('Flowise provider detected: Skipping external RAG initialization (using built-in RAG)');
            return true;
        }

        try {
            logger.info(`${currentProvider} provider: Initializing external RAG knowledge base...`);
            const connected = await chromaService.initialize();
            
            if (!connected) {
                logger.error('Failed to connect to Chroma DB');
                return false;
            }

            // Skip loading sample data on startup to avoid automatic embedding generation
            logger.info('External RAG knowledge base connection established (sample data loading skipped)');
            const stats = await chromaService.getStats();
            logger.info('External RAG knowledge base ready:', stats);
            return true;
            
        } catch (error) {
            logger.error('Error initializing external RAG knowledge base:', error);
            return false;
        }
    }

    /**
     * Get knowledge base statistics
     *
     * @returns {Promise<Object>} Stats object with document count and collection info
     */
    async getStats() {
        return await chromaService.getStats();
    }

    /**
     * Search for relevant document context using semantic similarity
     *
     * @param {string} query - Search query text
     * @param {number} nResults - Number of results to return (default: 2)
     * @returns {Promise<Array>} Array of relevant document chunks with metadata
     */
    async searchContext(query, nResults = 2) {
        return await chromaService.searchContext(query, nResults);
    }

    /**
     * Retrieve all indexed documents from vector database
     *
     * For Flowise providers, returns empty array as they use built-in RAG.
     *
     * @param {number} limit - Maximum number of documents to retrieve (default: 100)
     * @returns {Promise<Object>} Object with connected status and documents array
     */
    async getAllIndexedDocuments(limit = 100) {
        const currentProvider = await this._getAIProvider();
        
        if (currentProvider === 'flowise') {
            return {
                connected: false,
                documents: [],
                note: 'Flowise uses built-in RAG - no external vector database to display'
            };
        }

        return await chromaService.getAllDocuments(limit);
    }

    /**
     * Manually load sample data to knowledge base
     *
     * For testing and demonstration purposes only.
     * Skipped for Flowise providers.
     *
     * @returns {Promise<boolean>} True if sample data loaded successfully
     */
    async loadSampleData() {
        const currentProvider = process.env.AI_PROVIDER || 'flowise';
        
        if (currentProvider === 'flowise') {
            logger.info('Flowise provider: Sample data not needed (using built-in RAG)');
            return true;
        }

        try {
            logger.info('Loading sample Vilnius data...');
            const success = await chromaService.addDocuments(SAMPLE_VILNIUS_DATA);
            
            if (success) {
                const stats = await chromaService.getStats();
                logger.info('Sample data loaded successfully:', stats);
                return true;
            } else {
                logger.error('Failed to load sample data');
                return false;
            }
        } catch (error) {
            logger.error('Error loading sample data:', error);
            return false;
        }
    }

    /**
     * Reset knowledge base with fresh sample data
     */
    async resetSampleData() {
        try {
            await chromaService.clearAll();
            return await this.loadSampleData();
        } catch (error) {
            logger.error('Error resetting sample data:', error);
            return false;
        }
    }

    /**
     * Get sample data for reference
     */
    getSampleData() {
        return SAMPLE_VILNIUS_DATA;
    }
}

module.exports = new KnowledgeService();