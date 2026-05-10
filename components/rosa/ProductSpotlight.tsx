'use client'

import Link from 'next/link'
import { Package, ArrowRight, CheckCircle2, Clock, FileText } from 'lucide-react'
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
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 h-full">
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
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Package className="h-4 w-4 text-[#ccff00]" />
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
            className="group rounded-xl border border-border overflow-hidden bg-background/40 hover:border-[#ccff00]/40 hover:bg-card transition-all"
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
function hrefForProduct(id: string, status: 'completed' | 'in_progress' | 'draft'): string {
  if (status === 'completed') return `/products/${id}/lca-report/`
  if (status === 'in_progress') return `/products/${id}/compliance-wizard/`
  return `/products/${id}/`
}

function StatusPill({ status }: { status: 'completed' | 'in_progress' | 'draft' }) {
  const map = {
    completed: { label: 'LCA done', icon: CheckCircle2, cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    in_progress: { label: 'In progress', icon: Clock, cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    draft: { label: 'No LCA', icon: FileText, cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  } as const
  const m = map[status]
  const Icon = m.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        m.cls,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  )
}
