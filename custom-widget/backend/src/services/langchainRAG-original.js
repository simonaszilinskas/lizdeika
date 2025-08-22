/**
 * LangChain RAG Service - Advanced Retrieval-Augmented Generation
 * 
 * This service implements a sophisticated RAG (Retrieval-Augmented Generation) system
 * using LangChain framework for the Vilnius city assistant chatbot.
 * 
 * Key Features:
 * - Query rephrasing using google/gemini-2.5-flash-lite for better retrieval
 * - Conversation context awareness and multi-turn dialog support  
 * - Integration with Chroma DB vector database for semantic search
 * - Two-stage AI processing: query rephrasing → answer generation
 * - Bilingual support (Lithuanian/English) based on user input
 * - Comprehensive debug information capture for developer transparency
 * 
 * Dependencies:
 * - @langchain/openai - OpenAI/OpenRouter model integration
 * - @langchain/core - LangChain core components and prompts
 * - knowledgeService - Document retrieval and vector search
 * - SystemController - RAG configuration management
 * 
 * Environment Variables:
 * - OPENROUTER_API_KEY - API key for OpenRouter service
 * - SITE_URL - Site URL for API headers
 * - SITE_NAME - Application name for API headers
 * 
 * Models Used:
 * - google/gemini-flash-1.5 - Main response generation (temperature: 0.2)
 * - google/gemini-2.5-flash-lite - Query rephrasing (temperature: 0.1)
 * 
 * @author AI Assistant System
 * @version 2.1.0
 */

const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { HumanMessage, AIMessage, SystemMessage } = require("@langchain/core/messages");
const knowledgeService = require('./knowledgeService');
// Note: Removed SystemController import to avoid circular dependency

