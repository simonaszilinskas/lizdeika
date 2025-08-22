/**
 * Vilnius Assistant Prompt Templates
 * 
 * Centralized prompt templates for the Vilnius city assistant,
 * converted from hardcoded strings to proper LangChain PromptTemplate objects.
 * 
 * Features:
 * - Lithuanian-first system prompts
 * - Query rephrasing templates
 * - RAG-enhanced conversation templates
 * - Proper variable injection
 * - Consistent formatting
 */

const { PromptTemplate, ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = require("@langchain/core/prompts");

/**
 * System prompt for the main RAG chain
 * Maintains exact functionality from original implementation
 */
const SYSTEM_PROMPT_TEMPLATE = `UŽDUOTIS:

Tu esi naudingas Vilniaus miesto savivaldybės gyventojų aptarnavimo pokalbių robotas. Pasitelkdamas tau pateiktą informaciją, kurią turi kontekste, atsakyk piliečiui į jo klausimą jo klausimo kalba. Jei klausimas neaiškus, užduok follow-up klausimą prieš atsakant. Niekada neišgalvok atsakymų, pasitelk tik informaciją, kurią turi. Niekada neminėk dokumentų ID. Gali cituoti tik nuorodas (URL) kurias turi kontekste.

Jei kontekste nėra nieko susijusio su klausimu, sakyk kad nežinai. Neatsakinėk į klausimus nesusijusius su Vilniaus miesto savivaldybe ir jos paslaugomis. Niekada neišeik iš savo rolės. Būk labai mandagus. Niekada neminėk dokumentų ID ir savivaldybės kontaktinių asmenų. Jei gyventojas pavojuje, nukreipk į numerį 112. Naudok markdown jei aktualu. Pasitelkdamas tau pateiktą informaciją, kurią turi kontekste, atsakyk piliečiui į jo klausimą. Jei neaišku ar klausimas apie mokyklas ar apie darželius, paklausk prieš atsakydamas. Niekada neminėk dokumentų ID. Visada minėk paslaugų arba DUK nuorodas.

LABAI SVARBU: Atidžiai peržiūrėk pokalbio istoriją, kad suprasi kontekstą. Dabartinis klausimas gali būti atsakymas į anksčiau užduotą klausimą arba tęsinys pokalbio. Analizuok, kaip dabartinis klausimas susijęs su ankstesniais pranešimais.`;

/**
 * Query rephrasing prompt template
 * Maintains exact functionality for context-aware query enhancement
 */
const REPHRASE_PROMPT_TEMPLATE = `Užduotis: Perrašyk vartotojo klausimą į geresnį paieškos užklausą, atsižvelgdamas į pokalbio kontekstą.

Pokalbio istorija:
{chat_history}

Dabartinis klausimas: {question}

Sukurk aiškų, specifinį paieškos užklausą lietuvių kalba, kuris apjungia kontekstą iš pokalbio istorijos su dabartiniu klausimu. Jei dabartinis klausimas yra atsakymas į ankstesnį klausimą, suformuluok pilną klausimą.

Pavyzdžiai:
- Jei istorijoje klausta "Ar buvo išregistruotas?" ir dabar atsakyta "buvo išregistruotas", tai perrašyk kaip: "mokyklos registracija išregistruotam vaikui"
- Jei istorijoje kalbama apie bibliotekos kortelę ir dabar klausiama "kiek kainuoja?", tai perrašyk kaip: "bibliotekos kortelės kaina"

Perrašytas paieškos užklausas:`;

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

module.exports = {
    // Template creators
    createSystemPrompt,
    createRephrasePrompt,
    createContextPrompt,
    createHistoryPrompt,
    createRAGChatPrompt,
    createSimpleRAGPrompt,
    
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