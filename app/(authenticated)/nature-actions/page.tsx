import Link from 'next/link'
import { ArrowLeft, Sprout } from 'lucide-react'
import { NatureActionsGallery } from '@/components/nature-actions/NatureActionsGallery'

export default function NatureActionsPage() {
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
          <Sprout className="h-6 w-6 text-[#ccff00]" />
          Nature-positive actions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Register the regenerative agriculture, restoration, and habitat-creation work you contribute to.
          Logged hectares feed your Nature score and show up across the platform as named partnerships,
          aligned with TNFD&rsquo;s nature-positive framing.
        </p>
      </div>

      <NatureActionsGallery />
    </div>
  )
}
