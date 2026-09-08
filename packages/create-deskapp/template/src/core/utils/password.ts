import bcrypt from "bcryptjs";

/** Number of bcrypt salt rounds. Higher is slower but more secure. */
const SALT_ROUNDS = 10;

/**
 * Password hashing + verification, grouped under one namespace.
 *
 * Consumers import this from the facade:
 *   import { pass } from "@/core/facade.ts";
 *   await pass.hashPassword("secret");
 */
export const pass = {
  /**
   * Hash a plaintext password using bcrypt.
   */
  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  /**
   * Check a plaintext password against a stored bcrypt hash.
   */
  verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },
};