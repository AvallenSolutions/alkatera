'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRHMRCDetails } from '@/hooks/data/useEPRHMRCDetails'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, ArrowRight, SkipForward, Tag, Plus, Trash2 } from 'lucide-react'
import { HMRC_BRAND_TYPE_NAMES } from '@/lib/epr/constants'
import type { HMRCBrandTypeCode } from '@/lib/epr/types'

interface BrandsStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

interface BrandRow {
  brand_name: string
  brand_type_code: HMRCBrandTypeCode
}

const EMPTY_BRAND: BrandRow = {
  brand_name: '',
  brand_type_code: 'BN',
}

export function BrandsStep({ onComplete, onBack, onSkip }: BrandsStepProps) {
  const { currentOrganization } = useOrganization()
  const { data, loading, saveBrands } = useEPRHMRCDetails()

  const [brands, setBrands] = useState<BrandRow[]>([{ ...EMPTY_BRAND }])
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Pre-populate from saved brands, or add one empty row
  useEffect(() => {
    if (data.brands.length > 0) {
      setBrands(
        data.brands.map(b => ({
          brand_name: b.brand_name || '',
          brand_type_code: b.brand_type_code || 'BN',
        }))
      )
    } else if (currentOrganization?.name) {
      // Suggest the org name as the first brand
      setBrands([{
        brand_name: currentOrganization.name,
        brand_type_code: 'BN',
      }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.brands, currentOrganization?.name])

  const updateBrand = (index: number, field: keyof BrandRow, value: string) => {
    setBrands(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setValidationError(null)
  }

  const addBrand = () => {
    setBrands(prev => [...prev, { ...EMPTY_BRAND }])
  }

  const removeBrand = (index: number) => {
    setBrands(prev => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  const validate = (): boolean => {
    const hasAtLeastOne = brands.some(b => b.brand_name.trim().length > 0)
    if (!hasAtLeastOne) {
      setValidationError('Please add at least one brand name.')
      return false
    }
    setValidationError(null)
    return true
  }

  const handleContinue = async () => {
    if (!currentOrganization) return
    if (!validate()) return

    setIsSaving(true)
    try {
      // Only save brands with a non-empty name
      const brandsToSave = brands
        .filter(b => b.brand_name.trim().length > 0)
        .map(b => ({
          brand_name: b.brand_name.trim(),
          brand_type_code: b.brand_type_code,
        }))

      await saveBrands(brandsToSave)
      onComplete()
    } catch (err) {
      console.error('Error saving brands:', err)
      toast.error('Failed to save brands. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">Loading</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-[6px] border border-border bg-card flex items-center justify-center">
            <Tag className="w-8 h-8 text-room-accent" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">
            Brand Details
          </h3>
          <p className="text-sm text-muted-foreground">
            List the brands under which you place packaging on the UK market. These are reported in HMRC Template 2.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-[6px] border border-border bg-card p-6 space-y-4">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_120px_36px] gap-3 items-end">
            <Label className="text-xs font-medium text-muted-foreground">Brand name</Label>
            <Label className="text-xs font-medium text-muted-foreground">Type</Label>
            <div />
          </div>

          {/* Brand rows */}
          {brands.map((brand, index) => (
            <div key={index} className="grid grid-cols-[1fr_120px_36px] gap-3 items-center">
              <Input
                placeholder="e.g. My Brewery Co"
                value={brand.brand_name}
                onChange={(e) => updateBrand(index, 'brand_name', e.target.value)}
                disabled={isSaving}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
              />
              <Select
                value={brand.brand_type_code}
                onValueChange={(value) => updateBrand(index, 'brand_type_code', value)}
                disabled={isSaving}
              >
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(HMRC_BRAND_TYPE_NAMES) as [HMRCBrandTypeCode, string][]).map(
                    ([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeBrand(index)}
                disabled={isSaving || brands.length <= 1}
                className="text-muted-foreground hover:text-studio-stale hover:bg-secondary h-9 w-9"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {/* Validation error */}
          {validationError && (
            <p className="text-xs text-studio-stale">{validationError}</p>
          )}

          {/* Add brand button */}
          <Button
            variant="ghost"
            onClick={addBrand}
            disabled={isSaving}
            className="w-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-room-accent/40"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Brand
          </Button>

          {data.brands.length === 0 && currentOrganization?.name && (
            <p className="text-xs text-muted-foreground/70 text-center">
              We have pre-filled your organisation name as a starting point. Edit, add, or remove brands as needed.
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isSaving}
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
                disabled={isSaving}
                className="text-muted-foreground hover:text-foreground hover:bg-muted text-sm"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            <Button
              onClick={handleContinue}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
            >
              {isSaving ? (
                <>
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
