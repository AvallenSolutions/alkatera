import { FeatureGate } from '@/components/subscription/FeatureGate'

export default function EPRLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="epr_beta">{children}</FeatureGate>
}
