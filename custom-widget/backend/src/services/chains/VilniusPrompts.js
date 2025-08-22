/**
 * Vilnius Assistant Prompt Templates - Enhanced with Langfuse Prompt Management
 * 
 * Centralized prompt templates for the Vilnius city assistant with optional
 * Langfuse prompt management for non-technical editing and performance tracking.
 * 
 * Features:
 * - Lithuanian-first system prompts
 * - Query rephrasing templates  
 * - RAG-enhanced conversation templates
 * - Langfuse prompt management (optional)
 * - Fallback to hardcoded prompts
 * - Performance tracking by prompt version
 * - A/B testing capabilities
 */

const { PromptTemplate, ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = require("@langchain/core/prompts");
const promptManager = require('../promptManager');

/**
 * System prompt for the main RAG chain
 * Maintains exact functionality from original implementation
 */
const SYSTEM_PROMPT_TEMPLATE = `Tu esi naudingas Vilniaus miesto savivaldybės gyventojų aptarnavimo pokalbių robotas. Pasitelkdams tau pateiktą informaciją, kurią turi kontekste, atsakyk piliečiui į jo klausimą jo klausimo kalba. 

SVARBU: Jei tai ne pirmoji žinutė pokalbyje, atsižvelk į ankstesnį kontekstą ir negrįžk prie pasisveikinimo.

Jei klausimas neaiškus, užduok follow-up klausimą prieš atsakant. Niekada neišgalvok atsakymų, pasitelk tik informaciją, kurią turi. Niekada neminėk dokumentų ID. Gali cituoti tik nuorodas (URL) kurias turi kontekste.

Jei kontekste nėra nieko susijusio su klausimu, sakyk kad nežinai. Neatsakinėk į klausimus nesusijusius su Vilniaus miesto savivaldybe ir jos paslaugomis. Niekada neišeik iš savo rolės. Būk labai mandagus. Niekada neminėk dokumentų ID ir savivaldybės kontaktinių asmenų. Jei gyventojas pavojuje, nukreipk į numerį 112. Naudok markdown jei aktualu. Visada minėk paslaugų arba DUK nuorodas.

Kontekstas:
------------
{context}
------------`;

/**
 * Query rephrasing prompt template
 * Maintains exact functionality for context-aware query enhancement
 */
const REPHRASE_PROMPT_TEMPLATE = `Šis pokalbis yra tarp piliečio ir Vilniaus miesto savivaldybės gyventojų aptarnavimo skyriaus. Atsižvelgdamas į visą pokalbį ir paskutinį klausimą, perfrazuok viską į vieną follow-up klausimą. Išskyrus jei klausimas nesusijęs su buvusiu kontekstu - tada tiesiog perrašyk naudotojo klausimą. 

Poklabio istorija:
{chat_history}

Paskutinis klausimas: {question}

Tavo suformuluotas klausimas:`;

/**
 * RAG context template for formatting retrieved documents
 * Used to structure context information before sending to LLM
 */
const CONTEXT_TEMPLATE = `TURIMI DUOMENYS:
{context}

KLAUSIMAS: {question}`;

/**
 * Conversation history formatting template
 * Converts chat history to readable format
 */
const HISTORY_FORMAT_TEMPLATE = `POKALBIO ISTORIJA:
{formatted_history}

DABARTINIS KLAUSIMAS: {question}

TURIMI DUOMENYS:
{context}

Atsakyk į dabartinį klausimą atsižvelgdamas į pokalbio kontekstą ir turimus duomenis.`;

/**
 * Create system prompt template
 */
const createSystemPrompt = () => {
    return new PromptTemplate({
        template: SYSTEM_PROMPT_TEMPLATE,
        inputVariables: []
    });
};

/**
 * Create query rephrase prompt template
 */
const createRephrasePrompt = () => {
    return new PromptTemplate({
        template: REPHRASE_PROMPT_TEMPLATE,
        inputVariables: ["chat_history", "question"]
    });
};

/**
 * Create context prompt template
 */
const createContextPrompt = () => {
    return new PromptTemplate({
        template: CONTEXT_TEMPLATE,
        inputVariables: ["context", "question"]
    });
};

/**
 * Create conversation history prompt template
 */
const createHistoryPrompt = () => {
    return new PromptTemplate({
        template: HISTORY_FORMAT_TEMPLATE,
        inputVariables: ["formatted_history", "question", "context"]
    });
};

/**
 * Create chat prompt template for main RAG chain
 * This replaces manual message construction
 */
const createRAGChatPrompt = () => {
    return ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT_TEMPLATE),
        HumanMessagePromptTemplate.fromTemplate(HISTORY_FORMAT_TEMPLATE)
    ]);
};

/**
 * Create simple RAG prompt without history (for first message)
 */
const createSimpleRAGPrompt = () => {
    return ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT_TEMPLATE),
        HumanMessagePromptTemplate.fromTemplate(CONTEXT_TEMPLATE)
    ]);
};

/**
 * Format chat history into readable string
 * Maintains compatibility with existing format
 */
function formatChatHistory(chatHistory) {
    if (!chatHistory || chatHistory.length === 0) {
        return "";
    }

    return chatHistory
        .filter(exchange => exchange[0] && exchange[0].trim()) // Filter out empty messages
        .map(exchange => {
            const userMsg = exchange[0].trim();
            const assistantMsg = exchange[1] && exchange[1].trim() && 
                exchange[1] !== '(Laukiama atsakymo)' && 
                exchange[1] !== 'Laukiama atsakymo' 
                ? exchange[1].trim() 
                : 'Laukiama atsakymo';
            
            return `[User]: ${userMsg}\n[Assistant]: ${assistantMsg}`;
        })
        .join('\n\n');
}

