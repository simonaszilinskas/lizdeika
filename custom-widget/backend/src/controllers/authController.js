/**
 * Authentication Controller
 * Handles authentication endpoints: register, login, refresh, logout, password reset
 */

const authService = require('../services/authService');
const activityService = require('../services/activityService');
const { createLogger } = require('../utils/logger');
const logger = createLogger('authController');

class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req, res) {
    const { ipAddress, userAgent } = activityService.constructor.getRequestMetadata(req);
    
    try {
      const result = await authService.registerUser(req.body);
      
      // Log successful registration
      await activityService.logAuth(
        result.user.id, 
        'registration_success', 
        true, 
        ipAddress, 
        userAgent,
        { 
          role: result.user.role,
          email: result.user.email 
        }
      );
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          tokens: result.tokens,
          emailVerificationRequired: result.emailVerificationRequired,
        },
      });
    } catch (error) {
      logger.error('Registration error:', error);
      
      // Log failed registration attempt
      await activityService.logAuth(
        null, 
        'registration_failed', 
        false, 
        ipAddress, 
        userAgent,
        { 
          email: req.body.email,
          error: error.message 
        }
      );
      
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'REGISTRATION_FAILED',
      });
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req, res) {
    const { ipAddress, userAgent } = activityService.constructor.getRequestMetadata(req);

    try {
      const result = await authService.loginUser(req.body);

      // Check if 2FA setup is required (mandatory policy)
      if (result.requires2FASetup) {
        await activityService.logSecurity(
          result.userId,
          '2fa_setup_required',
          true,
          ipAddress,
          userAgent,
          { email: result.email, reason: 'organization_policy' }
        );

        return res.status(200).json({
          success: true,
          requires2FASetup: true,
          message: result.message,
          setupToken: result.setupToken,
          tokenType: result.tokenType,
          data: {
            userId: result.userId,
            email: result.email,
          },
        });
      }

      // Check if 2FA challenge is required
      if (result.requiresTotp) {
        // Log 2FA challenge requested
        await activityService.logSecurity(
          result.userId,
          '2fa_challenge_requested',
          true,
          ipAddress,
          userAgent,
          { email: result.email }
        );

        return res.status(200).json({
          success: true,
          requiresTotp: true,
          message: 'Two-factor authentication required',
          data: {
            email: result.email,
          },
        });
      }

      // Log successful login
      await activityService.logAuth(
        result.user.id,
        result.user.totp_enabled ? '2fa_success' : 'login_success',
        true,
        ipAddress,
        userAgent,
        { role: result.user.role }
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      logger.error('Login error:', error.message);
      logger.error('Error stack:', error.stack);

      // Determine if this was a 2FA failure
      const is2FAFailure = error.message.includes('2FA') || error.message.includes('Too many failed attempts');

      // Log failed login attempt
      await activityService.logAuth(
        null,
        is2FAFailure ? '2fa_failure' : 'login_failed',
        false,
        ipAddress,
        userAgent,
        {
          email: req.body.email,
          error: error.message
        }
      );

      const statusCode = error.message.includes('Invalid email or password') ? 401 : 400;

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: is2FAFailure ? 'TOTP_INVALID' : 'LOGIN_FAILED',
      });
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshAccessToken(refreshToken);
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      
      res.status(401).json({
        success: false,
        error: error.message,
        code: 'TOKEN_REFRESH_FAILED',
      });
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(req, res) {
    const { ipAddress, userAgent } = activityService.constructor.getRequestMetadata(req);
    
    try {
      const { refreshToken } = req.body;
      await authService.logoutUser(refreshToken);
      
      // Log successful logout
      await activityService.logAuth(
        req.user?.id || null, 
        'logout_success', 
        true, 
        ipAddress, 
        userAgent
      );
      
      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error('Logout error:', error);
      
      // Log logout attempt (even if failed, we still consider it a logout)
      await activityService.logAuth(
        req.user?.id || null, 
        'logout_completed', 
        true, 
        ipAddress, 
        userAgent,
        { note: 'Logout completed despite technical error' }
      );
      
      // Even if logout fails, return success to avoid confusion
      res.json({
        success: true,
        message: 'Logout completed',
      });
    }
  }

  /**
   * Request password reset
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req, res) {
    const { ipAddress, userAgent } = activityService.constructor.getRequestMetadata(req);
    
    try {
      const { email } = req.body;
      const result = await authService.requestPasswordReset(email);
      
      // Log password reset request
      await activityService.logSecurity(
        null, 
        'password_reset_requested', 
        true, 
        ipAddress, 
        userAgent,
        { email }
      );
      
      // In production, you would send an email here with the reset token
      // For now, we'll return the token in the response (not recommended for production)
      if (process.env.NODE_ENV === 'development') {
        res.json({
          success: true,
          message: result.message,
          resetToken: result.resetToken, // Only in development
        });
      } else {
        res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        });
      }
    } catch (error) {
      logger.error('Forgot password error:', error);
      
      // Log failed password reset request
      await activityService.logSecurity(
        null, 
        'password_reset_request_failed', 
        false, 
        ipAddress, 
        userAgent,
        { 
          email: req.body.email,
          error: error.message 
        }
      );
      
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'PASSWORD_RESET_REQUEST_FAILED',
      });
    }
  }

  /**
   * Reset password with token
   * POST /api/auth/reset-password
   */
  async resetPassword(req, res) {
    const { ipAddress, userAgent } = activityService.constructor.getRequestMetadata(req);
    
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword(token, newPassword);
      
      // Log successful password reset
      await activityService.logSecurity(
        result.userId || null, 
        'password_reset_completed', 
        true, 
        ipAddress, 
        userAgent
      );
      
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Password reset error:', error);
      
      // Log failed password reset
      await activityService.logSecurity(
        null, 
        'password_reset_failed', 
        false, 
        ipAddress, 
        userAgent,
        { error: error.message }
      );
      
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'PASSWORD_RESET_FAILED',
      });
    }
  }

  /**
   * Change password (authenticated)
   * POST /api/auth/change-password
   */
  async changePassword(req, res) {
    const { ipAddress, userAgent } = activityService.constructor.getRequestMetadata(req);
    
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );
      
      // Log successful password change
      await activityService.logSecurity(
        req.user.id, 
        'password_changed', 
        true, 
        ipAddress, 
        userAgent
      );
      
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Change password error:', error);
      
      // Log failed password change attempt
      await activityService.logSecurity(
        req.user.id, 
        'password_change_failed', 
        false, 
        ipAddress, 
        userAgent,
        { error: error.message }
      );
      
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'PASSWORD_CHANGE_FAILED',
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  async getProfile(req, res) {
    try {
      const user = await authService.getUserProfile(req.user.id);
      
      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      
      res.status(404).json({
        success: false,
        error: error.message,
        code: 'PROFILE_NOT_FOUND',
      });
    }
  }

  /**
   * Verify token validity
   * GET /api/auth/verify
   */
  async verifyToken(req, res) {
    try {
      // If we reach here, the token is valid (due to middleware)
      res.json({
        success: true,
        message: 'Token is valid',
        data: {
          user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            emailVerified: req.user.emailVerified,
          },
        },
      });
    } catch (error) {
      logger.error('Token verification error:', error);
      
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'TOKEN_INVALID',
      });
    }
  }

  /**
   * Get authentication status
   * GET /api/auth/status
   */
  async getAuthStatus(req, res) {
    try {
      const isAuthenticated = !!req.user;
      
      res.json({
        success: true,
        data: {
          isAuthenticated,
          user: isAuthenticated ? {
            id: req.user.id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            role: req.user.role,
            emailVerified: req.user.emailVerified,
            agentStatus: req.user.agentStatus,
          } : null,
        },
      });
    } catch (error) {
      logger.error('Auth status error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get authentication status',
        code: 'AUTH_STATUS_ERROR',
      });
    }
  }

  /**
   * Clean up expired tokens (admin only)
   * POST /api/auth/cleanup-tokens
   */
  async cleanupTokens(req, res) {
    try {
      const deletedCount = await authService.cleanupExpiredTokens();
      
      res.json({
        success: true,
        message: 'Token cleanup completed',
        data: {
          deletedTokens: deletedCount,
        },
      });
    } catch (error) {
      logger.error('Token cleanup error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Token cleanup failed',
        code: 'CLEANUP_FAILED',
      });
    }
  }

  /**
   * Development endpoint to generate test users
   * POST /api/auth/create-test-user (development only)
   */
  async createTestUser(req, res) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not available in production',
        code: 'NOT_AVAILABLE',
      });
    }

    try {
      const testUsers = [
        {
          email: 'admin@test.com',
          password: 'AdminTest123!',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
        },
        {
          email: 'agent@test.com',
          password: 'AgentTest123!',
          firstName: 'Agent',
          lastName: 'User',
          role: 'agent',
        },
        {
          email: 'user@test.com',
          password: 'UserTest123!',
          firstName: 'Regular',
          lastName: 'User',
          role: 'user',
        },
      ];

      const { userType = 'user' } = req.body;
      const userData = testUsers.find(u => u.role === userType) || testUsers[2];

      const result = await authService.registerUser(userData);
      
      res.status(201).json({
        success: true,
        message: `Test ${userType} created successfully`,
        data: {
          user: result.user,
          credentials: {
            email: userData.email,
            password: userData.password,
          },
        },
      });
    } catch (error) {
      logger.error('Create test user error:', error);
      
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'TEST_USER_CREATION_FAILED',
      });
    }
  }

  /**
   * Emergency admin recovery endpoint
   * POST /api/auth/emergency-admin-recovery
   * Requires ADMIN_RECOVERY_KEY environment variable
   */
  async emergencyAdminRecovery(req, res) {
    try {
      const { recoveryKey, adminEmail, newPassword } = req.body;

      if (!recoveryKey || !adminEmail || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Recovery key, admin email, and new password are required',
          code: 'MISSING_PARAMETERS',
        });
      }

      const result = await authService.emergencyAdminRecovery(recoveryKey, adminEmail, newPassword);
      
      res.json({
        success: true,
        message: result.message,
        data: {
          adminId: result.adminId,
          adminEmail: result.adminEmail,
        },
      });
    } catch (error) {
      logger.error('Emergency admin recovery error:', error);
      
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'EMERGENCY_RECOVERY_FAILED',
      });
    }
  }

  /**
   * Create emergency admin account
   * POST /api/auth/emergency-create-admin
   * Only works if no admin exists. Requires ADMIN_RECOVERY_KEY environment variable
   */
  async emergencyCreateAdmin(req, res) {
    try {
      const { recoveryKey, email, password, firstName, lastName } = req.body;

      if (!recoveryKey || !email || !password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required: recoveryKey, email, password, firstName, lastName',
          code: 'MISSING_PARAMETERS',
        });
      }

      const result = await authService.createEmergencyAdmin(recoveryKey, {
        email,
        password,
        firstName,
        lastName,
      });
      
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.admin,
      });
    } catch (error) {
      logger.error('Emergency admin creation error:', error);
      
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'EMERGENCY_ADMIN_CREATION_FAILED',
      });
    }
  }
}

module.exports = new AuthController();