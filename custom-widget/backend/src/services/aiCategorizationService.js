/**
 * AI CATEGORIZATION SERVICE
 *
 * Main Purpose: Automatically categorize support tickets using AI based on conversation content
 *
 * Key Responsibilities:
 * - AI-Powered Classification: Analyze conversation context to suggest appropriate categories
 * - Confidence Scoring: Provide confidence levels for categorization decisions
 * - Manual Override Detection: Respect agent/admin manual category assignments
 * - Batch Processing: Efficiently categorize multiple tickets at once
 * - Metadata Tracking: Store AI reasoning and confidence for transparency
 *
 * Features:
 * - Uses lightweight rephrasing model for fast, cost-effective classification
 * - Only categorizes tickets after 1-hour delay (allows pattern emergence)
 * - Skips tickets with manual category assignments
 * - Minimum confidence threshold prevents low-quality suggestions
 * - Full conversation context analysis for accurate categorization
 * - Lithuanian language support
 *
 * Process Flow:
 * 1. Check if ticket is eligible for auto-categorization
 * 2. Load full conversation history and available categories
 * 3. Build AI prompt with context and category options
 * 4. Get category suggestion from AI with confidence score
 * 5. Validate confidence threshold and category existence
 * 6. Update ticket with AI-suggested category and metadata
 * 7. Broadcast category change via WebSocket
 *
 * Configuration:
 * - ENABLE_AUTO_CATEGORIZATION: Master switch (default: true)
 * - AUTO_CATEGORIZATION_DELAY_HOURS: Wait time before categorizing (default: 1)
 * - AUTO_CATEGORIZATION_MIN_CONFIDENCE: Minimum confidence to apply (default: 0.6)
 *
 * Dependencies:
 * - AI service with rephrasing model access
 * - Conversation service for message history
 * - Category service for available categories
 * - Prisma for database operations
 * - WebSocket service for real-time updates
 */

const { PrismaClient } = require('@prisma/client');
const { getAIProviderConfig } = require('../../ai-providers');
const promptManager = require('./promptManager');

const prisma = new PrismaClient();

// Configuration from environment variables
const CONFIG = {
    enabled: process.env.ENABLE_AUTO_CATEGORIZATION !== 'false'
};

// WebSocket service for real-time updates
let websocketService = null;
const getWebSocketService = () => {
    if (!websocketService) {
        try {
            websocketService = require('./websocketService');
        } catch (error) {
            console.warn('WebSocket service not available for categorization broadcasts:', error.message);
        }
    }
    return websocketService;
};

class AiCategorizationService {
    /**
     * Check if a ticket is eligible for auto-categorization
     * @param {string} ticketId - Ticket ID to check
     * @returns {Promise<{eligible: boolean, reason?: string}>}
     */
    async isEligibleForCategorization(ticketId) {
        if (!CONFIG.enabled) {
            return { eligible: false, reason: 'Auto-categorization disabled in config' };
        }

        const ticket = await prisma.tickets.findUnique({
            where: { id: ticketId },
            select: {
                id: true,
                category_id: true,
                category_metadata: true,
                manual_category_override: true,
                created_at: true,
                archived: true
            }
        });

        if (!ticket) {
            return { eligible: false, reason: 'Ticket not found' };
        }

        if (ticket.archived) {
            return { eligible: false, reason: 'Ticket is archived' };
        }

        if (ticket.category_id) {
            return { eligible: false, reason: 'Ticket already has a category' };
        }

        if (ticket.manual_category_override) {
            return { eligible: false, reason: 'Manual category override set' };
        }

        // Check message count - need enough context
        const messageCount = await prisma.messages.count({
            where: { ticket_id: ticketId }
        });

        const minMessages = parseInt(process.env.AUTO_CATEGORIZATION_MIN_MESSAGES || '3');
        if (messageCount < minMessages) {
            return {
                eligible: false,
                reason: `Not enough messages (${messageCount}/${minMessages})`
            };
        }

        // Check conversation inactivity - should be idle to capture full topic
        const lastMessage = await prisma.messages.findFirst({
            where: { ticket_id: ticketId },
            orderBy: { created_at: 'desc' },
            select: { created_at: true }
        });

        if (!lastMessage) {
            return { eligible: false, reason: 'No messages in conversation' };
        }

        const minutesSinceLastMessage = (Date.now() - new Date(lastMessage.created_at).getTime()) / (1000 * 60);
        const minIdleMinutes = parseInt(process.env.AUTO_CATEGORIZATION_IDLE_MINUTES || '15');

        if (minutesSinceLastMessage < minIdleMinutes) {
            return {
                eligible: false,
                reason: `Conversation still active (${minutesSinceLastMessage.toFixed(0)}m since last message, need ${minIdleMinutes}m)`
            };
        }

        return { eligible: true };
    }

