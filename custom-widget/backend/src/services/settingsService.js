/**
 * RUNTIME SETTINGS SERVICE
 * 
 * Main Purpose: Manage runtime configuration settings with database storage and env var fallbacks
 * 
 * Key Responsibilities:
 * - Load and cache runtime settings from database
 * - Provide fallback to environment variables  
 * - Support hot-reload of settings without server restart
 * - Validate setting values against defined schemas
 * - Emit events when settings change for real-time updates
 * - Support categorized settings (branding, ai, security, etc)
 * 
 * Features:
 * - Memory caching with TTL refresh
 * - Type-safe setting validation using Zod schemas
 * - Admin-only setting modification with audit trails
 * - Public/private setting visibility control
 * - Automatic environment variable fallbacks
 * - WebSocket broadcast for real-time setting updates
 */

const { PrismaClient } = require('@prisma/client');
const { EventEmitter } = require('events');
const { z } = require('zod');
const { createLogger } = require('../utils/logger');

// Validation schemas for different setting types
const SETTING_SCHEMAS = {
    branding: {
        widget_name: z.string().min(1).max(100),
        widget_primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
        widget_allowed_domains: z.string().min(1),
        welcome_message: z.string().max(500).optional(),
        user_message_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional()
    },
    ai: {
        system_prompt: z.string().min(10).optional().or(z.literal('')),
        rag_k: z.number().int().min(1).max(200),
        rag_similarity_threshold: z.number().min(0.0).max(1.0).optional(),
        rag_max_tokens: z.number().int().min(500).max(4000).optional(),
        use_langfuse_prompts: z.boolean().optional()
    },
    logging: {
        log_level: z.enum(['debug', 'info', 'warn', 'error']),
        log_to_file: z.boolean(),
        log_to_database: z.boolean()
    },
    prompts: {
        // Master prompt mode toggle
        prompt_mode: z.enum(['langfuse', 'local']).optional(),
        
        // System prompt settings
        active_system_prompt: z.string().optional(),
        custom_system_prompt_content: z.string().optional(),
        
        // Processing prompt settings (for query rephrasing/processing)
        active_processing_prompt: z.string().optional(),
        custom_processing_prompt_content: z.string().optional(),
        
        // Formatting prompt settings (for response formatting)
        active_formatting_prompt: z.string().optional(),
        custom_formatting_prompt_content: z.string().optional(),
        
        // Global prompt management settings
        enable_prompt_management: z.boolean().optional(),
        default_prompt_labels: z.array(z.string()).optional(),
        prompt_cache_ttl: z.number().int().min(60).max(86400).optional()
    }
};

// Environment variable fallbacks
const ENV_FALLBACKS = {
    widget_name: process.env.WIDGET_NAME || 'Vilnius Assistant',
    widget_primary_color: process.env.WIDGET_PRIMARY_COLOR || '#2c5530',
    widget_allowed_domains: process.env.WIDGET_ALLOWED_DOMAINS || '*',
    welcome_message: process.env.WELCOME_MESSAGE || 'Hello! How can I help you today?',
    user_message_color: process.env.USER_MESSAGE_COLOR || '#3b82f6',
    system_prompt: process.env.SYSTEM_PROMPT || '',
    rag_k: parseInt(process.env.RAG_K) || 100,
    rag_similarity_threshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7,
    rag_max_tokens: parseInt(process.env.RAG_MAX_TOKENS) || 2000,
    use_langfuse_prompts: process.env.USE_LANGFUSE_PROMPTS === 'true',
    log_level: process.env.LOG_LEVEL || 'info',
    log_to_file: process.env.LOG_TO_FILE === 'true',
    log_to_database: process.env.LOG_TO_DATABASE !== 'false',
    
    // Prompt management fallbacks
    prompt_mode: process.env.PROMPT_MODE || 'langfuse',
    
    active_system_prompt: process.env.ACTIVE_SYSTEM_PROMPT || null,
    custom_system_prompt_content: process.env.CUSTOM_SYSTEM_PROMPT || '',
    
    active_processing_prompt: process.env.ACTIVE_PROCESSING_PROMPT || null,
    custom_processing_prompt_content: process.env.CUSTOM_PROCESSING_PROMPT || '',
    
    active_formatting_prompt: process.env.ACTIVE_FORMATTING_PROMPT || null,
    custom_formatting_prompt_content: process.env.CUSTOM_FORMATTING_PROMPT || '',
    
    enable_prompt_management: process.env.ENABLE_PROMPT_MANAGEMENT === 'true',
    default_prompt_labels: process.env.DEFAULT_PROMPT_LABELS ? JSON.parse(process.env.DEFAULT_PROMPT_LABELS) : ['production'],
    prompt_cache_ttl: parseInt(process.env.PROMPT_CACHE_TTL) || 300
};

