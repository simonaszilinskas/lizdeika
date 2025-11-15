/**
 * JWT Token Utilities
 * Handles JWT token generation, validation, and refresh logic
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenUtils {
  constructor() {
    this.accessSecret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET;
    this.accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (!this.accessSecret || !this.refreshSecret) {
      throw new Error('JWT secrets not configured. Check JWT_SECRET and JWT_REFRESH_SECRET in environment variables.');
    }
  }

  /**
   * Generate access token
   * @param {Object} payload - User data to include in token
   * @returns {string} JWT access token
   */
  generateAccessToken(payload) {
    const tokenPayload = {
      sub: payload.userId || payload.id,
      email: payload.email,
      role: payload.role,
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(tokenPayload, this.accessSecret, {
      expiresIn: this.accessExpiresIn,
      issuer: 'lizdeika',
      audience: 'lizdeika-users',
    });
  }

  /**
   * Generate refresh token
   * @param {string} userId - User ID
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(userId) {
    const tokenId = crypto.randomUUID();
    
    const payload = {
      jti: tokenId,
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
      issuer: 'lizdeika',
      audience: 'lizdeika-refresh',
    });
  }

  /**
   * Generate both access and refresh tokens
   * @param {Object} user - User object
   * @returns {Object} Token pair
   */
  generateTokenPair(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.parseExpiresIn(this.accessExpiresIn),
    };
  }

  /**
   * Verify access token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.accessSecret, {
        issuer: 'lizdeika',
        audience: 'lizdeika-users',
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - Refresh token to verify
   * @returns {Object} Decoded token payload
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshSecret, {
        issuer: 'lizdeika',
        audience: 'lizdeika-refresh',
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error('Refresh token verification failed');
      }
    }
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Extracted token
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Generate email verification token
   * @param {string} email - User email
   * @returns {string} Verification token
   */
  generateEmailVerificationToken(email) {
    const payload = {
      email,
      type: 'email_verification',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.accessSecret, {
      expiresIn: '24h',
      issuer: 'lizdeika',
      audience: 'email-verification',
    });
  }

  /**
   * Verify email verification token
   * @param {string} token - Verification token
   * @returns {Object} Decoded payload
   */
  verifyEmailVerificationToken(token) {
    try {
      return jwt.verify(token, this.accessSecret, {
        issuer: 'lizdeika',
        audience: 'email-verification',
      });
    } catch (error) {
      throw new Error('Invalid or expired verification token');
    }
  }

  /**
   * Generate password reset token
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @returns {string} Reset token
   */
  generatePasswordResetToken(userId, email) {
    const payload = {
      sub: userId,
      email,
      type: 'password_reset',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.accessSecret, {
      expiresIn: '1h',
      issuer: 'lizdeika',
      audience: 'password-reset',
    });
  }

  /**
   * Verify password reset token
   * @param {string} token - Reset token
   * @returns {Object} Decoded payload
   */
  verifyPasswordResetToken(token) {
    try {
      return jwt.verify(token, this.accessSecret, {
        issuer: 'lizdeika',
        audience: 'password-reset',
      });
    } catch (error) {
      throw new Error('Invalid or expired reset token');
    }
  }

  /**
   * Parse expires in string to seconds
   * @param {string} expiresIn - Expiration string (e.g., '15m', '7d')
   * @returns {number} Seconds until expiration
   */
  parseExpiresIn(expiresIn) {
    const units = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // Default 15 minutes
    }

    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  /**
   * Get token expiration date
   * @param {string} token - JWT token
   * @returns {Date} Expiration date
   */
  getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} True if expired
   */
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    return expiration ? expiration < new Date() : true;
  }

  /**
   * Generate 2FA setup token (short-lived, limited scope)
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @param {string} role - User role
   * @returns {string} 2FA setup token
   */
  generate2FASetupToken(userId, email, role) {
    const payload = {
      sub: userId,
      email,
      role,
      type: '2fa_setup',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.accessSecret, {
      expiresIn: '15m', // Short-lived: 15 minutes to complete setup
      issuer: 'lizdeika',
      audience: '2fa-setup',
    });
  }

  /**
   * Verify 2FA setup token
   * @param {string} token - Setup token
   * @returns {Object} Decoded payload
   */
  verify2FASetupToken(token) {
    try {
      return jwt.verify(token, this.accessSecret, {
        issuer: 'lizdeika',
        audience: '2fa-setup',
      });
    } catch (error) {
      throw new Error('Invalid or expired 2FA setup token');
    }
  }
}

module.exports = new TokenUtils();