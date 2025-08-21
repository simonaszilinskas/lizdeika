/**
 * Unit tests for AI Service
 * Tests AI provider management, health checks, and response generation
 */

// Mock dependencies before requiring the service
jest.mock('../../ai-providers', () => ({
  createAIProvider: jest.fn(),
  retryWithBackoff: jest.fn()
}));

jest.mock('../../src/services/conversationService', () => ({
  addMessage: jest.fn()
}));

const aiService = require('../../src/services/aiService');
const { createAIProvider, retryWithBackoff } = require('../../ai-providers');
const conversationService = require('../../src/services/conversationService');

// Mock provider object
const mockProvider = {
  generateResponse: jest.fn(),
  healthCheck: jest.fn(),
  isHealthy: true,
  lastHealthCheck: new Date()
};

// Test constants
const conversationId = 'test-conv-123';
const conversationContext = 'Customer: Hello, I need help with school registration';

describe('AIService', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset environment
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    
    // Mock successful provider creation
    createAIProvider.mockReturnValue(mockProvider);
    mockProvider.generateResponse.mockResolvedValue('Test AI response');
    mockProvider.healthCheck.mockResolvedValue(true);
    mockProvider.isHealthy = true;
    mockProvider.lastHealthCheck = new Date();
    
    // Mock retry utility
    retryWithBackoff.mockImplementation(async (fn) => await fn());
    
    // Mock conversation service
    conversationService.addMessage.mockResolvedValue(true);
    
    // Clear any cached provider
    jest.resetModules();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.AI_PROVIDER;
    delete process.env.OPENROUTER_API_KEY;
  });

  describe('AI Provider Management', () => {
    it('should initialize AI provider successfully', () => {
      const provider = aiService.getAIProvider();
      
      expect(createAIProvider).toHaveBeenCalledWith('openrouter', process.env);
      expect(provider).toBe(mockProvider);
    });

    it('should use default provider when none specified', () => {
      delete process.env.AI_PROVIDER;
      
      const provider = aiService.getAIProvider();
      
      expect(createAIProvider).toHaveBeenCalledWith('flowise', process.env);
    });

    it('should return null when provider creation fails', () => {
      createAIProvider.mockImplementation(() => {
        throw new Error('Provider init failed');
      });
      
      const provider = aiService.getAIProvider();
      
      expect(provider).toBeNull();
    });

    it('should switch providers successfully', async () => {
      const newMockProvider = { ...mockProvider };
      createAIProvider.mockReturnValue(newMockProvider);
      
      const result = await aiService.switchProvider('flowise');
      
      expect(createAIProvider).toHaveBeenCalledWith('flowise', process.env);
      expect(result).toBe(newMockProvider);
    });

    it('should handle provider switch failure', async () => {
      createAIProvider.mockImplementation(() => {
        throw new Error('Switch failed');
      });
      
      await expect(aiService.switchProvider('invalid-provider')).rejects.toThrow('Switch failed');
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy provider status', async () => {
      mockProvider.healthCheck.mockResolvedValue(true);
      
      const health = await aiService.getProviderHealth();
      
      expect(health.provider).toBe('openrouter');
      expect(health.configured).toBe(true);
      expect(health.healthy).toBe(true);
      expect(health.lastCheck).toBeDefined();
    });

    it('should report unhealthy provider status', async () => {
      mockProvider.healthCheck.mockResolvedValue(false);
      
      const health = await aiService.getProviderHealth();
      
      expect(health.healthy).toBe(false);
    });

    it('should report unconfigured provider', async () => {
      // Force provider to be null by making creation fail
      createAIProvider.mockReturnValue(null);
      
      const health = await aiService.getProviderHealth();
      
      expect(health.configured).toBe(false);
      expect(health.healthy).toBe(false);
      expect(health.error).toBe('AI provider failed to initialize');
    });
  });

  describe('Response Generation', () => {
    it('should generate AI response successfully without RAG', async () => {
      const response = await aiService.generateAISuggestion(conversationId, conversationContext, false);
      
      expect(mockProvider.generateResponse).toHaveBeenCalledWith(conversationContext, conversationId);
      expect(response).toBe('Test AI response');
      expect(conversationService.addMessage).toHaveBeenCalled();
    });

    it('should return fallback response when no provider available', async () => {
      createAIProvider.mockReturnValue(null);
      
      const response = await aiService.generateAISuggestion(conversationId, conversationContext);
      
      expect(response).toContain('techninių sunkumų'); // Lithuanian fallback
      expect(conversationService.addMessage).toHaveBeenCalled();
    });

    it('should return fallback response when provider is unhealthy', async () => {
      mockProvider.isHealthy = false;
      
      const response = await aiService.generateAISuggestion(conversationId, conversationContext);
      
      expect(response).toContain('techninių sunkumų'); // Lithuanian fallback
      expect(conversationService.addMessage).toHaveBeenCalled();
    });

    it('should use different fallback responses based on context length', async () => {
      createAIProvider.mockReturnValue(null);
      
      const shortContext = 'Hello';
      const longerContext = 'Hello\nCustomer: How are you?\nAssistant: Fine';
      
      const response1 = await aiService.generateAISuggestion(conversationId, shortContext);
      const response2 = await aiService.generateAISuggestion(conversationId, longerContext);
      
      // Should get different fallback responses
      expect(response1).not.toBe(response2);
    });

    it('should handle provider response errors with retry', async () => {
      mockProvider.generateResponse
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('Retry success');
      
      retryWithBackoff.mockImplementation(async (fn) => {
        try {
          return await fn();
        } catch (error) {
          // Simulate one retry
          return await fn();
        }
      });
      
      const response = await aiService.generateAISuggestion(conversationId, conversationContext, false);
      
      expect(response).toBe('Retry success');
    });

    it('should return fallback after all retries fail', async () => {
      mockProvider.generateResponse.mockRejectedValue(new Error('Persistent error'));
      retryWithBackoff.mockRejectedValue(new Error('All retries failed'));
      
      const response = await aiService.generateAISuggestion(conversationId, conversationContext, false);
      
      expect(response).toContain('techninių sunkumų'); // Lithuanian fallback
      expect(mockProvider.isHealthy).toBe(false); // Should mark as unhealthy
    });

    it('should perform health check when stale', async () => {
      const oldTime = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
      mockProvider.lastHealthCheck = oldTime;
      
      await aiService.generateAISuggestion(conversationId, conversationContext, false);
      
      expect(mockProvider.healthCheck).toHaveBeenCalled();
    });

    it('should skip RAG for flowise provider', async () => {
      process.env.AI_PROVIDER = 'flowise';
      
      const response = await aiService.generateAISuggestion(conversationId, conversationContext, true);
      
      expect(mockProvider.generateResponse).toHaveBeenCalledWith(conversationContext, conversationId);
      expect(response).toBe('Test AI response');
    });
  });

  describe('Debug Information Storage', () => {
    it('should store debug information for responses', async () => {
      await aiService.generateAISuggestion(conversationId, conversationContext, false);
      
      expect(conversationService.addMessage).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({
          sender: 'system',
          content: '',
          metadata: expect.objectContaining({
            debugInfo: expect.any(Object),
            systemMessage: true,
            debugOnly: true
          })
        })
      );
    });

    it('should handle debug storage errors gracefully', async () => {
      conversationService.addMessage.mockRejectedValue(new Error('Storage failed'));
      
      // Should not throw despite debug storage failure
      const response = await aiService.generateAISuggestion(conversationId, conversationContext, false);
      
      expect(response).toBe('Test AI response');
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing environment variables', () => {
      delete process.env.AI_PROVIDER;
      delete process.env.OPENROUTER_API_KEY;
      
      const provider = aiService.getAIProvider();
      
      expect(createAIProvider).toHaveBeenCalledWith('flowise', process.env);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty conversation context', async () => {
      const response = await aiService.generateAISuggestion(conversationId, '', false);
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });

    it('should handle very long conversation context', async () => {
      const longContext = 'Customer: ' + 'A'.repeat(1000);
      
      const response = await aiService.generateAISuggestion(conversationId, longContext, false);
      
      expect(response).toBeDefined();
    });

    it('should handle malformed conversation context', async () => {
      const malformedContext = 'Invalid format without proper structure';
      
      const response = await aiService.generateAISuggestion(conversationId, malformedContext, false);
      
      expect(response).toBeDefined();
    });
  });

  describe('Provider-Specific Behaviors', () => {
    it('should use provider-specific response handling', async () => {
      mockProvider.generateResponse.mockResolvedValue(null); // Empty response
      
      const response = await aiService.generateAISuggestion(conversationId, conversationContext, false);
      
      expect(response).toBe('I apologize, but I couldn\'t generate a response at this time.');
    });

    it('should maintain provider health state correctly', async () => {
      // Start healthy
      expect(mockProvider.isHealthy).toBe(true);
      
      // Successful response should keep healthy
      await aiService.generateAISuggestion(conversationId, conversationContext, false);
      expect(mockProvider.isHealthy).toBe(true);
      
      // Failed response should mark unhealthy
      mockProvider.generateResponse.mockRejectedValue(new Error('Test error'));
      retryWithBackoff.mockRejectedValue(new Error('All retries failed'));
      
      await aiService.generateAISuggestion(conversationId, conversationContext, false);
      expect(mockProvider.isHealthy).toBe(false);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(3).fill().map((_, i) => 
        aiService.generateAISuggestion(`conv-${i}`, `Context ${i}`, false)
      );
      
      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response).toBe('Test AI response');
      });
      expect(mockProvider.generateResponse).toHaveBeenCalledTimes(3);
    });
  });
});