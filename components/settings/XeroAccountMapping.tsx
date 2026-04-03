'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, Save, MapPin, Check, Sparkles, X, ChevronDown, ChevronRight, HelpCircle, Lightbulb, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { suggestCategory } from '@/lib/xero/account-suggestions'

// ── Constants ───────────────────────────────────────────────────────

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

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  EMISSION_CATEGORIES.map(c => [c.value, c.label])
)

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  EXPENSE: 'Overhead Expenses',
  DIRECTCOSTS: 'Direct Costs',
  OVERHEADS: 'Overheads',
}

// Guidance content for common account types
const GUIDANCE_TIPS: Array<{ pattern: string; tip: string }> = [
  { pattern: 'cost of goods|cogs|purchases', tip: 'For drinks producers, this is typically raw materials (ingredients). Map to "Raw Materials / Ingredients".' },
  { pattern: 'motor|vehicle|fuel|mileage|fleet', tip: 'Vehicle-related costs should map to "Diesel (Fleet)" or "Petrol (Fleet)" depending on your fleet.' },
  { pattern: 'travel|airfare|flight', tip: 'General travel accounts usually cover flights. Map to "Air Travel". If it includes rail, you may want to split the account in Xero.' },
  { pattern: 'freight|haulage|delivery|distribution|carriage', tip: 'Delivery and logistics costs map to "Road Freight". Use "Sea Freight" or "Air Freight" if you know the mode.' },
  { pattern: 'packaging|bottles|cans|labels', tip: 'All packaging materials (glass, cans, labels, closures, boxes) map to "Packaging Materials".' },
  { pattern: 'rent|rates|insurance|depreciation', tip: 'These are not directly emissions-relevant. Exclude them.' },
  { pattern: 'wages|salary|staff|payroll|pension|paye', tip: 'Staff costs are not emissions-relevant. Exclude them.' },
  { pattern: 'bank|interest|finance charge', tip: 'Financial costs are not emissions-relevant. Exclude them.' },
  { pattern: 'advertising|marketing|promotion', tip: 'Marketing spend is generally not emissions-relevant unless it involves physical materials. Usually exclude.' },
  { pattern: 'subscription|software|it |computer|hosting', tip: 'IT and software costs can map to "IT Services" if you want to track digital emissions.' },
  { pattern: 'telephone|phone|mobile|broadband|internet', tip: 'Telecoms costs are a minor Scope 3 source. Map to "Other" or exclude if immaterial.' },
  { pattern: 'cleaning|janitorial', tip: 'Cleaning services are a minor Scope 3 source. Map to "Other" or exclude if immaterial.' },
  { pattern: 'repair|maintenance', tip: 'Maintenance can include refrigerant top-ups (high GWP). Map to "Other" to capture this.' },
  { pattern: 'waste|skip|refuse|recycling|disposal', tip: 'Waste collection and disposal maps to "Waste Disposal".' },
  { pattern: 'water', tip: 'Water supply and treatment maps to "Water Supply".' },
  { pattern: 'electric', tip: 'Grid electricity is a key Scope 2 source. Map to "Grid Electricity".' },
  { pattern: 'gas', tip: 'If this is natural gas (heating/process), map to "Natural Gas". If bottled gas, use "LPG".' },
]

// ── Types ───────────────────────────────────────────────────────────

interface AccountMapping {
  id: string
  xero_account_id: string
  xero_account_code: string | null
  xero_account_name: string
  xero_account_type: string | null
  emission_category: string | null
  is_excluded: boolean
}

interface AISuggestionData {
  category: string
  confidence: number
  reasoning: string
}

// ── Component ───────────────────────────────────────────────────────

