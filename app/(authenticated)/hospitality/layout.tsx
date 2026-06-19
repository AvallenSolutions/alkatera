'use client';

import { FeatureGate } from '@/components/subscription/FeatureGate';

/**
 * Hospitality is a beta feature. This layout wraps every /hospitality/* route
 * in a FeatureGate so direct-URL access is blocked for orgs without the
 * hospitality_beta flag, not just hidden from the sidebar.
 */
export default function HospitalityLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="hospitality_beta">{children}</FeatureGate>;
}
