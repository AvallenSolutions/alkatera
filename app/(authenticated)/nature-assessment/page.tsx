'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Save, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type DependencyLevel = 'low' | 'medium' | 'high' | 'critical' | ''
type InvasiveRisk = 'none' | 'low' | 'medium' | 'high' | ''
type MaterialityLevel = 'not_material' | 'potentially_material' | 'material' | 'highly_material' | ''

interface NatureForm {
  // Evaluate - Dependencies
  water_dependency: DependencyLevel
  water_dependency_notes: string
  pollination_dependency: DependencyLevel
  pollination_dependency_notes: string
  soil_health_dependency: DependencyLevel
  soil_health_dependency_notes: string
  // Evaluate - Impacts
  total_land_ha: string
  land_converted_ha: string
  nitrogen_kg: string
  phosphorus_kg: string
  pesticide_kg: string
  invasive_species_risk: InvasiveRisk
  invasive_species_notes: string
  // Assess and Prepare
  nature_risk_materiality: MaterialityLevel
  physical_risk_notes: string
  transition_risk_notes: string
  nature_positive_target: boolean
  target_year: string
  baseline_year: string
  target_description: string
}

interface LocateSummary {
  totalSites: number
  withEcosystem: number
  sensitiveSites: string[]
  waterStress: Record<string, number>
}

const EMPTY_FORM: NatureForm = {
  water_dependency: '',
  water_dependency_notes: '',
  pollination_dependency: '',
  pollination_dependency_notes: '',
  soil_health_dependency: '',
  soil_health_dependency_notes: '',
  total_land_ha: '',
  land_converted_ha: '',
  nitrogen_kg: '',
  phosphorus_kg: '',
  pesticide_kg: '',
  invasive_species_risk: '',
  invasive_species_notes: '',
  nature_risk_materiality: '',
  physical_risk_notes: '',
  transition_risk_notes: '',
  nature_positive_target: false,
  target_year: '',
  baseline_year: '',
  target_description: '',
}

const SECTIONS = ['Locate', 'Evaluate: Dependencies', 'Evaluate: Impacts', 'Assess & Prepare'] as const
const CURRENT_YEAR = new Date().getFullYear()

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sectionStatus(section: number, form: NatureForm, locate: LocateSummary | null): 'complete' | 'partial' | 'empty' {
  if (section === 0) {
    if (!locate) return 'empty'
    if (locate.withEcosystem === locate.totalSites && locate.totalSites > 0) return 'complete'
    if (locate.withEcosystem > 0) return 'partial'
    return 'empty'
  }
  if (section === 1) {
    const deps = [form.water_dependency, form.pollination_dependency, form.soil_health_dependency]
    const filled = deps.filter(Boolean).length
    if (filled === 3) return 'complete'
    if (filled > 0) return 'partial'
    return 'empty'
  }
  if (section === 2) {
    const fields = [form.total_land_ha, form.land_converted_ha, form.nitrogen_kg, form.phosphorus_kg, form.pesticide_kg, form.invasive_species_risk]
    const filled = fields.filter(Boolean).length
    if (filled === fields.length) return 'complete'
    if (filled > 0) return 'partial'
    return 'empty'
  }
  if (section === 3) {
    const filled = [form.nature_risk_materiality, form.physical_risk_notes, form.transition_risk_notes].filter(Boolean).length
    if (filled === 3) return 'complete'
    if (filled > 0) return 'partial'
    return 'empty'
  }
  return 'empty'
}

function overallProgress(form: NatureForm, locate: LocateSummary | null): number {
  const statuses = [0, 1, 2, 3].map(s => sectionStatus(s, form, locate))
  const score = statuses.reduce((acc, s) => acc + (s === 'complete' ? 1 : s === 'partial' ? 0.5 : 0), 0)
  return Math.round((score / 4) * 100)
}

