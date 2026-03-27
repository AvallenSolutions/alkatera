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
import { Checkbox } from '@/components/ui/checkbox'
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
  MapPin,
  Users,
  Tag,
  UserPlus,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useEPRHMRCDetails } from '@/hooks/data/useEPRHMRCDetails'
import {
  HMRC_ORG_TYPE_NAMES,
  HMRC_PACKAGING_ACTIVITY_LABELS,
  HMRC_ADDRESS_TYPE_NAMES,
  HMRC_CONTACT_TYPE_NAMES,
  HMRC_CONTACT_TYPE_DESCRIPTIONS,
  HMRC_BRAND_TYPE_NAMES,
  DRINKS_INDUSTRY_SIC_CODES,
} from '@/lib/epr/constants'
import { RPD_NATION_NAMES } from '@/lib/epr/constants'
import type { HMRCOrganisationType, HMRCAddressType, HMRCContactType, HMRCBrandTypeCode, HMRCPackagingActivityLevel } from '@/lib/epr/types'

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

// HMRC local form state types

type HMRCActivityKey = 'so' | 'pf' | 'im' | 'se' | 'hl' | 'om' | 'sl'

interface HMRCOrgFormState {
  companies_house_number: string
  organisation_type_code: HMRCOrganisationType | ''
  main_activity_sic: string
  home_nation_code: string
  activities: Record<HMRCActivityKey, HMRCPackagingActivityLevel>
}

interface HMRCAddressFormState {
  line_1: string
  line_2: string
  city: string
  county: string
  postcode: string
  country: string
  phone: string
}

interface HMRCContactFormState {
  first_name: string
  last_name: string
  phone: string
  email: string
  job_title: string
}

interface HMRCBrandFormState {
  brand_name: string
  brand_type_code: HMRCBrandTypeCode
}

interface HMRCPartnerFormState {
  first_name: string
  last_name: string
  phone: string
  email: string
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

const ACTIVITY_LEVEL_OPTIONS: HMRCPackagingActivityLevel[] = ['Primary', 'Secondary', 'No']

const ALL_ADDRESS_TYPES: HMRCAddressType[] = ['registered', 'audit', 'service_of_notice', 'principal']
const ALL_CONTACT_TYPES: HMRCContactType[] = ['approved_person', 'delegated_person', 'primary_contact', 'secondary_contact']

const EMPTY_ADDRESS: HMRCAddressFormState = { line_1: '', line_2: '', city: '', county: '', postcode: '', country: 'United Kingdom', phone: '' }
const EMPTY_CONTACT: HMRCContactFormState = { first_name: '', last_name: '', phone: '', email: '', job_title: '' }

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

  // HMRC hook
  const hmrc = useEPRHMRCDetails()

  // HMRC local form state
  const [hmrcOrg, setHmrcOrg] = useState<HMRCOrgFormState>({
    companies_house_number: '',
    organisation_type_code: '',
    main_activity_sic: '',
    home_nation_code: '',
    activities: { so: 'No', pf: 'No', im: 'No', se: 'No', hl: 'No', om: 'No', sl: 'No' },
  })
  const [hmrcAddresses, setHmrcAddresses] = useState<Record<HMRCAddressType, HMRCAddressFormState>>({
    registered: { ...EMPTY_ADDRESS },
    audit: { ...EMPTY_ADDRESS },
    service_of_notice: { ...EMPTY_ADDRESS },
    principal: { ...EMPTY_ADDRESS },
  })
  const [hmrcSameAsRegistered, setHmrcSameAsRegistered] = useState<Record<Exclude<HMRCAddressType, 'registered'>, boolean>>({
    audit: false,
    service_of_notice: false,
    principal: false,
  })
  const [hmrcContacts, setHmrcContacts] = useState<Record<HMRCContactType, HMRCContactFormState>>({
    approved_person: { ...EMPTY_CONTACT },
    delegated_person: { ...EMPTY_CONTACT },
    primary_contact: { ...EMPTY_CONTACT },
    secondary_contact: { ...EMPTY_CONTACT },
  })
  const [hmrcBrands, setHmrcBrands] = useState<HMRCBrandFormState[]>([])
  const [hmrcPartners, setHmrcPartners] = useState<HMRCPartnerFormState[]>([])

