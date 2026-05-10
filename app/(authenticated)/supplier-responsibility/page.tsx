import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
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
        <h1 className="mt-2 text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-[#ccff00]" />
          Supplier responsibility
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Declare your supply-chain due-diligence practices: code of conduct, audits, Living Wage requirements,
          modern-slavery policy, and more. None of this needs your suppliers to log into the platform — it&rsquo;s about
          what you do. Aligned with CSRD ESRS S2, the UK Modern Slavery Act, and B Corp Workers/Community.
        </p>
      </div>

      <SupplierResponsibilityMatrix />
    </div>
  )
}
