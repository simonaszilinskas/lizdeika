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

// Create mock prisma instance
const mockPrismaInstance = {
    system_settings: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn()
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn()
};

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn(() => mockPrismaInstance)
}));

const { EventEmitter } = require('events');

describe('SettingsService', () => {
    let settingsService;
    let SettingsService;
    let originalEnv;

    beforeEach(async () => {
        // Store original environment
        originalEnv = process.env;
        
        // Set test environment variables
        process.env = {
            ...originalEnv,
            WIDGET_NAME: 'Test Widget',
            WIDGET_PRIMARY_COLOR: '#2c5530',
            WELCOME_MESSAGE: 'Test Welcome',
            USER_MESSAGE_COLOR: '#3b82f6',
            WIDGET_ALLOWED_DOMAINS: '*'
        };

        // Clear all mocks
        jest.clearAllMocks();
        
        // Reset mock implementations
        Object.values(mockPrismaInstance.system_settings).forEach(mock => mock.mockReset?.());
        mockPrismaInstance.$transaction.mockReset?.();
        mockPrismaInstance.$disconnect.mockReset?.();
        
        // Set default mock return values
        mockPrismaInstance.system_settings.findMany.mockResolvedValue([]);
        mockPrismaInstance.system_settings.findFirst.mockResolvedValue(null);
        mockPrismaInstance.system_settings.upsert.mockResolvedValue({});
        mockPrismaInstance.system_settings.deleteMany.mockResolvedValue({ count: 0 });
        mockPrismaInstance.$transaction.mockImplementation(async (callback) => {
            return await callback(mockPrismaInstance);
        });
        mockPrismaInstance.$disconnect.mockResolvedValue();

        // Clear module cache and re-require
        jest.resetModules();
        SettingsService = require('../../src/services/settingsService');
        settingsService = new SettingsService();
        
        // Prevent the automatic cache refresh
        settingsService.setupCacheRefresh = jest.fn();
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
        jest.clearAllTimers();
    });

    describe('Initialization', () => {
        test('should initialize successfully', () => {
            expect(settingsService).toBeInstanceOf(EventEmitter);
            expect(settingsService.settingsCache).toBeInstanceOf(Map);
            expect(settingsService.cacheExpiry).toBeInstanceOf(Map);
            expect(settingsService.cacheTTL).toBe(5 * 60 * 1000);
        });
    });

    describe('Settings Retrieval', () => {
        describe('getSetting', () => {
            test('should get setting from cache when available', async () => {
                settingsService.setCacheValue('widget_name', 'Cached Widget');

                const result = await settingsService.getSetting('widget_name');
                
                expect(result).toBe('Cached Widget');
                expect(mockPrismaInstance.system_settings.findFirst).not.toHaveBeenCalled();
            });

            test('should fall back to environment variable when setting not in database', async () => {
                mockPrismaInstance.system_settings.findFirst.mockResolvedValue(null);
                
                const result = await settingsService.getSetting('widget_name');
                
                expect(result).toBe('Test Widget');
            });

            test('should return default value when neither database nor environment has setting', async () => {
                // Clear the service's cache first
                settingsService.settingsCache.clear();
                settingsService.cacheExpiry.clear();
                
                const originalValue = process.env.WIDGET_NAME;
                delete process.env.WIDGET_NAME;
                mockPrismaInstance.system_settings.findFirst.mockResolvedValue(null);
                
                // Create a new service instance without the env var
                jest.resetModules();
                delete process.env.WIDGET_NAME;
                const SettingsServiceClean = require('../../src/services/settingsService');
                const cleanService = new SettingsServiceClean();
                cleanService.setupCacheRefresh = jest.fn();
                
                const result = await cleanService.getSetting('widget_name');
                
                expect(result).toBe('Vilnius Assistant'); // Default from ENV_FALLBACKS
                
                // Restore env var
                process.env.WIDGET_NAME = originalValue;
            });
        });

        describe('getSettingsByCategory', () => {
            test('should get all settings in category', async () => {
                const brandingSettings = [
                    {
                        setting_key: 'widget_name',
                        setting_value: 'Test Widget',
                        setting_type: 'string',
                        category: 'branding',
                        is_public: true,
                        description: null,
                        updated_at: new Date()
                    }
                ];

                mockPrismaInstance.system_settings.findMany.mockResolvedValue(brandingSettings);

                const result = await settingsService.getSettingsByCategory('branding');
                
                expect(result).toBeDefined();
                expect(result.widget_name).toBeDefined();
            });
        });
    });

    describe('Settings Updates', () => {
        describe('updateSetting', () => {
            test('should validate setting before updating', async () => {
                await expect(
                    settingsService.updateSetting('widget_name', '', 'admin-123', 'branding')
                ).rejects.toThrow();
            });

            test('should emit settingChanged event', async () => {
                const eventSpy = jest.fn();
                settingsService.on('settingChanged', eventSpy);

                mockPrismaInstance.system_settings.upsert.mockResolvedValue({
                    setting_key: 'widget_name',
                    setting_value: 'Updated Widget'
                });

                await settingsService.updateSetting('widget_name', 'Updated Widget', 'admin-123', 'branding');

                expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                    key: 'widget_name',
                    value: 'Updated Widget',
                    category: 'branding',
                    adminUserId: 'admin-123'
                }));
            });
        });
    });

    describe('Validation', () => {
        test('should validate widget_name correctly', async () => {
            await expect(settingsService.validateSetting('widget_name', 'Valid Name', 'branding')).resolves.not.toThrow();
            await expect(settingsService.validateSetting('widget_name', '', 'branding')).rejects.toThrow();
            await expect(settingsService.validateSetting('widget_name', 'a'.repeat(101), 'branding')).rejects.toThrow();
        });

        test('should validate widget_primary_color correctly', async () => {
            await expect(settingsService.validateSetting('widget_primary_color', '#ff0000', 'branding')).resolves.not.toThrow();
            await expect(settingsService.validateSetting('widget_primary_color', '#FF0000', 'branding')).resolves.not.toThrow();
            await expect(settingsService.validateSetting('widget_primary_color', 'invalid', 'branding')).rejects.toThrow();
            await expect(settingsService.validateSetting('widget_primary_color', '#gg0000', 'branding')).rejects.toThrow();
        });

        test('should validate user_message_color correctly', async () => {
            await expect(settingsService.validateSetting('user_message_color', '#3b82f6', 'branding')).resolves.not.toThrow();
            await expect(settingsService.validateSetting('user_message_color', '#ff0000', 'branding')).resolves.not.toThrow();
            await expect(settingsService.validateSetting('user_message_color', 'invalid', 'branding')).rejects.toThrow();
        });

        test('should validate welcome_message correctly', async () => {
            await expect(settingsService.validateSetting('welcome_message', 'Welcome!', 'branding')).resolves.not.toThrow();
            await expect(settingsService.validateSetting('welcome_message', 'a'.repeat(500), 'branding')).resolves.not.toThrow();
            await expect(settingsService.validateSetting('welcome_message', 'a'.repeat(501), 'branding')).rejects.toThrow();
        });

        test('should validate widget_allowed_domains correctly', async () => {
            await expect(settingsService.validateSetting('widget_allowed_domains', '*', 'branding')).resolves.not.toThrow();
            await expect(settingsService.validateSetting('widget_allowed_domains', 'example.com', 'branding')).resolves.not.toThrow();
            await expect(settingsService.validateSetting('widget_allowed_domains', '', 'branding')).rejects.toThrow();
        });
    });

    describe('Value Type Handling', () => {
        describe('parseSettingValue', () => {
            test('should parse string values correctly', () => {
                expect(settingsService.parseSettingValue('test', 'string')).toBe('test');
                expect(settingsService.parseSettingValue('123', 'string')).toBe('123');
            });

            test('should parse boolean values correctly', () => {
                expect(settingsService.parseSettingValue('true', 'boolean')).toBe(true);
                expect(settingsService.parseSettingValue('false', 'boolean')).toBe(false);
            });

            test('should parse number values correctly', () => {
                expect(settingsService.parseSettingValue('123', 'number')).toBe(123);
                expect(settingsService.parseSettingValue('123.45', 'number')).toBe(123.45);
            });

            test('should parse json values correctly', () => {
                expect(settingsService.parseSettingValue('{"key":"value"}', 'json')).toEqual({key: 'value'});
                expect(settingsService.parseSettingValue('[1,2,3]', 'json')).toEqual([1,2,3]);
            });
        });

        describe('stringifySettingValue', () => {
            test('should stringify values correctly', () => {
                expect(settingsService.stringifySettingValue('test')).toBe('test');
                expect(settingsService.stringifySettingValue(true)).toBe('true');
                expect(settingsService.stringifySettingValue(123)).toBe('123');
                expect(settingsService.stringifySettingValue({key: 'value'})).toBe('{"key":"value"}');
            });
        });

        describe('getSettingType', () => {
            test('should infer types correctly', () => {
                expect(settingsService.getSettingType('test')).toBe('string');
                expect(settingsService.getSettingType(true)).toBe('boolean');
                expect(settingsService.getSettingType(123)).toBe('number');
                expect(settingsService.getSettingType({key: 'value'})).toBe('json');
                expect(settingsService.getSettingType([1,2,3])).toBe('json');
            });
        });
    });

    describe('Cache Management', () => {
        test('should cache settings with TTL', () => {
            settingsService.setCacheValue('test_key', 'test_value');
            
            expect(settingsService.settingsCache.get('test_key')).toBe('test_value');
            expect(settingsService.cacheExpiry.has('test_key')).toBe(true);
        });

        test('should validate cache correctly', () => {
            settingsService.setCacheValue('test_key', 'test_value');
            expect(settingsService.isValidCache('test_key')).toBe(true);
            
            // Expire the cache
            settingsService.cacheExpiry.set('test_key', Date.now() - 1000);
            expect(settingsService.isValidCache('test_key')).toBe(false);
        });
    });

    describe('Service Status', () => {
        test('should return correct status', () => {
            settingsService.setCacheValue('test1', 'value1');
            settingsService.setCacheValue('test2', 'value2');
            
            const status = settingsService.getStatus();
            
            expect(status.cacheSize).toBe(2);
            expect(status.cacheTTL).toBe(5 * 60 * 1000);
            expect(status.isInitialized).toBe(true);
        });
    });
});