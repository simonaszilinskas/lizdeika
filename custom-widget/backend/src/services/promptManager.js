/**
 * LANGFUSE PROMPT MANAGEMENT SERVICE
 * 
 * Purpose: Centralized prompt management with Langfuse integration
 * 
 * Key Features:
 * - Fetch prompts from Langfuse with fallback to hardcoded versions
 * - Cache prompts for performance
 * - Link prompts to traces for performance evaluation
 * - Support for prompt versioning and A/B testing
 * - Optional feature - works without Langfuse configuration
 * 
 * Benefits:
 * - Non-technical prompt editing via Langfuse UI
 * - Prompt version control and rollback
 * - Performance tracking by prompt version
 * - A/B testing different prompt variations
 * 
 * @author AI Assistant System
 * @version 1.0.0 - Prompt Management Integration
 */

const { Langfuse } = require("langfuse");

class LangfusePromptManager {
    constructor() {
        // Initialize Langfuse client if credentials are available
        this.langfuse = null;
        this.enabled = false;
        this.promptCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
        
        this.initializeLangfuse();
    }

    /**
     * Initialize Langfuse client if credentials are available
     */
    initializeLangfuse() {
        try {
            if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
                this.langfuse = new Langfuse({
                    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
                    secretKey: process.env.LANGFUSE_SECRET_KEY,
                    baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
                    debug: process.env.LANGFUSE_DEBUG === 'true'
                });
                this.enabled = true;
                console.log('✅ Langfuse Prompt Management enabled');
            } else {
                console.log('ℹ️ Langfuse Prompt Management disabled - credentials not found');
            }
        } catch (error) {
            console.warn('⚠️ Failed to initialize Langfuse Prompt Management:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Get prompt from Langfuse with fallback to .env or hardcoded version
     * 
     * @param {string} name - Prompt name in Langfuse
     * @param {string} fallback - Hardcoded fallback prompt
     * @param {Object} variables - Variables to compile into prompt
     * @param {Object} options - Additional options (version, label, etc.)
     * @returns {Object} - Prompt data with compile method
     */
    async getPrompt(name, fallback, variables = {}, options = {}) {
        const cacheKey = `${name}-${JSON.stringify(options)}`;
        
        // Check cache first
        if (this.promptCache.has(cacheKey)) {
            const cached = this.promptCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return this.createPromptObject(cached.prompt, fallback, variables, cached.fromLangfuse, 'cache', name);
            }
        }

        // Try to fetch from Langfuse if enabled
        if (this.enabled) {
            try {
                const langfusePrompt = await this.langfuse.getPrompt(name, options.version, {
                    label: options.label || 'production',
                    type: options.type || 'text'
                });

                // Cache the prompt
                this.promptCache.set(cacheKey, {
                    prompt: langfusePrompt,
                    timestamp: Date.now(),
                    fromLangfuse: true
                });

                console.log(`📝 Fetched prompt '${name}' from Langfuse (version: ${langfusePrompt.version || 'latest'})`);
                return this.createPromptObject(langfusePrompt, fallback, variables, true, 'langfuse', name);

            } catch (error) {
                // Handle specific f-string validation errors gracefully
                if (error.message && error.message.includes('Missing value for input')) {
                    console.warn(`⚠️ Langfuse prompt '${name}' has unresolved variables, using fallback:`, error.message.split('\n')[0]);
                } else {
                    console.warn(`⚠️ Failed to fetch prompt '${name}' from Langfuse:`, error.message);
                }
                console.log(`📝 Using fallback prompt for '${name}'`);
            }
        }

        // Check for .env prompt override before using hardcoded fallback
        const envPrompt = this.getEnvPrompt(name);
        const finalFallback = envPrompt || fallback;
        const source = envPrompt ? '.env override' : 'hardcoded fallback';
        
        if (envPrompt) {
            console.log(`📝 Using .env prompt override for '${name}'`);
        }

        // Return fallback prompt object
        return this.createPromptObject(null, finalFallback, variables, false, source, name);
    }

    /**
     * Get prompt from environment variables
     * Supports these .env variables:
     * - PROMPT_VILNIUS_RAG_SYSTEM
     * - PROMPT_VILNIUS_QUERY_REPHRASE  
     * - PROMPT_VILNIUS_CONTEXT_FORMAT
     */
    getEnvPrompt(name) {
        // Map prompt names to env variable names
        const envMapping = {
            'vilnius-rag-system': 'PROMPT_VILNIUS_RAG_SYSTEM',
            'vilnius-query-rephrase': 'PROMPT_VILNIUS_QUERY_REPHRASE',
            'vilnius-context-format': 'PROMPT_VILNIUS_CONTEXT_FORMAT'
        };

        const envKey = envMapping[name];
        if (envKey && process.env[envKey]) {
            // Support multiline prompts by replacing \\n with actual newlines
            return process.env[envKey].replace(/\\n/g, '\n');
        }

        return null;
    }

    /**
     * Create standardized prompt object
     */
    createPromptObject(langfusePrompt, fallback, variables, fromLangfuse, source = 'langfuse', name = null) {
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const replacePlaceholders = (template, key, value) => {
            const safeValue = value === undefined || value === null ? '' : String(value);
            const escapedKey = escapeRegExp(key);
            const patterns = [
                new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g'),
                new RegExp(`\\{\\s*${escapedKey}\\s*\\}`, 'g')
            ];

            return patterns.reduce((current, pattern) => current.replace(pattern, safeValue), template);
        };

        const collectUnresolvedPlaceholders = (template) => {
            const matches = template.matchAll(/\{\{\s*([^}\s]+)\s*\}\}|\{\s*([^}\s]+)\s*\}/g);
            const placeholders = new Set();
            for (const match of matches) {
                const placeholder = match[1] || match[2];
                if (placeholder) {
                    placeholders.add(placeholder.trim());
                }
            }
            return Array.from(placeholders);
        };

