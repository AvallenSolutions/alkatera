'use client'

import { useState, useEffect } from 'react'
import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, Package, SkipForward, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

const PRODUCT_CATEGORIES = [
  'Raw Material',
  'Ingredient',
  'Packaging',
  'Finished Product',
  'Chemical',
  'Energy',
  'Service',
  'Other',
]

export function SupplierAddProduct() {
  const { completeStep, previousStep, skipStep } = useSupplierOnboarding()

  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('kg')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [productAdded, setProductAdded] = useState(false)

  // Get the supplier ID
  useEffect(() => {
    async function loadSupplier() {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (data) setSupplierId(data.id)
    }

    loadSupplier()
  }, [])

  const handleAddProduct = async () => {
    if (!supplierId || !productName.trim()) {
      toast.error('Please enter a product name')
      return
    }

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('supplier_products')
        .insert({
          supplier_id: supplierId,
          name: productName.trim(),
          category: category || null,
          unit: unit || 'kg',
          is_active: true,
        })

      if (error) throw error

      toast.success('Product added successfully!')
      setProductAdded(true)
    } catch (err) {
      console.error('Error adding product:', err)
      toast.error('Failed to add product. You can add products later from the Products page.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 rounded-2xl flex items-center justify-center">
            <Package className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-white">
            Add Your First Product
          </h3>
          <p className="text-sm text-white/50">
            Products are the building blocks of your environmental data. Each product can include climate, water, waste, and nature impact metrics.
          </p>
        </div>

        {productAdded ? (
          <div className="bg-white/5 backdrop-blur-md border border-[#ccff00]/30 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-[#ccff00] mx-auto" />
            <h4 className="text-lg font-semibold text-white">Product Added!</h4>
            <p className="text-sm text-white/50">
              <span className="text-[#ccff00] font-medium">{productName}</span> has been added to your product catalogue. You can add environmental impact data from the Products page.
            </p>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sup-prod-name" className="text-sm font-medium text-white/70">
                Product Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="sup-prod-name"
                placeholder="e.g., Organic Pale Malt"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                disabled={isSaving}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sup-prod-category" className="text-sm font-medium text-white/70">
                  Category
                </Label>
                <select
                  id="sup-prod-category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  disabled={isSaving}
                  className="flex h-10 w-full rounded-md border bg-white/5 border-white/10 px-3 py-2 text-sm text-white focus:ring-[#ccff00]/50 focus:ring-2 focus:outline-none"
                >
                  <option value="" className="bg-zinc-900">Select...</option>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-prod-unit" className="text-sm font-medium text-white/70">
                  Unit
                </Label>
                <select
                  id="sup-prod-unit"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  disabled={isSaving}
                  className="flex h-10 w-full rounded-md border bg-white/5 border-white/10 px-3 py-2 text-sm text-white focus:ring-[#ccff00]/50 focus:ring-2 focus:outline-none"
                >
                  <option value="kg" className="bg-zinc-900">kg</option>
                  <option value="litre" className="bg-zinc-900">litre</option>
                  <option value="unit" className="bg-zinc-900">unit</option>
                  <option value="tonne" className="bg-zinc-900">tonne</option>
                </select>
              </div>
            </div>

            <Button
              onClick={handleAddProduct}
              disabled={isSaving || !productName.trim()}
              className="w-full bg-white/10 border border-white/20 text-white hover:bg-white/15 font-medium rounded-xl"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  Add Product
                </>
              )}
            </Button>
          </div>
        )}

        <p className="text-xs text-white/30 text-center">
          You can add more products and environmental impact data later from the Products page.
        </p>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {!productAdded && (
              <Button variant="ghost" onClick={skipStep} className="text-white/40 hover:text-white hover:bg-white/10 text-sm">
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            <Button
              onClick={completeStep}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
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
