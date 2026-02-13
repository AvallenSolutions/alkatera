'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Settings2,
  Building2,
  Scale,
  Globe,
  Recycle,
  Loader2,
  Save,
  Sparkles,
  Info,
  AlertCircle,
} from 'lucide-react'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

type PackagingActivity =
  | 'brand_owner'
  | 'packed_filled'
  | 'imported'
  | 'empty_packaging_seller'
  | 'hired_loaned'
  | 'online_marketplace'

type UkNation = 'england' | 'scotland' | 'wales' | 'northern_ireland'

type ObligationSize = 'large' | 'small' | 'below' | 'pending'

type NationDistributionMethod = 'manual' | 'auto_estimated' | 'hybrid'

interface NationDistribution {
  england: number
  scotland: number
  wales: number
  northern_ireland: number
}

interface EprSettings {
  rpd_organisation_id: string
  subsidiary_id: string
  annual_turnover_gbp: number | ''
  default_packaging_activity: PackagingActivity | ''
  default_uk_nation: UkNation | ''
  nation_distribution: NationDistribution
  nation_distribution_method: NationDistributionMethod
  apply_drs_exclusions: boolean
}

interface ObligationData {
  packaging_tonnage_kg: number | null
  obligation_size: ObligationSize
}

interface AutoEstimateResult {
  distribution: NationDistribution
  confidence: number
  sample_size: number
}

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const PACKAGING_ACTIVITY_OPTIONS: { value: PackagingActivity; label: string }[] = [
  { value: 'brand_owner', label: 'Brand Owner' },
  { value: 'packed_filled', label: 'Packed/Filled' },
  { value: 'imported', label: 'Imported' },
  { value: 'empty_packaging_seller', label: 'Empty Packaging Seller' },
  { value: 'hired_loaned', label: 'Hired/Loaned' },
  { value: 'online_marketplace', label: 'Online Marketplace' },
]

const UK_NATION_OPTIONS: { value: UkNation; label: string }[] = [
  { value: 'england', label: 'England' },
  { value: 'scotland', label: 'Scotland' },
  { value: 'wales', label: 'Wales' },
  { value: 'northern_ireland', label: 'Northern Ireland' },
]

