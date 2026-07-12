'use client'

/**
 * Supplier engagement as a quiet section: a mono eyebrow, hairline rows,
 * typographic status chips and one quiet action per supplier. Same data
 * as before; the Mail-icon card is gone.
 */

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Eyebrow } from '@/components/studio/eyebrow'
import { StateChip } from '@/components/studio/state-chip'
import { PillButton } from '@/components/studio/pill-button'
import type { WorkingTone } from '@/components/studio/theme'

interface EngageableSupplier {
  xeroContactName: string
  supplierId: string
  supplierName: string
  totalSpend: number
  engagementStatus: string | null
  hasEngagement: boolean
}

interface SupplierEngagementPromptsProps {
  /** Optional: limit to top N suppliers */
  limit?: number
}

function statusChip(status: string | null): { tone: WorkingTone; label: string } {
  switch (status) {
    case 'data_provided':
      return { tone: 'good', label: 'DATA RECEIVED' }
    case 'active':
      return { tone: 'good', label: 'ACTIVE' }
    case 'invited':
      return { tone: 'quiet', label: 'INVITED' }
    default:
      return { tone: 'quiet', label: (status || 'UNKNOWN').toUpperCase() }
  }
}

export function SupplierEngagementPrompts({ limit = 10 }: SupplierEngagementPromptsProps) {
  const { currentOrganization } = useOrganization()
  const [suppliers, setSuppliers] = useState<EngageableSupplier[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!currentOrganization?.id) return

      // Get linked Xero contacts with supplier IDs
      const { data: links } = await supabase
        .from('xero_supplier_links')
        .select('xero_contact_name, supplier_id, total_spend')
        .eq('organization_id', currentOrganization.id)
        .not('supplier_id', 'is', null)
        .order('total_spend', { ascending: false })
        .limit(limit)

      if (!links || links.length === 0) {
        setIsLoading(false)
        return
      }

      // Get supplier names
      const supplierIds = links.map(l => l.supplier_id).filter(Boolean)
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('id, name')
        .in('id', supplierIds)

      const supplierMap = new Map((supplierData || []).map(s => [s.id, s.name]))

      // Check engagement status for each supplier
      const { data: engagements } = await supabase
        .from('supplier_engagements')
        .select('supplier_id, status')
        .in('supplier_id', supplierIds)

      const engagementMap = new Map(
        (engagements || []).map(e => [e.supplier_id, e.status])
      )

      setSuppliers(links.map(l => ({
        xeroContactName: l.xero_contact_name,
        supplierId: l.supplier_id,
        supplierName: supplierMap.get(l.supplier_id) || l.xero_contact_name,
        totalSpend: l.total_spend,
        engagementStatus: engagementMap.get(l.supplier_id) || null,
        hasEngagement: engagementMap.has(l.supplier_id),
      })))

      setIsLoading(false)
    }

    load()
  }, [currentOrganization?.id, limit])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-[6px] bg-studio-cream" aria-hidden="true" />
  }

  if (suppliers.length === 0) return null

  const unengaged = suppliers.filter(s => !s.hasEngagement)
  const engaged = suppliers.filter(s => s.hasEngagement)

  return (
    <section className="space-y-4">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>SUPPLIER ENGAGEMENT</Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">
          Ask your biggest suppliers for their own carbon data: the route to Tier 1 accuracy.
        </p>
      </div>

      {/* Unengaged suppliers */}
      {unengaged.length > 0 && (
        <div>
          {unengaged.map(s => (
            <div
              key={s.supplierId}
              className="flex items-center justify-between gap-4 border-b border-studio-hairline py-3"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-display text-sm font-semibold text-foreground">
                    {s.supplierName}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                    {formatCurrency(s.totalSpend)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Request their carbon data for Tier 1 accuracy
                </p>
              </div>
              <PillButton
                variant="outline"
                size="sm"
                className="shrink-0"
                href={`/suppliers?invite=${encodeURIComponent(s.supplierName)}`}
              >
                Request data
              </PillButton>
            </div>
          ))}
        </div>
      )}

      {/* Already engaged suppliers */}
      {engaged.length > 0 && (
        <div>
          <Eyebrow tone="dim" className="mb-1">ALREADY ENGAGED</Eyebrow>
          {engaged.map(s => {
            const chip = statusChip(s.engagementStatus)
            return (
              <div
                key={s.supplierId}
                className="flex items-center justify-between gap-4 border-b border-studio-hairline py-2 text-sm"
              >
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-display font-semibold text-foreground">{s.supplierName}</span>
                  <StateChip tone={chip.tone}>{chip.label}</StateChip>
                </div>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                  {formatCurrency(s.totalSpend)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
