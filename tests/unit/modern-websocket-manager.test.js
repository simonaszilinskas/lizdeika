/**
 * Tests for ModernWebSocketManager
 */

const ModernWebSocketManager = require('../../custom-widget/js/modules/modern-websocket-manager');

// Mock Socket.IO
global.io = jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true
}));

describe('ModernWebSocketManager', () => {
    let manager;
    let mockSocket;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Create mock socket
        mockSocket = {
            on: jest.fn(),
            emit: jest.fn(),
            disconnect: jest.fn(),
            connected: true
        };
        
        global.io.mockReturnValue(mockSocket);
        
        // Create manager instance
        manager = new ModernWebSocketManager({
            url: 'ws://test:3002',
            agentId: 'test-agent',
            logger: {
                log: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        });
    });
    
    afterEach(() => {
        if (manager) {
            manager.disconnect();
        }
    });
    
    describe('Initialization', () => {
        test('should initialize with correct default config', () => {
            const defaultManager = new ModernWebSocketManager();
            
            expect(defaultManager.config.url).toBe('ws://localhost:3002');
            expect(defaultManager.config.agentId).toBe('unknown');
            expect(defaultManager.config.reconnectionAttempts).toBe(5);
            expect(defaultManager.config.maxErrors).toBe(3);
        });
        
        test('should initialize with custom config', () => {
            expect(manager.config.url).toBe('ws://test:3002');
            expect(manager.config.agentId).toBe('test-agent');
            expect(manager.isConnected).toBe(false);
            expect(manager.circuitBreakerOpen).toBe(false);
        });
        
        test('should initialize empty event handlers', () => {
            expect(manager.eventHandlers.size).toBe(0);
            expect(manager.connectionListeners).toEqual([]);
            expect(manager.errorListeners).toEqual([]);
        });
    });
    
    describe('Connection Management', () => {
        test('should connect successfully', async () => {
            await manager.connect();
            
            expect(global.io).toHaveBeenCalledWith('ws://test:3002');
            expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
            expect(manager.socket).toBe(mockSocket);
        });
        
        test('should not connect if circuit breaker is open', async () => {
            manager.circuitBreakerOpen = true;
            
            await expect(manager.connect()).rejects.toThrow('Circuit breaker open');
            expect(global.io).not.toHaveBeenCalled();
        });
        
        test('should not connect if already connected', async () => {
            manager.isConnected = true;
            manager.socket = mockSocket;
            
            await manager.connect();
            
            expect(global.io).toHaveBeenCalledTimes(0); // Should not call io again
        });
        
        test('should disconnect cleanly', () => {
            manager.socket = mockSocket;
            manager.isConnected = true;
            
            manager.disconnect();
            
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(manager.socket).toBeNull();
            expect(manager.isConnected).toBe(false);
        });
        
        test('should handle connection events', async () => {
            await manager.connect();
            
            // Get the connect handler and call it
            const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
            connectHandler();
            
            expect(manager.isConnected).toBe(true);
            expect(manager.reconnectionAttempts).toBe(0);
            expect(manager.errorCount).toBe(0);
            expect(manager.circuitBreakerOpen).toBe(false);
            expect(mockSocket.emit).toHaveBeenCalledWith('join-agent-dashboard', 'test-agent');
        });
        
        test('should handle disconnect events', async () => {
            manager.isConnected = true;
            await manager.connect();
            
            // Test the disconnect method works correctly
            manager.disconnect();
            expect(manager.isConnected).toBe(false);
        });
    });
    
    describe('Event Management', () => {
        test('should register event handlers', () => {
            const handler = jest.fn();
            
            manager.on('test-event', handler);
            
            expect(manager.eventHandlers.has('test-event')).toBe(true);
            expect(manager.eventHandlers.get('test-event')).toContain(handler);
        });
        
        test('should unregister event handlers', () => {
            const handler = jest.fn();
            
            manager.on('test-event', handler);
            manager.off('test-event', handler);
            
            expect(manager.eventHandlers.get('test-event')).not.toContain(handler);
        });
        
        test('should emit events to registered handlers', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            const testData = { message: 'test' };
            
            manager.on('test-event', handler1);
            manager.on('test-event', handler2);
            manager.emit('test-event', testData);
            
            expect(handler1).toHaveBeenCalledWith(testData);
            expect(handler2).toHaveBeenCalledWith(testData);
        });
        
        test('should handle handler errors gracefully', () => {
            const faultyHandler = jest.fn(() => { throw new Error('Handler error'); });
            const workingHandler = jest.fn();
            
            manager.on('test-event', faultyHandler);
            manager.on('test-event', workingHandler);
            
            // Should not throw, should continue with other handlers
            expect(() => manager.emit('test-event', {})).not.toThrow();
            expect(workingHandler).toHaveBeenCalled();
        });
    });
    
    describe('Socket Communication', () => {
        beforeEach(async () => {
            await manager.connect();
            manager.isConnected = true;
        });
        
        test('should send to socket when connected', () => {
            const result = manager.send('test-event', { data: 'test' });
            
            expect(result).toBe(true);
            expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
        });
        
        test('should not send when disconnected', () => {
            manager.isConnected = false;
            
            const result = manager.send('test-event', { data: 'test' });
            
            expect(result).toBe(false);
            expect(mockSocket.emit).not.toHaveBeenCalledWith('test-event', { data: 'test' });
        });
    });
    
    describe('Error Handling', () => {
        test('should track error count', () => {
            manager.handleError('Test error', new Error('Test'));
            
            expect(manager.errorCount).toBe(1);
        });
        
        test('should open circuit breaker after max errors', () => {
            // Trigger max errors
            for (let i = 0; i < manager.config.maxErrors; i++) {
                manager.handleError('Test error', new Error('Test'));
            }
            
            expect(manager.circuitBreakerOpen).toBe(true);
        });
        
        test('should notify error listeners', () => {
            const errorListener = jest.fn();
            manager.onError(errorListener);
            
            manager.handleError('Test error', new Error('Test message'));
            
            expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({
                type: 'Test error',
                error: 'Test message',
                errorCount: 1
            }));
        });
    });
    
    describe('Connection Listeners', () => {
        test('should notify connection listeners on status change', () => {
            const listener = jest.fn();
            manager.onConnectionChange(listener);
            
            manager.notifyConnectionListeners('connected');
            
            expect(listener).toHaveBeenCalledWith('connected', expect.objectContaining({
                isConnected: manager.isConnected,
                errorCount: manager.errorCount
            }));
        });
        
        test('should handle listener errors gracefully', () => {
            const faultyListener = jest.fn(() => { throw new Error('Listener error'); });
            const workingListener = jest.fn();
            
            manager.onConnectionChange(faultyListener);
            manager.onConnectionChange(workingListener);
            
            expect(() => manager.notifyConnectionListeners('connected')).not.toThrow();
            expect(workingListener).toHaveBeenCalled();
        });
    });
    
    describe('Status Reporting', () => {
        test('should return correct connection status', () => {
            manager.isConnected = true;
            manager.errorCount = 2;
            manager.reconnectionAttempts = 1;
            
            const status = manager.getConnectionStatus();
            
            expect(status).toEqual({
                isConnected: true,
                reconnectionAttempts: 1,
                errorCount: 2,
                circuitBreakerOpen: false
            });
        });
    });
    
    describe('Cleanup', () => {
        test('should clean up timers on disconnect', () => {
            manager.heartbeatTimer = setTimeout(() => {}, 1000);
            manager.reconnectionTimer = setTimeout(() => {}, 1000);
            
            const heartbeatId = manager.heartbeatTimer;
            const reconnectionId = manager.reconnectionTimer;
            
            manager.disconnect();
            
            expect(manager.heartbeatTimer).toBeNull();
            expect(manager.reconnectionTimer).toBeNull();
        });
    });
});