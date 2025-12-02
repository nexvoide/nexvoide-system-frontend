/**
 * Password hashing utility using bcrypt
 * Secure password hashing for production use
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {string} - Bcrypt hash
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * Supports both bcrypt hashes (new) and legacy hashes (old format)
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Stored hash (bcrypt or legacy)
 * @returns {boolean} - True if password matches
 */
export function verifyPassword(password, hash) {
  if (!password || !hash) {
    return false;
  }
  
  // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    // New bcrypt hash
    return bcrypt.compareSync(password, hash);
  }
  
  // Legacy hash format (for backward compatibility during migration)
  // This allows old passwords to still work, but they should be updated
  const salt = 'nexvoide_salt_2024';
  let legacyHash = 0;
  const saltedPassword = password + salt;
  for (let i = 0; i < saltedPassword.length; i++) {
    const char = saltedPassword.charCodeAt(i);
    legacyHash = ((legacyHash << 5) - legacyHash) + char;
    legacyHash = legacyHash & legacyHash;
  }
  const computedLegacyHash = String(Math.abs(legacyHash)) + '_' + password.length + '_' + salt.length;
  
  return computedLegacyHash === hash;
}

/**
 * Generate a random password
 */
export function generatePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

