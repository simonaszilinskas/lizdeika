/**
 * Knowledge Service
 * Manages sample Vilnius knowledge data
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
     * Initialize the knowledge base with sample data (only for OpenRouter)
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

            console.log('Loading sample Vilnius data...');
            const success = await chromaService.addDocuments(SAMPLE_VILNIUS_DATA);
            
            if (success) {
                const stats = await chromaService.getStats();
                console.log('External RAG knowledge base initialized:', stats);
                return true;
            } else {
                console.error('Failed to load sample data');
                return false;
            }
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
     * Reset knowledge base with fresh sample data
     */
    async resetSampleData() {
        try {
            await chromaService.clearAll();
            return await this.initializeSampleData();
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