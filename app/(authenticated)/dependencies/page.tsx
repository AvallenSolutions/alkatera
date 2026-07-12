import { Eyebrow } from '@/components/studio/eyebrow'
import { DependenciesMatrix } from '@/components/nature-actions/DependenciesMatrix'

export default function DependenciesPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      <div>
        <Eyebrow className="mb-3">THE WIRING · DEPENDENCIES</Eyebrow>
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          Nature dependencies.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          What you depend on from nature, declared in line with TNFD and ENCORE.
          Freshwater, soil, climate stability, pollination, water flow, pest control:
          drinks production rests on a stack of ecosystem services. Disclose materiality so
          you can manage risk and report it.
        </p>
      </div>

      <DependenciesMatrix />
    </div>
  )
}
