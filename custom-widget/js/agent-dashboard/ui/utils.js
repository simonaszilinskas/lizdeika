/**
 * AGENT DASHBOARD UTILITIES
 * Pure utility functions for agent dashboard operations
 * 
 * These functions are extracted from the monolithic agent-dashboard.js
 * to improve maintainability and testability.
 * 
 * @fileoverview Utility functions for date formatting, HTML escaping, 
 * CSS class generation, and UI helpers
 */

/**
 * Format date for conversation display
 * Today: show time, yesterday/few days: "X days ago", older: full date
 * 
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 * 
 * @example
 * formatConversationDate('2025-01-15T10:30:00Z') // "10:30" (if today)
 * formatConversationDate('2025-01-14T10:30:00Z') // "Yesterday" (if yesterday)
 * formatConversationDate('2025-01-10T10:30:00Z') // "5 days ago"
 */
export function formatConversationDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        // Today - show time
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        // Yesterday
        return 'Yesterday';
    } else if (diffDays <= 7) {
        // Few days ago
        return `${diffDays} days ago`;
    } else {
        // Older - show date in current format
        return date.toLocaleDateString();
    }
}

/**
 * Escape HTML to prevent XSS attacks
 * Uses DOM API for safe HTML escaping
 * 
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 * 
 * @example
 * escapeHtml('<script>alert("xss")</script>') // "&lt;script&gt;alert(\"xss\")&lt;/script&gt;"
 */
export function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get display name for agent from agent object
 * Handles various agent ID formats and fallbacks
 * 
 * @param {Object} agent - Agent object with id and optional name
 * @param {string} agent.id - Agent identifier
 * @param {string} [agent.name] - Optional agent display name
 * @returns {string} Formatted display name
 * 
 * @example
 * getAgentDisplayName({id: 'agent-abc123', name: 'John Doe'}) // "John Doe"
 * getAgentDisplayName({id: 'agent-abc123'}) // "Agent ABC1"
 */
export function getAgentDisplayName(agent) {
    // If agent has a name property, use it
    if (agent.name) {
        return agent.name;
    }
    
    // Extract a readable part from agent ID
    const idParts = agent.id.split('-');
    if (idParts.length > 1) {
        const suffix = idParts[1];
        // Create a more readable name from the suffix
        return `Agent ${suffix.substring(0, 4).toUpperCase()}`;
    }
    
    // Fallback to truncated ID
    return `Agent ${agent.id.substring(6, 12)}`;
}

/**
 * Get CSS classes for queue item based on status
 * Handles priority styling for different conversation states
 * 
 * @param {boolean} isActive - Whether conversation is currently selected
 * @param {boolean} needsResponse - Whether conversation needs a response
 * @param {boolean} isAssignedToMe - Whether assigned to current agent
 * @param {boolean} isUnassigned - Whether conversation is unassigned
 * @param {boolean} isUnseen - Whether conversation has unseen messages
 * @returns {string} CSS classes string
 */
export function getQueueItemCssClass(isActive, needsResponse, isAssignedToMe, isUnassigned, isUnseen) {
    if (isActive) return 'active-chat border-indigo-300 bg-indigo-50';
    
    // UNSEEN + MINE: Clearest/most prominent (bright red with thick border)
    if (isUnseen && isAssignedToMe) {
        return 'bg-red-100 border-red-400 hover:bg-red-200 border-l-4 border-l-red-600 shadow-lg ring-2 ring-red-200';
    }
    
    // MINE: Blue
    if (isAssignedToMe) {
        return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
    }
    
    // UNSEEN + NOBODY'S: Red accent on white
    if (isUnseen && isUnassigned) {
        return 'bg-white border-red-300 hover:bg-red-50 border-l-4 border-l-red-500 shadow-md';
    }
    
    // NOBODY'S: Classic white
    if (isUnassigned) {
        return 'bg-white border-gray-200 hover:bg-gray-50';
    }
    
    // UNSEEN + SOMEBODY'S: Red accent on light grey
    if (isUnseen) {
        return 'bg-gray-100 border-red-300 hover:bg-gray-200 border-l-2 border-l-red-400';
    }
    
    // SOMEBODY'S: Light grey
    return 'bg-gray-100 border-gray-300 hover:bg-gray-200';
}

