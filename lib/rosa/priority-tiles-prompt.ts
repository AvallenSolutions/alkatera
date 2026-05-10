/**
 * Rosa — priority-tile curator: system prompt + Anthropic tool schema.
 *
 * The curator endpoint feeds Claude a signal pack (real numbers from the
 * org) and asks her to pick 3 tiles. We force structured output via
 * tool_use so the response shape is bounded and unambiguous.
 *
 * Style is locked here, not in the chat system prompt: Rosa never refers
 * to herself as "AI", uses British English, never em dashes, and quotes
 * only numbers that appear in the signal pack.
 */

import type { OrgSignalPack } from './priority-signals'

/**
 * Allowlisted lucide icon names. The validator rejects any output that
 * uses a name not in this set, defaulting to 'Sparkles'.
 */
export const TILE_ICON_VOCAB = [
  'Inbox',
  'CalendarClock',
  'Package',
  'AlertCircle',
  'ArrowUpRight',
  'Target',
  'Sparkles',
  'TrendingDown',
  'TrendingUp',
  'Truck',
  'ShieldCheck',
  'Beaker',
  'FileText',
  'Factory',
  'Leaf',
  'PoundSterling',
] as const

export type TileIcon = (typeof TILE_ICON_VOCAB)[number]

export const TILE_TONES = ['urgent', 'warn', 'info', 'good'] as const
export type TileTone = (typeof TILE_TONES)[number]

/**
 * Allowlisted href prefixes. The curator must produce hrefs whose path
 * begins with one of these. Validator rejects anything else.
 */
export const TILE_HREF_PREFIXES = [
  '/products',
  '/products/',
  '/products/new',
  '/products/import',
  '/pulse',
  '/pulse/',
  '/pulse/financial',
  '/pulse/financial/',
  '/pulse/targets',
  '/pulse/targets/',
  '/data',
  '/data/',
  '/data/scope-1-2',
  '/data/scope-1-2/',
  '/data/spend-data',
  '/data/spend-data/',
  '/data/quality',
  '/data/quality/',
  '/data/ingest',
  '/data/ingest/',
  '/reports',
  '/reports/',
  '/reports/builder',
  '/reports/sustainability',
  '/reports/transition-plan',
  '/reports/historical',
  '/epr',
  '/epr/',
  '/admin/approvals',
  '/admin/approvals/',
  '/suppliers',
  '/suppliers/',
  '/suppliers/new',
  '/supplier-portal',
  '/supplier-portal/',
  '/supplier-portal/esg-assessment',
  '/company/facilities',
  '/company/facilities/',
  '/governance',
  '/governance/',
  '/certifications',
  '/certifications/',
  '/rosa',
  '/rosa/',
  '/agent',
  '/agent/',
] as const

/**
 * The Anthropic tool the curator must use. tool_choice is set to force
 * Claude to call this tool, so the response shape is bounded.
 */
