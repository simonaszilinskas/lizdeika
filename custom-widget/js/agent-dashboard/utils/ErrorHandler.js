/**
 * Simple Error Handler
 * 
 * A lightweight error logging utility for the agent dashboard.
 * Provides basic error logging without the overhead of analytics, 
 * buffering, categorization, and complex monitoring features.
 */

export class ErrorHandler {
  /**
   * Log an error to console and optionally send to logging service
   * @param {Error|string|any} error - The error to log
   * @param {string} context - Optional context information
   */
  static logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    
    // Always log to console for debugging
    const contextStr = context ? ` ${context}` : '';
    console.error(`[${timestamp}] Error${contextStr}:`, message);
    
    // Log stack trace if available
    if (stack) {
      console.error('Stack trace:', stack);
    }
    
    // Optional: Send to actual logging service if configured
    if (window.LOGGING_ENDPOINT) {
      this._sendToLoggingService({
        timestamp,
        message,
        context,
        stack,
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    }
  }
  
  /**
   * Track an error with additional metadata
   * @param {Error|string|any} error - The error to track
   * @param {Object} metadata - Additional metadata
   */
  static trackError(error, metadata = {}) {
    const metadataStr = Object.keys(metadata).length > 0 ? 
      `tracked with metadata: ${JSON.stringify(metadata)}` : 'tracked';
    this.logError(error, metadataStr);
  }
  
  /**
   * Report an error, optionally marking it as critical
   * @param {Error|string|any} error - The error to report
   * @param {boolean} critical - Whether this is a critical error
   */
  static reportError(error, critical = false) {
    const context = critical ? 'CRITICAL' : 'reported';
    this.logError(error, context);
  }
  
  /**
   * Send error to external logging service
   * @private
   * @param {Object} errorData - Error data to send
   */
  static _sendToLoggingService(errorData) {
    try {
      fetch(window.LOGGING_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(errorData)
      }).catch(() => {
        // Silent fail - we don't want logging errors to break the app
        // The console.error above will still show the error
      });
    } catch (e) {
      // Silent fail on any JSON stringification or fetch setup errors
    }
  }
  
  /**
   * Handle uncaught errors globally
   * @param {ErrorEvent} event - The error event
   */
  static handleUncaughtError(event) {
    this.logError(event.error || event.message, 'uncaught');
  }
  
  /**
   * Handle unhandled promise rejections
   * @param {PromiseRejectionEvent} event - The promise rejection event
   */
  static handleUnhandledRejection(event) {
    this.logError(event.reason, 'unhandled promise rejection');
  }
  
  /**
   * Initialize global error handlers
   */
  static init() {
    // Set up global error handlers
    window.addEventListener('error', this.handleUncaughtError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    console.log('ErrorHandler initialized');
  }
}