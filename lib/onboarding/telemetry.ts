/**
 * Client-side helper for firing onboarding telemetry events. Fire-and-forget:
 * we never block the user on this, and we never surface errors. The server
 * route silently no-ops on missing org / unauthenticated requests.
 *
 * Usage:
 *   import { trackOnboarding } from '@/lib/onboarding/telemetry'
 *   trackOnboarding({ organizationId, flow, step, event: 'complete' })
 */

export type OnboardingTelemetryEvent =
  | 'view'
  | 'complete'
  | 'skip'
  | 'back'
  | 'dismiss'
  | 'error'
  | 'integration_started'
  | 'integration_completed'
  | 'integration_failed'

export interface OnboardingTelemetryArgs {
  organizationId: string | null | undefined
  flow: string
  step: string
  event: OnboardingTelemetryEvent
  meta?: Record<string, unknown>
}

export function trackOnboarding(args: OnboardingTelemetryArgs): void {
  if (!args.organizationId) return
  if (typeof window === 'undefined') return

  const payload = JSON.stringify({
    organizationId: args.organizationId,
    flow: args.flow,
    step: args.step,
    event: args.event,
    meta: args.meta ?? {},
  })

  // Use sendBeacon for the dismiss event — fires reliably during page unload.
  // For everything else a plain fetch is fine and easier to debug.
  if (args.event === 'dismiss' && 'sendBeacon' in navigator) {
    try {
      navigator.sendBeacon('/api/onboarding/telemetry', new Blob([payload], { type: 'application/json' }))
      return
    } catch {
      // fall through to fetch
    }
  }

  void fetch('/api/onboarding/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => { /* fire-and-forget */ })
}
