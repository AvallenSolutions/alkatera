'use client'

import Link from 'next/link'
import { Package, ArrowRight } from 'lucide-react'
import { useProductSpotlight } from '@/hooks/data/useProductSpotlight'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'

/**
 * Product spotlight card on /rosa/. Shows up to four products with their
 * image (or a placeholder), name, footprint, and LCA status. Visual
 * counter to the otherwise text-heavy hub. Pulls from the same hook the
 * old dashboard used.
 */
export function ProductSpotlight() {
  const { products, loading, refetch } = useProductSpotlight()

  // Live: when an LCA's status changes (draft → in_progress → completed)
  // or a new product is added, refresh the spotlight.
  useRealtimeRefresh(['products', 'product_carbon_footprints'], refetch)

  if (loading) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6 h-full">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (!products || products.length === 0) {
    return null
  }

  const display = products.slice(0, 4)

  return (
    <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Package className="h-4 w-4 text-studio-forest" />
          Product spotlight
        </h2>
        <Link
          href="/products/"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {display.map(p => (
          <Link
            key={p.id}
            href={hrefForProduct(p.id, p.lca_status)}
            className="group rounded-[6px] border border-border overflow-hidden bg-background/40 hover:border-studio-forest/40 hover:bg-card transition-all"
          >
            <div className="relative aspect-[16/9] bg-muted/40 flex items-center justify-center overflow-hidden">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <Package className="h-10 w-10 text-muted-foreground/40" />
              )}
              <span className="absolute top-2 left-2">
                <StatusPill status={p.lca_status} />
              </span>
            </div>
            <div className="p-3">
              <p className="text-sm font-medium leading-tight line-clamp-2">
                {p.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.co2e_per_unit != null
                  ? `${p.co2e_per_unit.toFixed(2)} kgCO₂e per ${p.declared_unit || 'unit'}`
                  : 'No footprint yet'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

/**
 * Land users on the most useful surface for the product they clicked,
 * given its LCA status. Not just the product detail page.
 *   - completed  → the LCA report (the artefact they probably want to read)
 *   - in_progress → the compliance wizard (where the work continues)
 *   - draft       → the product page so they can configure ingredients
 *                    before kicking off the wizard
 */
function hrefForProduct(id: string, status: 'completed' | 'in_progress' | 'estimate' | 'draft'): string {
  if (status === 'completed') return `/products/${id}/lca-report/`
  if (status === 'in_progress') return `/products/${id}/compliance-wizard/`
  // Estimates land users on the product page so they can refine ingredients
  // and packaging — the natural path from a benchmark guess to a real LCA.
  return `/products/${id}/`
}

function StatusPill({ status }: { status: 'completed' | 'in_progress' | 'estimate' | 'draft' }) {
  // Typographic state chip: small bold mono in a working tone, on a cream
  // backing so it stays legible over product imagery.
  const map = {
    completed: { label: 'LCA done', cls: 'text-studio-good' },
    in_progress: { label: 'In progress', cls: 'text-studio-attention' },
    estimate: { label: 'Estimate', cls: 'text-studio-forest' },
    draft: { label: 'No LCA', cls: 'text-studio-dim' },
  } as const
  const m = map[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] bg-card/90 px-1.5 py-0.5',
        'font-mono text-[10px] font-bold uppercase tracking-[0.18em]',
        m.cls,
      )}
    >
      {m.label}
    </span>
  )
}
