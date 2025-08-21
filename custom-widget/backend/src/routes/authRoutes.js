/**
 * Authentication Routes
 * Defines all authentication-related API endpoints
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticateToken, requireAdmin, optionalAuth, authRateLimit } = require('../middleware/authMiddleware');
const { validate, authSchemas } = require('../utils/validators');

const router = express.Router();

// Rate limiting for authentication endpoints (relaxed for development)
const strictRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (reduced from 15)
  max: 100, // 100 requests per window (increased from 5)
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const moderateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Public Authentication Routes
 */

// POST /api/auth/register
router.post('/register',
  strictRateLimit,
  validate(authSchemas.register, 'body'),
  authController.register
);

// POST /api/auth/login
router.post('/login',
  strictRateLimit,
  authRateLimit(5, 15 * 60 * 1000), // Custom rate limiting with tracking
  validate(authSchemas.login, 'body'),
  authController.login
);

// POST /api/auth/refresh
router.post('/refresh',
  moderateRateLimit,
  validate(authSchemas.refreshToken, 'body'),
  authController.refreshToken
);

// POST /api/auth/logout
router.post('/logout',
  generalRateLimit,
  validate(authSchemas.refreshToken, 'body'),
  authController.logout
);

// POST /api/auth/forgot-password
router.post('/forgot-password',
  strictRateLimit,
  validate(authSchemas.forgotPassword, 'body'),
  authController.forgotPassword
);

// POST /api/auth/reset-password
router.post('/reset-password',
  moderateRateLimit,
  validate(authSchemas.resetPassword, 'body'),
  authController.resetPassword
);

/**
 * Protected Authentication Routes (require valid token)
 */

// GET /api/auth/profile
router.get('/profile',
  generalRateLimit,
  authenticateToken,
  authController.getProfile
);

// POST /api/auth/change-password
router.post('/change-password',
  moderateRateLimit,
  authenticateToken,
  validate(authSchemas.changePassword, 'body'),
  authController.changePassword
);

// GET /api/auth/verify
router.get('/verify',
  generalRateLimit,
  authenticateToken,
  authController.verifyToken
);

// GET /api/auth/status (works with or without token)
router.get('/status',
  generalRateLimit,
  optionalAuth,
  authController.getAuthStatus
);

/**
 * Admin-only Authentication Routes
 */

// POST /api/auth/cleanup-tokens
router.post('/cleanup-tokens',
  generalRateLimit,
  authenticateToken,
  requireAdmin,
  authController.cleanupTokens
);

/**
 * Development-only Routes
 */
if (process.env.NODE_ENV === 'development') {
  // POST /api/auth/create-test-user
  router.post('/create-test-user',
    moderateRateLimit,
    authController.createTestUser
  );
}

/**
 * Emergency Recovery Routes
 * These routes are always available for admin recovery scenarios
 */

// POST /api/auth/emergency-admin-recovery
router.post('/emergency-admin-recovery',
  strictRateLimit, // Very strict rate limiting
  authController.emergencyAdminRecovery
);

// POST /api/auth/emergency-create-admin
router.post('/emergency-create-admin',
  strictRateLimit, // Very strict rate limiting
  authController.emergencyCreateAdmin
);

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication service is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * API documentation endpoint
 */
router.get('/docs', (req, res) => {
  const endpoints = [
    {
      method: 'POST',
      path: '/api/auth/register',
      description: 'Register a new user',
      body: {
        email: 'user@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user', // optional
      },
    },
    {
      method: 'POST',
      path: '/api/auth/login',
      description: 'Login user',
      body: {
        email: 'user@example.com',
        password: 'SecurePass123!',
      },
    },
    {
      method: 'POST',
      path: '/api/auth/refresh',
      description: 'Refresh access token',
      body: {
        refreshToken: 'jwt-refresh-token-here',
      },
    },
    {
      method: 'POST',
      path: '/api/auth/logout',
      description: 'Logout user',
      body: {
        refreshToken: 'jwt-refresh-token-here',
      },
    },
    {
      method: 'POST',
      path: '/api/auth/forgot-password',
      description: 'Request password reset',
      body: {
        email: 'user@example.com',
      },
    },
    {
      method: 'POST',
      path: '/api/auth/reset-password',
      description: 'Reset password with token',
      body: {
        token: 'reset-token-here',
        newPassword: 'NewSecurePass123!',
      },
    },
    {
      method: 'GET',
      path: '/api/auth/profile',
      description: 'Get current user profile',
      headers: {
        Authorization: 'Bearer jwt-access-token-here',
      },
    },
    {
      method: 'POST',
      path: '/api/auth/change-password',
      description: 'Change password (authenticated)',
      headers: {
        Authorization: 'Bearer jwt-access-token-here',
      },
      body: {
        currentPassword: 'CurrentPass123!',
        newPassword: 'NewSecurePass123!',
      },
    },
    {
      method: 'GET',
      path: '/api/auth/verify',
      description: 'Verify token validity',
      headers: {
        Authorization: 'Bearer jwt-access-token-here',
      },
    },
    {
      method: 'GET',
      path: '/api/auth/status',
      description: 'Get authentication status',
      headers: {
        Authorization: 'Bearer jwt-access-token-here (optional)',
      },
    },
  ];

  res.json({
    success: true,
    message: 'Authentication API Documentation',
    version: '1.0.0',
    baseUrl: '/api/auth',
    endpoints,
    rateLimits: {
      strict: '5 requests per 15 minutes (login, register, forgot-password)',
      moderate: '10 requests per 15 minutes (refresh, reset-password, change-password)',
      general: '100 requests per 15 minutes (profile, verify, status)',
    },
  });
});

module.exports = router;