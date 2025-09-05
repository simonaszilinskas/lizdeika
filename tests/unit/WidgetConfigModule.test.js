/**
 * WidgetConfigModule Unit Tests
 * 
 * Comprehensive tests for widget configuration management functionality
 * Tests module initialization, configuration loading, code generation, and UI interactions
 */

const TestUtils = require('../utilities/test-utils');
const ModuleLoader = require('../utilities/module-loader');
const { MockAPIManager, MockStateManager, MockConnectionManager, TestDataFactory, DOMTestUtils } = require('../mocks/phase2-mocks');
const JSDOMEnvironment = require('../../test-config/jsdom.config');
const path = require('path');

describe('WidgetConfigModule', () => {
    let jsdom;
    let WidgetConfigModule;
    let mockAPIManager;
    let mockStateManager;
    let mockConnectionManager;
    let widgetConfigModule;

    beforeEach(async () => {
        // Setup JSDOM environment
        jsdom = new JSDOMEnvironment().setup();
        
        // Create DOM elements
        DOMTestUtils.createMockDOM();
        
        // Setup mock services
        mockStateManager = new MockStateManager();
        mockAPIManager = new MockAPIManager('http://localhost:3002', mockStateManager);
        mockConnectionManager = new MockConnectionManager('http://localhost:3002', mockStateManager);
        
        // Setup API mocks with default responses
        const mockWidgetConfig = TestDataFactory.createWidgetConfig();
        mockAPIManager.setMockResponse('/api/widget/config', {
            success: true,
            data: mockWidgetConfig
        });
        
        mockAPIManager.setMockResponse('/api/widget/integration-code', {
            success: true,
            data: { integrationCode: '<script src="http://localhost:3002/widget.js"></script>' }
        });
        
        // Mock clipboard API
        Object.assign(navigator, {
            clipboard: {
                writeText: jest.fn().mockResolvedValue(undefined)
            }
        });
        
        // Mock fetch for integration code generation
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: { integrationCode: '<script src="http://localhost:3002/widget.js"></script>' }
            })
        });
        
        // Load WidgetConfigModule using ModuleLoader
        const modulePath = path.join(__dirname, '../../custom-widget/js/settings/modules/WidgetConfigModule.js');
        const mockDependencies = ModuleLoader.createMockDependencies();
        
        WidgetConfigModule = ModuleLoader.loadModule(modulePath, mockDependencies);
        global.Toast = mockDependencies.Toast;
        global.ErrorHandler = mockDependencies.ErrorHandler;
        
        // Create module instance
        widgetConfigModule = new WidgetConfigModule(mockAPIManager, mockStateManager, mockConnectionManager);
    });

    afterEach(() => {
        if (widgetConfigModule && widgetConfigModule.destroy) {
            widgetConfigModule.destroy();
        }
        if (jsdom && jsdom.cleanup) {
            jsdom.cleanup();
        }
        jest.clearAllMocks();
        global.fetch = undefined;
        delete navigator.clipboard;
    });

    describe('Initialization', () => {
        test('should initialize successfully with all dependencies', async () => {
            await widgetConfigModule.initialize();
            
            expect(widgetConfigModule.apiManager).toBe(mockAPIManager);
            expect(widgetConfigModule.stateManager).toBe(mockStateManager);
            expect(widgetConfigModule.connectionManager).toBe(mockConnectionManager);
        });

        test('should initialize DOM elements correctly', async () => {
            await widgetConfigModule.initialize();
            
            expect(widgetConfigModule.elements.widgetConfigDiv).toBeTruthy();
            expect(widgetConfigModule.elements.generateCodeButton).toBeTruthy();
            expect(widgetConfigModule.elements.copyCodeButton).toBeTruthy();
            expect(widgetConfigModule.elements.codeContainer).toBeTruthy();
            expect(widgetConfigModule.elements.integrationCodeTextarea).toBeTruthy();
        });

        test('should setup event listeners on initialization', async () => {
            await widgetConfigModule.initialize();
            
            expect(widgetConfigModule.eventListeners.length).toBeGreaterThan(0);
            
            // Check for generate code button listener
            const generateListener = widgetConfigModule.eventListeners.find(
                listener => listener.element.id === 'generate-code'
            );
            expect(generateListener).toBeTruthy();
            
            // Check for copy code button listener
            const copyListener = widgetConfigModule.eventListeners.find(
                listener => listener.element.id === 'copy-code'
            );
            expect(copyListener).toBeTruthy();
        });

        test('should load configuration on initialization', async () => {
            await widgetConfigModule.initialize();
            
            expect(mockAPIManager.getRequestCount('/api/widget/config')).toBe(1);
            expect(mockStateManager.getWidgetConfiguration()).toBeTruthy();
        });

        test('should setup state listeners on initialization', async () => {
            await widgetConfigModule.initialize();
            
            expect(mockStateManager.listeners.has('widgetConfigurationChanged')).toBe(true);
            expect(mockStateManager.listeners.get('widgetConfigurationChanged').length).toBe(1);
        });
    });

    describe('Configuration Loading and Display', () => {
        beforeEach(async () => {
            await widgetConfigModule.initialize();
        });

        test('should load configuration successfully', async () => {
            mockAPIManager.clearRequestHistory();
            
            await widgetConfigModule.loadConfiguration();
            
            expect(mockAPIManager.getRequestCount('/api/widget/config')).toBe(1);
        });

        test('should render configuration correctly', () => {
            const testConfig = TestDataFactory.createWidgetConfig({
                name: 'Test Widget',
                primaryColor: '#2c5530',
                allowedDomains: ['example.com', 'test.com'],
                serverUrl: 'https://api.example.com'
            });
            
            widgetConfigModule.renderConfiguration(testConfig);
            
            const configDiv = document.getElementById('current-widget-config');
            expect(configDiv.innerHTML).toContain('Test Widget');
            expect(configDiv.innerHTML).toContain('#2c5530');
            expect(configDiv.innerHTML).toContain('example.com,test.com');
            expect(configDiv.innerHTML).toContain('https://api.example.com');
        });

        test('should render configuration with defaults for missing values', () => {
            const testConfig = {
                name: null,
                primaryColor: null,
                allowedDomains: null,
                serverUrl: null
            };
            
            widgetConfigModule.renderConfiguration(testConfig);
            
            const configDiv = document.getElementById('current-widget-config');
            expect(configDiv.innerHTML).toContain('Not set');
            expect(configDiv.innerHTML).toContain('#000000');
            expect(configDiv.innerHTML).toContain('All domains');
            expect(configDiv.innerHTML).toContain('Default');
        });

        test('should render color swatch correctly', () => {
            const testConfig = TestDataFactory.createWidgetConfig({
                primaryColor: '#ff5733'
            });
            
            widgetConfigModule.renderConfiguration(testConfig);
            
            const configDiv = document.getElementById('current-widget-config');
            expect(configDiv.innerHTML).toContain('background-color: #ff5733');
        });

        test('should render error state when configuration fails', () => {
            const errorMessage = 'Configuration load failed';
            
            widgetConfigModule.renderConfigurationError(errorMessage);
            
            const configDiv = document.getElementById('current-widget-config');
            expect(configDiv.innerHTML).toContain('Configuration Error');
            expect(configDiv.innerHTML).toContain(errorMessage);
        });

        test('should handle null configuration gracefully', () => {
            widgetConfigModule.renderConfiguration(null);
            
            const configDiv = document.getElementById('current-widget-config');
            expect(configDiv.innerHTML).toContain('No configuration data available');
        });

        test('should handle missing DOM elements gracefully', () => {
            // Remove DOM element
            document.body.innerHTML = '';
            
            expect(() => {
                widgetConfigModule.renderConfiguration(TestDataFactory.createWidgetConfig());
            }).not.toThrow();
        });
    });

    describe('Integration Code Generation', () => {
        beforeEach(async () => {
            await widgetConfigModule.initialize();
        });

        test('should generate integration code successfully', async () => {
            await widgetConfigModule.generateIntegrationCode();
            
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3002/api/widget/integration-code'
            );
            
            const textarea = document.getElementById('integration-code');
            expect(textarea.value).toBe('<script src="http://localhost:3002/widget.js"></script>');
            
            const container = document.getElementById('integration-code-container');
            expect(container.classList.contains('hidden')).toBe(false);
            
            expect(global.Toast.success).toHaveBeenCalledWith(
                'Integration code generated successfully',
                ''
            );
        });

        test('should handle generate code API errors', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Generation failed' })
            });
            
            await widgetConfigModule.generateIntegrationCode();
            
            expect(global.Toast.error).toHaveBeenCalledWith(
                'Failed to generate integration code',
                ''
            );
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
        });

        test('should handle network errors during generation', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));
            
            await widgetConfigModule.generateIntegrationCode();
            
            expect(global.Toast.error).toHaveBeenCalledWith(
                'Failed to generate integration code',
                ''
            );
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
        });

        test('should update button state during generation', async () => {
            const generateButton = document.getElementById('generate-code');
            
            // Mock slow API response
            global.fetch.mockImplementationOnce(() => 
                new Promise(resolve => setTimeout(() => resolve({
                    ok: true,
                    json: async () => ({ success: true, data: { integrationCode: 'test' } })
                }), 100))
            );
            
            const generatePromise = widgetConfigModule.generateIntegrationCode();
            
            // Check button state during generation
            expect(generateButton.disabled).toBe(true);
            expect(generateButton.textContent).toBe('Generating...');
            
            await generatePromise;
            
            // Check button state after generation
            expect(generateButton.disabled).toBe(false);
            expect(generateButton.textContent).toBe('Generate Integration Code');
        });
    });

    describe('Copy to Clipboard', () => {
        beforeEach(async () => {
            await widgetConfigModule.initialize();
            
            // Set up integration code
            const textarea = document.getElementById('integration-code');
            textarea.value = '<script src="test.js"></script>';
        });

        test('should copy integration code to clipboard successfully', async () => {
            await widgetConfigModule.copyIntegrationCode();
            
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('<script src="test.js"></script>');
            expect(global.Toast.success).toHaveBeenCalledWith(
                'Integration code copied to clipboard!',
                ''
            );
        });

        test('should handle clipboard API errors', async () => {
            navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));
            
            await widgetConfigModule.copyIntegrationCode();
            
            expect(global.Toast.error).toHaveBeenCalledWith(
                'Failed to copy to clipboard',
                ''
            );
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
        });

        test('should handle empty integration code', async () => {
            const textarea = document.getElementById('integration-code');
            textarea.value = '';
            
            await widgetConfigModule.copyIntegrationCode();
            
            expect(global.Toast.error).toHaveBeenCalledWith(
                'No integration code to copy. Please generate code first.',
                ''
            );
            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
        });

        test('should update copy button state temporarily', async () => {
            const copyButton = document.getElementById('copy-code');
            const originalText = copyButton.textContent;
            
            await widgetConfigModule.copyIntegrationCode();
            
            expect(copyButton.textContent).toBe('✓ Copied!');
            
            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 2100));
            
            expect(copyButton.textContent).toBe(originalText);
        });
    });

    describe('Configuration Validation', () => {
        test('should validate valid configuration', () => {
            const validConfig = TestDataFactory.createWidgetConfig({
                name: 'Test Widget',
                primaryColor: '#2c5530',
                serverUrl: 'https://api.example.com'
            });
            
            expect(widgetConfigModule.validateConfiguration(validConfig)).toBe(true);
        });

        test('should reject null configuration', () => {
            expect(widgetConfigModule.validateConfiguration(null)).toBe(false);
        });

        test('should reject configuration with missing fields', () => {
            const invalidConfig = {
                name: null,
                primaryColor: '#2c5530',
                serverUrl: 'https://api.example.com'
            };
            
            expect(widgetConfigModule.validateConfiguration(invalidConfig)).toBeFalsy();
        });

        test('should reject configuration with invalid color', () => {
            const invalidConfig = TestDataFactory.createWidgetConfig({
                primaryColor: 'invalid-color'
            });
            
            expect(widgetConfigModule.validateConfiguration(invalidConfig)).toBe(false);
        });

        test('should accept various valid color formats', () => {
            const colorTests = [
                { color: '#000000', expected: true },
                { color: '#FFFFFF', expected: true },
                { color: '#2c5530', expected: true },
                { color: '#FF5733', expected: true },
                { color: '#123', expected: false },
                { color: 'blue', expected: false },
                { color: '#GGGGGG', expected: false }
            ];
            
            colorTests.forEach(({ color, expected }) => {
                const config = TestDataFactory.createWidgetConfig({ primaryColor: color });
                expect(widgetConfigModule.validateConfiguration(config)).toBe(expected);
            });
        });
    });

    describe('Button State Management', () => {
        beforeEach(async () => {
            await widgetConfigModule.initialize();
        });

        test('should set generate button to generating state', () => {
            const generateButton = document.getElementById('generate-code');
            
            widgetConfigModule.setGenerateButtonState('generating');
            
            expect(generateButton.disabled).toBe(true);
            expect(generateButton.textContent).toBe('Generating...');
        });

        test('should set generate button to normal state', () => {
            const generateButton = document.getElementById('generate-code');
            
            widgetConfigModule.setGenerateButtonState('normal');
            
            expect(generateButton.disabled).toBe(false);
            expect(generateButton.textContent).toBe('Generate Integration Code');
        });

        test('should set copy button to success state temporarily', async () => {
            const copyButton = document.getElementById('copy-code');
            const originalText = copyButton.textContent;
            
            widgetConfigModule.setCopyButtonState('success');
            
            expect(copyButton.textContent).toBe('✓ Copied!');
            
            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 2100));
            
            expect(copyButton.textContent).toBe(originalText);
        });

        test('should handle missing buttons gracefully', () => {
            document.body.innerHTML = '';
            
            expect(() => {
                widgetConfigModule.setGenerateButtonState('generating');
                widgetConfigModule.setCopyButtonState('success');
            }).not.toThrow();
        });
    });

    describe('Event Handling', () => {
        beforeEach(async () => {
            await widgetConfigModule.initialize();
        });

        test('should handle generate code button click', async () => {
            const spy = jest.spyOn(widgetConfigModule, 'generateIntegrationCode');
            
            await widgetConfigModule.handleGenerateCodeClick();
            
            expect(spy).toHaveBeenCalled();
        });

        test('should handle copy code button click', async () => {
            const spy = jest.spyOn(widgetConfigModule, 'copyIntegrationCode');
            
            await widgetConfigModule.handleCopyCodeClick();
            
            expect(spy).toHaveBeenCalled();
        });

        test('should handle state manager events', () => {
            const spy = jest.spyOn(widgetConfigModule, 'renderConfiguration');
            const testConfig = TestDataFactory.createWidgetConfig();
            
            mockStateManager.emit('widgetConfigurationChanged', testConfig);
            
            expect(spy).toHaveBeenCalledWith(testConfig);
        });

        test('should trigger button handlers via DOM events', async () => {
            const generateSpy = jest.spyOn(widgetConfigModule, 'handleGenerateCodeClick');
            const copySpy = jest.spyOn(widgetConfigModule, 'handleCopyCodeClick');
            
            // Simulate button clicks
            const generateButton = document.getElementById('generate-code');
            const copyButton = document.getElementById('copy-code');
            
            generateButton.click();
            copyButton.click();
            
            expect(generateSpy).toHaveBeenCalled();
            expect(copySpy).toHaveBeenCalled();
        });
    });

    describe('Public API', () => {
        beforeEach(async () => {
            await widgetConfigModule.initialize();
        });

        test('should get current configuration', () => {
            const testConfig = TestDataFactory.createWidgetConfig();
            mockStateManager.setWidgetConfiguration(testConfig);
            
            expect(widgetConfigModule.getCurrentConfiguration()).toEqual(testConfig);
        });

        test('should force refresh configuration', async () => {
            mockAPIManager.clearRequestHistory();
            
            await widgetConfigModule.refresh();
            
            expect(mockAPIManager.getRequestCount('/api/widget/config')).toBe(1);
        });

        test('should add configuration change event listeners', () => {
            const callback = jest.fn();
            
            widgetConfigModule.onConfigurationChanged(callback);
            mockStateManager.emit('widgetConfigurationChanged', {});
            
            expect(callback).toHaveBeenCalled();
        });

        test('should remove configuration change event listeners', () => {
            const callback = jest.fn();
            
            widgetConfigModule.onConfigurationChanged(callback);
            widgetConfigModule.offConfigurationChanged(callback);
            mockStateManager.emit('widgetConfigurationChanged', {});
            
            expect(callback).not.toHaveBeenCalled();
        });

        test('should check if integration code is available', () => {
            const textarea = document.getElementById('integration-code');
            
            textarea.value = '';
            expect(widgetConfigModule.hasIntegrationCode()).toBe(false);
            
            textarea.value = '<script>test</script>';
            expect(widgetConfigModule.hasIntegrationCode()).toBe(true);
        });
    });

    describe('Utility Methods', () => {
        test('should get configuration info', () => {
            const testConfig = TestDataFactory.createWidgetConfig({
                name: 'Test Widget',
                primaryColor: '#2c5530'
            });
            
            const info = widgetConfigModule.getConfigurationInfo(testConfig);
            
            expect(info.name).toBe('Test Widget');
            expect(info.primaryColor).toBe('#2c5530');
            expect(info.isValid).toBe(true);
        });

        test('should provide default values in configuration info', () => {
            const testConfig = {
                name: null,
                primaryColor: null
            };
            
            const info = widgetConfigModule.getConfigurationInfo(testConfig);
            
            expect(info.name).toBe('Unnamed Widget');
            expect(info.primaryColor).toBe('#000000');
        });

        test('should return null for null configuration info', () => {
            expect(widgetConfigModule.getConfigurationInfo(null)).toBeNull();
        });

        test('should provide module status for debugging', async () => {
            await widgetConfigModule.initialize();
            
            const testConfig = TestDataFactory.createWidgetConfig();
            mockStateManager.setWidgetConfiguration(testConfig);
            
            const status = widgetConfigModule.getStatus();
            
            expect(status.hasConfiguration).toBe(true);
            expect(status.configurationValid).toBe(true);
            expect(status.elements.widgetConfigDiv).toBe(true);
            expect(status.elements.generateCodeButton).toBe(true);
            expect(status.eventListeners).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle initialization errors gracefully', async () => {
            const faultyModule = new WidgetConfigModule(null, null, null);
            
            await expect(faultyModule.initialize()).rejects.toThrow();
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
        });

        test('should handle API errors during configuration loading', async () => {
            await widgetConfigModule.initialize();
            
            mockAPIManager.setMockResponse('/api/widget/config', {
                error: 'Config load failed'
            }, true);
            
            await widgetConfigModule.loadConfiguration();
            
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
            
            const configDiv = document.getElementById('current-widget-config');
            expect(configDiv.innerHTML).toContain('Configuration Error');
        });
    });

    describe('Cleanup', () => {
        test('should cleanup event listeners on destroy', async () => {
            await widgetConfigModule.initialize();
            
            const initialListenerCount = widgetConfigModule.eventListeners.length;
            expect(initialListenerCount).toBeGreaterThan(0);
            
            widgetConfigModule.destroy();
            
            expect(widgetConfigModule.eventListeners.length).toBe(0);
        });

        test('should handle cleanup with missing elements gracefully', () => {
            widgetConfigModule.eventListeners = [
                { element: null, event: 'click', handler: jest.fn() }
            ];
            
            expect(() => {
                widgetConfigModule.destroy();
            }).not.toThrow();
        });
    });

    describe('Integration', () => {
        test('should integrate with APIManager correctly', async () => {
            await widgetConfigModule.initialize();
            
            const spy = jest.spyOn(mockAPIManager, 'loadWidgetConfiguration');
            await widgetConfigModule.loadConfiguration();
            
            expect(spy).toHaveBeenCalled();
        });

        test('should integrate with StateManager correctly', async () => {
            await widgetConfigModule.initialize();
            
            const testConfig = TestDataFactory.createWidgetConfig();
            mockStateManager.setWidgetConfiguration(testConfig);
            
            expect(widgetConfigModule.getCurrentConfiguration()).toEqual(testConfig);
        });

        test('should respond to real-time configuration changes', async () => {
            await widgetConfigModule.initialize();
            
            const spy = jest.spyOn(widgetConfigModule, 'renderConfiguration');
            const newConfig = TestDataFactory.createWidgetConfig({ name: 'Updated Widget' });
            
            mockStateManager.emit('widgetConfigurationChanged', newConfig);
            
            expect(spy).toHaveBeenCalledWith(newConfig);
        });
    });
});