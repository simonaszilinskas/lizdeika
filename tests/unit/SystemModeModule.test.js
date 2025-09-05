/**
 * SystemModeModule Unit Tests
 * 
 * Comprehensive tests for system mode management functionality
 * Tests module initialization, mode changes, UI updates, and error handling
 */

const TestUtils = require('../utilities/test-utils');
const ModuleLoader = require('../utilities/module-loader');
const { MockAPIManager, MockStateManager, MockConnectionManager, TestDataFactory, DOMTestUtils } = require('../mocks/phase2-mocks');
const JSDOMEnvironment = require('../../test-config/jsdom.config');
const path = require('path');

describe('SystemModeModule', () => {
    let jsdom;
    let SystemModeModule;
    let mockAPIManager;
    let mockStateManager;
    let mockConnectionManager;
    let systemModeModule;

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
        mockAPIManager.setMockResponse('/api/system/mode', {
            success: true,
            data: { mode: 'hitl', lastChanged: new Date().toISOString() }
        });
        
        // Mock fetch for integration code generation in module
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: { mode: 'hitl' }
            })
        });
        
        // Load SystemModeModule using ModuleLoader
        const modulePath = path.join(__dirname, '../../custom-widget/js/settings/modules/SystemModeModule.js');
        const mockDependencies = ModuleLoader.createMockDependencies();
        
        SystemModeModule = ModuleLoader.loadModule(modulePath, mockDependencies);
        global.Toast = mockDependencies.Toast;
        global.ErrorHandler = mockDependencies.ErrorHandler;
        
        // Create module instance
        systemModeModule = new SystemModeModule(mockAPIManager, mockStateManager, mockConnectionManager);
    });

    afterEach(() => {
        if (jsdom && jsdom.cleanup) {
            jsdom.cleanup();
        }
        jest.clearAllMocks();
        global.fetch = undefined;
    });

    describe('Initialization', () => {
        test('should initialize successfully with all dependencies', async () => {
            await systemModeModule.initialize();
            
            expect(systemModeModule.apiManager).toBe(mockAPIManager);
            expect(systemModeModule.stateManager).toBe(mockStateManager);
            expect(systemModeModule.connectionManager).toBe(mockConnectionManager);
        });

        test('should initialize DOM elements correctly', async () => {
            await systemModeModule.initialize();
            
            expect(systemModeModule.elements.currentModeSpan).toBeTruthy();
            expect(systemModeModule.elements.saveModeButton).toBeTruthy();
            expect(systemModeModule.elements.systemModeRadios).toBeTruthy();
            expect(systemModeModule.elements.systemModeRadios.length).toBeGreaterThan(0);
        });

        test('should setup event listeners on initialization', async () => {
            await systemModeModule.initialize();
            
            expect(systemModeModule.eventListeners.length).toBeGreaterThan(0);
            
            // Check that save button has event listener
            const saveButtonListener = systemModeModule.eventListeners.find(
                listener => listener.element.id === 'save-mode'
            );
            expect(saveButtonListener).toBeTruthy();
        });

        test('should load current mode on initialization', async () => {
            await systemModeModule.initialize();
            
            expect(mockAPIManager.getRequestCount('/api/system/mode')).toBe(1);
            expect(mockStateManager.getSystemMode()).toBe('hitl');
        });

        test('should setup state listeners on initialization', async () => {
            await systemModeModule.initialize();
            
            // Verify state manager has listeners
            expect(mockStateManager.listeners.has('systemModeChanged')).toBe(true);
            expect(mockStateManager.listeners.get('systemModeChanged').length).toBe(1);
        });
    });

    describe('System Mode Management', () => {
        beforeEach(async () => {
            await systemModeModule.initialize();
        });

        test('should load current mode successfully', async () => {
            mockAPIManager.clearRequestHistory();
            
            await systemModeModule.loadCurrentMode();
            
            expect(mockAPIManager.getRequestCount('/api/system/mode')).toBe(1);
            expect(mockStateManager.getSystemMode()).toBe('hitl');
        });

        test('should validate mode changes correctly', () => {
            expect(systemModeModule.validateMode('hitl')).toBe(true);
            expect(systemModeModule.validateMode('autopilot')).toBe(true);
            expect(systemModeModule.validateMode('off')).toBe(true);
            expect(systemModeModule.validateMode('invalid')).toBe(false);
            expect(systemModeModule.validateMode('')).toBe(false);
            expect(systemModeModule.validateMode(null)).toBe(false);
        });

        test('should change mode successfully', async () => {
            mockAPIManager.setMockResponse('/api/system/mode', {
                success: true,
                data: { mode: 'autopilot' }
            });
            
            const result = await systemModeModule.changeMode('autopilot');
            
            expect(result).toBe(true);
            expect(global.Toast.success).toHaveBeenCalledWith(
                'System mode changed to AUTOPILOT', 
                ''
            );
        });

        test('should handle mode change failure', async () => {
            // Mock fetch to return an error response
            global.fetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Mode change failed' })
            });
            
            const result = await systemModeModule.changeMode('autopilot');
            
            expect(result).toBe(false);
            expect(global.Toast.error).toHaveBeenCalledWith(
                'Failed to update system mode',
                ''
            );
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
        });

        test('should not change mode if it is the same as current', async () => {
            mockStateManager.setSystemMode('hitl');
            
            const result = await systemModeModule.changeMode('hitl');
            
            expect(result).toBe(true);
            expect(global.Toast.info).toHaveBeenCalledWith('No changes to save', '');
        });

        test('should reject invalid mode changes', async () => {
            const result = await systemModeModule.changeMode('invalid-mode');
            
            expect(result).toBe(false);
            expect(global.Toast.error).toHaveBeenCalledWith('Invalid system mode', '');
        });
    });

    describe('UI Updates', () => {
        beforeEach(async () => {
            await systemModeModule.initialize();
        });

        test('should update mode display correctly', () => {
            systemModeModule.updateModeDisplay('autopilot');
            
            const currentModeSpan = document.getElementById('current-mode');
            expect(currentModeSpan.textContent).toBe('AUTOPILOT');
            
            const selectedRadio = document.querySelector('input[value="autopilot"]');
            expect(selectedRadio.checked).toBe(true);
        });

        test('should update save button state correctly', () => {
            mockStateManager.setSystemMode('hitl');
            
            // No changes - button should be disabled
            DOMTestUtils.simulateRadioChange('systemMode', 'hitl');
            systemModeModule.updateSaveButtonState();
            
            const saveButton = document.getElementById('save-mode');
            expect(saveButton.disabled).toBe(true);
            expect(saveButton.textContent).toBe('No Changes');
            
            // Has changes - button should be enabled
            DOMTestUtils.simulateRadioChange('systemMode', 'autopilot');
            systemModeModule.updateSaveButtonState();
            
            expect(saveButton.disabled).toBe(false);
            expect(saveButton.textContent).toBe('Save Changes');
        });

        test('should set button states correctly', () => {
            const saveButton = document.getElementById('save-mode');
            
            systemModeModule.setButtonState('saving');
            expect(saveButton.disabled).toBe(true);
            expect(saveButton.textContent).toBe('Saving...');
            
            systemModeModule.setButtonState('disabled');
            expect(saveButton.disabled).toBe(true);
            expect(saveButton.textContent).toBe('No Changes');
            
            systemModeModule.setButtonState('normal');
            expect(saveButton.disabled).toBe(false);
            expect(saveButton.textContent).toBe('Save Changes');
        });
    });

    describe('Event Handling', () => {
        beforeEach(async () => {
            await systemModeModule.initialize();
        });

        test('should handle save mode button click', async () => {
            mockStateManager.setSystemMode('hitl');
            DOMTestUtils.simulateRadioChange('systemMode', 'autopilot');
            
            const spy = jest.spyOn(systemModeModule, 'changeMode');
            
            await systemModeModule.handleSaveModeClick();
            
            expect(spy).toHaveBeenCalledWith('autopilot');
        });

        test('should handle save mode button click with no selection', async () => {
            // Clear all radio selections
            document.querySelectorAll('input[name="systemMode"]').forEach(radio => {
                radio.checked = false;
            });
            
            await systemModeModule.handleSaveModeClick();
            
            expect(global.Toast.error).toHaveBeenCalledWith(
                'Please select a system mode',
                ''
            );
        });

        test('should handle mode radio change', () => {
            const spy = jest.spyOn(systemModeModule, 'updateSaveButtonState');
            
            systemModeModule.handleModeRadioChange();
            
            expect(spy).toHaveBeenCalled();
        });

        test('should handle state manager events', () => {
            const spy = jest.spyOn(systemModeModule, 'updateModeDisplay');
            
            mockStateManager.emit('systemModeChanged', 'autopilot');
            
            expect(spy).toHaveBeenCalledWith('autopilot');
        });
    });

    describe('Public API', () => {
        beforeEach(async () => {
            await systemModeModule.initialize();
        });

        test('should return current mode', () => {
            mockStateManager.setSystemMode('autopilot');
            
            expect(systemModeModule.getCurrentMode()).toBe('autopilot');
        });

        test('should detect unsaved changes', () => {
            mockStateManager.setSystemMode('hitl');
            DOMTestUtils.simulateRadioChange('systemMode', 'hitl');
            
            expect(systemModeModule.hasUnsavedChanges()).toBe(false);
            
            DOMTestUtils.simulateRadioChange('systemMode', 'autopilot');
            
            expect(systemModeModule.hasUnsavedChanges()).toBe(true);
        });

        test('should reset to current mode', () => {
            mockStateManager.setSystemMode('hitl');
            DOMTestUtils.simulateRadioChange('systemMode', 'autopilot');
            
            systemModeModule.resetToCurrentMode();
            
            const selectedRadio = document.querySelector('input[value="hitl"]');
            expect(selectedRadio.checked).toBe(true);
        });

        test('should provide mode information', () => {
            const hitlInfo = systemModeModule.getModeInfo('hitl');
            expect(hitlInfo.name).toBe('HITL (Human in the Loop)');
            expect(hitlInfo.description).toContain('AI generates suggestions');
            
            const autopilotInfo = systemModeModule.getModeInfo('autopilot');
            expect(autopilotInfo.name).toBe('Autopilot Mode');
            
            const offInfo = systemModeModule.getModeInfo('off');
            expect(offInfo.name).toBe('OFF Mode');
            
            expect(systemModeModule.getModeInfo('invalid')).toBe(null);
        });

        test('should provide status information', () => {
            mockStateManager.setSystemMode('hitl');
            DOMTestUtils.simulateRadioChange('systemMode', 'autopilot');
            
            const status = systemModeModule.getStatus();
            
            expect(status.currentMode).toBe('hitl');
            expect(status.selectedMode).toBe('autopilot');
            expect(status.hasUnsavedChanges).toBe(true);
            expect(status.elements.currentModeSpan).toBe(true);
            expect(status.elements.saveModeButton).toBe(true);
            expect(status.eventListeners).toBeGreaterThan(0);
        });
    });

    describe('Event Listener Management', () => {
        test('should add mode change event listener', async () => {
            await systemModeModule.initialize();
            
            const callback = jest.fn();
            systemModeModule.onModeChanged(callback);
            
            mockStateManager.emit('systemModeChanged', 'autopilot');
            
            expect(callback).toHaveBeenCalledWith('autopilot');
        });

        test('should remove mode change event listener', async () => {
            await systemModeModule.initialize();
            
            const callback = jest.fn();
            systemModeModule.onModeChanged(callback);
            systemModeModule.offModeChanged(callback);
            
            mockStateManager.emit('systemModeChanged', 'autopilot');
            
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        test('should cleanup event listeners on destroy', async () => {
            await systemModeModule.initialize();
            
            const initialListenerCount = systemModeModule.eventListeners.length;
            expect(initialListenerCount).toBeGreaterThan(0);
            
            systemModeModule.destroy();
            
            expect(systemModeModule.eventListeners.length).toBe(0);
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            await systemModeModule.initialize();
        });

        test('should handle initialization errors gracefully', async () => {
            const faultyModule = new SystemModeModule(null, null, null);
            
            await expect(faultyModule.initialize()).rejects.toThrow();
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
        });

        test('should handle load current mode API errors', async () => {
            mockAPIManager.setMockResponse('/api/system/mode', {
                error: 'API Error'
            }, true);
            
            await systemModeModule.loadCurrentMode();
            
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
            expect(global.Toast.error).toHaveBeenCalledWith(
                'Failed to load current system mode',
                ''
            );
        });
    });

    describe('Integration', () => {
        test('should integrate with APIManager correctly', async () => {
            await systemModeModule.initialize();
            
            const spy = jest.spyOn(mockAPIManager, 'loadSystemMode');
            await systemModeModule.loadCurrentMode();
            
            expect(spy).toHaveBeenCalled();
        });

        test('should integrate with StateManager correctly', async () => {
            await systemModeModule.initialize();
            
            const testMode = 'autopilot';
            mockStateManager.setSystemMode(testMode);
            
            expect(systemModeModule.getCurrentMode()).toBe(testMode);
        });

        test('should respond to real-time updates', async () => {
            await systemModeModule.initialize();
            
            const spy = jest.spyOn(systemModeModule, 'updateModeDisplay');
            
            // Simulate real-time update from WebSocket
            mockConnectionManager.simulateSystemModeUpdate('off');
            mockStateManager.emit('systemModeChanged', 'off');
            
            expect(spy).toHaveBeenCalledWith('off');
        });
    });
});