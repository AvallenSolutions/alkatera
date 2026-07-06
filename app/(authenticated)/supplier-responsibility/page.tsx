import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Eyebrow } from '@/components/studio/eyebrow'
import { SupplierResponsibilityMatrix } from '@/components/supplier-responsibility/SupplierResponsibilityMatrix'

export default function SupplierResponsibilityPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      <div>
        <Link
          href="/performance/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Company Vitality
        </Link>
        <Eyebrow className="mt-4 mb-3">THE MEASURES · SUPPLIERS</Eyebrow>
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          Supplier responsibility.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          Declare your supply-chain due-diligence practices: code of conduct, audits, Living Wage requirements,
          modern-slavery policy, and more. None of this needs your suppliers to log into the platform, it&rsquo;s about
          what you do. Aligned with CSRD ESRS S2, the UK Modern Slavery Act, and B Corp Workers/Community.
        </p>
      </div>

      <SupplierResponsibilityMatrix />
    </div>
  )
}
