import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Eyebrow } from '@/components/studio/eyebrow'
import { VitalityWeightsSettings } from '@/components/governance/VitalityWeightsSettings'

export default function VitalityWeightsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      <div>
        <Link
          href="/performance/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Company Vitality
        </Link>
        <Eyebrow className="mt-4 mb-3">THE MEASURES · GOVERNANCE</Eyebrow>
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          Vitality weighting.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          Configure how environmental, social, and governance scores combine into your
          composite ESG vitality score. The default leans environmental for drinks
          producers; adjust if your priorities differ.
        </p>
      </div>

      <VitalityWeightsSettings />
    </div>
  )
}
