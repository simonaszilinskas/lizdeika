/**
 * Tests for AI Provider abstraction layer
 */
const { createAIProvider, FlowiseProvider, OpenRouterProvider, retryWithBackoff } = require('../../ai-providers');

// Mock fetch globally
global.fetch = jest.fn();

describe('AI Providers', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    describe('createAIProvider', () => {
        it('should create FlowiseProvider when provider is "flowise"', () => {
            const config = {
                FLOWISE_URL: 'http://localhost:3000',
                FLOWISE_CHATFLOW_ID: 'test-id',
                FLOWISE_API_KEY: 'test-key'
            };

            const provider = createAIProvider('flowise', config);
            expect(provider).toBeInstanceOf(FlowiseProvider);
            expect(provider.url).toBe(config.FLOWISE_URL);
            expect(provider.chatflowId).toBe(config.FLOWISE_CHATFLOW_ID);
            expect(provider.apiKey).toBe(config.FLOWISE_API_KEY);
        });

        it('should create OpenRouterProvider when provider is "openrouter"', () => {
            const config = {
                OPENROUTER_API_KEY: 'test-key',
                OPENROUTER_MODEL: 'test-model',
                SYSTEM_PROMPT: 'test prompt',
                SITE_URL: 'http://test.com',
                SITE_NAME: 'Test Site'
            };

            const provider = createAIProvider('openrouter', config);
            expect(provider).toBeInstanceOf(OpenRouterProvider);
            expect(provider.apiKey).toBe(config.OPENROUTER_API_KEY);
            expect(provider.model).toBe(config.OPENROUTER_MODEL);
        });

        it('should throw error for unsupported provider', () => {
            expect(() => createAIProvider('unsupported', {})).toThrow('Unsupported AI provider: unsupported');
        });

        it('should be case insensitive', () => {
            const config = { FLOWISE_URL: 'test', FLOWISE_CHATFLOW_ID: 'test' };
            expect(() => createAIProvider('FLOWISE', config)).not.toThrow();
            expect(() => createAIProvider('OpenRouter', { OPENROUTER_API_KEY: 'test' })).not.toThrow();
        });
    });

    describe('FlowiseProvider', () => {
        let provider;

        beforeEach(() => {
            provider = new FlowiseProvider({
                url: 'http://localhost:3000',
                chatflowId: 'test-chatflow',
                apiKey: 'test-key'
            });
        });

        describe('generateResponse', () => {
            it('should generate response for single message', async () => {
                const mockResponse = {
                    ok: true,
                    json: () => Promise.resolve({ text: 'Test response' })
                };
                fetch.mockResolvedValue(mockResponse);

                const result = await provider.generateResponse('Hello world', 'conv-123');

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3000/api/v1/prediction/test-chatflow',
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer test-key'
                        }),
                        body: expect.stringContaining('Hello world')
                    })
                );
                expect(result).toBe('Test response');
            });

            it('should handle conversation context with Agent: prefixes', async () => {
                const mockResponse = {
                    ok: true,
                    json: () => Promise.resolve({ text: 'Contextual response' })
                };
                fetch.mockResolvedValue(mockResponse);

                const conversationContext = 'Customer: Hello\nAgent: Hi there\nCustomer: I need help';
                await provider.generateResponse(conversationContext, 'conv-123');

                const callArgs = fetch.mock.calls[0][1];
                const body = JSON.parse(callArgs.body);
                expect(body.question).toContain('conversation history');
            });

            it('should throw error on API failure', async () => {
                fetch.mockResolvedValue({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error'
                });

                await expect(provider.generateResponse('test', 'conv-123'))
                    .rejects.toThrow('Flowise API error: 500 Internal Server Error');
            });

            it('should return fallback response when no text in result', async () => {
                fetch.mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve({})
                });

                const result = await provider.generateResponse('test', 'conv-123');
                expect(result).toBe("I apologize, but I couldn't generate a response at this time.");
            });
        });

        describe('healthCheck', () => {
            it('should return true for successful health check', async () => {
                fetch.mockResolvedValue({ ok: true });

                const result = await provider.healthCheck();
                expect(result).toBe(true);
                expect(provider.isHealthy).toBe(true);
            });

            it('should return false for failed health check', async () => {
                fetch.mockResolvedValue({ ok: false });

                const result = await provider.healthCheck();
                expect(result).toBe(false);
                expect(provider.isHealthy).toBe(false);
            });

            it('should handle network errors', async () => {
                fetch.mockRejectedValue(new Error('Network error'));

                const result = await provider.healthCheck();
                expect(result).toBe(false);
                expect(provider.isHealthy).toBe(false);
            });
        });
    });

    describe('OpenRouterProvider', () => {
        let provider;

        beforeEach(() => {
            provider = new OpenRouterProvider({
                apiKey: 'test-key',
                model: 'test-model',
                systemPrompt: 'You are a helpful assistant',
                siteUrl: 'http://test.com',
                siteName: 'Test Site'
            });
        });

        describe('generateResponse', () => {
            it('should generate response for single message', async () => {
                const mockResponse = {
                    ok: true,
                    json: () => Promise.resolve({
                        choices: [{ message: { content: 'AI response' } }]
                    })
                };
                fetch.mockResolvedValue(mockResponse);

                const result = await provider.generateResponse('Hello', 'conv-123');

                expect(fetch).toHaveBeenCalledWith(
                    'https://openrouter.ai/api/v1/chat/completions',
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer test-key',
                            'Content-Type': 'application/json',
                            'HTTP-Referer': 'http://test.com'
                        })
                    })
                );
                expect(result).toBe('AI response');
            });

            it('should parse conversation context correctly', async () => {
                const mockResponse = {
                    ok: true,
                    json: () => Promise.resolve({
                        choices: [{ message: { content: 'Contextual response' } }]
                    })
                };
                fetch.mockResolvedValue(mockResponse);

                const conversationContext = 'Customer: Hello\nAgent: Hi there\nCustomer: Need help';
                await provider.generateResponse(conversationContext, 'conv-123');

                const callArgs = fetch.mock.calls[0][1];
                const body = JSON.parse(callArgs.body);
                expect(body.messages).toHaveLength(4); // system + 3 conversation messages
                expect(body.messages[0].role).toBe('system');
                expect(body.messages[1].role).toBe('user');
                expect(body.messages[1].content).toBe('Hello');
                expect(body.messages[2].role).toBe('assistant');
                expect(body.messages[2].content).toBe('Hi there');
            });

            it('should use runtime system prompt from environment', async () => {
                process.env.SYSTEM_PROMPT = 'Updated system prompt';
                
                const mockResponse = {
                    ok: true,
                    json: () => Promise.resolve({
                        choices: [{ message: { content: 'Response' } }]
                    })
                };
                fetch.mockResolvedValue(mockResponse);

                await provider.generateResponse('Test', 'conv-123');

                const callArgs = fetch.mock.calls[0][1];
                const body = JSON.parse(callArgs.body);
                expect(body.messages[0].content).toBe('Updated system prompt');

                delete process.env.SYSTEM_PROMPT;
            });

            it('should throw error on API failure', async () => {
                fetch.mockResolvedValue({
                    ok: false,
                    status: 401,
                    statusText: 'Unauthorized',
                    text: () => Promise.resolve('Invalid API key')
                });

                await expect(provider.generateResponse('test', 'conv-123'))
                    .rejects.toThrow('OpenRouter API error: 401 Unauthorized - Invalid API key');
            });

            it('should throw error on invalid response format', async () => {
                fetch.mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve({ choices: [] })
                });

                await expect(provider.generateResponse('test', 'conv-123'))
                    .rejects.toThrow('Invalid response format from OpenRouter');
            });
        });
    });

    describe('retryWithBackoff', () => {
        it('should succeed on first attempt', async () => {
            const mockFn = jest.fn().mockResolvedValue('success');
            
            const result = await retryWithBackoff(mockFn, 3, 100);
            
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and eventually succeed', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('First failure'))
                .mockRejectedValueOnce(new Error('Second failure'))
                .mockResolvedValue('success');
            
            const result = await retryWithBackoff(mockFn, 3, 1); // Use 1ms delay for faster tests
            
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(3);
        }, 10000); // Increase timeout

        it('should throw error after max retries exceeded', async () => {
            const error = new Error('Persistent failure');
            const mockFn = jest.fn().mockRejectedValue(error);
            
            await expect(retryWithBackoff(mockFn, 2, 1)).rejects.toThrow('Persistent failure');
            expect(mockFn).toHaveBeenCalledTimes(2);
        }, 10000); // Increase timeout
    });
});