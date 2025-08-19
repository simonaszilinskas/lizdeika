/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */

const tokenUtils = require('../utils/tokenUtils');
const databaseClient = require('../utils/database');

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
    const user = await db.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
        agentStatus: {
          select: {
            status: true,
            updatedAt: true,
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

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
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

  if (!req.user.emailVerified) {
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

  if (req.user.role === 'agent' && (!req.user.agentStatus || req.user.agentStatus.status === 'offline')) {
    return res.status(403).json({
      success: false,
      error: 'Agent must be online to perform this action',
      code: 'AGENT_OFFLINE',
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRoles,
  requireAdmin,
  requireAgent,
  requireVerified,
  requireOwnershipOrAdmin,
  requireOnlineAgent,
  authRateLimit,
};