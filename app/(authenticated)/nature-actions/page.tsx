import { Eyebrow } from '@/components/studio/eyebrow'
import { NatureActionsGallery } from '@/components/nature-actions/NatureActionsGallery'

export default function NatureActionsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      <div>
        <Eyebrow className="mb-3">THE WIRING · NATURE ACTIONS</Eyebrow>
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          Nature-positive actions.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          Register the regenerative agriculture, restoration, and habitat-creation work you contribute to.
          Logged hectares feed your Nature score and show up across the platform as named partnerships,
          aligned with TNFD&rsquo;s nature-positive framing.
        </p>
      </div>

      <NatureActionsGallery />
    </div>
  )
}
