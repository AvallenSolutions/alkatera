import 'server-only'
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * Get the encryption key for Xero OAuth cookies.
 * Falls back to null if not configured (cookie stored in plaintext).
 */
function getKey(): Buffer | null {
  const secret = process.env.XERO_COOKIE_SECRET
  if (!secret) return null
  // Use first 32 bytes of the secret (SHA-256 would also work)
  return Buffer.from(secret.padEnd(32, '0').slice(0, 32), 'utf-8')
}

/**
 * Encrypt a string payload for storage in an httpOnly cookie.
 * Returns base64-encoded ciphertext. Falls back to plaintext if no secret configured.
 */
export function encryptCookiePayload(plaintext: string): string {
  const key = getKey()
  if (!key) return plaintext

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()

  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypt a cookie payload encrypted by encryptCookiePayload.
 * Falls back to treating input as plaintext JSON if decryption fails or no secret configured.
 */
export function decryptCookiePayload(encoded: string): string {
  const key = getKey()
  if (!key) return encoded

  try {
    const data = Buffer.from(encoded, 'base64')
    if (data.length < IV_LENGTH + TAG_LENGTH) return encoded // Not encrypted

    const iv = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
  } catch {
    // Likely not encrypted (e.g. cookie set before encryption was enabled)
    return encoded
  }
}
