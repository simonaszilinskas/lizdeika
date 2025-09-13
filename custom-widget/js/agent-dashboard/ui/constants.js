/**
 * AGENT DASHBOARD CONSTANTS
 * Centralized configuration and constant values for the agent dashboard
 * 
 * These constants are extracted from the monolithic agent-dashboard.js
 * to improve maintainability and configuration management.
 * 
 * @fileoverview Constants for timing, styling, filters, and UI configuration
 */

/**
 * Timing configuration constants
 */
export const TIMING = {
    /** Polling interval for conversation updates (milliseconds) */
    POLL_INTERVAL: 15000, // 15 seconds
    
    /** Agent cache duration (milliseconds) */
    AGENT_CACHE_DURATION: 30000, // 30 seconds
    
    /** WebSocket heartbeat interval (milliseconds) */
    HEARTBEAT_INTERVAL: 15000, // 15 seconds
    
    /** Status refresh interval (milliseconds) */
    STATUS_REFRESH_INTERVAL: 30 * 60 * 1000, // 30 minutes
    
    /** Textarea auto-resize debounce delay (milliseconds) */
    TEXTAREA_RESIZE_DELAY: 10,
};

/**
 * Filter configuration constants
 */
export const FILTERS = {
    /** Default conversation filter */
    DEFAULT_FILTER: 'unassigned',
    
    /** Available conversation filters */
    CONVERSATION_FILTERS: {
        MINE: 'mine',
        UNASSIGNED: 'unassigned', 
        OTHERS: 'others',
        ALL: 'all'
    },
    
    /** Archive filter options */
    ARCHIVE_FILTERS: {
        ACTIVE: 'active',
        ARCHIVED: 'archived'
    },
    
    /** Filter button mapping */
    FILTER_BUTTON_MAP: {
        'mine': 'filter-mine',
        'unassigned': 'filter-unassigned',
        'others': 'filter-others',
        'all': 'filter-all'
    }
};

/**
 * Agent status constants
 */
export const AGENT_STATUS = {
    /** Personal agent status options */
    PERSONAL: {
        ONLINE: 'online',
        OFFLINE: 'offline'
    },
    
    /** System mode options */
    SYSTEM_MODES: {
        HITL: 'hitl', // Human in the Loop
        AUTOPILOT: 'autopilot',
        OFF: 'off'
    }
};

/**
 * CSS class constants for consistent styling
 */
export const CSS_CLASSES = {
    /** Queue item states */
    QUEUE_ITEM: {
        ACTIVE: 'active-chat border-indigo-300 bg-indigo-50',
        BASE: 'chat-queue-item p-3 rounded-lg cursor-pointer border'
    },
    
    /** Priority animations */
    ANIMATIONS: {
        PULSE: 'animate-pulse',
        NONE: ''
    },
    
    /** Status badges */
    STATUS_BADGES: {
        URGENT_MINE: 'bg-red-600 text-white font-bold',
        URGENT_UNASSIGNED: 'bg-red-600 text-white font-bold',
        URGENT: 'bg-red-500 text-white font-medium',
        NEEDS_REPLY: 'bg-blue-600 text-white font-medium',
        MINE: 'bg-blue-100 text-blue-700',
        UNASSIGNED: 'bg-gray-600 text-white text-xs',
        ASSIGNED: 'bg-gray-100 text-gray-600 text-xs'
    },
    
    /** Message bubbles */
    MESSAGE_BUBBLES: {
        BASE: 'px-4 py-3 rounded-2xl shadow-sm max-w-full break-words',
        CUSTOMER: 'bg-white border border-gray-200 text-gray-800',
        AI: 'bg-purple-50 border border-purple-200 text-purple-900',
        SYSTEM: 'bg-yellow-50 border border-yellow-200 text-yellow-900',
        AGENT: 'bg-indigo-600 text-white'
    },
    
    /** Filter buttons */
    FILTER_BUTTONS: {
        ACTIVE: 'flex-1 text-xs px-2 py-1.5 rounded bg-blue-100 text-blue-800 font-medium transition hover:bg-blue-200',
        INACTIVE: 'flex-1 text-xs px-2 py-1.5 rounded bg-gray-100 text-gray-700 transition hover:bg-gray-200'
    },
    
    /** Toast notifications */
    TOAST: {
        BASE: 'max-w-sm p-4 rounded-md shadow-lg transform transition-all duration-300 ease-in-out',
        SUCCESS: 'bg-green-500 text-white',
        ERROR: 'bg-red-500 text-white', 
        WARNING: 'bg-yellow-500 text-white',
        INFO: 'bg-blue-500 text-white'
    }
};

/**
 * Icon constants for urgency indicators
 */
