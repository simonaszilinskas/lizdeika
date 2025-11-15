/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */

const tokenUtils = require('../utils/tokenUtils');
const databaseClient = require('../utils/database');
const passwordExpiryService = require('../services/passwordExpiryService');
const { createLogger } = require('../utils/logger');
const logger = createLogger('authMiddleware');

/**
 * Verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = tokenUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_MISSING',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = tokenUtils.verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: error.message,
        code: 'TOKEN_INVALID',
      });
    }

    // Get user from database
    const db = databaseClient.getClient();
    const user = await db.users.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        email_verified: true,
        password_changed_at: true,
        password_expires_at: true,
        password_blocked: true,
        agent_status: {
          select: {
            status: true,
            updated_at: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Attach user to request
    req.user = user;

    // Check password expiry for agents and admins
    if (user.role === 'agent' || user.role === 'admin') {
      const passwordStatus = passwordExpiryService.getPasswordStatus(user);

      // Allow access to password change endpoints even if expired
      const allowedPaths = [
        '/api/auth/change-password',
        '/api/auth/profile',
        '/api/auth/password-status',
        '/api/auth/logout'
      ];

      const isAllowedPath = allowedPaths.some(path => req.path === path);

      // Block access if password expired and not on allowed path
      if ((passwordStatus.isBlocked || passwordStatus.requiresRenewal) && !isAllowedPath) {
        logger.warn(`Access blocked for user ${user.id} due to expired password`);
        return res.status(403).json({
          success: false,
          error: 'Your password has expired. Please change your password to continue.',
          code: 'PASSWORD_EXPIRED',
          passwordStatus: {
            expired: true,
            daysRemaining: passwordStatus.daysRemaining,
            message: passwordStatus.warningMessage
          }
        });
      }

      // Attach password status to request for use in controllers
      req.passwordStatus = passwordStatus;
    }

    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = tokenUtils.extractTokenFromHeader(authHeader);

  if (!token) {
    req.user = null;
    return next();
  }

  // Use the main auth middleware
  return authenticateToken(req, res, next);
};

/**
 * Require specific user roles
 * @param {...string} allowedRoles - Allowed user roles
 * @returns {Function} Express middleware function
 */
const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role,
      });
    }

    next();
  };
};

/**
 * Require admin role
 */
const requireAdmin = requireRoles('admin');

/**
 * Require agent or admin role
 */
const requireAgent = requireRoles('agent', 'admin');

/**
 * Alias for requireAgent - clearer naming for category endpoints
 */
const requireAgentOrAdmin = requireAgent;

/**
 * Require user to be verified
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  next();
};

/**
 * Check if user owns resource or has admin privileges
 * @param {string} userIdParam - Parameter name containing user ID
 * @returns {Function} Express middleware function
 */
const requireOwnershipOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
    
    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // User can only access their own resources
    if (req.user.id !== resourceUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - resource ownership required',
        code: 'OWNERSHIP_REQUIRED',
      });
    }

    next();
  };
};

/**
 * Rate limiting for authentication endpoints
 * @param {number} maxAttempts - Maximum attempts per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Express middleware function
 */
const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const identifier = req.ip + ':' + (req.body.email || req.body.username || 'anonymous');
    const now = Date.now();
    
    // Clean old entries
    for (const [key, data] of attempts.entries()) {
      if (now - data.firstAttempt > windowMs) {
        attempts.delete(key);
      }
    }

    const userAttempts = attempts.get(identifier) || { count: 0, firstAttempt: now };

    if (userAttempts.count >= maxAttempts) {
      const timeLeft = Math.ceil((windowMs - (now - userAttempts.firstAttempt)) / 1000 / 60);
      return res.status(429).json({
        success: false,
        error: `Too many authentication attempts. Try again in ${timeLeft} minutes.`,
        code: 'RATE_LIMITED',
        retryAfter: timeLeft * 60,
      });
    }

    // Increment attempts on failed auth (handled in error middleware)
    const originalSend = res.send;
    res.send = function(data) {
      const response = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (response && !response.success && (
          response.code === 'TOKEN_INVALID' || 
          response.error?.includes('Invalid email or password') ||
          response.error?.includes('password')
        )) {
        userAttempts.count++;
        userAttempts.firstAttempt = userAttempts.firstAttempt || now;
        attempts.set(identifier, userAttempts);
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Require agent to be online for certain operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireOnlineAgent = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  if (req.user.role !== 'agent' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Agent role required',
      code: 'AGENT_REQUIRED',
    });
  }

  if (req.user.role === 'agent' && (!req.user.agent_status || req.user.agent_status.status === 'offline')) {
    return res.status(403).json({
      success: false,
      error: 'Agent must be online to perform this action',
      code: 'AGENT_OFFLINE',
    });
  }

  next();
};

/**
 * Authenticate 2FA setup token (allows users without full auth to complete mandatory 2FA setup)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate2FASetupToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = tokenUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Setup token required',
        code: 'TOKEN_MISSING',
      });
    }

    // Try to verify as setup token first
    let decoded;
    try {
      decoded = tokenUtils.verify2FASetupToken(token);
    } catch (setupError) {
      // If setup token fails, try regular access token (for already-auth'd users)
      try {
        decoded = tokenUtils.verifyAccessToken(token);
      } catch (accessError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          code: 'TOKEN_INVALID',
        });
      }
    }

    // Get user from database
    const db = databaseClient.getClient();
    const user = await db.users.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        totp_enabled: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Authorization check: ensure user can only modify their own 2FA setup
    // Extract target user ID from request path (e.g., /api/users/:id/totp/initiate)
    const targetUserId = req.params.id;

    if (targetUserId && targetUserId !== decoded.sub && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    logger.error('2FA setup authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRoles,
  requireAdmin,
  requireAgent,
  requireAgentOrAdmin,
  requireVerified,
  requireOwnershipOrAdmin,
  requireOnlineAgent,
  authRateLimit,
  authenticate2FASetupToken,
};