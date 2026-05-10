/**
 * Tiny client helper for posting telemetry events. Best-effort, fire and
 * forget; failures never surface.
 *
 * Usage:
 *   import { trackRosa } from '@/lib/rosa/track'
 *   trackRosa('tile.clicked', { tile_id, kind })
 */

export type RosaEvent =
  | 'tile.shown'
  | 'tile.clicked'
  | 'tile.snoozed'
  | 'tracker.changed'
  | 'tracker.opened'
  | 'weights.adjusted'
  | 'weights.reset'
  | 'vitality.modal_opened'
  | 'vitality.weights_changed'
  | 'hub.layout_toggled'
  | 'hub.layout_reset'
  | 'hub.setup_completed'
  | 'persona.set'

export function trackRosa(event: RosaEvent, payload: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  try {
    void fetch('/api/rosa/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ event, payload }),
      // Send-and-forget; we don't await the response.
      keepalive: true,
    })
  } catch {
    // ignore
  }
}
