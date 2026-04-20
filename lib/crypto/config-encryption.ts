import 'server-only'
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

// Shared AES-256-GCM helper for encrypting integration credentials at rest in
// public.integration_connections.encrypted_config (jsonb). The ciphertext
// format is an object rather than a blob string so you can read IV / authTag
// separately without having to split a packed string.
//
// Key material is INTEGRATION_CONFIG_KEY from env. Pad-or-truncate to 32
// bytes — cleartext strings are fine; prefer a ≥32-byte base64/hex secret.
//
// This helper is intentionally separate from lib/xero/cookie-crypto.ts for
// now. Xero has its own key (XERO_COOKIE_SECRET) to avoid a key-rotation
// risk while migrating. A future refactor may merge them.

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const secret = process.env.INTEGRATION_CONFIG_KEY
  if (!secret) {
    throw new Error(
      'INTEGRATION_CONFIG_KEY is required for encrypting integration credentials',
    )
  }
  return Buffer.from(secret.padEnd(32, '0').slice(0, 32), 'utf-8')
}

export interface EncryptedConfig {
  iv: string
  authTag: string
  ciphertext: string
  v: 1
}

export function encryptConfig(payload: unknown): EncryptedConfig {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf-8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    v: 1,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  }
}

export function decryptConfig<T = unknown>(payload: EncryptedConfig | unknown): T {
  const key = getKey()
  const p = payload as EncryptedConfig
  if (!p || typeof p !== 'object' || !('iv' in p) || !('authTag' in p) || !('ciphertext' in p)) {
    throw new Error('Invalid encrypted config payload')
  }
  const iv = Buffer.from(p.iv, 'base64')
  const authTag = Buffer.from(p.authTag, 'base64')
  const ciphertext = Buffer.from(p.ciphertext, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
  return JSON.parse(plaintext) as T
}
