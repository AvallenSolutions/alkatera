import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Eyebrow } from '@/components/studio/eyebrow'
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
        <Eyebrow className="mt-4 mb-3">THE MEASURES · BYPRODUCTS</Eyebrow>
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          Byproducts &amp; partnerships.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          Register the circular destinations of your co-product streams: spent grain to animal feed,
          surplus yeast to extracts, recaptured CO₂, and so on. Logged flows feed your circularity score
          and surface as named partnerships across the platform.
        </p>
      </div>

      <ByproductsGallery />
    </div>
  )
}
