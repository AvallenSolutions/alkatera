/**
 * Rosa-voiced read for the vitality modal.
 *
 * Single Claude tool-use call (mirrors priority-tiles + progress-tracker).
 * Given the composite + trend, returns a one-line headline + a short
 * detail + an optional next move, all bounded by the tool's input_schema.
 */

import type { VitalityComposite } from './composite'
import type { TrendPoint } from './snapshot'

export const VITALITY_READ_TOOL = {
  name: 'set_vitality_read' as const,
  description:
    'Return the headline, detail, and next move for the user\'s vitality score, given the composite and 12-week trend.',
  input_schema: {
    type: 'object' as const,
    properties: {
      headline: {
        type: 'string',
        description:
          'One short sentence (≤90 chars) summarising where the user stands. Examples: "Your vitality is healthy and trending up", "Strong on E, weak on S", "Awaiting more data to call a direction".',
      },
      detail: {
        type: 'string',
        description:
          'One short paragraph (≤320 chars) of consultant-grade interpretation. Reference real numbers from the composite (E, S, G scores, sub-pillars, trend delta). Plain British English, no em dashes, no jargon.',
      },
      next_move: {
        type: ['string', 'null'],
        description:
          'One sentence (≤180 chars), Rosa-voiced. The single thing that would move the composite most this quarter. Null when nothing actionable yet.',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description:
          'How confident the read is given pillar coverage. high when all three pillars have data; medium when 2; low when 1 or 0.',
      },
    },
    required: ['headline', 'detail', 'next_move', 'confidence'],
  },
}

