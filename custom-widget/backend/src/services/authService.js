/**
 * Authentication Service
 * Handles user authentication, registration, and token management
 */

const databaseClient = require('../utils/database');
const tokenUtils = require('../utils/tokenUtils');
const passwordUtils = require('../utils/passwordUtils');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');

class AuthService {
  constructor() {
    this.db = null;
    this.logger = createLogger('authService');
  }

  async initialize() {
    if (!this.db) {
      try {
        // Ensure database is connected
        await databaseClient.connect();
        this.db = databaseClient.getClient();
        this.logger.info('AuthService initialized successfully');
      } catch (error) {
        this.logger.logError(error, { context: 'Database initialization failed' });
        throw new Error('Database connection failed. Please ensure PostgreSQL is running.');
      }
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
    const existingUser = await this.db.users.findUnique({
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
    const user = await this.db.users.create({
      data: {
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role,
        email_verified: false,
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        emailVerified: true,
        is_active: true,
        createdAt: true,
      },
    });

    // Create agent status if user is an agent
    if (role === 'agent') {
      await this.db.agentStatus.create({
        data: {
          user_id: user.id,
          status: 'offline',
        },
      });
    }

    // Generate tokens
    const tokens = tokenUtils.generateTokenPair(user);

    // Store refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await this.db.refresh_tokens.create({
      data: {
        id: uuidv4(),
        user_id: user.id,
        token: tokens.refreshToken,
        expires_at: refreshTokenExpiry,
      },
    });

    // Log user registration
    await this.db.system_logs.create({
      data: {
        action: 'user_registered',
        details: {
          user_id: user.id,
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
    const user = await this.db.users.findUnique({
      where: { email },
      include: {
        agent_status: true,
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated. Please contact administrator.');
    }

    // Verify password
    const isPasswordValid = await passwordUtils.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const tokens = tokenUtils.generateTokenPair(user);

    // Store refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await this.db.refresh_tokens.create({
      data: {
        id: uuidv4(),
        user_id: user.id,
        token: tokens.refreshToken,
        expires_at: refreshTokenExpiry,
      },
    });

    // Update last login
    await this.db.users.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    // Set agent status to online if user is an agent
    if (user.role === 'agent' && user.agentStatus) {
      await this.db.agentStatus.update({
        where: { user_id: user.id },
        data: { status: 'online' },
      });
    }

    // Log user login
    await this.db.system_logs.create({
      data: {
        id: uuidv4(),
        action: 'user_login',
        details: {
          user_id: user.id,
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
    const storedToken = await this.db.refresh_tokens.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.isRevoked) {
      throw new Error('Refresh token not found or revoked');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      // Clean up expired token
      await this.db.refresh_tokens.delete({
        where: { id: storedToken.id },
      });
      throw new Error('Refresh token expired');
    }

    // Check if user is still active
    if (!storedToken.users.is_active) {
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
      await this.db.refresh_tokens.update({
        where: { id: storedToken.id },
        data: {
          token: newRefreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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
    const storedToken = await this.db.refresh_tokens.findUnique({
      where: { token: refreshToken },
      include: { users: true },
    });

    if (storedToken) {
      // Set agent status to offline if user is an agent
      if (storedToken.users.role === 'agent') {
        await this.db.agent_status.updateMany({
          where: { user_id: storedToken.users.id },
          data: { status: 'offline' },
        });
      }

      // Delete refresh token
      await this.db.refresh_tokens.delete({
        where: { id: storedToken.id },
      });

      // Log user logout
      await this.db.system_logs.create({
        data: {
          action: 'user_logout',
          details: {
            user_id: storedToken.users.id,
            email: storedToken.users.email,
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
    const user = await this.db.users.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Generate password reset token
    const resetToken = tokenUtils.generatePasswordResetToken(user.id, user.email);

    // Log password reset request
    await this.db.system_logs.create({
      data: {
        action: 'password_reset_requested',
        details: {
          user_id: user.id,
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
    const user = await this.db.users.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || !user.is_active) {
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
    await this.db.users.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all refresh tokens for security
    await this.db.refresh_tokens.deleteMany({
      where: { user_id: user.id },
    });

    // Log password reset
    await this.db.system_logs.create({
      data: {
        action: 'password_reset_completed',
        details: {
          user_id: user.id,
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
    const user = await this.db.users.findUnique({
      where: { id: userId },
    });

    if (!user || !user.is_active) {
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
    await this.db.users.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all other refresh tokens for security (keep current session)
    await this.db.refresh_tokens.deleteMany({
      where: { 
        user_id: userId,
        expires_at: { lt: new Date(Date.now() + 24 * 60 * 60 * 1000) } // Delete tokens expiring within 24 hours
      },
    });

    // Log password change
    await this.db.system_logs.create({
      data: {
        action: 'password_changed',
        details: {
          user_id: user.id,
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

    const user = await this.db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        email_verified: true,
        is_active: true,
        last_login: true,
        created_at: true,
        agent_status: {
          select: {
            status: true,
            updated_at: true,
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

    const result = await this.db.refresh_tokens.deleteMany({
      where: {
        expires_at: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      await this.db.system_logs.create({
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

  /**
   * Emergency admin recovery - create or reset admin password
   * This is a failsafe for when admin loses password
   * @param {string} recoveryKey - Environment-based recovery key
   * @param {string} adminEmail - Admin email to recover
   * @param {string} newPassword - New password to set
   * @returns {Promise<Object>} Recovery result
   */
  async emergencyAdminRecovery(recoveryKey, adminEmail, newPassword) {
    await this.initialize();

    // Check if recovery is enabled and key matches
    const expectedKey = process.env.ADMIN_RECOVERY_KEY;
    if (!expectedKey || recoveryKey !== expectedKey) {
      throw new Error('Invalid recovery key or emergency recovery not enabled');
    }

    // Find admin user
    const admin = await this.db.users.findFirst({
      where: { 
        email: adminEmail.toLowerCase(),
        role: 'admin'
      }
    });

    if (!admin) {
      throw new Error('Admin user not found');
    }

    // Validate new password
    const passwordValidation = passwordUtils.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.feedback.join(', ')}`);
    }

    // Hash new password
    const hashedPassword = await passwordUtils.hashPassword(newPassword);

    // Update admin password
    await this.db.users.update({
      where: { id: admin.id },
      data: {
        password_hash: hashedPassword,
        is_active: true, // Ensure account is active
        updated_at: new Date()
      }
    });

    // Revoke all existing tokens
    await this.db.refresh_tokens.deleteMany({
      where: { user_id: admin.id }
    });

    // Log recovery action
    await this.db.system_logs.create({
      data: {
        id: require('crypto').randomUUID(),
        action: 'emergency_admin_recovery',
        details: {
          admin_id: admin.id,
          admin_email: admin.email,
          timestamp: new Date().toISOString(),
          recovery_ip: 'system'
        },
        created_at: new Date()
      }
    });

    return {
      success: true,
      message: 'Admin password reset successfully via emergency recovery',
      adminId: admin.id,
      adminEmail: admin.email
    };
  }

  /**
   * Create emergency admin account
   * Only works if no admin exists in the system
   * @param {string} recoveryKey - Environment-based recovery key
   * @param {Object} adminData - Admin account data
   * @returns {Promise<Object>} Creation result
   */
  async createEmergencyAdmin(recoveryKey, adminData) {
    await this.initialize();

    // Check if recovery is enabled and key matches
    const expectedKey = process.env.ADMIN_RECOVERY_KEY;
    if (!expectedKey || recoveryKey !== expectedKey) {
      throw new Error('Invalid recovery key or emergency recovery not enabled');
    }

    // Check if any admin already exists
    const existingAdmin = await this.db.users.findFirst({
      where: { role: 'admin' }
    });

    if (existingAdmin) {
      throw new Error('Admin already exists. Use password recovery instead.');
    }

    const { email, password, firstName, lastName } = adminData;

    // Validate password
    const passwordValidation = passwordUtils.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.feedback.join(', ')}`);
    }

    // Hash password
    const hashedPassword = await passwordUtils.hashPassword(password);

    // Create admin user
    const adminUser = await this.db.users.create({
      data: {
        id: require('crypto').randomUUID(),
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        is_active: true,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // Log creation
    await this.db.system_logs.create({
      data: {
        id: require('crypto').randomUUID(),
        action: 'emergency_admin_created',
        details: {
          admin_id: adminUser.id,
          admin_email: adminUser.email,
          timestamp: new Date().toISOString()
        },
        created_at: new Date()
      }
    });

    return {
      success: true,
      message: 'Emergency admin account created successfully',
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name
      }
    };
  }
}

module.exports = new AuthService();