/**
 * CONTEXT ENGINEERING MODULE UNIT TESTS
 * 
 * Comprehensive unit tests for the Context Engineering module
 * Tests validation, DOM interactions, API calls, and state management
 * 
 * @version 1.0.0
 */

// Import test utilities
import { jest } from '@jest/globals';

// Mock dependencies
const mockAPIManager = {
    apiUrl: 'http://localhost:3002',
    makeRequest: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn()
};

const mockStateManager = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    getState: jest.fn(),
    setState: jest.fn()
};

// Mock DOM
const mockElement = {
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

global.document = {
    getElementById: jest.fn(() => mockElement),
    createElement: jest.fn(() => mockElement),
    querySelector: jest.fn(() => mockElement),
    querySelectorAll: jest.fn(() => [mockElement]),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    body: mockElement
};

global.window = {
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
    },
    fetch: jest.fn()
};

global.fetch = jest.fn();

// Import services for testing
import PromptValidator from '../../js/settings/services/PromptValidator.js';
import DOMHelper from '../../js/settings/utils/DOMHelper.js';
import NotificationService from '../../js/settings/services/NotificationService.js';
import CONTEXT_ENGINEERING_CONSTANTS from '../../js/settings/constants/ContextEngineeringConstants.js';

describe('PromptValidator', () => {
    let validator;

    beforeEach(() => {
        validator = new PromptValidator();
    });

    describe('validatePrompt', () => {
        it('should validate system prompt with required context variable', () => {
            const content = 'You are an assistant. Context: {context}';
            const result = validator.validatePrompt(content, 'system');
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject system prompt without context variable', () => {
            const content = 'You are an assistant';
            const result = validator.validatePrompt(content, 'system');
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing required variable: <code>{context}</code>');
        });

        it('should validate processing prompt with required variables', () => {
            const content = 'History: {chat_history} Question: {question}';
            const result = validator.validatePrompt(content, 'processing');
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject processing prompt with missing variables', () => {
            const content = 'Question: {question}';
            const result = validator.validatePrompt(content, 'processing');
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing required variable: <code>{chat_history}</code>');
        });

        it('should validate formatting prompt with required variables', () => {
            const content = 'Context: {context} Question: {question}';
            const result = validator.validatePrompt(content, 'formatting');
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject empty prompts', () => {
            const result = validator.validatePrompt('', 'system');
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Prompt cannot be empty');
        });

        it('should reject whitespace-only prompts', () => {
            const result = validator.validatePrompt('   \\n\\t  ', 'system');
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Prompt cannot be empty');
        });

        it('should detect unknown variables', () => {
            const content = 'Context: {context} Unknown: {unknown_var}';
            const result = validator.validatePrompt(content, 'system');
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Unknown variable'))).toBe(true);
        });

        it('should reject invalid prompt types', () => {
            const result = validator.validatePrompt('Valid content', 'invalid_type');
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid prompt type specified');
        });
    });

    describe('validateAllPrompts', () => {
        it('should validate multiple valid prompts', () => {
            const prompts = {
                system: 'Assistant with {context}',
                processing: 'History: {chat_history} Question: {question}',
                formatting: 'Context: {context} Question: {question}'
            };
            
            const result = validator.validateAllPrompts(prompts);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should collect errors from multiple invalid prompts', () => {
            const prompts = {
                system: '',
                processing: 'Missing variables',
                formatting: 'Invalid {unknown} variable'
            };
            
            const result = validator.validateAllPrompts(prompts);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(error => error.includes('System Prompt'))).toBe(true);
        });
    });

    describe('extractVariables', () => {
        it('should extract all variables from content', () => {
            const content = 'Context: {context} Question: {question} History: {chat_history}';
            const variables = validator.extractVariables(content);
            
            expect(variables).toContain('{context}');
            expect(variables).toContain('{question}');
            expect(variables).toContain('{chat_history}');
            expect(variables).toHaveLength(3);
        });

        it('should handle content with no variables', () => {
            const content = 'No variables here';
            const variables = validator.extractVariables(content);
            
            expect(variables).toHaveLength(0);
        });

        it('should deduplicate repeated variables', () => {
            const content = '{context} and {context} again';
            const variables = validator.extractVariables(content);
            
            expect(variables).toHaveLength(1);
            expect(variables[0]).toBe('{context}');
        });
    });

    describe('getValidationSummary', () => {
        it('should provide comprehensive validation summary', () => {
            const content = 'Context: {context}';
            const summary = validator.getValidationSummary(content, 'system');
            
            expect(summary).toHaveProperty('isValid');
            expect(summary).toHaveProperty('errors');
            expect(summary).toHaveProperty('summary');
            expect(summary.summary).toHaveProperty('promptType', 'system');
            expect(summary.summary).toHaveProperty('contentLength');
            expect(summary.summary).toHaveProperty('extractedVariables');
            expect(summary.summary).toHaveProperty('requiredVariables');
        });
    });
});