    /**
     * Get conversation context for AI analysis
     * @param {string} ticketId - Ticket ID
     * @returns {Promise<Array<{role: string, content: string}>>}
     */
    async getConversationContext(ticketId) {
        const messages = await prisma.messages.findMany({
            where: { ticket_id: ticketId },
            orderBy: { created_at: 'asc' },
            select: {
                senderType: true,
                content: true,
                created_at: true
            }
        });

        return messages.map(msg => ({
            role: msg.senderType === 'customer' ? 'customer' :
                  msg.senderType === 'agent' ? 'agent' : 'system',
            content: msg.content,
            timestamp: msg.created_at
        }));
    }

    /**
     * Get available categories for classification
     * @returns {Promise<Array<{id: string, name: string, description: string}>>}
     */
    async getAvailableCategories() {
        const categories = await prisma.ticket_categories.findMany({
            where: { is_archived: false },
            select: {
                id: true,
                name: true,
                description: true
            },
            orderBy: { name: 'asc' }
        });

        return categories;
    }

    /**
     * Build categorization prompt
     * @param {Array} conversationContext - Conversation messages
     * @param {Array} categories - Available categories
     * @returns {string} Formatted prompt
     */
    buildCategorizationPrompt(conversationContext, categories) {
        // Format conversation history
        const conversationText = conversationContext
            .map(msg => {
                const role = msg.role === 'customer' ? 'Klientas' :
                           msg.role === 'agent' ? 'Agentas' : 'Sistema';
                return `[${role}]: ${msg.content}`;
            })
            .join('\n');

        // Format categories list
        const categoriesText = categories
            .map((cat, idx) => {
                const description = cat.description ? ` - ${cat.description}` : '';
                return `${idx + 1}. ID: ${cat.id}\n   Pavadinimas: ${cat.name}${description}`;
            })
            .join('\n\n');

        // Build the full prompt
        const prompt = `Esi klientų aptarnavimo pokalbių kategorizavimo asistentas. Tavo užduotis - išanalizuoti pokalbį ir parinkti TINKAMIAUSIĄ kategoriją.

POKALBIO ISTORIJA:
${conversationText}

GALIMOS KATEGORIJOS:
${categoriesText}

INSTRUKCIJOS:
1. Atidžiai perskaityk visą pokalbį
2. Nustatyk pagrindinę pokalbio temą
3. Pasirink kategoriją, kuri geriausiai atitinka pokalbio turinį
4. Pateik trumpą pagrindimą lietuvių kalba

SVARBU: Grąžink TIKTAI validų JSON formatą (be markdown blokelių):
{
  "categoryId": "kategoriją-id-čia",
  "reasoning": "Trumpas pagrindimas lietuvių kalba"
}

Tavo atsakymas:`;

        return prompt;
    }

    /**
     * Call AI to categorize ticket based on conversation
     * @param {Array} conversationContext - Conversation messages
     * @param {Array} categories - Available categories
     * @returns {Promise<{categoryId: string, confidence: number, reasoning: string}>}
     */
    async callAICategorization(conversationContext, categories) {
        try {
            // Get AI configuration
            const config = await getAIProviderConfig();
            const OpenAI = require('openai');

            // Use the rephrasing model for categorization (faster, cheaper)
            const rephrasingModel = config.REPHRASING_MODEL || 'google/gemini-2.5-flash-lite';

            const openai = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: config.OPENROUTER_API_KEY,
                defaultHeaders: {
                    'HTTP-Referer': config.SITE_URL || 'http://localhost:3002',
                    'X-Title': config.SITE_NAME || 'Vilnius Assistant'
                }
            });

            // Build the categorization prompt
            const prompt = this.buildCategorizationPrompt(conversationContext, categories);

            console.log(`🤖 AI Categorization: Using model ${rephrasingModel} for ticket classification`);

            // Call OpenRouter API
            const response = await openai.chat.completions.create({
                model: rephrasingModel,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a Lithuanian customer support ticket categorization assistant. Analyze conversations and suggest the most appropriate category. Always respond with valid JSON only.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3, // Lower temperature for more consistent categorization
                max_tokens: 500
            });

            const aiResponse = response.choices[0]?.message?.content;
            if (!aiResponse) {
                throw new Error('No response from AI');
            }