const NATION_LABELS: Record<keyof NationDistribution, string> = {
  england: 'England',
  scotland: 'Scotland',
  wales: 'Wales',
  northern_ireland: 'Northern Ireland',
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function getObligationBadge(size: ObligationSize) {
  switch (size) {
    case 'large':
      return <Badge variant="info">Large Producer</Badge>
    case 'small':
      return <Badge variant="warning">Small Producer</Badge>
    case 'below':
      return <Badge variant="secondary">Below Threshold</Badge>
    case 'pending':
    default:
      return <Badge variant="outline">Pending</Badge>
  }
}

function formatTonnage(kg: number | null): string {
  if (kg === null) return '--'
  const tonnes = kg / 1000
  return `${tonnes.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function EprSettingsPage() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  // Form state
  const [settings, setSettings] = useState<EprSettings>({
    rpd_organisation_id: '',
    subsidiary_id: '',
    annual_turnover_gbp: '',
    default_packaging_activity: '',
    default_uk_nation: '',
    nation_distribution: { england: 0, scotland: 0, wales: 0, northern_ireland: 0 },
    nation_distribution_method: 'manual',
    apply_drs_exclusions: false,
  })

  // Obligation data (read-only, fetched separately)
  const [obligation, setObligation] = useState<ObligationData>({
    packaging_tonnage_kg: null,
    obligation_size: 'pending',
  })

  // Auto-estimate metadata
  const [autoEstimateConfidence, setAutoEstimateConfidence] = useState<number | null>(null)
  const [autoEstimateSampleSize, setAutoEstimateSampleSize] = useState<number | null>(null)

  // Loading states
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isLoadingObligation, setIsLoadingObligation] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEstimating, setIsEstimating] = useState(false)

  // -------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------

  const fetchSettings = useCallback(async () => {
    if (!orgId) return
    setIsLoadingSettings(true)
    try {
      const res = await fetch(`/api/epr/settings?organizationId=${orgId}`)
      if (!res.ok) throw new Error('Failed to load EPR settings')
      const data = await res.json()

      setSettings({
        rpd_organisation_id: data.rpd_organisation_id ?? '',
        subsidiary_id: data.subsidiary_id ?? '',
        annual_turnover_gbp: data.annual_turnover_gbp ?? '',
        default_packaging_activity: data.default_packaging_activity ?? '',
        default_uk_nation: data.default_uk_nation ?? '',
        nation_distribution: data.nation_distribution ?? {
          england: 0,
          scotland: 0,
          wales: 0,
          northern_ireland: 0,
        },
        nation_distribution_method: data.nation_distribution_method ?? 'manual',
        apply_drs_exclusions: data.apply_drs_exclusions ?? false,
      })

      if (data.auto_estimate_confidence != null) {
        setAutoEstimateConfidence(data.auto_estimate_confidence)
      }
      if (data.auto_estimate_sample_size != null) {
        setAutoEstimateSampleSize(data.auto_estimate_sample_size)
      }
    } catch (err) {
      console.error('Error fetching EPR settings:', err)
      toast.error('Failed to load EPR settings')
    } finally {
      setIsLoadingSettings(false)
    }
  }, [orgId])

  const fetchObligation = useCallback(async () => {
    if (!orgId) return
    setIsLoadingObligation(true)
    try {
      const res = await fetch(`/api/epr/obligation?organizationId=${orgId}`)
      if (!res.ok) throw new Error('Failed to load obligation data')
      const data = await res.json()

      setObligation({
        packaging_tonnage_kg: data.packaging_tonnage_kg ?? null,
        obligation_size: data.obligation_size ?? 'pending',
      })
    } catch (err) {
      console.error('Error fetching obligation data:', err)
    } finally {
      setIsLoadingObligation(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchSettings()
    fetchObligation()
  }, [fetchSettings, fetchObligation])

  // -------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------

  function updateField<K extends keyof EprSettings>(key: K, value: EprSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function updateNationDistribution(nation: keyof NationDistribution, value: string) {
    const parsed = value === '' ? 0 : parseFloat(value)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return

    setSettings((prev) => ({
      ...prev,
      nation_distribution: { ...prev.nation_distribution, [nation]: parsed },
      nation_distribution_method:
        prev.nation_distribution_method === 'auto_estimated' ? 'hybrid' : prev.nation_distribution_method,
    }))
  }

  const nationTotal = Object.values(settings.nation_distribution).reduce((sum, v) => sum + v, 0)
  const nationTotalValid = Math.abs(nationTotal - 100) < 0.01

  async function handleAutoEstimate() {
    if (!orgId) return
    setIsEstimating(true)
    try {
      const res = await fetch('/api/epr/estimate-nations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })
      if (!res.ok) throw new Error('Failed to estimate nation-of-sale distribution')
      const data: AutoEstimateResult = await res.json()

      setSettings((prev) => ({
        ...prev,
        nation_distribution: data.distribution,
        nation_distribution_method: 'auto_estimated',
      }))
      setAutoEstimateConfidence(data.confidence)
      setAutoEstimateSampleSize(data.sample_size)

      toast.success('Nation-of-sale distribution estimated successfully')
    } catch (err) {
      console.error('Error estimating nations:', err)
      toast.error('Failed to estimate nation-of-sale distribution')
    } finally {
      setIsEstimating(false)
    }
  }

  async function handleSave() {
    if (!orgId) return

    if (!nationTotalValid && nationTotal > 0) {
      toast.error('Nation-of-sale percentages must sum to 100%')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/epr/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          ...settings,
          annual_turnover_gbp: settings.annual_turnover_gbp === '' ? null : settings.annual_turnover_gbp,
          default_packaging_activity: settings.default_packaging_activity || null,
          default_uk_nation: settings.default_uk_nation || null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save EPR settings')
      }

      toast.success('EPR settings saved successfully')
      // Re-fetch obligation in case turnover change affected it
      fetchObligation()
    } catch (err: any) {
      console.error('Error saving EPR settings:', err)
      toast.error(err.message || 'Failed to save EPR settings')
    } finally {
      setIsSaving(false)
    }
  }

  // -------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------

  if (isLoadingSettings) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          EPR Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure your organisation&apos;s Extended Producer Responsibility parameters
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Registration Details */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Registration Details
          </CardTitle>
          <CardDescription>
            Your RPD registration identifiers for EPR reporting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rpd-org-id">RPD Organisation ID</Label>
              <Input
                id="rpd-org-id"
                placeholder="e.g. ORG-123456"
                value={settings.rpd_organisation_id}
                onChange={(e) => updateField('rpd_organisation_id', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subsidiary-id">
                Subsidiary ID
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="subsidiary-id"
                placeholder="e.g. SUB-001"
                value={settings.subsidiary_id}
                onChange={(e) => updateField('subsidiary_id', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Obligation Thresholds */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Obligation Thresholds
          </CardTitle>
          <CardDescription>
            Your annual turnover determines your EPR obligation size
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Annual turnover */}
            <div className="space-y-2">
              <Label htmlFor="annual-turnover">Annual Turnover (GBP)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  &pound;
                </span>
                <Input
                  id="annual-turnover"
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="e.g. 2000000"
                  className="pl-7"
                  value={settings.annual_turnover_gbp}
                  onChange={(e) =>
                    updateField(
                      'annual_turnover_gbp',
                      e.target.value === '' ? '' : parseFloat(e.target.value)
                    )
                  }
                />
              </div>
            </div>

            {/* Packaging tonnage (read-only) */}
            <div className="space-y-2">
              <Label>Packaging Tonnage</Label>
              {isLoadingObligation ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="flex h-10 items-center rounded-md border border-input bg-slate-50 px-3 text-sm dark:bg-slate-900">
                  {formatTonnage(obligation.packaging_tonnage_kg)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Auto-calculated from your packaging data
              </p>
            </div>
          </div>

          {/* Obligation size badge */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-sm font-medium text-muted-foreground">Obligation Size:</span>
            {isLoadingObligation ? (
              <Skeleton className="h-6 w-28" />
            ) : (
              getObligationBadge(obligation.obligation_size)
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Defaults */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Defaults
          </CardTitle>
          <CardDescription>
            Default values applied to new packaging items
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Default packaging activity */}
            <div className="space-y-2">
              <Label htmlFor="default-activity">Default Packaging Activity</Label>
              <Select
                value={settings.default_packaging_activity}
                onValueChange={(val) =>
                  updateField('default_packaging_activity', val as PackagingActivity)
                }
              >
                <SelectTrigger id="default-activity">
                  <SelectValue placeholder="Select activity" />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGING_ACTIVITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default UK nation */}
            <div className="space-y-2">
              <Label htmlFor="default-nation">Default UK Nation</Label>
              <Select
                value={settings.default_uk_nation}
                onValueChange={(val) => updateField('default_uk_nation', val as UkNation)}
              >
                <SelectTrigger id="default-nation">
                  <SelectValue placeholder="Select nation" />
                </SelectTrigger>
                <SelectContent>
                  {UK_NATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 4. Nation-of-Sale Distribution */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Nation-of-Sale Distribution
          </CardTitle>
          <CardDescription>
            Specify the percentage of sales in each UK nation. Percentages must sum to 100%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Method badge + auto-estimate button */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={
                settings.nation_distribution_method === 'auto_estimated'
                  ? 'info'
                  : settings.nation_distribution_method === 'hybrid'
                    ? 'warning'
                    : 'secondary'
              }
            >
              {settings.nation_distribution_method === 'auto_estimated'
                ? 'Auto-Estimated'
                : settings.nation_distribution_method === 'hybrid'
                  ? 'Hybrid'
                  : 'Manual'}
            </Badge>

            {settings.nation_distribution_method === 'auto_estimated' &&
              autoEstimateConfidence != null && (
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {(autoEstimateConfidence * 100).toFixed(0)}% confidence
                </Badge>
              )}

            {settings.nation_distribution_method === 'auto_estimated' &&
              autoEstimateSampleSize != null && (
                <Badge variant="outline" className="gap-1">
                  <Info className="h-3 w-3" />
                  {autoEstimateSampleSize.toLocaleString()} samples
                </Badge>
              )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoEstimate}
              disabled={isEstimating}
              className="ml-auto"
            >
              {isEstimating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Estimating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Auto-Estimate
                </>
              )}
            </Button>
          </div>

          {/* Nation inputs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(NATION_LABELS) as Array<keyof NationDistribution>).map((nation) => (
              <div key={nation} className="space-y-2">
                <Label htmlFor={`nation-${nation}`}>{NATION_LABELS[nation]}</Label>
                <div className="relative">
                  <Input
                    id={`nation-${nation}`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="0"
                    value={settings.nation_distribution[nation] || ''}
                    onChange={(e) => updateNationDistribution(nation, e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Running total */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm font-medium text-muted-foreground">Total:</span>
            <span
              className={`text-sm font-bold ${
                nationTotalValid
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {nationTotal.toFixed(2)}%
            </span>
            {!nationTotalValid && nationTotal > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                Must equal 100%
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 5. DRS Configuration */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Recycle className="h-5 w-5" />
            DRS Configuration
          </CardTitle>
          <CardDescription>
            Deposit Return Scheme settings for eligible packaging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <Switch
              id="drs-exclusions"
              checked={settings.apply_drs_exclusions}
              onCheckedChange={(checked) => updateField('apply_drs_exclusions', checked)}
            />
            <div className="space-y-1">
              <Label htmlFor="drs-exclusions" className="cursor-pointer">
                Apply DRS exclusions
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, packaging that falls under a Deposit Return Scheme will be
                excluded from your EPR obligation calculations. Enable this if your products
                are sold in a nation where DRS is active and your packaging is in scope.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 6. Save button */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
