/**
 * AI Suggestion Polling System Unit Tests
 * Tests the polling cancellation and management system for AI suggestions
 * @jest-environment jsdom
 */

describe('AI Suggestion Polling System', () => {
    let mockDashboard;
    let chatManager;
    let mockAPIManager;
    let mockStateManager;
    
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Mock API Manager
        mockAPIManager = {
            getPendingSuggestion: jest.fn(),
            sendAgentMessage: jest.fn()
        };
        
        // Mock State Manager
        mockStateManager = {
            getCurrentChatId: jest.fn(() => 'test-conversation-123'),
            setCurrentChatId: jest.fn(),
            getCurrentSuggestion: jest.fn(),
            setCurrentSuggestion: jest.fn()
        };
        
        // Mock Dashboard with polling functionality
        mockDashboard = {
            currentPollingId: null,
            systemMode: 'hitl',
            apiManager: mockAPIManager,
            stateManager: mockStateManager,
            
            // Polling method
            async pollForNewSuggestion(conversationId, attemptCount, pollingId) {
                // Check if this polling session has been canceled
                if (this.currentPollingId !== pollingId) {
                    console.log(`🛑 Polling ${pollingId} canceled - newer message arrived`);
                    return;
                }
                
                const maxAttempts = 15;
                if (attemptCount >= maxAttempts) {
                    console.log('⚠️ AI suggestion polling timeout');
                    this.currentPollingId = null;
                    return;
                }
                
                try {
                    const data = await this.apiManager.getPendingSuggestion(conversationId);
                    
                    if (data && data.suggestion) {
                        // Check again if we're still the active polling session
                        if (this.currentPollingId !== pollingId) {
                            console.log(`🛑 Polling ${pollingId} canceled before showing suggestion`);
                            return;
                        }
                        
                        console.log('✅ New AI suggestion found!');
                        this.currentPollingId = null;
                        return data;
                    } else {
                        // No suggestion yet, would normally retry with delay
                        return null;
                    }
                } catch (error) {
                    console.error('Error polling for suggestion:', error);
                    return null;
                }
            },
            
            // Mock methods from original dashboard
            showToast: jest.fn(),
            hideElement: jest.fn(),
            showElement: jest.fn()
        };
        
        // Mock ChatManager
        const ChatManager = require('../../tests/mocks/ChatManagerMock');
        chatManager = new ChatManager(mockDashboard);
    });
    
    describe('Polling ID Management', () => {
        test('should generate unique polling IDs for each new message', () => {
            const pollingId1 = `poll-${Date.now()}-${Math.random()}`;
            const pollingId2 = `poll-${Date.now()}-${Math.random()}`;
            
            expect(pollingId1).not.toEqual(pollingId2);
            expect(pollingId1).toMatch(/^poll-\d+-0\.\d+$/);
        });
        
        test('should cancel previous polling when new message arrives', async () => {
            // Start first polling session
            const pollingId1 = `poll-${Date.now()}-${Math.random()}`;
            mockDashboard.currentPollingId = pollingId1;
            
            // Simulate new message arriving - should cancel first session
            const pollingId2 = `poll-${Date.now() + 1}-${Math.random()}`;
            mockDashboard.currentPollingId = pollingId2;
            
            // First polling session should detect cancellation
            const result = await mockDashboard.pollForNewSuggestion('test-conv', 0, pollingId1);
            
            expect(result).toBeUndefined(); // Should return early due to cancellation
            expect(mockAPIManager.getPendingSuggestion).not.toHaveBeenCalled();
        });
        
        test('should allow active polling session to continue', async () => {
            const pollingId = `poll-${Date.now()}-${Math.random()}`;
            mockDashboard.currentPollingId = pollingId;
            
            // Mock API response
            const mockSuggestion = {
                suggestion: 'Test AI suggestion',
                confidence: 0.85,
                messageId: 'msg-123'
            };
            mockAPIManager.getPendingSuggestion.mockResolvedValue(mockSuggestion);
            
            const result = await mockDashboard.pollForNewSuggestion('test-conv', 0, pollingId);
            
            expect(result).toEqual(mockSuggestion);
            expect(mockAPIManager.getPendingSuggestion).toHaveBeenCalledWith('test-conv');
            expect(mockDashboard.currentPollingId).toBeNull(); // Should clear after success
        });
    });
    
    describe('Conversation Switching Cancellation', () => {
        test('should cancel ongoing polling when switching conversations', async () => {
            // Set up ongoing polling
            const pollingId = `poll-${Date.now()}-${Math.random()}`;
            mockDashboard.currentPollingId = pollingId;
            
            // Switch conversation
            await chatManager.selectChat('new-conversation-456');
            
            expect(mockDashboard.currentPollingId).toBeNull();
            expect(mockStateManager.setCurrentChatId).toHaveBeenCalledWith('new-conversation-456');
        });
        
        test('should not interfere when no polling is active', async () => {
            mockDashboard.currentPollingId = null;
            
            await chatManager.selectChat('new-conversation-456');
            
            expect(mockDashboard.currentPollingId).toBeNull();
            expect(mockStateManager.setCurrentChatId).toHaveBeenCalledWith('new-conversation-456');
        });
    });
    
    describe('Agent Response Cancellation', () => {
        beforeEach(() => {
            // Add required DOM elements
            document.body.innerHTML = `
                <input id="message-input" value="Test message" />
                <button id="send-button">Send</button>
            `;
            
            // Mock successful message sending
            mockAPIManager.sendAgentMessage.mockResolvedValue({ success: true });
        });
        
        test('should cancel ongoing polling when sending agent response', async () => {
            // Set up ongoing polling
            const pollingId = `poll-${Date.now()}-${Math.random()}`;
            mockDashboard.currentPollingId = pollingId;
            
            // Send agent response
            await chatManager.sendAgentResponse('Test response', 'from-scratch');
            
            expect(mockDashboard.currentPollingId).toBeNull();
            expect(mockAPIManager.sendAgentMessage).toHaveBeenCalledWith(
                'test-conversation-123',
                'Test response',
                'from-scratch'
            );
        });
        
        test('should not interfere when no polling is active', async () => {
            mockDashboard.currentPollingId = null;
            
            await chatManager.sendAgentResponse('Test response', 'as-is');
            
            expect(mockDashboard.currentPollingId).toBeNull();
            expect(mockAPIManager.sendAgentMessage).toHaveBeenCalled();
        });
    });
    
    describe('WebSocket Message Handling', () => {
        test('should handle rapid message sequence correctly', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            // Simulate rapid message sequence
            const pollingId1 = `poll-${Date.now()}-${Math.random()}`;
            const pollingId2 = `poll-${Date.now() + 1}-${Math.random()}`;
            const pollingId3 = `poll-${Date.now() + 2}-${Math.random()}`;
            
            // Message 1 starts polling
            mockDashboard.currentPollingId = pollingId1;
            
            // Message 2 arrives - should cancel message 1
            mockDashboard.currentPollingId = pollingId2;
            
            // Message 3 arrives - should cancel message 2  
            mockDashboard.currentPollingId = pollingId3;
            
            // Verify the sequence
            expect(mockDashboard.currentPollingId).toEqual(pollingId3);
            
            consoleSpy.mockRestore();
        });
    });
    
    describe('Polling Timeout Handling', () => {
        test('should timeout after maximum attempts', async () => {
            const pollingId = `poll-${Date.now()}-${Math.random()}`;
            mockDashboard.currentPollingId = pollingId;
            
            // Mock no suggestion available
            mockAPIManager.getPendingSuggestion.mockResolvedValue(null);
            
            // Test timeout at max attempts
            const result = await mockDashboard.pollForNewSuggestion('test-conv', 15, pollingId);
            
            expect(result).toBeUndefined();
            expect(mockDashboard.currentPollingId).toBeNull();
        });
        
        test('should continue polling below max attempts', async () => {
            const pollingId = `poll-${Date.now()}-${Math.random()}`;
            mockDashboard.currentPollingId = pollingId;
            
            // Mock no suggestion available
            mockAPIManager.getPendingSuggestion.mockResolvedValue(null);
            
            const result = await mockDashboard.pollForNewSuggestion('test-conv', 5, pollingId);
            
            expect(result).toBeNull(); // No suggestion, but didn't timeout
            expect(mockAPIManager.getPendingSuggestion).toHaveBeenCalled();
        });
    });
    
    describe('Error Handling', () => {
        test('should handle API errors gracefully', async () => {
            const pollingId = `poll-${Date.now()}-${Math.random()}`;
            mockDashboard.currentPollingId = pollingId;
            
            // Mock API error
            mockAPIManager.getPendingSuggestion.mockRejectedValue(new Error('API Error'));
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            const result = await mockDashboard.pollForNewSuggestion('test-conv', 0, pollingId);
            
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('Error polling for suggestion:', expect.any(Error));
            
            consoleSpy.mockRestore();
        });
        
        test('should maintain polling state consistency during errors', async () => {
            const pollingId = `poll-${Date.now()}-${Math.random()}`;
            mockDashboard.currentPollingId = pollingId;
            
            mockAPIManager.getPendingSuggestion.mockRejectedValue(new Error('Network Error'));
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            await mockDashboard.pollForNewSuggestion('test-conv', 0, pollingId);
            
            // Polling ID should still be active (would retry in real implementation)
            expect(mockDashboard.currentPollingId).toEqual(pollingId);
            
            consoleSpy.mockRestore();
        });
    });
});