function statusColour(s: 'complete' | 'partial' | 'empty') {
  if (s === 'complete') return 'bg-emerald-600 text-white hover:bg-emerald-600'
  if (s === 'partial') return 'bg-amber-500 text-white hover:bg-amber-500'
  return 'bg-slate-700 text-slate-300 hover:bg-slate-700'
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function NatureAssessmentPage() {
  const { currentOrganization } = useOrganization()
  const supabase = getSupabaseBrowserClient()

  const [currentSection, setCurrentSection] = useState(0)
  const [form, setForm] = useState<NatureForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [locateSummary, setLocateSummary] = useState<LocateSummary | null>(null)

  const orgId = currentOrganization?.id

  /* ---- field updaters ---- */
  const updateField = useCallback(<K extends keyof NatureForm>(key: K, value: NatureForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }, [])

  /* ---- load existing assessment ---- */
  useEffect(() => {
    if (!orgId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('nature_impact_assessments')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('assessment_year', CURRENT_YEAR)
        .maybeSingle()

      if (cancelled) return

      if (data) {
        setAssessmentId(data.id)
        setForm({
          water_dependency: data.water_dependency_level ?? '',
          water_dependency_notes: data.water_dependency_notes ?? '',
          pollination_dependency: data.pollination_dependency_level ?? '',
          pollination_dependency_notes: data.pollination_dependency_notes ?? '',
          soil_health_dependency: data.soil_health_dependency_level ?? '',
          soil_health_dependency_notes: data.soil_health_dependency_notes ?? '',
          total_land_ha: data.land_use_ha?.toString() ?? '',
          land_converted_ha: data.land_converted_ha?.toString() ?? '',
          nitrogen_kg: data.pollution_outputs_kg_n?.toString() ?? '',
          phosphorus_kg: data.pollution_outputs_kg_p?.toString() ?? '',
          pesticide_kg: data.pesticide_kg_active?.toString() ?? '',
          invasive_species_risk: data.invasive_species_risk ?? '',
          invasive_species_notes: data.invasive_species_details ?? '',
          nature_risk_materiality: data.nature_risk_materiality ?? '',
          physical_risk_notes: data.physical_risk_notes ?? '',
          transition_risk_notes: data.transition_risk_notes ?? '',
          nature_positive_target: data.has_nature_positive_target ?? false,
          target_year: data.nature_positive_target_year?.toString() ?? '',
          baseline_year: data.nature_positive_baseline_year?.toString() ?? '',
          target_description: data.nature_positive_target_description ?? '',
        })
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [orgId, supabase])

  /* ---- load locate summary via API route (server-side query) ---- */
  useEffect(() => {
    if (!orgId) return
    let cancelled = false

    async function loadLocate() {
      try {
        const res = await fetch('/api/nature-assessment/locate')
        if (!res.ok) {
          console.error('[NatureAssessment] Locate fetch failed:', res.status)
          return
        }
        const { summary } = await res.json()
        if (cancelled) return
        setLocateSummary(summary)
      } catch (err) {
        console.error('[NatureAssessment] Locate fetch error:', err)
      }
    }

    loadLocate()
    return () => { cancelled = true }
  }, [orgId])

  /* ---- save handler ---- */
  const save = useCallback(async (status: 'draft' | 'complete' = 'draft') => {
    if (!orgId) return
    setSaving(true)

    const payload = {
      organization_id: orgId,
      assessment_year: CURRENT_YEAR,
      assessment_status: status,
      water_dependency_level: form.water_dependency || null,
      water_dependency_notes: form.water_dependency_notes || null,
      pollination_dependency_level: form.pollination_dependency || null,
      pollination_dependency_notes: form.pollination_dependency_notes || null,
      soil_health_dependency_level: form.soil_health_dependency || null,
      soil_health_dependency_notes: form.soil_health_dependency_notes || null,
      land_use_ha: form.total_land_ha ? parseFloat(form.total_land_ha) : null,
      land_converted_ha: form.land_converted_ha ? parseFloat(form.land_converted_ha) : null,
      pollution_outputs_kg_n: form.nitrogen_kg ? parseFloat(form.nitrogen_kg) : null,
      pollution_outputs_kg_p: form.phosphorus_kg ? parseFloat(form.phosphorus_kg) : null,
      pesticide_kg_active: form.pesticide_kg ? parseFloat(form.pesticide_kg) : null,
      invasive_species_risk: form.invasive_species_risk || null,
      invasive_species_details: form.invasive_species_notes || null,
      nature_risk_materiality: form.nature_risk_materiality || null,
      physical_risk_notes: form.physical_risk_notes || null,
      transition_risk_notes: form.transition_risk_notes || null,
      has_nature_positive_target: form.nature_positive_target,
      nature_positive_target_year: form.target_year ? parseInt(form.target_year) : null,
      nature_positive_baseline_year: form.baseline_year ? parseInt(form.baseline_year) : null,
      nature_positive_target_description: form.target_description || null,
    }

    const { data, error } = await supabase
      .from('nature_impact_assessments')
      .upsert(payload, { onConflict: 'organization_id,assessment_year' })
      .select('id')
      .single()

    setSaving(false)

    if (error) {
      toast.error('Failed to save assessment')
      console.error(error)
      return
    }

    if (data) setAssessmentId(data.id)
    setDirty(false)

    if (status === 'complete') {
      toast.success('Assessment marked as complete')
    }
  }, [orgId, form, supabase])

  /* ---- auto-save on section change ---- */
  useEffect(() => {
    if (dirty && orgId) {
      save('draft')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection])

  /* ---- navigation ---- */
  const goTo = (idx: number) => setCurrentSection(idx)
  const next = () => setCurrentSection(s => Math.min(s + 1, 3))
  const back = () => setCurrentSection(s => Math.max(s - 1, 0))

  /* ---- render helpers ---- */
  const progress = overallProgress(form, locateSummary)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nature Impact Assessment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Annual assessment per TNFD LEAP Framework and CSRD ESRS E4
        </p>
      </div>

      {/* LEAP phase pills */}
      <div className="flex flex-wrap items-center gap-2">
        {SECTIONS.map((label, idx) => {
          const status = sectionStatus(idx, form, locateSummary)
          return (
            <Badge
              key={label}
              className={`cursor-pointer text-xs px-3 py-1 ${statusColour(status)} ${currentSection === idx ? 'ring-2 ring-[#ccff00] ring-offset-2 ring-offset-background' : ''}`}
              onClick={() => goTo(idx)}
            >
              {label}
            </Badge>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Overall completion</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Separator />

      {/* Section 0: Locate */}
      {currentSection === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Locate: Nature Interface</h2>
          <p className="text-sm text-muted-foreground">
            Summary of your vineyard and orchard sites and their proximity to biodiversity-sensitive areas.
          </p>

          {locateSummary && locateSummary.totalSites === 0 && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-200">
                No vineyard or orchard sites found. Add sites in your growing profiles to populate TNFD Locate data.
              </p>
            </div>
          )}

          {locateSummary && locateSummary.totalSites > 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Total Sites</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{locateSummary.totalSites}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Ecosystem Type Set</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {locateSummary.withEcosystem}
                      <span className="text-sm font-normal text-muted-foreground"> / {locateSummary.totalSites}</span>
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Biodiversity-Sensitive</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{locateSummary.sensitiveSites.length}</p>
                    {locateSummary.sensitiveSites.length > 0 && (
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {locateSummary.sensitiveSites.map(name => (
                          <li key={name}>- {name}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Water stress distribution */}
              {Object.keys(locateSummary.waterStress).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Water Stress Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(locateSummary.waterStress).map(([level, count]) => (
                        <Badge key={level} variant="outline" className="text-xs">
                          {level}: {count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {locateSummary.withEcosystem < locateSummary.totalSites && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-200">
                    Complete location data in your vineyard/orchard profiles to improve your TNFD Locate disclosure.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Section 1: Evaluate - Dependencies */}
      {currentSection === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Evaluate: Dependencies on Nature</h2>
          <p className="text-sm text-muted-foreground">
            Rate your operational dependency on key ecosystem services.
          </p>

          {[
            { key: 'water' as const, label: 'Water', helper: 'How dependent is your production on freshwater availability?' },
            { key: 'pollination' as const, label: 'Pollination', helper: 'How dependent are your crops on insect pollination services?' },
            { key: 'soil_health' as const, label: 'Soil Health', helper: 'How dependent are your operations on healthy soil microbiome and structure?' },
          ].map(({ key, label, helper }) => (
            <Card key={key}>
              <CardContent className="pt-4 space-y-3">
                <div className="grid gap-3">
                  <div>
                    <Label className="text-xs">{label} Dependency</Label>
                    <p className="text-xs text-muted-foreground mb-1">{helper}</p>
                    <Select
                      value={form[`${key}_dependency`]}
                      onValueChange={v => updateField(`${key}_dependency`, v as DependencyLevel)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      className="text-sm"
                      rows={2}
                      placeholder={`Additional context on ${label.toLowerCase()} dependency...`}
                      value={form[`${key}_dependency_notes`]}
                      onChange={e => updateField(`${key}_dependency_notes`, e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Section 2: Evaluate - Impacts */}
      {currentSection === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Evaluate: Impacts on Nature</h2>
          <p className="text-sm text-muted-foreground">
            Quantify your organisation's direct impacts on natural systems.
          </p>

          <Card>
            <CardContent className="pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Total land under management (ha)</Label>
                  <Input
                    className="h-9"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={form.total_land_ha}
                    onChange={e => updateField('total_land_ha', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Land converted this year (ha)</Label>
                  <p className="text-xs text-muted-foreground mb-1">Enter 0 if no conversion occurred</p>
                  <Input
                    className="h-9"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={form.land_converted_ha}
                    onChange={e => updateField('land_converted_ha', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Nitrogen outputs to freshwater (kg)</Label>
                  <Input
                    className="h-9"
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="0"
                    value={form.nitrogen_kg}
                    onChange={e => updateField('nitrogen_kg', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Phosphorus outputs to freshwater (kg)</Label>
                  <Input
                    className="h-9"
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="0"
                    value={form.phosphorus_kg}
                    onChange={e => updateField('phosphorus_kg', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Pesticide active ingredient applied (kg)</Label>
                  <Input
                    className="h-9"
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="0"
                    value={form.pesticide_kg}
                    onChange={e => updateField('pesticide_kg', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Invasive species risk</Label>
                  <Select
                    value={form.invasive_species_risk}
                    onValueChange={v => updateField('invasive_species_risk', v as InvasiveRisk)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select risk level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.invasive_species_risk && form.invasive_species_risk !== 'none' && (
                <div className="mt-3">
                  <Label className="text-xs">Invasive species details</Label>
                  <Input
                    className="h-9"
                    placeholder="Describe the invasive species risk..."
                    value={form.invasive_species_notes}
                    onChange={e => updateField('invasive_species_notes', e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Section 3: Assess and Prepare */}
      {currentSection === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Assess & Prepare</h2>
          <p className="text-sm text-muted-foreground">
            Evaluate nature-related risks and set forward-looking targets.
          </p>

          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-xs">Nature risk materiality</Label>
                <Select
                  value={form.nature_risk_materiality}
                  onValueChange={v => updateField('nature_risk_materiality', v as MaterialityLevel)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select materiality level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_material">Not material</SelectItem>
                    <SelectItem value="potentially_material">Potentially material</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="highly_material">Highly material</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Physical risk notes</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Describe risks from ecosystem degradation, water scarcity, pollinator decline, etc.
                </p>
                <Textarea
                  className="text-sm"
                  rows={3}
                  placeholder="Physical risks to your operations..."
                  value={form.physical_risk_notes}
                  onChange={e => updateField('physical_risk_notes', e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">Transition risk notes</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Describe risks from regulatory change, market shifts or reputational exposure.
                </p>
                <Textarea
                  className="text-sm"
                  rows={3}
                  placeholder="Transition risks and regulatory exposure..."
                  value={form.transition_risk_notes}
                  onChange={e => updateField('transition_risk_notes', e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.nature_positive_target}
                  onCheckedChange={v => updateField('nature_positive_target', v)}
                />
                <Label className="text-xs">We have set a nature-positive target</Label>
              </div>

              {form.nature_positive_target && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Target year</Label>
                    <Input
                      className="h-9"
                      type="number"
                      min={CURRENT_YEAR}
                      max={2100}
                      placeholder="e.g. 2030"
                      value={form.target_year}
                      onChange={e => updateField('target_year', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Baseline year</Label>
                    <Input
                      className="h-9"
                      type="number"
                      min={2000}
                      max={CURRENT_YEAR}
                      placeholder="e.g. 2024"
                      value={form.baseline_year}
                      onChange={e => updateField('baseline_year', e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs">Target description</Label>
                    <Input
                      className="h-9"
                      placeholder="Describe your nature-positive target..."
                      value={form.target_description}
                      onChange={e => updateField('target_description', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentSection === 0}
          onClick={back}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {currentSection === 3 && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => save('draft')}
              >
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save Draft
              </Button>
              <Button
                size="sm"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => save('complete')}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Mark Complete
              </Button>
            </>
          )}

          {currentSection < 3 && (
            <Button size="sm" onClick={next}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
