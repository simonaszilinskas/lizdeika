/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */

const tokenUtils = require('../utils/tokenUtils');
const databaseClient = require('../utils/database');
const { createLogger } = require('../utils/logger');
const logger = createLogger('authMiddleware');

/**
 * Verify JWT token and attach user to request
 * Uses data from JWT payload to avoid database queries
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

    // Use data from JWT payload (no database query)
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

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
 * Load full user profile from database
 * Use this after authenticateToken when full user data is needed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireFullUserProfile = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Fetch full user profile from database
    const db = databaseClient.getClient();
    const user = await db.users.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        email_verified: true,
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

    // Replace minimal user data with full profile
    req.user = user;
    next();

  } catch (error) {
    logger.error('Load user profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load user profile',
      code: 'PROFILE_LOAD_ERROR',
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
 * Loads full user profile to check verification status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireVerified = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Load verification status if not already loaded
    if (req.user.email_verified === undefined) {
      const db = databaseClient.getClient();
      const user = await db.users.findUnique({
        where: { id: req.user.id },
        select: {
          email_verified: true,
        },
      });

      if (!user || !user.email_verified) {
        return res.status(403).json({
          success: false,
          error: 'Email verification required',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }
    } else if (!req.user.email_verified) {
      return res.status(403).json({
        success: false,
        error: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    next();
  } catch (error) {
    logger.error('Require verified error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify email status',
      code: 'VERIFICATION_CHECK_ERROR',
    });
  }
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
 * Loads full user profile to check agent status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireOnlineAgent = async (req, res, next) => {
  try {
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

    // Load full user profile to check agent status
    if (req.user.role === 'agent' && !req.user.agent_status) {
      const db = databaseClient.getClient();
      const user = await db.users.findUnique({
        where: { id: req.user.id },
        select: {
          agent_status: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!user || !user.agent_status || user.agent_status.status === 'offline') {
        return res.status(403).json({
          success: false,
          error: 'Agent must be online to perform this action',
          code: 'AGENT_OFFLINE',
        });
      }
    } else if (req.user.role === 'agent' && req.user.agent_status?.status === 'offline') {
      return res.status(403).json({
        success: false,
        error: 'Agent must be online to perform this action',
        code: 'AGENT_OFFLINE',
      });
    }

    next();
  } catch (error) {
    logger.error('Require online agent error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify agent status',
      code: 'AGENT_STATUS_ERROR',
    });
  }
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
  requireFullUserProfile,
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