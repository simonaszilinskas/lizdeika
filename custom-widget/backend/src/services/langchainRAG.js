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
 * @version 2.0.0
 */

const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const knowledgeService = require('./knowledgeService');
const SystemController = require('../controllers/systemController');

class LangChainRAG {
    constructor() {
        this.llm = new ChatOpenAI({
            model: "google/gemini-flash-1.5",
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

        this.promptTemplate = new PromptTemplate({
            inputVariables: ["context", "history", "question"],
            template: `UŽDUOTIS:

Tu esi naudingas Vilniaus miesto savivaldybės gyventojų aptarnavimo pokalbių robotas. Pasitelkdamas tau pateiktą informaciją, kurią turi kontekste, atsakyk piliečiui į jo klausimą jo klausimo kalba. 

LABAI SVARBU: Atidžiai peržiūrėk pokalbio istoriją, kad suprasi kontekstą. Dabartinis klausimas gali būti atsakymas į anksčiau užduotą klausimą arba tęsinys pokalbio. Analizuok, kaip dabartinis klausimas susijęs su ankstesniais pranešimais.

Jei klausimas neaiškus arba reikia daugiau informacijos, užduok follow-up klausimą prieš atsakant. Niekada neišgalvok atsakymų, pasitelk tik informaciją, kurią turi. Niekada neminėk dokumentų ID.

ŠALTINIŲ CITAVIMAS: Jei kontekste yra nuorodos (URL), cituok jas kaip "Daugiau informacijos: [URL]" savo atsakymo pabaigoje. Nuorodas rašyk pilnas ir tikslias.

Jei kontekste nėra nieko susijusio su klausimu, sakyk kad nežinai. Neatsakinėk į klausimus nesusijusius su Vilniaus miesto savivaldybe. Niekada neišeik iš savo rolės. Būk mandagus. Jei gyventojas pavojuje, nukreipk į numerį 112.

KONTEKSTAS:
{context}

POKALBIO ISTORIJA:
{history}

DABARTINIS KLAUSIMAS: {question}

ATSAKYMAS:`
        });
    }

    async getAnswer(query, chatHistory = []) {
        try {
            // Get RAG settings
            const ragConfig = SystemController.getRagConfig();
            const k = ragConfig.k || 3;

            // Rephrase query using conversation history for better retrieval
            let searchQuery = query;
            if (chatHistory && chatHistory.length > 0) {
                const historyForRephrase = chatHistory.map(exchange => 
                    `Vartotojas: ${exchange[0]}\nAsitentas: ${exchange[1]}`
                ).join('\n');

                const rephrasedQuery = await this.rephrasePrompt.format({
                    question: query,
                    history: historyForRephrase
                });

                const rephraseResponse = await this.rephraseModel.invoke(rephrasedQuery);
                searchQuery = rephraseResponse.content || query;
                
            }

            // Retrieve relevant documents using rephrased query
            const relevantContexts = await knowledgeService.searchContext(searchQuery, k);

            // Format context from documents with structured markdown
            const context = relevantContexts && relevantContexts.length > 0
                ? this.formatContextAsMarkdown(relevantContexts)
                : 'Nėra susijusių dokumentų';

            // Format chat history
            let historyText = "";
            if (chatHistory && chatHistory.length > 0) {
                historyText = chatHistory.map(exchange => 
                    `Vartotojas: ${exchange[0]}\nAsitentas: ${exchange[1]}`
                ).join('\n');
            } else {
                historyText = "Tai pirmas klausimas";
            }

            // Format the final prompt using LangChain template
            const finalPrompt = await this.promptTemplate.format({
                context: context,
                history: historyText,
                question: query
            });


            // Get response from LLM using LangChain's invoke method
            const response = await this.llm.invoke(finalPrompt);


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

            return {
                answer: response.content || response.text || 'Atsiprašau, negaliu atsakyti į šį klausimą.',
                contextsUsed: relevantContexts?.length || 0,
                sources: sources,
                sourceUrls: relevantContexts?.map(c => c.metadata?.source_url).filter(Boolean) || []
            };

        } catch (error) {
            console.error('🔮 LangChain RAG Error:', error);
            throw error;
        }
    }

    /**
     * Format retrieved contexts as structured markdown
     * Creates clean, separated chunks with metadata headers
     */
    formatContextAsMarkdown(contexts) {
        return contexts.map((doc, index) => {
            const title = doc.metadata?.source_document_name || 'Dokumento fragmentas';
            const sourceUrl = doc.metadata?.source_url || null;
            const date = doc.metadata?.last_updated 
                ? new Date(doc.metadata.last_updated).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];
            
            // Determine chunk info if available
            const chunkInfo = this.extractChunkInfo(doc.metadata);
            
            let markdown = `---
title: "${title}"
source: ${sourceUrl ? `"${sourceUrl}"` : 'null'}
date: "${date}"
chunk: "${chunkInfo}"
---

# ${title}

`;

            // Add source and date info
            if (sourceUrl) {
                markdown += `**Šaltinis:** ${sourceUrl}  \n`;
            }
            markdown += `**Data:** ${date}  \n`;
            markdown += `**Dalis:** ${chunkInfo}\n\n`;
            
            // Add the content (no internal separators)
            markdown += doc.content;
            
            return markdown;
        }).join('\n\n');
    }

    /**
     * Extract or generate chunk information from metadata
     */
    extractChunkInfo(metadata) {
        // If we have specific chunk metadata, use it
        if (metadata?.chunk_index !== undefined && metadata?.total_chunks !== undefined) {
            return `${metadata.chunk_index + 1} iš ${metadata.total_chunks}`;
        }
        
        // If we have document chunks info, try to infer
        if (metadata?.document_chunks) {
            return `dalis iš ${metadata.document_chunks}`;
        }
        
        // Default fallback
        return "dokumento dalis";
    }
}

module.exports = LangChainRAG;