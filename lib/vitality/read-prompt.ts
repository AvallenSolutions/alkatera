/**
 * Rosa-voiced read for the vitality modal.
 *
 * Single Claude tool-use call (mirrors priority-tiles + progress-tracker).
 * Given the composite + trend, returns a one-line headline + a short
 * detail + an optional next move, all bounded by the tool's input_schema.
 */

import type { VitalityComposite } from './composite'
import type { TrendPoint } from './snapshot'

/**
 * Detail field budget. Wide enough to fit one observation paired with
 * one concrete action, but tight enough to force Rosa to pick rather
 * than enumerate. Truncation happens at the last sentence boundary so
 * the text never cuts off mid-word.
 */
export const VITALITY_DETAIL_MAX = 480
export const VITALITY_NEXT_MOVE_MAX = 220
export const VITALITY_HEADLINE_MAX = 100

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
          'A consultant\'s balanced analysis of the score in two to three sentences, ≤450 chars total. First sentence: what is working (highest-scoring pillar or sub-pillar, with the actual number, and one phrase on what it reflects). Second sentence: what is dragging (lowest-scoring or null sub-pillar, with the actual number or "no data", and one phrase on why). Optional third sentence: trend or weighting context, for example "down 2 across the snapshot window" or "G is weighted at 25% so this drag hurts more than it looks". Do NOT include a recommendation here, that belongs in next_move. Plain British English, no em dashes, no jargon, no "AI", "assistant", etc.',
      },
      next_move: {
        type: ['string', 'null'],
        description:
          'One sentence (≤200 chars), Rosa-voiced. The single thing that would move the composite most this quarter. Lift the action verbatim from MISSING_DATA[0] or WEAK_AREAS[0] when one exists. Null only when the composite is at 100 with no drag.',
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
 * Per-sub-score guidance. Tells Rosa (and the deterministic fallback) the
 * single most useful action a user can take to either UNLOCK a null score
 * or LIFT a low one. The same action text serves both cases: completing
 * an LCA both unlocks Climate (from null) and improves it (from low).
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
      "Complete a Life Cycle Assessment for at least one product. Open Products, pick a product, and run the LCA wizard. More completed LCAs sharpen the per-unit emissions figure that drives the score.",
  },
  'e.water': {
    label: 'Water (Environmental)',
    action:
      "Reduce per-litre water use (closed-loop cleaning, CIP optimisation, rainwater capture) and log the improvement in Capture Data, Facilities, Water Data. The score is per litre of product, so production growth alone won't lift it.",
  },
  'e.circularity': {
    label: 'Circularity (Environmental)',
    action:
      "Add packaging material data (Products, a product, Packaging) for recycled-content and recyclability percentages, and log facility waste entries with treatment methods (Capture Data, Facilities, Waste Data) so the diversion axis can score.",
  },
  'e.nature': {
    label: 'Nature (Environmental)',
    action:
      "Add a nature-positive action under Environmental, Nature Assessment (a regenerative-agriculture commitment, biodiversity programme, or land-stewardship partnership). Hectares declared lift the positive axis directly.",
  },
  's.community': {
    label: 'Community impact (Social)',
    action:
      "Log donations, volunteering activities, or community engagements under Social Impact, Community. Even small recurring contributions move this axis.",
  },
  's.people_culture': {
    label: 'People & culture (Social)',
    action:
      "Add workforce demographics and any DEI actions under Social Impact, People & Culture. Living-wage commitments and turnover figures matter most.",
  },
  's.supplier_esg': {
    label: 'Supplier ESG (Social)',
    action:
      "Map your top suppliers and request ESG attestations under Social Impact, Suppliers. Adding certifications to each supplier (B Corp, organic, fair-trade) lifts the score the fastest.",
  },
  'g.governance': {
    label: 'Governance practices (Governance)',
    action:
      "Add the missing governance policies and nominate a board-level sustainability lead under the Governance section. Stakeholder-engagement and whistleblower policies tend to be the easiest wins.",
  },
  'g.certifications': {
    label: 'Certifications progress (Governance)',
    action:
      "Log certifications under Compliance, Certifications, including ones you've started but not yet achieved. In-progress status counts toward the score.",
  },
}

export interface SubScoreItem {
  key: string
  label: string
  score: number | null
  action: string
}

