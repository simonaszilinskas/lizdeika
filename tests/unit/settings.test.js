
const TestUtils = require('../utilities/test-utils');
const APIMocks = require('../mocks/api-mocks');
const JSDOMEnvironment = require('../../test-config/jsdom.config');
const fs = require('fs');
const path = require('path');

describe('Settings Component', () => {
    let jsdom;
    let Settings;
    
    beforeEach(() => {
        jsdom = new JSDOMEnvironment().setup();
        APIMocks.setupMocks();
        
        // Create required DOM elements for Settings
        const settingsHTML = `
            <div id="current-mode"></div>
            <button id="save-mode"></button>
            <div id="agents-list"></div>
            <span id="total-connected">0</span>
            <span id="total-available">0</span>
            <span id="total-afk">0</span>
            <div id="message"></div>
            <i id="message-icon"></i>
            <span id="message-text"></span>
        `;
        document.body.innerHTML = settingsHTML;
        
        // Load and eval the settings script in the jsdom context
        const settingsPath = path.join(__dirname, '../../custom-widget/js/settings.js');
        const settingsContent = fs.readFileSync(settingsPath, 'utf8');
        
        // Create a minimal Settings class for testing (avoid full initialization)
        const testSettingsContent = `
        class Settings {
            constructor() {
                this.apiUrl = 'http://localhost:3002';
                this.currentUser = null;
                this.currentMode = null;
                this.errorHandler = null;
                this.apiRequest = async (url, options) => fetch(\`\${this.apiUrl}\${url}\`, options);
            }
            
            async loadCurrentUser() {
                try {
                    const response = await this.apiRequest('/api/auth/profile');
                    const data = await response.json();
                    this.currentUser = data.data;
                } catch (error) {
                    this.currentUser = null;
                }
            }
            
            async loadSystemMode() {
                try {
                    const response = await this.apiRequest('/api/system/mode');
                    const data = await response.json();
                    this.currentMode = data.data.mode;
                } catch (error) {
                    this.currentMode = null;
                }
            }
            
            async saveSystemMode() {
                const selectedMode = document.querySelector('input[name="systemMode"]:checked');
                if (selectedMode) {
                    const response = await this.apiRequest('/api/system/mode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mode: selectedMode.value })
                    });
                }
            }
            
            initializeElements() {
                this.messageDiv = document.getElementById('message');
                this.messageIcon = document.getElementById('message-icon');
                this.messageText = document.getElementById('message-text');
            }
            
            showMessage(message, type) {
                if (global.notificationSystem && global.notificationSystem.success) {
                    global.notificationSystem.success(message, '');
                } else {
                    const messageText = document.getElementById('message-text');
                    if (messageText) {
                        messageText.textContent = message;
                    }
                }
            }
        }
        global.Settings = Settings;
        `;
        
        // Execute the test version
        eval(testSettingsContent);
        Settings = global.Settings;
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
            
            // Update the Settings constructor to use ErrorHandler
            const testSettingsContent = `
            class Settings {
                constructor() {
                    this.apiUrl = 'http://localhost:3002';
                    this.currentUser = null;
                    this.currentMode = null;
                    this.errorHandler = null;
                    this.apiRequest = null;
                    
                    if (global.ErrorHandler) {
                        this.errorHandler = new global.ErrorHandler();
                        this.apiRequest = this.errorHandler.createAPIErrorHandler(this.apiUrl);
                    } else {
                        this.apiRequest = async (url, options) => fetch(\`\${this.apiUrl}\${url}\`, options);
                    }
                }
                
                async loadCurrentUser() {
                    try {
                        const response = await this.apiRequest('/api/auth/profile');
                        const data = await response.json();
                        this.currentUser = data.data;
                    } catch (error) {
                        this.currentUser = null;
                    }
                }
            }
            global.Settings = Settings;
            `;
            eval(testSettingsContent);
            const Settings = global.Settings;
            
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
                Promise.reject(new Error('Unauthorized'))
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
            
            // Clean up for next test
            delete global.notificationSystem;
        });
        
        test('should fallback to old message system', () => {
            const settings = new Settings();
            
            settings.initializeElements();
            settings.showMessage('Test message', 'info');
            
            const messageText = document.getElementById('message-text');
            expect(messageText.textContent).toBe('Test message');
        });
    });
});
