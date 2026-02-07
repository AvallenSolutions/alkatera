'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ArrowRight, SkipForward, Package, Loader2 } from 'lucide-react'
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

  const handleSave = async () => {
    if (!currentOrganization || !productName.trim()) return

    setIsSaving(true)
    try {
      const { error } = await supabase.from('products').insert({
        organization_id: currentOrganization.id,
        name: productName.trim(),
        category: category || null,
        sub_category: subCategory || null,
        description: description.trim() || null,
      })

      if (error) throw error

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in zoom-in duration-500 text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 flex items-center justify-center">
          <Package className="w-10 h-10 text-[#ccff00]" />
        </div>
        <h3 className="text-2xl font-serif font-bold text-white">
          Awesome! You added your first product to Alkatera!
        </h3>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 max-w-sm w-full">
          <p className="font-medium text-white">{productName}</p>
          {category && (
            <p className="text-sm text-white/50">
              {category}{subCategory ? ` → ${subCategory}` : ''}
            </p>
          )}
        </div>
        <p className="text-sm text-white/30">
          Next: You&apos;ll complete the full product details (ingredients & packaging) later in the journey.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-serif font-bold text-white">
            Quick Challenge: Add Your First Product
          </h3>
          <p className="text-sm text-white/50">
            This takes ~60 seconds. Let&apos;s start simple. Just one product.
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="onb-product-name" className="text-sm font-medium text-white/70">Product Name</Label>
            <Input
              id="onb-product-name"
              placeholder='e.g., "Oxford Rye Whisky 50cl"'
              value={productName}
              onChange={e => setProductName(e.target.value)}
              disabled={isSaving}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/70">Category</Label>
            <Select value={category} onValueChange={val => { setCategory(val); setSubCategory('') }} disabled={isSaving}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category && SUB_CATEGORY_MAP[category] && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <Label className="text-sm font-medium text-white/70">Sub-category</Label>
              <Select value={subCategory} onValueChange={setSubCategory} disabled={isSaving}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select sub-category" />
                </SelectTrigger>
                <SelectContent>
                  {SUB_CATEGORY_MAP[category].map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="onb-product-desc" className="text-sm font-medium text-white/70">Description (optional)</Label>
            <Textarea
              id="onb-product-desc"
              placeholder="Award-winning rye whisky aged 5 years"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              disabled={isSaving}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
          </div>
        </div>

        <p className="text-xs text-white/30 text-center">
          You&apos;ll add ingredients and packaging details later. For now, let&apos;s just get your product in!
        </p>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-white/40 hover:text-white hover:bg-white/10 text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip for now
            </Button>
            <Button
              onClick={handleSave}
              disabled={!productName.trim() || isSaving}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
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
