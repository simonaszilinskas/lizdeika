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

// Minimal sample data for technical testing
// Note: Metadata values must be string, number, boolean, or null (no nested objects/arrays)
const SAMPLE_VILNIUS_DATA = [
    {
        id: "oldtown_001",
        content: "Vilnius Old Town is one of the largest surviving medieval old towns in Northern Europe. It was declared a UNESCO World Heritage Site in 1994. The old town features narrow cobblestone streets, Gothic, Renaissance, Baroque and Classical architecture.",
        metadata: {
            category: "tourism",
            type: "attraction",
            location: "Old Town",
            unesco: true
        }
    },
    {
        id: "transport_001",
        content: "Vilnius public transport includes buses and trolleys operated by Vilniaus viešasis transportas. A single ticket costs €1.00, and a day pass costs €3.00. You can buy tickets using mobile app, at kiosks, or from the driver.",
        metadata: {
            category: "transport",
            type: "public_transport",
            price_single: 1.00,
            price_day: 3.00
        }
    },
    {
        id: "food_001",
        content: "Cepelinai is the national dish of Lithuania - large potato dumplings stuffed with meat, served with sour cream and bacon bits. You can try authentic cepelinai at restaurants like Etno Dvaras or Lokys in Vilnius Old Town.",
        metadata: {
            category: "food",
            type: "traditional_dish",
            dish: "cepelinai",
            restaurants: "Etno Dvaras, Lokys"
        }
    },
    {
        id: "practical_001",
        content: "Emergency numbers in Lithuania: Police - 102, Fire Department - 101, Ambulance - 103, General Emergency - 112. These numbers work from any phone and are free to call.",
        metadata: {
            category: "practical",
            type: "emergency",
            police: "102",
            fire: "101",
            ambulance: "103",
            general: "112"
        }
    },
    {
        id: "culture_001",
        content: "Gediminas Tower is the symbol of Vilnius, located on Castle Hill. It's all that remains of the Upper Castle built in the 13th-14th centuries. The tower houses a museum and offers panoramic views of the city. Entry costs €5 for adults.",
        metadata: {
            category: "tourism",
            type: "historical_site",
            location: "Castle Hill",
            price: 5.00,
            museum: true
        }
    }
];

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