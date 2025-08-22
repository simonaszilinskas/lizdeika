/**
 * Vilnius RAG Chain - Main Retrieval-Augmented Generation Chain
 * 
 * This chain orchestrates the complete RAG process using proper LangChain patterns
 * while maintaining all existing functionality and compatibility.
 * 
 * Features:
 * - Proper LangChain chain composition
 * - Integration with custom ChromaRetriever
 * - Query rephrasing for better retrieval
 * - Context-aware conversation handling
 * - Source attribution and metadata preservation
 * - Comprehensive debug information
 * - Lithuanian language optimization
 */

const { BaseChain } = require("langchain/chains");
const { ChatOpenAI } = require("@langchain/openai");
const { Document } = require("@langchain/core/documents");
const { CallbackHandler } = require("langfuse-langchain");
const ChromaRetriever = require('./ChromaRetriever');
const QueryRephraseChain = require('./QueryRephraseChain');
const { 
    createRAGChatPrompt, 
    createSimpleRAGPrompt,
    formatChatHistory,
    formatContextAsMarkdown 
} = require('./VilniusPrompts');

class VilniusRAGChain extends BaseChain {
    constructor(options = {}) {
        super(options);

        // Initialize the main LLM
        this.llm = new ChatOpenAI({
            model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
            apiKey: process.env.OPENROUTER_API_KEY,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                    "HTTP-Referer": process.env.SITE_URL || "http://localhost:3002",
                    "X-Title": process.env.SITE_NAME || "Vilnius Chatbot"
                }
            },
            temperature: 0.2,
            streaming: false
        });

        // Initialize retriever
        this.retriever = new ChromaRetriever({
            k: options.k || parseInt(process.env.RAG_K) || 3,
            verbose: options.verbose || false
        });

        // Initialize query rephrasing chain
        this.rephraseChain = new QueryRephraseChain({
            verbose: options.verbose || false,
            skipRephrasing: options.skipRephrasing || false
        });

        // Create prompts
        this.ragChatPrompt = createRAGChatPrompt();
        this.simpleRAGPrompt = createSimpleRAGPrompt();

        // Configuration
        this.enableRephrasing = options.enableRephrasing !== false;
        this.showSources = options.showSources !== false;
        this.includeDebug = options.includeDebug !== false;
        this.verbose = options.verbose || false;
        this.timeout = options.timeout || 60000; // 60 second timeout

        // Initialize Langfuse callback handler for observability
        this.langfuseHandler = new CallbackHandler({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
            debug: process.env.LANGFUSE_DEBUG === 'true',
            flushAt: 1, // Flush immediately for better debugging
            sessionId: options.sessionId, // Optional session ID for grouping traces
            userId: options.userId // Optional user ID for tracking
        });

        if (this.verbose) {
            console.log('✅ Langfuse observability initialized');
            console.log(`   - Base URL: ${process.env.LANGFUSE_BASE_URL}`);
            console.log(`   - Debug mode: ${process.env.LANGFUSE_DEBUG === 'true'}`);
        }
    }

    /**
     * Input keys required by this chain
     */
    get inputKeys() {
        return ["question", "chat_history"];
    }

    /**
     * Output keys provided by this chain
     */
    get outputKeys() {
        return ["answer", "sources", "sourceUrls", "contextsUsed", "debugInfo"];
    }

    /**
     * Chain type identifier
     */
    get _chainType() {
        return "vilnius_rag_chain";
    }

    /**
     * Main chain execution method
     * 
     * @param {Object} inputs - Chain inputs
     * @param {string} inputs.question - User question
     * @param {Array} inputs.chat_history - Conversation history
     * @param {Object} runManager - LangChain run manager
     * @returns {Object} Chain output
     */
    async _call(inputs, runManager) {
        const { question, chat_history = [] } = inputs;
        
        // Initialize comprehensive debug information
        const debugInfo = {
            timestamp: new Date().toISOString(),
            chainType: this._chainType,
            step1_input: {
                originalQuestion: question,
                chatHistory: chat_history,
                historyLength: chat_history.length,
                enableRephrasing: this.enableRephrasing
            }
        };

        try {
            if (this.verbose) {
                console.log('🚀 VilniusRAGChain: Starting RAG process');
                console.log(`   Question: "${question}"`);
                console.log(`   History length: ${chat_history.length}`);
            }

            // Step 2: Query rephrasing (if enabled and needed)
            let searchQuery = question;
            let rephraseDebugInfo = null;

            if (this.enableRephrasing) {
                if (this.verbose) {
                    console.log('🔄 VilniusRAGChain: Starting query rephrasing');
                }

                const rephraseResult = await this.rephraseChain._call({
                    question: question,
                    chat_history: chat_history
                }, runManager);

                searchQuery = rephraseResult.rephrased_query;
                rephraseDebugInfo = rephraseResult.debug_info;

                if (this.verbose) {
                    console.log(`   Rephrased query: "${searchQuery}"`);
                    console.log(`   Was improved: ${rephraseResult.was_rephrased ? 'YES' : 'NO'}`);
                }
            } else {
                rephraseDebugInfo = {
                    action: 'disabled',
                    reason: 'Query rephrasing disabled',
                    rephrasedQuery: question,
                    improvement: false
                };
            }

            debugInfo.step2_queryRephrasing = rephraseDebugInfo;

            // Step 3: Document retrieval
            if (this.verbose) {
                console.log('🔍 VilniusRAGChain: Retrieving relevant documents');
            }

            const relevantDocs = await this.retriever._getRelevantDocuments(searchQuery, runManager);
            
            debugInfo.step3_documentRetrieval = {
                searchQuery: searchQuery,
                requestedDocuments: this.retriever.k,
                retrievedDocuments: relevantDocs.length,
                documentsMetadata: relevantDocs.map(doc => ({
                    source: doc.metadata?.source,
                    url: doc.metadata?.source_url,
                    score: doc.metadata?.similarity_score,
                    contentLength: doc.pageContent?.length
                }))
            };

            if (this.verbose) {
                console.log(`   Retrieved ${relevantDocs.length} documents`);
                relevantDocs.forEach((doc, i) => {
                    console.log(`      ${i + 1}. ${doc.metadata.source} (score: ${doc.metadata.similarity_score?.toFixed(3)})`);
                });
            }

            // Step 4: Format context
            const context = formatContextAsMarkdown(relevantDocs);

            debugInfo.step4_contextFormatting = {
                contextLength: context.length,
                documentsUsed: relevantDocs.length
            };

            // Step 5: Generate response
            if (this.verbose) {
                console.log('🤖 VilniusRAGChain: Generating response');
            }

            const hasHistory = chat_history && chat_history.length > 0;
            let response;

            if (hasHistory) {
                // Use chat prompt with history
                const formattedHistory = formatChatHistory(chat_history);
                const messages = await this.ragChatPrompt.formatMessages({
                    formatted_history: formattedHistory,
                    question: question,
                    context: context
                });

                response = await this._invokeWithTimeout(messages, runManager);
            } else {
                // Use simple prompt without history
                const messages = await this.simpleRAGPrompt.formatMessages({
                    question: question,
                    context: context
                });

                response = await this._invokeWithTimeout(messages, runManager);
            }

            const answer = response.content || response.text || 'Atsiprašau, negaliu atsakyti į šį klausimą.';

            debugInfo.step5_responseGeneration = {
                model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
                temperature: 0.2,
                hasHistory: hasHistory,
                promptType: hasHistory ? 'chat_with_history' : 'simple',
                responseLength: answer.length,
                successful: true
            };

            // Step 6: Format sources
            const sources = relevantDocs.map(doc => {
                const sourceName = doc.metadata?.source;
                const sourceUrl = doc.metadata?.source_url;
                
                if (sourceName && sourceUrl) {
                    return `${sourceName} (${sourceUrl})`;
                } else if (sourceName) {
                    return sourceName;
                }
                return null;
            }).filter(Boolean);

            const sourceUrls = relevantDocs
                .map(doc => doc.metadata?.source_url)
                .filter(Boolean);

            debugInfo.step6_sourceAttribution = {
                sourcesCount: sources.length,
                sourceUrlsCount: sourceUrls.length,
                sources: sources,
                sourceUrls: sourceUrls
            };

            // Final result
            const result = {
                answer: answer,
                sources: sources,
                sourceUrls: sourceUrls,
                contextsUsed: relevantDocs.length,
                debugInfo: this.includeDebug ? debugInfo : undefined
            };

            debugInfo.step7_finalResult = {
                answerLength: answer.length,
                sourcesProvided: sources.length,
                contextsUsed: relevantDocs.length,
                successful: true
            };

            if (this.verbose) {
                console.log('✅ VilniusRAGChain: RAG process completed successfully');
                console.log(`   Answer length: ${answer.length} characters`);
                console.log(`   Sources: ${sources.length}`);
                console.log(`   Contexts used: ${relevantDocs.length}`);
            }

            return result;

        } catch (error) {
            console.error('🔴 VilniusRAGChain Error:', error);

            // Always populate debug info even on error
            debugInfo.error = {
                message: error.message,
                stack: error.stack,
                step: 'chain_execution',
                timestamp: new Date().toISOString()
            };

            debugInfo.step7_finalResult = {
                answer: 'Atsiprašau, įvyko klaida apdorojant užklausą.',
                sourcesProvided: 0,
                contextsUsed: 0,
                successful: false,
                error: true
            };

            // Notify run manager if available
            if (runManager) {
                await runManager?.handleChainError?.(error, inputs);
            }

            // Return error result instead of throwing
            return {
                answer: 'Atsiprašau, įvyko klaida apdorojant užklausą.',
                sources: [],
                sourceUrls: [],
                contextsUsed: 0,
                debugInfo: this.includeDebug ? debugInfo : undefined,
                error: error.message
            };
        }
    }

    /**
     * Invoke LLM with timeout protection
     */
    async _invokeWithTimeout(messages, runManager) {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`LLM call timeout after ${this.timeout}ms`)), this.timeout)
        );
        
        const llmPromise = this.llm.invoke(messages, {
            callbacks: [this.langfuseHandler]
        });
        
        try {
            return await Promise.race([llmPromise, timeoutPromise]);
        } catch (error) {
            if (runManager) {
                await runManager?.handleLLMError?.(error, messages);
            }
            throw error;
        }
    }

    /**
     * Static factory method to create a VilniusRAGChain
     */
    static fromLLM(llm, retriever, options = {}) {
        return new VilniusRAGChain({
            llm: llm,
            retriever: retriever,
            ...options
        });
    }

    /**
     * Health check for the entire chain
     */
    async healthCheck() {
        try {
            const retrieverHealth = await this.retriever.healthCheck();
            const rephraseHealth = await this.rephraseChain.healthCheck();
            
            // Test basic functionality
            const testResult = await this._call({
                question: "test",
                chat_history: []
            });
            
            return {
                healthy: true,
                retriever: retrieverHealth,
                rephraseChain: rephraseHealth.healthy,
                testQuery: testResult.answer !== undefined,
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
     * Get chain configuration
     */
    getConfig() {
        return {
            llmModel: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
            retrievalK: this.retriever.k,
            enableRephrasing: this.enableRephrasing,
            showSources: this.showSources,
            includeDebug: this.includeDebug,
            timeout: this.timeout,
            verbose: this.verbose
        };
    }

    /**
     * Update configuration
     */
    updateConfig(config) {
        if (config.k !== undefined) {
            this.retriever.k = config.k;
        }
        if (config.enableRephrasing !== undefined) {
            this.enableRephrasing = config.enableRephrasing;
        }
        if (config.showSources !== undefined) {
            this.showSources = config.showSources;
        }
        if (config.includeDebug !== undefined) {
            this.includeDebug = config.includeDebug;
        }
        if (config.verbose !== undefined) {
            this.verbose = config.verbose;
        }
        if (config.timeout !== undefined) {
            this.timeout = config.timeout;
        }
        return this;
    }
}

module.exports = VilniusRAGChain;