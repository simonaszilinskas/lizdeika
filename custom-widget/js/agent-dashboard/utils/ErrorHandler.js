/**
 * Enhanced Error Handler with Correlation Support
 * 
 * A comprehensive error logging utility for the agent dashboard with correlation ID tracking.
 * Provides structured error logging with correlation support for tracing errors across
 * frontend and backend systems.
 */

export class ErrorHandler {
  // Store correlation ID from server responses
  static currentCorrelationId = null;
  static sessionId = null;
  /**
   * Initialize session and correlation tracking
   */
  static init() {
    // Generate a unique session ID for this browser session
    this.sessionId = this.generateSessionId();
    
    // Set up global error handlers
    window.addEventListener('error', this.handleUncaughtError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    // Intercept fetch requests to capture correlation IDs
    this.interceptFetchForCorrelation();
    
    console.log('ErrorHandler initialized with session:', this.sessionId);
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  /**
   * Generate a client-side correlation ID
   */
  static generateCorrelationId() {
    return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  /**
   * Set correlation ID from server response
   */
  static setCorrelationId(correlationId) {
    this.currentCorrelationId = correlationId;
  }

  /**
   * Get current correlation ID or generate a new one
   */
  static getCorrelationId() {
    if (!this.currentCorrelationId) {
      this.currentCorrelationId = this.generateCorrelationId();
    }
    return this.currentCorrelationId;
  }

  /**
   * Intercept fetch requests to capture and send correlation IDs
   */
  static interceptFetchForCorrelation() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const [url, options = {}] = args;
      
      // Add correlation ID to request headers
      const correlationId = this.getCorrelationId();
      options.headers = {
        ...options.headers,
        'X-Correlation-ID': correlationId
      };
      
      try {
        const response = await originalFetch(url, options);
        
        // Extract correlation ID from response headers
        const responseCorrelationId = response.headers.get('X-Correlation-ID');
        if (responseCorrelationId) {
          this.setCorrelationId(responseCorrelationId);
        }
        
        return response;
      } catch (error) {
        // Log fetch errors with correlation
        this.logError(error, `Fetch failed: ${url}`);
        throw error;
      }
    };
  }

  /**
   * Log an error to console and send to logging service
   * @param {Error|string|any} error - The error to log
   * @param {string} context - Optional context information
   * @param {Object} metadata - Additional metadata
   */
  static logError(error, context = '', metadata = {}) {
    const timestamp = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    const correlationId = this.getCorrelationId();
    
    // Always log to console for debugging
    const contextStr = context ? ` [${context}]` : '';
    console.error(`[${timestamp}] Error${contextStr} [${correlationId}]:`, message);
    
    // Log stack trace if available
    if (stack) {
      console.error('Stack trace:', stack);
    }

    // Send to centralized logging service
    this._sendToLoggingService({
      level: 'error',
      timestamp,
      message,
      correlationId,
      module: 'agent-dashboard',
      userId: this.getCurrentUserId(),
      metadata: {
        context,
        sessionId: this.sessionId,
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...metadata
      },
      stack
    });
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
   * Get current user ID from localStorage or session
   */
  static getCurrentUserId() {
    try {
      const token = localStorage.getItem('agent_token');
      if (token) {
        // Simple JWT payload extraction (without verification)
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId || null;
      }
    } catch (e) {
      // Ignore errors
    }
    return null;
  }

  /**
   * Send structured log data to centralized logging service
   * @private
   * @param {Object} logData - Structured log data to send
   */
  static _sendToLoggingService(logData) {
    try {
      const endpoint = '/api/logs/frontend';
      
      fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Correlation-ID': logData.correlationId
        },
        body: JSON.stringify(logData)
      }).catch(() => {
        // Silent fail - we don't want logging errors to break the app
        // The console.error above will still show the error
      });
    } catch (e) {
      // Silent fail on any JSON stringification or fetch setup errors
    }
  }

  /**
   * Log info messages with correlation
   */
  static logInfo(message, context = '', metadata = {}) {
    const correlationId = this.getCorrelationId();
    console.info(`[INFO] [${correlationId}] ${context ? `[${context}] ` : ''}${message}`);
    
    this._sendToLoggingService({
      level: 'info',
      message,
      correlationId,
      module: 'agent-dashboard',
      userId: this.getCurrentUserId(),
      metadata: {
        context,
        sessionId: this.sessionId,
        url: window.location.href,
        ...metadata
      }
    });
  }

  /**
   * Log warning messages with correlation
   */
  static logWarn(message, context = '', metadata = {}) {
    const correlationId = this.getCorrelationId();
    console.warn(`[WARN] [${correlationId}] ${context ? `[${context}] ` : ''}${message}`);
    
    this._sendToLoggingService({
      level: 'warn',
      message,
      correlationId,
      module: 'agent-dashboard',
      userId: this.getCurrentUserId(),
      metadata: {
        context,
        sessionId: this.sessionId,
        url: window.location.href,
        ...metadata
      }
    });
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
  
}