class SettingsService extends EventEmitter {
    constructor() {
        super();
        this.prisma = new PrismaClient();
        this.logger = createLogger('settingsService');
        this.settingsCache = new Map();
        this.cacheExpiry = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        
        // Initialize settings on startup
        this.initialize();
    }

    /**
     * Initialize the settings service
     */
    async initialize() {
        try {
            this.logger.info('Initializing Settings Service');
            
            // Load all settings into cache
            await this.refreshCache();
            
            // Setup periodic cache refresh
            this.setupCacheRefresh();
            
            this.logger.info('Settings Service initialized successfully');
            this.emit('initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize Settings Service', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    /**
     * Get a setting value by key
     */
    async getSetting(key, category = null) {
        try {
            // Check cache first
            if (this.isValidCache(key)) {
                return this.settingsCache.get(key);
            }

            // Load from database
            const setting = await this.prisma.system_settings.findFirst({
                where: {
                    setting_key: key,
                    ...(category && { category })
                }
            });

            let value;
            if (setting && setting.setting_value !== null) {
                // Parse value based on type
                value = this.parseSettingValue(setting.setting_value, setting.setting_type);
                
                // Cache the parsed value
                this.setCacheValue(key, value);
            } else {
                // Fallback to environment variable
                value = ENV_FALLBACKS[key];
                this.logger.debug(`Using env fallback for setting: ${key}`, { value });
            }

            return value;
        } catch (error) {
            this.logger.error(`Failed to get setting: ${key}`, { error: error.message });
            
            // Return env fallback on error
            return ENV_FALLBACKS[key];
        }
    }

    /**
     * Get multiple settings by category
     */
    async getSettingsByCategory(category, includePrivate = false) {
        try {
            const where = { category };
            if (!includePrivate) {
                where.is_public = true;
            }

            const settings = await this.prisma.system_settings.findMany({ where });
            
            const result = {};
            for (const setting of settings) {
                const value = setting.setting_value !== null 
                    ? this.parseSettingValue(setting.setting_value, setting.setting_type)
                    : ENV_FALLBACKS[setting.setting_key];
                    
                result[setting.setting_key] = {
                    value,
                    type: setting.setting_type,
                    description: setting.description,
                    isPublic: setting.is_public,
                    updatedAt: setting.updated_at
                };
                
                // Update cache
                this.setCacheValue(setting.setting_key, value);
            }

            return result;
        } catch (error) {
            this.logger.error(`Failed to get settings by category: ${category}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Update a setting value (admin only)
     */
    async updateSetting(key, value, adminUserId, category = 'general') {
        try {
            this.logger.info(`Updating setting: ${key}`, { adminUserId, category });

            // Validate the setting value
            await this.validateSetting(key, value, category);
            
            // Convert value to string for storage
            const stringValue = this.stringifySettingValue(value);
            const settingType = this.getSettingType(value);

            // Update in database
            const updatedSetting = await this.prisma.system_settings.upsert({
                where: { setting_key: key },
                update: {
                    setting_value: stringValue,
                    setting_type: settingType,
                    updated_by: adminUserId,
                    updated_at: new Date()
                },
                create: {
                    setting_key: key,
                    setting_value: stringValue,
                    setting_type: settingType,
                    category,
                    updated_by: adminUserId,
                    is_public: this.isPublicSetting(key, category)
                }
            });

            // Update cache
            this.setCacheValue(key, value);
            
            // Emit change event for real-time updates
            this.emit('settingChanged', {
                key,
                value,
                category,
                adminUserId,
                timestamp: new Date()
            });

            this.logger.info(`Setting updated successfully: ${key}`, { 
                adminUserId, 
                newValue: typeof value === 'string' ? value : JSON.stringify(value) 
            });

            return updatedSetting;
            
        } catch (error) {
            this.logger.error(`Failed to update setting: ${key}`, { 
                error: error.message, 
                adminUserId 
            });
            throw error;
        }
    }

    /**
     * Update multiple settings in a transaction
     */
    async updateSettings(settings, adminUserId, category = 'general') {
        try {
            this.logger.info(`Bulk updating ${Object.keys(settings).length} settings`, { 
                adminUserId, 
                category,
                keys: Object.keys(settings)
            });

            const results = [];
            
            // Use transaction for consistency
            await this.prisma.$transaction(async (tx) => {
                for (const [key, value] of Object.entries(settings)) {
                    // Validate each setting
                    await this.validateSetting(key, value, category);
                    
                    const stringValue = this.stringifySettingValue(value);
                    const settingType = this.getSettingType(value);

                    const updatedSetting = await tx.system_settings.upsert({
                        where: { setting_key: key },
                        update: {
                            setting_value: stringValue,
                            setting_type: settingType,
                            updated_by: adminUserId,
                            updated_at: new Date()
                        },
                        create: {
                            setting_key: key,
                            setting_value: stringValue,
                            setting_type: settingType,
                            category,
                            updated_by: adminUserId,
                            is_public: this.isPublicSetting(key, category)
                        }
                    });

                    results.push(updatedSetting);
                    
                    // Update cache
                    this.setCacheValue(key, value);
                }
            });

            // Emit batch change event
            this.emit('settingsChanged', {
                settings,
                category,
                adminUserId,
                timestamp: new Date()
            });

            this.logger.info(`Bulk settings update completed`, { 
                adminUserId, 
                updatedCount: results.length 
            });

            return results;
            
        } catch (error) {
            this.logger.error('Failed to bulk update settings', { 
                error: error.message, 
                adminUserId,
                settingKeys: Object.keys(settings)
            });
            throw error;
        }
    }

    /**
     * Reset settings to default values
     */
    async resetSettings(category, adminUserId) {
        try {
            this.logger.info(`Resetting settings for category: ${category}`, { adminUserId });

            // Delete settings in category (will fall back to env vars)
            const deleted = await this.prisma.system_settings.deleteMany({
                where: { category }
            });

            // Clear cache for deleted settings
            const keys = Array.from(this.settingsCache.keys());
            for (const key of keys) {
                if (this.isSettingInCategory(key, category)) {
                    this.settingsCache.delete(key);
                    this.cacheExpiry.delete(key);
                }
            }

            this.emit('settingsReset', {
                category,
                adminUserId,
                deletedCount: deleted.count,
                timestamp: new Date()
            });

            this.logger.info(`Settings reset completed`, { 
                category, 
                adminUserId, 
                deletedCount: deleted.count 
            });

            return { deletedCount: deleted.count };
            
        } catch (error) {
            this.logger.error(`Failed to reset settings for category: ${category}`, { 
                error: error.message, 
                adminUserId 
            });
            throw error;
        }
    }

    // =========================
    // PRIVATE HELPER METHODS
    // =========================

    /**
     * Validate a setting value against its schema
     */
    async validateSetting(key, value, category) {
        const categorySchemas = SETTING_SCHEMAS[category];
        if (!categorySchemas) {
            throw new Error(`Unknown setting category: ${category}`);
        }

        const schema = categorySchemas[key];
        if (!schema) {
            throw new Error(`Unknown setting key '${key}' for category '${category}'`);
        }

        try {
            schema.parse(value);
        } catch (error) {
            throw new Error(`Invalid value for setting '${key}': ${error.message}`);
        }
    }

    /**
     * Parse setting value from string based on type
     */
    parseSettingValue(value, type) {
        switch (type) {
            case 'boolean':
                return value === 'true';
            case 'number':
                return Number(value);
            case 'json':
                return JSON.parse(value);
            case 'string':
            default:
                return value;
        }
    }

    /**
     * Convert setting value to string for database storage
     */
    stringifySettingValue(value) {
        switch (typeof value) {
            case 'boolean':
            case 'number':
                return String(value);
            case 'object':
                return JSON.stringify(value);
            case 'string':
            default:
                return value;
        }
    }

    /**
     * Get setting type from JavaScript value
     */
    getSettingType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'object') return 'json';
        return 'string';
    }

    /**
     * Check if setting should be publicly accessible
     */
    isPublicSetting(key, category) {
        // Most branding settings should be public for frontend access
        if (category === 'branding') {
            return ['widget_name', 'widget_primary_color', 'welcome_message', 'user_message_color'].includes(key);
        }
        
        // AI settings should be accessible to admins for context engineering
        if (category === 'ai') {
            return ['rag_k', 'rag_similarity_threshold', 'rag_max_tokens', 'use_langfuse_prompts'].includes(key);
        }
        
        // Prompt settings should be accessible to admins for prompt management
        if (category === 'prompts') {
            return [
                'prompt_mode',
                'active_system_prompt', 'custom_system_prompt_content',
                'active_processing_prompt', 'custom_processing_prompt_content',
                'active_formatting_prompt', 'custom_formatting_prompt_content',
                'enable_prompt_management'
            ].includes(key);
        }
        
        // Logging settings are typically private
        if (category === 'logging') {
            return false;
        }
        
        return false; // Default to private
    }

    /**
     * Check if setting belongs to a category (for cache management)
     */
    isSettingInCategory(key, category) {
        const categorySchemas = SETTING_SCHEMAS[category];
        return categorySchemas && categorySchemas[key] !== undefined;
    }

    /**
     * Cache management methods
     */
    isValidCache(key) {
        return this.settingsCache.has(key) && 
               this.cacheExpiry.has(key) && 
               this.cacheExpiry.get(key) > Date.now();
    }

    setCacheValue(key, value) {
        this.settingsCache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + this.cacheTTL);
    }

    /**
     * Refresh entire cache from database
     */
    async refreshCache() {
        try {
            const settings = await this.prisma.system_settings.findMany();
            
            for (const setting of settings) {
                const value = this.parseSettingValue(setting.setting_value, setting.setting_type);
                this.setCacheValue(setting.setting_key, value);
            }
            
            this.logger.debug(`Cache refreshed with ${settings.length} settings`);
        } catch (error) {
            this.logger.error('Failed to refresh settings cache', { error: error.message });
        }
    }

    /**
     * Setup periodic cache refresh
     */
    setupCacheRefresh() {
        setInterval(() => {
            this.refreshCache();
        }, this.cacheTTL);
    }

    /**
     * Check if Langfuse credentials are configured
     */
    isLangfuseAvailable() {
        return !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
    }

    /**
     * Get Langfuse configuration status
     */
    getLangfuseStatus() {
        const isAvailable = this.isLangfuseAvailable();
        return {
            available: isAvailable,
            publicKey: isAvailable ? process.env.LANGFUSE_PUBLIC_KEY?.substring(0, 8) + '...' : null,
            baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
            enabled: isAvailable && process.env.LANGFUSE_DEBUG === 'true'
        };
    }

    /**
     * Get service status for health checks
     */
    getStatus() {
        return {
            cacheSize: this.settingsCache.size,
            cacheTTL: this.cacheTTL,
            isInitialized: this.settingsCache.size > 0,
            lastCacheRefresh: Math.max(...this.cacheExpiry.values()) - this.cacheTTL,
            langfuse: this.getLangfuseStatus()
        };
    }

    /**
     * Cleanup method
     */
    async destroy() {
        this.logger.info('Destroying Settings Service');
        await this.prisma.$disconnect();
        this.removeAllListeners();
    }
}

module.exports = SettingsService;