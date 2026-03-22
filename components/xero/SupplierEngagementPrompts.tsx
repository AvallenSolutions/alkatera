'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Mail, ExternalLink, CheckCircle2, ArrowRight } from 'lucide-react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'

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
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (suppliers.length === 0) return null

  const unengaged = suppliers.filter(s => !s.hasEngagement)
  const engaged = suppliers.filter(s => s.hasEngagement)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Supplier Engagement
        </CardTitle>
        <CardDescription>
          Request carbon data from your top suppliers to achieve Tier 1 data quality.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unengaged suppliers */}
        {unengaged.length > 0 && (
          <div className="space-y-2">
            {unengaged.map(s => (
              <div
                key={s.supplierId}
                className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{s.supplierName}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {formatCurrency(s.totalSpend)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Request their carbon data for Tier 1 accuracy
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 ml-3"
                  asChild
                >
                  <a href={`/suppliers?invite=${encodeURIComponent(s.supplierName)}`}>
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Request data
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Already engaged suppliers */}
        {engaged.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Already Engaged
            </h4>
            {engaged.map(s => (
              <div
                key={s.supplierId}
                className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">{s.supplierName}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      s.engagementStatus === 'data_provided'
                        ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
                        : s.engagementStatus === 'active'
                          ? 'border-blue-300 text-blue-700 dark:text-blue-400'
                          : ''
                    }`}
                  >
                    {s.engagementStatus === 'data_provided' ? 'Data received' :
                     s.engagementStatus === 'active' ? 'Active' :
                     s.engagementStatus === 'invited' ? 'Invited' :
                     s.engagementStatus || 'Unknown'}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {formatCurrency(s.totalSpend)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
