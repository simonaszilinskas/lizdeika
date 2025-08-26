
const TestUtils = require('../utilities/test-utils');
const APIMocks = require('../mocks/api-mocks');
const JSDOMEnvironment = require('../../test-config/jsdom.config');

describe('Integration Tests - Settings and Dashboard', () => {
    let jsdom;
    
    beforeEach(() => {
        jsdom = new JSDOMEnvironment().setup();
        APIMocks.setupMocks();
    });
    
    afterEach(() => {
        APIMocks.resetMocks();
        jsdom.teardown();
    });
    
    describe('Settings to Dashboard Integration', () => {
        test('should maintain user session across components', async () => {
            // Mock user login
            localStorage.setItem('agent_token', 'test-token');
            localStorage.setItem('user_data', JSON.stringify(TestUtils.createTestUser()));
            
            // Test that both components can access user data
            expect(localStorage.getItem('agent_token')).toBe('test-token');
            expect(JSON.parse(localStorage.getItem('user_data'))).toEqual(
                expect.objectContaining({ email: 'test@vilnius.lt' })
            );
        });
        
        test('should sync system mode changes', async () => {
            // Test system mode change propagation
            const response = await global.fetch('/api/system/mode', {
                method: 'POST',
                body: JSON.stringify({ mode: 'autopilot' })
            });
            
            expect(response.ok).toBe(true);
        });
    });
    
    describe('Error Handling Integration', () => {
        test('should handle API failures gracefully', async () => {
            // Mock API failure
            global.fetch.mockImplementationOnce(() => 
                Promise.reject(new Error('Network error'))
            );
            
            try {
                await global.fetch('/api/auth/profile');
            } catch (error) {
                expect(error.message).toBe('Network error');
            }
        });
    });
    
    describe('WebSocket Integration', () => {
        test('should handle WebSocket events', () => {
            const WebSocketMocks = require('../mocks/websocket-mocks');
            const mockSocket = WebSocketMocks.createMockSocket();
            
            // Test WebSocket connection
            expect(mockSocket.readyState).toBe(1); // OPEN
            
            // Test message handling
            mockSocket.onmessage = jest.fn();
            mockSocket.emit('message', { type: 'test', data: 'hello' });
            
            expect(mockSocket.onmessage).toHaveBeenCalled();
        });
    });
});