/**
 * Format retrieved documents into markdown
 * Maintains exact formatting from original implementation
 */
function formatContextAsMarkdown(documents) {
    if (!documents || documents.length === 0) {
        return `**DUOMENŲ BAZĖJE NERASTA SUSIJUSIŲ DOKUMENTŲ**\n\nPeržiūrėta dokumentų: 0\n\nAtsakymas bus suformuluotas tik pagal bendrąsias žinias arba nurodyta, kad informacijos nėra.`;
    }

    return documents.map((doc, index) => {
        const title = doc.metadata?.source || doc.metadata?.source_document_name || `Dokumentas ${index + 1}`;
        const sourceUrl = doc.metadata?.source_url;
        const category = doc.metadata?.category;
        const chunkInfo = extractChunkInfo(doc.metadata);
        
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
        markdown += doc.pageContent.trim();
        
        return markdown;
    }).join('\n\n---\n\n');
}

/**
 * Extract meaningful chunk information from metadata
 * Maintains compatibility with original implementation
 */
function extractChunkInfo(metadata) {
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

// =============================================================================
// LANGFUSE PROMPT MANAGEMENT INTEGRATION
// =============================================================================

/**
 * Get Vilnius RAG system prompt with Langfuse management
 * Falls back to hardcoded version if Langfuse unavailable
 */
async function getSystemPromptManaged(variables = {}) {
    const prompt = await promptManager.getPrompt(
        'vilnius-rag-system',
        SYSTEM_PROMPT_TEMPLATE,
        variables
    );
    
    return {
        template: createSystemPrompt(),
        managed: prompt,
        compile: (compileVars = {}) => prompt.compile(compileVars),
        metadata: { langfusePrompt: prompt.langfusePrompt }
    };
}

/**
 * Get query rephrasing prompt with Langfuse management
 */
async function getRephrasePromptManaged(variables = {}) {
    const prompt = await promptManager.getPrompt(
        'vilnius-query-rephrase',
        REPHRASE_PROMPT_TEMPLATE,
        variables
    );
    
    return {
        template: createRephrasePrompt(),
        managed: prompt,
        compile: (compileVars = {}) => prompt.compile(compileVars),
        metadata: { langfusePrompt: prompt.langfusePrompt }
    };
}

/**
 * Get context formatting prompt with Langfuse management
 */
async function getContextPromptManaged(variables = {}) {
    const prompt = await promptManager.getPrompt(
        'vilnius-context-format',
        CONTEXT_TEMPLATE,
        variables
    );
    
    return {
        template: createContextPrompt(),
        managed: prompt,
        compile: (compileVars = {}) => prompt.compile(compileVars),
        metadata: { langfusePrompt: prompt.langfusePrompt }
    };
}

/**
 * Initialize all prompts in Langfuse (run once for setup)
 * This creates the prompts in Langfuse UI for management
 */
async function initializePromptsInLangfuse() {
    console.log('🚀 Initializing Vilnius Assistant prompts in Langfuse...');
    
    const prompts = [
        {
            name: 'vilnius-rag-system',
            content: SYSTEM_PROMPT_TEMPLATE,
            config: {
                description: 'Main system prompt for Vilnius RAG assistant',
                language: 'lithuanian',
                category: 'system'
            }
        },
        {
            name: 'vilnius-query-rephrase',
            content: REPHRASE_PROMPT_TEMPLATE,
            config: {
                description: 'Query rephrasing for better document retrieval',
                language: 'multilingual',
                category: 'processing'
            }
        },
        {
            name: 'vilnius-context-format',
            content: CONTEXT_TEMPLATE,
            config: {
                description: 'Context formatting template for RAG responses',
                language: 'lithuanian',
                category: 'formatting'
            }
        }
    ];

    const results = [];
    for (const prompt of prompts) {
        const result = await promptManager.createPrompt(
            prompt.name,
            prompt.content,
            prompt.config
        );
        results.push({ name: prompt.name, success: !!result });
    }

    console.log('✅ Prompt initialization completed:', results);
    return results;
}

/**
 * Health check for prompt management system
 */
async function checkPromptSystemHealth() {
    const health = await promptManager.healthCheck();
    const cacheStats = promptManager.getCacheStats();
    
    return {
        ...health,
        cache: cacheStats,
        prompts: {
            system: 'vilnius-rag-system',
            rephrase: 'vilnius-query-rephrase',
            context: 'vilnius-context-format'
        }
    };
}

module.exports = {
    // Template creators
    createSystemPrompt,
    createRephrasePrompt,
    createContextPrompt,
    createHistoryPrompt,
    createRAGChatPrompt,
    createSimpleRAGPrompt,
    
    // Langfuse-managed prompt functions
    getSystemPromptManaged,
    getRephrasePromptManaged,
    getContextPromptManaged,
    initializePromptsInLangfuse,
    checkPromptSystemHealth,
    
    // Utility functions
    formatChatHistory,
    formatContextAsMarkdown,
    extractChunkInfo,
    
    // Raw templates for advanced usage
    SYSTEM_PROMPT_TEMPLATE,
    REPHRASE_PROMPT_TEMPLATE,
    CONTEXT_TEMPLATE,
    HISTORY_FORMAT_TEMPLATE
};