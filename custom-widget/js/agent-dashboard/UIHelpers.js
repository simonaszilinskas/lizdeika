/**
 * UI Helpers for Agent Dashboard
 * Centralized utility functions for conversation queue styling, assignment UI, and general UI utilities
 * Extracted from agent-dashboard.js for better modularity and reusability
 */

// Import utility functions
import { getAgentDisplayName } from './ui/utils.js';

export class UIHelpers {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.agentId = dashboard.agentId;
        this.connectedAgents = dashboard.connectedAgents;
        this.conversationRenderer = dashboard.conversationRenderer;
        this.apiManager = dashboard.apiManager;
        this.agentCache = dashboard.agentCache;
        this.agentCacheExpiry = dashboard.agentCacheExpiry;
    }

    // ===== CONVERSATION QUEUE UI HELPERS =====

    /**
     * Check if conversation is unseen by current agent
     * Works for all conversations visible to the agent (not just assigned ones)
     * @param {Object} conv - Conversation object
     * @returns {boolean} True if unseen
     */
    conversationIsUnseen(conv) {
        if (!conv.lastMessage) return false;
        
        // SIMPLIFIED: Use backend-provided unseen status if available
        if (conv.hasOwnProperty('_unseenByAgent')) {
            return conv._unseenByAgent;
        }
        
        // FALLBACK: Check localStorage for conversations not yet updated by WebSocket
        const lastSeenTime = localStorage.getItem(`lastSeen_${conv.id}`);
        if (!lastSeenTime) return true;
        
        const lastMessageTime = new Date(conv.lastMessage.timestamp || conv.updatedAt);
        const agentLastSeenTime = new Date(lastSeenTime);
        
        return lastMessageTime > agentLastSeenTime;
    }

    /**
     * Get CSS classes for queue item based on status
     * Simplified to 3-state system: UNSEEN + MY MESSAGES, MY MESSAGES (SEEN), OTHER MESSAGES
     * @param {boolean} isActive - Is this the currently selected conversation
     * @param {boolean} needsResponse - Does this conversation need a response (unused in simplified version)
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @param {boolean} isUnassigned - Is this conversation unassigned
     * @param {boolean} isUnseen - Is this conversation unseen by current agent
     * @returns {string} CSS classes
     */
    getQueueItemCssClass(isActive, needsResponse, isAssignedToMe, isUnassigned, isUnseen) {
        if (isActive) return 'active-chat border-indigo-300 bg-indigo-50';
        
        // STATE 1: UNSEEN MESSAGES - Most prominent (red/orange accent)
        if (isUnseen) {
            if (isAssignedToMe) {
                // My unseen messages - bright red with thick border
                return 'bg-red-100 border-red-400 hover:bg-red-200 border-l-4 border-l-red-600 shadow-md';
            } else {
                // Other unseen messages - orange accent
                return 'bg-orange-50 border-orange-300 hover:bg-orange-100 border-l-3 border-l-orange-500 shadow-sm';
            }
        }
        
        // STATE 2: MY MESSAGES (SEEN) - Standard blue
        if (isAssignedToMe) {
            return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
        }
        
        // STATE 3: OTHER MESSAGES - Gray (unassigned or assigned to others)
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100';
    }

    /**
     * Get status label for queue item (simplified version)
     * @param {boolean} needsResponse - Does this conversation need a response (unused in simplified version)
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @param {boolean} isUnassigned - Is this conversation unassigned
     * @param {boolean} isUnseen - Is this conversation unseen by current agent
     * @param {Object} conv - Conversation object
     * @returns {string} Status label
     */
    getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned, isUnseen, conv) {
        if (isUnseen) return 'UNSEEN';
        if (isAssignedToMe) return 'MINE';
        if (isUnassigned) return 'UNASSIGNED';
        
        if (conv && conv.assignedAgent) {
            const agent = this.connectedAgents?.get(conv.assignedAgent);
            if (agent) {
                return getAgentDisplayName(agent).replace('Agent ', '');
            }
            return conv.assignedAgent.substring(0, 6);
        }
        return 'OTHER';
    }

    /**
     * Get status CSS classes for queue item (simplified version)
     * @param {boolean} needsResponse - Does this conversation need a response (unused in simplified version)
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @param {boolean} isUnassigned - Is this conversation unassigned
     * @param {boolean} isUnseen - Is this conversation unseen by current agent
     * @returns {string} CSS classes
     */
    getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned, isUnseen) {
        // UNSEEN states get red badges with bold text
        if (isUnseen) return 'bg-red-600 text-white font-bold';
        
        // MY MESSAGES - Blue badge
        if (isAssignedToMe) return 'bg-blue-100 text-blue-700';
        
        // UNASSIGNED - Gray badge
        if (isUnassigned) return 'bg-gray-600 text-white text-xs';
        
        // OTHER AGENTS - Light gray badge
        return 'bg-gray-400 text-white text-xs';
    }

    /**
     * Get unseen indicator count for visual notification badge
     * Shows 1 if conversation is unseen by current agent, 0 otherwise
     * Note: This is timestamp-based "unseen" logic, not actual unread message count
     * @param {Object} conv - Conversation object
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @returns {number} Unseen indicator count (0 or 1)
     */
    getUnseenIndicatorCount(conv, isAssignedToMe) {
        // For conversations assigned to me, show indicator if unseen
        if (isAssignedToMe && conv.lastMessage && conv.lastMessage.metadata) {
            if (this.conversationIsUnseen(conv)) {
                return 1;
            }
        }
        
        // For unassigned conversations, show indicator if unseen
        if (!conv.assignedAgent && this.conversationIsUnseen(conv)) {
            return 1;
        }
        
        return 0;
    }

    /**
     * Legacy alias for backwards compatibility
     * @deprecated Use getUnseenIndicatorCount instead
     */
    getUnreadMessageCount(conv, isAssignedToMe) {
        return this.getUnseenIndicatorCount(conv, isAssignedToMe);
    }

    /**
     * Get urgency icon for conversation (simplified - no user icons)
     * @param {boolean} isUnseen - Is this conversation unseen by current agent
     * @param {boolean} needsResponse - Does this conversation need a response
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @returns {string} HTML string for urgency icon
     */
    getUrgencyIcon(isUnseen, needsResponse, isAssignedToMe) {
        // Only show urgent indicators, no regular assignment icons
        if (isUnseen && isAssignedToMe) {
            return '<i class="fas fa-exclamation-triangle text-red-600" title="Urgent: Unseen message assigned to you!"></i>';
        }
        if (isUnseen) {
            return '<i class="fas fa-exclamation-circle text-red-500" title="New unseen message"></i>';
        }
        
        // No icons for regular states - rely on colors instead
        return '';
    }

    /**
     * Get priority animation class
     * @param {boolean} isUnseen - Is this conversation unseen by current agent
     * @param {boolean} needsResponse - Does this conversation need a response
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @returns {string} CSS animation class
     */
    getPriorityAnimationClass(isUnseen, needsResponse, isAssignedToMe) {
        if (isUnseen && isAssignedToMe) {
            return ''; // Most urgent
        }
        return '';
    }

    /**
     * Get time-based urgency indicator (simplified - removed for cleaner UI)
     * @param {Object} conv - Conversation object
     * @param {boolean} needsResponse - Whether conversation needs agent response (unused in simplified version)
     * @param {boolean} isAssignedToMe - Whether conversation is assigned to current agent (unused in simplified version)
     * @returns {string} HTML string for time urgency indicator
     */
    getTimeUrgencyIndicator(conv, needsResponse = false, isAssignedToMe = false) {
        // Simplified version - no time-based urgency indicators for cleaner UI
        // Visual state is now entirely handled by the seen/unseen logic and color coding
        return '';
    }

    // ===== ASSIGNMENT UI HELPERS =====

    /**
     * Render assignment buttons for conversation card
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @param {boolean} isUnassigned - Is this conversation unassigned
     * @param {string} conversationId - Conversation ID
     * @param {boolean} isArchived - Is this conversation archived
     * @returns {string} HTML string for assignment buttons
     */
    renderAssignmentButtons(isAssignedToMe, isUnassigned, conversationId, isArchived = false) {
        // Archived conversations show unarchive button only
        if (isArchived) {
            return `
                <button onclick="dashboard.unarchiveConversation('${conversationId}', event)" 
                        class="px-2 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs rounded">
                    Unarchive
                </button>`;
        }
        
        if (isAssignedToMe) {
            return `
                <div class="flex gap-1">
                    <button onclick="dashboard.unassignConversation('${conversationId}', event)" 
                            class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded">
                        Unassign
                    </button>
                    <div class="relative">
                        <button onclick="dashboard.toggleAssignDropdown('${conversationId}', event)" 
                                class="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs rounded">
                            Reassign
                        </button>
                        <div id="assign-dropdown-${conversationId}" 
                             class="hidden absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-xl z-50 min-w-32 opacity-100">
                            ${this.renderAgentOptions(conversationId)}
                        </div>
                    </div>
                    <button onclick="dashboard.archiveConversation('${conversationId}', event)" 
                            class="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs rounded"
                            title="Archive conversation">
                        <i class="fas fa-archive"></i>
                    </button>
                </div>`;
        } else {
            return `
                <div class="flex gap-1">
                    <button onclick="dashboard.assignConversation('${conversationId}', event)" 
                            class="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded">
                        Assign to me
                    </button>
                    <div class="relative">
                        <button onclick="dashboard.toggleAssignDropdown('${conversationId}', event)" 
                                class="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs rounded">
                            Assign to...
                        </button>
                        <div id="assign-dropdown-${conversationId}" 
                             class="hidden absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-xl z-50 min-w-32 opacity-100">
                            ${this.renderAgentOptions(conversationId)}
                        </div>
                    </div>
                    <button onclick="dashboard.archiveConversation('${conversationId}', event)" 
                            class="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs rounded"
                            title="Archive conversation">
                        <i class="fas fa-archive"></i>
                    </button>
                </div>`;
        }
    }

    /**
     * Render dropdown options for online agents only
     * Uses caching to prevent rapid-fire API calls
     * @param {string} conversationId - Conversation ID
     * @returns {string} HTML string for agent dropdown options
     */
    async renderAgentOptions(conversationId) {
        try {
            let allAgents;
            
            // Check cache first
            if (this.dashboard.agentCache && Date.now() < this.dashboard.agentCacheExpiry) {
                allAgents = this.dashboard.agentCache.filter(agent => agent.id !== this.agentId);
                console.log('📋 Using cached agent data');
            } else {
                // Fetch all agents from server
                console.log('🔄 Fetching fresh agent data');
                try {
                    const data = await this.dashboard.apiManager.loadAgentsData();
                    allAgents = data.filter(agent => agent.id !== this.agentId);
                    // Cache the agents data
                    this.dashboard.agentCache = data;
                    this.dashboard.agentCacheExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes
                } catch (error) {
                    console.error('Failed to fetch agents:', error);
                    return `<div class="px-3 py-2 text-xs text-gray-500">Error loading agents</div>`;
                }
            }
            
            // Sort: online agents first, then offline
            allAgents.sort((a, b) => {
                const aOnline = a.connected === true;
                const bOnline = b.connected === true;
                if (aOnline && !bOnline) return -1;
                if (!aOnline && bOnline) return 1;
                return (a.name || a.id).localeCompare(b.name || b.id);
            });
            
            // Create dropdown options - start with "Assign to nobody" option
            let dropdownHtml = `
                <button onclick="dashboard.unassignConversation('${conversationId}', event)" 
                        class="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center text-red-600">
                    <span class="w-2 h-2 bg-gray-400 rounded-full inline-block mr-2"></span>Nobody (unassign)
                </button>
            `;
            
            // Add separator if there are agents
            if (allAgents.length > 0) {
                dropdownHtml += `<div class="border-t border-gray-200 my-1"></div>`;
            }
            
            // Add agent options - only show online agents
            const onlineAgents = allAgents.filter(agent => agent.connected === true);
            
            if (onlineAgents.length === 0) {
                dropdownHtml += `
                    <div class="px-3 py-2 text-xs text-gray-500 text-center">
                        No other agents online
                    </div>
                `;
            } else {
                dropdownHtml += onlineAgents.map(agent => {
                    const displayName = agent.name || getAgentDisplayName(agent);
                    
                    return `
                        <button onclick="dashboard.assignToAgent('${conversationId}', '${agent.id}', event)" 
                                class="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center text-gray-900">
                            <span class="w-2 h-2 bg-green-500 rounded-full inline-block mr-2"></span>${displayName}
                        </button>
                    `;
                }).join('');
            }
            
            return dropdownHtml;
        } catch (error) {
            console.error('Error fetching agents for dropdown:', error);
            return `<div class="px-3 py-2 text-xs text-gray-500">Error loading agents</div>`;
        }
    }

    /**
     * Toggle assignment dropdown visibility
     * @param {string} conversationId - Conversation ID
     * @param {Event} event - Click event
     */
    async toggleAssignDropdown(conversationId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        // Close all other dropdowns first
        document.querySelectorAll('[id^="assign-dropdown-"]').forEach(dropdown => {
            if (dropdown.id !== `assign-dropdown-${conversationId}`) {
                dropdown.classList.add('hidden');
            }
        });
        
        const dropdown = document.getElementById(`assign-dropdown-${conversationId}`);
        if (dropdown) {
            const wasHidden = dropdown.classList.contains('hidden');
            dropdown.classList.toggle('hidden');
            
            // If we're showing the dropdown, populate with fresh agent data
            if (wasHidden) {
                dropdown.innerHTML = await this.renderAgentOptions(conversationId);
            }
        }
    }

    // ===== GENERAL UI UTILITIES =====

    /**
     * Utility method to show element
     * @param {string} elementId - ID of element to show
     */
    static showElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('hidden');
        }
    }

    /**
     * Utility method to hide element
     * @param {string} elementId - ID of element to hide
     */
    static hideElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('hidden');
        }
    }

    /**
     * Utility method to safely update element text content
     * @param {string} elementId - ID of element to update
     * @param {string} value - New text content
     */
    static updateElementText(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Format conversation date for display
     * Today: show time, yesterday/few days: "X days ago", older: full date
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date string
     */
    static formatConversationDate(dateString) {
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
     * @param {string} text - Text to escape
     * @returns {string} HTML-escaped text
     */
    static escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show/hide customer typing indicator
     * @param {boolean} isTyping - Whether customer is typing
     */
    static showCustomerTyping(isTyping) {
        const indicator = document.getElementById('customer-typing-indicator');
        if (indicator) {
            if (isTyping) {
                indicator.classList.remove('hidden');
            } else {
                indicator.classList.add('hidden');
            }
        }
    }
}