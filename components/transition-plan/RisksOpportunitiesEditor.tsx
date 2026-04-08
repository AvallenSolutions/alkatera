'use client'

import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, Trash2 } from 'lucide-react'
import {
  type RiskOpportunity,
  CATEGORY_LABELS,
  LIKELIHOOD_LABELS,
  IMPACT_LABELS,
  TIME_HORIZON_LABELS,
} from '@/lib/transition-plan/types'

interface RisksOpportunitiesEditorProps {
  items: RiskOpportunity[]
  isGenerating?: boolean
  onChange: (items: RiskOpportunity[]) => void
  onRegenerate?: () => void
}

const LIKELIHOOD_COLOURS: Record<RiskOpportunity['likelihood'], string> = {
  low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

const IMPACT_COLOURS: Record<RiskOpportunity['impact'], string> = {
  low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

export function RisksOpportunitiesEditor({
  items,
  isGenerating = false,
  onChange,
  onRegenerate,
}: RisksOpportunitiesEditorProps) {
  function update(id: string, patch: Partial<RiskOpportunity>) {
    onChange(items.map(item => item.id === id ? { ...item, ...patch, aiGenerated: false } : item))
  }

  function remove(id: string) {
    onChange(items.filter(item => item.id !== id))
  }

  const risks = items.filter(i => i.type === 'risk')
  const opportunities = items.filter(i => i.type === 'opportunity')

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-[#ccff00]/20 flex items-center justify-center animate-pulse">
          <Sparkles className="w-6 h-6 text-[#84cc16]" />
        </div>
        <div>
          <p className="text-sm font-medium">Claude is analysing your plan</p>
          <p className="text-xs text-muted-foreground mt-1">Identifying climate risks and opportunities specific to your organisation</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border border-dashed border-border rounded-xl">
        <Sparkles className="w-8 h-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">No risks or opportunities yet</p>
          <p className="text-xs text-muted-foreground mt-1">Save your plan to generate an AI analysis</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Regenerate button */}
      {onRegenerate && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Edit any item below to mark it as manually reviewed. Changes are saved with the plan.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            Regenerate
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risks column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold">Risks ({risks.length})</h3>
          </div>
          {risks.map(item => (
            <RoCard
              key={item.id}
              item={item}
              onUpdate={patch => update(item.id, patch)}
              onRemove={() => remove(item.id)}
            />
          ))}
          {risks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">No risks identified</p>
          )}
        </div>

        {/* Opportunities column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-semibold">Opportunities ({opportunities.length})</h3>
          </div>
          {opportunities.map(item => (
            <RoCard
              key={item.id}
              item={item}
              onUpdate={patch => update(item.id, patch)}
              onRemove={() => remove(item.id)}
            />
          ))}
          {opportunities.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">No opportunities identified</p>
          )}
        </div>
      </div>
    </div>
  )
}

function RoCard({
  item,
  onUpdate,
  onRemove,
}: {
  item: RiskOpportunity
  onUpdate: (patch: Partial<RiskOpportunity>) => void
  onRemove: () => void
}) {
  const isRisk = item.type === 'risk'
  const accentColour = isRisk ? 'border-l-red-300' : 'border-l-green-400'

  return (
    <div className={`border border-border border-l-4 ${accentColour} rounded-xl p-4 bg-card space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          <Badge variant="outline" className="text-xs">
            {CATEGORY_LABELS[item.category]}
          </Badge>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LIKELIHOOD_COLOURS[item.likelihood]}`}>
            {LIKELIHOOD_LABELS[item.likelihood]} likelihood
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${IMPACT_COLOURS[item.impact]}`}>
            {IMPACT_LABELS[item.impact]} impact
          </span>
          {item.aiGenerated && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#ccff00]/20 text-foreground">
              <Sparkles className="w-3 h-3" />
              AI
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
          aria-label="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Title */}
      <input
        type="text"
        value={item.title}
        onChange={e => onUpdate({ title: e.target.value })}
        className="w-full text-sm font-semibold bg-transparent border-0 border-b border-border pb-1 focus:outline-none focus:border-muted-foreground"
        placeholder="Title"
      />

      {/* Description */}
      <Textarea
        value={item.description}
        onChange={e => onUpdate({ description: e.target.value })}
        className="text-sm min-h-[72px] resize-none"
        placeholder="Description"
      />

      {/* Selectors row */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Likelihood</label>
          <Select
            value={item.likelihood}
            onValueChange={v => onUpdate({ likelihood: v as RiskOpportunity['likelihood'] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(LIKELIHOOD_LABELS) as [RiskOpportunity['likelihood'], string][]).map(([v, l]) => (
                <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Impact</label>
          <Select
            value={item.impact}
            onValueChange={v => onUpdate({ impact: v as RiskOpportunity['impact'] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(IMPACT_LABELS) as [RiskOpportunity['impact'], string][]).map(([v, l]) => (
                <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Time Horizon</label>
          <Select
            value={item.timeHorizon}
            onValueChange={v => onUpdate({ timeHorizon: v as RiskOpportunity['timeHorizon'] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(TIME_HORIZON_LABELS) as [RiskOpportunity['timeHorizon'], string][]).map(([v, l]) => (
                <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