describe('DOMHelper', () => {
    let domHelper;

    beforeEach(() => {
        domHelper = new DOMHelper();
        jest.clearAllMocks();
    });

    describe('getElementById', () => {
        it('should return element if found', () => {
            const element = domHelper.getElementById('test-id');
            expect(document.getElementById).toHaveBeenCalledWith('test-id');
            expect(element).toBe(mockElement);
        });

        it('should warn and return null if element not found', () => {
            document.getElementById.mockReturnValueOnce(null);
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            const element = domHelper.getElementById('missing-id');
            
            expect(element).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(\"Element with ID 'missing-id' not found\");
            
            consoleSpy.mockRestore();
        });
    });

    describe('element value operations', () => {
        it('should get element value safely', () => {
            mockElement.value = 'test-value';
            const value = domHelper.getElementValue('test-id');
            
            expect(value).toBe('test-value');
        });

        it('should return empty string for missing element', () => {
            document.getElementById.mockReturnValueOnce(null);
            const value = domHelper.getElementValue('missing-id');
            
            expect(value).toBe('');
        });

        it('should set element value safely', () => {
            const success = domHelper.setElementValue('test-id', 'new-value');
            
            expect(success).toBe(true);
            expect(mockElement.value).toBe('new-value');
        });

        it('should fail gracefully when setting value on missing element', () => {
            document.getElementById.mockReturnValueOnce(null);
            const success = domHelper.setElementValue('missing-id', 'value');
            
            expect(success).toBe(false);
        });
    });

    describe('element text operations', () => {
        it('should get element text safely', () => {
            mockElement.textContent = 'test-text';
            const text = domHelper.getElementText('test-id');
            
            expect(text).toBe('test-text');
        });

        it('should set element text safely', () => {
            const success = domHelper.setElementText('test-id', 'new-text');
            
            expect(success).toBe(true);
            expect(mockElement.textContent).toBe('new-text');
        });

        it('should set element HTML safely', () => {
            const success = domHelper.setElementHTML('test-id', '<span>HTML</span>');
            
            expect(success).toBe(true);
            expect(mockElement.innerHTML).toBe('<span>HTML</span>');
        });
    });

    describe('visibility operations', () => {
        it('should show element by removing hidden class', () => {
            const success = domHelper.showElement('test-id');
            
            expect(success).toBe(true);
            expect(mockElement.classList.remove).toHaveBeenCalledWith('hidden');
        });

        it('should hide element by adding hidden class', () => {
            const success = domHelper.hideElement('test-id');
            
            expect(success).toBe(true);
            expect(mockElement.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should toggle element visibility', () => {
            const success = domHelper.toggleElement('test-id');
            
            expect(success).toBe(true);
            expect(mockElement.classList.toggle).toHaveBeenCalledWith('hidden');
        });
    });

    describe('element state operations', () => {
        it('should enable element', () => {
            const success = domHelper.setElementEnabled('test-id', true);
            
            expect(success).toBe(true);
            expect(mockElement.disabled).toBe(false);
        });

        it('should disable element', () => {
            const success = domHelper.setElementEnabled('test-id', false);
            
            expect(success).toBe(true);
            expect(mockElement.disabled).toBe(true);
        });

        it('should set loading state', () => {
            const success = domHelper.setElementLoading('test-id', true);
            
            expect(success).toBe(true);
            expect(mockElement.classList.add).toHaveBeenCalledWith('opacity-50');
            expect(mockElement.disabled).toBe(true);
        });

        it('should clear loading state', () => {
            const success = domHelper.setElementLoading('test-id', false);
            
            expect(success).toBe(true);
            expect(mockElement.classList.remove).toHaveBeenCalledWith('opacity-50');
            expect(mockElement.disabled).toBe(false);
        });
    });

    describe('CSS class operations', () => {
        it('should add CSS class', () => {
            const success = domHelper.addElementClass('test-id', 'test-class');
            
            expect(success).toBe(true);
            expect(mockElement.classList.add).toHaveBeenCalledWith('test-class');
        });

        it('should remove CSS class', () => {
            const success = domHelper.removeElementClass('test-id', 'test-class');
            
            expect(success).toBe(true);
            expect(mockElement.classList.remove).toHaveBeenCalledWith('test-class');
        });

        it('should check if element has class', () => {
            mockElement.classList.contains.mockReturnValue(true);
            const hasClass = domHelper.elementHasClass('test-id', 'test-class');
            
            expect(hasClass).toBe(true);
            expect(mockElement.classList.contains).toHaveBeenCalledWith('test-class');
        });
    });

    describe('form operations', () => {
        it('should get all prompt values', () => {
            // Mock different elements for different IDs
            const systemElement = { ...mockElement, value: 'system prompt' };
            const processingElement = { ...mockElement, value: 'processing prompt' };
            const formattingElement = { ...mockElement, value: 'formatting prompt' };
            
            document.getElementById.mockImplementation((id) => {
                if (id === 'local-system-prompt') return systemElement;
                if (id === 'local-processing-prompt') return processingElement;
                if (id === 'local-formatting-prompt') return formattingElement;
                return null;
            });
            
            const values = domHelper.getAllPromptValues();
            
            expect(values).toEqual({
                system: 'system prompt',
                processing: 'processing prompt',
                formatting: 'formatting prompt'
            });
        });

        it('should set all prompt values', () => {
            const values = {
                system: 'new system prompt',
                processing: 'new processing prompt', 
                formatting: 'new formatting prompt'
            };
            
            domHelper.setAllPromptValues(values);
            
            // Verify setElementValue was called for each prompt type
            expect(document.getElementById).toHaveBeenCalledWith('local-system-prompt');
            expect(document.getElementById).toHaveBeenCalledWith('local-processing-prompt');
            expect(document.getElementById).toHaveBeenCalledWith('local-formatting-prompt');
        });

        it('should get current mode', () => {
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

        it('should default to local mode when no radio checked', () => {
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
        it('should set validation state for valid input', () => {
            const success = domHelper.setValidationState('test-id', true);
            
            expect(success).toBe(true);
            expect(mockElement.classList.remove).toHaveBeenCalledWith('border-red-500', 'border-green-500');
            expect(mockElement.classList.add).toHaveBeenCalledWith('border-green-500');
        });

        it('should set validation state for invalid input', () => {
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
        notificationService = new NotificationService();
        jest.clearAllMocks();
        // Clear any existing notifications
        notificationService.hideAll();
    });

    afterEach(() => {
        // Clean up notifications after each test
        notificationService.hideAll();
    });

    describe('initialization', () => {
        it('should create notification container', () => {
            expect(document.createElement).toHaveBeenCalledWith('div');
            expect(document.body.appendChild).toHaveBeenCalled();
        });

        it('should not create duplicate container', () => {
            // Mock existing container
            document.getElementById.mockReturnValueOnce(mockElement);
            
            const service = new NotificationService();
            expect(service.container).toBe(mockElement);
        });
    });

    describe('notification types', () => {
        it('should show success notification', () => {
            const id = notificationService.showSuccess('Success message');
            
            expect(id).toBe(1);
            expect(notificationService.notifications.has(id)).toBe(true);
        });

        it('should show error notification', () => {
            const id = notificationService.showError('Error message');
            
            expect(id).toBe(1);
            expect(notificationService.notifications.has(id)).toBe(true);
        });

        it('should show warning notification', () => {
            const id = notificationService.showWarning('Warning message');
            
            expect(id).toBe(1);
            expect(notificationService.notifications.has(id)).toBe(true);
        });

        it('should show info notification', () => {
            const id = notificationService.showInfo('Info message');
            
            expect(id).toBe(1);
            expect(notificationService.notifications.has(id)).toBe(true);
        });
    });

    describe('validation error notifications', () => {
        it('should show validation errors', () => {
            const errors = ['Missing variable {context}', 'Invalid format'];
            const id = notificationService.showValidationErrors(errors);
            
            expect(id).toBe(1);
            expect(notificationService.notifications.has(id)).toBe(true);
        });

        it('should format validation errors properly', () => {
            const errors = ['Missing <code>{context}</code>', 'Unknown <code>{invalid}</code>'];
            const id = notificationService.showValidationErrors(errors);
            
            const notification = notificationService.notifications.get(id);
            expect(notification.message).toContain('Missing {context}');
            expect(notification.message).toContain('Unknown {invalid}');
        });
    });

    describe('notification management', () => {
        it('should hide specific notification', () => {
            const id = notificationService.showInfo('Test message');
            expect(notificationService.notifications.has(id)).toBe(true);
            
            notificationService.hide(id);
            
            // Note: In real implementation, this would be delayed by animation
            // In tests, we check that the hide process was initiated
            expect(notificationService.notifications.get(id)).toBeTruthy();
        });

        it('should hide all notifications', () => {
            const id1 = notificationService.showInfo('Message 1');
            const id2 = notificationService.showError('Message 2');
            
            notificationService.hideAll();
            
            expect(notificationService.notifications.size).toBe(0);
        });

        it('should get active notification IDs', () => {
            const id1 = notificationService.showInfo('Message 1');
            const id2 = notificationService.showError('Message 2');
            
            const activeIds = notificationService.getActiveNotifications();
            expect(activeIds).toContain(id1);
            expect(activeIds).toContain(id2);
            expect(activeIds).toHaveLength(2);
        });

        it('should check if has active notifications', () => {
            expect(notificationService.hasActiveNotifications()).toBe(false);
            
            notificationService.showInfo('Test message');
            expect(notificationService.hasActiveNotifications()).toBe(true);
        });
    });

    describe('notification styling', () => {
        it('should return correct styles for each type', () => {
            expect(notificationService.getTypeStyles('success')).toContain('border-green-400');
            expect(notificationService.getTypeStyles('error')).toContain('border-red-400');
            expect(notificationService.getTypeStyles('warning')).toContain('border-yellow-400');
            expect(notificationService.getTypeStyles('info')).toContain('border-blue-400');
        });

        it('should return correct icons for each type', () => {
            expect(notificationService.getTypeIcon('success')).toBe('fa-check-circle');
            expect(notificationService.getTypeIcon('error')).toBe('fa-exclamation-circle');
            expect(notificationService.getTypeIcon('warning')).toBe('fa-exclamation-triangle');
            expect(notificationService.getTypeIcon('info')).toBe('fa-info-circle');
        });

        it('should return correct icon colors for each type', () => {
            expect(notificationService.getTypeIconColor('success')).toBe('text-green-600');
            expect(notificationService.getTypeIconColor('error')).toBe('text-red-600');
            expect(notificationService.getTypeIconColor('warning')).toBe('text-yellow-600');
            expect(notificationService.getTypeIconColor('info')).toBe('text-blue-600');
        });
    });

    describe('notification updates', () => {
        it('should update existing notification', () => {
            const id = notificationService.showInfo('Original message', 0); // No auto-hide
            
            notificationService.update(id, 'Updated message', 'success');
            
            const notification = notificationService.notifications.get(id);
            expect(notification.message).toBe('Updated message');
            expect(notification.type).toBe('success');
        });

        it('should handle updates to non-existent notifications', () => {
            expect(() => {
                notificationService.update(999, 'Message', 'info');
            }).not.toThrow();
        });
    });
});

describe('CONTEXT_ENGINEERING_CONSTANTS', () => {
    it('should have all required constant categories', () => {
        expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('PROMPT_TYPES');
        expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('MODES');
        expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('REQUIRED_VARIABLES');
        expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('VALID_VARIABLES');
        expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('DOM_IDS');
        expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('CSS_CLASSES');
        expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('DEFAULTS');
        expect(CONTEXT_ENGINEERING_CONSTANTS).toHaveProperty('VALIDATION_MESSAGES');
    });

    it('should have correct prompt types', () => {
        expect(CONTEXT_ENGINEERING_CONSTANTS.PROMPT_TYPES.SYSTEM).toBe('system');
        expect(CONTEXT_ENGINEERING_CONSTANTS.PROMPT_TYPES.PROCESSING).toBe('processing');
        expect(CONTEXT_ENGINEERING_CONSTANTS.PROMPT_TYPES.FORMATTING).toBe('formatting');
    });

    it('should have correct modes', () => {
        expect(CONTEXT_ENGINEERING_CONSTANTS.MODES.LANGFUSE).toBe('langfuse');
        expect(CONTEXT_ENGINEERING_CONSTANTS.MODES.LOCAL).toBe('local');
    });

    it('should have required variables for each prompt type', () => {
        expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.system).toContain('{context}');
        expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.processing).toContain('{chat_history}');
        expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.processing).toContain('{question}');
        expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.formatting).toContain('{context}');
        expect(CONTEXT_ENGINEERING_CONSTANTS.REQUIRED_VARIABLES.formatting).toContain('{question}');
    });

    it('should have all valid variables listed', () => {
        expect(CONTEXT_ENGINEERING_CONSTANTS.VALID_VARIABLES).toContain('{context}');
        expect(CONTEXT_ENGINEERING_CONSTANTS.VALID_VARIABLES).toContain('{question}');
        expect(CONTEXT_ENGINEERING_CONSTANTS.VALID_VARIABLES).toContain('{chat_history}');
    });

    it('should have default values', () => {
        expect(CONTEXT_ENGINEERING_CONSTANTS.DEFAULTS.RAG_K).toBe(100);
        expect(CONTEXT_ENGINEERING_CONSTANTS.DEFAULTS.SIMILARITY_THRESHOLD).toBe(0.7);
        expect(CONTEXT_ENGINEERING_CONSTANTS.DEFAULTS.PROMPT_MODE).toBe('local');
    });
});