export function XeroAccountMapping() {
  const { currentOrganization } = useOrganization()
  const [mappings, setMappings] = useState<AccountMapping[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isReclassifying, setIsReclassifying] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [suggestions, setSuggestions] = useState<Map<string, string>>(new Map())
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, AISuggestionData>>(new Map())
  const [isAiSuggesting, setIsAiSuggesting] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [mappedSectionOpen, setMappedSectionOpen] = useState(false)
  const [excludedSectionOpen, setExcludedSectionOpen] = useState(false)

  // ── Data fetching ─────────────────────────────────────────────────

  const fetchMappings = useCallback(async () => {
    if (!currentOrganization?.id) return

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

  // ── Handlers ──────────────────────────────────────────────────────

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

  function handleQuickExclude(accountId: string) {
    setMappings(prev =>
      prev.map(m =>
        m.xero_account_id === accountId
          ? { ...m, emission_category: null, is_excluded: true }
          : m
      )
    )
    setHasChanges(true)
  }

  function handleUndoExclude(accountId: string) {
    setMappings(prev =>
      prev.map(m =>
        m.xero_account_id === accountId
          ? { ...m, is_excluded: false }
          : m
      )
    )
    setHasChanges(true)
  }

  async function handleAiSuggest() {
    if (!currentOrganization?.id) return
    setIsAiSuggesting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/xero/suggest-account-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ organizationId: currentOrganization.id }),
      })

      if (!res.ok) {
        const text = await res.text()
        let errorMsg = 'Failed to get AI suggestions'
        try {
          const data = JSON.parse(text)
          errorMsg = data.error || errorMsg
        } catch {
          // Non-JSON response (e.g. HTML error page)
        }
        throw new Error(errorMsg)
      }

      const { suggestions: aiResults } = await res.json()
      const newAiSuggestions = new Map<string, AISuggestionData>()

      setMappings(prev => prev.map(m => {
        const suggestion = aiResults.find((s: { accountId: string }) => s.accountId === m.xero_account_id)
        if (suggestion?.category && m.emission_category === null && !m.is_excluded) {
          newAiSuggestions.set(m.xero_account_id, {
            category: suggestion.category,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
          })
          if (suggestion.category === 'exclude') {
            return { ...m, is_excluded: true }
          }
          return { ...m, emission_category: suggestion.category }
        }
        return m
      }))

      setAiSuggestions(newAiSuggestions)
      if (newAiSuggestions.size > 0) {
        setHasChanges(true)
        toast.success(`AI suggested categories for ${newAiSuggestions.size} accounts. Review and save.`)
      } else {
        toast.info('No additional suggestions found')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI suggestion failed'
      toast.error(message)
    } finally {
      setIsAiSuggesting(false)
    }
  }

  async function handleSave() {
    if (!currentOrganization?.id) return
    setIsSaving(true)

    try {
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
      setAiSuggestions(new Map())
      toast.success('Account mappings saved. Reclassifying transactions...')

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

  // ── Computed: sort and group ──────────────────────────────────────

  const expenseAccounts = useMemo(() =>
    mappings.filter(
      m => !m.xero_account_type || ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS'].includes(m.xero_account_type)
    ),
    [mappings]
  )

  const { unmappedAccounts, mappedAccounts, excludedAccounts, unmappedCount, mappedCount, excludedCount } = useMemo(() => {
    const unmapped: AccountMapping[] = []
    const mapped: AccountMapping[] = []
    const excluded: AccountMapping[] = []

    for (const m of expenseAccounts) {
      if (m.is_excluded) {
        excluded.push(m)
      } else if (m.emission_category) {
        mapped.push(m)
      } else {
        unmapped.push(m)
      }
    }

    return {
      unmappedAccounts: unmapped,
      mappedAccounts: mapped,
      excludedAccounts: excluded,
      unmappedCount: unmapped.length,
      mappedCount: mapped.length,
      excludedCount: excluded.length,
    }
  }, [expenseAccounts])

  // ── Helpers ───────────────────────────────────────────────────────

  function getGuidanceTip(accountName: string): string | null {
    const lower = accountName.toLowerCase()
    for (const { pattern, tip } of GUIDANCE_TIPS) {
      if (new RegExp(pattern).test(lower)) return tip
    }
    return null
  }

  function getConfidenceColour(confidence: number): string {
    if (confidence >= 0.8) return 'bg-emerald-500'
    if (confidence >= 0.5) return 'bg-amber-500'
    return 'bg-red-500'
  }

  // ── Early returns ─────────────────────────────────────────────────

  if (!isConnected || isLoading) return null
  if (mappings.length === 0) return null
  if (expenseAccounts.length === 0) return null

  const totalAccounts = expenseAccounts.length
  const completedCount = mappedCount + excludedCount
  const progressPercent = totalAccounts > 0 ? Math.round((completedCount / totalAccounts) * 100) : 0

  // ── Render helpers ────────────────────────────────────────────────

  function renderAccountRow(mapping: AccountMapping, options?: { showUndoExclude?: boolean }) {
    const aiSuggestion = aiSuggestions.get(mapping.xero_account_id)
    const keywordSuggestion = suggestions.has(mapping.xero_account_id)
    const guidanceTip = getGuidanceTip(mapping.xero_account_name)

    return (
      <div
        key={mapping.xero_account_id}
        className={`grid grid-cols-[1fr_1fr_auto] gap-3 items-center rounded-md border px-3 py-2 ${
          mapping.is_excluded ? 'opacity-60 bg-slate-50 dark:bg-slate-900/30' : ''
        }`}
      >
        {/* Account name + code + guidance */}
        <div className="min-w-0 flex items-center gap-1.5">
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${mapping.is_excluded ? 'line-through text-muted-foreground' : ''}`}>
              {mapping.xero_account_name}
            </p>
            {mapping.xero_account_code && (
              <p className="text-xs text-muted-foreground">{mapping.xero_account_code}</p>
            )}
          </div>
          {guidanceTip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  {guidanceTip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Category selector + suggestion badges */}
        <div className="flex items-center gap-1.5">
          {options?.showUndoExclude ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => handleUndoExclude(mapping.xero_account_id)}
            >
              Undo exclude
            </Button>
          ) : (
            <>
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

              {/* AI suggestion badge with confidence + reasoning tooltip */}
              {aiSuggestion ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 cursor-help gap-1"
                      >
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${getConfidenceColour(aiSuggestion.confidence)}`} />
                        <Sparkles className="h-3 w-3" />
                        AI
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs font-medium mb-1">
                        {CATEGORY_LABEL_MAP[aiSuggestion.category] || aiSuggestion.category}
                        {' '}
                        <span className="text-muted-foreground">({Math.round(aiSuggestion.confidence * 100)}% confidence)</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{aiSuggestion.reasoning}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : keywordSuggestion ? (
                <Badge variant="outline" className="text-xs shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  Suggested
                </Badge>
              ) : null}
            </>
          )}
        </div>

        {/* Status / Quick exclude */}
        <div className="w-20 flex justify-end gap-1">
          {mapping.emission_category || mapping.is_excluded ? (
            <Badge
              variant="outline"
              className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <Check className="h-3 w-3" />
            </Badge>
          ) : (
            <>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                      onClick={() => handleQuickExclude(mapping.xero_account_id)}
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">
                    Exclude (not emissions-relevant)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────

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
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isReclassifying && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Reclassifying...
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGuide(prev => !prev)}
              className="text-muted-foreground"
            >
              <HelpCircle className="h-4 w-4 mr-1.5" />
              Guide
            </Button>
            {unmappedCount > 0 && (
              <Button
                onClick={handleAiSuggest}
                disabled={isAiSuggesting || isSaving || isReclassifying}
                size="sm"
                variant="outline"
              >
                {isAiSuggesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isAiSuggesting ? 'Analysing...' : 'AI Suggest'}
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

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{completedCount} of {totalAccounts} accounts mapped or excluded</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#ccff00] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Guidance panel */}
        {showGuide && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                How to map your accounts
              </h4>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowGuide(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-2">
              <p>
                Each Xero expense account needs to be assigned to a GHG emission category (or excluded if it is not emissions-relevant).
                This determines how your transactions are classified for carbon reporting.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="rounded-md border p-2.5 space-y-1">
                  <p className="font-semibold text-foreground">Scope 1 (Direct)</p>
                  <p>Fuels you burn on site or in your vehicles: natural gas, diesel, petrol, LPG.</p>
                </div>
                <div className="rounded-md border p-2.5 space-y-1">
                  <p className="font-semibold text-foreground">Scope 2 (Purchased energy)</p>
                  <p>Grid electricity. This is the only Scope 2 category for most businesses.</p>
                </div>
                <div className="rounded-md border p-2.5 space-y-1">
                  <p className="font-semibold text-foreground">Scope 3 (Value chain)</p>
                  <p>Everything else: travel, freight, packaging, raw materials, water, waste, services.</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t space-y-1">
                <p className="font-semibold text-foreground">What to exclude</p>
                <p>
                  Accounts for wages, rent, insurance, bank fees, depreciation, subscriptions, and other non-physical costs
                  are not emissions-relevant and should be excluded. Look for the
                  {' '}<Ban className="h-3 w-3 inline-block" />{' '}button next to unmapped accounts.
                </p>
              </div>
              <div className="mt-2 pt-2 border-t space-y-1">
                <p className="font-semibold text-foreground">Not sure?</p>
                <p>
                  Look for the <Lightbulb className="h-3 w-3 inline-block text-amber-500" /> icon next to account names for
                  contextual guidance. Or click <strong>AI Suggest</strong> to let AI analyse all your unmapped accounts at once.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs font-medium text-muted-foreground px-1">
          <div>Xero Account</div>
          <div>Emission Category</div>
          <div className="w-20 text-right">Status</div>
        </div>

        {/* Section 1: Unmapped accounts (always visible, at the top) */}
        {unmappedAccounts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Needs mapping ({unmappedCount})
            </p>
            {unmappedAccounts.map(m => renderAccountRow(m))}
          </div>
        )}

        {/* Section 2: Mapped accounts (collapsible) */}
        {mappedAccounts.length > 0 && (
          <Collapsible open={mappedSectionOpen} onOpenChange={setMappedSectionOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1 hover:text-foreground transition-colors w-full text-left">
              {mappedSectionOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Mapped ({mappedCount})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 mt-1.5">
              {mappedAccounts.map(m => renderAccountRow(m))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Section 3: Excluded accounts (collapsible) */}
        {excludedAccounts.length > 0 && (
          <Collapsible open={excludedSectionOpen} onOpenChange={setExcludedSectionOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1 hover:text-foreground transition-colors w-full text-left">
              {excludedSectionOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Excluded ({excludedCount})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 mt-1.5">
              {excludedAccounts.map(m => renderAccountRow(m, { showUndoExclude: true }))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* All done state */}
        {unmappedCount === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Check className="h-5 w-5 mx-auto mb-1.5 text-emerald-500" />
            All accounts mapped or excluded. Save to apply.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