/**
 * Get status label for queue item
 * Returns appropriate status text based on conversation state
 * 
 * @param {boolean} needsResponse - Whether conversation needs a response
 * @param {boolean} isAssignedToMe - Whether assigned to current agent
 * @param {boolean} isUnassigned - Whether conversation is unassigned
 * @param {boolean} isUnseen - Whether conversation has unseen messages
 * @param {Object} conv - Conversation object (for assigned agent lookup)
 * @param {Map} connectedAgents - Map of connected agents (for display name lookup)
 * @returns {string} Status label text
 */
export function getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned, isUnseen, conv, connectedAgents) {
    if (needsResponse && isAssignedToMe) return 'NEEDS REPLY';
    if (isUnseen && isUnassigned) return 'UNSEEN';
    if (needsResponse) return 'NEW MESSAGE';
    if (isAssignedToMe) return 'MINE';
    if (isUnassigned) return 'UNASSIGNED';
    
    if (conv && conv.assignedAgent && connectedAgents) {
        const agent = connectedAgents.get(conv.assignedAgent);
        if (agent) {
            return getAgentDisplayName(agent).replace('Agent ', '');
        }
        return conv.assignedAgent.substring(0, 8);
    }
    
    return 'ASSIGNED';
}

/**
 * Get status CSS classes for queue item
 * Returns CSS classes for status badge styling
 * 
 * @param {boolean} needsResponse - Whether conversation needs a response
 * @param {boolean} isAssignedToMe - Whether assigned to current agent
 * @param {boolean} isUnassigned - Whether conversation is unassigned  
 * @param {boolean} isUnseen - Whether conversation has unseen messages
 * @returns {string} CSS classes for status badge
 */
export function getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned, isUnseen) {
    // High priority states with animation
    if (isUnseen && isAssignedToMe) return 'bg-red-600 text-white font-bold animate-pulse';
    if (isUnseen && isUnassigned) return 'bg-red-600 text-white font-bold';
    if (isUnseen) return 'bg-red-500 text-white font-medium';
    
    // Medium priority states
    if (needsResponse && isAssignedToMe) return 'bg-blue-600 text-white font-medium';
    if (isAssignedToMe) return 'bg-blue-100 text-blue-700';
    if (isUnassigned) return 'bg-gray-600 text-white text-xs';
    
    // Default assigned state
    return 'bg-gray-100 text-gray-600 text-xs';
}

/**
 * Get unread message count for conversation
 * Calculates unread count based on conversation state
 * 
 * @param {Object} conv - Conversation object
 * @param {boolean} isAssignedToMe - Whether assigned to current agent
 * @returns {number} Number of unread messages
 */
export function getUnreadMessageCount(conv, isAssignedToMe) {
    // For conversations assigned to me, count unseen messages
    if (isAssignedToMe && conv.lastMessage && conv.lastMessage.metadata) {
        // Check if conversation is unseen using same logic as conversationIsUnseen
        if (conv.lastMessage.metadata.unseenByAgents) {
            return 1; // Simple indicator for now
        }
    }
    
    // For unassigned conversations, show if unseen
    if (!conv.assignedAgent && conv.lastMessage && conv.lastMessage.metadata && conv.lastMessage.metadata.unseenByAgents) {
        return 1;
    }
    
    return 0;
}

/**
 * Get urgency icon for conversation (simplified - no user icons)
 * Returns HTML string for urgency indicator
 * 
 * @param {boolean} isUnseen - Whether conversation has unseen messages
 * @param {boolean} needsResponse - Whether conversation needs a response
 * @param {boolean} isAssignedToMe - Whether assigned to current agent
 * @returns {string} HTML string for urgency icon
 */
export function getUrgencyIcon(isUnseen, needsResponse, isAssignedToMe) {
    // Only show urgent indicators, no regular assignment icons
    if (isUnseen && isAssignedToMe) {
        return '<i class="fas fa-exclamation-triangle text-red-600 animate-pulse" title="Urgent: Unseen message assigned to you!"></i>';
    }
    if (isUnseen) {
        return '<i class="fas fa-exclamation-circle text-red-500" title="New unseen message"></i>';
    }
    
    // No icons for regular states - rely on colors instead
    return '';
}

