/**
 * Rosa LLM cost guard.
 *
 * Counts events in `rosa_telemetry` for the current UTC day and refuses
 * further LLM calls when a per-user-per-day cap is reached. Also writes
 * the matching telemetry row when a call goes ahead so the next check
 * sees the new total.
 *
 * Designed as a thin shared layer that any Rosa endpoint about to call
 * Claude can guard with a single function call.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Daily caps per user, per event family. Conservative enough that a
 * runaway tab can't rack up real bills, generous enough that no real
 * user hits them through normal use.
 */
export const ROSA_DAILY_CAPS: Record<string, number> = {
  'tile.curated': 50,        // priority tiles (already had its own guard)
  'tracker.read.curated': 40, // progress tracker narrative
  'vitality.read.curated': 30, // vitality breakdown read
  'priority.read.curated': 50, // alias if used elsewhere
  default: 30,
}

export function dailyCapFor(event: string): number {
  return ROSA_DAILY_CAPS[event] ?? ROSA_DAILY_CAPS.default
}

/**
 * Returns true if the user has already hit the cap for this event today.
 * Counts via service role so RLS doesn't trip.
 */
export async function isOverDailyBudget(
  service: SupabaseClient,
  organizationId: string,
  userId: string,
  event: string,
): Promise<boolean> {
  const cap = dailyCapFor(event)
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  try {
    const { count } = await service
      .from('rosa_telemetry')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('event', event)
      .gte('created_at', since.toISOString())
    return (count ?? 0) >= cap
  } catch {
    // Telemetry table may not exist yet (migration not run). Fail open
    // — we never want to block the user because a bookkeeping table is
    // missing. The trade-off is short-term: until the migration runs, no
    // budget is enforced.
    return false
  }
}

/**
 * Append a telemetry row. Best-effort: never throw, never block.
 */
export async function logRosaTelemetry(
  service: SupabaseClient,
  organizationId: string,
  userId: string | null,
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await service.from('rosa_telemetry').insert({
      organization_id: organizationId,
      user_id: userId,
      event,
      payload,
    })
  } catch {
    // ignore
  }
}
