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
    formatContextAsMarkdown,
    getSystemPromptManaged
} = require('./VilniusPrompts');

class VilniusRAGChain extends BaseChain {
    constructor(options = {}) {
        super(options);

        // Use provided config or fall back to env vars
        const config = options.providerConfig || {};
        const mainModel = config.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

        this.llm = new ChatOpenAI({
            model: mainModel,
            apiKey: config.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                    "HTTP-Referer": config.SITE_URL || process.env.SITE_URL || "http://localhost:3002",
                    "X-Title": config.SITE_NAME || process.env.SITE_NAME || "Vilnius Chatbot"
                }
            },
            temperature: 0.2,
            streaming: false
        });

        // Store the model name for debugging
        this.mainModelName = mainModel;

        // Initialize retriever
        this.retriever = new ChromaRetriever({
            k: options.k || parseInt(process.env.RAG_K) || 3,
            verbose: options.verbose || false
        });

        // Initialize query rephrasing chain
        this.rephraseChain = new QueryRephraseChain({
            verbose: options.verbose || false,
            skipRephrasing: options.skipRephrasing || false,
            rephrasingModel: options.rephrasingModel || process.env.REPHRASING_MODEL
        });

        // Create prompts (will be enhanced with managed prompts on first use)
        this.ragChatPrompt = createRAGChatPrompt();
        this.simpleRAGPrompt = createSimpleRAGPrompt();
        this.managedPrompt = null; // Cached managed prompt

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
            },
            modelConfiguration: {
                mainModel: this.mainModelName,
                rephrasingModel: this.rephraseChain.rephrasingModel,
                temperature: this.llm.temperature,
                provider: 'openrouter'
            }
        };

        try {
            if (this.verbose) {
                console.log('🚀 VilniusRAGChain: Starting RAG process');
                console.log(`   Question: "${question}"`);
                console.log(`   History length: ${chat_history.length}`);
                console.log(`   Main Model: ${this.mainModelName} (temperature: ${this.llm.temperature})`);
                console.log(`   Rephrasing Model: ${this.rephraseChain.rephrasingModel}`);
            }

            // Step 2: Query rephrasing (if enabled and needed)
            let searchQuery = question;
            let rephraseDebugInfo = null;

            if (this.enableRephrasing) {
                if (this.verbose) {
                    console.log('🔄 VilniusRAGChain: Starting query rephrasing');
                    console.log(`   Using model: ${this.rephraseChain.rephrasingModel}`);
                }

                const rephraseResult = await this.rephraseChain._call({
                    question: question,
                    chat_history: chat_history
                }, runManager);

                searchQuery = rephraseResult.rephrased_query;
                rephraseDebugInfo = rephraseResult.debug_info;

                // Add model info to rephrasing debug data
                if (rephraseDebugInfo) {
                    rephraseDebugInfo.model = this.rephraseChain.rephrasingModel;
                    rephraseDebugInfo.temperature = 0.1;
                }

                if (this.verbose) {
                    console.log(`   Rephrased query: "${searchQuery}"`);
                    console.log(`   Was improved: ${rephraseResult.was_rephrased ? 'YES' : 'NO'}`);
                }
            } else {
                rephraseDebugInfo = {
                    action: 'disabled',
                    reason: 'Query rephrasing disabled',
                    rephrasedQuery: question,
                    improvement: false,
                    model: null
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
                console.log(`   Using main model: ${this.mainModelName} (temperature: ${this.llm.temperature})`);
            }

            // Get managed prompt for enhanced system instructions
            const managedPrompt = await this.getManagedPrompt();

            console.log(`\n📝 Prompt Construction Phase:`);
            console.log(`  • Prompt Source: ${managedPrompt?.managed ? (managedPrompt.managed.fromLangfuse ? 'Langfuse (managed)' : 'Environment Override') : 'Hardcoded Fallback'}`);
            if (managedPrompt?.managed?.version) {
                console.log(`  • Prompt Version: v${managedPrompt.managed.version}`);
            }
            console.log(`  • Has Chat History: ${chat_history && chat_history.length > 0 ? 'Yes' : 'No'}`);
            console.log(`  • Context Length: ${context.length} characters`);
            console.log(`  • Context Preview: "${context.substring(0, 150)}..."`);

            const hasHistory = chat_history && chat_history.length > 0;
            let response;
            let finalMessages;

            if (hasHistory) {
                console.log(`  • Using: Chat Prompt Template (with history)`);
                // Use chat prompt with history
                const formattedHistory = formatChatHistory(chat_history);
                console.log(`  • Formatted History Length: ${formattedHistory.length} chars`);

                const messages = await this.ragChatPrompt.formatMessages({
                    formatted_history: formattedHistory,
                    question: question,
                    context: context
                });

                // If we have a managed prompt, replace the system message
                if (managedPrompt?.managed) {
                    const systemContent = managedPrompt.managed.compile({
                        formatted_history: formattedHistory,
                        question: question,
                        context: context
                    });
                    messages[0].content = systemContent;
                    console.log(`  • Applied Managed System Prompt (${systemContent.length} chars)`);
                }

                finalMessages = messages;
                response = await this._invokeWithTimeout(messages, runManager, managedPrompt);
            } else {
                console.log(`  • Using: Simple Prompt Template (no history)`);
                // Use simple prompt without history
                const messages = await this.simpleRAGPrompt.formatMessages({
                    question: question,
                    context: context
                });

                // If we have a managed prompt, replace the system message
                if (managedPrompt?.managed) {
                    const systemContent = managedPrompt.managed.compile({
                        question: question,
                        context: context
                    });
                    messages[0].content = systemContent;
                    console.log(`  • Applied Managed System Prompt (${systemContent.length} chars)`);
                }

                finalMessages = messages;
                response = await this._invokeWithTimeout(messages, runManager, managedPrompt);
            }

            // Log the complete final prompt details
            console.log(`\n🎯 Final Prompt Details:`);
            console.log(`  • Total Messages: ${finalMessages.length}`);
            finalMessages.forEach((msg, index) => {
                const role = msg._getType ? msg._getType() : (msg.role || 'unknown');
                const contentLength = msg.content ? msg.content.length : 0;
                const preview = msg.content ? msg.content.substring(0, 100) : '';
                console.log(`  • Message ${index + 1} (${role}): ${contentLength} chars`);
                console.log(`    Preview: "${preview}..."`);
            });

            const totalPromptLength = finalMessages.reduce((total, msg) => total + (msg.content?.length || 0), 0);
            console.log(`  • Total Prompt Length: ${totalPromptLength} characters`);
            console.log(`  • LLM Model: ${this.mainModelName}`);
            console.log(`  • Temperature: ${this.llm.temperature}`);
            console.log(`  • Sending to LLM...`)

            const answer = response.content || response.text || 'Atsiprašau, negaliu atsakyti į šį klausimą.';

            debugInfo.step5_responseGeneration = {
                model: this.mainModelName,
                temperature: this.llm.temperature,
                hasHistory: hasHistory,
                promptType: hasHistory ? 'chat_with_history' : 'simple',
                responseLength: answer.length,
                contextLength: context.length,
                managedPrompt: managedPrompt?.managed ? 'langfuse' : 'hardcoded',
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
    async _invokeWithTimeout(messages, runManager, managedPrompt = null) {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`LLM call timeout after ${this.timeout}ms`)), this.timeout)
        );
        
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
        
        const llmPromise = this.llm.invoke(messages, callbackOptions);
        
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
     * Get managed system prompt from Langfuse with fallback
     */
    async getManagedPrompt() {
        if (!this.managedPrompt) {
            try {
                this.managedPrompt = await getSystemPromptManaged();
                if (this.verbose && this.managedPrompt.managed.fromLangfuse) {
                    console.log(`📝 Using Langfuse managed system prompt (v${this.managedPrompt.managed.version})`);
                } else if (this.verbose && this.managedPrompt.managed.source === '.env override') {
                    console.log(`📝 Using .env system prompt override`);
                } else if (this.verbose) {
                    console.log(`📝 Using hardcoded system prompt fallback`);
                }
            } catch (error) {
                console.warn('Failed to get managed prompt, using hardcoded fallback:', error.message);
                this.managedPrompt = null;
            }
        }
        return this.managedPrompt;
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

    /**
     * Update AI provider configuration dynamically
     */
    async updateProviderConfig(providerConfig) {
        // Store current config for rollback
        const previousConfig = {
            model: this.mainModelName,
            llm: this.llm
        };

        try {
            let needsRecreation = false;

            // Update environment variables
            if (providerConfig.OPENROUTER_API_KEY && providerConfig.OPENROUTER_API_KEY !== process.env.OPENROUTER_API_KEY) {
                process.env.OPENROUTER_API_KEY = providerConfig.OPENROUTER_API_KEY;
                needsRecreation = true;
            }

            if (providerConfig.OPENROUTER_MODEL && providerConfig.OPENROUTER_MODEL !== process.env.OPENROUTER_MODEL) {
                process.env.OPENROUTER_MODEL = providerConfig.OPENROUTER_MODEL;
                needsRecreation = true;
            }

            if (providerConfig.SITE_URL) {
                process.env.SITE_URL = providerConfig.SITE_URL;
                needsRecreation = true;
            }

            if (providerConfig.SITE_NAME) {
                process.env.SITE_NAME = providerConfig.SITE_NAME;
                needsRecreation = true;
            }

            // Recreate main LLM if needed
            if (needsRecreation) {
                const mainModel = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
                const newLLM = new ChatOpenAI({
                    model: mainModel,
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

                // Test the new LLM with a simple call before committing
                try {
                    await newLLM.invoke([{ role: "user", content: "test" }]);
                    this.llm = newLLM;
                    this.mainModelName = mainModel;
                } catch (testError) {
                    console.error('❌ New LLM configuration failed test:', testError.message);
                    // Restore previous LLM
                    this.llm = previousConfig.llm;
                    this.mainModelName = previousConfig.model;
                    throw new Error(`Invalid LLM configuration: ${testError.message}`);
                }

                console.log('🔧 VilniusRAGChain: Updated main LLM configuration');
                console.log(`   Model: ${mainModel}`);
                console.log(`   API Key: ${process.env.OPENROUTER_API_KEY ? 'Set' : 'Not set'}`);
            }

            // Update rephrasing chain if needed
            if (providerConfig.REPHRASING_MODEL) {
                await this.rephraseChain.updateConfiguration({
                    rephrasingModel: providerConfig.REPHRASING_MODEL,
                    apiKey: providerConfig.OPENROUTER_API_KEY,
                    siteUrl: providerConfig.SITE_URL,
                    siteName: providerConfig.SITE_NAME
                });
            }

            return { success: true, recreated: needsRecreation };
        } catch (error) {
            console.error('❌ Error updating provider configuration:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = VilniusRAGChain;