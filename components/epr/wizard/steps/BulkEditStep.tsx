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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Loader2,
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
        <Loader2 className="w-8 h-8 text-[#ccff00] animate-spin" />
        <p className="mt-3 text-sm text-white/40">Loading packaging items...</p>
      </div>
    )
  }

  // All items are already complete
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-emerald-400/20 backdrop-blur-md border border-emerald-400/30 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-serif font-bold text-white">
              All items already have complete EPR data!
            </h3>
            <p className="text-sm text-white/50">
              Every packaging item has its EPR fields filled in. No bulk edits needed.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-white/40 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={onComplete}
              className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium rounded-xl"
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
          <div className="mx-auto w-16 h-16 bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 rounded-2xl flex items-center justify-center">
            <Layers className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-white">
            Bulk Edit Packaging Items
          </h3>
          <p className="text-sm text-white/50">
            Select items and apply values to update them all at once.
          </p>
        </div>

        {/* Batch Actions Bar */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#ccff00]" />
              <span className="text-sm font-medium text-white/70">Batch Actions</span>
            </div>
            {selectedIds.size > 0 && (
              <Badge
                variant="outline"
                className="border-[#ccff00]/30 text-[#ccff00] bg-[#ccff00]/10 text-xs"
              >
                {selectedIds.size} selected
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Set Activity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/50">Set Activity</Label>
              <Select value={batchActivity} onValueChange={setBatchActivity}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/20 focus:ring-[#ccff00]/50 h-9">
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
              <Label className="text-xs font-medium text-white/50">Set UK Nation</Label>
              <Select value={batchNation} onValueChange={setBatchNation}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/20 focus:ring-[#ccff00]/50 h-9">
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
              <Label className="text-xs font-medium text-white/50">Set Household</Label>
              <Select value={batchHousehold} onValueChange={setBatchHousehold}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/20 focus:ring-[#ccff00]/50 h-9">
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
              <Label className="text-xs font-medium text-white/50">Set Drinks Container</Label>
              <Select value={batchDrinksContainer} onValueChange={setBatchDrinksContainer}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/20 focus:ring-[#ccff00]/50 h-9">
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
            className="w-full bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium rounded-xl"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={toggleSelectAll}
              className="border-white/20 data-[state=checked]:bg-[#ccff00] data-[state=checked]:text-black data-[state=checked]:border-[#ccff00]"
            />
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Select All ({items.length} items)
            </span>
          </div>

          {/* Table Body */}
          <div className="max-h-[300px] overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id)

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#ccff00]/5' : 'hover:bg-white/[0.02]'
                  }`}
                  onClick={() => toggleSelect(item.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(item.id)}
                    className="border-white/20 data-[state=checked]:bg-[#ccff00] data-[state=checked]:text-black data-[state=checked]:border-[#ccff00]"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {item.material_name}
                    </p>
                  </div>

                  {/* Missing field indicators */}
                  <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                    {!item.epr_packaging_activity && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-400/30 text-amber-400 bg-amber-400/10 px-1.5 py-0"
                      >
                        Activity
                      </Badge>
                    )}
                    {!item.epr_uk_nation && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-400/30 text-amber-400 bg-amber-400/10 px-1.5 py-0"
                      >
                        Nation
                      </Badge>
                    )}
                    {item.epr_is_household == null && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-400/30 text-amber-400 bg-amber-400/10 px-1.5 py-0"
                      >
                        Household
                      </Badge>
                    )}
                    {item.epr_is_drinks_container == null && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-400/30 text-amber-400 bg-amber-400/10 px-1.5 py-0"
                      >
                        DRS
                      </Badge>
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
            className="text-white/40 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                className="text-white/40 hover:text-white hover:bg-white/10 text-sm"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            <Button
              onClick={onComplete}
              className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium rounded-xl"
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