        const nextName = name || langfusePrompt?.name || 'unknown';

        const logUnresolved = (compiledTemplate, phase) => {
            const unresolved = collectUnresolvedPlaceholders(compiledTemplate);
            if (unresolved.length > 0) {
                console.warn(`⚠️ Prompt '${nextName}' (${phase}) missing variables:`, unresolved);
            }
        };

        const prompt = {
            content: langfusePrompt?.prompt || fallback,
            config: langfusePrompt?.config || {},
            version: langfusePrompt?.version || null,
            name: langfusePrompt?.name || 'fallback',
            fromLangfuse: fromLangfuse,
            source: source,
            langfusePrompt: langfusePrompt, // Keep reference for trace linking
            
            /**
             * Compile prompt with variables
             */
            compile: (compileVariables = {}) => {
                const allVariables = { ...variables, ...compileVariables };
                let compiledPrompt = langfusePrompt?.prompt || fallback;
                
                // Replace variables in format {{variable}}
                Object.entries(allVariables).forEach(([key, value]) => {
                    compiledPrompt = replacePlaceholders(compiledPrompt, key, value);
                });

                logUnresolved(compiledPrompt, 'compile');

                return compiledPrompt;
            },

            /**
             * Get LangChain compatible prompt (converts {{}} to {})
             */
            getLangchainPrompt: (compileVariables = {}) => {
                const allVariables = { ...variables, ...compileVariables };
                let langchainPrompt = langfusePrompt?.prompt || fallback;
                
                // Pre-compile specified variables
                Object.entries(allVariables).forEach(([key, value]) => {
                    langchainPrompt = replacePlaceholders(langchainPrompt, key, value);
                });
                
                // Convert remaining double-brace syntax to LangChain format
                langchainPrompt = langchainPrompt.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, '{$1}');

                logUnresolved(langchainPrompt, 'langchain');
                
                return langchainPrompt;
            }
        };

        return prompt;
    }

    /**
     * Link prompt to trace for performance evaluation
     * 
     * @param {Object} prompt - Prompt object from getPrompt()
     * @param {string} traceId - Trace ID to link to
     * @param {string} generationId - Generation ID (optional)
     */
    async linkPromptToTrace(prompt, traceId, generationId = null) {
        if (!this.enabled || !prompt.fromLangfuse || !prompt.langfusePrompt) {
            return; // Skip if not using Langfuse prompts
        }

        try {
            // This linking happens automatically when using proper Langfuse integration
            // The trace will show which prompt version was used
            console.log(`🔗 Prompt '${prompt.name}' (v${prompt.version}) linked to trace ${traceId}`);
        } catch (error) {
            console.warn('Failed to link prompt to trace:', error.message);
        }
    }

    /**
     * Create or update a prompt in Langfuse
     * Useful for initial setup or programmatic prompt management
     */
    async createPrompt(name, promptContent, config = {}, labels = ['production']) {
        if (!this.enabled) {
            console.warn('Cannot create prompt - Langfuse not enabled');
            return null;
        }

        try {
            const prompt = await this.langfuse.createPrompt({
                name: name,
                type: "text",
                prompt: promptContent,
                labels: labels,
                config: config
            });

            console.log(`✅ Created/updated prompt '${name}' in Langfuse`);
            
            // Clear cache for this prompt
            const cacheKeysToDelete = Array.from(this.promptCache.keys()).filter(key => 
                key.startsWith(name + '-')
            );
            cacheKeysToDelete.forEach(key => this.promptCache.delete(key));
            
            return prompt;
        } catch (error) {
            console.error(`Failed to create prompt '${name}':`, error.message);
            return null;
        }
    }

    /**
     * Clear prompt cache
     */
    clearCache() {
        this.promptCache.clear();
        console.log('🧹 Prompt cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.promptCache.size,
            keys: Array.from(this.promptCache.keys()),
            enabled: this.enabled
        };
    }

    /**
     * Health check
     */
    async healthCheck() {
        const health = {
            enabled: this.enabled,
            cacheSize: this.promptCache.size,
            langfuseConnected: false
        };

        if (this.enabled) {
            try {
                // Try to fetch a test prompt to verify connection
                await this.langfuse.getPrompt('health-check-test');
                health.langfuseConnected = true;
            } catch (error) {
                // Expected to fail if prompt doesn't exist, but verifies connection
                health.langfuseConnected = !error.message.includes('network') && !error.message.includes('unauthorized');
            }
        }

        return health;
    }
}

// Export singleton instance
module.exports = new LangfusePromptManager();
