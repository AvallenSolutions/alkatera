'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Globe,
  Loader2,
  CheckCircle2,
  Package,
  ArrowRight,
  AlertCircle,
  X,
  Check,
  Boxes,
} from 'lucide-react'
import { toast } from 'sonner'

const CATEGORY_OPTIONS = [
  'Spirits',
  'Beer & Cider',
  'Wine',
  'Ready-to-Drink & Cocktails',
  'Non-Alcoholic',
]

export interface ExtractedProduct {
  name: string
  description: string
  abv: number | null
  unit_size_value: number | null
  unit_size_unit: string | null
  product_category: string
  product_image_url: string | null
  packaging_type: 'glass_bottle' | 'aluminium_can' | 'keg_cask' | 'pet_bag' | null
  ingredients: string[]
  certifications: string[]
  included: boolean
  /** User flag: this row is a multipack (e.g. 3-bottle gift set). */
  is_multipack: boolean
  /** Components that make up the multipack, referenced by index in this array. */
  multipack_components: Array<{ component_index: number; quantity: number }>
}

interface WebsiteImportFlowProps {
  open: boolean
  onClose: () => void
  organizationId: string
  onSuccess: (count: number, orgData?: { certifications: string[]; description: string | null }) => void
  /** Dark theme mode — used inside the onboarding wizard */
  darkMode?: boolean
  /** If provided, skip URL entry and auto-scan immediately when the dialog opens */
  initialUrl?: string
}

type Stage = 'url-entry' | 'scanning' | 'review' | 'success'

