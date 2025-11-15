
/**
 * API Mocks for Testing
 * Mock implementations of backend API endpoints
 */

class APIMocks {
    static setupMocks() {
        // Mock authentication endpoints
        global.fetch = jest.fn().mockImplementation((url, options) => {
            const method = options?.method || 'GET';
            
            // Profile endpoint
            if (url.includes('/api/auth/profile')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        data: {
                            id: 'test-user-123',
                            email: 'test@lizdeika.lt',
                            role: 'agent',
                            firstName: 'Test',
                            lastName: 'User'
                        }
                    })
                });
            }
            
            // Conversations endpoint
            if (url.includes('/api/admin/conversations')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        data: {
                            conversations: [
                                {
                                    id: 'conv-1',
                                    ticketNumber: 'TICKET-001',
                                    status: 'active',
                                    messages: []
                                }
                            ],
                            pagination: { total: 1, page: 1 }
                        }
                    })
                });
            }
            
            // System mode endpoint
            if (url.includes('/api/system/mode')) {
                if (method === 'GET') {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            data: { mode: 'hitl' }
                        })
                    });
                } else if (method === 'POST') {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            data: { mode: options.body ? JSON.parse(options.body).mode : 'hitl' }
                        })
                    });
                }
            }
            
            // Agents endpoint
            if (url.includes('/api/agents/connected')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        agents: [
                            {
                                id: 'agent-1',
                                email: 'agent@lizdeika.lt',
                                status: 'online',
                                personalStatus: 'available'
                            }
                        ]
                    })
                });
            }
            
            // Default error response
            return Promise.resolve({
                ok: false,
                status: 404,
                json: () => Promise.resolve({ error: 'Not found' })
            });
        });
    }
    
    static resetMocks() {
        if (global.fetch.mockReset) {
            global.fetch.mockReset();
        }
    }
}

module.exports = APIMocks;
