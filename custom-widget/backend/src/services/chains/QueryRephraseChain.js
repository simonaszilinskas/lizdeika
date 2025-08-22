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
const { createRephrasePrompt, formatChatHistory } = require('./VilniusPrompts');

class QueryRephraseChain extends LLMChain {
    constructor(options = {}) {
        // Create the rephrasing model (smaller, faster model)
        const rephraseModel = new ChatOpenAI({
            model: "google/gemini-2.5-flash-lite",
            apiKey: process.env.OPENROUTER_API_KEY,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                    "HTTP-Referer": process.env.SITE_URL || "http://localhost:3002",
                    "X-Title": process.env.SITE_NAME || "Vilnius Chatbot"
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
            console.log('🔄 QueryRephraseChain: Starting query rephrasing');
            console.log(`   Original query: "${question}"`);
            console.log(`   History exchanges: ${chat_history.length} total, ${validHistory.length} valid`);
        }

        try {
            // Call the parent LLMChain with formatted inputs and Langfuse callback
            const result = await super._call({
                question: question,
                chat_history: formattedHistory
            }, runManager, {
                callbacks: [this.langfuseHandler]
            });

            const rephrasedQuery = result.rephrased_query || result.text || question;
            const wasRephrased = rephrasedQuery !== question;

            debugInfo.action = 'rephrased';
            debugInfo.rephrasedQuery = rephrasedQuery;
            debugInfo.improvement = wasRephrased;
            debugInfo.model = "google/gemini-2.5-flash-lite";
            debugInfo.temperature = 0.1;
            debugInfo.successful = true;

            if (this.verbose) {
                console.log(`   Rephrased query: "${rephrasedQuery}"`);
                console.log(`   Was improved: ${wasRephrased ? 'YES' : 'NO'}`);
            }

            return {
                rephrased_query: rephrasedQuery,
                original_query: question,
                was_rephrased: wasRephrased,
                debug_info: debugInfo,
                formatted_history: formattedHistory
            };

        } catch (error) {
            console.error('🔴 QueryRephraseChain Error:', error);
            
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
                model: "google/gemini-2.5-flash-lite",
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
            model: "google/gemini-2.5-flash-lite",
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
}

module.exports = QueryRephraseChain;