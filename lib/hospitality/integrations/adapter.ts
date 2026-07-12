/**
 * Hospitality live-integration adapter interface (scaffold).
 *
 * The hospitality module already ingests POS/procurement data via FILE import
 * (the menu importer and the POS sales-export preview). LIVE integrations —
 * Toast/Square/Lightspeed (POS), Mews/Opera (PMS), Bidfood/Brakes (procurement),
 * Winnow/Leanpath (waste) — need partner API accounts, registered OAuth apps and
 * per-tenant credentials that can't be provisioned from the codebase. This file
 * defines the common seam so each adapter is a small, uniform implementation once
 * credentials exist; nothing here fabricates a connection.
 *
 * Wiring an adapter, when credentials are available:
 *   1. implement IntegrationAdapter for the vendor,
 *   2. store secrets outside the DB (Netlify env / a secrets manager) — never in
 *      the workspace or a dotfile (see CLAUDE.md),
 *   3. register it in ADAPTERS,
 *   4. add a connect/callback route under app/api/hospitality/integrations/[vendor],
 *   5. normalise fetched rows into the existing importers:
 *        - sales   → previewPosSales / createVolume (lib/hospitality/volume-service)
 *        - menus   → extractMenu / commit (lib/hospitality/menu-import)
 *        - waste   → createWaste (lib/hospitality/waste-service)
 *        - covers  → createOperatingPeriod (lib/hospitality/operating-service)
 */

export type IntegrationCategory = 'pos' | 'pms' | 'procurement' | 'waste'

export interface IntegrationVendor {
  id: string
  label: string
  category: IntegrationCategory
  /** How the vendor authenticates; drives the connect flow we build per vendor. */
  auth: 'oauth2' | 'api_key'
  /** True once an adapter implementation + credentials exist. */
  available: boolean
  /** What we would pull once connected. */
  provides: Array<'sales' | 'covers' | 'menus' | 'occupancy' | 'procurement' | 'waste'>
}

export interface DateRange {
  from: string // YYYY-MM-DD
  to: string
}

/** A normalised sales/throughput row an adapter yields (maps to service volumes). */
export interface AdapterSalesRow {
  item_name: string
  units_sold: number
  period_start: string
  period_end: string
}

export interface IntegrationAdapter {
  vendor: IntegrationVendor
  /** Verify stored credentials without side effects. */
  testConnection(orgId: string): Promise<{ ok: boolean; error?: string }>
  /** Pull item-level sales for the range (empty until implemented). */
  fetchSales(orgId: string, range: DateRange): Promise<AdapterSalesRow[]>
}

/**
 * The catalogue of vendors the module targets. `available: false` everywhere
 * until an adapter + credentials are wired — the UI reads this to show
 * "connect (coming soon)" vs a live connect button, and never implies a
 * connection that doesn't exist.
 */
export const INTEGRATION_VENDORS: IntegrationVendor[] = [
  { id: 'toast', label: 'Toast', category: 'pos', auth: 'oauth2', available: false, provides: ['sales', 'covers', 'menus'] },
  { id: 'square', label: 'Square for Restaurants', category: 'pos', auth: 'oauth2', available: false, provides: ['sales', 'covers', 'menus'] },
  { id: 'lightspeed', label: 'Lightspeed Restaurant', category: 'pos', auth: 'oauth2', available: false, provides: ['sales', 'covers', 'menus'] },
  { id: 'mews', label: 'Mews', category: 'pms', auth: 'oauth2', available: false, provides: ['occupancy'] },
  { id: 'opera', label: 'Oracle OPERA', category: 'pms', auth: 'api_key', available: false, provides: ['occupancy'] },
  { id: 'bidfood', label: 'Bidfood', category: 'procurement', auth: 'api_key', available: false, provides: ['procurement'] },
  { id: 'brakes', label: 'Brakes', category: 'procurement', auth: 'api_key', available: false, provides: ['procurement'] },
  { id: 'winnow', label: 'Winnow', category: 'waste', auth: 'api_key', available: false, provides: ['waste'] },
  { id: 'leanpath', label: 'Leanpath', category: 'waste', auth: 'api_key', available: false, provides: ['waste'] },
]

/** Registered adapter implementations, keyed by vendor id. Empty until wired. */
export const ADAPTERS: Record<string, IntegrationAdapter> = {}

export function getAdapter(vendorId: string): IntegrationAdapter | null {
  return ADAPTERS[vendorId] ?? null
}

/**
 * Whether a vendor has its OAuth/API credentials configured in the environment.
 * Env var convention: HOSPITALITY_<VENDOR>_CLIENT_ID + _CLIENT_SECRET for oauth2,
 * HOSPITALITY_<VENDOR>_API_KEY for api_key. Missing creds → the vendor shows as
 * "needs setup" and the connect route returns 501 rather than a broken flow.
 */
export function isVendorConfigured(vendor: IntegrationVendor): boolean {
  const prefix = `HOSPITALITY_${vendor.id.toUpperCase()}`
  if (vendor.auth === 'oauth2') {
    return Boolean(process.env[`${prefix}_CLIENT_ID`]?.trim() && process.env[`${prefix}_CLIENT_SECRET`]?.trim())
  }
  return Boolean(process.env[`${prefix}_API_KEY`]?.trim())
}

/** The vendor catalogue with live `configured` status resolved from the environment. */
export function vendorCatalogue(): Array<IntegrationVendor & { configured: boolean }> {
  return INTEGRATION_VENDORS.map((v) => ({ ...v, configured: isVendorConfigured(v) }))
}
