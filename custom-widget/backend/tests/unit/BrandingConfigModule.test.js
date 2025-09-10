/**
 * BrandingConfigModule Unit Tests
 * 
 * Tests for the BrandingConfigModule frontend component
 * Covers validation, form handling, live preview, and API integration
 */

const { BrandingConfigModule } = require('../../src/services/settingsService');

// Mock DOM environment
const mockDOM = () => {
    global.document = {
        getElementById: jest.fn(),
        querySelectorAll: jest.fn(),
        querySelector: jest.fn(),
        createElement: jest.fn(() => ({
            className: '',
            textContent: '',
            appendChild: jest.fn(),
            style: {},
            classList: {
                add: jest.fn(),
                remove: jest.fn()
            }
        })),
        addEventListener: jest.fn()
    };

    global.window = {
        location: {
            protocol: 'http:',
            hostname: 'localhost'
        }
    };

    global.fetch = jest.fn();
    global.localStorage = {
        getItem: jest.fn(),
        setItem: jest.fn()
    };

    global.confirm = jest.fn();
    global.setTimeout = jest.fn((cb) => cb());
};

// Mock dependencies
jest.mock('../../agent-dashboard/utils/Toast.js', () => ({
    Toast: {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warning: jest.fn()
    }
}));

jest.mock('../../agent-dashboard/utils/ErrorHandler.js', () => ({
    ErrorHandler: {
        logError: jest.fn()
    }
}));

