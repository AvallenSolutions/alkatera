'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Target,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { StateChip } from '@/components/studio'
import type { WorkingTone } from '@/components/studio/theme'
import { toast } from 'sonner'
import { useFlagTargets } from '@/hooks/data/useFlagTargets'
import { useFlagThreshold } from '@/hooks/data/useFlagThreshold'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FlagTarget {
  id: string
  target_type: 'absolute' | 'intensity'
  scope: 'flag' | 'non_flag' | 'combined'
  base_year: number
  base_year_emissions_co2e: number | null
  target_year: number
  reduction_percentage: number
  meets_sbti_minimum: boolean
  sbti_pathway: string | null
  commodity_coverage: string[] | null
  methodology_notes: string | null
  status: 'draft' | 'submitted' | 'validated' | 'expired'
  submitted_at: string | null
  validated_at: string | null
  created_at: string
  updated_at: string
}

type NewTargetForm = {
  target_type: 'absolute' | 'intensity'
  scope: 'flag' | 'non_flag' | 'combined'
  base_year: number
  base_year_emissions_co2e: string
  target_year: number
  reduction_percentage: string
  sbti_pathway: '1.5c' | 'well_below_2c'
  commodity_coverage: string
  methodology_notes: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_TONES: Record<FlagTarget['status'], WorkingTone> = {
  draft: 'quiet',
  submitted: 'attention',
  validated: 'good',
  expired: 'stale',
}

const STATUS_LABELS: Record<FlagTarget['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  validated: 'Validated',
  expired: 'Expired',
}

const SCOPE_LABELS: Record<FlagTarget['scope'], string> = {
  flag: 'FLAG emissions',
  non_flag: 'Non-FLAG emissions',
  combined: 'Combined',
}

function getSbtiMinimumReduction(targetYear: number): number {
  if (targetYear <= 2030) return 30
  if (targetYear >= 2050) return 72
  // Linear interpolation between 2030 (30%) and 2050 (72%)
  const fraction = (targetYear - 2030) / (2050 - 2030)
  return Math.round(30 + fraction * (72 - 30))
}

function meetsMinimum(reductionPct: number, targetYear: number): boolean {
  return reductionPct >= getSbtiMinimumReduction(targetYear)
}

const INITIAL_FORM: NewTargetForm = {
  target_type: 'absolute',
  scope: 'flag',
  base_year: 2023,
  base_year_emissions_co2e: '',
  target_year: 2030,
  reduction_percentage: '',
  sbti_pathway: '1.5c',
  commodity_coverage: '',
  methodology_notes: '',
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FlagTargetSetting() {
  const {
    targets,
    loading: targetsLoading,
    createTarget,
    updateTarget,
    deleteTarget,
  } = useFlagTargets()
  const { loading: thresholdLoading, flagExceeded, maxFlagPct } = useFlagThreshold()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<NewTargetForm>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [referenceOpen, setReferenceOpen] = useState(false)

  const loading = targetsLoading || thresholdLoading

  /* ---- form helpers ---- */

  const reductionNum = parseFloat(form.reduction_percentage) || 0
  const sbtiMin = getSbtiMinimumReduction(form.target_year)
  const reductionMeetsSbti = reductionNum >= sbtiMin

  function updateField<K extends keyof NewTargetForm>(key: K, value: NewTargetForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(submitImmediately: boolean) {
    if (!form.reduction_percentage || reductionNum <= 0 || reductionNum > 100) {
      toast.error('Please enter a valid reduction percentage between 1 and 100.')
      return
    }
    if (form.target_year <= form.base_year) {
      toast.error('Target year must be after the base year.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        target_type: form.target_type,
        scope: form.scope,
        base_year: form.base_year,
        base_year_emissions_co2e: form.base_year_emissions_co2e
          ? parseFloat(form.base_year_emissions_co2e)
          : null,
        target_year: form.target_year,
        reduction_percentage: reductionNum,
        meets_sbti_minimum: meetsMinimum(reductionNum, form.target_year),
        sbti_pathway: form.sbti_pathway,
        commodity_coverage: form.commodity_coverage
          ? form.commodity_coverage.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        methodology_notes: form.methodology_notes || null,
        status: submitImmediately ? ('submitted' as const) : ('draft' as const),
      }

      await createTarget(payload)
      toast.success(
        submitImmediately ? 'FLAG target submitted.' : 'FLAG target saved as draft.'
      )
      setForm(INITIAL_FORM)
      setDialogOpen(false)
    } catch {
      toast.error('Failed to save FLAG target. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTarget(id)
      toast.success('FLAG target deleted.')
    } catch {
      toast.error('Failed to delete target.')
    }
  }

  async function handleSubmit(id: string) {
    try {
      await updateTarget(id, { status: 'submitted', submitted_at: new Date().toISOString() })
      toast.success('FLAG target submitted for validation.')
    } catch {
      toast.error('Failed to submit target.')
    }
  }

  /* ---- render ---- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-dim">
          Loading FLAG target data
        </p>
      </div>
    )
  }

  const validatedCount = targets.filter((t) => t.status === 'validated').length
  const hasTargets = targets.length > 0

  return (
    <div className="space-y-6">
      {/* ---- Status header ---- */}
      <StatusHeader
        flagExceeded={flagExceeded}
        maxFlagPct={maxFlagPct}
        hasTargets={hasTargets}
        validatedCount={validatedCount}
      />

      {/* ---- Existing targets ---- */}
      {hasTargets && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Your FLAG Targets</h3>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Target
                </Button>
              </DialogTrigger>
              <AddTargetDialog
                form={form}
                updateField={updateField}
                reductionNum={reductionNum}
                sbtiMin={sbtiMin}
                reductionMeetsSbti={reductionMeetsSbti}
                saving={saving}
                onSave={handleSave}
              />
            </Dialog>
          </div>

          {targets.map((target) => (
            <TargetCard
              key={target.id}
              target={target}
              onDelete={handleDelete}
              onSubmit={handleSubmit}
            />
          ))}
        </div>
      )}

      {/* ---- Empty state with add button ---- */}
      {!hasTargets && flagExceeded && (
        <Card className="border-dashed border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-10 w-10 text-studio-dim mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No FLAG targets have been set yet. Create your first target to begin compliance.
            </p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add FLAG Target
                </Button>
              </DialogTrigger>
              <AddTargetDialog
                form={form}
                updateField={updateField}
                reductionNum={reductionNum}
                sbtiMin={sbtiMin}
                reductionMeetsSbti={reductionMeetsSbti}
                saving={saving}
                onSave={handleSave}
              />
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* ---- SBTi minimum stringency reference ---- */}
      <div className="rounded-[6px] border border-border bg-card">
        <button
          onClick={() => setReferenceOpen(!referenceOpen)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <span className="text-sm font-medium text-foreground">
            SBTi Minimum Stringency Reference
          </span>
          {referenceOpen ? (
            <ChevronUp className="h-4 w-4 text-studio-dim" />
          ) : (
            <ChevronDown className="h-4 w-4 text-studio-dim" />
          )}
        </button>
        {referenceOpen && (
          <div className="border-t border-border px-4 pb-4 pt-3">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <StateChip tone="quiet">Near-term</StateChip>
                <span>By 2030: &ge; 30% absolute reduction from base year</span>
              </div>
              <div className="flex items-center gap-2">
                <StateChip tone="quiet">Long-term</StateChip>
                <span>By 2050: &ge; 72% absolute reduction from base year</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Interim years are linearly interpolated. Intensity targets must demonstrate
                equivalent ambition to absolute contraction benchmarks.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function StatusHeader({
  flagExceeded,
  maxFlagPct,
  hasTargets,
  validatedCount,
}: {
  flagExceeded: boolean
  maxFlagPct: number
  hasTargets: boolean
  validatedCount: number
}) {
  if (!flagExceeded) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-studio-good mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">FLAG Emissions Below Threshold</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your FLAG emissions are below the 20% threshold of total Scope 1+2+3 emissions.
            No separate FLAG science-based targets are required at this time.
          </p>
        </div>
      </div>
    )
  }

  if (hasTargets) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-studio-good mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">FLAG Targets Set</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your land-based emissions represent {maxFlagPct}% of total emissions.
            You have {validatedCount > 0 ? `${validatedCount} validated` : 'targets in progress'}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[6px] border border-border bg-card p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-studio-attention mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-foreground">FLAG Targets Required</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your land-based emissions represent {maxFlagPct}% of total Scope 1+2+3 emissions.
          Under SBTi FLAG Guidance v1.2, you must set separate FLAG science-based targets.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function TargetCard({
  target,
  onDelete,
  onSubmit,
}: {
  target: FlagTarget
  onDelete: (id: string) => void
  onSubmit: (id: string) => void
}) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {target.target_type === 'absolute'
                  ? 'Absolute Contraction'
                  : 'Intensity-Based'}{' '}
                Target
              </CardTitle>
              <StateChip tone={STATUS_TONES[target.status]}>
                {STATUS_LABELS[target.status]}
              </StateChip>
            </div>
            <CardDescription>{SCOPE_LABELS[target.scope]}</CardDescription>
          </div>

          {target.status === 'draft' && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSubmit(target.id)}
              >
                Submit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(target.id)}
                className="text-muted-foreground hover:text-studio-stale h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Base year</span>{' '}
            <span className="text-foreground font-medium tabular-nums">{target.base_year}</span>
          </div>
          <span className="text-muted-foreground">&rarr;</span>
          <div>
            <span className="text-muted-foreground">Target year</span>{' '}
            <span className="text-foreground font-medium tabular-nums">{target.target_year}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Reduction</span>{' '}
            <span className="text-foreground font-medium tabular-nums">{target.reduction_percentage}%</span>
          </div>
        </div>

        {target.base_year_emissions_co2e !== null && (
          <p className="text-xs text-muted-foreground">
            Base year emissions: {target.base_year_emissions_co2e.toLocaleString()} tonnes CO2e
          </p>
        )}

        <div className="flex items-center gap-1.5 text-xs">
          {target.meets_sbti_minimum ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-studio-good" />
              <span className="text-studio-good">Meets SBTi minimum stringency</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-studio-attention" />
              <span className="text-studio-attention">
                Below SBTi minimum ({getSbtiMinimumReduction(target.target_year)}% required by{' '}
                {target.target_year})
              </span>
            </>
          )}
        </div>

        {target.sbti_pathway && (
          <p className="text-xs text-muted-foreground">
            Pathway: {target.sbti_pathway === '1.5c' ? '1.5\u00B0C aligned' : 'Well below 2\u00B0C'}
          </p>
        )}

        {target.commodity_coverage && target.commodity_coverage.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {target.commodity_coverage.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">
                {c}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function AddTargetDialog({
  form,
  updateField,
  reductionNum,
  sbtiMin,
  reductionMeetsSbti,
  saving,
  onSave,
}: {
  form: NewTargetForm
  updateField: <K extends keyof NewTargetForm>(key: K, value: NewTargetForm[K]) => void
  reductionNum: number
  sbtiMin: number
  reductionMeetsSbti: boolean
  saving: boolean
  onSave: (submit: boolean) => void
}) {
  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add FLAG Target</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        {/* Target type */}
        <div className="space-y-1.5">
          <Label>Target type</Label>
          <Select
            value={form.target_type}
            onValueChange={(v) => updateField('target_type', v as 'absolute' | 'intensity')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="absolute">Absolute Contraction</SelectItem>
              <SelectItem value="intensity">Intensity-Based</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Scope */}
        <div className="space-y-1.5">
          <Label>Scope</Label>
          <Select
            value={form.scope}
            onValueChange={(v) =>
              updateField('scope', v as 'flag' | 'non_flag' | 'combined')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flag">FLAG emissions</SelectItem>
              <SelectItem value="non_flag">Non-FLAG emissions</SelectItem>
              <SelectItem value="combined">Combined</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Base year + emissions */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Base year</Label>
            <Input
              type="number"
              min={2015}
              max={2030}
              value={form.base_year}
              onChange={(e) => updateField('base_year', parseInt(e.target.value) || 2023)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Base year emissions (tCO2e)</Label>
            <Input
              type="number"
              min={0}
              placeholder="Optional"
              value={form.base_year_emissions_co2e}
              onChange={(e) => updateField('base_year_emissions_co2e', e.target.value)}
            />
          </div>
        </div>

        {/* Target year + reduction */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Target year</Label>
            <Input
              type="number"
              min={2025}
              max={2050}
              value={form.target_year}
              onChange={(e) => updateField('target_year', parseInt(e.target.value) || 2030)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reduction (%)</Label>
            <Input
              type="number"
              min={1}
              max={100}
              placeholder="e.g. 30"
              value={form.reduction_percentage}
              onChange={(e) => updateField('reduction_percentage', e.target.value)}
            />
            {form.reduction_percentage && (
              <p
                className={`text-xs ${
                  reductionMeetsSbti ? 'text-studio-good' : 'text-studio-attention'
                }`}
              >
                {reductionMeetsSbti
                  ? `Meets SBTi minimum (${sbtiMin}%)`
                  : `Below SBTi minimum of ${sbtiMin}% for ${form.target_year}`}
              </p>
            )}
          </div>
        </div>

        {/* SBTi pathway */}
        <div className="space-y-1.5">
          <Label>SBTi pathway</Label>
          <Select
            value={form.sbti_pathway}
            onValueChange={(v) => updateField('sbti_pathway', v as '1.5c' | 'well_below_2c')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1.5c">1.5&deg;C aligned</SelectItem>
              <SelectItem value="well_below_2c">Well below 2&deg;C</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Commodity coverage */}
        <div className="space-y-1.5">
          <Label>Commodity coverage</Label>
          <Input
            placeholder="e.g. barley, grapes, hops"
            value={form.commodity_coverage}
            onChange={(e) => updateField('commodity_coverage', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Comma-separated list of commodities covered</p>
        </div>

        {/* Methodology notes */}
        <div className="space-y-1.5">
          <Label>Methodology notes</Label>
          <Textarea
            placeholder="Optional notes on methodology, data sources, or assumptions..."
            rows={3}
            value={form.methodology_notes}
            onChange={(e) => updateField('methodology_notes', e.target.value)}
          />
        </div>

        <Separator />

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onSave(false)} disabled={saving}>
            Save as Draft
          </Button>
          <Button onClick={() => onSave(true)} disabled={saving}>
            Submit
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
