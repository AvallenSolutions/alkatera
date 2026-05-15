/**
 * Onboarding handler registry.
 *
 * Source of truth for which tiles render in FastTrackImportStep. Driven by the
 * integration directory at `directory.ts` (filtered to status='available') plus
 * a small set of non-integration upload/scrape paths.
 *
 * Adding a new path is one entry below; the onboarding step picks it up
 * automatically.
 */

import { INTEGRATIONS, type IntegrationProvider } from './directory'
import type { BeverageType } from '@/lib/onboarding/types'

/** What happens when the user clicks a tile. */
export type OnboardingHandlerAction =
  | { kind: 'oauth_redirect'; href: string }
  | { kind: 'modal'; modalKey: OnboardingModalKey }
  | { kind: 'external_link'; href: string }

export type OnboardingModalKey = 'url_import'

export type OnboardingHandlerIcon =
  | 'globe'
  | 'building2'
  | 'file-spreadsheet'
  | 'receipt'
  | 'beer'
  | 'banknote'

export interface OnboardingHandler {
  /** Stable key. For integrations this matches IntegrationProvider.slug. */
  slug: string
  /** Tile heading. */
  label: string
  /** Tile body. */
  description: string
  /** Icon key the component resolves to a Lucide icon. */
  icon: OnboardingHandlerIcon
  /** What kind of work this represents — used for grouping and copy. */
  kind: 'connect' | 'upload' | 'scrape'
  /** "Recommended" pill on the tile. */
  recommended?: boolean
  /** If returns false, the tile is hidden for this user. */
  visibleFor?: (ctx: { beverageTypes?: BeverageType[] }) => boolean
  /** Action when the tile is clicked. */
  onStart: (ctx: { orgId: string; userId: string }) => Promise<OnboardingHandlerAction>
}

/**
 * Build the OAuth redirect for an integration. We let the existing /connect
 * route handle CSRF state, scopes, and return URL. After install completes,
 * the user lands back at /settings/integrations?connected={slug}; we'll add
 * a hook so they're returned to onboarding mid-flow if that's where they
 * started.
 */
function buildOAuthRedirect(slug: string): string {
  return `/api/integrations/${slug}/connect?return=/onboarding`
}

const HANDLER_BY_INTEGRATION_SLUG: Record<string, Omit<OnboardingHandler, 'slug' | 'label' | 'description'>> = {
  breww: {
    icon: 'beer',
    kind: 'connect',
    visibleFor: ({ beverageTypes }) =>
      !beverageTypes?.length || beverageTypes.includes('beer') || beverageTypes.includes('cider'),
    onStart: async () => ({
      kind: 'oauth_redirect',
      href: '/api/integrations/breww/connect?return=/onboarding',
    }),
  },
  xero: {
    icon: 'banknote',
    kind: 'connect',
    onStart: async () => ({
      kind: 'oauth_redirect',
      href: '/api/xero/connect?return=/onboarding',
    }),
  },
}

const NON_INTEGRATION_HANDLERS: OnboardingHandler[] = [
  {
    slug: 'website-url',
    label: 'Import from your website',
    description:
      "We'll read your site and pull in products, your brand story, certifications and any production partners we can find.",
    icon: 'globe',
    kind: 'scrape',
    recommended: true,
    onStart: async () => ({ kind: 'modal', modalKey: 'url_import' }),
  },
  {
    slug: 'csv-upload',
    label: 'Upload a spreadsheet',
    description:
      'Bring an Excel of your products, ingredients or packaging. Opens our bulk import in a new tab.',
    icon: 'file-spreadsheet',
    kind: 'upload',
    onStart: async () => ({ kind: 'external_link', href: '/products/import' }),
  },
  {
    slug: 'utility-bill',
    label: 'Upload a utility bill',
    description:
      'Drop an energy, gas or water bill into the data hub. Rosa reads it and logs the usage.',
    icon: 'receipt',
    kind: 'upload',
    onStart: async () => ({ kind: 'external_link', href: '/utilities' }),
  },
]

/**
 * Returns the ordered list of handlers to render in the onboarding import step.
 * - Includes every directory integration with status='available' that has a
 *   handler defined here.
 * - Plus the static non-integration paths (website URL, CSV, utility bill).
 *
 * Adding a new integration: build the connect route, set status='available' in
 * directory.ts, add an entry to HANDLER_BY_INTEGRATION_SLUG above. The tile
 * appears automatically.
 */
export function getOnboardingHandlers(): OnboardingHandler[] {
  const integrationHandlers: OnboardingHandler[] = INTEGRATIONS
    .filter((p): p is IntegrationProvider => p.status === 'available')
    .flatMap((p) => {
      const cfg = HANDLER_BY_INTEGRATION_SLUG[p.slug]
      if (!cfg) return []
      return [{
        slug: p.slug,
        label: `Connect ${p.name}`,
        description: p.description,
        ...cfg,
      }]
    })

  return [
    ...NON_INTEGRATION_HANDLERS.filter(h => h.recommended),
    ...integrationHandlers,
    ...NON_INTEGRATION_HANDLERS.filter(h => !h.recommended),
  ]
}
