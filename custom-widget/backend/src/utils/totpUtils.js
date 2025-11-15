/**
 * TOTP (Time-based One-Time Password) Utilities
 *
 * Handles all TOTP-related operations:
 * - Secret generation and encryption
 * - OTP verification with time window
 * - Backup code generation and validation
 * - Rate limiting for failed attempts
 */

const { authenticator } = require('otplib');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY;
const TOTP_WINDOW = 1; // Allow 1 step before/after (30s window each)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BACKUP_CODE_COUNT = 10;

/**
 * Validate encryption key is configured
 */
function validateEncryptionKey() {
  if (!TOTP_ENCRYPTION_KEY || TOTP_ENCRYPTION_KEY.length < 32) {
    throw new Error('TOTP_ENCRYPTION_KEY must be set and at least 32 characters');
  }
}

/**
 * Encrypt TOTP secret using AES-256-GCM
 * @param {string} plaintext - Secret to encrypt
 * @returns {string} Encrypted secret in format: iv:encrypted:authTag
 */
function encryptSecret(plaintext) {
  validateEncryptionKey();

  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(TOTP_ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt TOTP secret
 * @param {string} encryptedData - Encrypted secret in format: iv:encrypted:authTag
 * @returns {string} Decrypted secret
 */
function decryptSecret(encryptedData) {
  validateEncryptionKey();

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, encrypted, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = crypto.scryptSync(TOTP_ENCRYPTION_KEY, 'salt', 32);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a new TOTP secret
 * @returns {string} Base32-encoded secret
 */
function generateSecret() {
  return authenticator.generateSecret();
}

/**
 * Generate otpauth:// URI for QR code
 * @param {string} secret - Base32 secret
 * @param {string} email - User email
 * @param {string} issuer - Service name
 * @returns {string} otpauth:// URI
 */
function generateOtpauthUri(secret, email, issuer = 'Lizdeika') {
  return authenticator.keyuri(email, issuer, secret);
}

/**
 * Verify a TOTP code
 * @param {string} token - 6-digit code from user
 * @param {string} secret - Base32 secret
 * @returns {boolean} True if valid
 */
function verifyToken(token, secret) {
  try {
    return authenticator.verify({
      token,
      secret,
      window: TOTP_WINDOW,
    });
  } catch (error) {
    return false;
  }
}

/**
 * Generate backup codes
 * @param {number} count - Number of codes to generate
 * @returns {Array<string>} Array of backup codes
 */
function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash backup codes for storage
 * @param {Array<string>} codes - Plaintext backup codes
 * @returns {Promise<Array<string>>} Hashed codes
 */
async function hashBackupCodes(codes) {
  const hashed = [];
  for (const code of codes) {
    const hash = await bcrypt.hash(code, 10);
    hashed.push(hash);
  }
  return hashed;
}

/**
 * Verify a backup code against hashed codes
 * @param {string} code - Code to verify
 * @param {Array<string>} hashedCodes - Array of hashed codes
 * @returns {Promise<{valid: boolean, index: number}>} Validation result
 */
async function verifyBackupCode(code, hashedCodes) {
  if (!hashedCodes || !Array.isArray(hashedCodes)) {
    return { valid: false, index: -1 };
  }

  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(code, hashedCodes[i]);
    if (match) {
      return { valid: true, index: i };
    }
  }

  return { valid: false, index: -1 };
}

/**
 * Check if user is locked out due to failed attempts
 * @param {Object} user - User object with totp_lock_until
 * @returns {boolean} True if locked out
 */
function isLockedOut(user) {
  if (!user.totp_lock_until) {
    return false;
  }

  const now = new Date();
  return now < new Date(user.totp_lock_until);
}

/**
 * Calculate lockout time after failed attempt
 * @param {number} failedAttempts - Current failed attempt count
 * @returns {Date|null} Lockout expiry date or null if not locked
 */
function calculateLockoutTime(failedAttempts) {
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return new Date(Date.now() + LOCKOUT_DURATION_MS);
  }
  return null;
}

/**
 * Get time remaining in lockout
 * @param {Date} lockUntil - Lockout expiry time
 * @returns {number} Seconds remaining
 */
function getLockoutRemaining(lockUntil) {
  const now = new Date();
  const remaining = Math.max(0, new Date(lockUntil) - now);
  return Math.ceil(remaining / 1000);
}

module.exports = {
  encryptSecret,
  decryptSecret,
  generateSecret,
  generateOtpauthUri,
  verifyToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  isLockedOut,
  calculateLockoutTime,
  getLockoutRemaining,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
};
