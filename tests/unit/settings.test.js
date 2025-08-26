
const TestUtils = require('../utilities/test-utils');
const APIMocks = require('../mocks/api-mocks');
const JSDOMEnvironment = require('../../test-config/jsdom.config');

describe('Settings Component', () => {
    let jsdom;
    let Settings;
    
    beforeEach(() => {
        jsdom = new JSDOMEnvironment().setup();
        APIMocks.setupMocks();
        
        // Load the settings script
        jsdom.loadScript('custom-widget/js/settings.js');
        Settings = global.Settings || window.Settings;
    });
    
    afterEach(() => {
        APIMocks.resetMocks();
        jsdom.teardown();
    });
    
    describe('Initialization', () => {
        test('should initialize with correct API URL', () => {
            const settings = new Settings();
            expect(settings.apiUrl).toBe('http://localhost:3002');
        });
        
        test('should initialize error handling if available', () => {
            // Mock ErrorHandler
            global.ErrorHandler = jest.fn().mockImplementation(() => ({
                createAPIErrorHandler: jest.fn()
            }));
            
            const settings = new Settings();
            expect(global.ErrorHandler).toHaveBeenCalled();
        });
    });
    
    describe('User Management', () => {
        test('should load current user successfully', async () => {
            const settings = new Settings();
            await settings.loadCurrentUser();
            
            expect(settings.currentUser).toBeDefined();
            expect(settings.currentUser.email).toBe('test@vilnius.lt');
        });
        
        test('should handle authentication errors gracefully', async () => {
            // Mock failed authentication
            global.fetch.mockImplementationOnce(() => 
                Promise.resolve({
                    ok: false,
                    status: 401,
                    json: () => Promise.resolve({ error: 'Unauthorized' })
                })
            );
            
            const settings = new Settings();
            await settings.loadCurrentUser();
            
            expect(settings.currentUser).toBeNull();
        });
    });
    
    describe('System Mode Management', () => {
        test('should load system mode successfully', async () => {
            const settings = new Settings();
            await settings.loadSystemMode();
            
            expect(settings.currentMode).toBe('hitl');
        });
        
        test('should save system mode changes', async () => {
            const settings = new Settings();
            
            // Mock radio button selection
            const radioButton = TestUtils.createMockElement('input', {
                type: 'radio',
                name: 'systemMode',
                value: 'autopilot'
            });
            radioButton.checked = true;
            document.body.appendChild(radioButton);
            
            await settings.saveSystemMode();
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/system/mode'),
                expect.objectContaining({
                    method: 'POST'
                })
            );
        });
    });
    
    describe('Message Display', () => {
        test('should show success messages', () => {
            // Mock notification system
            global.notificationSystem = {
                success: jest.fn()
            };
            
            const settings = new Settings();
            settings.showMessage('Test success', 'success');
            
            expect(global.notificationSystem.success).toHaveBeenCalledWith(
                'Test success', 
                ''
            );
        });
        
        test('should fallback to old message system', () => {
            const settings = new Settings();
            
            // Create message elements
            const messageDiv = TestUtils.createMockElement('div', { id: 'message' });
            const messageText = TestUtils.createMockElement('span', { id: 'message-text' });
            const messageIcon = TestUtils.createMockElement('i', { id: 'message-icon' });
            
            document.body.appendChild(messageDiv);
            document.body.appendChild(messageText);
            document.body.appendChild(messageIcon);
            
            settings.initializeElements();
            settings.showMessage('Test message', 'info');
            
            expect(messageText.textContent).toBe('Test message');
        });
    });
});
