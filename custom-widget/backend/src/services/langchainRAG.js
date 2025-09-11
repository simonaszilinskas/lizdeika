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
const { Langfuse } = require("langfuse");

class LangChainRAG {
    constructor() {
        // Initialize settings service for dynamic configuration
        this.settingsService = null;
        this.initializeSettingsService();
        
        // Initialize the main RAG chain with all components
        this.ragChain = new VilniusRAGChain({
            k: parseInt(process.env.RAG_K) || 100,
            enableRephrasing: process.env.ENABLE_QUERY_REPHRASING !== 'false',
            showSources: process.env.RAG_SHOW_SOURCES !== 'false',
            includeDebug: true,
            verbose: process.env.NODE_ENV === 'development',
            timeout: 60000
        });

        // Keep reference to individual components for advanced usage
        this.retriever = this.ragChain.retriever;
        this.rephraseChain = this.ragChain.rephraseChain;

        // Initialize Langfuse client for scoring
        this.langfuse = new Langfuse({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
            debug: process.env.LANGFUSE_DEBUG === 'true'
        });

        console.log('✅ LangChain RAG Service initialized with proper chains');
        console.log(`   - Retrieval K: ${this.ragChain.retriever.k}`);
        console.log(`   - Query rephrasing: ${this.ragChain.enableRephrasing ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   - Source attribution: ${this.ragChain.showSources ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Initialize settings service for dynamic configuration
     */
    async initializeSettingsService() {
        try {
            const SettingsService = require('./settingsService');
            this.settingsService = new SettingsService();
            console.log('🎯 LangChain RAG: Settings service initialized for dynamic configuration');
        } catch (error) {
            console.warn('⚠️ LangChain RAG: Could not initialize settings service, using env defaults:', error.message);
        }
    }

    /**
     * Get current RAG settings from database or environment
     */
    async getCurrentSettings() {
        if (!this.settingsService) {
            return {
                rag_k: parseInt(process.env.RAG_K) || 100,
                rag_show_sources: process.env.RAG_SHOW_SOURCES !== 'false',
                rag_similarity_threshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7,
                rag_max_tokens: parseInt(process.env.RAG_MAX_TOKENS) || 2000,
                system_prompt: process.env.SYSTEM_PROMPT || ''
            };
        }

        try {
            return {
                rag_k: await this.settingsService.getSetting('rag_k', 'ai') || 100,
                rag_show_sources: await this.settingsService.getSetting('rag_show_sources', 'ai') !== false,
                rag_similarity_threshold: await this.settingsService.getSetting('rag_similarity_threshold', 'ai') || 0.7,
                rag_max_tokens: await this.settingsService.getSetting('rag_max_tokens', 'ai') || 2000,
                system_prompt: await this.settingsService.getSetting('system_prompt', 'ai') || ''
            };
        } catch (error) {
            console.warn('⚠️ LangChain RAG: Error getting settings from service, using defaults:', error.message);
            return {
                rag_k: 100,
                rag_show_sources: true,
                rag_similarity_threshold: 0.7,
                rag_max_tokens: 2000,
                system_prompt: ''
            };
        }
    }

    /**
     * Main method - maintains exact same API as original
     * 
     * @param {string} query - User question
     * @param {Array} chatHistory - Conversation history as [user, assistant] pairs
     * @param {boolean} includeDebug - Whether to include debug information
     * @returns {Object} Answer with sources and debug info (same format as original)
     */
    async getAnswer(query, chatHistory = [], includeDebug = true, conversationId = null) {
        const startTime = Date.now();

        try {
            // Get current settings from database
            const currentSettings = await this.getCurrentSettings();
            
            // Update RAG chain configuration with current settings
            if (this.ragChain.retriever) {
                this.ragChain.retriever.k = currentSettings.rag_k;
            }
            this.ragChain.showSources = currentSettings.rag_show_sources;
            
            console.log(`🔧 LangChain RAG: Using dynamic settings - K:${currentSettings.rag_k}, Sources:${currentSettings.rag_show_sources}`);
            
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
                console.log(`   Conversation ID: ${conversationId}`);
            }

            // Generate session ID for tracing grouping (use conversationId if available)
            const sessionId = this.generateSessionId(query, chatHistory, conversationId);
            
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
     * Generate session ID for Langfuse tracing
     * Uses conversationId for proper conversation-based session grouping
     */
    generateSessionId(query, chatHistory, conversationId) {
        // Always use conversationId when available for proper conversation continuity
        if (conversationId) {
            return `vilnius-conversation-${conversationId}`;
        }
        
        // Fallback: Use consistent hash based on first message only (no timestamp)
        // This ensures session continuity even without conversationId
        const firstMessage = chatHistory.length > 0 ? chatHistory[0][0] : query;
        const queryHash = this.hashString(firstMessage.substring(0, 50));
        
        return `vilnius-rag-session-${queryHash}`;
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
     * Send agent action score to Langfuse for observability
     * Tracks how agents use AI suggestions: "Send as is", "Edit", "From the start"
     */
    async scoreAgentAction(conversationId, suggestionAction, originalSuggestion = null) {
        try {
            // Don't score actions in autopilot mode - agents aren't involved
            const systemMode = await this.getSystemMode();
            if (systemMode === 'autopilot') {
                if (this.ragChain.verbose) {
                    console.log('🚫 Skipping agent action scoring - autopilot mode active');
                }
                return;
            }

            if (!conversationId || !suggestionAction) {
                console.warn('⚠️ Missing conversationId or suggestionAction for scoring');
                return;
            }

            const sessionId = `vilnius-conversation-${conversationId}`;
            
            // Map agent actions to user-friendly score names
            const scoreMapping = {
                'as-is': 'Send as is',
                'edited': 'Edit', 
                'from-scratch': 'From the start'
            };

            const scoreName = scoreMapping[suggestionAction] || suggestionAction;
            const scoreValue = this.getScoreValue(suggestionAction);

            if (this.ragChain.verbose) {
                console.log('📊 Scoring agent action:');
                console.log(`   Session: ${sessionId}`);
                console.log(`   Action: ${suggestionAction} → "${scoreName}"`);
                console.log(`   Score: ${scoreValue}`);
            }

            // Use the separate Langfuse client to send the categorical score
            await this.langfuse.score({
                name: scoreName,
                value: suggestionAction, // Use the original action as categorical value
                dataType: "CATEGORICAL",
                sessionId: sessionId,
                comment: `Agent action: ${suggestionAction}`,
                metadata: {
                    conversationId: conversationId,
                    suggestionAction: suggestionAction,
                    systemMode: systemMode,
                    timestamp: new Date().toISOString(),
                    originalSuggestionLength: originalSuggestion?.length || null,
                    numericScore: scoreValue // Keep numeric value in metadata for reference
                }
            });

            console.log(`✅ Agent action scored: ${scoreName} (${scoreValue}) for conversation ${conversationId}`);

        } catch (error) {
            console.error('❌ Error scoring agent action:', error);
            // Don't throw - scoring failures shouldn't break core functionality
        }
    }

    /**
     * Get system mode (needed to exclude scoring in autopilot)
     */
    async getSystemMode() {
        try {
            const agentService = require('./agentService');
            return await agentService.getSystemMode();
        } catch (error) {
            console.warn('Could not get system mode for scoring:', error.message);
            return 'hitl'; // Default to HITL mode
        }
    }

    /**
     * Map agent actions to numeric scores for Langfuse
     */
    getScoreValue(suggestionAction) {
        switch (suggestionAction) {
            case 'as-is': 
                return 1.0;    // Perfect - agent used suggestion as-is
            case 'edited': 
                return 0.7;    // Good - agent improved suggestion  
            case 'from-scratch': 
                return 0.3;    // Poor - agent wrote completely new response
            default: 
                return 0.5;    // Unknown action
        }
    }

    /**
     * Cleanup method to flush Langfuse events
     * Important for serverless/short-lived environments
     */
    async shutdown() {
        try {
            await this.ragChain.langfuseHandler.shutdownAsync();
            await this.ragChain.rephraseChain.langfuseHandler.shutdownAsync();
            await this.langfuse.shutdownAsync();
            console.log('✅ Langfuse handlers and client shutdown completed');
        } catch (error) {
            console.error('❌ Error during Langfuse shutdown:', error);
        }
    }
}

module.exports = LangChainRAG;