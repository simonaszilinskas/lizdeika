/**
 * Unit tests for Archive Functionality
 */
const { PrismaClient } = require('@prisma/client');
const conversationService = require('../../src/services/conversationService');
const agentService = require('../../src/services/agentService');
const activityService = require('../../src/services/activityService');

// Mock Prisma
jest.mock('@prisma/client', () => {
    const mockPrismaClient = {
        tickets: {
            updateMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
            findFirst: jest.fn()
        },
        messages: {
            create: jest.fn(),
            findMany: jest.fn()
        },
        users: {
            findUnique: jest.fn()
        },
        user_activities: {
            create: jest.fn()
        }
    };
    return {
        PrismaClient: jest.fn(() => mockPrismaClient)
    };
});

// Mock agent service
jest.mock('../../src/services/agentService', () => ({
    getNextAvailableAgent: jest.fn()
}));

// Mock activity service
jest.mock('../../src/services/activityService', () => ({
    logActivity: jest.fn().mockResolvedValue({ id: 'activity-1' })
}));

describe('Archive Functionality', () => {
    let prisma;

    beforeEach(() => {
        prisma = new PrismaClient();
        jest.clearAllMocks();
    });

    describe('bulkArchiveConversations', () => {
        it('should archive multiple conversations and clear assignments', async () => {
            const conversationIds = ['conv1', 'conv2', 'conv3'];
            prisma.tickets.updateMany.mockResolvedValue({ count: 3 });

            const result = await conversationService.bulkArchiveConversations(conversationIds);

            expect(prisma.tickets.updateMany).toHaveBeenCalledWith({
                where: {
                    id: { in: conversationIds },
                    archived: false
                },
                data: {
                    archived: true,
                    assigned_agent_id: null, // Should clear assignment
                    updated_at: expect.any(Date)
                }
            });
            expect(result).toEqual({ count: 3 });
        });

        it('should handle empty conversation list', async () => {
            const result = await conversationService.bulkArchiveConversations([]);

            expect(prisma.tickets.updateMany).toHaveBeenCalledWith({
                where: {
                    id: { in: [] },
                    archived: false
                },
                data: {
                    archived: true,
                    assigned_agent_id: null,
                    updated_at: expect.any(Date)
                }
            });
        });

        it('should handle database errors', async () => {
            prisma.tickets.updateMany.mockRejectedValue(new Error('Database error'));

            await expect(
                conversationService.bulkArchiveConversations(['conv1'])
            ).rejects.toThrow('Failed to archive conversations');
        });
    });

    describe('bulkUnarchiveConversations', () => {
        it('should unarchive multiple conversations', async () => {
            const conversationIds = ['conv1', 'conv2'];
            prisma.tickets.updateMany.mockResolvedValue({ count: 2 });

            const result = await conversationService.bulkUnarchiveConversations(conversationIds);

            expect(prisma.tickets.updateMany).toHaveBeenCalledWith({
                where: {
                    id: { in: conversationIds },
                    archived: true
                },
                data: {
                    archived: false,
                    updated_at: expect.any(Date)
                }
            });
            expect(result).toEqual({ count: 2 });
        });
    });

    describe('autoUnarchiveOnNewMessage', () => {
        it('should auto-unarchive and assign to agent when agent sends message', async () => {
            const conversationId = 'conv1';
            const agentId = 'agent123';
            
            prisma.tickets.findUnique.mockResolvedValue({
                archived: true,
                assigned_agent_id: null
            });
            prisma.tickets.update.mockResolvedValue({});

            const result = await conversationService.autoUnarchiveOnNewMessage(conversationId, agentId);

            expect(prisma.tickets.update).toHaveBeenCalledWith({
                where: { id: conversationId },
                data: {
                    archived: false,
                    updated_at: expect.any(Date),
                    assigned_agent_id: agentId // Should assign to the agent who sent message
                }
            });
            expect(result).toBe(true);
        });

        it('should auto-unarchive and auto-assign when user sends message', async () => {
            const conversationId = 'conv1';
            const availableAgentId = 'available-agent';
            
            prisma.tickets.findUnique.mockResolvedValue({
                archived: true,
                assigned_agent_id: null
            });
            prisma.tickets.update.mockResolvedValue({});
            agentService.getNextAvailableAgent.mockResolvedValue(availableAgentId);

            const result = await conversationService.autoUnarchiveOnNewMessage(conversationId, null);

            expect(agentService.getNextAvailableAgent).toHaveBeenCalled();
            expect(prisma.tickets.update).toHaveBeenCalledWith({
                where: { id: conversationId },
                data: {
                    archived: false,
                    updated_at: expect.any(Date),
                    assigned_agent_id: availableAgentId
                }
            });
            expect(result).toBe(true);
        });

        it('should handle no available agents when user sends message', async () => {
            const conversationId = 'conv1';
            
            prisma.tickets.findUnique.mockResolvedValue({
                archived: true,
                assigned_agent_id: null
            });
            prisma.tickets.update.mockResolvedValue({});
            agentService.getNextAvailableAgent.mockResolvedValue(null);

            const result = await conversationService.autoUnarchiveOnNewMessage(conversationId, null);

            expect(prisma.tickets.update).toHaveBeenCalledWith({
                where: { id: conversationId },
                data: {
                    archived: false,
                    updated_at: expect.any(Date),
                    assigned_agent_id: null // Should remain unassigned
                }
            });
            expect(result).toBe(true);
        });

        it('should not unarchive if conversation is not archived', async () => {
            const conversationId = 'conv1';
            
            prisma.tickets.findUnique.mockResolvedValue({
                archived: false,
                assigned_agent_id: 'agent123'
            });

            const result = await conversationService.autoUnarchiveOnNewMessage(conversationId, null);

            expect(prisma.tickets.update).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should handle conversation not found', async () => {
            prisma.tickets.findUnique.mockResolvedValue(null);

            const result = await conversationService.autoUnarchiveOnNewMessage('nonexistent', null);

            expect(prisma.tickets.update).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });

    describe('bulkAssignConversations', () => {
        it('should bulk assign conversations to an agent', async () => {
            const conversationIds = ['conv1', 'conv2'];
            const agentEmail = 'agent@example.com';
            const agentId = 'agent-uuid';
            
            prisma.users.findUnique.mockResolvedValue({ id: agentId });
            prisma.tickets.updateMany.mockResolvedValue({ count: 2 });

            const result = await conversationService.bulkAssignConversations(conversationIds, agentEmail);

            expect(prisma.users.findUnique).toHaveBeenCalledWith({
                where: { email: agentEmail }
            });
            expect(prisma.tickets.updateMany).toHaveBeenCalledWith({
                where: {
                    id: { in: conversationIds }
                    // Note: The actual implementation doesn't filter by archived: false
                },
                data: {
                    assigned_agent_id: agentId,
                    updated_at: expect.any(Date)
                }
            });
            expect(result).toEqual({ count: 2 });
        });

        it('should handle agent not found', async () => {
            prisma.users.findUnique.mockResolvedValue(null);

            await expect(
                conversationService.bulkAssignConversations(['conv1'], 'nonexistent@example.com')
            ).rejects.toThrow('Failed to assign conversations: Agent with email nonexistent@example.com not found');
        });
    });

    describe('Message handling with archive state', () => {
        it('should auto-unarchive when user sends message to archived conversation', async () => {
            const conversationId = 'conv1';
            const message = {
                sender: 'user',
                content: 'New message',
                senderId: null
            };
            
            // Setup mocks for the entire flow
            prisma.tickets.findUnique
                .mockResolvedValueOnce(null) // For ensureConversationExists check
                .mockResolvedValueOnce({ archived: true, assigned_agent_id: null }); // For autoUnarchive
            
            prisma.tickets.count.mockResolvedValue(5); // For ticket number generation
            prisma.tickets.create.mockResolvedValue({ 
                id: conversationId,
                ticket_number: 'VIL-20250821-0006',
                user_number: 1,
                created_at: new Date(),
                updated_at: new Date()
            });
            prisma.tickets.update.mockResolvedValue({});
            prisma.messages.create.mockResolvedValue({
                id: 'msg1',
                content: message.content,
                senderType: 'user',
                users: null
            });
            agentService.getNextAvailableAgent.mockResolvedValue('available-agent');

            await conversationService.addMessage(conversationId, message);

            // Verify auto-unarchive was called
            expect(prisma.tickets.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: conversationId },
                    data: expect.objectContaining({
                        archived: false
                    })
                })
            );
        });

        it('should auto-unarchive and assign when agent sends message to archived conversation', async () => {
            const conversationId = 'conv1';
            const agentId = 'agent123';
            const message = {
                sender: 'agent',
                content: 'Agent response',
                senderId: agentId
            };
            
            // Setup existing conversation
            prisma.tickets.findUnique
                .mockResolvedValueOnce({ 
                    id: conversationId,
                    ticket_number: 'VIL-20250821-0007',
                    user_number: 2
                }) // For ensureConversationExists
                .mockResolvedValueOnce({ archived: true, assigned_agent_id: null }); // For autoUnarchive
            
            prisma.tickets.update.mockResolvedValue({});
            prisma.messages.create.mockResolvedValue({
                id: 'msg1',
                content: message.content,
                senderType: 'agent',
                users: null
            });

            await conversationService.addMessage(conversationId, message);

            // Verify auto-unarchive was called with agent assignment
            expect(prisma.tickets.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: conversationId },
                    data: expect.objectContaining({
                        archived: false,
                        assigned_agent_id: agentId
                    })
                })
            );
        });
    });
});