/**
 * Walks the composite shape and returns every sub-pillar that resolved to
 * null, in waterfall order (E first, then S, then G). The first entry is
 * always the highest-priority gap and is what `fallbackRead` and Rosa
 * should lead with.
 */
export function listMissingSubScores(composite: VitalityComposite): SubScoreItem[] {
  return listSubScoresMatching(composite, score => score === null)
}

/**
 * Sub-pillars with a non-null score at or below the threshold. Used by
 * Rosa's read so she can recommend a concrete action when scores are
 * present but dragging. Returned ascending by score (worst first) and
 * capped at 3 entries to keep the prompt focused.
 *
 * Default threshold of 30 matches the top of the NEEDS-ATTENTION band.
 */
export function listWeakSubScores(
  composite: VitalityComposite,
  threshold = 30,
): SubScoreItem[] {
  const weak = listSubScoresMatching(
    composite,
    score => score !== null && score <= threshold,
  )
  weak.sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity))
  return weak.slice(0, 3)
}

/**
 * Sub-pillars with a non-null score at or above the threshold. Powers
 * Rosa's "what's working" sentence so the analyst summary is balanced
 * rather than only flagging drags. Returned descending by score (best
 * first), capped at 3 entries.
 *
 * Default threshold of 65 matches the top of the DEVELOPING band — only
 * truly healthy sub-pillars qualify as a strength.
 */
export function listStrongSubScores(
  composite: VitalityComposite,
  threshold = 65,
): SubScoreItem[] {
  const strong = listSubScoresMatching(
    composite,
    score => score !== null && score >= threshold,
  )
  strong.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
  return strong.slice(0, 3)
}

function listSubScoresMatching(
  composite: VitalityComposite,
  predicate: (score: number | null) => boolean,
): SubScoreItem[] {
  const items: SubScoreItem[] = []
  const push = (key: string, score: number | null) => {
    if (!predicate(score)) return
    const g = SUB_SCORE_GUIDANCE[key]
    if (g) items.push({ key, label: g.label, score, action: g.action })
  }
  push('e.climate', composite.e.sub.climate)
  push('e.water', composite.e.sub.water)
  push('e.circularity', composite.e.sub.circularity)
  push('e.nature', composite.e.sub.nature)
  push('s.community', composite.s.sub.community)
  push('s.people_culture', composite.s.sub.people_culture)
  push('s.supplier_esg', composite.s.sub.supplier_esg)
  push('g.governance', composite.g.sub.governance)
  push('g.certifications', composite.g.sub.certifications)
  return items
}

/**
 * Trim a string to `max` chars without cutting a sentence in half. Falls
 * back to a hard slice with an ellipsis if no sentence break exists.
 * Used by the route to enforce the per-field budgets cleanly.
 */
export function clampSentence(s: string, max: number): string {
  const trimmed = String(s ?? '').trim()
  if (trimmed.length <= max) return trimmed
  const window = trimmed.slice(0, max)
  // Pick the rightmost sentence terminator that fits.
  const last = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
    window.lastIndexOf('.'),
    window.lastIndexOf('!'),
    window.lastIndexOf('?'),
  )
  if (last >= max * 0.5) {
    return window.slice(0, last + 1).trim()
  }
  // No usable sentence break — cut at last whitespace and add ellipsis.
  const lastSpace = window.lastIndexOf(' ')
  if (lastSpace >= max * 0.5) {
    return window.slice(0, lastSpace).trim() + '…'
  }
  return window.trim() + '…'
}

