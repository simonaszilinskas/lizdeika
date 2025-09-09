/**
 * Mock ChatManager for testing AI suggestion polling functionality
 */

class ChatManagerMock {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.stateManager = dashboard.stateManager;
        this.apiManager = dashboard.apiManager;
    }

    /**
     * Mock selectChat method with polling cancellation
     */
    async selectChat(conversationId) {
        // Cancel any ongoing AI suggestion polling when switching conversations
        if (this.dashboard.currentPollingId) {
            console.log('🛑 Canceling AI suggestion polling when switching conversations');
            this.dashboard.currentPollingId = null;
        }
        
        this.stateManager.setCurrentChatId(conversationId);
        
        // Mock loading messages
        return Promise.resolve();
    }

    /**
     * Mock sendAgentResponse method with polling cancellation
     */
    async sendAgentResponse(message, suggestionAction) {
        if (!this.stateManager.getCurrentChatId()) return;
        
        // Cancel any ongoing AI suggestion polling when sending a message
        if (this.dashboard.currentPollingId) {
            console.log('🛑 Canceling AI suggestion polling when sending agent response');
            this.dashboard.currentPollingId = null;
        }
        
        // Mock sending message
        const response = await this.apiManager.sendAgentMessage(
            this.stateManager.getCurrentChatId(), 
            message, 
            suggestionAction
        );
        
        return response;
    }

    /**
     * Mock hideAISuggestion method
     */
    hideAISuggestion() {
        // Mock implementation
        console.log('Hiding AI suggestion');
    }

    /**
     * Mock showAISuggestion method
     */
    showAISuggestion(suggestion, confidence, metadata = {}) {
        // Mock implementation
        console.log('Showing AI suggestion:', suggestion);
    }

    /**
     * Mock showAISuggestionLoading method
     */
    showAISuggestionLoading() {
        // Mock implementation
        console.log('Showing AI suggestion loading state');
    }
}

module.exports = ChatManagerMock;