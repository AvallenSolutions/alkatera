import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Encryption helpers (AES-256-GCM) ──────────────────────────────────

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const hex = process.env.XERO_TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64 || hex.startsWith('your_')) {
    throw new Error(
      'XERO_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Store as iv:authTag:ciphertext (all hex-encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptToken(encrypted: string): string {
  const key = getEncryptionKey()
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':')
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted token format')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}

// ── Token storage (Supabase CRUD) ─────────────────────────────────────

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase service role credentials')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface StoredXeroTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  tenantId: string
  tenantName: string | null
}

export interface StoreTokensInput {
  organizationId: string
  tenantId: string
  tenantName: string | null
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scopes: string[]
  connectedBy?: string
}

/**
 * Encrypt and upsert Xero OAuth tokens for an organisation/tenant connection.
 */
export async function storeTokens(input: StoreTokensInput): Promise<void> {
  const db = getServiceClient()

  const { error } = await db
    .from('xero_connections')
    .upsert(
      {
        organization_id: input.organizationId,
        xero_tenant_id: input.tenantId,
        xero_tenant_name: input.tenantName,
        access_token_encrypted: encryptToken(input.accessToken),
        refresh_token_encrypted: encryptToken(input.refreshToken),
        token_expires_at: input.expiresAt.toISOString(),
        scopes: input.scopes,
        connected_by: input.connectedBy || null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,xero_tenant_id' }
    )

  if (error) {
    throw new Error(`Failed to store Xero tokens: ${error.message}`)
  }
}

/**
 * Load and decrypt Xero OAuth tokens for an organisation.
 * Returns null if no active connection exists.
 */
export async function getTokens(organizationId: string): Promise<StoredXeroTokens | null> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('xero_connections')
    .select('access_token_encrypted, refresh_token_encrypted, token_expires_at, xero_tenant_id, xero_tenant_name')
    .eq('organization_id', organizationId)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load Xero tokens: ${error.message}`)
  }

  if (!data) return null

  return {
    accessToken: decryptToken(data.access_token_encrypted),
    refreshToken: decryptToken(data.refresh_token_encrypted),
    expiresAt: new Date(data.token_expires_at),
    tenantId: data.xero_tenant_id,
    tenantName: data.xero_tenant_name,
  }
}

/**
 * Update only the access and refresh tokens (after a token refresh).
 */
export async function updateTokens(
  organizationId: string,
  tenantId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  const db = getServiceClient()

  const { error } = await db
    .from('xero_connections')
    .update({
      access_token_encrypted: encryptToken(accessToken),
      refresh_token_encrypted: encryptToken(refreshToken),
      token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('xero_tenant_id', tenantId)

  if (error) {
    throw new Error(`Failed to update Xero tokens: ${error.message}`)
  }
}

/**
 * Delete a Xero connection and all related data for an organisation.
 */
export async function deleteConnection(organizationId: string): Promise<void> {
  const db = getServiceClient()

  // Delete in order: transactions, account mappings, sync logs, connection
  // (xero_transactions and xero_account_mappings have org FK cascade,
  //  but we delete explicitly for clarity)
  await db.from('xero_transactions').delete().eq('organization_id', organizationId)
  await db.from('xero_account_mappings').delete().eq('organization_id', organizationId)
  await db.from('xero_sync_logs').delete().eq('organization_id', organizationId)

  const { error } = await db
    .from('xero_connections')
    .delete()
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(`Failed to delete Xero connection: ${error.message}`)
  }
}

/**
 * Get the connection record (without decrypted tokens) for status display.
 */
export async function getConnectionStatus(organizationId: string) {
  const db = getServiceClient()

  const { data, error } = await db
    .from('xero_connections')
    .select('id, xero_tenant_id, xero_tenant_name, connected_at, last_sync_at, sync_status, sync_error, scopes')
    .eq('organization_id', organizationId)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to get Xero connection status: ${error.message}`)
  }

  return data
}

/**
 * Update sync status on the connection record.
 */
export async function updateSyncStatus(
  organizationId: string,
  status: 'idle' | 'syncing' | 'error',
  error?: string
): Promise<void> {
  const db = getServiceClient()

  const update: Record<string, unknown> = {
    sync_status: status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'idle') {
    update.last_sync_at = new Date().toISOString()
    update.sync_error = null
  } else if (status === 'error' && error) {
    update.sync_error = error
  }

  await db
    .from('xero_connections')
    .update(update)
    .eq('organization_id', organizationId)
}
