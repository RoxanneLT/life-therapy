import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // NIST SP 800-38D recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a ciphertext string produced by `encrypt()`.
 * Graceful fallback: if the value doesn't match the encrypted format,
 * returns it as-is. This enables zero-downtime migration from plaintext.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext; // Not encrypted
  const [ivHex, authTagHex, encryptedHex] = parts;
  if (ivHex.length !== IV_LENGTH * 2) return ciphertext; // IV wrong length
  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return ciphertext; // Decryption failed — likely plaintext or corrupted
  }
}

/** Encrypt a nullable string field. Returns null if input is null/undefined. */
export function encryptOrNull(value: string | null | undefined): string | null {
  return value ? encrypt(value) : null;
}

/** Decrypt a nullable string field. Returns null if input is null/undefined. */
export function decryptOrNull(value: string | null | undefined): string | null {
  return value ? decrypt(value) : null;
}

/** Encrypt each element of a string array. */
export function encryptArray(values: string[]): string[] {
  return values.map((v) => encrypt(v));
}

/** Decrypt each element of a string array. */
export function decryptArray(values: string[]): string[] {
  return values.map((v) => decrypt(v));
}