describe('BrandingConfigModule', () => {
    let module;
    let mockApiManager;
    let mockStateManager;
    let mockConnectionManager;

    beforeEach(() => {
        mockDOM();

        // Mock dependencies
        mockApiManager = {
            initialize: jest.fn()
        };

        mockStateManager = {
            initialize: jest.fn(),
            on: jest.fn(),
            emit: jest.fn()
        };

        mockConnectionManager = {
            initialize: jest.fn()
        };

        // Create module instance
        const BrandingConfigModuleClass = require('../../js/settings/modules/BrandingConfigModule.js').BrandingConfigModule;
        module = new BrandingConfigModuleClass(mockApiManager, mockStateManager, mockConnectionManager);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        test('should initialize successfully', async () => {
            // Mock DOM elements
            const mockElements = {
                brandingConfigDiv: { innerHTML: '' },
                statusDiv: { classList: { add: jest.fn(), remove: jest.fn() } }
            };

            document.getElementById.mockImplementation((id) => {
                return mockElements[id.replace('-', '')] || null;
            });

            // Mock fetch for settings load
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ 
                    success: true, 
                    data: {
                        widget_name: { value: 'Test Widget' },
                        widget_primary_color: { value: '#2c5530' },
                    }
                })
            });

            await expect(module.initialize()).resolves.not.toThrow();
            expect(mockStateManager.on).toHaveBeenCalledWith('brandingSettingsChanged', expect.any(Function));
        });

        test('should handle initialization failure gracefully', async () => {
            // Mock DOM elements
            document.getElementById.mockReturnValue(null);

            // Mock fetch failure
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(module.initialize()).rejects.toThrow('Network error');
        });
    });

    describe('Validation', () => {
        beforeEach(() => {
            module.currentSettings = {
                widget_name: 'Test Widget',
                widget_primary_color: '#2c5530',
                widget_allowed_domains: '*',
                welcome_message: 'Hello!'
            };
        });

        describe('validateSettings', () => {
            test('should pass validation with valid settings', () => {
                const errors = module.validateSettings();
                expect(errors).toBeNull();
            });

            test('should fail validation with missing widget name', () => {
                module.currentSettings.widget_name = '';
                const errors = module.validateSettings();
                
                expect(errors).not.toBeNull();
                expect(errors[0].field).toBe('widget_name');
                expect(errors[0].message).toBe('Widget name is required');
            });

            test('should fail validation with invalid hex color', () => {
                module.currentSettings.widget_primary_color = 'invalid-color';
                const errors = module.validateSettings();
                
                expect(errors).not.toBeNull();
                expect(errors[0].field).toBe('widget_primary_color');
                expect(errors[0].message).toContain('valid hex color');
            });

            test('should fail validation with missing site name', () => {
                const errors = module.validateSettings();
                
                expect(errors).not.toBeNull();
                expect(errors[0].message).toBe('Site name is required');
            });

            test('should fail validation with too long widget name', () => {
                module.currentSettings.widget_name = 'a'.repeat(101);
                const errors = module.validateSettings();
                
                expect(errors).not.toBeNull();
                expect(errors[0].field).toBe('widget_name');
                expect(errors[0].message).toBe('Widget name must be 100 characters or less');
            });

            test('should fail validation with too long welcome message', () => {
                module.currentSettings.welcome_message = 'a'.repeat(501);
                const errors = module.validateSettings();
                
                expect(errors).not.toBeNull();
                expect(errors[0].field).toBe('welcome_message');
                expect(errors[0].message).toBe('Welcome message must be 500 characters or less');
            });
        });

        describe('validateField', () => {
            test('should validate widget name correctly', () => {
                expect(module.validateField('widget_name', 'Valid Name')).toHaveLength(0);
                expect(module.validateField('widget_name', '')).toContain('Widget name is required');
                expect(module.validateField('widget_name', 'a'.repeat(101))).toContain('Widget name must be 100 characters or less');
            });

            test('should validate hex color correctly', () => {
                expect(module.validateField('widget_primary_color', '#2c5530')).toHaveLength(0);
                expect(module.validateField('widget_primary_color', '#fff')).toHaveLength(0);
                expect(module.validateField('widget_primary_color', 'invalid')).toContain('Must be a valid hex color');
                expect(module.validateField('widget_primary_color', '')).toContain('Must be a valid hex color');
            });

            test('should validate site name correctly', () => {
            });
        });

        describe('isValidDomain', () => {
            test('should validate domains correctly', () => {
                expect(module.isValidDomain('example.com')).toBe(true);
                expect(module.isValidDomain('*.example.com')).toBe(true);
                expect(module.isValidDomain('subdomain.example.com')).toBe(true);
                expect(module.isValidDomain('invalid..domain')).toBe(false);
                expect(module.isValidDomain('.invalid')).toBe(false);
                expect(module.isValidDomain('invalid.')).toBe(false);
            });
        });

        describe('isValidHexColor', () => {
            test('should validate hex colors correctly', () => {
                expect(module.isValidHexColor('#2c5530')).toBe(true);
                expect(module.isValidHexColor('#fff')).toBe(true);
                expect(module.isValidHexColor('#FFF')).toBe(true);
                expect(module.isValidHexColor('#123456')).toBe(true);
                expect(module.isValidHexColor('2c5530')).toBe(false);
                expect(module.isValidHexColor('#gg5530')).toBe(false);
                expect(module.isValidHexColor('#12345')).toBe(false);
            });
        });
    });

    describe('Form Handling', () => {
        beforeEach(() => {
            // Mock DOM elements
            const mockInput = (id, value) => ({
                id,
                value,
                addEventListener: jest.fn(),
                classList: { add: jest.fn(), remove: jest.fn() },
                parentElement: {
                    querySelector: jest.fn(),
                    appendChild: jest.fn()
                }
            });

            document.getElementById.mockImplementation((id) => {
                const elements = {
                    'widget-name': mockInput(id, 'Test Widget'),
                    'widget-primary-color': mockInput(id, '#2c5530'),
                    'widget-primary-color-text': mockInput(id, '#2c5530'),
                    'site-name': mockInput(id, 'Test Site'),
                    'welcome-message': mockInput(id, 'Hello!'),
                    'widget-allowed-domains': mockInput(id, '*')
                };
                return elements[id] || null;
            });
        });

        describe('getCurrentFormValues', () => {
            test('should extract form values correctly', () => {
                const values = module.getCurrentFormValues();
                
                expect(values.widget_name).toBe('Test Widget');
                expect(values.widget_primary_color).toBe('#2c5530');
                expect(values.welcome_message).toBe('Hello!');
                expect(values.widget_allowed_domains).toBe('*');
            });

            test('should handle missing form elements gracefully', () => {
                document.getElementById.mockReturnValue(null);
                
                const values = module.getCurrentFormValues();
                
                expect(values.widget_name).toBe('');
                expect(values.widget_primary_color).toBe('#2c5530'); // Default value
                expect(values.welcome_message).toBe('');
                expect(values.widget_allowed_domains).toBe('*'); // Default value
            });
        });

        describe('populateFormFromSettings', () => {
            test('should populate form fields from settings', () => {
                const mockInputs = {};
                ['widget-name', 'widget-primary-color', 'widget-primary-color-text', 'site-name', 'welcome-message', 'widget-allowed-domains'].forEach(id => {
                    mockInputs[id] = { value: '' };
                });

                document.getElementById.mockImplementation((id) => mockInputs[id] || null);

                module.currentSettings = {
                    widget_name: 'New Widget Name',
                    widget_primary_color: '#ff6600',
                    welcome_message: 'New welcome message',
                    widget_allowed_domains: '*.example.com'
                };

                module.populateFormFromSettings();

                expect(mockInputs['widget-name'].value).toBe('New Widget Name');
                expect(mockInputs['widget-primary-color'].value).toBe('#ff6600');
                expect(mockInputs['widget-primary-color-text'].value).toBe('#ff6600');
                expect(mockInputs['site-name'].value).toBe('New Site Name');
                expect(mockInputs['welcome-message'].value).toBe('New welcome message');
                expect(mockInputs['widget-allowed-domains'].value).toBe('*.example.com');
            });
        });
    });

    describe('API Integration', () => {
        beforeEach(() => {
            global.localStorage.getItem.mockReturnValue('fake-token');
        });

        describe('loadBrandingSettings', () => {
            test('should load settings successfully', async () => {
                const mockResponse = {
                    success: true,
                    data: {
                        widget_name: { value: 'Loaded Widget' },
                        widget_primary_color: { value: '#123456' },
                    }
                };

                global.fetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockResponse)
                });

                // Mock populateFormFromSettings and updateLivePreview
                module.populateFormFromSettings = jest.fn();
                module.updateLivePreview = jest.fn();

                await module.loadBrandingSettings();

                expect(module.currentSettings.widget_name).toBe('Loaded Widget');
                expect(module.currentSettings.widget_primary_color).toBe('#123456');
                expect(module.populateFormFromSettings).toHaveBeenCalled();
                expect(module.updateLivePreview).toHaveBeenCalled();
            });

            test('should handle load failure gracefully', async () => {
                global.fetch.mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ error: 'Load failed' })
                });

                module.renderBrandingError = jest.fn();

                await expect(module.loadBrandingSettings()).rejects.toThrow('Load failed');
                expect(module.renderBrandingError).toHaveBeenCalledWith('Load failed');
            });
        });

        describe('saveBrandingSettings', () => {
            beforeEach(() => {
                module.currentSettings = {
                    widget_name: 'Test Widget',
                    widget_primary_color: '#2c5530',
                    widget_allowed_domains: '*',
                    welcome_message: 'Hello!'
                };

                // Mock DOM methods
                module.setSaveButtonState = jest.fn();
                module.clearAllFieldErrors = jest.fn();
                module.updateStatus = jest.fn();
            });

            test('should save settings successfully', async () => {
                global.fetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });

                await module.saveBrandingSettings();

                expect(global.fetch).toHaveBeenCalledWith('/api/config/branding', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer fake-token'
                    },
                    body: JSON.stringify({
                        settings: module.currentSettings
                    })
                });

                expect(module.clearAllFieldErrors).toHaveBeenCalled();
                expect(module.hasUnsavedChanges).toBe(false);
                expect(mockStateManager.emit).toHaveBeenCalledWith('brandingSettingsChanged', module.currentSettings);
            });

            test('should handle validation errors', async () => {
                module.currentSettings.widget_name = ''; // Invalid
                module.showFieldError = jest.fn();

                await expect(module.saveBrandingSettings()).rejects.toThrow('Validation failed');
                expect(module.showFieldError).toHaveBeenCalled();
                expect(global.fetch).not.toHaveBeenCalled();
            });

            test('should handle API errors', async () => {
                global.fetch.mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ error: 'Server error' })
                });

                await expect(module.saveBrandingSettings()).rejects.toThrow('Server error');
                expect(module.updateStatus).toHaveBeenCalledWith('Server error', 'error');
            });

            test('should handle network errors with user-friendly message', async () => {
                global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

                try {
                    await module.saveBrandingSettings();
                } catch (error) {
                    // Expected to throw
                }

                expect(module.updateStatus).toHaveBeenCalledWith(
                    'Network error: Please check your connection and try again',
                    'error'
                );
            });
        });

        describe('resetBrandingSettings', () => {
            beforeEach(() => {
                global.confirm.mockReturnValue(true);
                module.setResetButtonState = jest.fn();
                module.loadBrandingSettings = jest.fn();
                module.renderBrandingForm = jest.fn();
                module.updateStatus = jest.fn();
            });

            test('should reset settings successfully', async () => {
                global.fetch.mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });

                await module.resetBrandingSettings();

                expect(global.fetch).toHaveBeenCalledWith('/api/config/branding/reset', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer fake-token'
                    }
                });

                expect(module.loadBrandingSettings).toHaveBeenCalled();
                expect(module.renderBrandingForm).toHaveBeenCalled();
            });

            test('should not reset if user cancels', async () => {
                global.confirm.mockReturnValue(false);

                await module.resetBrandingSettings();

                expect(global.fetch).not.toHaveBeenCalled();
            });

            test('should handle reset failure', async () => {
                global.fetch.mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ error: 'Reset failed' })
                });

                await expect(module.resetBrandingSettings()).rejects.toThrow('Reset failed');
                expect(module.updateStatus).toHaveBeenCalledWith('Reset failed', 'error');
            });
        });
    });

    describe('Live Preview', () => {
        beforeEach(() => {
            // Mock DOM elements for preview
            const mockPreviewElements = {
                'preview-widget-name': { textContent: '' },
                'preview-header': { 
                    style: {},
                    parentElement: {
                        querySelector: jest.fn(() => ({ style: {} }))
                    }
                },
                'preview-welcome-message': { textContent: '' }
            };

            document.getElementById.mockImplementation((id) => mockPreviewElements[id] || null);
        });

        test('should update live preview correctly', () => {
            module.getCurrentFormValues = jest.fn(() => ({
                widget_name: 'Preview Widget',
                widget_primary_color: '#ff0000',
                welcome_message: 'Preview message'
            }));

            module.updateLivePreview();

            const previewWidgetName = document.getElementById('preview-widget-name');
            const previewHeader = document.getElementById('preview-header');
            const previewWelcomeMessage = document.getElementById('preview-welcome-message');

            expect(previewWidgetName.textContent).toBe('Preview Widget');
            expect(previewHeader.style.backgroundColor).toBe('#ff0000');
            expect(previewWelcomeMessage.textContent).toBe('Preview message');
        });

        test('should handle missing preview elements gracefully', () => {
            document.getElementById.mockReturnValue(null);
            module.getCurrentFormValues = jest.fn(() => ({
                widget_name: 'Test',
                widget_primary_color: '#ff0000',
                welcome_message: 'Test'
            }));

            expect(() => module.updateLivePreview()).not.toThrow();
        });
    });

    describe('Error Handling', () => {
        describe('showFieldError', () => {
            test('should display field error correctly', () => {
                const mockInput = {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    parentElement: {
                        querySelector: jest.fn().mockReturnValue(null),
                        appendChild: jest.fn()
                    }
                };

                document.getElementById.mockReturnValue(mockInput);
                const mockErrorDiv = { className: '', textContent: '' };
                document.createElement.mockReturnValue(mockErrorDiv);

                module.showFieldError('widget_name', ['Test error message']);

                expect(mockInput.classList.add).toHaveBeenCalledWith('border-red-500', 'ring-red-500');
                expect(mockErrorDiv.textContent).toBe('Test error message');
                expect(mockInput.parentElement.appendChild).toHaveBeenCalledWith(mockErrorDiv);
            });

            test('should clear existing errors when new ones are shown', () => {
                const mockExistingError = { remove: jest.fn() };
                const mockInput = {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    parentElement: {
                        querySelector: jest.fn().mockReturnValue(mockExistingError),
                        appendChild: jest.fn()
                    }
                };

                document.getElementById.mockReturnValue(mockInput);

                module.showFieldError('widget_name', ['New error']);

                expect(mockExistingError.remove).toHaveBeenCalled();
                expect(mockInput.classList.remove).toHaveBeenCalledWith('border-red-500', 'ring-red-500');
            });
        });

        describe('clearAllFieldErrors', () => {
            test('should clear all field errors', () => {
                const mockInputs = {};
                const fields = ['widget-name', 'widget-primary-color', 'site-name'];
                
                fields.forEach(field => {
                    mockInputs[field] = {
                        classList: { remove: jest.fn() },
                        parentElement: {
                            querySelector: jest.fn().mockReturnValue({ remove: jest.fn() })
                        }
                    };
                });

                document.getElementById.mockImplementation((id) => mockInputs[id] || null);

                module.clearAllFieldErrors();

                fields.forEach(field => {
                    const input = mockInputs[field];
                    if (input) {
                        expect(input.classList.remove).toHaveBeenCalledWith('border-red-500', 'ring-red-500');
                    }
                });
            });
        });
    });

    describe('Utility Methods', () => {
        describe('applyDefaultValues', () => {
            test('should apply default values for missing settings', () => {
                module.currentSettings = {};
                module.originalSettings = {};

                module.applyDefaultValues();

                expect(module.currentSettings.widget_name).toBe('Vilnius Assistant');
                expect(module.currentSettings.widget_primary_color).toBe('#2c5530');
                expect(module.currentSettings.widget_allowed_domains).toBe('*');
            });

            test('should not override existing settings', () => {
                module.currentSettings = {
                    widget_name: 'Existing Widget',
                    widget_primary_color: '#existing'
                };
                module.originalSettings = {};

                module.applyDefaultValues();

                expect(module.currentSettings.widget_name).toBe('Existing Widget');
                expect(module.currentSettings.widget_primary_color).toBe('#existing');
            });
        });

        describe('getStatus', () => {
            test('should return module status correctly', () => {
                module.hasUnsavedChanges = true;
                module.currentSettings = { widget_name: 'Test' };
                module.originalSettings = { widget_name: 'Original' };
                module.elements.brandingConfigDiv = {};

                const status = module.getStatus();

                expect(status.hasUnsavedChanges).toBe(true);
                expect(status.currentSettings).toEqual({ widget_name: 'Test' });
                expect(status.originalSettings).toEqual({ widget_name: 'Original' });
                expect(status.elements.brandingConfigDiv).toBe(true);
            });
        });
    });
});