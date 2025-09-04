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
     * @param {Object} conv - Conversation object
     * @returns {boolean} True if unseen
     */
    conversationIsUnseen(conv) {
        if (!conv.lastMessage) return false;
        
        const isAssignedToMe = conv.assignedAgent === this.agentId;
        if (!isAssignedToMe) return false;
        
        // Check if agent has seen this conversation's last message
        const lastSeenTime = localStorage.getItem(`lastSeen_${conv.id}`);
        if (!lastSeenTime) return true;
        
        const lastMessageTime = new Date(conv.lastMessage.timestamp || conv.updatedAt);
        const agentLastSeenTime = new Date(lastSeenTime);
        
        return lastMessageTime > agentLastSeenTime;
    }

    /**
     * Get CSS classes for queue item based on status
     * @param {boolean} isActive - Is this the currently selected conversation
     * @param {boolean} needsResponse - Does this conversation need a response
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @param {boolean} isUnassigned - Is this conversation unassigned
     * @param {boolean} isUnseen - Is this conversation unseen by current agent
     * @returns {string} CSS classes
     */
    getQueueItemCssClass(isActive, needsResponse, isAssignedToMe, isUnassigned, isUnseen) {
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
     * @param {boolean} needsResponse - Does this conversation need a response
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @param {boolean} isUnassigned - Is this conversation unassigned
     * @param {boolean} isUnseen - Is this conversation unseen by current agent
     * @param {Object} conv - Conversation object
     * @returns {string} Status label
     */
    getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned, isUnseen, conv) {
        if (needsResponse && isAssignedToMe) return 'NEEDS REPLY';
        if (isUnseen && isUnassigned) return 'UNSEEN';
        if (needsResponse) return 'NEW MESSAGE';
        if (isAssignedToMe) return 'MINE';
        if (isUnassigned) return 'UNASSIGNED';
        
        if (conv && conv.assignedAgent) {
            const agent = this.connectedAgents.get(conv.assignedAgent);
            if (agent) {
                return getAgentDisplayName(agent).replace('Agent ', '');
            }
            return conv.assignedAgent.substring(0, 6);
        }
        return 'OTHER';
    }

    /**
     * Get status CSS classes for queue item
     * @param {boolean} needsResponse - Does this conversation need a response
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @param {boolean} isUnassigned - Is this conversation unassigned
     * @param {boolean} isUnseen - Is this conversation unseen by current agent
     * @returns {string} CSS classes
     */
    getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned, isUnseen) {
        // UNSEEN states get red badges with bold text
        if (isUnseen && isAssignedToMe) return 'bg-red-600 text-white font-bold';
        if (isUnseen && isUnassigned) return 'bg-red-600 text-white font-bold';
        if (isUnseen) return 'bg-red-500 text-white font-medium';
        
        // Regular states
        if (needsResponse && isAssignedToMe) return 'bg-blue-600 text-white font-medium';
        if (isAssignedToMe) return 'bg-blue-100 text-blue-700';
        if (isUnassigned) return 'bg-gray-600 text-white text-xs';
        
        // SOMEBODY'S (other agents)
        return 'bg-gray-400 text-white text-xs';
    }

    /**
     * Get unread message count for visual indicator
     * @param {Object} conv - Conversation object
     * @param {boolean} isAssignedToMe - Is this conversation assigned to current agent
     * @returns {number} Unread message count
     */
    getUnreadMessageCount(conv, isAssignedToMe) {
        // For conversations assigned to me, show count based on unseen messages
        if (isAssignedToMe && conv.lastMessage && conv.lastMessage.metadata) {
            // If conversation is unseen, show at least 1
            if (this.conversationIsUnseen(conv)) {
                return 1;
            }
        }
        
        // For unassigned conversations, show count if unseen
        if (!conv.assignedAgent && this.conversationIsUnseen(conv)) {
            return 1;
        }
        
        return 0;
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
     * Get time-based urgency indicator
     * @param {Object} conv - Conversation object
     * @returns {string} HTML string for time urgency indicator
     */
    getTimeUrgencyIndicator(conv) {
        if (!conv.lastMessage || !conv.lastMessage.timestamp) {
            return '';
        }

        const now = new Date();
        const lastMessageTime = new Date(conv.lastMessage.timestamp);
        const timeDiff = now - lastMessageTime;
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        
        if (this.conversationIsUnseen(conv)) {
            if (hoursAgo >= 2) {
                return '<i class="fas fa-clock text-red-500" title="Unseen for over 2 hours!"></i>';
            } else if (hoursAgo >= 1) {
                return '<i class="fas fa-clock text-orange-500" title="Unseen for over 1 hour"></i>';
            }
        }
        
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