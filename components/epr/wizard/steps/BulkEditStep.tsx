'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  CheckCircle2,
  Layers,
  Zap,
} from 'lucide-react'

interface BulkEditStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

interface PackagingRow {
  id: number
  product_id: number
  product_name: string
  material_name: string
  epr_packaging_activity: string | null
  epr_uk_nation: string | null
  epr_is_household: boolean | null
  epr_is_drinks_container: boolean | null
}

const ACTIVITY_OPTIONS = [
  { value: 'brand', label: 'Brand Owner' },
  { value: 'packed_filled', label: 'Packed/Filled' },
  { value: 'imported', label: 'Imported' },
  { value: 'empty', label: 'Empty Packaging Seller' },
  { value: 'hired', label: 'Hired/Loaned' },
  { value: 'marketplace', label: 'Online Marketplace' },
] as const

const NATION_OPTIONS = [
  { value: 'england', label: 'England' },
  { value: 'scotland', label: 'Scotland' },
  { value: 'wales', label: 'Wales' },
  { value: 'northern_ireland', label: 'Northern Ireland' },
] as const

const HOUSEHOLD_OPTIONS = [
  { value: 'true', label: 'Yes (Household)' },
  { value: 'false', label: 'No (Non-household)' },
] as const

const DRINKS_CONTAINER_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
] as const

