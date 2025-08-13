/**
 * Mistral Embedding Function for Chroma DB
 * Uses Mistral AI's embedding API to generate high-quality embeddings
 */
const { Mistral } = require('@mistralai/mistralai');

class MistralEmbeddingFunction {
    constructor(apiKey, model = 'mistral-embed') {
        this.apiKey = apiKey || process.env.MISTRAL_API_KEY;
        this.model = model;
        
        if (!this.apiKey) {
            throw new Error('Mistral API key is required. Set MISTRAL_API_KEY environment variable or pass apiKey parameter.');
        }
        
        this.client = new Mistral({ apiKey: this.apiKey });
        console.log(`Initialized Mistral embedding function with model: ${this.model}`);
    }

    /**
     * Generate embeddings for given texts
     */
    async generate(texts) {
        try {
            console.log(`Generating embeddings for ${texts.length} texts using Mistral ${this.model}`);
            
            const response = await this.client.embeddings.create({
                model: this.model,
                inputs: texts,
            });

            const embeddings = response.data.map(item => item.embedding);
            
            console.log(`Generated ${embeddings.length} embeddings (dimension: ${embeddings[0].length})`);
            return embeddings;
            
        } catch (error) {
            console.error('Failed to generate Mistral embeddings:', error.message);
            throw error;
        }
    }

    /**
     * Get embedding dimension (Mistral-embed produces 1024-dimensional embeddings)
     */
    getDimension() {
        return 1024;
    }

    /**
     * Get model name
     */
    getModel() {
        return this.model;
    }
}

module.exports = MistralEmbeddingFunction;