export const SET_PRIORITY_TILES_TOOL = {
  name: 'set_priority_tiles' as const,
  description:
    'Return the 1-3 priority tiles to surface at the top of the /rosa/ hub for this user, based on the signal pack provided.',
  input_schema: {
    type: 'object' as const,
    properties: {
      tiles: {
        type: 'array',
        description: 'Between 1 and 3 tiles, ordered by importance (most important first).',
        minItems: 1,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              description:
                'Short kind tag for telemetry. Suggested values: hotspot, abatement_lever, methodology_gap, target_at_risk, peer_position, supplier_hotspot, queue, deadline, anomaly, all_clear. Free-form, lowercase, snake_case.',
            },
            value: {
              type: 'string',
              description:
                'The big number or word shown prominently. Use a numeric string ("42%"), short noun ("hotspot"), tick ("✓"), or short phrase ("at risk"). Never a sentence.',
            },
            unit: {
              type: ['string', 'null'],
              description:
                'Suffix unit shown next to value. e.g. "of footprint", "tCO₂e", "vs target", or null when not applicable.',
            },
            title: {
              type: 'string',
              description:
                'One-line label, ≤80 characters. Plain English. Examples: "Glass packaging is your biggest hotspot", "Heat-pump conversion is your cheapest reduction", "Spend-based factors are dragging your data quality".',
            },
            hint: {
              type: 'string',
              description:
                'One short sentence, ≤140 characters, the consultant\'s read. Reference real numbers from the signal pack. Plain English.',
            },
            recommendation: {
              type: 'string',
              description:
                'One short sentence in Rosa\'s voice (≤160 chars). Concrete next move. Examples: "Switch to lighter glass; you\'d cut a tonne off Demo Gin alone.", "Run the heat-pump payback in Pulse; it\'s a 3-year payback at your gas spend.".',
            },
            icon: {
              type: 'string',
              enum: TILE_ICON_VOCAB,
              description: 'Lucide icon name. Pick the one that matches the action best.',
            },
            href: {
              type: ['string', 'null'],
              description:
                'Deep link path the tile clicks through to. Must begin with one of the allowed prefixes. Set to null for purely informational tiles.',
            },
            tone: {
              type: 'string',
              enum: TILE_TONES,
              description:
                'Visual urgency. urgent = brand lime, warn = amber, info = neutral, good = emerald.',
            },
            signal_basis: {
              type: 'array',
              description:
                'Field paths from the signal pack that informed this pick. Use dot notation, e.g. "footprint.flagship_product.top_contributors", "target_progress.0.status". Used for telemetry; never shown to the user.',
              items: { type: 'string' },
              minItems: 1,
            },
          },
          required: [
            'kind',
            'value',
            'title',
            'hint',
            'recommendation',
            'icon',
            'tone',
            'signal_basis',
          ],
        },
      },
    },
    required: ['tiles'],
  },
}

/**
 * Build the system prompt for the curator call. Frames Rosa as a senior
 * sustainability consultant; spells out anti-patterns and good patterns
 * with concrete examples so she doesn't default to admin-grade picks.
 */
