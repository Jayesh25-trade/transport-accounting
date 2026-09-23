// ============================================================
// PASSWORD HASHING HELPER
// Secure password hashing and verification using Node.js crypto.scryptSync.
// Never stores or logs plaintext passwords.
// Uses constant-time buffer comparison to prevent timing attacks.
// ============================================================

import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const KEY_LEN = 64;
const SALT_LEN = 16;
const ALGORITHM = "scrypt";

/**
 * Hashes a plaintext password securely with a unique random salt.
 * Output format: `scrypt$SALT_HEX$DERIVED_KEY_HEX`
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  const salt = randomBytes(SALT_LEN).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${ALGORITHM}$${salt}$${derivedKey}`;
}

/**
 * Verifies a plaintext password against a stored `scrypt$salt$hash` string.
 * Uses timingSafeEqual to protect against timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash || typeof storedHash !== "string") {
    return false;
  }
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== ALGORITHM) {
    return false;
  }
  const [, salt, expectedKeyHex] = parts;
  const derivedKeyBuf = scryptSync(password, salt, KEY_LEN);
  const expectedKeyBuf = Buffer.from(expectedKeyHex, "hex");

  if (derivedKeyBuf.length !== expectedKeyBuf.length) {
    return false;
  }
  return timingSafeEqual(derivedKeyBuf, expectedKeyBuf);
}
