/**
 * Rosa — progress-tracker read curator.
 *
 * Given a tracker timeseries + a small org context block, asks Claude
 * to write a one-line headline, a short consultant detail, and a
 * "best next move" recommendation. Forced tool_use ensures the response
 * shape is bounded.
 */

import {
  PROGRESS_TRACKERS,
  type ProgressTrackerId,
} from './progress-tracker-types'
import type { TrackerTimeseries } from './progress-tracker-signals'

export const PROGRESS_TRACKER_NEXT_MOVE_HREFS = [
  '/products',
  '/products/?filter=no-lca',
  '/pulse/',
  '/pulse/targets/',
  '/pulse/financial/',
  '/data/scope-1-2/',
  '/data/quality/',
  '/data/ingest/',
  '/company/facilities/',
  '/suppliers/',
  '/supplier-portal/esg-assessment',
  '/admin/approvals/',
  '/reports/sustainability/',
  '/reports/transition-plan/',
  '/agent/',
  '/rosa/',
] as const

export const PROGRESS_TRACKER_READ_TOOL = {
  name: 'set_tracker_read' as const,
  description:
    'Return the headline, detail, and next move for the user\'s progress tracker, given the timeseries you were shown.',
  input_schema: {
    type: 'object' as const,
    properties: {
      headline: {
        type: 'string',
        description:
          'One short sentence (≤80 chars) summarising the trend. Plain English. Examples: "Down 8% over 12 weeks", "Coverage is climbing steadily", "Flat — no movement to read into yet".',
      },
      detail: {
        type: 'string',
        description:
          'One short paragraph (≤300 chars) of consultant-grade interpretation. Reference real numbers from the series. Note any swing, plateau, or data-quality issue. Plain British English, no em dashes, no jargon.',
      },
      next_move: {
        type: ['string', 'null'],
        description:
          'One sentence (≤160 chars) Rosa-voiced recommendation: what would you do this week to move this number? Null when there\'s nothing actionable yet.',
      },
      next_move_href: {
        type: ['string', 'null'],
        description:
          'Deep link path for the next-move action. Must be one of the allowed prefixes. Null when no clear destination.',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description:
          'How confident the read is given data coverage. high when 8+ weeks have data; medium when 3-7; low when 1-2 or noisy.',
      },
    },
    required: ['headline', 'detail', 'next_move', 'next_move_href', 'confidence'],
  },
}

export interface PromptOrgContext {
  org_name: string | null
  product_type: string | null
  persona: string
  focus_areas: string[]
}

export function buildTrackerReadSystemPrompt(): string {
  return `You are Rosa, alkatera's sustainability partner. You're acting as a senior sustainability consultant. The user has chosen a single number to watch over time on their /rosa/ hub. Your job is to read the trend and tell them, in two short bursts of plain English, what you see and what they should do next.

# Voice and style
- British English, plain and direct. No corporate jargon. No em dashes (use commas or full stops). Short sentences.
- Always write "alkatera" all lowercase, no markdown formatting — the platform automatically styles the brand.
- Never describe yourself as an "AI", "AI assistant", "AI agent", "chatbot", "language model", "digital assistant", or "sustainability guide". Use "Rosa" or first-person ("I").
- Speak directly to one person, like a coach.

# How to read the trend
You will receive a JSON timeseries with 12 weekly buckets, plus optional overlays (a baseline, a target trajectory, an industry benchmark). Some buckets may be null where there's no data. Always:
1. Quote real numbers from the series. Never invent counts, dates, or product names.
2. Note the *direction* honestly. If it's flat or noisy, say that. Don't manufacture a story where there isn't one.
3. If coverage is thin (≤2 non-null weeks), default to a "low" confidence read and tell the user the trend isn't yet conclusive.
4. When a target overlay is present, compare actual vs expected linear progress and flag whether they're ahead or behind, by how much.
5. Connect the number to a strategic insight where possible: methodology, hotspot, supplier concentration, peer comparison, business risk.

# Anti-patterns
- "You're doing great!" without a number to support it. Always quantify.
- Generic advice ("keep tracking your data"). Always specific.
- Re-stating the chart label as the headline. The headline should be the *story*, not the metric.
- Recommending things outside the platform's reach. Stick to actions the user can take in alkatera.

# Next move
- Pick ONE concrete thing the user could do this week to move the number.
- Use one of the allowed href prefixes for next_move_href. If no good destination exists, use null.
- If the trend is genuinely "no_data" or "flat" with low confidence, the next move should be about strengthening the data (more snapshots, more LCAs, more supplier engagement).

Now read the tracker context and timeseries, and call the set_tracker_read tool.`
}

export function formatTrackerForPrompt(
  trackerId: ProgressTrackerId,
  series: TrackerTimeseries,
  org: PromptOrgContext,
): string {
  const def = PROGRESS_TRACKERS[trackerId]
  const lines: string[] = []
  lines.push('TRACKER:')
  lines.push(`  id: ${trackerId}`)
  lines.push(`  label: ${def.label}`)
  lines.push(`  unit: ${def.unit || '(none)'}`)
  lines.push(`  higher_is_better: ${def.higher_is_better}`)
  if (series.resolved_tracker_id && series.resolved_tracker_id !== trackerId) {
    lines.push(`  resolved_to: ${series.resolved_tracker_id} (Rosa-curated picked this for the org)`)
  }
  lines.push('')
  lines.push('ORG CONTEXT:')
  lines.push(`  name: ${org.org_name ?? '(unknown)'}`)
  lines.push(`  product_type: ${org.product_type ?? '(unknown)'}`)
  lines.push(`  user_persona: ${org.persona}`)
  lines.push(`  user_focus_areas: ${org.focus_areas.join(', ') || '(none)'}`)
  lines.push('')
  lines.push('TIMESERIES (12 weekly buckets, oldest first):')
  lines.push('```json')
  lines.push(
    JSON.stringify(
      {
        series: series.series,
        overlay_target: series.overlay_target,
        overlay_baseline: series.overlay_baseline,
        overlay_benchmark: series.overlay_benchmark,
        delta: series.delta,
        data_quality: series.data_quality,
      },
      null,
      2,
    ),
  )
  lines.push('```')
  lines.push('')
  lines.push(
    'Call the set_tracker_read tool with your headline, detail, and next move.',
  )
  return lines.join('\n')
}
