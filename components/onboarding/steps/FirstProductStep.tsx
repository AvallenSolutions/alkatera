'use client'

import { useState, useRef } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WebsiteImportFlow } from '@/components/products/WebsiteImportFlow'
import { ArrowLeft, ArrowRight, SkipForward, Package, Globe } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const CATEGORY_OPTIONS = [
  { value: 'Spirits', label: 'Spirits' },
  { value: 'Beer & Cider', label: 'Beer & Cider' },
  { value: 'Wine', label: 'Wine' },
  { value: 'Ready-to-Drink & Cocktails', label: 'RTD & Cocktails' },
  { value: 'Non-Alcoholic', label: 'Non-Alcoholic' },
]

const SUB_CATEGORY_MAP: Record<string, string[]> = {
  'Spirits': ['Whisky', 'Vodka', 'Gin', 'Rum', 'Tequila', 'Brandy', 'Liqueur', 'Other'],
  'Beer & Cider': ['Lager', 'Ale', 'Stout', 'IPA', 'Cider', 'Wheat Beer', 'Sour', 'Other'],
  'Wine': ['Red Wine', 'White Wine', 'Rose', 'Sparkling', 'Fortified', 'Other'],
  'Ready-to-Drink & Cocktails': ['RTD Cocktail', 'Hard Seltzer', 'Pre-mixed', 'Other'],
  'Non-Alcoholic': ['Soft Drink', 'Juice', 'Water', 'Kombucha', 'Non-alcoholic Spirit', 'Other'],
}

export function FirstProductStep() {
  const { completeStep, previousStep, skipStep } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const { toast } = useToast()

  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [showImportFlow, setShowImportFlow] = useState(false)
  const savingRef = useRef(false)

  const handleSave = async () => {
    if (!currentOrganization || !productName.trim()) return
    if (savingRef.current) return
    savingRef.current = true

    setIsSaving(true)
    try {
      const productCategory = subCategory
        ? `${category} > ${subCategory}`
        : category || null

      const { error } = await supabase.from('products').insert({
        organization_id: currentOrganization.id,
        name: productName.trim(),
        product_category: productCategory,
        product_description: description.trim() || null,
      })

      if (error) throw error

      // Increment product count for subscription tracking
      await supabase.rpc('increment_product_count', {
        p_organization_id: currentOrganization.id,
      })

      setSaved(true)
      toast({
        title: 'Product added!',
        description: `${productName} has been added to your products.`,
      })

      // Small delay to show success state
      setTimeout(() => {
        completeStep()
      }, 1500)
    } catch (err) {
      console.error('Error saving product:', err)
      toast({
        title: 'Error',
        description: 'Failed to add product. You can add products later.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-500 text-center space-y-6">
        <div className="w-20 h-20 rounded-[6px] border border-border bg-card flex items-center justify-center">
          <Package className="w-10 h-10 text-studio-forest" />
        </div>
        <h3 className="text-2xl font-display font-bold text-foreground">
          {importedCount > 0
            ? `${importedCount} product${importedCount !== 1 ? 's' : ''} imported.`
            : 'Your first product is in.'}
        </h3>
        {importedCount === 0 && (
          <div className="rounded-[6px] border border-border bg-card p-4 max-w-sm w-full">
            <p className="font-medium text-foreground">{productName}</p>
            {category && (
              <p className="text-sm text-muted-foreground">
                {category}{subCategory ? ` → ${subCategory}` : ''}
              </p>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Next: You&apos;ll complete the full product details (ingredients &amp; packaging) later in the journey.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      {currentOrganization && (
        <WebsiteImportFlow
          open={showImportFlow}
          onClose={() => setShowImportFlow(false)}
          organizationId={currentOrganization.id}
          onSuccess={(count) => {
            setImportedCount(count)
            setShowImportFlow(false)
            setSaved(true)
            setTimeout(() => completeStep(), 1500)
          }}
        />
      )}

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-display font-bold text-foreground">
            Add your first product.
          </h3>
          <p className="text-sm text-muted-foreground">
            This takes ~60 seconds. Let&apos;s start simple. Just one product.
          </p>
        </div>

        {/* Import from website option */}
        <button
          onClick={() => setShowImportFlow(true)}
          className="w-full flex items-center gap-3 p-4 bg-card border border-border hover:bg-secondary rounded-[6px] text-left transition-colors group"
        >
          <div className="h-10 w-10 rounded-[6px] bg-secondary flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-studio-forest" />
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Import from your website</p>
            <p className="text-xs text-muted-foreground">We scan your site and create all your products automatically</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-studio-forest ml-auto transition-colors" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or add one manually</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="rounded-[6px] border border-border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="onb-product-name" className="text-sm font-medium text-foreground">Product Name</Label>
            <Input
              id="onb-product-name"
              placeholder='e.g., "Oxford Rye Whisky 50cl"'
              value={productName}
              onChange={e => setProductName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Category</Label>
            <Select value={category} onValueChange={val => { setCategory(val); setSubCategory('') }} disabled={isSaving}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {CATEGORY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category && SUB_CATEGORY_MAP[category] && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <Label className="text-sm font-medium text-foreground">Sub-category</Label>
              <Select value={subCategory} onValueChange={setSubCategory} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-category" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  {SUB_CATEGORY_MAP[category].map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="onb-product-desc" className="text-sm font-medium text-foreground">Description (optional)</Label>
            <Textarea
              id="onb-product-desc"
              placeholder="Award-winning rye whisky aged 5 years"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              disabled={isSaving}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You&apos;ll add ingredients and packaging details later. For now, let&apos;s just get your product in.
        </p>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip for now
            </Button>
            <Button
              onClick={handleSave}
              disabled={!productName.trim() || isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-[6px]"
            >
              {isSaving ? (
                'Adding...'
              ) : (
                <>
                  Add Product
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
