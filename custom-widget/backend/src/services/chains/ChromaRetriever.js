/**
 * Custom ChromaDB Retriever for LangChain
 * 
 * This retriever integrates ChromaDB with LangChain's retrieval system,
 * maintaining compatibility with existing knowledgeService while providing
 * proper LangChain Document objects.
 * 
 * Features:
 * - Integrates with existing ChromaDB and Mistral embeddings
 * - Maintains compatibility with knowledgeService
 * - Returns proper LangChain Document objects
 * - Preserves source attribution and metadata
 * - Supports configurable similarity search
 */

const { BaseRetriever } = require("@langchain/core/retrievers");
const { Document } = require("@langchain/core/documents");
const knowledgeService = require('../knowledgeService');
const { createLogger } = require('../../../utils/logger');
const logger = createLogger('ChromaRetriever');

class ChromaRetriever extends BaseRetriever {
    constructor(options = {}) {
        super(options);
        this.k = options.k || 3;
        this.scoreThreshold = options.scoreThreshold || 0.0;
        this.verbose = options.verbose || false;
    }

    /**
     * Core retrieval method required by BaseRetriever
     * Converts ChromaDB results to LangChain Document objects
     */
    async _getRelevantDocuments(query, runManager) {
        try {
            if (this.verbose) {
                logger.info(`🔍 ChromaRetriever: Searching for "${query}" with k=${this.k}`);
            }

            // Use existing knowledgeService for ChromaDB integration
            const chromaResults = await knowledgeService.searchContext(query, this.k);

            if (!chromaResults || chromaResults.length === 0) {
                if (this.verbose) {
                    logger.info(`📭 ChromaRetriever: No documents found for query "${query}"`);
                }
                return [];
            }

            // Convert ChromaDB results to LangChain Document objects
            const documents = chromaResults.map((result, index) => {
                // Extract and enrich metadata
                const metadata = {
                    // Preserve original metadata
                    ...result.metadata,
                    
                    // Add retrieval-specific metadata
                    similarity_score: result.distance !== undefined ? 1 - result.distance : undefined,
                    retrieval_rank: index,
                    retrieval_query: query,
                    retrieval_timestamp: new Date().toISOString(),
                    
                    // Ensure required fields for source attribution
                    source: result.metadata?.source_document_name || `Document ${index + 1}`,
                    source_url: result.metadata?.source_url || undefined,
                    
                    // Preserve ChromaDB specific fields
                    chroma_id: result.id,
                    chroma_distance: result.distance
                };

                // Filter out results below threshold
                if (this.scoreThreshold > 0 && result.distance > (1 - this.scoreThreshold)) {
                    if (this.verbose) {
                        logger.info(`🚫 ChromaRetriever: Filtered document ${index} (score too low)`);
                    }
                    return null;
                }

                return new Document({
                    pageContent: result.content || '',
                    metadata: metadata
                });
            }).filter(doc => doc !== null); // Remove filtered documents

            if (this.verbose) {
                logger.info(`✅ ChromaRetriever: Retrieved ${documents.length} documents`);
                documents.forEach((doc, i) => {
                    logger.info(`   ${i + 1}. ${doc.metadata.source} (score: ${doc.metadata.similarity_score?.toFixed(3)})`);
                });
            }

            return documents;

        } catch (error) {
            logger.error('🔴 ChromaRetriever Error:', error);
            
            // Notify run manager if available
            if (runManager) {
                await runManager?.handleRetrieverError?.(error, query);
            }
            
            // Return empty array instead of throwing to maintain chain stability
            return [];
        }
    }

    /**
     * Get similar documents with additional metadata
     * Alias for compatibility with existing patterns
     */
    async similaritySearch(query, k = this.k) {
        const oldK = this.k;
        this.k = k;
        const results = await this._getRelevantDocuments(query);
        this.k = oldK;
        return results;
    }

    /**
     * Get statistics about the retriever
     */
    async getStats() {
        try {
            return await knowledgeService.getStats();
        } catch (error) {
            logger.error('ChromaRetriever stats error:', error);
            return { connected: false, error: error.message };
        }
    }

    /**
     * Test retriever connectivity
     */
    async healthCheck() {
        try {
            const stats = await this.getStats();
            return stats.connected === true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Format document for debugging
     */
    _formatDocumentForDebug(doc, index) {
        return {
            rank: index + 1,
            source: doc.metadata.source,
            url: doc.metadata.source_url,
            score: doc.metadata.similarity_score,
            contentLength: doc.pageContent?.length,
            contentPreview: doc.pageContent?.substring(0, 100) + (doc.pageContent?.length > 100 ? '...' : ''),
            metadata: Object.keys(doc.metadata)
        };
    }

    /**
     * Get detailed debug information about retrieval
     */
    async getDetailedResults(query, k = this.k) {
        const oldVerbose = this.verbose;
        this.verbose = true;
        
        const startTime = Date.now();
        const documents = await this.similaritySearch(query, k);
        const endTime = Date.now();
        
        this.verbose = oldVerbose;

        return {
            query: query,
            retrievalTime: endTime - startTime,
            documentsFound: documents.length,
            requestedK: k,
            documents: documents.map((doc, i) => this._formatDocumentForDebug(doc, i)),
            stats: await this.getStats()
        };
    }
}

module.exports = ChromaRetriever;