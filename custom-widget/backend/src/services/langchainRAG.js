/**
 * LangChain RAG Service - REFACTORED WITH PROPER LANGCHAIN PATTERNS
 * 
 * This is a complete refactor of the original langchainRAG.js that uses
 * proper LangChain patterns and chains while maintaining 100% API compatibility.
 * 
 * Key Improvements:
 * - Proper LangChain chain composition instead of manual message construction
 * - Custom ChromaRetriever extending BaseRetriever
 * - QueryRephraseChain using LLMChain
 * - VilniusRAGChain orchestrating the full RAG process
 * - Centralized prompt templates
 * - Better error handling and debug information
 * - Maintains exact same API: getAnswer(query, chatHistory, includeDebug)
 * 
 * @author AI Assistant System (Refactored)
 * @version 2.0.0 - LangChain Patterns
 */

const VilniusRAGChain = require('./chains/VilniusRAGChain');
const ChromaRetriever = require('./chains/ChromaRetriever');
const QueryRephraseChain = require('./chains/QueryRephraseChain');

class LangChainRAG {
    constructor() {
        // Initialize the main RAG chain with all components
        this.ragChain = new VilniusRAGChain({
            k: parseInt(process.env.RAG_K) || 3,
            enableRephrasing: process.env.ENABLE_QUERY_REPHRASING !== 'false',
            showSources: process.env.RAG_SHOW_SOURCES !== 'false',
            includeDebug: true,
            verbose: process.env.NODE_ENV === 'development',
            timeout: 60000
        });

        // Keep reference to individual components for advanced usage
        this.retriever = this.ragChain.retriever;
        this.rephraseChain = this.ragChain.rephraseChain;

        console.log('✅ LangChain RAG Service initialized with proper chains');
        console.log(`   - Retrieval K: ${this.ragChain.retriever.k}`);
        console.log(`   - Query rephrasing: ${this.ragChain.enableRephrasing ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   - Source attribution: ${this.ragChain.showSources ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Main method - maintains exact same API as original
     * 
     * @param {string} query - User question
     * @param {Array} chatHistory - Conversation history as [user, assistant] pairs
     * @param {boolean} includeDebug - Whether to include debug information
     * @returns {Object} Answer with sources and debug info (same format as original)
     */
    async getAnswer(query, chatHistory = [], includeDebug = true) {
        const startTime = Date.now();

        try {
            // Validate inputs
            if (!query || typeof query !== 'string') {
                throw new Error('Query must be a non-empty string');
            }

            if (!Array.isArray(chatHistory)) {
                console.warn('Chat history is not an array, converting to empty array');
                chatHistory = [];
            }

            // Set debug flag on the chain
            this.ragChain.includeDebug = includeDebug;

            if (this.ragChain.verbose) {
                console.log('🔍 LangChainRAG: Processing request');
                console.log(`   Query: "${query}"`);
                console.log(`   History length: ${chatHistory.length}`);
                console.log(`   Include debug: ${includeDebug}`);
            }

            // Generate session ID for tracing grouping
            const sessionId = this.generateSessionId(query, chatHistory);
            
            // Update chain configuration with session context
            this.ragChain.langfuseHandler.sessionId = sessionId;
            this.ragChain.rephraseChain.langfuseHandler.sessionId = sessionId;

            // Call the main RAG chain
            const result = await this.ragChain._call({
                question: query,
                chat_history: chatHistory
            });

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Add processing time to debug info if available
            if (result.debugInfo) {
                result.debugInfo.totalProcessingTime = processingTime;
                result.debugInfo.refactoredVersion = '2.0.0';
                result.debugInfo.langchainPatterns = true;
            }

            if (this.ragChain.verbose) {
                console.log(`✅ LangChainRAG: Request completed in ${processingTime}ms`);
                console.log(`   Answer length: ${result.answer?.length || 0} characters`);
                console.log(`   Sources: ${result.sources?.length || 0}`);
                console.log(`   Contexts used: ${result.contextsUsed || 0}`);
            }

            // Return in exact same format as original
            return {
                answer: result.answer,
                contextsUsed: result.contextsUsed || 0,
                sources: result.sources || [],
                sourceUrls: result.sourceUrls || [],
                debugInfo: includeDebug ? result.debugInfo : undefined
            };

        } catch (error) {
            const endTime = Date.now();
            const processingTime = endTime - startTime;

            console.error('🔴 LangChainRAG Error:', error);
            console.error('🔴 Stack trace:', error.stack);

            // Create comprehensive error debug info
            const errorDebugInfo = {
                timestamp: new Date().toISOString(),
                error: {
                    message: error.message,
                    stack: error.stack,
                    type: error.constructor.name
                },
                input: {
                    query: query,
                    historyLength: chatHistory?.length || 0
                },
                processingTime: processingTime,
                refactoredVersion: '2.0.0',
                langchainPatterns: true,
                step: 'langchain_rag_error_handling'
            };

            // Return error in same format as original
            return {
                answer: 'Atsiprašau, įvyko klaida apdorojant užklausą.',
                contextsUsed: 0,
                sources: [],
                sourceUrls: [],
                debugInfo: includeDebug ? errorDebugInfo : undefined
            };
        }
    }

    /**
     * Health check method for the entire RAG system
     */
    async healthCheck() {
        try {
            return await this.ragChain.healthCheck();
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                lastCheck: new Date().toISOString()
            };
        }
    }

    /**
     * Get configuration information
     */
    getConfig() {
        return this.ragChain.getConfig();
    }

    /**
     * Update configuration
     */
    updateConfig(config) {
        this.ragChain.updateConfig(config);
        return this;
    }

    /**
     * Get retriever statistics
     */
    async getRetrieverStats() {
        try {
            return await this.retriever.getStats();
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Test individual components
     */
    async testComponents() {
        const results = {
            timestamp: new Date().toISOString()
        };

        try {
            // Test retriever
            results.retriever = {
                healthy: await this.retriever.healthCheck(),
                stats: await this.retriever.getStats()
            };
        } catch (error) {
            results.retriever = { error: error.message };
        }

        try {
            // Test rephrase chain
            results.rephraseChain = await this.rephraseChain.healthCheck();
        } catch (error) {
            results.rephraseChain = { error: error.message };
        }

        try {
            // Test full chain
            results.fullChain = await this.ragChain.healthCheck();
        } catch (error) {
            results.fullChain = { error: error.message };
        }

        return results;
    }

    /**
     * Legacy method compatibility - kept for reference but uses new implementation
     */
    async formatContextAsMarkdown(contexts) {
        const { formatContextAsMarkdown } = require('./chains/VilniusPrompts');
        return formatContextAsMarkdown(contexts);
    }

    /**
     * Legacy method compatibility - uses new conversation parsing
     */
    convertToLangChainMessages(chatHistory, currentQuery) {
        console.log('⚠️ Legacy convertToLangChainMessages called - now handled internally by chains');
        return [];
    }

    /**
     * Legacy method compatibility - uses new implementation
     */
    buildComprehensiveUserMessage(currentQuery, chatHistory, context) {
        console.log('⚠️ Legacy buildComprehensiveUserMessage called - now handled by prompt templates');
        return currentQuery;
    }

    /**
     * Legacy method compatibility - uses new implementation
     */
    extractChunkInfo(metadata) {
        const { extractChunkInfo } = require('./chains/VilniusPrompts');
        return extractChunkInfo(metadata);
    }

    /**
     * Generate session ID for Langfuse tracing
     * This groups related queries together for better observability
     */
    generateSessionId(query, chatHistory) {
        const timestamp = Date.now();
        const queryHash = this.hashString(query.substring(0, 20));
        const historyLength = chatHistory.length;
        
        return `vilnius-rag-${queryHash}-${historyLength}-${timestamp}`;
    }

    /**
     * Simple hash function for generating session IDs
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Cleanup method to flush Langfuse events
     * Important for serverless/short-lived environments
     */
    async shutdown() {
        try {
            await this.ragChain.langfuseHandler.shutdownAsync();
            await this.ragChain.rephraseChain.langfuseHandler.shutdownAsync();
            console.log('✅ Langfuse handlers shutdown completed');
        } catch (error) {
            console.error('❌ Error during Langfuse shutdown:', error);
        }
    }
}

module.exports = LangChainRAG;