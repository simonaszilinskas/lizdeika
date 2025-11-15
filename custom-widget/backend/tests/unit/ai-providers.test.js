/**
 * Tests for AI Provider abstraction layer
 */
const { createAIProvider, FlowiseProvider, OpenRouterProvider, AzureOpenAIProvider, retryWithBackoff } = require('../../ai-providers');

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

        it('should create AzureOpenAIProvider when provider is "azure"', () => {
            const config = {
                AZURE_OPENAI_RESOURCE_NAME: 'test-westeurope',
                AZURE_OPENAI_DEPLOYMENT_NAME: 'gpt-4',
                AZURE_OPENAI_API_KEY: 'test-key',
                AZURE_OPENAI_API_VERSION: '2024-10-21',
                SYSTEM_PROMPT: 'test prompt'
            };

            const provider = createAIProvider('azure', config);
            expect(provider).toBeInstanceOf(AzureOpenAIProvider);
            expect(provider.resourceName).toBe(config.AZURE_OPENAI_RESOURCE_NAME);
            expect(provider.deploymentName).toBe(config.AZURE_OPENAI_DEPLOYMENT_NAME);
            expect(provider.apiKey).toBe(config.AZURE_OPENAI_API_KEY);
        });

        it('should create AzureOpenAIProvider when provider is "azureopenai"', () => {
            const config = {
                AZURE_OPENAI_RESOURCE_NAME: 'test-swedencentral',
                AZURE_OPENAI_DEPLOYMENT_NAME: 'gpt-4',
                AZURE_OPENAI_API_KEY: 'test-key'
            };

            const provider = createAIProvider('azureopenai', config);
            expect(provider).toBeInstanceOf(AzureOpenAIProvider);
        });

        it('should throw error for Azure OpenAI without required configuration', () => {
            expect(() => createAIProvider('azure', {})).toThrow(
                'Azure OpenAI requires AZURE_OPENAI_RESOURCE_NAME, AZURE_OPENAI_DEPLOYMENT_NAME, and AZURE_OPENAI_API_KEY to be configured'
            );
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

    describe('AzureOpenAIProvider', () => {
        let provider;

        beforeEach(() => {
            provider = new AzureOpenAIProvider({
                resourceName: 'test-westeurope',
                deploymentName: 'gpt-4',
                apiKey: 'test-api-key-12345',
                apiVersion: '2024-10-21',
                systemPrompt: 'You are a helpful assistant'
            });
        });

        describe('constructor and EU region validation', () => {
            it('should accept EU region resource names', () => {
                const euRegions = [
                    'test-westeurope',
                    'test-northeurope',
                    'test-swedencentral',
                    'test-francecentral',
                    'test-norwayeast',
                    'test-switzerlandnorth',
                    'test-germanywestcentral',
                    'test-uksouth',
                    'test-ukwest'
                ];

                euRegions.forEach(resourceName => {
                    expect(() => {
                        new AzureOpenAIProvider({
                            resourceName,
                            deploymentName: 'gpt-4',
                            apiKey: 'test-key'
                        });
                    }).not.toThrow();
                });
            });

            it('should reject non-EU region resource names', () => {
                const nonEuRegions = [
                    'test-eastus',
                    'test-westus',
                    'test-southeastasia',
                    'test-japaneast',
                    'test-australiaeast'
                ];

                nonEuRegions.forEach(resourceName => {
                    expect(() => {
                        new AzureOpenAIProvider({
                            resourceName,
                            deploymentName: 'gpt-4',
                            apiKey: 'test-key'
                        });
                    }).toThrow(/does not appear to be in an EU region/);
                });
            });

            it('should use default API version if not specified', () => {
                const provider = new AzureOpenAIProvider({
                    resourceName: 'test-westeurope',
                    deploymentName: 'gpt-4',
                    apiKey: 'test-key'
                });

                expect(provider.apiVersion).toBe('2024-10-21');
            });
        });

        describe('buildEndpoint', () => {
            it('should construct correct endpoint URL', () => {
                const endpoint = provider.buildEndpoint();
                expect(endpoint).toBe(
                    'https://test-westeurope.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-10-21'
                );
            });

            it('should use custom API version', () => {
                const customProvider = new AzureOpenAIProvider({
                    resourceName: 'test-westeurope',
                    deploymentName: 'gpt-35-turbo',
                    apiKey: 'test-key',
                    apiVersion: '2025-04-01-preview'
                });

                const endpoint = customProvider.buildEndpoint();
                expect(endpoint).toContain('api-version=2025-04-01-preview');
            });
        });

        describe('generateResponse', () => {
            it('should generate response for single message', async () => {
                const mockResponse = {
                    ok: true,
                    json: () => Promise.resolve({
                        choices: [{ message: { content: 'Azure AI response' } }]
                    })
                };
                fetch.mockResolvedValue(mockResponse);

                const result = await provider.generateResponse('Hello', 'conv-123');

                expect(fetch).toHaveBeenCalledWith(
                    expect.stringContaining('https://test-westeurope.openai.azure.com'),
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'api-key': 'test-api-key-12345',
                            'Content-Type': 'application/json'
                        })
                    })
                );
                expect(result).toBe('Azure AI response');
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
                expect(body.messages).toHaveLength(4);
                expect(body.messages[0].role).toBe('system');
                expect(body.messages[1].role).toBe('user');
                expect(body.messages[1].content).toBe('Hello');
                expect(body.messages[2].role).toBe('assistant');
                expect(body.messages[2].content).toBe('Hi there');
            });

            it('should handle RAG context with single message approach', async () => {
                const mockResponse = {
                    ok: true,
                    json: () => Promise.resolve({
                        choices: [{ message: { content: 'RAG response' } }]
                    })
                };
                fetch.mockResolvedValue(mockResponse);

                const ragContext = 'UŽDUOTIS: Atsakyk į klausimą pagal šią informaciją...';
                await provider.generateResponse(ragContext, 'conv-123');

                const callArgs = fetch.mock.calls[0][1];
                const body = JSON.parse(callArgs.body);
                expect(body.messages).toHaveLength(1);
                expect(body.messages[0].role).toBe('user');
                expect(body.messages[0].content).toContain('UŽDUOTIS:');
            });

            it('should throw error on API failure', async () => {
                fetch.mockResolvedValue({
                    ok: false,
                    status: 401,
                    statusText: 'Unauthorized',
                    text: () => Promise.resolve('Invalid API key')
                });

                await expect(provider.generateResponse('test', 'conv-123'))
                    .rejects.toThrow('Azure OpenAI API error: 401 Unauthorized');
            });

            it('should redact API key from error messages', async () => {
                fetch.mockResolvedValue({
                    ok: false,
                    status: 403,
                    statusText: 'Forbidden',
                    text: () => Promise.resolve('API key test-api-key-12345 is invalid')
                });

                try {
                    await provider.generateResponse('test', 'conv-123');
                    fail('Should have thrown error');
                } catch (error) {
                    expect(error.message).not.toContain('test-api-key-12345');
                    expect(error.message).toContain('***REDACTED***');
                }
            });

            it('should throw error on invalid response format', async () => {
                fetch.mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve({ choices: [] })
                });

                await expect(provider.generateResponse('test', 'conv-123'))
                    .rejects.toThrow('Invalid response format from Azure OpenAI');
            });

            it('should send correct temperature and max_tokens', async () => {
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
                expect(body.temperature).toBe(0.2);
                expect(body.max_tokens).toBe(1000);
            });
        });

        describe('healthCheck', () => {
            it('should return true for successful health check', async () => {
                fetch.mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve({
                        choices: [{ message: { content: 'OK' } }]
                    })
                });

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

            it('should send minimal test request', async () => {
                fetch.mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve({
                        choices: [{ message: { content: 'test' } }]
                    })
                });

                await provider.healthCheck();

                const callArgs = fetch.mock.calls[0][1];
                const body = JSON.parse(callArgs.body);
                expect(body.messages).toEqual([{ role: 'user', content: 'test' }]);
                expect(body.max_tokens).toBe(10);
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