export function BulkEditStep({ onComplete, onBack, onSkip }: BulkEditStepProps) {
  const { currentOrganization } = useOrganization()

  const [items, setItems] = useState<PackagingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isApplying, setIsApplying] = useState(false)

  // Batch action values
  const [batchActivity, setBatchActivity] = useState<string>('')
  const [batchNation, setBatchNation] = useState<string>('')
  const [batchHousehold, setBatchHousehold] = useState<string>('')
  const [batchDrinksContainer, setBatchDrinksContainer] = useState<string>('')

  const fetchItems = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('product_materials')
        .select(`
          id,
          product_id,
          material_name,
          epr_packaging_activity,
          epr_uk_nation,
          epr_is_household,
          epr_is_drinks_container,
          products!inner(id, name, organization_id)
        `)
        .eq('products.organization_id', currentOrganization.id)

      if (error) throw error

      // Filter to items that are missing at least one EPR field
      const incomplete = (data || [])
        .map((row: any) => ({
          id: row.id,
          product_id: row.product_id,
          product_name: row.products?.name || `Product #${row.product_id}`,
          material_name: row.material_name,
          epr_packaging_activity: row.epr_packaging_activity,
          epr_uk_nation: row.epr_uk_nation,
          epr_is_household: row.epr_is_household,
          epr_is_drinks_container: row.epr_is_drinks_container,
        }))
        .filter(
          (item: PackagingRow) =>
            !item.epr_packaging_activity ||
            !item.epr_uk_nation ||
            item.epr_is_household == null ||
            item.epr_is_drinks_container == null
        )

      setItems(incomplete)
    } catch (err) {
      console.error('Error fetching packaging items:', err)
      toast.error('Failed to load packaging items')
    } finally {
      setLoading(false)
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Selection handlers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)))
    }
  }

  const isAllSelected = items.length > 0 && selectedIds.size === items.length
  const hasBatchValues =
    batchActivity || batchNation || batchHousehold || batchDrinksContainer

  const handleApply = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one item to update')
      return
    }
    if (!hasBatchValues) {
      toast.error('Choose at least one field value to apply')
      return
    }

    setIsApplying(true)
    try {
      const updates: Record<string, any> = {}
      if (batchActivity) updates.epr_packaging_activity = batchActivity
      if (batchNation) updates.epr_uk_nation = batchNation
      if (batchHousehold) updates.epr_is_household = batchHousehold === 'true'
      if (batchDrinksContainer)
        updates.epr_is_drinks_container = batchDrinksContainer === 'true'

      const ids = Array.from(selectedIds)

      const { error } = await supabase
        .from('product_materials')
        .update(updates)
        .in('id', ids)

      if (error) throw error

      toast.success(`Updated ${ids.length} packaging item${ids.length !== 1 ? 's' : ''}`)

      // Reset batch values and selection
      setBatchActivity('')
      setBatchNation('')
      setBatchHousehold('')
      setBatchDrinksContainer('')
      setSelectedIds(new Set())

      // Refresh the list to remove now-complete items
      await fetchItems()
    } catch (err) {
      console.error('Error applying bulk update:', err)
      toast.error('Failed to apply updates. Please try again.')
    } finally {
      setIsApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">Loading packaging items</span>
      </div>
    )
  }

  // All items are already complete
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-[6px] border border-border bg-card flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-studio-good" />
            </div>
            <h3 className="text-xl font-display font-bold text-foreground">
              All items already have complete EPR data!
            </h3>
            <p className="text-sm text-muted-foreground">
              Every packaging item has its EPR fields filled in. No bulk edits needed.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={onComplete}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-[6px] border border-border bg-card flex items-center justify-center">
            <Layers className="w-8 h-8 text-studio-brick" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">
            Bulk Edit Packaging Items
          </h3>
          <p className="text-sm text-muted-foreground">
            Select items and apply values to update them all at once.
          </p>
        </div>

        {/* Batch Actions Bar */}
        <div className="rounded-[6px] border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-studio-brick" />
              <span className="text-sm font-medium text-muted-foreground">Batch Actions</span>
            </div>
            {selectedIds.size > 0 && (
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-brick">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Set Activity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Set Activity</Label>
              <Select value={batchActivity} onValueChange={setBatchActivity}>
                <SelectTrigger className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground/50 h-9">
                  <SelectValue placeholder="Activity..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Set Nation */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Set UK Nation</Label>
              <Select value={batchNation} onValueChange={setBatchNation}>
                <SelectTrigger className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground/50 h-9">
                  <SelectValue placeholder="Nation..." />
                </SelectTrigger>
                <SelectContent>
                  {NATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Set Household */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Set Household</Label>
              <Select value={batchHousehold} onValueChange={setBatchHousehold}>
                <SelectTrigger className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground/50 h-9">
                  <SelectValue placeholder="Household..." />
                </SelectTrigger>
                <SelectContent>
                  {HOUSEHOLD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Set Drinks Container */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Set Drinks Container</Label>
              <Select value={batchDrinksContainer} onValueChange={setBatchDrinksContainer}>
                <SelectTrigger className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground/50 h-9">
                  <SelectValue placeholder="Drinks container..." />
                </SelectTrigger>
                <SelectContent>
                  {DRINKS_CONTAINER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleApply}
            disabled={isApplying || selectedIds.size === 0 || !hasBatchValues}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
          >
            {isApplying ? (
              <>
                Applying...
              </>
            ) : (
              <>
                Apply to {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>

        {/* Items Table */}
        <div className="rounded-[6px] border border-border bg-card overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/50">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={toggleSelectAll}
              className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary"
            />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Select All ({items.length} items)
            </span>
          </div>

          {/* Table Body */}
          <div className="max-h-[300px] overflow-y-auto divide-y divide-border/40 scrollbar-thin scrollbar-thumb-muted-foreground/20">
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id)

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-secondary' : 'hover:bg-secondary/60'
                  }`}
                  onClick={() => toggleSelect(item.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(item.id)}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.material_name}
                    </p>
                  </div>

                  {/* Missing field indicators */}
                  <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                    {!item.epr_packaging_activity && (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-attention">
                        Activity
                      </span>
                    )}
                    {!item.epr_uk_nation && (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-attention">
                        Nation
                      </span>
                    )}
                    {item.epr_is_household == null && (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-attention">
                        Household
                      </span>
                    )}
                    {item.epr_is_drinks_container == null && (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-attention">
                        DRS
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                className="text-muted-foreground hover:text-foreground hover:bg-muted text-sm"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            <Button
              onClick={onComplete}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
