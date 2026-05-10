import Link from 'next/link'
import { ArrowLeft, Link as LinkIcon } from 'lucide-react'
import { DependenciesMatrix } from '@/components/nature-actions/DependenciesMatrix'

export default function DependenciesPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      <div>
        <Link
          href="/performance/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Company Vitality
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight flex items-center gap-2">
          <LinkIcon className="h-6 w-6 text-[#ccff00]" />
          Nature dependencies
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          What you depend on from nature, declared in line with TNFD and ENCORE.
          Freshwater, soil, climate stability, pollination, water flow, pest control —
          drinks production rests on a stack of ecosystem services. Disclose materiality so
          you can manage risk and report it.
        </p>
      </div>

      <DependenciesMatrix />
    </div>
  )
}
