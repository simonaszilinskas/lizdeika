
/**
 * WebSocket Mocks for Testing
 */

class WebSocketMocks {
    static createMockSocket() {
        const mockSocket = {
            send: jest.fn(),
            close: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            readyState: 1, // OPEN
            onopen: null,
            onclose: null,
            onmessage: null,
            onerror: null,
            
            // Test utilities
            emit: function(event, data) {
                if (event === 'open' && this.onopen) {
                    this.onopen();
                } else if (event === 'message' && this.onmessage) {
                    this.onmessage({ data: JSON.stringify(data) });
                } else if (event === 'close' && this.onclose) {
                    this.onclose();
                } else if (event === 'error' && this.onerror) {
                    this.onerror(data);
                }
            }
        };
        
        return mockSocket;
    }
    
    static setupGlobalMock() {
        global.WebSocket = jest.fn(() => WebSocketMocks.createMockSocket());
    }
}

module.exports = WebSocketMocks;
