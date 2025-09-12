/**
 * CONTEXT ENGINEERING MODULE UNIT TESTS
 * 
 * Comprehensive unit tests for the Context Engineering module
 * Tests validation, DOM interactions, API calls, and state management
 * 
 * @version 1.0.0
 */

const TestUtils = require('../utilities/test-utils');
const APIMocks = require('../mocks/api-mocks');
const JSDOMEnvironment = require('../../test-config/jsdom.config');
const ModuleLoader = require('../utilities/module-loader');

// Test configuration paths
const CONSTANTS_PATH = 'custom-widget/js/settings/constants/ContextEngineeringConstants.js';
const VALIDATOR_PATH = 'custom-widget/js/settings/services/PromptValidator.js';
const DOM_HELPER_PATH = 'custom-widget/js/settings/utils/DOMHelper.js';
const NOTIFICATION_PATH = 'custom-widget/js/settings/services/NotificationService.js';

describe('Context Engineering Components', () => {
    let jsdom;
    let PromptValidator, DOMHelper, NotificationService, CONTEXT_ENGINEERING_CONSTANTS;

    beforeAll(() => {
        // Setup JSDOM environment
        jsdom = new JSDOMEnvironment().setup();
        APIMocks.setupMocks();
        
        try {
            // Load the constants first
            CONTEXT_ENGINEERING_CONSTANTS = ModuleLoader.loadModule(CONSTANTS_PATH);
            
            // Create mock dependencies for modules that need them
            const mockDeps = {
                CONTEXT_ENGINEERING_CONSTANTS,
                // Mock the destructured constants for PromptValidator
                REQUIRED_VARIABLES: CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES,
                VALID_VARIABLES: CONTEXT_ENGINEERING_CONSTANTS.VALID_VARIABLES,
                VALIDATION_MESSAGES: CONTEXT_ENGINEERING_CONSTANTS.VALIDATION_MESSAGES,
                PROMPT_TYPES: CONTEXT_ENGINEERING_CONSTANTS.PROMPT_TYPES,
                // Mock constants for DOMHelper
                CSS_CLASSES: CONTEXT_ENGINEERING_CONSTANTS.CSS_CLASSES,
                DOM_IDS: CONTEXT_ENGINEERING_CONSTANTS.DOM_IDS
            };
            
            // Load modules with their dependencies
            PromptValidator = ModuleLoader.loadModule(VALIDATOR_PATH, mockDeps);
            DOMHelper = ModuleLoader.loadModule(DOM_HELPER_PATH, mockDeps);
            NotificationService = ModuleLoader.loadModule(NOTIFICATION_PATH, mockDeps);
            
            console.log('✅ All Context Engineering modules loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load Context Engineering modules:', error);
            throw error;
        }
    });

    afterAll(() => {
        if (jsdom) {
            jsdom.teardown();
        }
    });

    describe('PromptValidator', () => {
        let validator;

        beforeEach(() => {
            validator = new PromptValidator();
        });

        describe('validatePrompt', () => {
            test('should validate system prompt with required context variable', () => {
                const content = 'You are an assistant. Context: {context}';
                const result = validator.validatePrompt(content, 'system');
                
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            test('should reject system prompt without context variable', () => {
                const content = 'You are an assistant';
                const result = validator.validatePrompt(content, 'system');
                
                expect(result.isValid).toBe(false);
                expect(result.errors.some(error => error.includes('{context}'))).toBe(true);
            });

            test('should validate processing prompt with required variables', () => {
                const content = 'History: {chat_history} Question: {question}';
                const result = validator.validatePrompt(content, 'processing');
                
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            test('should reject processing prompt with missing variables', () => {
                const content = 'Question: {question}';
                const result = validator.validatePrompt(content, 'processing');
                
                expect(result.isValid).toBe(false);
                expect(result.errors.some(error => error.includes('{chat_history}'))).toBe(true);
            });

            test('should validate formatting prompt with required variables', () => {
                const content = 'Context: {context} Question: {question}';
                const result = validator.validatePrompt(content, 'formatting');
                
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            test('should reject empty prompts', () => {
                const result = validator.validatePrompt('', 'system');
                
                expect(result.isValid).toBe(false);
                expect(result.errors.some(error => error.includes('cannot be empty'))).toBe(true);
            });

            test('should reject whitespace-only prompts', () => {
                const result = validator.validatePrompt('   \n\t  ', 'system');
                
                expect(result.isValid).toBe(false);
                expect(result.errors.some(error => error.includes('cannot be empty'))).toBe(true);
            });

            test('should detect unknown variables', () => {
                const content = 'Context: {context} Unknown: {unknown_var}';
                const result = validator.validatePrompt(content, 'system');
                
                expect(result.isValid).toBe(false);
                expect(result.errors.some(error => error.includes('Unknown'))).toBe(true);
            });

            test('should reject invalid prompt types', () => {
                const result = validator.validatePrompt('Valid content', 'invalid_type');
                
                expect(result.isValid).toBe(false);
                expect(result.errors.some(error => error.includes('Invalid'))).toBe(true);
            });
        });

        describe('validateAllPrompts', () => {
            test('should validate multiple valid prompts', () => {
                const prompts = {
                    system: 'Assistant with {context}',
                    processing: 'History: {chat_history} Question: {question}',
                    formatting: 'Context: {context} Question: {question}'
                };
                
                const result = validator.validateAllPrompts(prompts);
                
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            test('should collect errors from multiple invalid prompts', () => {
                const prompts = {
                    system: '',
                    processing: 'Missing variables',
                    formatting: 'Invalid {unknown} variable'
                };
                
                const result = validator.validateAllPrompts(prompts);
                
                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });

        describe('extractVariables', () => {
            test('should extract all variables from content', () => {
                const content = 'Context: {context} Question: {question} History: {chat_history}';
                const variables = validator.extractVariables(content);
                
                expect(variables).toContain('{context}');
                expect(variables).toContain('{question}');
                expect(variables).toContain('{chat_history}');
                expect(variables).toHaveLength(3);
            });

            test('should handle content with no variables', () => {
                const content = 'No variables here';
                const variables = validator.extractVariables(content);
                
                expect(variables).toHaveLength(0);
            });

            test('should deduplicate repeated variables', () => {
                const content = '{context} and {context} again';
                const variables = validator.extractVariables(content);
                
                expect(variables).toHaveLength(1);
                expect(variables[0]).toBe('{context}');
            });
        });

        describe('utility methods', () => {
            test('should check if prompt is empty', () => {
                expect(validator.isEmpty('')).toBe(true);
                expect(validator.isEmpty('   ')).toBe(true);
                expect(validator.isEmpty('content')).toBe(false);
            });

            test('should validate prompt types', () => {
                expect(validator.isValidPromptType('system')).toBe(true);
                expect(validator.isValidPromptType('processing')).toBe(true);
                expect(validator.isValidPromptType('formatting')).toBe(true);
                expect(validator.isValidPromptType('invalid')).toBe(false);
            });

            test('should get prompt labels', () => {
                expect(validator.getPromptLabel('system')).toContain('System');
                expect(validator.getPromptLabel('processing')).toContain('Rephrasing');
                expect(validator.getPromptLabel('formatting')).toContain('Template');
            });
        });
    });

    describe('DOMHelper', () => {
        let domHelper;
        let mockElement;

        beforeEach(() => {
            domHelper = new DOMHelper();
            
            // Create comprehensive mock element
            mockElement = {
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                    toggle: jest.fn(),
                    contains: jest.fn()
                },
                innerHTML: '',
                textContent: '',
                value: '',
                style: {},
                checked: false,
                disabled: false,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                querySelector: jest.fn(),
                querySelectorAll: jest.fn(() => []),
                getAttribute: jest.fn(),
                setAttribute: jest.fn()
            };

            // Mock document.getElementById to return our mock element
            document.getElementById = jest.fn(() => mockElement);
        });

        describe('getElementById', () => {
            test('should return element if found', () => {
                const element = domHelper.getElementById('test-id');
                expect(document.getElementById).toHaveBeenCalledWith('test-id');
                expect(element).toBe(mockElement);
            });

            test('should warn and return null if element not found', () => {
                document.getElementById.mockReturnValueOnce(null);
                const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
                
                const element = domHelper.getElementById('missing-id');
                
                expect(element).toBeNull();
                expect(consoleSpy).toHaveBeenCalledWith("Element with ID 'missing-id' not found");
                
                consoleSpy.mockRestore();
            });
        });

        describe('element value operations', () => {
            test('should get element value safely', () => {
                mockElement.value = 'test-value';
                const value = domHelper.getElementValue('test-id');
                
                expect(value).toBe('test-value');
            });

            test('should return empty string for missing element', () => {
                document.getElementById.mockReturnValueOnce(null);
                const value = domHelper.getElementValue('missing-id');
                
                expect(value).toBe('');
            });

            test('should set element value safely', () => {
                const success = domHelper.setElementValue('test-id', 'new-value');
                
                expect(success).toBe(true);
                expect(mockElement.value).toBe('new-value');
            });
        });

        describe('visibility operations', () => {
            test('should show element by removing hidden class', () => {
                const success = domHelper.showElement('test-id');
                
                expect(success).toBe(true);
                expect(mockElement.classList.remove).toHaveBeenCalledWith('hidden');
            });

            test('should hide element by adding hidden class', () => {
                const success = domHelper.hideElement('test-id');
                
                expect(success).toBe(true);
                expect(mockElement.classList.add).toHaveBeenCalledWith('hidden');
            });

            test('should toggle element visibility', () => {
                const success = domHelper.toggleElement('test-id');
                
                expect(success).toBe(true);
                expect(mockElement.classList.toggle).toHaveBeenCalledWith('hidden');
            });
        });

        describe('element state operations', () => {
            test('should enable element', () => {
                const success = domHelper.setElementEnabled('test-id', true);
                
                expect(success).toBe(true);
                expect(mockElement.disabled).toBe(false);
            });

            test('should disable element', () => {
                const success = domHelper.setElementEnabled('test-id', false);
                
                expect(success).toBe(true);
                expect(mockElement.disabled).toBe(true);
            });

            test('should set loading state', () => {
                const success = domHelper.setElementLoading('test-id', true);
                
                expect(success).toBe(true);
                expect(mockElement.classList.add).toHaveBeenCalledWith('opacity-50');
                expect(mockElement.disabled).toBe(true);
            });
        });

        describe('CSS class operations', () => {
            test('should add CSS class', () => {
                const success = domHelper.addElementClass('test-id', 'test-class');
                
                expect(success).toBe(true);
                expect(mockElement.classList.add).toHaveBeenCalledWith('test-class');
            });

            test('should remove CSS class', () => {
                const success = domHelper.removeElementClass('test-id', 'test-class');
                
                expect(success).toBe(true);
                expect(mockElement.classList.remove).toHaveBeenCalledWith('test-class');
            });

            test('should check if element has class', () => {
                mockElement.classList.contains.mockReturnValue(true);
                const hasClass = domHelper.elementHasClass('test-id', 'test-class');
                
                expect(hasClass).toBe(true);
                expect(mockElement.classList.contains).toHaveBeenCalledWith('test-class');
            });
        });

        describe('form operations', () => {
            test('should get current mode from radio buttons', () => {
                const langfuseElement = { ...mockElement, checked: true };
                const localElement = { ...mockElement, checked: false };
                
                document.getElementById.mockImplementation((id) => {
                    if (id === 'mode-langfuse') return langfuseElement;
                    if (id === 'mode-local') return localElement;
                    return null;
                });
                
                const mode = domHelper.getCurrentMode();
                expect(mode).toBe('langfuse');
            });

            test('should default to local mode when no radio checked', () => {
                const langfuseElement = { ...mockElement, checked: false };
                const localElement = { ...mockElement, checked: false };
                
                document.getElementById.mockImplementation((id) => {
                    if (id === 'mode-langfuse') return langfuseElement;
                    if (id === 'mode-local') return localElement;
                    return null;
                });
                
                const mode = domHelper.getCurrentMode();
                expect(mode).toBe('local');
            });
        });

        describe('validation operations', () => {
            test('should set validation state for valid input', () => {
                const success = domHelper.setValidationState('test-id', true);
                
                expect(success).toBe(true);
                expect(mockElement.classList.remove).toHaveBeenCalledWith('border-red-500', 'border-green-500');
                expect(mockElement.classList.add).toHaveBeenCalledWith('border-green-500');
            });

            test('should set validation state for invalid input', () => {
                const success = domHelper.setValidationState('test-id', false);
                
                expect(success).toBe(true);
                expect(mockElement.classList.remove).toHaveBeenCalledWith('border-red-500', 'border-green-500');
                expect(mockElement.classList.add).toHaveBeenCalledWith('border-red-500');
            });
        });
    });

    describe('NotificationService', () => {
        let notificationService;

        beforeEach(() => {
            // Reset DOM
            document.body.innerHTML = '';
            
            // Mock document.createElement to return proper DOM elements
            global.document.createElement = jest.fn((tagName) => {
                const element = {
                    tagName: tagName.toUpperCase(),
                    id: '',
                    className: '',
                    style: { zIndex: '' },
                    innerHTML: '',
                    appendChild: jest.fn(),
                    parentNode: null,
                    classList: {
                        add: jest.fn(),
                        remove: jest.fn(),
                        toggle: jest.fn(),
                        contains: jest.fn()
                    }
                };
                // Allow setting id and className
                Object.defineProperty(element, 'id', {
                    get() { return this._id || ''; },
                    set(value) { this._id = value; },
                    configurable: true
                });
                Object.defineProperty(element, 'className', {
                    get() { return this._className || ''; },
                    set(value) { this._className = value; },
                    configurable: true
                });
                return element;
            });
            
            // Mock document.body.appendChild
            global.document.body.appendChild = jest.fn();
            
            // Mock getElementById to return null by default (no existing container)
            global.document.getElementById = jest.fn(() => null);
            
            // Create fresh notification service
            notificationService = new NotificationService();
            
            // Clear any existing notifications
            notificationService.hideAll();
        });

        afterEach(() => {
            // Clean up notifications after each test
            if (notificationService) {
                notificationService.hideAll();
            }
        });

        describe('initialization', () => {
            test('should create notification container', () => {
                expect(notificationService.container).toBeTruthy();
                expect(notificationService.container.id).toBe('notification-container');
            });

            test('should not create duplicate container if exists', () => {
                // Mock getElementById to return existing container
                const existingContainer = {
                    id: 'notification-container',
                    appendChild: jest.fn(),
                    classList: {
                        add: jest.fn(),
                        remove: jest.fn(),
                        toggle: jest.fn(),
                        contains: jest.fn()
                    }
                };
                
                global.document.getElementById = jest.fn(() => existingContainer);
                
                const service = new NotificationService();
                expect(service.container).toBe(existingContainer);
            });
        });

        describe('notification types', () => {
            test('should show success notification', () => {
                const id = notificationService.showSuccess('Success message');
                
                expect(typeof id).toBe('number');
                expect(notificationService.notifications.has(id)).toBe(true);
                
                const notification = notificationService.notifications.get(id);
                expect(notification.type).toBe('success');
                expect(notification.message).toBe('Success message');
            });

            test('should show error notification', () => {
                const id = notificationService.showError('Error message');
                
                expect(typeof id).toBe('number');
                expect(notificationService.notifications.has(id)).toBe(true);
                
                const notification = notificationService.notifications.get(id);
                expect(notification.type).toBe('error');
            });

            test('should show warning notification', () => {
                const id = notificationService.showWarning('Warning message');
                
                expect(typeof id).toBe('number');
                expect(notificationService.notifications.has(id)).toBe(true);
                
                const notification = notificationService.notifications.get(id);
                expect(notification.type).toBe('warning');
            });

            test('should show info notification', () => {
                const id = notificationService.showInfo('Info message');
                
                expect(typeof id).toBe('number');
                expect(notificationService.notifications.has(id)).toBe(true);
                
                const notification = notificationService.notifications.get(id);
                expect(notification.type).toBe('info');
            });
        });

        describe('validation error notifications', () => {
            test('should show validation errors', () => {
                const errors = ['Missing variable {context}', 'Invalid format'];
                const id = notificationService.showValidationErrors(errors);
                
                expect(typeof id).toBe('number');
                expect(notificationService.notifications.has(id)).toBe(true);
                
                const notification = notificationService.notifications.get(id);
                expect(notification.type).toBe('error');
                expect(notification.message).toContain('Missing variable {context}');
                expect(notification.message).toContain('Invalid format');
            });

            test('should format validation errors properly', () => {
                const errors = ['Missing <code>{context}</code>', 'Unknown <code>{invalid}</code>'];
                const id = notificationService.showValidationErrors(errors);
                
                const notification = notificationService.notifications.get(id);
                expect(notification.message).toContain('Missing {context}');
                expect(notification.message).toContain('Unknown {invalid}');
                expect(notification.message).not.toContain('<code>');
            });
        });

        describe('notification management', () => {
            test('should hide all notifications', (done) => {
                const id1 = notificationService.showInfo('Message 1');
                const id2 = notificationService.showError('Message 2');
                
                expect(notificationService.notifications.size).toBe(2);
                
                notificationService.hideAll();
                
                // Wait for setTimeout to complete (300ms + buffer)
                setTimeout(() => {
                    expect(notificationService.notifications.size).toBe(0);
                    done();
                }, 350);
            });

            test('should get active notification IDs', () => {
                const id1 = notificationService.showInfo('Message 1');
                const id2 = notificationService.showError('Message 2');
                
                const activeIds = notificationService.getActiveNotifications();
                expect(activeIds).toContain(id1);
                expect(activeIds).toContain(id2);
                expect(activeIds).toHaveLength(2);
            });

            test('should check if has active notifications', () => {
                expect(notificationService.hasActiveNotifications()).toBe(false);
                
                notificationService.showInfo('Test message');
                expect(notificationService.hasActiveNotifications()).toBe(true);
            });
        });

        describe('notification styling', () => {
            test('should return correct styles for each type', () => {
                expect(notificationService.getTypeStyles('success')).toContain('border-green-400');
                expect(notificationService.getTypeStyles('error')).toContain('border-red-400');
                expect(notificationService.getTypeStyles('warning')).toContain('border-yellow-400');
                expect(notificationService.getTypeStyles('info')).toContain('border-blue-400');
            });

            test('should return correct icons for each type', () => {
                expect(notificationService.getTypeIcon('success')).toBe('fa-check-circle');
                expect(notificationService.getTypeIcon('error')).toBe('fa-exclamation-circle');
                expect(notificationService.getTypeIcon('warning')).toBe('fa-exclamation-triangle');
                expect(notificationService.getTypeIcon('info')).toBe('fa-info-circle');
            });

            test('should return correct icon colors for each type', () => {
                expect(notificationService.getTypeIconColor('success')).toBe('text-green-600');
                expect(notificationService.getTypeIconColor('error')).toBe('text-red-600');
                expect(notificationService.getTypeIconColor('warning')).toBe('text-yellow-600');
                expect(notificationService.getTypeIconColor('info')).toBe('text-blue-600');
            });
        });
    });

    describe('CONTEXT_ENGINEERING_CONSTANTS', () => {
        test('should have all required constant categories', () => {
            expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('PROMPT_TYPES');
            expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('MODES');
            expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('REQUIRED_VARIABLES');
            expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('VALID_VARIABLES');
            expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('DOM_IDS');
            expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('CSS_CLASSES');
            expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('DEFAULTS');
            expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('VALIDATION_MESSAGES');
        });

        test('should have correct prompt types', () => {
            expect(CONTEXT_ENGINEERING_CONSTANTS.PROMPT_TYPES.SYSTEM).toBe('system');
            expect(CONTEXT_ENGINEERING_CONSTANTS.PROMPT_TYPES.PROCESSING).toBe('processing');
            expect(CONTEXT_ENGINEERING_CONSTANTS.PROMPT_TYPES.FORMATTING).toBe('formatting');
        });

        test('should have correct modes', () => {
            expect(CONTEXT_ENGINEERING_CONSTANTS.MODES.LANGFUSE).toBe('langfuse');
            expect(CONTEXT_ENGINEERING_CONSTANTS.MODES.LOCAL).toBe('local');
        });

        test('should have required variables for each prompt type', () => {
            expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.system).toContain('{context}');
            expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.processing).toContain('{chat_history}');
            expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.processing).toContain('{question}');
            expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.formatting).toContain('{context}');
            expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.formatting).toContain('{question}');
        });

        test('should have all valid variables listed', () => {
            expect(CONTEXT_ENGINEERING_CONSTANTS.VALID_VARIABLES).toContain('{context}');
            expect(CONTEXT_ENGINEERING_CONSTANTS.VALID_VARIABLES).toContain('{question}');
            expect(CONTEXT_ENGINEERING_CONSTANTS.VALID_VARIABLES).toContain('{chat_history}');
        });

        test('should have default values', () => {
            expect(CONTEXT_ENGINEERING_CONSTANTS.DEFAULTS.RAG_K).toBe(100);
            expect(CONTEXT_ENGINEERING_CONSTANTS.DEFAULTS.SIMILARITY_THRESHOLD).toBe(0.7);
            expect(CONTEXT_ENGINEERING_CONSTANTS.DEFAULTS.PROMPT_MODE).toBe('local');
        });
    });
});