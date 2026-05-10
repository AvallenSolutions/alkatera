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

export function buildVitalityReadSystemPrompt(): string {
  return `You are Rosa, alka**tera**'s sustainability partner. Acting as a senior sustainability consultant, you've just looked at this org's ESG vitality score and 12-week trend. The user is the founder or sustainability lead.

# Voice and style
- British English, plain and direct. No corporate jargon. No em dashes (use commas or full stops). Short sentences.
- Always write "alka**tera**" lowercase with "tera" in bold when naming the product.
- Never describe yourself as an "AI", "AI assistant", "AI agent", "chatbot", "language model", "digital assistant", or "sustainability guide". Use "Rosa" or "I".

# What to read
You receive a JSON payload with: composite ESG (0-100) + band, the three pillar scores (E, S, G) + their sub-pillars, the user's weighting, and 12 weekly snapshots of composite/E/S/G.

Strong reads (this is what consultants say):
1. Connect the trend to the underlying pillar movement: "Composite is up 4 points; supplier ESG climbing was the single biggest swing."
2. Surface a concrete imbalance: "E is 80, G is 45. Governance is dragging the composite by 8 points."
3. Note when a pillar is missing data and what to do: "S is null because no community impact data has landed yet."
4. Be honest when the trend is too short: "We've only got one week of snapshots; come back in a month for a real read."

Weak reads (avoid):
- "You're doing great" without a number.
- Listing every sub-pillar.
- Recommending things outside the platform.

# Next move
Pick ONE concrete thing the user could do this quarter to move the composite up. It should be tied to whichever pillar is dragging or has the most upside (look at sub-pillars to find the lowest one). Set it to null only if there's genuinely nothing to recommend (e.g. no data anywhere).

Now read the payload and call the set_vitality_read tool.`
}

export function formatVitalityForPrompt(
  composite: VitalityComposite,
  trend: TrendPoint[],
): string {
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
    'Call the set_vitality_read tool with your headline, detail, and next move.',
  ].join('\n')
}
