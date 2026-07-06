'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowRight, Plus, X, Sparkles, SkipForward, CheckCircle2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getTemplatesForBeverageType,
  PRODUCT_TEMPLATES,
  type ProductTemplate,
} from '@/lib/product-templates'

type Unit = 'ml' | 'cl' | 'l'

interface SelectedItem {
  // Template-derived items keep their template id; custom items get a temp id.
  id: string
  templateId?: string
  name: string
  unitSize: number
  unitSizeUnit: Unit
  abv: number | null
  category: string
  subcategory: string
  benchmarkPerLitre: number
}

const DEFAULT_CUSTOM_ITEM = (): SelectedItem => ({
  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  unitSize: 750,
  unitSizeUnit: 'ml',
  abv: null,
  category: 'Spirits',
  subcategory: 'Other',
  benchmarkPerLitre: 0,
})

function templateToItem(t: ProductTemplate): SelectedItem {
  return {
    id: t.id,
    templateId: t.id,
    name: t.name,
    unitSize: t.unit_size_value,
    unitSizeUnit: t.unit_size_unit,
    abv: t.abv,
    category: t.category,
    subcategory: t.subcategory,
    benchmarkPerLitre: t.benchmark_co2e_per_litre,
  }
}

export function FastTrackProductsStep() {
  const { completeStep, skipStep, state } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const beverageTypes = state.personalization?.beverageTypes ?? []

  // Templates filtered to the user's chosen beverage types. Falls back to the
  // full catalogue if they didn't pick any (shouldn't happen via the canonical
  // flow, but handles edge cases gracefully).
  const templates = useMemo(() => {
    if (!beverageTypes.length) return PRODUCT_TEMPLATES.slice(0, 8)
    const seen = new Set<string>()
    const out: ProductTemplate[] = []
    for (const bt of beverageTypes) {
      for (const t of getTemplatesForBeverageType(bt)) {
        if (!seen.has(t.id)) {
          seen.add(t.id)
          out.push(t)
        }
      }
    }
    return out.slice(0, 8)
  }, [beverageTypes])

  const [selected, setSelected] = useState<SelectedItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [existingCount, setExistingCount] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Detect products already created in this org session (e.g. from the
  // import step's website scrape, or a previous in-flight onboarding run).
  // We don't auto-skip — the user might want to add more — but we soften
  // the framing and pre-stock the basket with what's already there.
  useEffect(() => {
    if (!currentOrganization) return
    let cancelled = false
    ;(async () => {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .gte('created_at', cutoff)
      if (!cancelled) setExistingCount(count ?? 0)
    })()
    return () => { cancelled = true }
  }, [currentOrganization])

  const isSelected = (templateId: string) =>
    selected.some(s => s.templateId === templateId)

  const toggleTemplate = (t: ProductTemplate) => {
    setSelected(prev => {
      const exists = prev.find(s => s.templateId === t.id)
      if (exists) return prev.filter(s => s.templateId !== t.id)
      return [...prev, templateToItem(t)]
    })
  }

  const addCustom = () => {
    const item = DEFAULT_CUSTOM_ITEM()
    setSelected(prev => [...prev, item])
    setEditingId(item.id)
  }

  const updateSelected = (id: string, patch: Partial<SelectedItem>) => {
    setSelected(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }

  const removeSelected = (id: string) => {
    setSelected(prev => prev.filter(s => s.id !== id))
  }

  const handleContinue = async () => {
    if (!currentOrganization) return
    if (selected.length === 0) {
      // Nothing to save — same as skip.
      completeStep()
      return
    }
    setIsSaving(true)
    try {
      const rows = selected
        .filter(s => s.name.trim().length > 0)
        .map(s => ({
          organization_id: currentOrganization.id,
          name: s.name.trim(),
          product_category: s.category,
          unit_size_value: s.unitSize,
          unit_size_unit: s.unitSizeUnit,
          is_draft: true,
        }))
      if (rows.length > 0) {
        await supabase.from('products').insert(rows)
      }
    } finally {
      setIsSaving(false)
    }
    completeStep()
  }

  const totalToAdd = selected.length
  const showExistingNudge = (existingCount ?? 0) > 0 && selected.length === 0

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-6 animate-in fade-in duration-300">
      <div className="w-full max-w-2xl space-y-5">

        <div className="text-center space-y-2">
          <h3 className="text-2xl font-display font-bold tracking-tight text-foreground">
            {showExistingNudge ? 'Add more products.' : 'Pick your products.'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {showExistingNudge
              ? `You've already got ${existingCount} product${existingCount === 1 ? '' : 's'} on the platform. Add more from templates below or continue.`
              : 'Tap one or two to start. You can edit names and sizes, or add a custom one.'}
          </p>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {templates.map(t => {
            const picked = isSelected(t.id)
            return (
              <button
                key={t.id}
                onClick={() => toggleTemplate(t)}
                className={cn(
                  'group relative flex flex-col items-start gap-1.5 p-3 rounded-[6px] border text-left transition-colors',
                  picked
                    ? 'bg-secondary border-studio-forest'
                    : 'bg-card border-border hover:bg-secondary hover:border-studio-ink/25',
                )}
              >
                <div className="flex items-start justify-between w-full">
                  <span className="text-2xl leading-none">{t.icon}</span>
                  {picked && <CheckCircle2 className="w-4 h-4 text-studio-forest" />}
                </div>
                <p className={cn('text-xs font-medium leading-tight line-clamp-2', picked ? 'text-studio-forest' : 'text-foreground')}>
                  {t.subcategory} {t.unit_size_value}{t.unit_size_unit}
                </p>
                <p className="text-[10px] text-studio-dim">
                  {t.abv ? `${t.abv}% ABV` : 'Non-alcoholic'}
                </p>
              </button>
            )
          })}
        </div>

        {/* Custom add */}
        <button
          onClick={addCustom}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-[6px] border border-dashed border-border bg-transparent hover:bg-secondary hover:border-studio-ink/25 transition-colors"
        >
          <Plus className="w-4 h-4 text-studio-dim" />
          <span className="text-sm text-muted-foreground">Add a custom product</span>
        </button>

        {/* Selected basket */}
        {selected.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-forest">
                <Sparkles className="inline w-3 h-3 mr-1" />
                {totalToAdd} product{totalToAdd === 1 ? '' : 's'} ready to add
              </p>
            </div>
            <div className="space-y-1.5">
              {selected.map(item => {
                const isEditing = editingId === item.id || !item.name
                return (
                  <div
                    key={item.id}
                    className="bg-card border border-border rounded-[6px] p-3"
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <Input
                          autoFocus
                          placeholder="Product name (e.g. Avallen Calvados)"
                          value={item.name}
                          onChange={e => updateSelected(item.id, { name: e.target.value })}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={1}
                            placeholder="Size"
                            value={item.unitSize}
                            onChange={e => updateSelected(item.id, { unitSize: parseFloat(e.target.value) || 0 })}
                            className="text-sm flex-1 min-w-0"
                          />
                          <Select
                            value={item.unitSizeUnit}
                            onValueChange={v => updateSelected(item.id, { unitSizeUnit: v as Unit })}
                          >
                            <SelectTrigger className="w-24 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ml">ml</SelectItem>
                              <SelectItem value="cl">cl</SelectItem>
                              <SelectItem value="l">l</SelectItem>
                            </SelectContent>
                          </Select>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={!item.name.trim()}
                            className={cn(
                              'px-3 rounded-full text-xs font-medium transition-colors',
                              item.name.trim()
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                : 'bg-secondary text-muted-foreground cursor-not-allowed',
                            )}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.unitSize}{item.unitSizeUnit}
                            {item.abv ? ` · ${item.abv}% ABV` : ''}
                            {' · '}{item.subcategory}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditingId(item.id)}
                            className="p-1.5 rounded-[6px] text-studio-dim hover:text-foreground hover:bg-secondary"
                            aria-label="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeSelected(item.id)}
                            className="p-1.5 rounded-[6px] text-studio-dim hover:text-studio-stale hover:bg-secondary"
                            aria-label="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={skipStep}
            className="flex-1 flex items-center justify-center gap-2 p-3 rounded-full border border-border bg-transparent hover:bg-secondary transition-colors"
          >
            <SkipForward className="w-4 h-4 text-studio-dim" />
            <span className="text-sm text-muted-foreground">Skip for now</span>
          </button>
          <Button
            onClick={handleContinue}
            disabled={isSaving}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
          >
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                {totalToAdd > 0 ? `Add ${totalToAdd} & continue` : 'Continue'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
