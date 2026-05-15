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
  /**
   * Opens the URL in a popup window. Used for OAuth flows so the wizard
   * stays mounted in the parent tab. The popup must end on
   * /onboarding/oauth-complete which postMessages the parent and closes
   * itself. The `provider` is matched in the parent's message handler so
   * we can mark the right tile as completed.
   */
  | { kind: 'popup'; href: string; provider: string }

export type OnboardingModalKey = 'url_import' | 'csv_upload' | 'utility_bill_upload'

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

const HANDLER_BY_INTEGRATION_SLUG: Record<string, Omit<OnboardingHandler, 'slug' | 'label' | 'description'>> = {
  breww: {
    icon: 'beer',
    kind: 'connect',
    visibleFor: ({ beverageTypes }) =>
      !beverageTypes?.length || beverageTypes.includes('beer') || beverageTypes.includes('cider'),
    // Breww's /connect route is a GET that requires `organizationId` in the
    // querystring before issuing the OAuth redirect.
    onStart: async ({ orgId }) => ({
      kind: 'popup',
      provider: 'breww',
      // returnTo=/onboarding/oauth-complete?provider=breww — the bridge page
      // postMessages the parent wizard and closes the popup. The parent
      // never navigates away, so the wizard remounts nothing.
      href: `/api/integrations/breww/connect?organizationId=${encodeURIComponent(orgId)}&returnTo=${encodeURIComponent('/onboarding/oauth-complete?provider=breww')}`,
    }),
  },
  xero: {
    icon: 'banknote',
    kind: 'connect',
    // Xero's /connect route is a POST that returns the consent URL in the
    // response body. We POST first, then open the consent URL in a popup.
    onStart: async ({ orgId }) => {
      const res = await fetch('/api/xero/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          returnTo: '/onboarding/oauth-complete?provider=xero',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to start Xero connection')
      }
      return { kind: 'popup', provider: 'xero', href: data.url as string }
    },
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
      "Bring an Excel of your products. We parse it on the spot and add them as drafts you can refine later.",
    icon: 'file-spreadsheet',
    kind: 'upload',
    onStart: async () => ({ kind: 'modal', modalKey: 'csv_upload' }),
  },
  {
    slug: 'utility-bill',
    label: 'Upload a utility bill',
    description:
      "Drop an energy, gas or water bill (PDF or image). Rosa reads it in the background while you keep going.",
    icon: 'receipt',
    kind: 'upload',
    onStart: async () => ({ kind: 'modal', modalKey: 'utility_bill_upload' }),
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
