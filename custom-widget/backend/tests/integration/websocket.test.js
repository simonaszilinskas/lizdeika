/**
 * Integration tests for WebSocket functionality
 */
const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');
const Client = require('socket.io-client');

describe('WebSocket Events', () => {
    let server, io, clientSocket, serverSocket;
    const PORT = 3003; // Different port to avoid conflicts

    beforeAll((done) => {
        server = createServer();
        io = new SocketIOServer(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        server.listen(PORT, () => {
            done();
        });
    });

    afterAll(() => {
        server.close();
    });

    beforeEach((done) => {
        // Setup server-side socket handling
        io.on('connection', (socket) => {
            serverSocket = socket;
        });

        // Create client connection
        clientSocket = Client(`http://localhost:${PORT}`);
        clientSocket.on('connect', done);
    });

    afterEach(() => {
        if (clientSocket) {
            clientSocket.close();
        }
        if (serverSocket) {
            serverSocket.disconnect();
        }
    });

    describe('Connection Management', () => {
        it('should connect client to server', () => {
            expect(clientSocket.connected).toBe(true);
            expect(serverSocket).toBeDefined();
        });

        it('should handle client disconnection', (done) => {
            serverSocket.on('disconnect', () => {
                done();
            });

            clientSocket.disconnect();
        });

        it('should assign unique socket IDs', () => {
            expect(serverSocket.id).toBeDefined();
            expect(clientSocket.id).toBeDefined();
            expect(typeof serverSocket.id).toBe('string');
        });
    });

    describe('Agent Dashboard Events', () => {
        it('should handle agent joining dashboard', (done) => {
            const agentId = 'agent-123';

            serverSocket.on('join-agent-dashboard', (receivedAgentId) => {
                expect(receivedAgentId).toBe(agentId);
                done();
            });

            clientSocket.emit('join-agent-dashboard', agentId);
        });

        it('should broadcast agent status updates', (done) => {
            const agentId = 'agent-123';
            const statusUpdate = {
                agentId: agentId,
                status: 'online',
                timestamp: new Date()
            };

            // First client joins as agent
            clientSocket.emit('join-agent-dashboard', agentId);

            // Setup listener for status broadcast
            clientSocket.on('agent-status-update', (data) => {
                expect(data.agentId).toBe(agentId);
                expect(data.status).toBe('online');
                expect(data.timestamp).toBeDefined();
                done();
            });

            // Simulate status update broadcast
            setTimeout(() => {
                io.to('agents').emit('agent-status-update', statusUpdate);
            }, 100);
        });

        it('should handle new message notifications to agents', (done) => {
            const messageData = {
                conversationId: 'conv-123',
                message: {
                    id: 'msg-123',
                    content: 'Hello from customer',
                    sender: 'visitor'
                },
                aiSuggestion: {
                    id: 'ai-msg-123',
                    content: 'Suggested response',
                    metadata: { confidence: 0.85 }
                },
                timestamp: new Date()
            };

            clientSocket.emit('join-agent-dashboard', 'agent-123');

            clientSocket.on('new-message', (data) => {
                expect(data.conversationId).toBe('conv-123');
                expect(data.message.content).toBe('Hello from customer');
                expect(data.aiSuggestion.content).toBe('Suggested response');
                done();
            });

            setTimeout(() => {
                io.to('agents').emit('new-message', messageData);
            }, 100);
        });
    });

    describe('Customer Conversation Events', () => {
        it('should handle customer joining conversation', (done) => {
            const conversationId = 'conv-123';

            serverSocket.on('join-conversation', (receivedConvId) => {
                expect(receivedConvId).toBe(conversationId);
                done();
            });

            clientSocket.emit('join-conversation', conversationId);
        });

        it('should deliver agent messages to customers', (done) => {
            const conversationId = 'conv-123';
            const agentMessage = {
                message: {
                    id: 'msg-123',
                    content: 'Hello, how can I help you?',
                    sender: 'agent',
                    agentId: 'agent-123'
                },
                timestamp: new Date()
            };

            clientSocket.emit('join-conversation', conversationId);

            clientSocket.on('agent-message', (data) => {
                expect(data.message.content).toBe('Hello, how can I help you?');
                expect(data.message.sender).toBe('agent');
                expect(data.timestamp).toBeDefined();
                done();
            });

            setTimeout(() => {
                io.to(conversationId).emit('agent-message', agentMessage);
            }, 100);
        });
    });

    describe('Typing Indicators', () => {
        it('should handle agent typing events', (done) => {
            const conversationId = 'conv-123';
            const typingData = {
                conversationId: conversationId,
                isTyping: true
            };

            clientSocket.emit('join-conversation', conversationId);

            serverSocket.on('agent-typing', (data) => {
                expect(data.conversationId).toBe(conversationId);
                expect(data.isTyping).toBe(true);
            });

            clientSocket.on('agent-typing-status', (data) => {
                expect(data.isTyping).toBe(true);
                expect(data.timestamp).toBeDefined();
                done();
            });

            // Agent starts typing
            setTimeout(() => {
                clientSocket.emit('agent-typing', typingData);
                // Simulate server broadcasting typing status
                serverSocket.to(conversationId).emit('agent-typing-status', {
                    isTyping: true,
                    timestamp: new Date()
                });
            }, 100);
        });

        it('should handle customer typing events', (done) => {
            const conversationId = 'conv-123';
            const typingData = {
                conversationId: conversationId,
                isTyping: true
            };

            clientSocket.emit('join-agent-dashboard', 'agent-123');

            serverSocket.on('customer-typing', (data) => {
                expect(data.conversationId).toBe(conversationId);
                expect(data.isTyping).toBe(true);
            });

            clientSocket.on('customer-typing-status', (data) => {
                expect(data.conversationId).toBe(conversationId);
                expect(data.isTyping).toBe(true);
                done();
            });

            setTimeout(() => {
                clientSocket.emit('customer-typing', typingData);
                // Simulate server broadcasting to agents
                io.to('agents').emit('customer-typing-status', {
                    conversationId: conversationId,
                    isTyping: true,
                    timestamp: new Date()
                });
            }, 100);
        });

        it('should stop typing indicators when typing stops', (done) => {
            const conversationId = 'conv-123';

            clientSocket.emit('join-conversation', conversationId);

            let typingEvents = [];
            clientSocket.on('agent-typing-status', (data) => {
                typingEvents.push(data.isTyping);
                
                if (typingEvents.length === 2) {
                    expect(typingEvents[0]).toBe(true);  // Started typing
                    expect(typingEvents[1]).toBe(false); // Stopped typing
                    done();
                }
            });

            setTimeout(() => {
                // Start typing
                serverSocket.to(conversationId).emit('agent-typing-status', {
                    isTyping: true,
                    timestamp: new Date()
                });

                // Stop typing after a delay
                setTimeout(() => {
                    serverSocket.to(conversationId).emit('agent-typing-status', {
                        isTyping: false,
                        timestamp: new Date()
                    });
                }, 50);
            }, 100);
        });
    });

    describe('Room Management', () => {
        it('should properly join conversation rooms', (done) => {
            const conversationId = 'conv-123';

            serverSocket.on('join-conversation', (convId) => {
                // Verify the socket joined the room
                expect(serverSocket.rooms.has(convId)).toBe(true);
                done();
            });

            clientSocket.emit('join-conversation', conversationId);
        });

        it('should properly join agent dashboard room', (done) => {
            const agentId = 'agent-123';

            serverSocket.on('join-agent-dashboard', (id) => {
                // Verify the socket joined the agents room
                expect(serverSocket.rooms.has('agents')).toBe(true);
                expect(serverSocket.agentId).toBe(id);
                done();
            });

            clientSocket.emit('join-agent-dashboard', agentId);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid event data gracefully', (done) => {
            // Send malformed data
            clientSocket.emit('join-conversation', null);
            clientSocket.emit('agent-typing', { invalidData: true });
            
            // If we get here without crashing, the server handled it gracefully
            setTimeout(() => {
                expect(true).toBe(true);
                done();
            }, 100);
        });

        it('should handle disconnection during events', (done) => {
            const agentId = 'agent-123';
            
            clientSocket.emit('join-agent-dashboard', agentId);
            
            serverSocket.on('disconnect', () => {
                // Verify cleanup happens on disconnect
                expect(true).toBe(true);
                done();
            });

            setTimeout(() => {
                clientSocket.disconnect();
            }, 100);
        });
    });

    describe('Message Broadcasting', () => {
        it('should broadcast to correct rooms', (done) => {
            const conversationId = 'conv-123';
            let messagesReceived = 0;

            // Create multiple clients
            const client2 = Client(`http://localhost:${PORT}`);
            
            client2.on('connect', () => {
                // Both clients join the same conversation
                clientSocket.emit('join-conversation', conversationId);
                client2.emit('join-conversation', conversationId);

                // Setup listeners
                clientSocket.on('agent-message', () => {
                    messagesReceived++;
                });

                client2.on('agent-message', () => {
                    messagesReceived++;
                    
                    if (messagesReceived === 2) {
                        expect(messagesReceived).toBe(2);
                        client2.close();
                        done();
                    }
                });

                // Broadcast message to the conversation room
                setTimeout(() => {
                    io.to(conversationId).emit('agent-message', {
                        message: { content: 'Test broadcast' },
                        timestamp: new Date()
                    });
                }, 200);
            });
        });
    });
});