export function buildVitalityReadSystemPrompt(): string {
  return `You are Rosa, alkatera's sustainability partner. Acting as a senior sustainability consultant, you've just looked at this org's ESG vitality score and 12-week trend. The user is the founder or sustainability lead.

# Voice and style
- British English, plain and direct. No corporate jargon. No em dashes (use commas or full stops). Short sentences.
- Always write "alkatera" all lowercase, no markdown formatting — the platform automatically styles the brand.
- Never describe yourself as an "AI", "AI assistant", "AI agent", "chatbot", "language model", "digital assistant", or "sustainability guide". Use "Rosa" or "I".

# What to read
You receive a JSON payload with the composite ESG (0-100) and band, the three pillar scores (E, S, G) and their sub-pillars, the user's pillar weighting, 12 weekly snapshots, and two guidance blocks:
- MISSING_DATA: every sub-pillar that resolved to null, with the action that would unlock each, in waterfall order (E, then S, then G).
- WEAK_AREAS: sub-pillars with non-null scores at or below 30 (Needs Attention band), worst first, capped at 3, each with the action that would lift it.

# The detail field is a balanced analyst summary, not a recommendation

The detail field is where Rosa interprets the score the way a senior sustainability consultant would: what's good, what's weak, and (optionally) where the trend is heading. Two or three sentences, no more.

Structure, in this exact order:
1. STRENGTH: name the highest-scoring sub-pillar or pillar with its actual number, and add one short phrase on what it reflects ("a strong climate score from completed LCAs", "a perfect nature score from regenerative-agriculture hectares").
2. WEAKNESS: name the lowest-scoring or null sub-pillar with its actual number (or "no data"), and add one short phrase on why ("water intensity is roughly twice the BIER benchmark", "no governance policies on file", "supplier ESG attestations are missing").
3. OPTIONAL CONTEXT: trend direction across the snapshot window, OR weighting note when a weak pillar has high weight, OR a strengths-vs-weaknesses balance call ("E carries the composite while G drags"). Skip this sentence if it adds nothing.

NEVER put a recommendation, a "you should", or an action in the detail. Recommendations live in next_move only. NEVER list every sub-pillar score. NEVER write more than three sentences.

Examples of strong details:
- "Climate at 93 and nature at 100 are the strongest signals, lifting Environmental to 63. Water at 10 and certifications at 0 are the biggest drags, pointing to high per-litre intake and an empty compliance picture. With G weighted at 25%, the 19 in Governance is what's keeping the composite at 45."
- "Supplier ESG climbed to 60 after the latest attestations landed, the single biggest swing of the quarter. People & culture is the laggard at 22, reflecting incomplete workforce demographics. Composite is up 4 points across the snapshot window."
- "Environmental is solid at 78, anchored by a strong circularity figure of 82 from high recycled-content packaging. The drag is Social at 31, with community impact still at no data because no donations or volunteering are logged. G is steady but light at 45."

Examples of weak details (DO NOT WRITE THESE):
- "Composite is 45. E is 63, S is 36, G is 19. Water is 10 and recycled content is 20." (Numbers without interpretation.)
- "Water is dragging, log facility water entries to fix it." (Recommendation in detail; that belongs in next_move.)
- "You're doing great overall." (Vague, no number.)

# Next move
Use MISSING_DATA[0].action if present, otherwise WEAK_AREAS[0].action. Lightly rephrase if needed to fit Rosa's voice but keep the named page and the imperative tone. Set next_move to null only when the composite is at 100 with no drag.

# Confidence
high = three pillars have data and at least two sub-pillars per pillar have data. medium = two pillars have data. low = one or zero pillars have data, or MISSING_DATA has 4+ entries.

Now read the payload and call the set_vitality_read tool.`
}

export function formatVitalityForPrompt(
  composite: VitalityComposite,
  trend: TrendPoint[],
): string {
  const missing = listMissingSubScores(composite)
  const weak = listWeakSubScores(composite)
  const strong = listStrongSubScores(composite)
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
    'STRONG_AREAS (sub-pillars scoring 65 or above, best first, top 3 only — use these for the STRENGTH sentence):',
    '```json',
    JSON.stringify(strong, null, 2),
    '```',
    '',
    'MISSING_DATA (sub-pillars that resolved to null, in waterfall order — use the first entry for the WEAKNESS sentence when present, and for next_move):',
    '```json',
    JSON.stringify(missing, null, 2),
    '```',
    '',
    'WEAK_AREAS (sub-pillars with a score at or below 30, worst first, top 3 only — use these for the WEAKNESS sentence when MISSING_DATA is empty, and for next_move):',
    '```json',
    JSON.stringify(weak, null, 2),
    '```',
    '',
    'Call the set_vitality_read tool. Two to three sentences for detail: STRENGTH (from STRONG_AREAS, or the highest sub-pillar if STRONG_AREAS is empty) → WEAKNESS (from MISSING_DATA[0] or WEAK_AREAS[0]) → optional trend/weighting context. NO recommendation in detail; recommendation goes in next_move.',
  ].join('\n')
}
