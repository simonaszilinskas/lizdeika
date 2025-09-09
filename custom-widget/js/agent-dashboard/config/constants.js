/**
 * Configuration constants for Agent Dashboard
 * Centralized location for all configurable values
 */

export const POLLING_CONFIG = {
    // AI suggestion polling configuration
    MAX_ATTEMPTS: 15,              // Maximum polling attempts (~30 seconds total)
    BASE_DELAY_MS: 2000,           // Initial polling delay (2 seconds)
    MAX_DELAY_MS: 5000,            // Maximum polling delay (5 seconds)
    BACKOFF_MULTIPLIER: 1.3,       // Exponential backoff growth rate
    
    // Timeout configuration
    TOTAL_TIMEOUT_MS: 30000,       // Total timeout for AI suggestions (30 seconds)
    RETRY_AFTER_ERROR_MS: 2000,    // Delay after API error before retry
};

export const UI_CONFIG = {
    // Message display configuration
    MESSAGE_DISPLAY_DELAY_MS: 100, // Delay for real-time message display
    TOAST_DURATION_MS: 3000,       // Toast notification duration
    
    // Auto-refresh intervals
    CONVERSATIONS_REFRESH_MS: 30000, // Refresh conversations every 30 seconds
    AGENTS_REFRESH_MS: 15000,        // Refresh agent status every 15 seconds
    
    // UI behavior
    MAX_MESSAGE_LENGTH: 2000,      // Maximum message length
    MIN_TEXTAREA_HEIGHT: 38,       // Minimum textarea height (px)
    MAX_TEXTAREA_HEIGHT: 300,      // Maximum textarea height (px)
};

export const API_CONFIG = {
    // Request timeouts
    DEFAULT_TIMEOUT_MS: 10000,     // Default API request timeout (10 seconds)
    LONG_TIMEOUT_MS: 30000,        // Long operation timeout (30 seconds)
    
    // Retry configuration
    MAX_RETRIES: 3,                // Maximum API retry attempts
    RETRY_DELAY_MS: 1000,          // Delay between retries
};

export const WEBSOCKET_CONFIG = {
    // Connection management
    HEARTBEAT_INTERVAL_MS: 15000,  // WebSocket heartbeat interval
    RECONNECT_DELAY_MS: 5000,      // Delay before reconnection attempt
    MAX_RECONNECT_ATTEMPTS: 5,     // Maximum reconnection attempts
    
    // Message handling
    MESSAGE_BUFFER_SIZE: 100,      // Maximum buffered messages
};

export const CONVERSATION_CONFIG = {
    // Pagination
    DEFAULT_PAGE_SIZE: 20,         // Default conversations per page
    MAX_PAGE_SIZE: 100,            // Maximum conversations per page
    
    // Auto-assignment
    ASSIGNMENT_TIMEOUT_MS: 5000,   // Timeout for auto-assignment
    
    // Archive settings
    ARCHIVE_BATCH_SIZE: 50,        // Batch size for bulk operations
};