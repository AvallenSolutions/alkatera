'use client'

import Link from 'next/link'
import { Package } from 'lucide-react'
import { useProductSpotlight } from '@/hooks/data/useProductSpotlight'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'
import { FactRow } from '@/components/studio/fact-row'
import { StateChip } from '@/components/studio/state-chip'

/**
 * Compact product strip for the brief's "The good work" section. Up to four
 * quiet tiles (square image, name, footprint), followed by one quiet fact
 * row to the full library. No card, no header: the section provides context.
 * Renders nothing while loading or when the org has no products.
 */
export function ProductSpotlight() {
  const { products, loading, refetch } = useProductSpotlight()

  // Live: when an LCA's status changes (draft → in_progress → completed)
  // or a new product is added, refresh the spotlight.
  useRealtimeRefresh(['products', 'product_carbon_footprints'], refetch)

  if (loading) return null
  if (!products || products.length === 0) return null

  const display = products.slice(0, 4)
  const count = products.length >= 20 ? '20+' : String(products.length)

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {display.map(p => (
          <Link key={p.id} href={hrefForProduct(p.id, p.lca_status)} className="group block min-w-0">
            <div className="aspect-square overflow-hidden rounded-[6px] border border-studio-hairline bg-studio-paper/60 flex items-center justify-center">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform duration-300 ease-studio group-hover:scale-105"
                />
              ) : (
                <Package className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <p className="mt-2 font-display text-sm font-semibold truncate text-foreground">
              {p.name}
            </p>
            {p.co2e_per_unit != null ? (
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim tabular-nums">
                {p.co2e_per_unit.toFixed(2)} KG CO2E
              </p>
            ) : null}
            {statusChip(p.lca_status)}
          </Link>
        ))}
      </div>
      <FactRow subject="All products" href="/products/" meta={count} className="mt-2" />
    </div>
  )
}

/**
 * The LCA state, typographically and only when it says something. Done is
 * the default state, not a celebration: completed products carry no chip.
 */
function statusChip(status: 'completed' | 'in_progress' | 'estimate' | 'draft') {
  if (status === 'completed') return null
  const label =
    status === 'in_progress' ? 'In progress' : status === 'estimate' ? 'Estimate' : 'No LCA'
  return (
    <div className="mt-0.5">
      <StateChip tone="quiet">{label}</StateChip>
    </div>
  )
}

/**
 * Land users on the most useful surface for the product they clicked,
 * given its LCA status. Not just the product detail page.
 *   - completed  → the compliance wizard's summary (the completed report + PDF)
 *   - in_progress → the compliance wizard (where the work continues)
 *   - draft       → the product page so they can configure ingredients
 *                    before kicking off the wizard
 */
function hrefForProduct(id: string, status: 'completed' | 'in_progress' | 'estimate' | 'draft'): string {
  if (status === 'completed') return `/products/${id}/compliance-wizard/`
  if (status === 'in_progress') return `/products/${id}/compliance-wizard/`
  // Estimates land users on the product page so they can refine ingredients
  // and packaging: the natural path from a benchmark guess to a real LCA.
  return `/products/${id}/`
}
