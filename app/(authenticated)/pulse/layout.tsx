/**
 * Pulse is available to every tier from Seed up — gating is now per-widget by
 * subscription tier (see WIDGET_MIN_TIER in lib/pulse/widget-registry.ts), not
 * a route-level admin flag. So this layout no longer gates; the standard
 * auth/org/subscription gates in AppLayout still apply, and each surface
 * filters or locks widgets above the org's tier.
 */
export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
