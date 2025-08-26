
/**
 * Test Utilities
 * Helper functions for testing the Vilnius Assistant frontend
 */

class TestUtils {
    /**
     * Create a mock DOM element with common properties
     */
    static createMockElement(tagName, attributes = {}) {
        const element = document.createElement(tagName);
        Object.keys(attributes).forEach(key => {
            if (key === 'textContent' || key === 'innerHTML') {
                element[key] = attributes[key];
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });
        return element;
    }
    
    /**
     * Mock API response
     */
    static mockFetchResponse(data, status = 200, ok = true) {
        return Promise.resolve({
            ok,
            status,
            json: () => Promise.resolve(data),
            text: () => Promise.resolve(JSON.stringify(data))
        });
    }
    
    /**
     * Wait for DOM updates
     */
    static waitForDOM(timeout = 100) {
        return new Promise(resolve => setTimeout(resolve, timeout));
    }
    
    /**
     * Simulate user interaction
     */
    static simulateClick(element) {
        const event = new Event('click', { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
    }
    
    static simulateInput(element, value) {
        element.value = value;
        const event = new Event('input', { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
    }
    
    /**
     * Mock WebSocket for testing
     */
    static createMockWebSocket() {
        return {
            send: jest.fn(),
            close: jest.fn(),
            addEventListener: jest.fn(),
            readyState: 1,
            onopen: null,
            onclose: null,
            onmessage: null,
            onerror: null
        };
    }
    
    /**
     * Create test fixture data
     */
    static createTestUser(overrides = {}) {
        return {
            id: 'test-user-123',
            email: 'test@vilnius.lt',
            role: 'agent',
            firstName: 'Test',
            lastName: 'User',
            isActive: true,
            ...overrides
        };
    }
    
    static createTestConversation(overrides = {}) {
        return {
            id: 'test-conversation-123',
            ticketNumber: 'TICKET-001',
            userNumber: 1,
            status: 'active',
            assignedAgentId: null,
            messages: [],
            createdAt: new Date().toISOString(),
            ...overrides
        };
    }
    
    static createTestMessage(overrides = {}) {
        return {
            id: 'test-message-123',
            content: 'Test message content',
            senderType: 'user',
            senderId: 'test-user-123',
            conversationId: 'test-conversation-123',
            createdAt: new Date().toISOString(),
            ...overrides
        };
    }
    
    /**
     * Performance testing utilities
     */
    static measureExecutionTime(fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        return {
            result,
            executionTime: end - start
        };
    }
    
    static async measureAsyncExecutionTime(fn) {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        return {
            result,
            executionTime: end - start
        };
    }
    
    /**
     * Memory usage testing
     */
    static measureMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
}

module.exports = TestUtils;
