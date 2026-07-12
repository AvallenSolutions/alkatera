/**
 * Square for Restaurants — reference POS adapter.
 *
 * STATUS: structurally complete but UNVERIFIED against the live Square API —
 * exercising it needs a Square developer account, a registered OAuth app and a
 * sandbox merchant, none of which can be provisioned from the codebase. The
 * OAuth URLs, token exchange and Orders→sales mapping follow Square's documented
 * v2 API; treat the field mapping in fetchSales as needing a sandbox pass before
 * production use.
 *
 * Credentials (env, never in the DB or workspace):
 *   HOSPITALITY_SQUARE_CLIENT_ID, HOSPITALITY_SQUARE_CLIENT_SECRET
 * Access tokens obtained via OAuth are stored per-org outside this file (a
 * secrets manager / encrypted column) — this adapter only reads them via
 * loadToken, which is injected so storage stays out of the adapter.
 */

import type { IntegrationAdapter, AdapterSalesRow, DateRange } from './adapter'
import { INTEGRATION_VENDORS } from './adapter'

const SQUARE_API = 'https://connect.squareup.com'

export function squareAuthorizeUrl(state: string, redirectUri: string): string | null {
  const clientId = process.env.HOSPITALITY_SQUARE_CLIENT_ID?.trim()
  if (!clientId) return null
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'ORDERS_READ ITEMS_READ MERCHANT_PROFILE_READ',
    session: 'false',
    state,
    redirect_uri: redirectUri,
  })
  return `${SQUARE_API}/oauth2/authorize?${params.toString()}`
}

export async function squareExchangeCode(code: string, redirectUri: string): Promise<{ access_token: string; refresh_token?: string; expires_at?: string } | null> {
  const clientId = process.env.HOSPITALITY_SQUARE_CLIENT_ID?.trim()
  const clientSecret = process.env.HOSPITALITY_SQUARE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  const res = await fetch(`${SQUARE_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
  })
  if (!res.ok) return null
  const body = await res.json()
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: body.expires_at }
}

/** Build the adapter with an injected token loader (keeps token storage out of here). */
export function makeSquareAdapter(loadToken: (orgId: string) => Promise<string | null>): IntegrationAdapter {
  const vendor = INTEGRATION_VENDORS.find((v) => v.id === 'square')!
  return {
    vendor,
    async testConnection(orgId) {
      const token = await loadToken(orgId)
      if (!token) return { ok: false, error: 'Not connected' }
      const res = await fetch(`${SQUARE_API}/v2/merchants`, {
        headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2024-01-18' },
      })
      return res.ok ? { ok: true } : { ok: false, error: `Square returned ${res.status}` }
    },
    async fetchSales(orgId, range: DateRange): Promise<AdapterSalesRow[]> {
      const token = await loadToken(orgId)
      if (!token) return []
      // Square Orders search over the date range; aggregate line items by name.
      const res = await fetch(`${SQUARE_API}/v2/orders/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
        body: JSON.stringify({
          query: { filter: { date_time_filter: { closed_at: { start_at: `${range.from}T00:00:00Z`, end_at: `${range.to}T23:59:59Z` } } } },
        }),
      })
      if (!res.ok) return []
      const body = await res.json()
      const counts = new Map<string, number>()
      for (const order of body.orders ?? []) {
        for (const li of order.line_items ?? []) {
          const name = String(li.name ?? '').trim()
          if (!name) continue
          counts.set(name, (counts.get(name) ?? 0) + (Number(li.quantity) || 0))
        }
      }
      return Array.from(counts.entries()).map(([item_name, units_sold]) => ({
        item_name,
        units_sold,
        period_start: range.from,
        period_end: range.to,
      }))
    },
  }
}
