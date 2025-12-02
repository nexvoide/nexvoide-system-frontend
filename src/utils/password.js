/**
 * Simple password hashing utility
 * Note: For production, use a proper library like bcrypt
 * This is a basic implementation for development
 */

/**
 * Hash a password (simple implementation)
 * In production, use bcrypt or similar
 */
export function hashPassword(password) {
  // Simple hash function (NOT secure for production)
  // For production, use: import bcrypt from 'bcryptjs'; return bcrypt.hashSync(password, 10);
  // This is a basic implementation for development
  const salt = 'nexvoide_salt_2024';
  let hash = 0;
  const saltedPassword = password + salt;
  for (let i = 0; i < saltedPassword.length; i++) {
    const char = saltedPassword.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Add salt and convert to string
  return String(Math.abs(hash)) + '_' + password.length + '_' + salt.length;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password, hash) {
  const computedHash = hashPassword(password);
  return computedHash === hash;
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

