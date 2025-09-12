/**
 * CONTEXT ENGINEERING CONSTANTS
 * 
 * Centralized constants for the Context Engineering module
 * Reduces magic strings and improves maintainability
 * 
 * @version 1.0.0
 */

export const CONTEXT_ENGINEERING_CONSTANTS = {
    // Prompt Types
    PROMPT_TYPES: {
        SYSTEM: 'system',
        PROCESSING: 'processing', 
        FORMATTING: 'formatting'
    },

    // Prompt Modes
    MODES: {
        LANGFUSE: 'langfuse',
        LOCAL: 'local'
    },

    // Required Variables for each prompt type
    REQUIRED_VARIABLES: {
        system: ['{context}'],
        processing: ['{chat_history}', '{question}'],
        formatting: ['{context}', '{question}']
    },

    // All valid variables that can be used in prompts
    VALID_VARIABLES: ['{context}', '{question}', '{chat_history}'],

    // DOM Element IDs
    DOM_IDS: {
        // Form elements
        RAG_K_SLIDER: 'rag-k',
        RAG_K_VALUE: 'rag-k-value',
        SIMILARITY_THRESHOLD: 'similarity-threshold',
        SIMILARITY_VALUE: 'similarity-threshold-value',
        MAX_TOKENS: 'max-tokens',
        MAX_TOKENS_VALUE: 'max-tokens-value',
        
        // Mode selection
        MODE_LANGFUSE: 'mode-langfuse',
        MODE_LOCAL: 'mode-local',
        
        // Configuration sections
        LANGFUSE_CONFIG: 'langfuse-config',
        LOCAL_CONFIG: 'local-config',
        
        // Langfuse prompt selectors
        SYSTEM_LANGFUSE_PROMPT: 'system-langfuse-prompt',
        PROCESSING_LANGFUSE_PROMPT: 'processing-langfuse-prompt',
        FORMATTING_LANGFUSE_PROMPT: 'formatting-langfuse-prompt',
        
        // Local prompt textareas
        LOCAL_SYSTEM_PROMPT: 'local-system-prompt',
        LOCAL_PROCESSING_PROMPT: 'local-processing-prompt',
        LOCAL_FORMATTING_PROMPT: 'local-formatting-prompt',
        
        // Preview elements
        SYSTEM_PROMPT_PREVIEW: 'system-prompt-preview',
        PROCESSING_PROMPT_PREVIEW: 'processing-prompt-preview', 
        FORMATTING_PROMPT_PREVIEW: 'formatting-prompt-preview',
        
        // Validation elements
        SYSTEM_VALIDATION: 'system-validation',
        PROCESSING_VALIDATION: 'processing-validation',
        FORMATTING_VALIDATION: 'formatting-validation',
        
        // Save/status elements
        SAVE_RAG_SETTINGS: 'save-rag-settings',
        SAVE_PROMPT_CONFIG: 'save-prompt-config',
        RAG_SAVE_STATUS: 'rag-save-status',
        PROMPT_SAVE_STATUS: 'prompt-save-status',
        
        // Form
        CONTEXT_ENGINEERING_FORM: 'context-engineering-form'
    },

    // CSS Classes
    CSS_CLASSES: {
        HIDDEN: 'hidden',
        ERROR_BORDER: 'border-red-500',
        SUCCESS_BORDER: 'border-green-500',
        LOADING: 'opacity-50',
        VALIDATION_ERROR: 'text-red-600',
        VALIDATION_SUCCESS: 'text-green-600'
    },

    // API Endpoints
    API_ENDPOINTS: {
        RAG_SETTINGS: '/api/system/ai',
        PROMPT_SETTINGS: '/api/system/prompts',
        LANGFUSE_PROMPTS: '/api/prompts',
        LANGFUSE_STATUS: '/api/langfuse/status'
    },

    // Default Values
    DEFAULTS: {
        RAG_K: 100,
        SIMILARITY_THRESHOLD: 0.7,
        MAX_TOKENS: 2000,
        PROMPT_MODE: 'local'
    },

    // Validation Messages
    VALIDATION_MESSAGES: {
        EMPTY_PROMPT: 'Prompt cannot be empty',
        MISSING_VARIABLE: 'Missing required variable',
        UNKNOWN_VARIABLE: 'Unknown variable(s)',
        INVALID_PROMPT_TYPE: 'Invalid prompt type specified'
    },

    // User Messages
    USER_MESSAGES: {
        SAVING_RAG: 'Saving RAG configuration...',
        SAVING_PROMPTS: 'Saving prompt configuration...',
        SAVE_SUCCESS: 'Configuration saved successfully!',
        SAVE_ERROR: 'Failed to save configuration',
        LOADING_PROMPTS: 'Loading available prompts...',
        VALIDATION_ERROR: 'Cannot save configuration due to validation errors'
    },

    // Prompt Placeholders
    PLACEHOLDERS: {
        SYSTEM: `Esi Vilniaus miesto savivaldybės gyventojų aptarnavimo specialistas.

Tavo tikslas - padėti piliečiams spręsti problemas, susijusias su:
- Vilniaus miesto paslaugomis
- Administraciniais klausimais  
- Gyvenimo kokybės problemomis

Kontekstas iš žinių bazės:
{context}

Atsakyk tiksliai, pagarbiai ir profesionaliai lietuvių kalba.`,

        PROCESSING: `Šis pokalbis yra tarp piliečio ir Vilniaus miesto savivaldybės gyventojų aptarnavimo skyriaus. Atsižvelgdamas į visą pokalbį ir paskutinį klausimą, perfrazuok viską į vieną follow-up klausimą. Išskyrus jei klausimas nesusijęs su buvusiu kontekstu - tada tiesiog perrašyk naudotojo klausimą.

Poklabio istorija:
{chat_history}

Paskutinis klausimas: {question}

Tavo suformuluotas klausimas:`,

        FORMATTING: `Kontekstas iš dokumentų:
{context}

Piliečio klausimas:
{question}`
    },

    // Role Descriptions
    ROLE_DESCRIPTIONS: {
        SYSTEM: {
            TITLE: "Sets the AI's core identity, behavior, and capabilities",
            DETAILS: "This is the foundational prompt that defines who the AI is and how it should behave across all interactions."
        },
        PROCESSING: {
            TITLE: "Enhances user questions for better document retrieval", 
            DETAILS: "This prompt reformulates user questions using conversation history to improve RAG document matching before retrieval."
        },
        FORMATTING: {
            TITLE: "Structures how context and questions are presented to the AI",
            DETAILS: "This prompt formats retrieved documents and user questions for optimal AI processing and response generation."
        }
    },

    // Event Names
    EVENTS: {
        RAG_SETTINGS_CHANGED: 'ragSettingsChanged',
        PROMPT_MODE_CHANGED: 'promptModeChanged',
        VALIDATION_CHANGED: 'validationChanged',
        SAVE_STARTED: 'saveStarted',
        SAVE_COMPLETED: 'saveCompleted',
        SAVE_FAILED: 'saveFailed'
    }
};

export default CONTEXT_ENGINEERING_CONSTANTS;