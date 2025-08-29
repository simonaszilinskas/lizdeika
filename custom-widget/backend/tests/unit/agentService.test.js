/**
 * Unit tests for Agent Service
 * Tests agent management, status handling, load balancing, and system mode operations
 */
const agentService = require('../../src/services/agentService');

// Mock conversation service for testing
const mockConversationService = {
  getAgentConversations: jest.fn(),
  getAllConversations: jest.fn(),
  getOrphanedConversations: jest.fn(),
  assignConversation: jest.fn(),
};

describe('AgentService', () => {
  beforeEach(() => {
    // Clear all data before each test
    agentService.clearAllData();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockConversationService.getAgentConversations.mockReturnValue([]);
    mockConversationService.getAllConversations.mockReturnValue([]);
    mockConversationService.getOrphanedConversations.mockReturnValue([]);
  });

  describe('Agent Name Generation', () => {
    it('should generate "Agent One" for first agent', () => {
      const name = agentService.generateAgentDisplayName('agent-abc123');
      expect(name).toBe('Agent One');
    });

    it('should generate sequential agent names', () => {
      const name1 = agentService.generateAgentDisplayName('agent-123');
      const name2 = agentService.generateAgentDisplayName('agent-456');
      const name3 = agentService.generateAgentDisplayName('agent-789');
      
      expect(name1).toBe('Agent One');
      expect(name2).toBe('Agent Two');
      expect(name3).toBe('Agent Three');
    });

    it('should generate "Admin One" for admin agent', () => {
      const name = agentService.generateAgentDisplayName('admin-abc123');
      expect(name).toBe('Admin One');
    });

    it('should generate sequential admin names', () => {
      const name1 = agentService.generateAgentDisplayName('admin-123');
      const name2 = agentService.generateAgentDisplayName('admin-456');
      
      expect(name1).toBe('Admin One');
      expect(name2).toBe('Admin Two');
    });

    it('should return cached name for existing agent', () => {
      const agentId = 'agent-test';
      const name1 = agentService.generateAgentDisplayName(agentId);
      const name2 = agentService.generateAgentDisplayName(agentId);
      
      expect(name1).toBe(name2);
      expect(name1).toBe('Agent One');
    });

    it('should convert numbers to words correctly', () => {
      expect(agentService.numberToWord(1)).toBe('One');
      expect(agentService.numberToWord(5)).toBe('Five');
      expect(agentService.numberToWord(10)).toBe('Ten');
      expect(agentService.numberToWord(11)).toBe('11'); // Beyond word list
    });

    it('should get agent display name', () => {
      const agentId = 'agent-test';
      const name = agentService.getAgentDisplayName(agentId);
      expect(name).toBe('Agent One');
      
      // Should return same name on subsequent calls
      const sameName = agentService.getAgentDisplayName(agentId);
      expect(sameName).toBe('Agent One');
    });
  });

  describe('Agent Status Management', () => {
    it('should update agent personal status', () => {
      const agentId = 'agent-123';
      mockConversationService.getAgentConversations.mockReturnValue([
        { id: 'conv1' }, { id: 'conv2' }
      ]);

      const agent = agentService.updateAgentPersonalStatus(
        agentId, 
        'online', 
        mockConversationService
      );

      expect(agent.id).toBe(agentId);
      expect(agent.name).toBe('Agent One');
      expect(agent.personalStatus).toBe('online');
      expect(agent.activeChats).toBe(2);
      expect(agent.connected).toBe(true);
      expect(agent.lastSeen).toBeInstanceOf(Date);
    });

    it('should set agent online with socket info', () => {
      const agentId = 'agent-123';
      const socketId = 'socket-456';
      mockConversationService.getAgentConversations.mockReturnValue([{ id: 'conv1' }]);

      const agent = agentService.setAgentOnline(agentId, socketId, mockConversationService);

      expect(agent.id).toBe(agentId);
      expect(agent.status).toBe('online');
      expect(agent.socketId).toBe(socketId);
      expect(agent.activeChats).toBe(1);
      expect(agent.lastSeen).toBeInstanceOf(Date);
    });

    it('should set agent offline', () => {
      // First set agent online
      const agentId = 'agent-123';
      agentService.setAgentOnline(agentId, 'socket-123');
      
      // Then set offline
      const agent = agentService.setAgentOffline(agentId);

      expect(agent.connected).toBe(false);
      expect(agent.personalStatus).toBe('offline');
      expect(agent.lastSeen).toBeInstanceOf(Date);
    });

    it('should update last seen timestamp', async () => {
      const agentId = 'agent-123';
      agentService.setAgentOnline(agentId);
      
      const originalLastSeen = agentService.getAgent(agentId).lastSeen;
      
      // Wait a bit and update
      await new Promise(resolve => setTimeout(resolve, 10));
      const agent = agentService.updateLastSeen(agentId);
      expect(agent.lastSeen.getTime()).toBeGreaterThanOrEqual(originalLastSeen.getTime());
    });
  });

  describe('Agent Retrieval', () => {
    beforeEach(() => {
      // Set up test agents
      agentService.setAgentOnline('agent1', 'socket1');
      agentService.updateAgentPersonalStatus('agent1', 'online');
      
      agentService.setAgentOnline('agent2', 'socket2');
      agentService.updateAgentPersonalStatus('agent2', 'offline');
      
      agentService.setAgentOnline('agent3', 'socket3');
      agentService.setAgentOffline('agent3');
    });

    it('should get agent by ID', () => {
      const agent = agentService.getAgent('agent1');
      expect(agent.id).toBe('agent1');
      expect(agent.name).toBe('Agent One');
    });

    it('should get all agents', () => {
      const agents = agentService.getAllAgents();
      expect(agents).toHaveLength(3);
      expect(agents.map(a => a.id)).toEqual(['agent1', 'agent2', 'agent3']);
    });

    it('should get available agents (not AFK, connected)', () => {
      const availableAgents = agentService.getAvailableAgents();
      expect(availableAgents).toHaveLength(1);
      expect(availableAgents[0].id).toBe('agent1');
    });

    it('should get connected agents', () => {
      const connectedAgents = agentService.getConnectedAgents();
      expect(connectedAgents).toHaveLength(2); // agent1 and agent2 (agent3 is offline)
    });

    it('should return null for non-existent agent', () => {
      const agent = agentService.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('Load Balancing', () => {
    beforeEach(() => {
      // Create agents with different loads
      agentService.setAgentOnline('agent1', 'socket1');
      agentService.updateAgentPersonalStatus('agent1', 'online');
      const agent1 = agentService.getAgent('agent1');
      agent1.activeChats = 0;
      
      agentService.setAgentOnline('agent2', 'socket2');
      agentService.updateAgentPersonalStatus('agent2', 'online');
      const agent2 = agentService.getAgent('agent2');
      agent2.activeChats = 1;
      
      agentService.setAgentOnline('agent3', 'socket3');
      agentService.updateAgentPersonalStatus('agent3', 'online');
      const agent3 = agentService.getAgent('agent3');
      agent3.activeChats = 2;
    });

    it('should get best available agent (least loaded)', () => {
      const bestAgent = agentService.getBestAvailableAgent();
      expect(bestAgent.id).toBe('agent1'); // Has 0 active chats
    });

    it('should return null when no agents available', () => {
      agentService.clearAllData();
      const bestAgent = agentService.getBestAvailableAgent();
      expect(bestAgent).toBeNull();
    });

    it('should sort by activity when chat load is equal', () => {
      // Make all agents have same load but different last seen times
      agentService.clearAllData();
      
      const now = new Date();
      const older = new Date(now.getTime() - 10000);
      
      agentService.setAgentOnline('agent1');
      agentService.updateAgentPersonalStatus('agent1', 'online');
      const agent1 = agentService.getAgent('agent1');
      agent1.lastSeen = now;
      agent1.activeChats = 1;
      
      agentService.setAgentOnline('agent2');
      agentService.updateAgentPersonalStatus('agent2', 'online');
      const agent2 = agentService.getAgent('agent2');
      agent2.lastSeen = older;
      agent2.activeChats = 1;

      const bestAgent = agentService.getBestAvailableAgent();
      expect(bestAgent.id).toBe('agent2'); // Older activity, more fair
    });
  });

  describe('System Mode Management', () => {
    beforeEach(() => {
      // Reset to default mode before each test
      agentService.setSystemMode('hitl');
    });

    it('should get default system mode', () => {
      const mode = agentService.getSystemMode();
      expect(mode).toBe('hitl');
    });

    it('should set valid system mode', () => {
      const result = agentService.setSystemMode('autopilot');
      expect(result).toBe(true);
      expect(agentService.getSystemMode()).toBe('autopilot');
    });

    it('should reject invalid system mode', () => {
      const currentMode = agentService.getSystemMode();
      const result = agentService.setSystemMode('invalid-mode');
      expect(result).toBe(false);
      expect(agentService.getSystemMode()).toBe(currentMode); // Should remain unchanged
    });

    it('should accept all valid modes', () => {
      const validModes = ['hitl', 'autopilot', 'off'];
      
      validModes.forEach(mode => {
        const result = agentService.setSystemMode(mode);
        expect(result).toBe(true);
        expect(agentService.getSystemMode()).toBe(mode);
      });
    });
  });

  describe('Agent Reassignment (AFK Handling)', () => {
    beforeEach(() => {
      // Set up agents
      agentService.setAgentOnline('agent1', 'socket1');
      agentService.updateAgentPersonalStatus('agent1', 'online');
      
      agentService.setAgentOnline('agent2', 'socket2');
      agentService.updateAgentPersonalStatus('agent2', 'online');
      
      agentService.setAgentOnline('offlineAgent', 'socket3');
      agentService.updateAgentPersonalStatus('offlineAgent', 'afk');
    });

    it('should reassign tickets when agent goes AFK', () => {
      // Mock conversations for AFK agent
      mockConversationService.getAgentConversations.mockReturnValue([
        { id: 'conv1', assignedAgent: 'offlineAgent' },
        { id: 'conv2', assignedAgent: 'offlineAgent' }
      ]);

      const reassignments = agentService.handleAgentOffline('offlineAgent', mockConversationService);

      expect(reassignments).toHaveLength(2);
      expect(mockConversationService.assignConversation).toHaveBeenCalledTimes(2);
      
      reassignments.forEach(r => {
        expect(r.action).toBe('reassigned');
        expect(r.fromAgent).toBe('offlineAgent');
        expect(['agent1', 'agent2']).toContain(r.toAgent);
      });
    });

    it('should orphan tickets when no agents available', () => {
      agentService.clearAllData();
      
      mockConversationService.getAgentConversations.mockReturnValue([
        { id: 'conv1', assignedAgent: 'offlineAgent' }
      ]);

      const reassignments = agentService.handleAgentOffline('offlineAgent', mockConversationService);

      expect(reassignments).toHaveLength(1);
      expect(reassignments[0].action).toBe('orphaned');
      expect(reassignments[0].reason).toBe('No available agents');
    });
  });

  describe('Statistics and Performance', () => {
    beforeEach(() => {
      // Set up test agents with different statuses
      agentService.setAgentOnline('agent1', 'socket1');
      agentService.updateAgentPersonalStatus('agent1', 'online');
      
      agentService.setAgentOnline('agent2', 'socket2');
      agentService.updateAgentPersonalStatus('agent2', 'offline');
      
      agentService.setAgentOnline('agent3', 'socket3');
      agentService.setAgentOffline('agent3');
    });

    it('should get agent count', () => {
      const count = agentService.getAgentCount();
      expect(count).toBe(3);
    });

    it('should get agent statistics', () => {
      const stats = agentService.getAgentStats();
      
      expect(stats.total).toBe(3);
      expect(stats.online).toBe(3); // All agents have status 'online' initially
      expect(stats.offline).toBe(0); // None are marked offline by status
      expect(stats.totalActiveChats).toBe(0); // No active chats in test
    });

    it('should get agent performance metrics', () => {
      mockConversationService.getAgentConversations.mockReturnValue([
        { id: 'conv1', startedAt: '2024-01-01T10:00:00Z', endedAt: '2024-01-01T10:30:00Z' },
        { id: 'conv2', startedAt: '2024-01-01T11:00:00Z' }
      ]);

      const performance = agentService.getAgentPerformance('agent1', mockConversationService);
      
      expect(performance.agentId).toBe('agent1');
      expect(performance.totalConversations).toBe(2);
    });

    it('should return default performance when no conversation service', () => {
      const performance = agentService.getAgentPerformance('agent1');
      
      expect(performance.totalConversations).toBe(0);
    });

    it('should return null for non-existent agent performance', () => {
      const performance = agentService.getAgentPerformance('non-existent', mockConversationService);
      expect(performance).toBeNull();
    });
  });

  describe('Orphaned Ticket Redistribution', () => {
    beforeEach(() => {
      // Set up available agents
      mockConversationService.getAgentConversations.mockReturnValue([]);
      
      agentService.setAgentOnline('agent1', 'socket1', mockConversationService);
      agentService.updateAgentPersonalStatus('agent1', 'online', mockConversationService);
      
      agentService.setAgentOnline('agent2', 'socket2', mockConversationService);
      agentService.updateAgentPersonalStatus('agent2', 'online', mockConversationService);
    });

    it('should redistribute orphaned tickets', () => {
      mockConversationService.getOrphanedConversations.mockReturnValue([
        { id: 'orphan1' },
        { id: 'orphan2' },
        { id: 'orphan3' }
      ]);

      const redistributions = agentService.redistributeOrphanedTickets(mockConversationService, 2);

      expect(redistributions).toHaveLength(3);
      expect(mockConversationService.assignConversation).toHaveBeenCalledTimes(3);
      
      redistributions.forEach(r => {
        expect(r.action).toBe('redistributed');
        expect(['agent1', 'agent2']).toContain(r.toAgent);
      });
    });

    it('should respect max tickets per agent limit', () => {
      mockConversationService.getOrphanedConversations.mockReturnValue([
        { id: 'orphan1' },
        { id: 'orphan2' },
        { id: 'orphan3' },
        { id: 'orphan4' },
        { id: 'orphan5' }
      ]);

      const redistributions = agentService.redistributeOrphanedTickets(mockConversationService, 1);

      expect(redistributions).toHaveLength(2); // Only 1 per agent, 2 agents = 2 max
    });

    it('should return empty array when no orphaned tickets', () => {
      mockConversationService.getOrphanedConversations.mockReturnValue([]);

      const redistributions = agentService.redistributeOrphanedTickets(mockConversationService);
      
      expect(redistributions).toHaveLength(0);
      expect(mockConversationService.assignConversation).not.toHaveBeenCalled();
    });
  });

  describe('Data Management', () => {
    it('should clear all data', () => {
      // Add some test data
      agentService.generateAgentDisplayName('agent-123');
      agentService.setAgentOnline('agent-456');
      
      expect(agentService.getAgentCount()).toBeGreaterThan(0);
      expect(agentService.getAgentDisplayName('agent-123')).toBe('Agent One');
      
      // Clear all data
      agentService.clearAllData();
      
      expect(agentService.getAgentCount()).toBe(0);
      expect(agentService.getAgentDisplayName('agent-new')).toBe('Agent One'); // Counter reset
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle agent operations with null conversation service', () => {
      expect(() => {
        agentService.updateAgentPersonalStatus('agent1', 'online', null);
      }).not.toThrow();
      
      expect(() => {
        agentService.setAgentOnline('agent1', 'socket1', null);
      }).not.toThrow();
    });

    it('should handle AFK operations with null conversation service', () => {
      const reassignments = agentService.handleAgentOffline('agent1', null);
      expect(reassignments).toEqual([]);
    });

    it('should handle redistribution with no available agents', () => {
      agentService.clearAllData();
      mockConversationService.getOrphanedConversations.mockReturnValue([{ id: 'orphan1' }]);
      
      const redistributions = agentService.redistributeOrphanedTickets(mockConversationService);
      expect(redistributions).toEqual([]);
    });

    it('should handle setting offline for non-existent agent', () => {
      const result = agentService.setAgentOffline('non-existent');
      expect(result).toBeUndefined();
    });

    it('should handle updating last seen for non-existent agent', () => {
      const result = agentService.updateLastSeen('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('Backwards Compatibility', () => {
    it('should support legacy updateAgentStatus method', () => {
      const agent = agentService.updateAgentStatus('agent1', 'online');
      expect(agent.personalStatus).toBe('online');
    });

    it('should support legacy getActiveAgents method', () => {
      agentService.setAgentOnline('agent1');
      agentService.updateAgentPersonalStatus('agent1', 'online');
      
      const activeAgents = agentService.getActiveAgents();
      const availableAgents = agentService.getAvailableAgents();
      
      expect(activeAgents).toEqual(availableAgents);
    });
  });
});