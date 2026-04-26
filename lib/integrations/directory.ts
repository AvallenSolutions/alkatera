// Integration directory — the static registry of providers surfaced on the
// Integrations settings tab and the onboarding "Connect your tools" step.
//
// Entries marked `status: 'available'` have a working connect flow.
// Entries marked `status: 'coming_soon'` render in the grid with a
// "Request access" CTA that logs a row in integration_requests — Tim uses
// those counts to prioritise what to build next.

export type IntegrationCategory =
  | 'accounting'
  | 'hr'
  | 'inventory'
  | 'brewery_management'
  | 'winery_management'
  | 'expenses'
  | 'utilities'

export type IntegrationAuthType = 'oauth' | 'api_key' | 'manual_export'

export type IntegrationStatus = 'available' | 'coming_soon'

export interface IntegrationProvider {
  slug: string
  name: string
  category: IntegrationCategory
  status: IntegrationStatus
  description: string
  authType: IntegrationAuthType
  docsUrl?: string
  /** Comma-separated data types this sync delivers. Shown as a subtitle on the card. */
  provides: string[]
  /** Optional feature code — when set, 'available' flips to 'coming_soon' if the org doesn't have it. */
  featureFlag?: string
}

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  accounting: 'Accounting',
  hr: 'People & HR',
  inventory: 'Inventory Management',
  brewery_management: 'Brewery Management',
  winery_management: 'Winery Management',
  expenses: 'Expenses & Travel',
  utilities: 'Utility Providers',
}

export const CATEGORY_ORDER: IntegrationCategory[] = [
  'accounting',
  'brewery_management',
  'winery_management',
  'inventory',
  'hr',
  'expenses',
  'utilities',
]

export const INTEGRATIONS: IntegrationProvider[] = [
  // ── Accounting ─────────────────────────────────────────────────────
  {
    slug: 'xero',
    name: 'Xero',
    category: 'accounting',
    status: 'available',
    authType: 'oauth',
    description: 'Pull invoices and bank transactions for spend-based Scope 3 emissions. Auto-classified by Claude into emission categories.',
    provides: ['Invoices', 'Bank transactions', 'Supplier list'],
    docsUrl: 'https://developer.xero.com/',
    featureFlag: 'xero_integration_beta',
  },
  {
    slug: 'quickbooks',
    name: 'QuickBooks',
    category: 'accounting',
    status: 'coming_soon',
    authType: 'oauth',
    description: 'Same spend-based data as Xero for QuickBooks Online users.',
    provides: ['Invoices', 'Bank transactions', 'Supplier list'],
  },
  {
    slug: 'sage',
    name: 'Sage Business Cloud',
    category: 'accounting',
    status: 'coming_soon',
    authType: 'oauth',
    description: 'Sage 50, Sage Intacct, and Business Cloud accounting imports.',
    provides: ['Invoices', 'Purchase ledger'],
  },
  {
    slug: 'freeagent',
    name: 'FreeAgent',
    category: 'accounting',
    status: 'coming_soon',
    authType: 'oauth',
    description: 'Popular with UK small breweries and distilleries.',
    provides: ['Invoices', 'Bank transactions'],
  },

  // ── Brewery ────────────────────────────────────────────────────────
  {
    slug: 'breww',
    name: 'Breww',
    category: 'brewery_management',
    status: 'available',
    authType: 'api_key',
    description: 'Sync production volumes, batch ingredients, and packaging types directly from your Breww account.',
    provides: ['Production volumes', 'Batch ingredients', 'Packaging types', 'Products'],
    docsUrl: 'https://breww.com/integrations',
    featureFlag: 'breww_integration_beta',
  },
  {
    slug: 'ollie',
    name: 'Ollie',
    category: 'brewery_management',
    status: 'coming_soon',
    authType: 'api_key',
    description: 'Brewery operations platform — batches, inventory, sales.',
    provides: ['Production volumes', 'Batches'],
  },
  {
    slug: 'beer30',
    name: 'Beer30',
    category: 'brewery_management',
    status: 'coming_soon',
    authType: 'api_key',
    description: 'Taproom and brewery management.',
    provides: ['Production volumes', 'Sales'],
  },

  // ── Winery ─────────────────────────────────────────────────────────
  {
    slug: 'vinlink',
    name: 'VinLink',
    category: 'winery_management',
    status: 'coming_soon',
    authType: 'api_key',
    description: 'Winery production and cellar management.',
    provides: ['Production volumes', 'Vintage data'],
  },
  {
    slug: 'orchestra',
    name: 'Orchestra Software',
    category: 'winery_management',
    status: 'coming_soon',
    authType: 'api_key',
    description: 'Winery operations — inventory, production, compliance.',
    provides: ['Production volumes', 'Compliance reports'],
  },

  // ── Inventory ──────────────────────────────────────────────────────
  {
    slug: 'cin7',
    name: 'Cin7',
    category: 'inventory',
    status: 'coming_soon',
    authType: 'oauth',
    description: 'Inventory management with multi-channel sales.',
    provides: ['Product catalog', 'Stock movements'],
  },
  {
    slug: 'unleashed',
    name: 'Unleashed',
    category: 'inventory',
    status: 'coming_soon',
    authType: 'api_key',
    description: 'Inventory management for manufacturers and distributors.',
    provides: ['Product catalog', 'Production runs'],
  },
  {
    slug: 'katana',
    name: 'Katana',
    category: 'inventory',
    status: 'coming_soon',
    authType: 'api_key',
    description: 'Manufacturing ERP with live inventory.',
    provides: ['Production orders', 'BOM data'],
  },

  // ── HR ─────────────────────────────────────────────────────────────
  {
    slug: 'bamboohr',
    name: 'BambooHR',
    category: 'hr',
    status: 'coming_soon',
    authType: 'api_key',
    description: 'Employee records, headcount, diversity data for social impact reporting.',
    provides: ['Headcount', 'Tenure', 'Training records'],
  },
  {
    slug: 'hibob',
    name: 'HiBob',
    category: 'hr',
    status: 'coming_soon',
    authType: 'oauth',
    description: 'People platform with strong DEI reporting.',
    provides: ['Headcount', 'DEI breakdown', 'Engagement'],
  },
  {
    slug: 'personio',
    name: 'Personio',
    category: 'hr',
    status: 'coming_soon',
    authType: 'oauth',
    description: 'European HR platform popular with SMEs.',
    provides: ['Headcount', 'Time off', 'Training'],
  },
  {
    slug: 'breathe',
    name: 'Breathe HR',
    category: 'hr',
    status: 'coming_soon',
    authType: 'api_key',
    description: 'UK-focused HR platform.',
    provides: ['Headcount', 'Training'],
  },

  // ── Expenses ───────────────────────────────────────────────────────
  {
    slug: 'pleo',
    name: 'Pleo',
    category: 'expenses',
    status: 'coming_soon',
    authType: 'oauth',
    description: 'Company cards — business travel and office spend for Scope 3.',
    provides: ['Expense transactions', 'Travel spend'],
  },
  {
    slug: 'expensify',
    name: 'Expensify',
    category: 'expenses',
    status: 'coming_soon',
    authType: 'oauth',
    description: 'Expense reporting with receipt OCR.',
    provides: ['Expense transactions'],
  },
  {
    slug: 'spendesk',
    name: 'Spendesk',
    category: 'expenses',
    status: 'coming_soon',
    authType: 'oauth',
    description: 'Spend management for European businesses.',
    provides: ['Expense transactions'],
  },

  // ── Utilities ──────────────────────────────────────────────────────
  {
    slug: 'octopus_energy',
    name: 'Octopus Energy',
    category: 'utilities',
    status: 'coming_soon',
    authType: 'api_key',
    description: 'Pull half-hourly smart-meter readings directly — more accurate than monthly bills.',
    provides: ['Electricity readings', 'Gas readings'],
  },
  {
    slug: 'good_energy',
    name: 'Good Energy',
    category: 'utilities',
    status: 'coming_soon',
    authType: 'manual_export',
    description: 'Renewable electricity supplier — monthly usage exports.',
    provides: ['Electricity readings'],
  },
]