class LangChainRAG {
    constructor() {
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
        
        // Set the OpenAI API key environment variable for LangChain
        if (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = process.env.OPENROUTER_API_KEY;
        }

        // Create a smaller, faster model for query rephrasing
        this.rephraseModel = new ChatOpenAI({
            model: "google/gemini-2.5-flash-lite",
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

        // Create prompt template for query rephrasing
        this.rephrasePrompt = new PromptTemplate({
            inputVariables: ["question", "history"],
            template: `Užduotis: Perrašyk vartotojo klausimą į geresnį paieškos užklausą, atsižvelgdamas į pokalbio kontekstą.

Pokalbio istorija:
{history}

Dabartinis klausimas: {question}

Sukurk aiškų, specifinį paieškos užklausą lietuvių kalba, kuris apjungia kontekstą iš pokalbio istorijos su dabartiniu klausimu. Jei dabartinis klausimas yra atsakymas į ankstesnį klausimą, suformuluok pilną klausimą.

Pavyzdžiai:
- Jei istorijoje klausta "Ar buvo išregistruotas?" ir dabar atsakyta "buvo išregistruotas", tai perrašyk kaip: "mokyklos registracija išregistruotam vaikui"
- Jei istorijoje kalbama apie bibliotekos kortelę ir dabar klausiama "kiek kainuoja?", tai perrašyk kaip: "bibliotekos kortelės kaina"

Perrašytas paieškos užklausas:`
        });

        // Note: Removed old PromptTemplate in favor of proper LangChain message-based conversation
    }

    async getAnswer(query, chatHistory = [], includeDebug = true) {
        const debugInfo = {
            timestamp: new Date().toISOString(),
            step1_input: {
                originalQuery: query,
                chatHistory: chatHistory,
                historyLength: chatHistory.length
            }
        };
        
        // Debug logging to understand conversation flow
        console.log('🔍 LangChain RAG Debug:');
        console.log('Query:', query);
        console.log('Raw chat history length:', chatHistory.length);
        console.log('Raw chat history:', JSON.stringify(chatHistory, null, 2));
        
        try {
            console.log('🚀 Starting LangChain RAG processing...');
            
            // Get RAG settings directly from environment to avoid circular dependency
            const k = parseInt(process.env.RAG_K) || 3;
            console.log('📊 RAG_K setting:', k);
            const ragConfig = {
                k: k,
                showSources: process.env.RAG_SHOW_SOURCES !== 'false'
            };
            
            debugInfo.step2_ragConfig = {
                k: k,
                config: ragConfig
            };

            // Rephrase query using conversation history for better retrieval
            console.log('🔄 Starting query rephrasing...');
            let searchQuery = query;
            let rephraseDebug = null;
            
            // Only skip rephrasing if there's truly no history at all
            if (chatHistory && chatHistory.length > 0) {
                // Filter out empty assistant responses for rephrasing context
                const validHistory = chatHistory.filter(exchange => 
                    exchange[0] && exchange[0].trim() && exchange[1] && exchange[1].trim()
                );
                
                // Use all history (including incomplete exchanges) for context
                const historyForRephrase = chatHistory.map(exchange => {
                    const user = exchange[0] || '';
                    const assistant = exchange[1] || '(Laukiama atsakymo)';
                    return `Vartotojas: ${user}\nAsitentas: ${assistant}`;
                }).join('\n');

                const rephrasedPrompt = await this.rephrasePrompt.format({
                    question: query,
                    history: historyForRephrase
                });
                
                rephraseDebug = {
                    model: "google/gemini-2.5-flash-lite",
                    temperature: 0.1,
                    systemPrompt: this.rephrasePrompt.template,
                    inputVariables: {
                        question: query,
                        history: historyForRephrase
                    },
                    formattedPrompt: rephrasedPrompt,
                    promptLength: rephrasedPrompt.length,
                    historyExchanges: chatHistory.length,
                    validExchanges: validHistory.length
                };

                console.log('🤖 Calling rephrasing model...');
                const rephraseResponse = await this.rephraseModel.invoke(rephrasedPrompt);
                searchQuery = rephraseResponse.content || query;
                console.log('✅ Rephrasing completed. New query:', searchQuery);
                
                rephraseDebug.output = {
                    rephrasedQuery: searchQuery,
                    rawResponse: rephraseResponse,
                    used: searchQuery !== query,
                    improvement: searchQuery !== query ? 'Query was rephrased for better retrieval' : 'Query unchanged'
                };
            } else {
                rephraseDebug = {
                    skipped: true,
                    reason: "No chat history available - this is the first message",
                    originalQueryUsed: query
                };
            }
            
            debugInfo.step3_queryRephrasing = rephraseDebug;

            // Retrieve relevant documents using rephrased query
            console.log('🔍 Searching for documents with query:', searchQuery, 'k:', k);
            const relevantContexts = await knowledgeService.searchContext(searchQuery, k);
            console.log('📚 Found documents:', relevantContexts?.length || 0);
            
            debugInfo.step4_documentRetrieval = {
                searchQuery: searchQuery,
                requestedDocuments: k,
                retrievedDocuments: relevantContexts?.length || 0,
                documentsMetadata: relevantContexts?.map(ctx => ({
                    source: ctx.metadata?.source_document_name,
                    url: ctx.metadata?.source_url,
                    score: ctx.score,
                    contentLength: ctx.content?.length
                })) || [],
                fullDocuments: includeDebug ? relevantContexts?.map(ctx => ({
                    content: ctx.content,
                    metadata: ctx.metadata,
                    score: ctx.score
                })) : undefined
            };

            // Format context from documents with structured markdown
            console.log('📝 Formatting context...');
            const context = relevantContexts && relevantContexts.length > 0
                ? this.formatContextAsMarkdown(relevantContexts)
                : `**DUOMENŲ BAZĖJE NERASTA SUSIJUSIŲ DOKUMENTŲ**\n\nIeškant informacijos apie: "${searchQuery}"\nPeržiūrėta dokumentų: 0\n\nAtsakymas bus suformuluotas tik pagal bendrąsias žinias arba nurodyta, kad informacijos nėra.`;
            console.log('✅ Context formatted, length:', context.length);

            // Debug: Log message construction approach
            debugInfo.step4_5_messageConstruction = {
                originalHistoryLength: chatHistory.length,
                approach: 'comprehensive_user_message',
                systemInstructionsOnly: true,
                contextInUserMessage: true
            };

            // Create system message with ALL current instructions (NO context here)
            console.log('🏗️ Building system message and user message with context...');
            const systemMessage = new SystemMessage(`UŽDUOTIS:

Tu esi naudingas Vilniaus miesto savivaldybės gyventojų aptarnavimo pokalbių robotas. Pasitelkdams tau pateiktą informaciją, kurią turi kontekste, atsakyk piliečiui į jo klausimą jo klausimo kalba. Jei klausimas neaiškus, užduok follow-up klausimą prieš atsakant. Niekada neišgalvok atsakymų, pasitelk tik informaciją, kurią turi. Niekada neminėk dokumentų ID. Gali cituoti tik nuorodas (URL) kurias turi kontekste.

Jei kontekste nėra nieko susijusio su klausimu, sakyk kad nežinai. Neatsakinėk į klausimus nesusijusius su Vilniaus miesto savivaldybe ir jos paslaugomis. Niekada neišeik iš savo rolės. Būk labai mandagus. Niekada neminėk dokumentų ID ir savivaldybės kontaktinių asmenų. Jei gyventojas pavojuje, nukreipk į numerį 112. Naudok markdown jei aktualu. Pasitelkdams tau pateiktą informaciją, kurią turi kontekste, atsakyk piliečiui į jo klausimą. Jei neaišku ar klausimas apie mokyklas ar apie darželius, paklausk prieš atsakydamas. Niekada neminėk dokumentų ID. Visada minėk paslaugų arba DUK nuorodas.

LABAI SVARBU: Atidžiai peržiūrėk pokalbio istoriją, kad suprasi kontekstą. Dabartinis klausimas gali būti atsakymas į anksčiau užduotą klausimą arba tęsinys pokalbio. Analizuok, kaip dabartinis klausimas susijęs su ankstesniais pranešimais.`);

            // Create comprehensive user message with context, history, and current request
            const userMessage = this.buildComprehensiveUserMessage(query, chatHistory, context);
            
            // Build complete message array for LangChain
            const allMessages = [systemMessage, userMessage];
            console.log('📋 Final message array:', allMessages.length, 'messages');
            console.log('📋 Message breakdown:', allMessages.map((m, i) => `${i}: ${m.constructor.name} (${m.content.length} chars)`));
            
            debugInfo.step5_promptConstruction = {
                messageCount: allMessages.length,
                systemMessageLength: systemMessage.content.length,
                userMessageLength: userMessage.content.length,
                conversationHistoryLength: chatHistory.length,
                contextLength: context.length,
                currentQuery: query,
                finalSystemPrompt: systemMessage.content,
                finalUserMessage: userMessage.content,
                messageStructure: allMessages.map(m => ({
                    type: m.constructor.name,
                    contentLength: m.content.length,
                    contentPreview: m.content.substring(0, 200) + (m.content.length > 200 ? '...' : '')
                })),
                fullMessageArray: includeDebug ? allMessages.map(m => ({
                    type: m.constructor.name,
                    content: m.content
                })) : undefined
            };

            // Get response from LLM using proper message array with timeout
            console.log('🤖 Calling LLM with message array...');
            console.log('📊 System message:', allMessages[0].content.length, 'chars');
            console.log('📊 User message (with context):', allMessages[1].content.length, 'chars');
            console.log('📊 Total token estimate:', (allMessages[0].content.length + allMessages[1].content.length) / 4, 'tokens');
            
            // Add timeout to prevent hanging (longer timeout for large contexts)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('LLM call timeout after 60 seconds')), 60000)
            );
            
            const llmPromise = this.llm.invoke(allMessages);
            
            let response;
            try {
                response = await Promise.race([llmPromise, timeoutPromise]);
                console.log('✅ LLM response received, length:', (response.content || response.text || '').length);
            } catch (timeoutError) {
                console.error('⏰ LLM call timed out or failed:', timeoutError.message);
                
                // Ensure debug info is preserved even on timeout/error
                debugInfo.step6_llmResponse = {
                    model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
                    temperature: 0.2,
                    inputMessages: allMessages.length,
                    error: timeoutError.message,
                    failed: true,
                    timestamp: new Date().toISOString()
                };
                
                throw timeoutError;
            }
            
            debugInfo.step6_llmResponse = {
                model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
                temperature: 0.2,
                inputMessages: allMessages.length,
                rawResponse: response,
                extractedContent: response.content || response.text,
                responseLength: (response.content || response.text || '').length,
                modelConfig: {
                    baseURL: "https://openrouter.ai/api/v1",
                    temperature: 0.2,
                    streaming: false,
                    messageFormat: "LangChain messages"
                }
            };

            // Format sources with URLs when available
            const sources = relevantContexts?.map(c => {
                const sourceName = c.metadata?.source_document_name;
                const sourceUrl = c.metadata?.source_url;
                
                if (sourceName && sourceUrl) {
                    return `${sourceName} (${sourceUrl})`;
                } else if (sourceName) {
                    return sourceName;
                }
                return null;
            }).filter(Boolean) || [];
            
            const result = {
                answer: response.content || response.text || 'Atsiprašau, negaliu atsakyti į šį klausimą.',
                contextsUsed: relevantContexts?.length || 0,
                sources: sources,
                sourceUrls: relevantContexts?.map(c => c.metadata?.source_url).filter(Boolean) || [],
                debugInfo: includeDebug ? debugInfo : undefined
            };
            
            debugInfo.step7_finalResult = {
                answer: result.answer,
                contextsUsed: result.contextsUsed,
                sources: result.sources,
                sourceUrls: result.sourceUrls,
                answerLength: result.answer.length
            };

            return result;

        } catch (error) {
            console.error('🔮 LangChain RAG Error:', error);
            console.error('🔮 Error stack:', error.stack);
            
            // Always populate debug info even on error
            debugInfo.error = {
                message: error.message,
                stack: error.stack,
                step: 'langchain_rag_processing',
                timestamp: new Date().toISOString()
            };
            
            // Ensure step5 is populated even on error
            if (!debugInfo.step5_messageConstruction) {
                debugInfo.step5_promptConstruction = {
                    error: 'Message construction failed',
                    errorDetails: error.message,
                    timestamp: new Date().toISOString()
                };
            }
            
            debugInfo.step7_finalResult = {
                answer: 'Atsiprašau, įvyko klaida apdorojant užklausą.',
                contextsUsed: 0,
                sources: [],
                sourceUrls: [],
                error: true,
                errorMessage: error.message
            };
            
            const errorResult = {
                answer: 'Atsiprašau, įvyko klaida apdorojant užklausą.',
                contextsUsed: 0,
                sources: [],
                sourceUrls: [],
                debugInfo: includeDebug ? debugInfo : undefined
            };
            
            return errorResult;
        }
    }

    /**
     * Format retrieved contexts as clean, well-separated markdown
     * Only includes fields that have actual data, optimized for large chunks
     */
    formatContextAsMarkdown(contexts) {
        return contexts.map((doc, index) => {
            const title = doc.metadata?.source_document_name || `Dokumentas ${index + 1}`;
            const sourceUrl = doc.metadata?.source_url;
            const category = doc.metadata?.category;
            const chunkInfo = this.extractChunkInfo(doc.metadata);
            
            // Build clean title section
            let markdown = `\n## ${title}\n\n`;
            
            // Add metadata only if data exists
            const metadata = [];
            if (sourceUrl) {
                metadata.push(`**Šaltinis:** ${sourceUrl}`);
            }
            if (category && category !== 'uploaded_document') {
                metadata.push(`**Kategorija:** ${category}`);
            }
            if (chunkInfo) {
                metadata.push(`**Dalis:** ${chunkInfo}`);
            }
            
            // Only add metadata section if we have actual metadata
            if (metadata.length > 0) {
                markdown += metadata.join(' | ') + '\n\n';
            }
            
            // Add the actual content with proper spacing
            markdown += doc.content.trim();
            
            return markdown;
        }).join('\n\n---\n\n');
    }

    /**
     * Build comprehensive user message with context, history, and current request
     * @param {string} currentQuery - Current user question
     * @param {Array} chatHistory - Conversation history
     * @param {string} context - Retrieved document context
     * @returns {HumanMessage} Complete user message
     */
    buildComprehensiveUserMessage(currentQuery, chatHistory, context) {
        let userMessageContent = `KLAUSIMAS: ${currentQuery}\n\n`;
        
        // Add conversation history if it exists and has actual content
        if (chatHistory && chatHistory.length > 0) {
            let historyContent = '';
            
            chatHistory.forEach((exchange, index) => {
                const userMsg = exchange[0];
                const assistantMsg = exchange[1];
                
                // Only add if not the current query (avoid duplicates)
                if (userMsg && userMsg.trim() && userMsg.trim() !== currentQuery.trim()) {
                    historyContent += `[User]: ${userMsg}\n`;
                    
                    if (assistantMsg && assistantMsg.trim() && 
                        assistantMsg !== '(Laukiama atsakymo)' && 
                        assistantMsg !== 'Laukiama atsakymo') {
                        historyContent += `[Assistant]: ${assistantMsg}\n`;
                    }
                    historyContent += `\n`;
                }
            });
            
            // Only add the "POKALBIO ISTORIJA:" header if there's actual history content
            if (historyContent.trim()) {
                userMessageContent += `POKALBIO ISTORIJA:\n${historyContent}`;
            }
        }
        
        // Add context documents
        userMessageContent += `TURIMI DUOMENYS:\n${context}\n\n`;
        
        // Repeat the question for emphasis
        userMessageContent += `KLAUSIMAS: ${currentQuery}`;
        
        return new HumanMessage(userMessageContent);
    }

    /**
     * Legacy method - kept for reference but no longer used
     * Now using buildComprehensiveUserMessage() approach instead
     */
    convertToLangChainMessages(chatHistory, currentQuery) {
        // This method is no longer used - we now build a comprehensive user message
        // that includes context, history, and current request in a single message
        console.log('⚠️ Legacy convertToLangChainMessages called - should use buildComprehensiveUserMessage');
        return [];
    }

    /**
     * Extract meaningful chunk information from metadata
     * Optimized for large chunks and minimal redundant info
     */
    extractChunkInfo(metadata) {
        // Check if we have specific chunk index information
        if (metadata?.chunk_index !== undefined) {
            const chunkIndex = metadata.chunk_index;
            
            // For large documents that are split, show meaningful part info
            if (chunkIndex === 0) {
                return "pradžia";
            } else if (metadata?.total_chunks && chunkIndex === metadata.total_chunks - 1) {
                return "pabaiga";
            } else if (metadata?.total_chunks && metadata.total_chunks > 1) {
                return `${chunkIndex + 1} dalis`;
            }
        }
        
        // If document has multiple chunks but we don't know which one
        if (metadata?.document_chunks && metadata.document_chunks > 1) {
            return `viena iš ${metadata.document_chunks} dalių`;
        }
        
        // For content length indication (useful for large chunks)
        if (metadata?.chunk_length) {
            const length = metadata.chunk_length;
            if (length > 20000) {
                return "išsamus turinys";
            } else if (length > 10000) {
                return "platus turinys";
            } else if (length > 5000) {
                return "detalus turinys";
            }
        }
        
        // Check document type for better context
        if (metadata?.content_type === 'api_document') {
            return "API duomenys";
        } else if (metadata?.upload_source === 'api') {
            return "importuotas turinys";
        }
        
        // Return null for default case - will be filtered out
        return null;
    }
}

module.exports = LangChainRAG;