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
const { createLogger } = require('../utils/logger');

const logger = createLogger('langchainRAG');

class LangChainRAG {
    constructor() {
        // Initialize settings service for dynamic configuration
        this.settingsService = null;
        this.ragChain = null;
        this.retriever = null;
        this.rephraseChain = null;
        this.initialized = false;
        this.initializationPromise = null;
        this.verbose = process.env.NODE_ENV === 'development';

        // Initialize asynchronously and retain promise for later awaiters
        this.initializationPromise = this.initializeAsync();

        // Initialize Langfuse client for scoring
        this.langfuse = null;
        if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
            this.langfuse = new Langfuse({
                publicKey: process.env.LANGFUSE_PUBLIC_KEY,
                secretKey: process.env.LANGFUSE_SECRET_KEY,
                baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
                debug: process.env.LANGFUSE_DEBUG === 'true'
            });
        } else {
            logger.info('Langfuse scoring disabled - missing credentials');
        }

    }

    /**
     * Initialize the service asynchronously
     */
    async initializeAsync() {
        try {
            // Load configuration first
            await this.loadConfiguration();

            // Get current AI provider config for initialization
            let providerConfig = {};
            if (this.settingsService) {
                try {
                    providerConfig = await this.settingsService.getAIProviderConfig();
                } catch (error) {
                    logger.warn('Could not load AI provider config for initialization', { error: error.message });
                }
            }

            // Now initialize the RAG chain with proper configuration
            this.ragChain = new VilniusRAGChain({
                k: parseInt(process.env.RAG_K) || 100,
                enableRephrasing: process.env.ENABLE_QUERY_REPHRASING !== 'false',
                showSources: process.env.RAG_SHOW_SOURCES !== 'false',
                includeDebug: true,
                verbose: this.verbose,
                timeout: 60000,
                rephrasingModel: process.env.REPHRASING_MODEL,
                providerConfig: providerConfig
            });

            // Keep reference to individual components for advanced usage
            this.retriever = this.ragChain.retriever;
            this.rephraseChain = this.ragChain.rephraseChain;

            // Keep chain verbosity aligned with service level
            this.verbose = Boolean(this.ragChain?.verbose) || this.verbose;

            // Set up event listeners for dynamic configuration updates
            this.setupEventListeners();

            this.initialized = true;

            logger.info('LangChain RAG Service initialized with proper chains', {
                retrievalK: this.ragChain.retriever.k,
                queryRephrasing: this.ragChain.enableRephrasing ? 'ENABLED' : 'DISABLED',
                sourceAttribution: this.ragChain.showSources ? 'ENABLED' : 'DISABLED',
                rephrasingModel: process.env.REPHRASING_MODEL,
                eventListeners: this.settingsService ? 'ENABLED' : 'DISABLED'
            });

        } catch (error) {
            logger.error('Failed to initialize LangChain RAG Service', { error: error.message, stack: error.stack });
        }
    }

    /**
     * Load configuration from settings service
     */
    async loadConfiguration() {
        try {
            const SettingsService = require('./settingsService');
            this.settingsService = new SettingsService();
            logger.info('Settings service initialized for dynamic configuration');

            // Load AI provider config and set all necessary environment variables
            const config = await this.settingsService.getAIProviderConfig();

            // Set all OpenRouter/AI environment variables needed by the chains
            if (config.REPHRASING_MODEL) {
                process.env.REPHRASING_MODEL = config.REPHRASING_MODEL;
                logger.info('Rephrasing model set', { model: config.REPHRASING_MODEL });
            }

            if (config.OPENROUTER_API_KEY) {
                process.env.OPENROUTER_API_KEY = config.OPENROUTER_API_KEY;
                logger.info('OpenRouter API key loaded from database');
            }

            if (config.OPENROUTER_MODEL) {
                process.env.OPENROUTER_MODEL = config.OPENROUTER_MODEL;
                logger.info('OpenRouter model set', { model: config.OPENROUTER_MODEL });
            }

            if (config.SITE_URL) {
                process.env.SITE_URL = config.SITE_URL;
            }

            if (config.SITE_NAME) {
                process.env.SITE_NAME = config.SITE_NAME;
            }
        } catch (error) {
            logger.warn('Could not initialize settings service, using env defaults', { error: error.message });
        }
    }

    /**
     * Set up event listeners for dynamic configuration updates
     */
    setupEventListeners() {
        if (!this.settingsService) {
            logger.warn('No settings service available, skipping event listeners');
            return;
        }

        // Listen for AI provider setting changes
        this.settingsService.on('settingChanged', async (event) => {
            const { key, value, category } = event;

            // Only react to AI provider configuration changes
            if (category === 'ai_providers') {
                logger.info('AI provider setting changed', { key, value });

                // Guard: ensure ragChain is initialized before updating
                if (!this.ragChain || !this.initialized) {
                    logger.warn('RAG chain not ready, skipping configuration update');
                    return;
                }

                // Reload and apply the entire provider configuration
                try {
                    await this.reloadConfiguration();
                } catch (error) {
                    logger.error('Failed to reload configuration after setting change', { error: error.message, stack: error.stack });
                }
            }
        });

        // Listen for bulk settings changes
        this.settingsService.on('settingsChanged', async (event) => {
            const { settings, category } = event;

            // Only react to AI provider configuration changes
            if (category === 'ai_providers') {
                logger.info('AI provider settings changed (bulk update)', { settingKeys: Object.keys(settings) });

                // Guard: ensure ragChain is initialized before updating
                if (!this.ragChain || !this.initialized) {
                    logger.warn('RAG chain not ready, skipping configuration update');
                    return;
                }

                // Reload and apply the entire provider configuration
                try {
                    await this.reloadConfiguration();
                } catch (error) {
                    logger.error('Failed to reload configuration after bulk setting change', { error: error.message, stack: error.stack });
                }
            }
        });

        // Listen for settings reset
        this.settingsService.on('settingsReset', async (event) => {
            const { category } = event;

            if (category === 'ai_providers') {
                logger.info('AI provider settings reset to defaults');

                // Guard: ensure ragChain is initialized before updating
                if (!this.ragChain || !this.initialized) {
                    logger.warn('RAG chain not ready, skipping configuration update');
                    return;
                }

                try {
                    await this.reloadConfiguration();
                } catch (error) {
                    logger.error('Failed to reload configuration after settings reset', { error: error.message, stack: error.stack });
                }
            }
        });

        logger.info('Event listeners set up for dynamic configuration updates');
    }

    /**
     * Get current RAG settings from database or environment
     */
    async getCurrentSettings() {
        if (!this.settingsService) {
            return {
                rag_k: parseInt(process.env.RAG_K) || 100,
                rag_similarity_threshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7,
                rag_max_tokens: parseInt(process.env.RAG_MAX_TOKENS) || 2000,
                system_prompt: process.env.SYSTEM_PROMPT || ''
            };
        }

        try {
            return {
                rag_k: await this.settingsService.getSetting('rag_k', 'ai') || 100,
                rag_similarity_threshold: await this.settingsService.getSetting('rag_similarity_threshold', 'ai') || 0.7,
                rag_max_tokens: await this.settingsService.getSetting('rag_max_tokens', 'ai') || 2000,
                system_prompt: await this.settingsService.getSetting('system_prompt', 'ai') || ''
            };
        } catch (error) {
            logger.warn('Error getting settings from service, using defaults', { error: error.message });
            return {
                rag_k: 100,
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

        // Wait for initialization to complete
        const ready = await this.waitForInitialization();
        if (!ready) {
            throw new Error('LangChain RAG service failed to initialize within timeout');
        }

        try {
            // Get current settings from database
            const currentSettings = await this.getCurrentSettings();
            
            // Update RAG chain configuration with current settings
            if (this.ragChain.retriever) {
                this.ragChain.retriever.k = currentSettings.rag_k;
            }
            
            logger.debug('Using dynamic settings', { k: currentSettings.rag_k });
            
            // Validate inputs
            if (!query || typeof query !== 'string') {
                throw new Error('Query must be a non-empty string');
            }

            if (!Array.isArray(chatHistory)) {
                logger.warn('Chat history is not an array, converting to empty array');
                chatHistory = [];
            }

            // Set debug flag on the chain
            this.ragChain.includeDebug = includeDebug;

            logger.info('LangChain RAG Pipeline Starting', {
                query: query.substring(0, 100),
                chatHistoryLength: chatHistory.length
            });

            if (chatHistory.length > 0 && this.verbose) {
                const recentHistory = chatHistory.slice(Math.max(0, chatHistory.length - 2)).map(([userMsg, assistantMsg]) => ({
                    user: userMsg.substring(0, 60),
                    assistant: assistantMsg.substring(0, 60)
                }));
                logger.debug('Recent chat history preview', { recentHistory });
            }
            // Generate session ID for tracing grouping (use conversationId if available)
            const sessionId = this.generateSessionId(query, chatHistory, conversationId);

            logger.debug('RAG Configuration', {
                k: currentSettings.rag_k,
                provider: 'LangChain + ChromaDB + Mistral',
                debugMode: includeDebug,
                sessionId: sessionId.substring(0, 8),
                conversationId: conversationId || 'N/A'
            });

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

            logger.info('LangChain RAG Pipeline Complete', {
                processingTime,
                answerLength: result.answer?.length || 0,
                documentsRetrieved: result.contextsUsed || 0,
                sourcesUsed: result.sources?.length || 0,
                sourceUrls: result.sourceUrls?.length || 0,
                sessionId: sessionId.substring(0, 8),
                debugInfoAvailable: includeDebug && result.debugInfo ? true : false
            });

            if (result.sources && result.sources.length > 0) {
                logger.debug('Source files used', { sources: result.sources });
            }

            if (includeDebug && result.debugInfo) {
                if (result.debugInfo.step2_queryRephrasing) {
                    logger.debug('Query rephrasing details', {
                        original: query,
                        rephrased: result.debugInfo.step2_queryRephrasing.rephrasedQuery || 'Same as original',
                        improved: result.debugInfo.step2_queryRephrasing.improvement || false
                    });
                }
                if (result.debugInfo.step3_documentRetrieval) {
                    logger.debug('Document retrieval details', {
                        searchQuery: result.debugInfo.step3_documentRetrieval.searchQuery,
                        requested: result.debugInfo.step3_documentRetrieval.requestedDocuments,
                        retrieved: result.debugInfo.step3_documentRetrieval.retrievedDocuments
                    });
                }
                if (result.debugInfo.step5_responseGeneration) {
                    logger.debug('Response generation details', {
                        model: result.debugInfo.step5_responseGeneration.model || 'N/A',
                        temperature: result.debugInfo.step5_responseGeneration.temperature || 'N/A',
                        promptLength: result.debugInfo.step5_responseGeneration.totalPromptLength || 'N/A'
                    });
                }
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

            logger.error('LangChainRAG Error', {
                error: error.message,
                stack: error.stack,
                processingTime
            });

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
     * Update AI provider configuration dynamically
     * This is called when settings are changed in the admin interface
     */
    async updateProviderConfig(providerConfig) {
        try {
            logger.info('Updating provider configuration', { configKeys: Object.keys(providerConfig) });

            // Update the RAG chain configuration
            const result = await this.ragChain.updateProviderConfig(providerConfig);

            if (result.success) {
                logger.info('Provider configuration updated successfully', { recreated: result.recreated || false });
            } else {
                logger.error('Failed to update provider configuration', { error: result.error });
            }

            return result;
        } catch (error) {
            logger.error('Error updating provider configuration', { error: error.message, stack: error.stack });
            return { success: false, error: error.message };
        }
    }

    /**
     * Reload configuration from database
     * This is called when we need to refresh configuration from the database
     */
    async reloadConfiguration() {
        try {
            logger.info('Reloading configuration from database');

            // Load fresh configuration from database
            await this.loadConfiguration();

            // Get the current provider config
            if (this.settingsService) {
                const config = await this.settingsService.getAIProviderConfig();
                await this.updateProviderConfig(config);
            }

            logger.info('Configuration reloaded successfully');
            return { success: true };
        } catch (error) {
            logger.error('Error reloading configuration', { error: error.message, stack: error.stack });
            return { success: false, error: error.message };
        }
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
     * Indicates if the service and underlying chain are ready for use
     */
    get isReady() {
        return Boolean(
            this.initialized &&
            this.ragChain &&
            !this.ragChain._destroyed
        );
    }

    /**
     * Await initialization sequence completion with timeout guard
     */
    async waitForInitialization(timeoutMs = 15000) {
        if (this.isReady) {
            return true;
        }

        if (this.initializationPromise) {
            try {
                await this.initializationPromise;
            } catch (error) {
                logger.warn('LangChain RAG initialization promise rejected', { error: error.message });
            }
        }

        if (this.isReady) {
            return true;
        }

        const start = Date.now();
        while (!this.isReady && Date.now() - start < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        return this.isReady;
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
            const ready = await this.waitForInitialization(5000);
            const verboseLogging = (this.ragChain && this.ragChain.verbose) || this.verbose;

            if (!ready && verboseLogging) {
                logger.warn('LangChainRAG not ready during scoring request - proceeding with degraded logging');
            }

            // Don't score actions in autopilot mode - agents aren't involved
            const systemMode = await this.getSystemMode();
            if (systemMode === 'autopilot') {
                if (verboseLogging) {
                    logger.debug('Skipping agent action scoring - autopilot mode active');
                }
                return;
            }

            if (!conversationId || !suggestionAction) {
                logger.warn('Missing conversationId or suggestionAction for scoring');
                return;
            }

            if (!this.langfuse) {
                if (verboseLogging) {
                    logger.warn('Langfuse client unavailable - skipping agent action scoring');
                }
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

            if (verboseLogging) {
                logger.debug('Scoring agent action', {
                    sessionId,
                    action: suggestionAction,
                    scoreName,
                    scoreValue
                });
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

            logger.info('Agent action scored', { scoreName, scoreValue, conversationId });

        } catch (error) {
            logger.error('Error scoring agent action', { error: error.message, stack: error.stack });
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
            logger.warn('Could not get system mode for scoring', { error: error.message });
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
            logger.info('Langfuse handlers and client shutdown completed');
        } catch (error) {
            logger.error('Error during Langfuse shutdown', { error: error.message, stack: error.stack });
        }
    }
}

module.exports = LangChainRAG;
