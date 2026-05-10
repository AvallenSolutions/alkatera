import Link from 'next/link'
import { ArrowLeft, Scale } from 'lucide-react'
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
        <h1 className="mt-2 text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Scale className="h-6 w-6 text-[#ccff00]" />
          Vitality weighting
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Configure how environmental, social, and governance scores combine into your
          composite ESG vitality score. The default leans environmental for drinks
          producers; adjust if your priorities differ.
        </p>
      </div>

      <VitalityWeightsSettings />
    </div>
  )
}
