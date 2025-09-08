/**
 * SettingsService Unit Tests
 * 
 * Tests for the backend SettingsService class
 * Covers runtime configuration management, validation, caching, and database operations
 */

// Mock logger first
jest.mock('../../src/utils/logger.js', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

const { EventEmitter } = require('events');

// Mock Prisma client
const mockPrisma = {
    system_settings: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn()
    }
};

// Mock logger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

describe('SettingsService', () => {
    let settingsService;
    let originalEnv;

    beforeEach(() => {
        // Store original environment
        originalEnv = process.env;
        
        // Set test environment variables
        process.env = {
            ...originalEnv,
            WIDGET_NAME: 'Test Widget',
            WIDGET_PRIMARY_COLOR: '#2c5530',
            SITE_NAME: 'Test Site'
        };

        // Clear mocks
        jest.clearAllMocks();

        // Create service instance
        const SettingsService = require('../../src/services/settingsService');
        settingsService = new SettingsService(mockPrisma, mockLogger);
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
        
        // Clear any timers
        jest.clearAllTimers();
    });

    describe('Initialization', () => {
        test('should initialize successfully', () => {
            expect(settingsService).toBeInstanceOf(EventEmitter);
            expect(settingsService.settingsCache).toEqual(new Map());
            expect(settingsService.cacheExpiry).toEqual(new Map());
        });

        test('should initialize with default settings schema', () => {
            // The actual implementation doesn't expose settingsSchema property
            // It uses internal SETTING_SCHEMAS constant
            expect(settingsService.cacheTTL).toBe(5 * 60 * 1000);
            expect(settingsService.prisma).toBeDefined();
            expect(settingsService.logger).toBeDefined();
        });
    });

    describe('Settings Retrieval', () => {
        describe('getSetting', () => {
            test('should get setting from cache when available', async () => {
                const cachedSetting = {
                    setting_key: 'widget_name',
                    setting_value: 'Cached Widget',
                    category: 'branding',
                    is_public: true
                };

                settingsService.settingsCache.set('widget_name', {
                    data: cachedSetting,
                    timestamp: Date.now()
                });

                const result = await settingsService.getSetting('widget_name');
                expect(result).toEqual('Cached Widget'); // getSetting returns just the value
                expect(mockPrisma.system_settings.findFirst).not.toHaveBeenCalled();
            });

            test('should get setting from database when not cached', async () => {
                const dbSetting = {
                    setting_key: 'widget_name',
                    setting_value: 'DB Widget',
                    category: 'branding',
                    is_public: true
                };

                mockPrisma.system_settings.findFirst.mockResolvedValue(dbSetting);

                const result = await settingsService.getSetting('widget_name');
                
                expect(result).toEqual('DB Widget'); // getSetting returns just the parsed value
                expect(mockPrisma.system_settings.findFirst).toHaveBeenCalledWith({
                    where: { setting_key: 'widget_name' }
                });
                expect(settingsService.settingsCache.has('widget_name')).toBe(true);
            });

            test('should fall back to environment variable when setting not in database', async () => {
                mockPrisma.system_settings.findFirst.mockResolvedValue(null);
                
                const result = await settingsService.getSetting('widget_name');
                
                expect(result).toEqual('Test Widget'); // Returns env fallback value directly
            });

            test('should return default value when neither database nor environment has setting', async () => {
                delete process.env.WIDGET_NAME;
                mockPrisma.system_settings.findUnique.mockResolvedValue(null);
                
                const result = await settingsService.getSetting('widget_name');
                
                expect(result).toEqual({
                    setting_key: 'widget_name',
                    setting_value: 'Vilnius Assistant',
                    category: 'branding',
                    is_public: true,
                    source: 'default'
                });
            });
        });

        describe('getSettingValue', () => {
            test('should return parsed setting value', async () => {
                mockPrisma.system_settings.findUnique.mockResolvedValue({
                    setting_key: 'widget_name',
                    setting_value: 'Test Widget',
                    setting_type: 'string'
                });

                const result = await settingsService.getSettingValue('widget_name');
                expect(result).toBe('Test Widget');
            });

            test('should return default value when setting not found', async () => {
                mockPrisma.system_settings.findUnique.mockResolvedValue(null);
                
                const result = await settingsService.getSettingValue('widget_name', 'Default');
                expect(result).toBe('Test Widget'); // From env
            });
        });

        describe('getSettingsByCategory', () => {
            test('should get all settings in category', async () => {
                const brandingSettings = [
                    {
                        setting_key: 'widget_name',
                        setting_value: 'Test Widget',
                        category: 'branding',
                        is_public: true
                    },
                    {
                        setting_key: 'widget_primary_color',
                        setting_value: '#2c5530',
                        category: 'branding',
                        is_public: true
                    },
                    {
                        setting_key: 'admin_secret',
                        setting_value: 'secret123',
                        category: 'branding',
                        is_public: false
                    }
                ];

                mockPrisma.system_settings.findMany.mockResolvedValue(brandingSettings);

                const result = await settingsService.getSettingsByCategory('branding');
                
                expect(Object.keys(result)).toHaveLength(3);
                expect(result.widget_name.value).toBe('Test Widget');
                expect(result.widget_primary_color.value).toBe('#2c5530');
                expect(result.admin_secret.value).toBe('secret123');
            });

            test('should filter out private settings when publicOnly is true', async () => {
                const brandingSettings = [
                    {
                        setting_key: 'widget_name',
                        setting_value: 'Test Widget',
                        category: 'branding',
                        is_public: true
                    },
                    {
                        setting_key: 'admin_secret',
                        setting_value: 'secret123',
                        category: 'branding',
                        is_public: false
                    }
                ];

                mockPrisma.system_settings.findMany.mockResolvedValue(brandingSettings);

                const result = await settingsService.getSettingsByCategory('branding', true);
                
                expect(Object.keys(result)).toHaveLength(1);
                expect(result.widget_name.value).toBe('Test Widget');
                expect(result.admin_secret).toBeUndefined();
            });

            test('should merge with environment and default values', async () => {
                mockPrisma.system_settings.findMany.mockResolvedValue([]);

                const result = await settingsService.getSettingsByCategory('branding');
                
                // Should have environment/default values
                expect(result.widget_name.value).toBe('Test Widget');
                expect(result.widget_primary_color.value).toBe('#2c5530');
                expect(result.site_name.value).toBe('Test Site');
            });
        });
    });

    describe('Settings Updates', () => {
        describe('updateSetting', () => {
            test('should update setting successfully', async () => {
                const updatedSetting = {
                    id: '1',
                    setting_key: 'widget_name',
                    setting_value: 'Updated Widget',
                    setting_type: 'string',
                    category: 'branding',
                    is_public: true,
                    updated_by: 'admin-123',
                    created_at: new Date(),
                    updated_at: new Date()
                };

                mockPrisma.system_settings.upsert.mockResolvedValue(updatedSetting);

                const result = await settingsService.updateSetting('widget_name', 'Updated Widget', 'admin-123', 'branding');
                
                expect(result).toEqual(updatedSetting);
                expect(mockPrisma.system_settings.upsert).toHaveBeenCalledWith({
                    where: { setting_key: 'widget_name' },
                    update: {
                        setting_value: 'Updated Widget',
                        setting_type: 'string',
                        updated_by: 'admin-123',
                        updated_at: expect.any(Date)
                    },
                    create: {
                        setting_key: 'widget_name',
                        setting_value: 'Updated Widget',
                        setting_type: 'string',
                        category: 'branding',
                        is_public: true,
                        updated_by: 'admin-123'
                    }
                });
                
                // Should invalidate cache
                expect(settingsService.cache.has('widget_name')).toBe(false);
            });

            test('should validate setting before updating', async () => {
                await expect(
                    settingsService.updateSetting('widget_name', '', 'admin-123')
                ).rejects.toThrow('Widget name cannot be empty');
            });

            test('should reject invalid setting key', async () => {
                await expect(
                    settingsService.updateSetting('invalid_key', 'value', 'admin-123')
                ).rejects.toThrow('Unknown setting key: invalid_key');
            });

            test('should emit settingChanged event', async () => {
                const eventSpy = jest.fn();
                settingsService.on('settingChanged', eventSpy);

                mockPrisma.system_settings.upsert.mockResolvedValue({
                    setting_key: 'widget_name',
                    setting_value: 'Updated Widget'
                });

                await settingsService.updateSetting('widget_name', 'Updated Widget', 'admin-123');

                expect(eventSpy).toHaveBeenCalledWith({
                    key: 'widget_name',
                    value: 'Updated Widget',
                    category: 'branding',
                    adminUserId: 'admin-123'
                });
            });
        });

        describe('updateSettings', () => {
            test('should update multiple settings successfully', async () => {
                const settings = {
                    widget_name: 'Batch Updated Widget',
                    widget_primary_color: '#ff6600'
                };

                mockPrisma.system_settings.upsert
                    .mockResolvedValueOnce({ setting_key: 'widget_name', setting_value: 'Batch Updated Widget' })
                    .mockResolvedValueOnce({ setting_key: 'widget_primary_color', setting_value: '#ff6600' });

                const result = await settingsService.updateSettings(settings, 'admin-123', 'branding');

                expect(result).toHaveLength(2);
                expect(mockPrisma.system_settings.upsert).toHaveBeenCalledTimes(2);
            });

            test('should rollback on partial failure', async () => {
                const settings = {
                    widget_name: 'Valid Widget',
                    widget_primary_color: 'invalid-color'
                };

                await expect(
                    settingsService.updateSettings(settings, 'admin-123', 'branding')
                ).rejects.toThrow();

                expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
            });
        });
    });

    describe('Validation', () => {
        describe('validateSetting', () => {
            test('should validate widget_name correctly', async () => {
                await expect(settingsService.validateSetting('widget_name', 'Valid Name')).resolves.not.toThrow();
                await expect(settingsService.validateSetting('widget_name', '')).rejects.toThrow('Widget name cannot be empty');
                await expect(settingsService.validateSetting('widget_name', 'a'.repeat(101))).rejects.toThrow('Widget name cannot exceed 100 characters');
            });

            test('should validate widget_primary_color correctly', async () => {
                await expect(settingsService.validateSetting('widget_primary_color', '#2c5530')).resolves.not.toThrow();
                await expect(settingsService.validateSetting('widget_primary_color', '#fff')).resolves.not.toThrow();
                await expect(settingsService.validateSetting('widget_primary_color', 'invalid')).rejects.toThrow('Primary color must be a valid hex color');
                await expect(settingsService.validateSetting('widget_primary_color', '')).rejects.toThrow('Primary color cannot be empty');
            });

            test('should validate site_name correctly', async () => {
                await expect(settingsService.validateSetting('site_name', 'Valid Site')).resolves.not.toThrow();
                await expect(settingsService.validateSetting('site_name', '')).rejects.toThrow('Site name cannot be empty');
                await expect(settingsService.validateSetting('site_name', 'a'.repeat(201))).rejects.toThrow('Site name cannot exceed 200 characters');
            });

            test('should validate welcome_message correctly', async () => {
                await expect(settingsService.validateSetting('welcome_message', 'Hello!')).resolves.not.toThrow();
                await expect(settingsService.validateSetting('welcome_message', '')).resolves.not.toThrow(); // Optional
                await expect(settingsService.validateSetting('welcome_message', 'a'.repeat(501))).rejects.toThrow('Welcome message cannot exceed 500 characters');
            });

            test('should validate widget_allowed_domains correctly', async () => {
                await expect(settingsService.validateSetting('widget_allowed_domains', '*')).resolves.not.toThrow();
                await expect(settingsService.validateSetting('widget_allowed_domains', 'example.com')).resolves.not.toThrow();
                await expect(settingsService.validateSetting('widget_allowed_domains', '*.example.com')).resolves.not.toThrow();
                await expect(settingsService.validateSetting('widget_allowed_domains', 'example.com\n*.test.com')).resolves.not.toThrow();
                await expect(settingsService.validateSetting('widget_allowed_domains', '')).rejects.toThrow('Allowed domains cannot be empty');
                await expect(settingsService.validateSetting('widget_allowed_domains', 'invalid..domain')).rejects.toThrow('Invalid domain format');
            });
        });

        describe('isValidDomain', () => {
            test('should validate domain formats correctly', () => {
                expect(settingsService.isValidDomain('example.com')).toBe(true);
                expect(settingsService.isValidDomain('subdomain.example.com')).toBe(true);
                expect(settingsService.isValidDomain('*.example.com')).toBe(true);
                expect(settingsService.isValidDomain('example-site.com')).toBe(true);
                
                expect(settingsService.isValidDomain('invalid..domain')).toBe(false);
                expect(settingsService.isValidDomain('.invalid')).toBe(false);
                expect(settingsService.isValidDomain('invalid.')).toBe(false);
                expect(settingsService.isValidDomain('')).toBe(false);
            });
        });

        describe('isValidHexColor', () => {
            test('should validate hex color formats correctly', () => {
                expect(settingsService.isValidHexColor('#2c5530')).toBe(true);
                expect(settingsService.isValidHexColor('#fff')).toBe(true);
                expect(settingsService.isValidHexColor('#FFF')).toBe(true);
                expect(settingsService.isValidHexColor('#123456')).toBe(true);
                
                expect(settingsService.isValidHexColor('2c5530')).toBe(false);
                expect(settingsService.isValidHexColor('#gg5530')).toBe(false);
                expect(settingsService.isValidHexColor('#12345')).toBe(false);
                expect(settingsService.isValidHexColor('')).toBe(false);
            });
        });
    });

    describe('Cache Management', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should cache settings with TTL', async () => {
            const dbSetting = {
                setting_key: 'widget_name',
                setting_value: 'Cached Widget',
                category: 'branding'
            };

            mockPrisma.system_settings.findUnique.mockResolvedValue(dbSetting);

            // First call - should query database
            await settingsService.getSetting('widget_name');
            expect(mockPrisma.system_settings.findUnique).toHaveBeenCalledTimes(1);

            // Second call - should use cache
            await settingsService.getSetting('widget_name');
            expect(mockPrisma.system_settings.findUnique).toHaveBeenCalledTimes(1);

            // Advance time beyond cache TTL
            jest.advanceTimersByTime(settingsService.CACHE_TTL + 1000);

            // Third call - should query database again
            await settingsService.getSetting('widget_name');
            expect(mockPrisma.system_settings.findUnique).toHaveBeenCalledTimes(2);
        });

        test('should invalidate cache on setting update', async () => {
            // Cache a setting
            settingsService.cache.set('widget_name', {
                data: { setting_value: 'Cached Widget' },
                timestamp: Date.now()
            });

            mockPrisma.system_settings.upsert.mockResolvedValue({
                setting_key: 'widget_name',
                setting_value: 'Updated Widget'
            });

            await settingsService.updateSetting('widget_name', 'Updated Widget', 'admin-123');

            expect(settingsService.cache.has('widget_name')).toBe(false);
        });

        test('should clear cache', () => {
            settingsService.cache.set('key1', { data: 'value1', timestamp: Date.now() });
            settingsService.cache.set('key2', { data: 'value2', timestamp: Date.now() });

            settingsService.clearCache();

            expect(settingsService.cache.size).toBe(0);
        });
    });

    describe('Value Type Handling', () => {
        describe('stringifySettingValue', () => {
            test('should stringify values correctly', () => {
                expect(settingsService.stringifySettingValue('string')).toBe('string');
                expect(settingsService.stringifySettingValue(123)).toBe('123');
                expect(settingsService.stringifySettingValue(true)).toBe('true');
                expect(settingsService.stringifySettingValue({ key: 'value' })).toBe('{"key":"value"}');
                expect(settingsService.stringifySettingValue(['a', 'b'])).toBe('["a","b"]');
            });
        });

        describe('parseSettingValue', () => {
            test('should parse string values correctly', () => {
                expect(settingsService.parseSettingValue('hello', 'string')).toBe('hello');
                expect(settingsService.parseSettingValue('123', 'number')).toBe(123);
                expect(settingsService.parseSettingValue('true', 'boolean')).toBe(true);
                expect(settingsService.parseSettingValue('false', 'boolean')).toBe(false);
                expect(settingsService.parseSettingValue('{"key":"value"}', 'json')).toEqual({ key: 'value' });
                expect(settingsService.parseSettingValue('["a","b"]', 'array')).toEqual(['a', 'b']);
            });

            test('should handle parse errors gracefully', () => {
                expect(settingsService.parseSettingValue('invalid-json', 'json')).toBe('invalid-json');
                expect(settingsService.parseSettingValue('not-a-number', 'number')).toBeNaN();
            });
        });

        describe('inferSettingType', () => {
            test('should infer types correctly', () => {
                expect(settingsService.inferSettingType('hello')).toBe('string');
                expect(settingsService.inferSettingType(123)).toBe('number');
                expect(settingsService.inferSettingType(true)).toBe('boolean');
                expect(settingsService.inferSettingType(['a', 'b'])).toBe('array');
                expect(settingsService.inferSettingType({ key: 'value' })).toBe('json');
                expect(settingsService.inferSettingType(null)).toBe('string');
                expect(settingsService.inferSettingType(undefined)).toBe('string');
            });
        });
    });

    describe('Reset Operations', () => {
        describe('resetSettings', () => {
            test('should reset category settings successfully', async () => {
                mockPrisma.system_settings.deleteMany.mockResolvedValue({ count: 3 });

                const result = await settingsService.resetSettings('branding', 'admin-123');

                expect(mockPrisma.system_settings.deleteMany).toHaveBeenCalledWith({
                    where: { category: 'branding' }
                });
                expect(result.deletedCount).toBe(3);
                expect(result.category).toBe('branding');
                expect(settingsService.cache.size).toBe(0); // Cache should be cleared
            });

            test('should emit settingsReset event', async () => {
                const eventSpy = jest.fn();
                settingsService.on('settingsReset', eventSpy);

                mockPrisma.system_settings.deleteMany.mockResolvedValue({ count: 2 });

                await settingsService.resetSettings('branding', 'admin-123');

                expect(eventSpy).toHaveBeenCalledWith({
                    category: 'branding',
                    deletedCount: 2,
                    adminUserId: 'admin-123'
                });
            });
        });

        describe('resetSetting', () => {
            test('should reset single setting successfully', async () => {
                mockPrisma.system_settings.delete.mockResolvedValue({
                    setting_key: 'widget_name',
                    setting_value: 'Old Value'
                });

                const result = await settingsService.resetSetting('widget_name', 'admin-123');

                expect(mockPrisma.system_settings.delete).toHaveBeenCalledWith({
                    where: { setting_key: 'widget_name' }
                });
                expect(result.setting_key).toBe('widget_name');
                expect(settingsService.cache.has('widget_name')).toBe(false);
            });

            test('should handle deletion of non-existent setting', async () => {
                mockPrisma.system_settings.delete.mockRejectedValue(new Error('Record not found'));

                await expect(
                    settingsService.resetSetting('nonexistent_key', 'admin-123')
                ).rejects.toThrow('Record not found');
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle database connection errors', async () => {
            mockPrisma.system_settings.findUnique.mockRejectedValue(new Error('Database connection failed'));

            await expect(settingsService.getSetting('widget_name')).rejects.toThrow('Database connection failed');
            expect(mockLogger.error).toHaveBeenCalled();
        });

        test('should handle validation errors properly', async () => {
            await expect(
                settingsService.updateSetting('widget_primary_color', 'invalid-color', 'admin-123')
            ).rejects.toThrow('Primary color must be a valid hex color');
        });
    });

    describe('Environment Integration', () => {
        test('should load settings from environment variables', () => {
            const envConfig = settingsService.loadEnvironmentConfig();
            
            expect(envConfig.widget_name).toBe('Test Widget');
            expect(envConfig.widget_primary_color).toBe('#2c5530');
            expect(envConfig.site_name).toBe('Test Site');
        });

        test('should handle missing environment variables with defaults', () => {
            delete process.env.WIDGET_NAME;
            delete process.env.WIDGET_PRIMARY_COLOR;
            delete process.env.SITE_NAME;

            const envConfig = settingsService.loadEnvironmentConfig();
            
            expect(envConfig.widget_name).toBe('Vilnius Assistant');
            expect(envConfig.widget_primary_color).toBe('#2c5530');
            expect(envConfig.site_name).toBe('Customer Support');
        });
    });
});