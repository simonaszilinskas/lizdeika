/**
 * Unit tests for WebSocket Service
 */

// Mock dependencies before requiring the service
jest.mock('../../src/services/agentService');
jest.mock('../../src/services/conversationService');

const WebSocketService = require('../../src/services/websocketService');
const agentService = require('../../src/services/agentService');
const conversationService = require('../../src/services/conversationService');

// Mock socket.io
const mockSocket = {
    id: 'mock-socket-id',
    join: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    on: jest.fn(),
    emit: jest.fn(),
    agentId: null,
    rooms: new Set()
};

const mockIO = {
    on: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    engine: { clientsCount: 5 },
    sockets: {
        adapter: {
            rooms: new Map([
                ['agents', new Set(['socket1', 'socket2'])]
            ])
        }
    }
};

describe('WebSocketService', () => {
    let websocketService;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mock implementations
        agentService.setAgentOnline = jest.fn().mockResolvedValue(undefined);
        agentService.setAgentOffline = jest.fn().mockResolvedValue(undefined);
        agentService.getSystemMode = jest.fn().mockResolvedValue('hitl');
        agentService.getConnectedAgents = jest.fn().mockResolvedValue([]);
        agentService.redistributeOrphanedTickets = jest.fn().mockResolvedValue([]);
        
        conversationService.someMethod = jest.fn().mockResolvedValue(undefined);
        
        websocketService = new WebSocketService(mockIO);
    });

    describe('Constructor', () => {
        it('should initialize with io instance', () => {
            expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
        });
    });

    describe('Event Broadcasting', () => {
        it('should emit new message to agents', () => {
            const messageData = {
                conversationId: 'conv-123',
                message: { content: 'Test message' },
                timestamp: new Date()
            };

            websocketService.emitNewMessage(messageData);

            expect(mockIO.to).toHaveBeenCalledWith('agents');
        });

        it('should emit agent message to customer', () => {
            const conversationId = 'conv-123';
            const messageData = {
                message: { content: 'Agent response' },
                timestamp: new Date()
            };

            websocketService.emitAgentMessage(conversationId, messageData);

            expect(mockIO.to).toHaveBeenCalledWith(conversationId);
        });

        it('should emit agent status update', () => {
            const agentId = 'agent-123';
            const status = 'online';

            websocketService.emitAgentStatusUpdate(agentId, status);

            expect(mockIO.to).toHaveBeenCalledWith('agents');
        });

        it('should emit typing status to correct target', () => {
            const data = { isTyping: true, timestamp: new Date() };

            // To agents
            websocketService.emitTypingStatus('agents', data);
            expect(mockIO.to).toHaveBeenCalledWith('agents');

            // To conversation
            websocketService.emitTypingStatus('conv-123', data);
            expect(mockIO.to).toHaveBeenCalledWith('conv-123');
        });
    });

    describe('Connection Management', () => {
        it('should get connected clients count', () => {
            const count = websocketService.getConnectedClientsCount();
            expect(count).toBe(5);
        });

        it('should get agents room size', () => {
            const size = websocketService.getAgentsRoomSize();
            expect(size).toBe(2);
        });

        it('should handle room that does not exist', () => {
            // Mock empty rooms
            mockIO.sockets.adapter.rooms = new Map();
            const size = websocketService.getAgentsRoomSize();
            expect(size).toBe(0);
        });
    });

    describe('Socket Event Handlers', () => {
        let connectionHandler;

        beforeEach(() => {
            // Get the connection handler that was registered
            connectionHandler = mockIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        });

        it('should handle socket connection', () => {
            connectionHandler(mockSocket);
            
            expect(mockSocket.on).toHaveBeenCalledWith('join-conversation', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('join-agent-dashboard', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('agent-typing', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('customer-typing', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
        });

        it('should handle join-conversation event', () => {
            connectionHandler(mockSocket);
            
            // Get the join-conversation handler
            const joinConversationHandler = mockSocket.on.mock.calls
                .find(call => call[0] === 'join-conversation')[1];
            
            const conversationId = 'conv-123';
            joinConversationHandler(conversationId);
            
            expect(mockSocket.join).toHaveBeenCalledWith(conversationId);
        });

        it('should handle join-agent-dashboard event', () => {
            connectionHandler(mockSocket);
            
            // Get the join-agent-dashboard handler
            const joinAgentHandler = mockSocket.on.mock.calls
                .find(call => call[0] === 'join-agent-dashboard')[1];
            
            const agentId = 'agent-123';
            joinAgentHandler(agentId);
            
            expect(mockSocket.join).toHaveBeenCalledWith('agents');
            expect(mockSocket.agentId).toBe(agentId);
        });

        it('should handle agent-typing event', () => {
            connectionHandler(mockSocket);
            
            const agentTypingHandler = mockSocket.on.mock.calls
                .find(call => call[0] === 'agent-typing')[1];
            
            const typingData = {
                conversationId: 'conv-123',
                isTyping: true
            };
            
            agentTypingHandler(typingData);
            
            expect(mockSocket.to).toHaveBeenCalledWith('conv-123');
        });

        it('should handle customer-typing event', () => {
            connectionHandler(mockSocket);
            
            const customerTypingHandler = mockSocket.on.mock.calls
                .find(call => call[0] === 'customer-typing')[1];
            
            const typingData = {
                conversationId: 'conv-123',
                isTyping: false
            };
            
            customerTypingHandler(typingData);
            
            expect(mockIO.to).toHaveBeenCalledWith('agents');
        });

        it('should handle disconnect event for regular socket', () => {
            // Clear previous mock calls
            mockIO.to.mockClear();
            
            connectionHandler(mockSocket);
            
            const disconnectHandler = mockSocket.on.mock.calls
                .find(call => call[0] === 'disconnect')[1];
            
            disconnectHandler();
            
            // Should not attempt agent cleanup since no agentId
            expect(mockIO.to).not.toHaveBeenCalled();
        });

        it('should handle disconnect event for agent socket', async () => {
            mockSocket.agentId = 'agent-123';
            connectionHandler(mockSocket);
            
            const disconnectHandler = mockSocket.on.mock.calls
                .find(call => call[0] === 'disconnect')[1];
            
            await disconnectHandler();
            
            expect(mockIO.to).toHaveBeenCalledWith('agents');
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed event data gracefully', () => {
            const invalidData = null;
            
            // Should not throw when emitting with invalid data
            expect(() => {
                websocketService.emitNewMessage(invalidData);
                websocketService.emitAgentMessage('conv-123', invalidData);
                websocketService.emitTypingStatus('agents', invalidData);
            }).not.toThrow();
        });
    });
});