export interface VitalityRead {
  headline: string
  detail: string
  next_move: string | null
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Per-sub-score guidance for null states. Tells Rosa (and the fallback
 * narrative) what data is missing and what concrete action unlocks the
 * score. Used by both the curated read prompt and the deterministic
 * fallback so the user always sees the same recommendation regardless of
 * whether the AI call succeeded.
 *
 * Pillar keys mirror VitalityComposite shape:
 *   e.sub.climate / water / circularity / nature
 *   s.sub.community / people_culture / supplier_esg
 *   g.sub.governance / certifications
 */
export const SUB_SCORE_GUIDANCE: Record<string, { label: string; action: string }> = {
  'e.climate': {
    label: 'Climate (Environmental)',
    action:
      "Complete a Life Cycle Assessment for at least one product. Open Products, pick a product, and run the LCA wizard. The score appears once a single LCA is marked complete.",
  },
  'e.water': {
    label: 'Water (Environmental)',
    action:
      "Add facility water intake to a facility's data history (Capture Data, Facilities, Water Data). At least one product must also exist so the score has a per-unit denominator.",
  },
  'e.circularity': {
    label: 'Circularity (Environmental)',
    action:
      "Add packaging material data (Products, then a product, Packaging) for recycled-content and recyclability percentages, and log facility waste entries (Capture Data, Facilities, Waste Data) so the diversion axis can score.",
  },
  'e.nature': {
    label: 'Nature (Environmental)',
    action:
      "Add a nature-positive action under Environmental, Nature Assessment (for example a regenerative-agriculture commitment or biodiversity programme), or complete an LCA so material origin countries can feed the biodiversity multiplier.",
  },
  's.community': {
    label: 'Community impact (Social)',
    action:
      "Log donations, volunteering activities, or community engagements under Social Impact, Community.",
  },
  's.people_culture': {
    label: 'People & culture (Social)',
    action:
      "Add workforce demographics and any DEI actions under Social Impact, People & Culture.",
  },
  's.supplier_esg': {
    label: 'Supplier ESG (Social)',
    action:
      "Map suppliers and request ESG attestations under Social Impact, Suppliers. Adding certifications to each supplier lifts the score the fastest.",
  },
  'g.governance': {
    label: 'Governance practices (Governance)',
    action:
      "Add governance policies and board members under the Governance section.",
  },
  'g.certifications': {
    label: 'Certifications progress (Governance)',
    action:
      "Log the certifications you hold or are progressing under Compliance, Certifications.",
  },
}

export interface MissingSubScore {
  key: string
  label: string
  action: string
}

/**
 * Walks the composite shape and returns every sub-pillar that resolved to
 * null, in waterfall order (E first, then S, then G). The first entry is
 * always the highest-priority gap and is what `fallbackRead` and Rosa
 * should lead with.
 */
export function listMissingSubScores(composite: VitalityComposite): MissingSubScore[] {
  const missing: MissingSubScore[] = []
  const push = (key: string) => {
    const g = SUB_SCORE_GUIDANCE[key]
    if (g) missing.push({ key, label: g.label, action: g.action })
  }
  if (composite.e.sub.climate === null) push('e.climate')
  if (composite.e.sub.water === null) push('e.water')
  if (composite.e.sub.circularity === null) push('e.circularity')
  if (composite.e.sub.nature === null) push('e.nature')
  if (composite.s.sub.community === null) push('s.community')
  if (composite.s.sub.people_culture === null) push('s.people_culture')
  if (composite.s.sub.supplier_esg === null) push('s.supplier_esg')
  if (composite.g.sub.governance === null) push('g.governance')
  if (composite.g.sub.certifications === null) push('g.certifications')
  return missing
}

export function buildVitalityReadSystemPrompt(): string {
  return `You are Rosa, alka**tera**'s sustainability partner. Acting as a senior sustainability consultant, you've just looked at this org's ESG vitality score and 12-week trend. The user is the founder or sustainability lead.

# Voice and style
- British English, plain and direct. No corporate jargon. No em dashes (use commas or full stops). Short sentences.
- Always write "alka**tera**" lowercase with "tera" in bold when naming the product.
- Never describe yourself as an "AI", "AI assistant", "AI agent", "chatbot", "language model", "digital assistant", or "sustainability guide". Use "Rosa" or "I".

# What to read
You receive a JSON payload with: composite ESG (0-100) + band, the three pillar scores (E, S, G) + their sub-pillars, the user's weighting, 12 weekly snapshots of composite/E/S/G, and a MISSING_DATA block listing every sub-pillar that resolved to null with the concrete action that would unlock it.

Strong reads (this is what consultants say):
1. Connect the trend to the underlying pillar movement: "Composite is up 4 points; supplier ESG climbing was the single biggest swing."
2. Surface a concrete imbalance: "E is 80, G is 45. Governance is dragging the composite by 8 points."
3. When the composite OR any pillar is null because of missing data: explicitly name what's missing AND restate the exact action from MISSING_DATA. Example: "Nature is null because no nature-positive action has been added. Open Environmental, Nature Assessment, and log one action to unlock the score."
4. Be honest when the trend is too short: "We've only got one week of snapshots; come back in a month for a real read."

Weak reads (avoid):
- "You're doing great" without a number.
- Listing every sub-pillar.
- Recommending things outside the platform.
- Saying "no data" without telling the user what specifically to add.

# Next move
- If MISSING_DATA has any entries, next_move MUST be the action from its first entry (verbatim or lightly rephrased in Rosa's voice). The first entry follows the data waterfall: environmental gaps before social, social before governance.
- If MISSING_DATA is empty, pick ONE concrete thing tied to whichever pillar/sub-pillar is dragging or has the most upside.
- Set next_move to null only when the composite is at 100 and no sub-pillar is null.

Now read the payload and call the set_vitality_read tool.`
}

export function formatVitalityForPrompt(
  composite: VitalityComposite,
  trend: TrendPoint[],
): string {
  const missing = listMissingSubScores(composite)
  return [
    'COMPOSITE ESG:',
    '```json',
    JSON.stringify(
      {
        composite: composite.composite,
        band: composite.band,
        weights: composite.weights,
        e: composite.e,
        s: composite.s,
        g: composite.g,
      },
      null,
      2,
    ),
    '```',
    '',
    'TREND (12 weekly buckets, oldest first):',
    '```json',
    JSON.stringify(trend, null, 2),
    '```',
    '',
    'MISSING_DATA (sub-pillars that resolved to null with the action that would unlock each, in waterfall order):',
    '```json',
    JSON.stringify(missing, null, 2),
    '```',
    '',
    'Call the set_vitality_read tool with your headline, detail, and next move. If MISSING_DATA is non-empty, the detail and next_move MUST address its first entry.',
  ].join('\n')
}
