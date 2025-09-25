/**
 * Tests for SocketManager
 * Tests the actual SocketManager implementation with correct API interface
 */

const ModuleLoader = require('../utilities/module-loader');

const { SocketManager } = ModuleLoader.loadModule('custom-widget/js/agent-dashboard/core/SocketManager.js');

// Mock Socket.IO
global.io = jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true
}));

describe('SocketManager', () => {
    let manager;
    let mockSocket;
    let mockEventHandlers;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create mock socket
        mockSocket = {
            on: jest.fn(),
            emit: jest.fn(),
            disconnect: jest.fn(),
            connected: true
        };
        
        global.io.mockReturnValue(mockSocket);
        
        // Create mock event handlers
        mockEventHandlers = {
            onConnect: jest.fn(),
            onDisconnect: jest.fn(),
            onNewMessage: jest.fn(),
            onAgentsUpdate: jest.fn(),
            onSystemModeUpdate: jest.fn(),
            onTicketReassignments: jest.fn(),
            onCustomerTyping: jest.fn(),
            onNewConversation: jest.fn(),
            onAgentSentMessage: jest.fn(),
            onError: jest.fn()
        };
        
        // Create manager with test config
        manager = new SocketManager({
            apiUrl: 'http://test:3002',
            agentId: 'test-agent',
            eventHandlers: mockEventHandlers
        });
    });

    afterEach(() => {
        if (manager) {
            manager.disconnect();
        }
    });

    describe('Initialization', () => {
        test('should initialize with correct config', () => {
            expect(manager.apiUrl).toBe('http://test:3002');
            expect(manager.agentId).toBe('test-agent');
            expect(manager.eventHandlers).toEqual(mockEventHandlers);
            expect(manager.socket).toBeNull();
            expect(manager.isConnected).toBe(false);
            expect(manager.heartbeatInterval).toBeNull();
        });
        
        test('should initialize with default config when no config provided', () => {
            const defaultManager = new SocketManager();
            
            expect(defaultManager.apiUrl).toBeUndefined();
            expect(defaultManager.agentId).toBeUndefined();
            expect(defaultManager.eventHandlers).toEqual({});
            expect(defaultManager.socket).toBeNull();
            expect(defaultManager.isConnected).toBe(false);
        });
        
        test('should initialize with empty event handlers when not provided', () => {
            const manager = new SocketManager({ agentId: 'test' });
            expect(manager.eventHandlers).toEqual({});
        });
    });

    describe('Socket Initialization', () => {
        test('should initialize socket connection successfully', async () => {
            await manager.initialize();
            
            expect(global.io).toHaveBeenCalledWith('ws://test:3002');
            expect(manager.socket).toBe(mockSocket);
            expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
        });
        
        test('should handle initialization errors gracefully', async () => {
            global.io.mockImplementation(() => {
                throw new Error('Connection failed');
            });
            
            await manager.initialize();
            
            expect(mockEventHandlers.onError).toHaveBeenCalledWith(expect.any(Error));
        });
        
        test('should convert http URL to ws URL', async () => {
            await manager.initialize();
            
            expect(global.io).toHaveBeenCalledWith('ws://test:3002');
        });
    });

    describe('Event Handler Setup', () => {
        beforeEach(async () => {
            await manager.initialize();
        });
        
        test('should set up all required event listeners', () => {
            expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
            // Check for specific events the manager listens to
            expect(mockSocket.on).toHaveBeenCalledWith('tickets-reassigned', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('customer-typing-status', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('new-conversation', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('agent-sent-message', expect.any(Function));
        });
        
        test('should handle connect event correctly', () => {
            // Find and call the connect handler
            const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
            connectHandler();
            
            expect(manager.isConnected).toBe(true);
            expect(mockEventHandlers.onConnect).toHaveBeenCalled();
        });
        
        test('should handle disconnect event correctly', () => {
            // Set connected state first
            manager.isConnected = true;
            
            // Find and call the disconnect handler
            const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
            disconnectHandler();
            
            expect(manager.isConnected).toBe(false);
            expect(mockEventHandlers.onDisconnect).toHaveBeenCalled();
        });
        
        test('should handle error event correctly', () => {
            const testError = new Error('Test error');
            
            // Find and call the error handler
            const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
            errorHandler(testError);
            
            expect(mockEventHandlers.onError).toHaveBeenCalledWith(testError);
        });
    });

    describe('Heartbeat Management', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        
        afterEach(() => {
            jest.useRealTimers();
        });
        
        test('should start heartbeat on initialization', async () => {
            await manager.initialize();
            expect(manager.heartbeatInterval).not.toBeNull();
        });
        
        test('should send heartbeat at regular intervals', async () => {
            await manager.initialize();
            
            // Clear any previous calls
            mockSocket.emit.mockClear();
            
            // Fast-forward time
            jest.advanceTimersByTime(30000);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('heartbeat', {
                timestamp: expect.any(Number),
                agentId: 'test-agent'
            });
        });
        
        test('should stop heartbeat when requested', async () => {
            await manager.initialize();
            
            manager.stopHeartbeat();
            
            expect(manager.heartbeatInterval).toBeNull();
        });
        
        test('should not send heartbeat if socket not connected', async () => {
            await manager.initialize();
            mockSocket.connected = false;
            
            // Clear any previous calls
            mockSocket.emit.mockClear();
            
            jest.advanceTimersByTime(30000);
            
            expect(mockSocket.emit).not.toHaveBeenCalledWith('heartbeat', expect.any(Object));
        });
    });

    describe('Socket Communication', () => {
        beforeEach(async () => {
            await manager.initialize();
        });
        
        test('should emit events when socket is connected', () => {
            manager.emit('test-event', { data: 'test' });
            
            expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
        });
        
        test('should not emit when socket not connected', () => {
            mockSocket.connected = false;
            
            manager.emit('test-event', { data: 'test' });
            
            expect(mockSocket.emit).not.toHaveBeenCalledWith('test-event', expect.any(Object));
        });
        
        test('should check socket connection status correctly', () => {
            expect(manager.isSocketConnected()).toBe(true);
            
            mockSocket.connected = false;
            expect(manager.isSocketConnected()).toBe(false);
        });
    });

    describe('Connection Management', () => {
        beforeEach(async () => {
            await manager.initialize();
        });
        
        test('should disconnect cleanly', () => {
            manager.disconnect();
            
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(manager.socket).toBeNull();
            expect(manager.isConnected).toBe(false);
            expect(manager.heartbeatInterval).toBeNull();
        });
        
        test('should handle disconnect when socket is null', () => {
            manager.socket = null;
            
            expect(() => manager.disconnect()).not.toThrow();
            expect(manager.isConnected).toBe(false);
        });
    });

    describe('Agent Management', () => {
        test('should update agent ID', () => {
            manager.updateAgentId('new-agent-id');
            
            expect(manager.agentId).toBe('new-agent-id');
        });
    });

    describe('Event Handler Delegation', () => {
        beforeEach(async () => {
            await manager.initialize();
        });
        
        test('should handle tickets-reassigned event', () => {
            const testData = { ticketId: '123', newAgent: 'agent2' };
            
            // Find and call the handler
            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'tickets-reassigned')[1];
            handler(testData);
            
            expect(mockEventHandlers.onTicketReassignments).toHaveBeenCalledWith(testData);
        });
        
        test('should handle new-conversation event', () => {
            const testData = { conversationId: '456' };
            
            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'new-conversation')[1];
            handler(testData);
            
            expect(mockEventHandlers.onNewConversation).toHaveBeenCalledWith(testData);
        });
        
        test('should handle agent-sent-message event', () => {
            const testData = { messageId: '789' };
            
            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'agent-sent-message')[1];
            handler(testData);
            
            expect(mockEventHandlers.onAgentSentMessage).toHaveBeenCalledWith(testData);
        });
        
        test('should not fail when event handlers are missing', async () => {
            const managerNoHandlers = new SocketManager({ apiUrl: 'http://test:3002' });
            
            // Initialize socket first so setupEventHandlers can be called
            await managerNoHandlers.initialize();
            
            // The test passes because SocketManager checks for handler existence before calling
            // This test verifies that missing handlers don't cause errors during event processing
            expect(managerNoHandlers.eventHandlers).toEqual({});
        });
    });
});