/**
 * Get priority animation class
 * Returns CSS animation classes for high-priority items
 * 
 * @param {boolean} isUnseen - Whether conversation has unseen messages
 * @param {boolean} needsResponse - Whether conversation needs a response
 * @param {boolean} isAssignedToMe - Whether assigned to current agent
 * @returns {string} CSS animation class
 */
export function getPriorityAnimationClass(isUnseen, needsResponse, isAssignedToMe) {
    if (isUnseen && isAssignedToMe) {
        return 'animate-pulse'; // Most urgent
    }
    return '';
}

/**
 * Get time-based urgency indicator
 * Returns HTML for time-based urgency warnings
 * 
 * @param {Object} conv - Conversation object
 * @param {function} conversationIsUnseenFn - Function to check if conversation is unseen
 * @returns {string} HTML string for time urgency indicator
 */
export function getTimeUrgencyIndicator(conv, conversationIsUnseenFn) {
    if (!conv.lastMessage || !conv.lastMessage.timestamp) {
        return '';
    }

    const now = new Date();
    const lastMessageTime = new Date(conv.lastMessage.timestamp);
    const timeDiff = now - lastMessageTime;
    const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
    
    if (conversationIsUnseenFn && conversationIsUnseenFn(conv)) {
        if (hoursAgo >= 2) {
            return '<i class="fas fa-clock text-red-500 animate-pulse" title="Unseen for over 2 hours!"></i>';
        } else if (hoursAgo >= 1) {
            return '<i class="fas fa-clock text-orange-500" title="Unseen for over 1 hour"></i>';
        }
    }
    
    return '';
}

/**
 * Get CSS classes for message bubble
 * Returns appropriate styling based on message sender type
 * 
 * @param {boolean} isCustomer - Whether message is from customer
 * @param {boolean} isAI - Whether message is from AI
 * @param {boolean} isSystem - Whether message is system message
 * @param {Object} [msg] - Message object (unused but kept for compatibility)
 * @returns {string} CSS classes for message bubble
 */
export function getMessageBubbleCss(isCustomer, isAI, isSystem, msg = null) {
    const baseClass = 'px-4 py-3 rounded-2xl shadow-sm max-w-full break-words';
    
    if (isCustomer) return `${baseClass} bg-white border border-gray-200 text-gray-800`;
    if (isAI) return `${baseClass} bg-purple-50 border border-purple-200 text-purple-900`;
    if (isSystem) return `${baseClass} bg-yellow-50 border border-yellow-200 text-yellow-900`;
    
    // Standard styling for all agent messages - no special color coding needed
    return `${baseClass} bg-indigo-600 text-white`;
}

/**
 * Get sender label for message
 * Returns appropriate sender label with response type attribution
 * 
 * @param {boolean} isAI - Whether message is from AI
 * @param {boolean} isAgent - Whether message is from agent
 * @param {boolean} isSystem - Whether message is system message
 * @param {Object} [msg] - Message object with optional metadata
 * @returns {string} Sender label text
 */
export function getMessageSenderLabel(isAI, isAgent, isSystem, msg = null) {
    if (isAI) return 'AI Assistant';
    if (isSystem) return 'System';
    if (isAgent && msg && msg.metadata && msg.metadata.responseAttribution) {
        const attr = msg.metadata.responseAttribution;
        let label = attr.respondedBy || 'Agent';
        
        // Add response type annotation
        if (attr.responseType === 'autopilot') {
            return label; // Just "Autopilot" without redundant (autopilot)
        } else if (attr.responseType === 'as-is') {
            return `${label} (as-is)`;
        } else if (attr.responseType === 'edited') {
            return `${label} (edited)`;
        } else if (attr.responseType === 'from-scratch' || attr.responseType === 'custom') {
            return `${label} (custom)`;
        }
        
        return label;
    }
    if (isAgent) return 'You';
    return 'Customer';
}

/**
 * Format debug data preview for display
 * Creates concise preview of debug data objects
 * 
 * @param {any} data - Debug data to format
 * @returns {string} Formatted preview string
 */
