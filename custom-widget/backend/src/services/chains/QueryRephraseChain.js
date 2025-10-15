/**
 * Query Rephrase Chain for Context-Aware Search
 * 
 * This chain handles query rephrasing using conversation history
 * to improve retrieval accuracy in the RAG system.
 * 
 * Features:
 * - Context-aware query enhancement
 * - Conversation history integration
 * - Conditional rephrasing (only when needed)
 * - Lithuanian language optimization
 * - Debug information capture
 */

const { LLMChain } = require("langchain/chains");
const { ChatOpenAI } = require("@langchain/openai");
const { CallbackHandler } = require("langfuse-langchain");
const {
    createRephrasePrompt,
    formatChatHistory,
    getRephrasePromptManaged
} = require('./VilniusPrompts');
const { createLogger } = require('../../../utils/logger');
const logger = createLogger('QueryRephraseChain');

class QueryRephraseChain extends LLMChain {
    constructor(options = {}) {
        // Use provided config or fall back to options/env vars
        const config = options.providerConfig || {};
        const rephrasingModel = config.REPHRASING_MODEL || options.rephrasingModel || process.env.REPHRASING_MODEL || "google/gemini-2.5-flash-lite";

        // Create the rephrasing model (using configurable model)
        const rephraseModel = new ChatOpenAI({
            model: rephrasingModel,
            apiKey: config.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                    "HTTP-Referer": config.SITE_URL || process.env.SITE_URL || "http://localhost:3002",
                    "X-Title": config.SITE_NAME || process.env.SITE_NAME || "Vilnius Chatbot"
                }
            },
            temperature: 0.1, // Low temperature for consistent rephrasing
            streaming: false
        });

        super({
            llm: rephraseModel,
            prompt: createRephrasePrompt(),
            outputKey: "rephrased_query",
            verbose: options.verbose || false,
            ...options
        });

        this.skipRephrasing = options.skipRephrasing || false;
        this.minHistoryLength = options.minHistoryLength || 1;
        this.rephrasingModel = rephrasingModel;
        this.managedPrompt = null; // Cached managed prompt

        // Initialize Langfuse callback handler for query rephrasing observability
        this.langfuseHandler = new CallbackHandler({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
            debug: process.env.LANGFUSE_DEBUG === 'true',
            flushAt: 1,
            sessionId: options.sessionId,
            userId: options.userId
        });
    }

    /**
     * Get managed rephrase prompt from Langfuse with fallback
     */
    async getManagedPrompt() {
        if (!this.managedPrompt) {
            try {
                this.managedPrompt = await getRephrasePromptManaged();
                if (this.verbose && this.managedPrompt.managed.fromLangfuse) {
                    logger.info(`📝 Using Langfuse managed rephrase prompt (v${this.managedPrompt.managed.version})`);
                } else if (this.verbose && this.managedPrompt.managed.source === '.env override') {
                    logger.info(`📝 Using .env rephrase prompt override`);
                } else if (this.verbose) {
                    logger.info(`📝 Using hardcoded rephrase prompt fallback`);
                }
            } catch (error) {
                logger.warn('Failed to get managed rephrase prompt, using hardcoded fallback:', error.message);
                this.managedPrompt = null;
            }
        }
        return this.managedPrompt;
    }

    /**
     * Main method to rephrase query with conversation context
     * 
     * @param {Object} inputs - Chain inputs
     * @param {string} inputs.question - Original user question
     * @param {Array} inputs.chat_history - Conversation history as array of [user, assistant] pairs
     * @param {Object} runManager - LangChain run manager for callbacks
     * @returns {Object} Chain output with rephrased_query
     */
    async _call(inputs, runManager) {
        const { question, chat_history = [] } = inputs;

        // Initialize debug information
        const debugInfo = {
            originalQuery: question,
            chatHistory: chat_history,
            historyLength: chat_history.length,
            timestamp: new Date().toISOString()
        };

        // Skip rephrasing if configured to do so
        if (this.skipRephrasing) {
            debugInfo.action = 'skipped_by_config';
            debugInfo.reason = 'Rephrasing disabled by configuration';
            debugInfo.rephrasedQuery = question;
            debugInfo.improvement = false;
            
            return {
                rephrased_query: question,
                original_query: question,
                was_rephrased: false,
                debug_info: debugInfo
            };
        }

        // Skip rephrasing if no meaningful history
        if (!chat_history || chat_history.length < this.minHistoryLength) {
            debugInfo.action = 'skipped_no_history';
            debugInfo.reason = `No sufficient chat history (${chat_history.length} < ${this.minHistoryLength})`;
            debugInfo.rephrasedQuery = question;
            debugInfo.improvement = false;
            
            return {
                rephrased_query: question,
                original_query: question,
                was_rephrased: false,
                debug_info: debugInfo
            };
        }

        // Filter out incomplete exchanges for context
        const validHistory = chat_history.filter(exchange => 
            exchange[0] && exchange[0].trim() && exchange[1] && exchange[1].trim()
        );

        // Format chat history for the prompt
        const formattedHistory = formatChatHistory(chat_history);
        
        debugInfo.validExchanges = validHistory.length;
        debugInfo.formattedHistoryLength = formattedHistory.length;
        debugInfo.promptInputs = {
            question: question,
            chat_history: formattedHistory
        };

        if (this.verbose) {
            logger.info('🔄 QueryRephraseChain: Starting query rephrasing');
            logger.info(`   Original query: "${question}"`);
            logger.info(`   History exchanges: ${chat_history.length} total, ${validHistory.length} valid`);
        }

        try {
            // Get managed prompt for enhanced rephrasing instructions
            const managedPrompt = await this.getManagedPrompt();

            // Prepare callback options with potential prompt linking
            const callbackOptions = {
                callbacks: [this.langfuseHandler]
            };

            // Add prompt metadata if available for trace linking
            if (managedPrompt?.managed?.langfusePrompt) {
                callbackOptions.metadata = {
                    langfusePrompt: managedPrompt.managed.langfusePrompt
                };
            }

            // If we have a managed prompt, use it directly with the LLM
            let result;
            if (managedPrompt?.managed && managedPrompt.managed.fromLangfuse) {
                // Use managed prompt content directly
                const compiledPrompt = managedPrompt.managed.compile({
                    question: question,
                    chat_history: formattedHistory
                });

                // Call LLM directly with compiled prompt
                const llmResponse = await this.llm.invoke([
                    { role: "user", content: compiledPrompt }
                ], callbackOptions);

                result = {
                    rephrased_query: llmResponse.content || llmResponse.text || question,
                    text: llmResponse.content || llmResponse.text || question
                };
            } else {
                // Call the parent LLMChain with formatted inputs and Langfuse callback
                result = await super._call({
                    question: question,
                    chat_history: formattedHistory
                }, runManager, callbackOptions);
            }

            const rephrasedQuery = result.rephrased_query || result.text || question;
            const wasRephrased = rephrasedQuery !== question;

            debugInfo.action = 'rephrased';
            debugInfo.rephrasedQuery = rephrasedQuery;
            debugInfo.improvement = wasRephrased;
            debugInfo.model = this.rephrasingModel;
            debugInfo.temperature = 0.1;
            debugInfo.promptSource = managedPrompt?.managed?.fromLangfuse ? 'langfuse' : 
                                  (managedPrompt?.managed?.source === '.env override' ? 'env' : 'hardcoded');
            debugInfo.promptVersion = managedPrompt?.managed?.version || null;
            debugInfo.successful = true;

            if (this.verbose) {
                logger.info(`   Rephrased query: "${rephrasedQuery}"`);
                logger.info(`   Was improved: ${wasRephrased ? 'YES' : 'NO'}`);
            }

            return {
                rephrased_query: rephrasedQuery,
                original_query: question,
                was_rephrased: wasRephrased,
                debug_info: debugInfo,
                formatted_history: formattedHistory
            };

        } catch (error) {
            logger.error('🔴 QueryRephraseChain Error:', error);
            
            debugInfo.action = 'failed';
            debugInfo.error = error.message;
            debugInfo.rephrasedQuery = question; // Fallback to original
            debugInfo.improvement = false;
            debugInfo.successful = false;

            // Notify run manager if available
            if (runManager) {
                await runManager?.handleChainError?.(error, inputs);
            }

            // Return original query as fallback instead of throwing
            return {
                rephrased_query: question,
                original_query: question,
                was_rephrased: false,
                debug_info: debugInfo,
                error: error.message
            };
        }
    }

    /**
     * Static factory method to create a QueryRephraseChain
     */
    static fromLLM(llm, options = {}) {
        return new QueryRephraseChain({
            llm: llm,
            ...options
        });
    }

    /**
     * Convenience method to rephrase a query directly
     */
    async rephraseQuery(question, chatHistory = [], options = {}) {
        const result = await this._call({
            question: question,
            chat_history: chatHistory
        });

        return {
            query: result.rephrased_query,
            wasImproved: result.was_rephrased,
            debugInfo: options.includeDebug ? result.debug_info : undefined
        };
    }

    /**
     * Health check for the rephrasing service
     */
    async healthCheck() {
        try {
            const testResult = await this._call({
                question: "test",
                chat_history: []
            });
            
            return {
                healthy: true,
                model: this.rephrasingModel,
                testQuery: testResult.rephrased_query === "test",
                lastCheck: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                lastCheck: new Date().toISOString()
            };
        }
    }

    /**
     * Get chain configuration for debugging
     */
    getConfig() {
        return {
            model: this.rephrasingModel,
            temperature: 0.1,
            skipRephrasing: this.skipRephrasing,
            minHistoryLength: this.minHistoryLength,
            verbose: this.verbose
        };
    }

    /**
     * Set whether to skip rephrasing
     */
    setSkipRephrasing(skip) {
        this.skipRephrasing = skip;
        return this;
    }

    /**
     * Set minimum history length required for rephrasing
     */
    setMinHistoryLength(length) {
        this.minHistoryLength = Math.max(0, length);
        return this;
    }

    /**
     * Update AI provider configuration dynamically
     * Accepts both camelCase and UPPERCASE config keys
     */
    async updateConfiguration(config) {
        try {
            let needsRecreation = false;

            // Normalize config keys - accept both camelCase and UPPERCASE
            const rephrasingModel = config.rephrasingModel || config.REPHRASING_MODEL;
            const apiKey = config.apiKey || config.OPENROUTER_API_KEY;
            const siteUrl = config.siteUrl || config.SITE_URL;
            const siteName = config.siteName || config.SITE_NAME;

            // Check if rephrasing model changed
            if (rephrasingModel && rephrasingModel !== this.rephrasingModel) {
                this.rephrasingModel = rephrasingModel;
                process.env.REPHRASING_MODEL = rephrasingModel;
                needsRecreation = true;
            }

            // Check if API key changed
            if (apiKey && apiKey !== process.env.OPENROUTER_API_KEY) {
                process.env.OPENROUTER_API_KEY = apiKey;
                needsRecreation = true;
            }

            // Check if site URL changed
            if (siteUrl && siteUrl !== process.env.SITE_URL) {
                process.env.SITE_URL = siteUrl;
                needsRecreation = true;
            }

            // Check if site name changed
            if (siteName && siteName !== process.env.SITE_NAME) {
                process.env.SITE_NAME = siteName;
                needsRecreation = true;
            }

            // Recreate LLM if configuration changed
            if (needsRecreation) {
                this.llm = new ChatOpenAI({
                    model: this.rephrasingModel,
                    apiKey: process.env.OPENROUTER_API_KEY,
                    configuration: {
                        baseURL: "https://openrouter.ai/api/v1",
                        defaultHeaders: {
                            "HTTP-Referer": process.env.SITE_URL || "http://localhost:3002",
                            "X-Title": process.env.SITE_NAME || "Vilnius Chatbot"
                        }
                    },
                    temperature: 0.1,
                    streaming: false
                });

                // Reset managed prompt cache to force reload
                this.managedPrompt = null;

                logger.info('🔧 QueryRephraseChain: Updated configuration');
                logger.info(`   Rephrasing Model: ${this.rephrasingModel}`);
                logger.info(`   API Key: ${process.env.OPENROUTER_API_KEY ? 'Set' : 'Not set'}`);
            }

            return { success: true, recreated: needsRecreation };
        } catch (error) {
            logger.error('❌ Error updating QueryRephraseChain configuration:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = QueryRephraseChain;