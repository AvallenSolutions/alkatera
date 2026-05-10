import Link from 'next/link'
import { ArrowLeft, Recycle } from 'lucide-react'
import { ByproductsGallery } from '@/components/byproducts/ByproductsGallery'

export default function ByproductsPage() {
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
          <Recycle className="h-6 w-6 text-[#ccff00]" />
          Byproducts &amp; partnerships
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Register the circular destinations of your co-product streams: spent grain to animal feed,
          surplus yeast to extracts, recaptured CO₂, and so on. Logged flows feed your circularity score
          and surface as named partnerships across the platform.
        </p>
      </div>

      <ByproductsGallery />
    </div>
  )
}
