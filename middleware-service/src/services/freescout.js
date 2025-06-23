const axios = require('axios');

class FreescoutAPI {
    constructor(config) {
        this.baseURL = config.url;
        this.apiKey = config.apiKey;
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    async getConversation(conversationId) {
        try {
            const response = await this.client.get(`/api/conversations/${conversationId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching conversation:', error);
            throw error;
        }
    }

    async getCustomer(customerId) {
        try {
            const response = await this.client.get(`/api/customers/${customerId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching customer:', error);
            throw error;
        }
    }

    async addNote(conversationId, note) {
        try {
            const response = await this.client.post(`/api/conversations/${conversationId}/notes`, {
                body: note.body,
                type: note.type || 'note'
            });
            return response.data;
        } catch (error) {
            console.error('Error adding note:', error);
            throw error;
        }
    }

    async createDraftReply(conversationId, reply) {
        try {
            const response = await this.client.post(`/api/conversations/${conversationId}/drafts`, {
                body: reply.body,
                type: 'reply'
            });
            return response.data;
        } catch (error) {
            console.error('Error creating draft:', error);
            throw error;
        }
    }

    verifyWebhookSignature(payload, signature, secret) {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
        return signature === expectedSignature;
    }
}

module.exports = FreescoutAPI;