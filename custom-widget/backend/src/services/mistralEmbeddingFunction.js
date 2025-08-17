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
            
            // Validate text size before sending to Mistral
            this.validateTextsForEmbedding(texts);
            
            const response = await this.client.embeddings.create({
                model: this.model,
                inputs: texts,
            });

            const embeddings = response.data.map(item => item.embedding);
            
            console.log(`Generated ${embeddings.length} embeddings (dimension: ${embeddings[0].length})`);
            return embeddings;
            
        } catch (error) {
            console.error('Failed to generate Mistral embeddings:', error.message);
            
            // If error is about token limit, provide helpful message
            if (error.message.includes('token') || error.message.includes('length') || error.message.includes('limit')) {
                throw new Error(`Text too large for Mistral embeddings. Maximum ~8000 tokens (~32,000 characters) per text. Error: ${error.message}`);
            }
            
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

    /**
     * Validate texts for embedding generation
     * Ensures texts don't exceed Mistral's token limits
     */
    validateTextsForEmbedding(texts) {
        const maxTokens = 8000; // Mistral embedding limit
        const avgCharsPerToken = 4; // Conservative estimate
        const maxChars = maxTokens * avgCharsPerToken; // ~32,000 characters
        
        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            if (text.length > maxChars) {
                throw new Error(`Text ${i + 1} too large for embedding: ${text.length} chars (max: ${maxChars}). Use smaller chunks.`);
            }
        }
        
        console.log(`✅ All ${texts.length} texts validated for Mistral embedding (max length: ${Math.max(...texts.map(t => t.length))} chars)`);
    }
}

module.exports = MistralEmbeddingFunction;