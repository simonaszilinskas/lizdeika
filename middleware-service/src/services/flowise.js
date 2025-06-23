const axios = require('axios');

class FlowiseAPI {
    constructor(config) {
        this.baseURL = config.url;
        this.apiKey = config.apiKey;
        this.chatflowId = config.chatflowId;
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async getSuggestion(context) {
        try {
            // Prepare the question with full context
            const question = this.formatContextForAI(context);
            
            const response = await this.client.post(`/api/v1/prediction/${this.chatflowId}`, {
                question: question,
                overrideConfig: {
                    systemMessage: `You are an AI assistant helping customer support agents. 
                    Provide helpful, empathetic responses to customer inquiries. 
                    Keep responses professional and concise.`
                }
            });

            return {
                text: response.data.text,
                confidence: this.calculateConfidence(response.data),
                metadata: response.data.metadata || {}
            };
        } catch (error) {
            console.error('Error getting AI suggestion:', error);
            throw error;
        }
    }

    formatContextForAI(context) {
        let prompt = `Customer Support Ticket:\n\n`;
        
        // Current issue
        prompt += `Current Issue:\n${context.currentIssue}\n\n`;
        
        // Customer history if available
        if (context.customerHistory && context.customerHistory.length > 0) {
            prompt += `Customer History (last 3 interactions):\n`;
            context.customerHistory.slice(0, 3).forEach(conv => {
                prompt += `- ${conv.subject}: ${conv.status}\n`;
            });
            prompt += '\n';
        }
        
        // Metadata
        if (context.metadata) {
            prompt += `Ticket Details:\n`;
            prompt += `- Subject: ${context.metadata.subject}\n`;
            prompt += `- Priority: ${context.metadata.priority || 'Normal'}\n`;
            if (context.metadata.category) {
                prompt += `- Category: ${context.metadata.category.join(', ')}\n`;
            }
        }
        
        prompt += `\nPlease provide a helpful response to address the customer's issue.`;
        
        return prompt;
    }

    calculateConfidence(response) {
        // Simple confidence calculation based on response characteristics
        // In production, this could use more sophisticated metrics
        let confidence = 0.5;
        
        if (response.text && response.text.length > 50) {
            confidence += 0.2;
        }
        
        if (response.sourceDocuments && response.sourceDocuments.length > 0) {
            confidence += 0.2;
        }
        
        // Cap at 0.95 to never be 100% certain
        return Math.min(confidence, 0.95);
    }
}

module.exports = FlowiseAPI;