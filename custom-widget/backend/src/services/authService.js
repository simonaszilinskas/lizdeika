/**
 * Authentication Service
 * Handles user authentication, registration, and token management
 */

const databaseClient = require('../utils/database');
const tokenUtils = require('../utils/tokenUtils');
const passwordUtils = require('../utils/passwordUtils');

class AuthService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    if (!this.db) {
      this.db = databaseClient.getClient();
    }
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user and tokens
   */
  async registerUser(userData) {
    await this.initialize();

    const { email, password, firstName, lastName, role = 'user' } = userData;

    // Check if user already exists
    const existingUser = await this.db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    const passwordValidation = passwordUtils.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.feedback.join(', ')}`);
    }

    // Check if password is breached
    const isBreached = await passwordUtils.isPasswordBreached(password);
    if (isBreached) {
      throw new Error('This password has been found in data breaches. Please choose a different password.');
    }

    // Hash password
    const passwordHash = await passwordUtils.hashPassword(password);

    // Create user
    const user = await this.db.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        emailVerified: false,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Create agent status if user is an agent
    if (role === 'agent') {
      await this.db.agentStatus.create({
        data: {
          userId: user.id,
          status: 'offline',
        },
      });
    }

    // Generate tokens
    const tokens = tokenUtils.generateTokenPair(user);

    // Store refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Log user registration
    await this.db.systemLog.create({
      data: {
        action: 'user_registered',
        details: {
          userId: user.id,
          email: user.email,
          role: user.role,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return {
      user,
      tokens,
      emailVerificationRequired: true,
    };
  }

  /**
   * Authenticate user login
   * @param {Object} credentials - Login credentials
   * @returns {Promise<Object>} User data and tokens
   */
  async loginUser(credentials) {
    await this.initialize();

    const { email, password } = credentials;

    // Find user by email
    const user = await this.db.user.findUnique({
      where: { email },
      include: {
        agentStatus: true,
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated. Please contact administrator.');
    }

    // Verify password
    const isPasswordValid = await passwordUtils.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const tokens = tokenUtils.generateTokenPair(user);

    // Store refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Update last login
    await this.db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Set agent status to online if user is an agent
    if (user.role === 'agent' && user.agentStatus) {
      await this.db.agentStatus.update({
        where: { userId: user.id },
        data: { status: 'online' },
      });
    }

    // Log user login
    await this.db.systemLog.create({
      data: {
        action: 'user_login',
        details: {
          userId: user.id,
          email: user.email,
          role: user.role,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Remove sensitive data
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New access token
   */
  async refreshAccessToken(refreshToken) {
    await this.initialize();

    // Verify refresh token
    let decoded;
    try {
      decoded = tokenUtils.verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    // Find stored refresh token
    const storedToken = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.isRevoked) {
      throw new Error('Refresh token not found or revoked');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      // Clean up expired token
      await this.db.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new Error('Refresh token expired');
    }

    // Check if user is still active
    if (!storedToken.user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Generate new access token
    const newAccessToken = tokenUtils.generateAccessToken(storedToken.user);

    // Optionally rotate refresh token (for enhanced security)
    const shouldRotateRefreshToken = Math.random() > 0.7; // 30% chance
    let newRefreshToken = refreshToken;

    if (shouldRotateRefreshToken) {
      // Generate new refresh token
      newRefreshToken = tokenUtils.generateRefreshToken(storedToken.user.id);
      
      // Update stored token
      await this.db.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: tokenUtils.parseExpiresIn(process.env.JWT_ACCESS_EXPIRES_IN || '15m'),
    };
  }

  /**
   * Logout user (revoke refresh token)
   * @param {string} refreshToken - Refresh token to revoke
   * @returns {Promise<void>}
   */
  async logoutUser(refreshToken) {
    await this.initialize();

    if (!refreshToken) {
      return; // No token to revoke
    }

    // Find and revoke refresh token
    const storedToken = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (storedToken) {
      // Set agent status to offline if user is an agent
      if (storedToken.user.role === 'agent') {
        await this.db.agentStatus.updateMany({
          where: { userId: storedToken.user.id },
          data: { status: 'offline' },
        });
      }

      // Delete refresh token
      await this.db.refreshToken.delete({
        where: { id: storedToken.id },
      });

      // Log user logout
      await this.db.systemLog.create({
        data: {
          action: 'user_logout',
          details: {
            userId: storedToken.user.id,
            email: storedToken.user.email,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Reset token and instructions
   */
  async requestPasswordReset(email) {
    await this.initialize();

    // Find user by email
    const user = await this.db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Generate password reset token
    const resetToken = tokenUtils.generatePasswordResetToken(user.id, user.email);

    // Log password reset request
    await this.db.systemLog.create({
      data: {
        action: 'password_reset_requested',
        details: {
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return {
      resetToken,
      email: user.email,
      message: 'Password reset token generated',
    };
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Success message
   */
  async resetPassword(token, newPassword) {
    await this.initialize();

    // Verify reset token
    let decoded;
    try {
      decoded = tokenUtils.verifyPasswordResetToken(token);
    } catch (error) {
      throw new Error('Invalid or expired reset token');
    }

    // Find user
    const user = await this.db.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or account deactivated');
    }

    // Validate new password
    const passwordValidation = passwordUtils.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.feedback.join(', ')}`);
    }

    // Check if password is breached
    const isBreached = await passwordUtils.isPasswordBreached(newPassword);
    if (isBreached) {
      throw new Error('This password has been found in data breaches. Please choose a different password.');
    }

    // Check if new password is same as old password
    const isSamePassword = await passwordUtils.verifyPassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new Error('New password must be different from current password');
    }

    // Hash new password
    const newPasswordHash = await passwordUtils.hashPassword(newPassword);

    // Update password
    await this.db.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all refresh tokens for security
    await this.db.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    // Log password reset
    await this.db.systemLog.create({
      data: {
        action: 'password_reset_completed',
        details: {
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Success message
   */
  async changePassword(userId, currentPassword, newPassword) {
    await this.initialize();

    // Find user
    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or account deactivated');
    }

    // Verify current password
    const isCurrentPasswordValid = await passwordUtils.verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = passwordUtils.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.feedback.join(', ')}`);
    }

    // Check if new password is same as current password
    const isSamePassword = await passwordUtils.verifyPassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new Error('New password must be different from current password');
    }

    // Hash new password
    const newPasswordHash = await passwordUtils.hashPassword(newPassword);

    // Update password
    await this.db.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all other refresh tokens for security (keep current session)
    await this.db.refreshToken.deleteMany({
      where: { 
        userId: userId,
        expiresAt: { lt: new Date(Date.now() + 24 * 60 * 60 * 1000) } // Delete tokens expiring within 24 hours
      },
    });

    // Log password change
    await this.db.systemLog.create({
      data: {
        action: 'password_changed',
        details: {
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  /**
   * Get user profile by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile(userId) {
    await this.initialize();

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        agentStatus: {
          select: {
            status: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Clean up expired refresh tokens
   * @returns {Promise<number>} Number of tokens cleaned up
   */
  async cleanupExpiredTokens() {
    await this.initialize();

    const result = await this.db.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      await this.db.systemLog.create({
        data: {
          action: 'expired_tokens_cleanup',
          details: {
            tokensDeleted: result.count,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }

    return result.count;
  }
}

module.exports = new AuthService();