  // HMRC saving states
  const [isSavingOrgDetails, setIsSavingOrgDetails] = useState(false)
  const [isSavingAddresses, setIsSavingAddresses] = useState(false)
  const [isSavingContacts, setIsSavingContacts] = useState(false)
  const [isSavingBrands, setIsSavingBrands] = useState(false)
  const [isSavingPartners, setIsSavingPartners] = useState(false)

  // Collapsible sections
  const [expandedAddresses, setExpandedAddresses] = useState<Record<HMRCAddressType, boolean>>({
    registered: true,
    audit: false,
    service_of_notice: false,
    principal: false,
  })
  const [expandedContacts, setExpandedContacts] = useState<Record<HMRCContactType, boolean>>({
    approved_person: true,
    delegated_person: false,
    primary_contact: false,
    secondary_contact: false,
  })

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

  // Sync HMRC hook data into local form state
  useEffect(() => {
    if (hmrc.loading) return

    const d = hmrc.data.orgDetails
    if (d) {
      setHmrcOrg({
        companies_house_number: d.companies_house_number ?? '',
        organisation_type_code: d.organisation_type_code ?? '',
        main_activity_sic: d.main_activity_sic ?? '',
        home_nation_code: d.home_nation_code ?? '',
        activities: {
          so: d.activity_so ?? 'No',
          pf: d.activity_pf ?? 'No',
          im: d.activity_im ?? 'No',
          se: d.activity_se ?? 'No',
          hl: d.activity_hl ?? 'No',
          om: d.activity_om ?? 'No',
          sl: d.activity_sl ?? 'No',
        },
      })
    }

    // Map addresses
    const addrMap: Record<HMRCAddressType, HMRCAddressFormState> = {
      registered: { ...EMPTY_ADDRESS },
      audit: { ...EMPTY_ADDRESS },
      service_of_notice: { ...EMPTY_ADDRESS },
      principal: { ...EMPTY_ADDRESS },
    }
    for (const addr of hmrc.data.addresses) {
      addrMap[addr.address_type] = {
        line_1: addr.line_1 ?? '',
        line_2: addr.line_2 ?? '',
        city: addr.city ?? '',
        county: addr.county ?? '',
        postcode: addr.postcode ?? '',
        country: addr.country ?? 'United Kingdom',
        phone: addr.phone ?? '',
      }
    }
    setHmrcAddresses(addrMap)

    // Map contacts
    const contactMap: Record<HMRCContactType, HMRCContactFormState> = {
      approved_person: { ...EMPTY_CONTACT },
      delegated_person: { ...EMPTY_CONTACT },
      primary_contact: { ...EMPTY_CONTACT },
      secondary_contact: { ...EMPTY_CONTACT },
    }
    for (const c of hmrc.data.contacts) {
      contactMap[c.contact_type] = {
        first_name: c.first_name ?? '',
        last_name: c.last_name ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        job_title: c.job_title ?? '',
      }
    }
    setHmrcContacts(contactMap)

    // Brands
    setHmrcBrands(
      hmrc.data.brands.map((b) => ({
        brand_name: b.brand_name,
        brand_type_code: b.brand_type_code,
      }))
    )

    // Partners
    setHmrcPartners(
      hmrc.data.partners.map((p) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        phone: p.phone ?? '',
        email: p.email ?? '',
      }))
    )
  }, [hmrc.loading, hmrc.data])

  // -------------------------------------------------------------------
  // Handlers (existing EPR settings)
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
  // HMRC handlers
  // -------------------------------------------------------------------

  async function handleSaveOrgDetails() {
    setIsSavingOrgDetails(true)
    try {
      await hmrc.saveOrgDetails({
        companies_house_number: hmrcOrg.companies_house_number || null,
        organisation_type_code: (hmrcOrg.organisation_type_code as HMRCOrganisationType) || undefined,
        main_activity_sic: hmrcOrg.main_activity_sic || null,
        home_nation_code: (hmrcOrg.home_nation_code as any) || null,
        activity_so: hmrcOrg.activities.so,
        activity_pf: hmrcOrg.activities.pf,
        activity_im: hmrcOrg.activities.im,
        activity_se: hmrcOrg.activities.se,
        activity_hl: hmrcOrg.activities.hl,
        activity_om: hmrcOrg.activities.om,
        activity_sl: hmrcOrg.activities.sl,
      })
    } catch {
      // Toast already shown by hook
    } finally {
      setIsSavingOrgDetails(false)
    }
  }

  async function handleSaveAddresses() {
    setIsSavingAddresses(true)
    try {
      const addressPayload = ALL_ADDRESS_TYPES.map((type) => {
        const isCopied = type !== 'registered' && hmrcSameAsRegistered[type as Exclude<HMRCAddressType, 'registered'>]
        const source = isCopied ? hmrcAddresses.registered : hmrcAddresses[type]
        return {
          address_type: type,
          line_1: source.line_1,
          line_2: source.line_2 || null,
          city: source.city,
          county: source.county || null,
          postcode: source.postcode,
          country: source.country,
          phone: source.phone || null,
        }
      })
      await hmrc.saveAddresses(addressPayload)
    } catch {
      // Toast already shown by hook
    } finally {
      setIsSavingAddresses(false)
    }
  }

  async function handleSaveContacts() {
    setIsSavingContacts(true)
    try {
      const contactPayload = ALL_CONTACT_TYPES.map((type) => ({
        contact_type: type,
        first_name: hmrcContacts[type].first_name,
        last_name: hmrcContacts[type].last_name,
        phone: hmrcContacts[type].phone || null,
        email: hmrcContacts[type].email || null,
        job_title: hmrcContacts[type].job_title || null,
      }))
      await hmrc.saveContacts(contactPayload)
    } catch {
      // Toast already shown by hook
    } finally {
      setIsSavingContacts(false)
    }
  }

  async function handleSaveBrands() {
    setIsSavingBrands(true)
    try {
      await hmrc.saveBrands(
        hmrcBrands
          .filter((b) => b.brand_name.trim())
          .map((b) => ({ brand_name: b.brand_name.trim(), brand_type_code: b.brand_type_code }))
      )
    } catch {
      // Toast already shown by hook
    } finally {
      setIsSavingBrands(false)
    }
  }

  async function handleSavePartners() {
    setIsSavingPartners(true)
    try {
      await hmrc.savePartners(
        hmrcPartners
          .filter((p) => p.first_name.trim() || p.last_name.trim())
          .map((p) => ({
            first_name: p.first_name.trim(),
            last_name: p.last_name.trim(),
            phone: p.phone || null,
            email: p.email || null,
          }))
      )
    } catch {
      // Toast already shown by hook
    } finally {
      setIsSavingPartners(false)
    }
  }

  function updateHmrcAddress(type: HMRCAddressType, field: keyof HMRCAddressFormState, value: string) {
    setHmrcAddresses((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
  }

  function updateHmrcContact(type: HMRCContactType, field: keyof HMRCContactFormState, value: string) {
    setHmrcContacts((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
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
      {/* 6. Save button (existing EPR settings) */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center justify-end gap-3">
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

      {/* ================================================================ */}
      {/* HMRC Registration Data */}
      {/* ================================================================ */}
      <div className="space-y-1 pt-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          HMRC Registration Data
        </h2>
        <p className="text-sm text-muted-foreground">
          Additional details required for HMRC EPR registration templates. Each section saves independently.
        </p>
      </div>

      {hmrc.loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
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
      ) : (
        <>
          {/* ---------------------------------------------------------------- */}
          {/* HMRC 1. Company Details */}
          {/* ---------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                HMRC Company Details
              </CardTitle>
              <CardDescription>
                Companies House registration and organisation classification for HMRC
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hmrc-ch-number">Companies House Number</Label>
                  <Input
                    id="hmrc-ch-number"
                    placeholder="e.g. 12345678"
                    value={hmrcOrg.companies_house_number}
                    onChange={(e) =>
                      setHmrcOrg((prev) => ({ ...prev, companies_house_number: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hmrc-org-type">Organisation Type</Label>
                  <Select
                    value={hmrcOrg.organisation_type_code}
                    onValueChange={(val) =>
                      setHmrcOrg((prev) => ({ ...prev, organisation_type_code: val as HMRCOrganisationType }))
                    }
                  >
                    <SelectTrigger id="hmrc-org-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(HMRC_ORG_TYPE_NAMES) as [HMRCOrganisationType, string][]).map(
                        ([code, name]) => (
                          <SelectItem key={code} value={code}>
                            {name}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hmrc-sic">SIC Code</Label>
                  <Select
                    value={hmrcOrg.main_activity_sic}
                    onValueChange={(val) =>
                      setHmrcOrg((prev) => ({ ...prev, main_activity_sic: val }))
                    }
                  >
                    <SelectTrigger id="hmrc-sic">
                      <SelectValue placeholder="Select SIC code" />
                    </SelectTrigger>
                    <SelectContent>
                      {DRINKS_INDUSTRY_SIC_CODES.map((sic) => (
                        <SelectItem key={sic.code} value={sic.code}>
                          {sic.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hmrc-home-nation">Home Nation</Label>
                  <Select
                    value={hmrcOrg.home_nation_code}
                    onValueChange={(val) =>
                      setHmrcOrg((prev) => ({ ...prev, home_nation_code: val }))
                    }
                  >
                    <SelectTrigger id="hmrc-home-nation">
                      <SelectValue placeholder="Select nation" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(RPD_NATION_NAMES) as [string, string][]).map(
                        ([code, name]) => (
                          <SelectItem key={code} value={code}>
                            {name}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Packaging Activities */}
              <div className="space-y-3 pt-2">
                <Label className="text-base font-medium">Packaging Activities</Label>
                <p className="text-sm text-muted-foreground">
                  For each activity, indicate whether it is your primary activity, a secondary activity, or not applicable.
                </p>
                <div className="space-y-2">
                  {(Object.keys(HMRC_PACKAGING_ACTIVITY_LABELS) as HMRCActivityKey[]).map((key) => {
                    const activity = HMRC_PACKAGING_ACTIVITY_LABELS[key]
                    return (
                      <div
                        key={key}
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{activity.label}</p>
                          <p className="text-xs text-muted-foreground">{activity.description}</p>
                        </div>
                        <div className="flex gap-2">
                          {ACTIVITY_LEVEL_OPTIONS.map((level) => (
                            <Button
                              key={level}
                              type="button"
                              size="sm"
                              variant={hmrcOrg.activities[key] === level ? 'default' : 'outline'}
                              onClick={() =>
                                setHmrcOrg((prev) => ({
                                  ...prev,
                                  activities: { ...prev.activities, [key]: level },
                                }))
                              }
                            >
                              {level}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveOrgDetails} disabled={isSavingOrgDetails}>
                  {isSavingOrgDetails ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Company Details
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* HMRC 2. Addresses */}
          {/* ---------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                HMRC Addresses
              </CardTitle>
              <CardDescription>
                Up to four addresses required for HMRC registration. Non-registered addresses can copy from the registered address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ALL_ADDRESS_TYPES.map((type) => {
                const isExpanded = expandedAddresses[type]
                const isCopied =
                  type !== 'registered' && hmrcSameAsRegistered[type as Exclude<HMRCAddressType, 'registered'>]

                return (
                  <div key={type} className="rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                      onClick={() =>
                        setExpandedAddresses((prev) => ({ ...prev, [type]: !prev[type] }))
                      }
                    >
                      <span className="text-sm font-medium">{HMRC_ADDRESS_TYPE_NAMES[type]}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="space-y-4 border-t px-4 py-4">
                        {type !== 'registered' && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`same-as-registered-${type}`}
                              checked={isCopied}
                              onCheckedChange={(checked) =>
                                setHmrcSameAsRegistered((prev) => ({
                                  ...prev,
                                  [type]: !!checked,
                                }))
                              }
                            />
                            <Label htmlFor={`same-as-registered-${type}`} className="cursor-pointer text-sm">
                              Same as registered address
                            </Label>
                          </div>
                        )}

                        {isCopied ? (
                          <p className="text-sm text-muted-foreground italic">
                            This address will be copied from the registered address when saved.
                          </p>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Address Line 1</Label>
                              <Input
                                placeholder="Street address"
                                value={hmrcAddresses[type].line_1}
                                onChange={(e) => updateHmrcAddress(type, 'line_1', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>
                                Address Line 2
                                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                              </Label>
                              <Input
                                placeholder="Building, floor, etc."
                                value={hmrcAddresses[type].line_2}
                                onChange={(e) => updateHmrcAddress(type, 'line_2', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>City</Label>
                              <Input
                                placeholder="City or town"
                                value={hmrcAddresses[type].city}
                                onChange={(e) => updateHmrcAddress(type, 'city', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>
                                County
                                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                              </Label>
                              <Input
                                placeholder="County"
                                value={hmrcAddresses[type].county}
                                onChange={(e) => updateHmrcAddress(type, 'county', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Postcode</Label>
                              <Input
                                placeholder="e.g. SW1A 1AA"
                                value={hmrcAddresses[type].postcode}
                                onChange={(e) => updateHmrcAddress(type, 'postcode', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Country</Label>
                              <Input
                                placeholder="Country"
                                value={hmrcAddresses[type].country}
                                onChange={(e) => updateHmrcAddress(type, 'country', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>
                                Phone Number
                                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                              </Label>
                              <Input
                                placeholder="e.g. +44 20 7946 0958"
                                value={hmrcAddresses[type].phone}
                                onChange={(e) => updateHmrcAddress(type, 'phone', e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveAddresses} disabled={isSavingAddresses}>
                  {isSavingAddresses ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Addresses
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* HMRC 3. Contacts */}
          {/* ---------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                HMRC Contacts
              </CardTitle>
              <CardDescription>
                Named contacts for your HMRC EPR registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ALL_CONTACT_TYPES.map((type) => {
                const isExpanded = expandedContacts[type]

                return (
                  <div key={type} className="rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                      onClick={() =>
                        setExpandedContacts((prev) => ({ ...prev, [type]: !prev[type] }))
                      }
                    >
                      <div>
                        <span className="text-sm font-medium">{HMRC_CONTACT_TYPE_NAMES[type]}</span>
                        <p className="text-xs text-muted-foreground">
                          {HMRC_CONTACT_TYPE_DESCRIPTIONS[type]}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="grid gap-4 border-t px-4 py-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          <Input
                            placeholder="First name"
                            value={hmrcContacts[type].first_name}
                            onChange={(e) => updateHmrcContact(type, 'first_name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          <Input
                            placeholder="Last name"
                            value={hmrcContacts[type].last_name}
                            onChange={(e) => updateHmrcContact(type, 'last_name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>
                            Phone
                            <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                          </Label>
                          <Input
                            placeholder="e.g. +44 20 7946 0958"
                            value={hmrcContacts[type].phone}
                            onChange={(e) => updateHmrcContact(type, 'phone', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>
                            Email
                            <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                          </Label>
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            value={hmrcContacts[type].email}
                            onChange={(e) => updateHmrcContact(type, 'email', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>
                            Job Title
                            <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                          </Label>
                          <Input
                            placeholder="e.g. Compliance Manager"
                            value={hmrcContacts[type].job_title}
                            onChange={(e) => updateHmrcContact(type, 'job_title', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveContacts} disabled={isSavingContacts}>
                  {isSavingContacts ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Contacts
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* HMRC 4. Brands */}
          {/* ---------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                HMRC Brands
              </CardTitle>
              <CardDescription>
                Brand names associated with your packaged products for HMRC Template 2
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hmrcBrands.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No brands added yet. Click the button below to add your first brand.
                </p>
              )}

              {hmrcBrands.map((brand, index) => (
                <div key={index} className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label>Brand Name</Label>
                    <Input
                      placeholder="e.g. My Drinks Brand"
                      value={brand.brand_name}
                      onChange={(e) => {
                        const updated = [...hmrcBrands]
                        updated[index] = { ...updated[index], brand_name: e.target.value }
                        setHmrcBrands(updated)
                      }}
                    />
                  </div>
                  <div className="w-48 space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={brand.brand_type_code}
                      onValueChange={(val) => {
                        const updated = [...hmrcBrands]
                        updated[index] = { ...updated[index], brand_type_code: val as HMRCBrandTypeCode }
                        setHmrcBrands(updated)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(HMRC_BRAND_TYPE_NAMES) as [HMRCBrandTypeCode, string][]).map(
                          ([code, name]) => (
                            <SelectItem key={code} value={code}>
                              {name}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-red-500 hover:text-red-700"
                    onClick={() => {
                      setHmrcBrands((prev) => prev.filter((_, i) => i !== index))
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setHmrcBrands((prev) => [...prev, { brand_name: '', brand_type_code: 'BN' }])
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Brand
              </Button>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveBrands} disabled={isSavingBrands}>
                  {isSavingBrands ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Brands
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* HMRC 5. Partners (only for PAR org type) */}
          {/* ---------------------------------------------------------------- */}
          {hmrcOrg.organisation_type_code === 'PAR' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  HMRC Partners
                </CardTitle>
                <CardDescription>
                  Partner details for HMRC Template 3. Only required for partnership organisations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hmrcPartners.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No partners added yet. Click the button below to add a partner.
                  </p>
                )}

                {hmrcPartners.map((partner, index) => (
                  <div key={index} className="flex items-end gap-3">
                    <div className="flex-1 space-y-2">
                      <Label>First Name</Label>
                      <Input
                        placeholder="First name"
                        value={partner.first_name}
                        onChange={(e) => {
                          const updated = [...hmrcPartners]
                          updated[index] = { ...updated[index], first_name: e.target.value }
                          setHmrcPartners(updated)
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Last Name</Label>
                      <Input
                        placeholder="Last name"
                        value={partner.last_name}
                        onChange={(e) => {
                          const updated = [...hmrcPartners]
                          updated[index] = { ...updated[index], last_name: e.target.value }
                          setHmrcPartners(updated)
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>
                        Phone
                        <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        placeholder="Phone number"
                        value={partner.phone}
                        onChange={(e) => {
                          const updated = [...hmrcPartners]
                          updated[index] = { ...updated[index], phone: e.target.value }
                          setHmrcPartners(updated)
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>
                        Email
                        <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        type="email"
                        placeholder="Email"
                        value={partner.email}
                        onChange={(e) => {
                          const updated = [...hmrcPartners]
                          updated[index] = { ...updated[index], email: e.target.value }
                          setHmrcPartners(updated)
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-red-500 hover:text-red-700"
                      onClick={() => {
                        setHmrcPartners((prev) => prev.filter((_, i) => i !== index))
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHmrcPartners((prev) => [
                      ...prev,
                      { first_name: '', last_name: '', phone: '', email: '' },
                    ])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Partner
                </Button>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSavePartners} disabled={isSavingPartners}>
                    {isSavingPartners ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Partners
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Bottom spacer */}
      <div className="pb-8" />
    </div>
  )
}
