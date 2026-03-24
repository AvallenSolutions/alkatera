'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, MapPin, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { suggestCategory } from '@/lib/xero/account-suggestions'

// Emission categories that users can map Xero accounts to
const EMISSION_CATEGORIES = [
  { value: 'grid_electricity', label: 'Grid Electricity', scope: 'Scope 2' },
  { value: 'natural_gas', label: 'Natural Gas', scope: 'Scope 1' },
  { value: 'diesel_stationary', label: 'Diesel (Stationary)', scope: 'Scope 1' },
  { value: 'diesel_mobile', label: 'Diesel (Fleet)', scope: 'Scope 1' },
  { value: 'petrol_mobile', label: 'Petrol (Fleet)', scope: 'Scope 1' },
  { value: 'lpg', label: 'LPG', scope: 'Scope 1' },
  { value: 'water', label: 'Water Supply', scope: 'Scope 3' },
  { value: 'air_travel', label: 'Air Travel', scope: 'Scope 3' },
  { value: 'rail_travel', label: 'Rail Travel', scope: 'Scope 3' },
  { value: 'road_freight', label: 'Road Freight', scope: 'Scope 3' },
  { value: 'sea_freight', label: 'Sea Freight', scope: 'Scope 3' },
  { value: 'air_freight', label: 'Air Freight', scope: 'Scope 3' },
  { value: 'courier', label: 'Courier / Parcel', scope: 'Scope 3' },
  { value: 'packaging', label: 'Packaging Materials', scope: 'Scope 3' },
  { value: 'raw_materials', label: 'Raw Materials / Ingredients', scope: 'Scope 3' },
  { value: 'waste', label: 'Waste Disposal', scope: 'Scope 3' },
  { value: 'accommodation', label: 'Hotel / Accommodation', scope: 'Scope 3' },
  { value: 'other', label: 'Other', scope: '' },
] as const

interface AccountMapping {
  id: string
  xero_account_id: string
  xero_account_code: string | null
  xero_account_name: string
  xero_account_type: string | null
  emission_category: string | null
  is_excluded: boolean
}

export function XeroAccountMapping() {
  const { currentOrganization } = useOrganization()
  const [mappings, setMappings] = useState<AccountMapping[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isReclassifying, setIsReclassifying] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [suggestions, setSuggestions] = useState<Map<string, string>>(new Map())

  const fetchMappings = useCallback(async () => {
    if (!currentOrganization?.id) return

    // Check if connected first
    const { data: connections } = await supabase
      .from('xero_connections')
      .select('id')
      .eq('organization_id', currentOrganization.id)
      .limit(1)

    if (!connections || connections.length === 0) {
      setIsConnected(false)
      setIsLoading(false)
      return
    }

    setIsConnected(true)

    const { data, error } = await supabase
      .from('xero_account_mappings')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('xero_account_code', { ascending: true })

    if (error) {
      console.error('Failed to fetch account mappings:', error)
    } else {
      const rows = data || []

      // Compute smart suggestions for unmapped, non-excluded accounts
      const newSuggestions = new Map<string, string>()
      const withSuggestions = rows.map(m => {
        if (m.emission_category === null && !m.is_excluded) {
          const suggested = suggestCategory(m.xero_account_name)
          if (suggested) {
            newSuggestions.set(m.xero_account_id, suggested)
            return { ...m, emission_category: suggested }
          }
        }
        return m
      })

      setSuggestions(newSuggestions)
      setMappings(withSuggestions)
      if (newSuggestions.size > 0) {
        setHasChanges(true)
      }
    }
    setIsLoading(false)
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchMappings()
  }, [fetchMappings])

  function handleCategoryChange(accountId: string, category: string) {
    setMappings(prev =>
      prev.map(m =>
        m.xero_account_id === accountId
          ? { ...m, emission_category: category === 'skip' ? null : category, is_excluded: category === 'skip' }
          : m
      )
    )
    setHasChanges(true)
  }

  async function handleSave() {
    if (!currentOrganization?.id) return
    setIsSaving(true)

    try {
      // Update each mapping
      for (const mapping of mappings) {
        const { error } = await supabase
          .from('xero_account_mappings')
          .update({
            emission_category: mapping.emission_category,
            is_excluded: mapping.is_excluded,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mapping.id)

        if (error) throw error
      }

      setHasChanges(false)
      setSuggestions(new Map())
      toast.success('Account mappings saved. Reclassifying transactions...')

      // Reclassify existing transactions in the background
      setIsReclassifying(true)
      try {
        const res = await fetch('/api/xero/reclassify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: currentOrganization.id }),
        })

        if (res.ok) {
          const { reclassified, total } = await res.json()
          if (reclassified > 0) {
            toast.success(`${reclassified} of ${total} transactions reclassified`)
          } else {
            toast.info('No transactions needed reclassification')
          }
        } else {
          const { error } = await res.json()
          toast.error(`Reclassification failed: ${error}`)
        }
      } catch {
        toast.error('Failed to reclassify transactions')
      } finally {
        setIsReclassifying(false)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save mappings'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  // Don't render if not connected or no mappings
  if (!isConnected || isLoading) return null
  if (mappings.length === 0) return null

  // Filter to show only expense-type accounts
  const expenseAccounts = mappings.filter(
    m => !m.xero_account_type || ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS'].includes(m.xero_account_type)
  )

  if (expenseAccounts.length === 0) return null

  const mappedCount = expenseAccounts.filter(m => m.emission_category || m.is_excluded).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Account Mapping
            </CardTitle>
            <CardDescription>
              Map your Xero expense accounts to emission categories for accurate classification.
              {' '}
              <span className="font-medium">
                {mappedCount} of {expenseAccounts.length} mapped
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isReclassifying && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Reclassifying transactions...
              </span>
            )}
            {suggestions.size > 0 && (
              <Button onClick={handleSave} disabled={isSaving || isReclassifying} size="sm" variant="outline">
                <Check className="h-4 w-4 mr-2" />
                Accept all suggestions
              </Button>
            )}
            {hasChanges && (
              <Button onClick={handleSave} disabled={isSaving || isReclassifying} size="sm">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Mappings
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs font-medium text-muted-foreground px-1 pb-1">
            <div>Xero Account</div>
            <div>Emission Category</div>
            <div className="w-16 text-center">Status</div>
          </div>

          {/* Rows */}
          {expenseAccounts.map(mapping => (
            <div
              key={mapping.xero_account_id}
              className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {mapping.xero_account_name}
                </p>
                {mapping.xero_account_code && (
                  <p className="text-xs text-muted-foreground">{mapping.xero_account_code}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={mapping.is_excluded ? 'skip' : mapping.emission_category || ''}
                  onValueChange={val => handleCategoryChange(mapping.xero_account_id, val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip" className="text-muted-foreground italic">
                      Skip (ignore)
                    </SelectItem>
                    {EMISSION_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                        {cat.scope && (
                          <span className="text-muted-foreground ml-1">({cat.scope})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {suggestions.has(mapping.xero_account_id) && (
                  <Badge variant="outline" className="text-xs shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    Suggested
                  </Badge>
                )}
              </div>

              <div className="w-16 flex justify-center">
                {mapping.emission_category || mapping.is_excluded ? (
                  <Badge
                    variant="outline"
                    className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    <Check className="h-3 w-3" />
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Unmapped
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