export function formatDebugPreview(data) {
    if (!data) return 'No data';
    
    if (typeof data === 'string') {
        return data.length > 100 ? data.substring(0, 100) + '...' : data;
    }
    
    if (typeof data === 'object') {
        const keys = Object.keys(data);
        const keyCount = keys.length;
        
        if (keyCount === 0) return 'Empty object';
        
        // Show key highlights based on the data structure
        const highlights = [];
        
        // General fields
        if (data.provider) highlights.push(`Provider: ${data.provider}`);
        if (data.status) highlights.push(`Status: ${data.status}`);
        if (data.enabled !== undefined) highlights.push(`Enabled: ${data.enabled}`);
        if (data.successful !== undefined) highlights.push(`Success: ${data.successful}`);
        if (data.error) highlights.push(`Error: ${data.error}`);
        
        // LLM-specific fields
        if (data.model) highlights.push(`Model: ${data.model}`);
        if (data.temperature !== undefined) highlights.push(`Temp: ${data.temperature}`);
        if (data.formattedPrompt) highlights.push(`Prompt: ${data.formattedPrompt.substring(0, 50)}...`);
        if (data.finalPrompt) highlights.push(`Final Prompt: ${data.finalPrompt.substring(0, 50)}...`);
        if (data.rephrasedQuery) highlights.push(`Rephrased: "${data.rephrasedQuery}"`);
        if (data.extractedContent) highlights.push(`Response: ${data.extractedContent.substring(0, 50)}...`);
        
        // Prompt management fields (Langfuse integration)
        if (data.promptSource) highlights.push(`Prompt Source: ${data.promptSource}`);
        if (data.promptVersion) highlights.push(`Version: v${data.promptVersion}`);
        if (data.originalQuery) highlights.push(`Original: "${data.originalQuery}"`);
        if (data.improvement !== undefined) highlights.push(`Improved: ${data.improvement ? 'Yes' : 'No'}`);
        if (data.action) highlights.push(`Action: ${data.action}`);
        if (data.hasHistory !== undefined) highlights.push(`Has History: ${data.hasHistory}`);
        if (data.promptType) highlights.push(`Type: ${data.promptType}`);
        
        // RAG-specific fields
        if (data.contextsUsed) highlights.push(`Contexts: ${data.contextsUsed}`);
        if (data.sources && Array.isArray(data.sources)) highlights.push(`Sources: ${data.sources.length}`);
        if (data.retrievedDocuments !== undefined) highlights.push(`Documents: ${data.retrievedDocuments}`);
        if (data.requestedDocuments !== undefined) highlights.push(`Requested: ${data.requestedDocuments}`);
        if (data.searchQuery) highlights.push(`Search: "${data.searchQuery}"`);
        if (data.documentsMetadata && Array.isArray(data.documentsMetadata)) {
            highlights.push(`Metadata: ${data.documentsMetadata.length} entries`);
        }
        if (data.documentsUsed) highlights.push(`Used: ${data.documentsUsed}`);
        
        // Content length fields
        if (data.contextLength) highlights.push(`Context: ${data.contextLength} chars`);
        if (data.responseLength) highlights.push(`Response: ${data.responseLength} chars`);
        if (data.totalPromptLength) highlights.push(`Total Prompt: ${data.totalPromptLength} chars`);
        
        // Config fields
        if (data.k) highlights.push(`K: ${data.k}`);
        if (data.used !== undefined) highlights.push(`Used: ${data.used}`);
        if (data.skipped) highlights.push('Skipped');
        if (data.historyExchanges !== undefined) highlights.push(`History: ${data.historyExchanges} exchanges`);
        if (data.validExchanges !== undefined) highlights.push(`Valid: ${data.validExchanges}`);
        
        // Fallback response preview
        if (data.response && !data.extractedContent) highlights.push(`Response: ${data.response.substring(0, 50)}...`);
        if (data.answer) highlights.push(`Answer: ${data.answer.substring(0, 50)}...`);
        
        return highlights.length > 0 ? highlights.join(' • ') : `${keyCount} properties`;
    }
    
    return String(data);
}