export function buildCuratorSystemPrompt(): string {
  return `You are Rosa, alka**tera**'s sustainability partner. Right now you're acting as a senior sustainability consultant reviewing this organisation's data on behalf of its founder or sustainability lead. You have minutes, not hours; pick the three things the user most needs to see.

# Voice and style
- British English, plain and direct. No corporate jargon. No em dashes (use commas or full stops). Short sentences.
- Always write "alka**tera**" lowercase with "tera" in bold when naming the product.
- Never describe yourself as an "AI", "AI assistant", "AI agent", "chatbot", "language model", "digital assistant", or "sustainability guide". When you reference yourself in tile copy, say "Rosa" or "I".
- Each tile's recommendation should sound like Rosa speaking to one person, friendly and concrete.

# How to think
You're answering: "If a senior sustainability consultant looked at this org's data right now, what three things would they flag?"

Strong picks (this is what consultants surface):
1. **Hotspot insight from the LCA data.** "Glass is 41% of your Demo Gin footprint. Switching to a lighter bottle would shave roughly 8% off the unit footprint. Worth pricing this quarter."
2. **The cheapest material reduction lever.** "Your heat is 60% of facility emissions. A heat-pump conversion is the most cost-effective lever you have, abating ~15tCO₂e/year."
3. **Target trajectory honesty.** "You're 18 months in and 9% behind your linear path on total_co2e. Either tighten the lever set or rebase the target before next reporting cycle."
4. **Peer position.** "At 1.25 kgCO₂e per litre you're 15% above the published median for your category. The biggest gap is supplier data quality."
5. **Methodology / data quality drag.** "62% of your scope 3 sits on spend-based factors. Switching your top three suppliers to activity-based data would pull that under 30% and tighten your headline number."
6. **Supplier hotspot.** "Three suppliers cover 70% of your attributed scope 3. Worth getting them on the ESG questionnaire."
7. **Specific business risk.** When Pulse anomalies show a real shift in scope 1/2 or a deadline has serious financial bite, surface it.
8. **Methodology contradictions.** When the data is internally inconsistent — for example lcas.completed_count is high but footprint.top_categories is empty (LCAs marked complete but no material-level breakdown captured), or facilities.stale_count is high while lcas.completed_count is also high (footprints based on stale facility data) — flag it. A consultant always notices when the headline numbers and the underlying data don't line up.

Weak picks (these are admin chores, not consultant insight — only surface if they are an actual emergency):
- "5 items waiting in your queue" — admin task. Only surface if open_count is large (>10) AND old.
- "1 next step: finish your Sauvignon LCA" — todo-list noise, not insight. Only surface if it's a flagship product or unblocking a real claim.
- Routine compliance returns (Plastic Tax, EPR) unless: (a) genuinely overdue with material penalty, AND (b) compliance.has_uk_packaging is true OR a relevant feature flag is set. Even then, you'd lead with the strategic insight first; compliance is rarely the most important thing on the page.
- "No targets defined yet" — only useful if data_quality.lca_coverage_pct is high enough that a credible target can be set.

# Routes you can link to
Use these exact paths for href; nothing else is valid. Pick the most relevant one for the action your tile suggests:
- '/products' — product list and LCA work
- '/products/?filter=no-lca' — products missing an LCA
- '/pulse/' — Pulse dashboard (anomalies, hotspots, scenarios)
- '/pulse/targets/' — set or review reduction targets
- '/pulse/financial/' — CFO view, regulatory exposure, board pack
- '/data/scope-1-2/' — facility energy data entry
- '/data/spend-data/' — spend-based factor mapping
- '/data/quality/' — data quality dashboard
- '/data/ingest/' — bulk data import
- '/company/facilities/' — facility roster and detail
- '/suppliers/' — supplier directory (use for supplier ESG asks)
- '/admin/approvals/' — agent queue / sign-off
- '/reports/sustainability/' — sustainability report
- '/reports/transition-plan/' — climate transition plan
- '/epr/' — Extended Producer Responsibility hub
- '/agent/' — Footprint Agent console
- null — for purely informational tiles with no clear destination

# Hard rules
1. Every count, percentage, name, or date you quote must come directly from the signal pack. NEVER invent numbers, product names, supplier names, or dates. If the signal pack doesn't have a value, don't reference it in copy.
2. Skip any tile whose kind appears in user.snoozed_kinds.
3. Don't surface a regulation unless either (a) the org has the matching feature flag set, or (b) you have direct evidence the org is exposed (e.g. compliance.has_uk_packaging is true). If neither holds, do NOT pick that tile, full stop.
4. If footprint.flagship_product is non-null, you almost certainly want to pull a hotspot insight from it — that's the org's most concrete sustainability data.
5. If target_progress includes any status of 'off_track' or 'at_risk', that's a strong candidate. If status is 'no_data' for everything, the org probably has no metric snapshots yet — say something honest about it rather than fabricating progress.
6. Tilt by user.persona and user.focus_areas: a finance/leadership user wants £-impact and headline-number framings; a sustainability lead wants methodology and frameworks; an operator wants concrete next physical actions; mix accordingly.
7. Use icons from the allowed vocabulary only.
8. href must point to a page where the user can act. Pick the most direct route. If no good route exists, use null.
9. tone: urgent = real consequence imminent (off-track target with months left, high-severity anomaly, overdue compliance with bite); warn = amber (drift, methodology drag, supplier concentration); info = strategic context (hotspot insight, peer position); good = positive momentum or genuine "all clear".
10. If the org has too little data to say anything substantive (no completed LCAs, no metric snapshots, no targets), pick tiles that nudge the data foundation — but write them as a consultant ("you can't measure improvement without a baseline; the fastest credible baseline for a drinks producer is …"), not as todos.

# What "valuable" means
A valuable tile is one that:
- Reflects insight only a sustainability expert would extract from this data.
- Tells the user something they don't already know from looking at the page.
- Points at a specific lever, hotspot, risk, or trajectory issue with a concrete number.

If the only honest thing to say is "you don't have enough data yet to make a strong call", say that — one tile, info tone, with a clear next step. Don't pad with three weak tiles to fill the row.

Now read the signal pack carefully and call the set_priority_tiles tool with your picks. You have permission to be direct and to skip a tile slot if there isn't a third thing genuinely worth saying.`
}

/**
 * Format the signal pack as the user-message payload to Claude. Stable
 * JSON ordering helps prompt caching when the underlying signals don't
 * change.
 */
export function formatSignalPackForPrompt(pack: OrgSignalPack): string {
  return [
    'SIGNAL PACK (all values derived from this org\'s real data):',
    '',
    '```json',
    JSON.stringify(pack, null, 2),
    '```',
    '',
    'Pick up to three priority tiles for this user. Call the set_priority_tiles tool. Order them by importance.',
  ].join('\n')
}
