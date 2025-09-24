/**
 * Chroma DB Service - Vector Database Operations
 * 
 * This service manages the connection and operations with Chroma DB Cloud,
 * a hosted vector database service used for semantic search in the RAG system.
 * 
 * Key Features:
 * - Chroma DB Cloud client connection and authentication
 * - Vector collection management with HNSW indexing
 * - Document embedding, storage, and retrieval operations
 * - Mistral embeddings integration (1024-dimensional vectors)
 * - Batch operations for efficient document processing
 * - Similarity search with configurable k parameter
 * 
 * Dependencies:
 * - chromadb - Official Chroma DB client library
 * - mistralEmbeddingFunction - Custom Mistral AI embedding provider
 * - Chroma DB Cloud - Hosted vector database service
 * 
 * Environment Variables:
 * - CHROMA_URL - Chroma DB Cloud endpoint URL
 * - CHROMA_TENANT - Tenant identifier for multi-tenancy
 * - CHROMA_DATABASE - Database name within tenant
 * - CHROMA_AUTH_TOKEN - Authentication token for cloud access
 * - MISTRAL_API_KEY - API key for Mistral embedding service
 * 
 * Collection Configuration:
 * - Name: 'vilnius-knowledge-base-mistral-1024'
 * - Embedding: Mistral-embed model (1024 dimensions)
 * - Distance: Cosine similarity
 * - Index: HNSW (ef_construction=200, ef_search=100)
 * 
 * @author AI Assistant System
 * @version 1.0.0
 */
const { CloudClient } = require("chromadb");
const MistralEmbeddingFunction = require('./mistralEmbeddingFunction');

class ChromaService {
    constructor() {
        this.client = null;
        this.collection = null;
        this.collectionName = 'vilnius-test-collection-2025';
        this.isConnected = false;
        this.embeddingFunction = null;
    }

