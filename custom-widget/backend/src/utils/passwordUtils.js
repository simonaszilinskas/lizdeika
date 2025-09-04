/**
 * Password Utilities
 * Handles password hashing, verification, and validation
 */

const bcrypt = require('bcryptjs');

class PasswordUtils {
  constructor() {
    this.saltRounds = 12; // High security level
  }

  /**
   * Hash a password
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @param {string} hashedPassword - Hashed password from database
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hashedPassword) {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      throw new Error('Password verification failed');
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result with strength score and requirements
   */
  validatePasswordStrength(password) {
    const result = {
      isValid: false,
      score: 0,
      requirements: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumbers: false,
        hasSpecialChars: false,
      },
      feedback: [],
    };

    if (!password) {
      result.feedback.push('Password is required');
      return result;
    }

    // Check minimum length (8 characters)
    if (password.length >= 8) {
      result.requirements.minLength = true;
      result.score += 1;
    } else {
      result.feedback.push('Password must be at least 8 characters long');
    }

    // Check for uppercase letters
    if (/[A-Z]/.test(password)) {
      result.requirements.hasUppercase = true;
      result.score += 1;
    } else {
      result.feedback.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letters
    if (/[a-z]/.test(password)) {
      result.requirements.hasLowercase = true;
      result.score += 1;
    } else {
      result.feedback.push('Password must contain at least one lowercase letter');
    }

    // Check for numbers
    if (/\d/.test(password)) {
      result.requirements.hasNumbers = true;
      result.score += 1;
    } else {
      result.feedback.push('Password must contain at least one number');
    }

    // Check for special characters
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      result.requirements.hasSpecialChars = true;
      result.score += 1;
    } else {
      result.feedback.push('Password must contain at least one special character');
    }

    // Check for common weak patterns
    const commonPatterns = [
      /123456/,
      /password/i,
      /admin/i,
      /qwerty/i,
      /abc/i,
    ];

    const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
    if (hasCommonPattern) {
      result.score -= 1;
      result.feedback.push('Password contains common patterns - avoid sequential characters or common words');
    }

    // Password is valid if it meets basic requirements (score >= 4)
    result.isValid = result.score >= 4;

    // Add strength assessment
    if (result.score >= 5) {
      result.strength = 'strong';
    } else if (result.score >= 3) {
      result.strength = 'medium';
    } else {
      result.strength = 'weak';
    }

    return result;
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length (default: 16)
   * @param {Object} options - Generation options
   * @returns {string} Generated password
   */
  generateSecurePassword(length = 16, options = {}) {
    const defaults = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSpecialChars: true,
      excludeSimilar: true, // Exclude similar looking characters (0, O, l, 1, etc.)
    };

    const settings = { ...defaults, ...options };
    
    let charset = '';
    
    if (settings.includeLowercase) {
      charset += settings.excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    }
    
    if (settings.includeUppercase) {
      charset += settings.excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    
    if (settings.includeNumbers) {
      charset += settings.excludeSimilar ? '23456789' : '0123456789';
    }
    
    if (settings.includeSpecialChars) {
      charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }

    if (charset === '') {
      throw new Error('At least one character type must be included');
    }

    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    return password;
  }

  /**
   * Check if password has been previously used
   * @param {string} newPassword - New password to check
   * @param {Array} previousHashes - Array of previous password hashes
   * @returns {Promise<boolean>} True if password was previously used
   */
  async isPreviouslyUsed(newPassword, previousHashes) {
    if (!previousHashes || previousHashes.length === 0) {
      return false;
    }

    for (const hash of previousHashes) {
      const matches = await this.verifyPassword(newPassword, hash);
      if (matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate password reset code (6 digits)
   * @returns {string} 6-digit numeric code
   */
  generateResetCode() {
    return Math.random().toString().slice(2, 8).padStart(6, '0');
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if email format is valid
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check password against common breach databases (placeholder)
   * In production, this could integrate with services like HaveIBeenPwned
   * @param {string} password - Password to check
   * @returns {Promise<boolean>} True if password is found in breach database
   */
  async isPasswordBreached(password) {
    // Placeholder for breach detection
    // In production, integrate with HaveIBeenPwned API or similar service
    const commonBreachedPasswords = [
      'password123',
      '123456789',
      'qwerty123',
      'admin123',
      'password1',
      'welcome123',
    ];

    return commonBreachedPasswords.includes(password.toLowerCase());
  }
}

module.exports = new PasswordUtils();