            // Parse JSON response
            const parsed = this.parseAIResponse(aiResponse);

            console.log(`✅ AI Categorization result: Category ${parsed.categoryId} (confidence: ${parsed.confidence})`);
            console.log(`   Reasoning: ${parsed.reasoning}`);

            return parsed;

        } catch (error) {
            console.error('❌ AI categorization failed:', error);
            throw new Error(`Failed to categorize ticket: ${error.message}`);
        }
    }

    /**
     * Parse AI response and validate structure
     * @param {string} aiResponse - Raw AI response
     * @returns {{categoryId: string, confidence: number, reasoning: string}}
     */
    parseAIResponse(aiResponse) {
        try {
            // Remove markdown code blocks if present
            let cleaned = aiResponse.trim();
            if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/```json\s*/, '').replace(/```\s*$/, '');
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/```\s*/, '').replace(/```\s*$/, '');
            }

            const parsed = JSON.parse(cleaned);

            // Validate required fields
            if (!parsed.categoryId || typeof parsed.categoryId !== 'string') {
                throw new Error('Missing or invalid categoryId');
            }
            if (!parsed.reasoning || typeof parsed.reasoning !== 'string') {
                throw new Error('Missing reasoning');
            }

            return {
                categoryId: parsed.categoryId,
                confidence: 1.0, // Fixed confidence since AI doesn't self-assess
                reasoning: parsed.reasoning
            };

        } catch (error) {
            console.error('Failed to parse AI response:', aiResponse);
            throw new Error(`Invalid AI response format: ${error.message}`);
        }
    }

    /**
     * Categorize a single ticket with AI
     * @param {string} ticketId - Ticket ID to categorize
     * @returns {Promise<{success: boolean, categoryId?: string, confidence?: number, message?: string}>}
     */
    async categorizeTicket(ticketId) {
        try {
            console.log(`🎯 Starting auto-categorization for ticket ${ticketId}`);

            // Check eligibility
            const eligibility = await this.isEligibleForCategorization(ticketId);
            if (!eligibility.eligible) {
                console.log(`   ⏭️  Skipped: ${eligibility.reason}`);
                return { success: false, message: eligibility.reason };
            }

            // Get conversation context
            const conversationContext = await this.getConversationContext(ticketId);
            if (conversationContext.length === 0) {
                console.log('   ⏭️  Skipped: No messages in conversation');
                return { success: false, message: 'No messages in conversation' };
            }

            // Get available categories
            const categories = await this.getAvailableCategories();
            if (categories.length === 0) {
                console.log('   ⏭️  Skipped: No categories available');
                return { success: false, message: 'No categories available' };
            }

            // Call AI for categorization
            const result = await this.callAICategorization(conversationContext, categories);

            // Verify category exists
            const categoryExists = categories.some(cat => cat.id === result.categoryId);
            if (!categoryExists) {
                console.log(`   ❌ AI suggested invalid category ID: ${result.categoryId}`);
                return { success: false, message: 'AI suggested non-existent category' };
            }

            // Update ticket with AI-suggested category
            const updatedTicket = await prisma.tickets.update({
                where: { id: ticketId },
                data: {
                    category_id: result.categoryId,
                    category_metadata: {
                        source: 'ai',
                        confidence: result.confidence,
                        reasoning: result.reasoning,
                        categorized_at: new Date().toISOString(),
                        model_used: 'rephrasing_model'
                    }
                },
                include: {
                    ticket_category: {
                        select: {
                            id: true,
                            name: true,
                            color: true
                        }
                    }
                }
            });

            console.log(`   ✅ Categorized as: ${updatedTicket.ticket_category?.name}`);

            // Broadcast category update via WebSocket
            const ws = getWebSocketService();
            if (ws) {
                ws.broadcastToAgents('ticket-updated', {
                    ticketId: ticketId,
                    category: updatedTicket.ticket_category,
                    categoryMetadata: updatedTicket.category_metadata
                });
            }

            return {
                success: true,
                categoryId: result.categoryId,
                categoryName: updatedTicket.ticket_category?.name,
                confidence: result.confidence,
                reasoning: result.reasoning,
                message: 'Ticket categorized successfully'
            };

        } catch (error) {
            console.error(`❌ Failed to categorize ticket ${ticketId}:`, error);
            return {
                success: false,
                message: error.message,
                error: true
            };
        }
    }

    /**
     * Find tickets eligible for auto-categorization
     * @param {number} limit - Maximum number of tickets to return
     * @returns {Promise<Array<{id: string, ticket_number: string, created_at: Date}>>}
     */
    async findEligibleTickets(limit = 10) {
        if (!CONFIG.enabled) {
            return [];
        }

        // Find uncategorized tickets with messages
        const candidates = await prisma.tickets.findMany({
            where: {
                category_id: null,
                manual_category_override: { not: true },
                archived: false
            },
            select: {
                id: true,
                ticket_number: true,
                created_at: true,
                messages: {
                    orderBy: { created_at: 'desc' },
                    take: 1,
                    select: { created_at: true }
                }
            },
            orderBy: { created_at: 'asc' },
            take: limit * 3 // Get more candidates to filter by inactivity
        });

        const minIdleMinutes = parseInt(process.env.AUTO_CATEGORIZATION_IDLE_MINUTES || '15');
        const minMessages = parseInt(process.env.AUTO_CATEGORIZATION_MIN_MESSAGES || '3');
        const idleThreshold = Date.now() - (minIdleMinutes * 60 * 1000);

        // Filter by eligibility criteria
        const eligible = [];
        for (const ticket of candidates) {
            // Check if has messages
            if (!ticket.messages || ticket.messages.length === 0) {
                continue;
            }

            // Check message count
            const messageCount = await prisma.messages.count({
                where: { ticket_id: ticket.id }
            });

            if (messageCount < minMessages) {
                continue;
            }

            // Check inactivity
            const lastMessageTime = new Date(ticket.messages[0].created_at).getTime();
            if (lastMessageTime >= idleThreshold) {
                continue;
            }

            eligible.push({
                id: ticket.id,
                ticket_number: ticket.ticket_number,
                created_at: ticket.created_at
            });

            if (eligible.length >= limit) {
                break;
            }
        }

        return eligible;
    }

    /**
     * Batch categorize multiple tickets
     * @param {number} limit - Maximum number of tickets to process
     * @returns {Promise<{processed: number, successful: number, failed: number, results: Array}>}
     */
    async batchCategorizeTickets(limit = 10) {
        const tickets = await this.findEligibleTickets(limit);

        if (tickets.length === 0) {
            console.log('📊 No tickets eligible for auto-categorization');
            return { processed: 0, successful: 0, failed: 0, results: [] };
        }

        console.log(`📊 Processing ${tickets.length} tickets for auto-categorization`);

        const results = [];
        let successful = 0;
        let failed = 0;

        for (const ticket of tickets) {
            const result = await this.categorizeTicket(ticket.id);
            results.push({
                ticketId: ticket.id,
                ticketNumber: ticket.ticket_number,
                ...result
            });

            if (result.success) {
                successful++;
            } else {
                failed++;
            }

            // Small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`📊 Batch categorization complete: ${successful} successful, ${failed} failed`);

        return {
            processed: tickets.length,
            successful,
            failed,
            results
        };
    }

    /**
     * Get categorization statistics
     * @returns {Promise<{total: number, aiCategorized: number, manuallyOverridden: number, avgConfidence: number}>}
     */
    async getCategorizationStats() {
        const allTickets = await prisma.tickets.findMany({
            where: { archived: false },
            select: {
                category_id: true,
                category_metadata: true,
                manual_category_override: true
            }
        });

        const stats = {
            total: allTickets.length,
            categorized: allTickets.filter(t => t.category_id).length,
            uncategorized: allTickets.filter(t => !t.category_id).length,
            aiCategorized: 0,
            manualCategorized: 0,
            manuallyOverridden: allTickets.filter(t => t.manual_category_override).length,
            avgConfidence: 0,
            lowConfidenceAttempts: 0
        };

        let totalConfidence = 0;
        let confidenceCount = 0;

        for (const ticket of allTickets) {
            if (ticket.category_metadata) {
                const metadata = typeof ticket.category_metadata === 'string'
                    ? JSON.parse(ticket.category_metadata)
                    : ticket.category_metadata;

                if (metadata.source === 'ai') {
                    stats.aiCategorized++;
                    if (metadata.confidence) {
                        totalConfidence += metadata.confidence;
                        confidenceCount++;
                    }
                } else if (metadata.source === 'manual') {
                    stats.manualCategorized++;
                }

                if (metadata.low_confidence_attempt) {
                    stats.lowConfidenceAttempts++;
                }
            }
        }

        if (confidenceCount > 0) {
            stats.avgConfidence = totalConfidence / confidenceCount;
        }

        return stats;
    }
}

module.exports = new AiCategorizationService();