    /**
     * Initialize connection to Chroma Cloud with Mistral embeddings
     */
    async initialize() {
        try {
            this.client = new CloudClient({
                url: "https://api.trychroma.com",
                apiKey: process.env.CHROMA_AUTH_TOKEN,
                tenant: process.env.CHROMA_TENANT,
                database: process.env.CHROMA_DATABASE
            });

            // Initialize Mistral embedding function
            try {
                this.embeddingFunction = new MistralEmbeddingFunction();
            } catch (error) {
                console.warn('Mistral embeddings not available, falling back to default:', error.message);
                this.embeddingFunction = null;
            }

            // Collection configuration with optimized HNSW settings
            const collectionConfig = {
                name: this.collectionName,
                configuration: {
                    hnsw: {
                        space: "cosine",        // Best for text embeddings
                        ef_construction: 200,   // Higher quality index
                        ef_search: 100,         // Better recall
                        max_neighbors: 32       // Denser graph for better accuracy
                    }
                }
            };

            // Add embedding function if Mistral is available
            if (this.embeddingFunction) {
                // For Chroma, we need to use their embedding function format
                // Since Mistral isn't built-in, we'll handle embeddings manually
                console.log('Using Mistral embeddings with manual embedding generation');
            }

            // Get or create collection
            this.collection = await this.client.getOrCreateCollection(collectionConfig);

            this.isConnected = true;
            console.log(`Connected to Chroma Cloud - Collection: ${this.collectionName}`);
            console.log(`Embedding function: ${this.embeddingFunction ? 'Mistral-embed' : 'Default'}`);
            console.log(`HNSW configuration: cosine similarity, ef_construction=200, ef_search=100`);
            
            return true;
        } catch (error) {
            console.error('Failed to initialize Chroma DB:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Add documents to the knowledge base with Mistral embeddings
     */
    async addDocuments(documents) {
        if (!this.isConnected || !this.collection) {
            throw new Error('Chroma DB not connected');
        }

        try {
            const ids = documents.map(doc => doc.id);
            const texts = documents.map(doc => doc.content);
            const metadatas = documents.map(doc => doc.metadata || {});

            let embeddings = null;

            // Generate Mistral embeddings if available
            if (this.embeddingFunction) {
                try {
                    embeddings = await this.embeddingFunction.generate(texts);
                    console.log(`Generated ${embeddings.length} Mistral embeddings`);
                } catch (error) {
                    console.warn('Failed to generate Mistral embeddings:', error.message);
                    
                    // If error is about chunk size, propagate it to trigger re-chunking
                    if (error.message.includes('too large') || error.message.includes('32,000') || error.message.includes('8000 tokens')) {
                        throw new Error(`Chunk size error for re-chunking: ${error.message}`);
                    }
                    
                    // For other errors, continue with default embeddings
                    console.warn('Using default embeddings instead');
                    embeddings = null;
                }
            }

            // Upsert with or without custom embeddings
            const upsertData = {
                ids: ids,
                documents: texts,
                metadatas: metadatas
            };

            if (embeddings) {
                upsertData.embeddings = embeddings;
            }

            await this.collection.upsert(upsertData);

            const embeddingType = embeddings ? 'Mistral' : 'default';
            console.log(`Added ${documents.length} documents to knowledge base with ${embeddingType} embeddings`);
            return true;
        } catch (error) {
            console.error('Failed to add documents:', error);
            
            // If it's a chunk size error, re-throw to trigger re-chunking
            if (error.message.includes('Chunk size error for re-chunking')) {
                throw error;
            }
            
            return false;
        }
    }

    /**
     * Search for relevant context based on query with Mistral embeddings
     */
    async searchContext(query, nResults = 3) {
        if (!this.isConnected || !this.collection) {
            console.warn('🔍 ChromaDB not connected, returning empty context');
            return [];
        }

        try {
            console.log(`\n🔍 ChromaDB Vector Search Query:`);
            console.log(`  • Original Query: "${query}"`);
            console.log(`  • Requested Results: ${nResults}`);
            console.log(`  • Collection: ${this.collectionName}`);

            let queryData = {
                queryTexts: [query],
                nResults: nResults,
            };

            // Generate Mistral embedding for query if available
            if (this.embeddingFunction) {
                try {
                    const embeddingStartTime = performance.now();
                    const queryEmbeddings = await this.embeddingFunction.generate([query]);
                    const embeddingTime = performance.now() - embeddingStartTime;

                    queryData = {
                        queryEmbeddings: queryEmbeddings,
                        nResults: nResults,
                    };

                    console.log(`  • Embedding Generation:`);
                    console.log(`    - Provider: Mistral AI`);
                    console.log(`    - Model: mistral-embed`);
                    console.log(`    - Dimensions: ${queryEmbeddings[0].length}`);
                    console.log(`    - Generation Time: ${embeddingTime.toFixed(2)}ms`);
                    console.log(`    - First 5 Vector Values: [${queryEmbeddings[0].slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
                } catch (error) {
                    console.warn('⚠️ Failed to generate Mistral query embedding, using text search:', error.message);
                    // Keep original queryTexts approach
                }
            } else {
                console.log(`  • Embedding: Using ChromaDB default embeddings`);
            }

            console.log(`  • Executing ChromaDB Query...`);
            const searchStartTime = performance.now();
            const results = await this.collection.query(queryData);
            const searchTime = performance.now() - searchStartTime;

            console.log(`\n📊 ChromaDB Search Results (${searchTime.toFixed(2)}ms):`);
            console.log(`  • Total Documents Found: ${results.documents && results.documents[0] ? results.documents[0].length : 0}`);

            // Format results for easier use
            const contexts = [];
            if (results.documents && results.documents[0]) {
                for (let i = 0; i < results.documents[0].length; i++) {
                    const context = {
                        content: results.documents[0][i],
                        metadata: results.metadatas[0][i] || {},
                        distance: results.distances[0][i],
                        id: results.ids[0][i]
                    };
                    contexts.push(context);

                    console.log(`  • Document ${i + 1}:`);
                    console.log(`    - ID: ${context.id}`);
                    console.log(`    - Similarity Score: ${(1 - context.distance).toFixed(4)} (distance: ${context.distance.toFixed(4)})`);
                    console.log(`    - Content Preview: "${context.content.substring(0, 100)}..."`);
                    console.log(`    - Content Length: ${context.content.length} chars`);
                    if (context.metadata.source) {
                        console.log(`    - Source File: ${context.metadata.source}`);
                    }
                    if (context.metadata.page) {
                        console.log(`    - Page/Section: ${context.metadata.page}`);
                    }
                    if (context.metadata.chunk_index !== undefined) {
                        console.log(`    - Chunk Index: ${context.metadata.chunk_index}`);
                    }
                }
            }

            const embeddingType = queryData.queryEmbeddings ? 'Mistral' : 'default';
            console.log(`\n✅ ChromaDB search completed using ${embeddingType} embeddings`);
            console.log(`  • Query: "${query}"`);
            console.log(`  • Retrieved: ${contexts.length} document chunks`);
            console.log(`  • Total Processing Time: ${searchTime.toFixed(2)}ms\n`);

            return contexts;
        } catch (error) {
            console.error('❌ ChromaDB search failed:', error);
            console.error(`  • Query: "${query}"`);
            console.error(`  • Error Details: ${error.message}`);
            return [];
        }
    }

    /**
     * Get collection stats
     */
    async getStats() {
        if (!this.isConnected || !this.collection) {
            return { connected: false, count: 0 };
        }

        try {
            const count = await this.collection.count();
            return {
                connected: true,
                count: count,
                collectionName: this.collectionName
            };
        } catch (error) {
            console.error('Failed to get stats:', error);
            return { connected: false, count: 0, error: error.message };
        }
    }

    /**
     * Get all indexed documents from Chroma
     */
    async getAllDocuments(limit = 100) {
        if (!this.isConnected || !this.collection) {
            return { connected: false, documents: [] };
        }

        try {
            const results = await this.collection.get({
                limit: limit,
                include: ["documents", "metadatas", "embeddings"]
            });

            const documents = [];
            if (results.documents && results.documents.length > 0) {
                for (let i = 0; i < results.documents.length; i++) {
                    documents.push({
                        id: results.ids[i],
                        content: results.documents[i],
                        metadata: results.metadatas[i] || {},
                        hasEmbedding: results.embeddings && results.embeddings[i] ? true : false,
                        embeddingDimensions: results.embeddings && results.embeddings[i] ? results.embeddings[i].length : 0
                    });
                }
            }

            console.log(`Retrieved ${documents.length} indexed documents from Chroma`);
            return {
                connected: true,
                documents: documents,
                totalCount: results.ids ? results.ids.length : 0,
                collectionName: this.collectionName
            };
        } catch (error) {
            console.error('Failed to get all documents:', error);
            return { connected: false, documents: [], error: error.message };
        }
    }

    /**
     * Clear all data (for testing)
     */
    async clearAll() {
        if (!this.isConnected || !this.collection) {
            return false;
        }

        try {
            // Delete and recreate collection
            await this.client.deleteCollection({ name: this.collectionName });
            this.collection = await this.client.createCollection({
                name: this.collectionName,
            });
            console.log('Cleared all data from knowledge base');
            return true;
        } catch (error) {
            console.error('Failed to clear data:', error);
            return false;
        }
    }
}

module.exports = new ChromaService();