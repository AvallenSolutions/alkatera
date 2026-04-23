'use client';

import { FeatureGate } from '@/components/subscription/FeatureGate';

/**
 * Pulse is a beta feature. This layout wraps every /pulse/* route in a
 * FeatureGate so direct-URL access is blocked for orgs without the
 * pulse_beta flag, not just hidden from the sidebar.
 */
export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="pulse_beta">{children}</FeatureGate>;
}