export const ICONS = {
    /** Urgency icons */
    URGENCY: {
        CRITICAL: '<i class="fas fa-exclamation-triangle text-red-600" title="Urgent: Unseen message assigned to you!"></i>',
        WARNING: '<i class="fas fa-exclamation-circle text-red-500" title="New unseen message"></i>',
        NONE: ''
    },
    
    /** Time-based urgency icons */
    TIME_URGENCY: {
        OVERDUE: '<i class="fas fa-clock text-red-500" title="Unseen for over 2 hours!"></i>',
        DELAYED: '<i class="fas fa-clock text-orange-500" title="Unseen for over 1 hour"></i>',
        NONE: ''
    }
};

/**
 * Message sender labels
 */
export const SENDER_LABELS = {
    AI: 'AI Assistant',
    SYSTEM: 'System',
    AGENT: 'You',
    CUSTOMER: 'Customer'
};


/**
 * Time thresholds for urgency indicators (hours)
 */
export const TIME_THRESHOLDS = {
    /** Hours before showing "delayed" indicator */
    DELAYED: 1,
    
    /** Hours before showing "overdue" indicator */
    OVERDUE: 2
};

/**
 * Debug text limits for preview display
 */
export const DEBUG_LIMITS = {
    /** Maximum string length for debug preview */
    PREVIEW_LENGTH: 100,
    
    /** Maximum prompt preview length */
    PROMPT_PREVIEW: 50
};

/**
 * Default configuration values
 */
export const DEFAULTS = {
    /** Default personal status */
    PERSONAL_STATUS: 'online',
    
    /** Default system mode */
    SYSTEM_MODE: 'hitl',
    
    /** Default archive filter */
    ARCHIVE_FILTER: 'active',
    
    /** Default agent ID fallback prefix */
    AGENT_ID_PREFIX: 'agent-',
    
    /** Random ID character count */
    RANDOM_ID_LENGTH: 11
};

/**
 * Element ID constants for DOM queries
 */
export const ELEMENT_IDS = {
    /** Main containers */
    CHAT_QUEUE: 'chat-queue',
    MESSAGE_INPUT: 'message-input',
    MESSAGES_CONTAINER: 'messages-container',
    
    /** Filter buttons */
    FILTER_MINE: 'filter-mine',
    FILTER_UNASSIGNED: 'filter-unassigned',
    FILTER_OTHERS: 'filter-others',
    FILTER_ALL: 'filter-all',
    
    /** Bulk operation elements */
    SELECT_ALL: 'select-all',
    CLEAR_SELECTION: 'clear-selection',
    BULK_ARCHIVE: 'bulk-archive',
    BULK_UNARCHIVE: 'bulk-unarchive',
    BULK_ASSIGN_ME: 'bulk-assign-me',
    BULK_ASSIGN_AGENT: 'bulk-assign-agent',
    
    /** Status elements */
    PERSONAL_STATUS: 'personal-status',
    ARCHIVE_TOGGLE: 'archive-toggle',
    ADMIN_BAR: 'adminBar',
    
    /** AI suggestion elements */
    AI_SUGGESTION_PANEL: 'ai-suggestion-panel',
    AI_SUGGESTION_TEXT: 'ai-suggestion-text',
    AI_HEADER: 'ai-suggestion-header',
    SEND_AS_IS_BTN: 'send-as-is-btn',
    EDIT_SUGGESTION_BTN: 'edit-suggestion-btn',
    WRITE_FROM_SCRATCH_BTN: 'write-from-scratch-btn',
    
    /** Debug elements */
    DEBUG_MODAL: 'debug-modal',
    DEBUG_CONTENT: 'debug-content',
    DEBUG_TOGGLE_BTN: 'debug-toggle-btn',
    DEBUG_CLOSE_BTN: 'debug-close-btn'
};

/**
 * API endpoint paths (relative to base API URL)
 */
export const API_ENDPOINTS = {
    AUTH_PROFILE: '/api/auth/profile',
    AGENTS_ALL: '/api/agents/all',
    AGENTS_DASHBOARD: '/api/agents/dashboard',
    AGENTS_MESSAGES: '/api/agents/messages',
    AGENTS_ASSIGN: '/api/agents/assign',
    CONVERSATIONS_MESSAGES: '/api/conversations/{id}/messages',
    AI_ASSISTANCE: '/api/ai/assistance'
};

/**
 * WebSocket event names
 */
export const WEBSOCKET_EVENTS = {
    // Outgoing events
    JOIN_AGENT_DASHBOARD: 'join-agent-dashboard',
    AGENT_TYPING: 'agent-typing',
    HEARTBEAT: 'heartbeat',
    
    // Incoming events
    NEW_MESSAGE: 'new-message',
    AGENT_STATUS_UPDATE: 'agent-status-update',
    SYSTEM_MODE_UPDATE: 'system-mode-update',
    TICKET_REASSIGNMENTS: 'ticket-reassignments',
    CONNECTED_AGENTS_UPDATE: 'connected-agents-update'
};

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
    USER_DATA: 'user_data',
    AGENT_USER: 'agentUser',
    AGENT_TOKEN: 'agent_token',
    AGENT_STATUS_PREFIX: 'agentStatus_' // Appended with agent ID
};