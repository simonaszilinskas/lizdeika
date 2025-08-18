/**
 * Knowledge Service - Document Management and Semantic Search
 * 
 * This service provides the interface between the RAG system and the vector database,
 * managing document storage, retrieval, and semantic search for the Vilnius assistant.
 * 
 * Key Features:
 * - Document upload and text extraction (.txt, .docx support)
 * - Semantic search using Mistral embeddings (1024-dimensional vectors)
 * - Integration with Chroma DB Cloud vector database
 * - Sample Vilnius city data initialization and management
 * - Context retrieval for RAG-enhanced responses
 * 
 * Dependencies:
 * - chromaService - Vector database operations and embedding management
 * - Chroma DB Cloud - Hosted vector database service
 * - Mistral embeddings - Text-to-vector conversion
 * 
 * Configuration:
 * - Uses 'vilnius-knowledge-base-mistral-1024' collection
 * - HNSW indexing with cosine similarity
 * - Default k=3 for similarity search results
 * 
 * @author AI Assistant System
 * @version 1.0.0
 */
const chromaService = require('./chromaService');

// Sample data for technical testing (empty by default - no test data loaded)
// Note: Metadata values must be string, number, boolean, or null (no nested objects/arrays)
const SAMPLE_VILNIUS_DATA = [];

class KnowledgeService {
    /**
     * Initialize the knowledge base connection (sample data loading skipped to avoid automatic embeddings)
     */
    async initializeSampleData() {
        const currentProvider = process.env.AI_PROVIDER || 'flowise';
        
        if (currentProvider === 'flowise') {
            console.log('Flowise provider detected: Skipping external RAG initialization (using built-in RAG)');
            return true;
        }

        try {
            console.log(`${currentProvider} provider: Initializing external RAG knowledge base...`);
            const connected = await chromaService.initialize();
            
            if (!connected) {
                console.error('Failed to connect to Chroma DB');
                return false;
            }

            // Skip loading sample data on startup to avoid automatic embedding generation
            console.log('External RAG knowledge base connection established (sample data loading skipped)');
            const stats = await chromaService.getStats();
            console.log('External RAG knowledge base ready:', stats);
            return true;
            
        } catch (error) {
            console.error('Error initializing external RAG knowledge base:', error);
            return false;
        }
    }

    /**
     * Get knowledge base statistics
     */
    async getStats() {
        return await chromaService.getStats();
    }

    /**
     * Search for relevant context
     */
    async searchContext(query, nResults = 2) {
        return await chromaService.searchContext(query, nResults);
    }

    /**
     * Get all indexed documents from Chroma vector database
     */
    async getAllIndexedDocuments(limit = 100) {
        const currentProvider = process.env.AI_PROVIDER || 'flowise';
        
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
     * Manually load sample data to knowledge base (for testing purposes)
     */
    async loadSampleData() {
        const currentProvider = process.env.AI_PROVIDER || 'flowise';
        
        if (currentProvider === 'flowise') {
            console.log('Flowise provider: Sample data not needed (using built-in RAG)');
            return true;
        }

        try {
            console.log('Loading sample Vilnius data...');
            const success = await chromaService.addDocuments(SAMPLE_VILNIUS_DATA);
            
            if (success) {
                const stats = await chromaService.getStats();
                console.log('Sample data loaded successfully:', stats);
                return true;
            } else {
                console.error('Failed to load sample data');
                return false;
            }
        } catch (error) {
            console.error('Error loading sample data:', error);
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
            console.error('Error resetting sample data:', error);
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