export function WebsiteImportFlow({
  open,
  onClose,
  organizationId,
  onSuccess,
  darkMode = false,
  initialUrl,
}: WebsiteImportFlowProps) {
  const [stage, setStage] = useState<Stage>('url-entry')
  const [url, setUrl] = useState('')
  const [pagesAnalyzed, setPagesAnalyzed] = useState(0)
  const [products, setProducts] = useState<ExtractedProduct[]>([])
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgData, setOrgData] = useState<{ certifications: string[]; description: string | null } | null>(null)
  const autoScanDoneRef = useRef(false)

  // Auto-scan when a URL is already known — never ask the user to enter it twice
  useEffect(() => {
    if (open && initialUrl?.trim() && !autoScanDoneRef.current) {
      autoScanDoneRef.current = true
      handleScan(initialUrl.trim())
    }
    if (!open) {
      autoScanDoneRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleClose = () => {
    setStage('url-entry')
    setUrl('')
    setProducts([])
    setError(null)
    setOrgData(null)
    onClose()
  }

  const handleScan = async (scanUrl?: string) => {
    const target = (scanUrl ?? url).trim()
    if (!target) return
    if (scanUrl) setUrl(scanUrl)
    setError(null)
    setStage('scanning')

    try {
      const response = await fetch('/api/products/import-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to scan website')
        setStage('url-entry')
        return
      }

      if (!data.products || data.products.length === 0) {
        setError('No products were found on that website. Try linking directly to a products or shop page.')
        setStage('url-entry')
        return
      }

      setPagesAnalyzed(data.pagesAnalyzed || 1)
      setProducts(data.products.map((p: ExtractedProduct) => ({
        ...p,
        packaging_type: p.packaging_type ?? null,
        ingredients: p.ingredients ?? [],
        certifications: p.certifications ?? [],
        included: true,
        is_multipack: false,
        multipack_components: [],
      })))
      if (data.orgCertifications?.length || data.orgDescription) {
        setOrgData({ certifications: data.orgCertifications ?? [], description: data.orgDescription ?? null })
      }
      setStage('review')
    } catch {
      setError('Something went wrong. Please check your connection and try again.')
      setStage('url-entry')
    }
  }

  const handleConfirm = async () => {
    const selected = products.filter(p => p.included)
    if (selected.length === 0) return

    setIsConfirming(true)
    try {
      const response = await fetch('/api/products/import-from-url/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, products, orgDescription: orgData?.description ?? null }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to create products')
        return
      }

      setStage('success')
      onSuccess(data.created, orgData ?? undefined)
    } catch {
      toast.error('Something went wrong creating products')
    } finally {
      setIsConfirming(false)
    }
  }

  const toggleProduct = (index: number) => {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, included: !p.included } : p))
  }

  const updateProduct = (index: number, field: keyof ExtractedProduct, value: any) => {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  const toggleMultipack = (index: number) => {
    setProducts(prev => prev.map((p, i) => {
      if (i !== index) return p
      const next = !p.is_multipack
      return {
        ...p,
        is_multipack: next,
        multipack_components: next ? p.multipack_components : [],
      }
    }))
  }

  const toggleMultipackComponent = (multipackIndex: number, componentIndex: number) => {
    setProducts(prev => prev.map((p, i) => {
      if (i !== multipackIndex) return p
      const existing = p.multipack_components.find(c => c.component_index === componentIndex)
      const nextComponents = existing
        ? p.multipack_components.filter(c => c.component_index !== componentIndex)
        : [...p.multipack_components, { component_index: componentIndex, quantity: 1 }]
      return { ...p, multipack_components: nextComponents }
    }))
  }

  const setComponentQuantity = (multipackIndex: number, componentIndex: number, quantity: number) => {
    const safeQty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
    setProducts(prev => prev.map((p, i) => {
      if (i !== multipackIndex) return p
      return {
        ...p,
        multipack_components: p.multipack_components.map(c =>
          c.component_index === componentIndex ? { ...c, quantity: safeQty } : c,
        ),
      }
    }))
  }

  const selectedCount = products.filter(p => p.included).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {stage === 'url-entry' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-500" />
                Import Products from Your Website
              </DialogTitle>
              <DialogDescription>
                Enter your website URL and we will scan it to find your products automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="website-url">Website URL</Label>
                <Input
                  id="website-url"
                  type="url"
                  placeholder="e.g. avallenspirits.com"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScan()}
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                We will scan up to 10 pages of your website. For best results, link directly to your products or shop page.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={() => handleScan()} disabled={!url.trim()} className="gap-2">
                  Scan Website
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {stage === 'scanning' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-500" />
                Scanning Your Website
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
              <div className="text-center space-y-1">
                <p className="font-medium">Scanning {url}...</p>
                <p className="text-sm text-muted-foreground">
                  Finding products across your website. This takes about 15-30 seconds.
                </p>
              </div>
            </div>
          </>
        )}

        {stage === 'review' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-500" />
                Review Extracted Products
              </DialogTitle>
              <DialogDescription>
                Found {products.length} product{products.length !== 1 ? 's' : ''} across {pagesAnalyzed} page{pagesAnalyzed !== 1 ? 's' : ''}. Deselect any you do not want to import, or edit details before confirming.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              {/* Select all / deselect all */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{selectedCount} of {products.length} selected</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProducts(p => p.map(x => ({ ...x, included: true })))}
                    className="text-emerald-600 hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    onClick={() => setProducts(p => p.map(x => ({ ...x, included: false })))}
                    className="text-muted-foreground hover:underline"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              {/* Product cards */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {products.map((product, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-3 transition-colors ${
                      product.included
                        ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-border bg-muted/30 opacity-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox / image */}
                      <button
                        onClick={() => toggleProduct(index)}
                        className={`mt-1 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                          product.included
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-muted-foreground/40'
                        }`}
                      >
                        {product.included && <Check className="h-3 w-3 text-white" />}
                      </button>

                      {/* Image thumbnail */}
                      {product.product_image_url ? (
                        <div className="h-12 w-12 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                          <img
                            src={product.product_image_url}
                            alt={product.name}
                            className="max-h-full max-w-full object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 shrink-0 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Product details */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <Input
                          value={product.name}
                          onChange={e => updateProduct(index, 'name', e.target.value)}
                          className="h-7 text-sm font-medium px-2"
                          disabled={!product.included}
                        />
                        <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Select
                            value={product.product_category}
                            onValueChange={val => updateProduct(index, 'product_category', val)}
                            disabled={!product.included}
                          >
                            <SelectTrigger className="h-6 text-xs w-auto min-w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {product.abv !== null && (
                            <Badge variant="secondary" className="text-xs">{product.abv}% ABV</Badge>
                          )}
                          {product.unit_size_value !== null && product.unit_size_unit && (
                            <Badge variant="outline" className="text-xs">
                              {product.unit_size_value}{product.unit_size_unit}
                            </Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleMultipack(index)}
                            disabled={!product.included}
                            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-colors ${
                              product.is_multipack
                                ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                                : 'border-border text-muted-foreground hover:text-foreground'
                            } ${!product.included ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <Boxes className="h-3 w-3" />
                            Multipack
                          </button>
                        </div>

                        {product.is_multipack && product.included && (
                          <div className="rounded border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 p-2 mt-1 space-y-1.5">
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                              Which products make up this multipack?
                            </p>
                            {products.filter((_, i) => i !== index && products[i].included).length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Keep at least one other product selected above to use as a multipack component.
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {products.map((candidate, cIdx) => {
                                  if (cIdx === index || !candidate.included) return null
                                  const selected = product.multipack_components.find(c => c.component_index === cIdx)
                                  return (
                                    <div key={cIdx} className="flex items-center gap-2 text-xs">
                                      <button
                                        type="button"
                                        onClick={() => toggleMultipackComponent(index, cIdx)}
                                        className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                                          selected ? 'bg-amber-500 border-amber-500' : 'border-muted-foreground/40'
                                        }`}
                                      >
                                        {selected && <Check className="h-2.5 w-2.5 text-white" />}
                                      </button>
                                      <span className="flex-1 truncate">{candidate.name || 'Untitled product'}</span>
                                      {selected && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-muted-foreground">×</span>
                                          <Input
                                            type="number"
                                            min={1}
                                            value={selected.quantity}
                                            onChange={e => setComponentQuantity(index, cIdx, parseInt(e.target.value, 10))}
                                            className="h-6 w-14 text-xs px-1.5"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <Button
                  variant="ghost"
                  onClick={() => { setStage('url-entry'); setError(null) }}
                  className="text-muted-foreground"
                >
                  Back
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={selectedCount === 0 || isConfirming}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating products...
                    </>
                  ) : (
                    <>
                      Create {selectedCount} product{selectedCount !== 1 ? 's' : ''}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {stage === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Products Imported
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <Package className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">
                  {selectedCount} product{selectedCount !== 1 ? 's' : ''} created as drafts
                </p>
                <p className="text-sm text-muted-foreground">
                  You can now add ingredient and packaging data to each product.
                </p>
              </div>
              <Button onClick={handleClose} className="gap-2">
                Go to Products
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