export function integrationsByCategory(): Record<IntegrationCategory, IntegrationProvider[]> {
  const out = {} as Record<IntegrationCategory, IntegrationProvider[]>
  for (const cat of CATEGORY_ORDER) out[cat] = []
  for (const p of INTEGRATIONS) {
    if (!out[p.category]) out[p.category] = []
    out[p.category].push(p)
  }
  return out
}

export function getProvider(slug: string): IntegrationProvider | undefined {
  return INTEGRATIONS.find((p) => p.slug === slug)
}

/**
 * Returns the per-org feature flag for a provider that's actively in private
 * beta. Returns undefined for providers that are still "Coming soon" — those
 * render the plain ComingSoonCard (no yellow private-beta note) and have no
 * row in /admin/beta-access.
 *
 * To put a new integration into beta: add `featureFlag: 'something_integration_beta'`
 * to its directory entry. That flips:
 *   - the user-facing card to the yellow "In private beta — request access"
 *   - a column in /admin/beta-access so you can grant/revoke per org
 *   - the whitelist on PATCH /api/admin/beta-access
 */
export function getIntegrationFeatureFlag(
  p: IntegrationProvider,
): `${string}_integration_beta` | undefined {
  return p.featureFlag as `${string}_integration_beta` | undefined
}

export interface IntegrationBetaFeature {
  code: string
  label: string
  description: string
  providerSlug: string
}

/**
 * Single source of truth for the admin beta-access UI and the backend
 * whitelist on PATCH /api/admin/beta-access. Only providers with an
 * explicit `featureFlag` (i.e. actively in beta) appear here.
 */
export const INTEGRATION_BETA_FEATURES: IntegrationBetaFeature[] = INTEGRATIONS.flatMap((p) => {
  const flag = getIntegrationFeatureFlag(p)
  if (!flag) return []
  return [{
    code: flag,
    label: p.name,
    description: p.description,
    providerSlug: p.slug,
  }]
})
