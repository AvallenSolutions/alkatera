'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  Droplets,
  Trash2,
  Zap,
  Sparkles,
  Leaf,
  TreePine,
  Wheat,
  ClipboardList,
  Package,
  ScrollText,
} from 'lucide-react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import {
  saveUtilityBill,
  saveWaterBill,
  saveWasteBill,
} from '@/lib/ingest/save-extracted'
import type { IngestResponse } from '@/app/api/ingest/auto/route'
import type { ExtractedBillData } from '@/app/api/utilities/import-from-pdf/route'

type Step = 'upload' | 'analysing' | 'review' | 'saving' | 'saved'

interface Facility {
  id: string
  name: string
}

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ACCEPT =
  '.pdf,.xlsx,.xls,image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

interface UniversalDropzoneProps {
  trigger: React.ReactNode
}

export function UniversalDropzone({ trigger }: UniversalDropzoneProps) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<IngestResponse | null>(null)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [billName, setBillName] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('upload')
    setDragOver(false)
    setResult(null)
    setBillName('')
    setPeriodStart('')
    setPeriodEnd('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  useEffect(() => {
    if (!open || !orgId) return
    let cancelled = false
    supabase
      .from('facilities')
      .select('id, name')
      .eq('organization_id', orgId)
      .order('name')
      .then(({ data }) => {
        if (cancelled) return
        const list = (data || []) as Facility[]
        setFacilities(list)
        if (list.length === 1) setSelectedFacilityId(list[0].id)
      })
    return () => {
      cancelled = true
    }
  }, [open, orgId])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const processFile = useCallback(
    async (file: File) => {
      if (!orgId) {
        toast.error('No organisation selected')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File must be under 20MB')
        return
      }

      setStep('analysing')
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('organizationId', orgId)

        const res = await fetch('/api/ingest/auto', {
          method: 'POST',
          body: form,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Upload failed')
        }
        const data = (await res.json()) as IngestResponse
        setResult(data)

        // Pre-fill the review form from extracted data, where available.
        const bill =
          data.type === 'utility_bill'
            ? data.utilityBill
            : data.type === 'water_bill'
              ? data.waterBill
              : data.type === 'waste_bill'
                ? data.wasteBill
                : null
        if (bill) {
          setPeriodStart(bill.period_start ?? '')
          setPeriodEnd(bill.period_end ?? '')
          const defaultName = bill.supplier_name
            ? `${bill.supplier_name} ${bill.period_start ?? ''} to ${bill.period_end ?? ''}`.trim()
            : file.name.replace(/\.[^.]+$/, '')
          setBillName(defaultName)
        }

        setStep('review')
      } catch (err: any) {
        toast.error(err.message || 'Upload failed')
        setStep('upload')
      }
    },
    [orgId],
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const needsFacility =
    result?.type === 'utility_bill' ||
    result?.type === 'water_bill' ||
    result?.type === 'waste_bill'

  const canSave = () => {
    if (!result) return false
    if (needsFacility && !selectedFacilityId) return false
    if (needsFacility && (!periodStart || !periodEnd)) return false
    return true
  }

  const handleSave = async () => {
    if (!result || !orgId) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      toast.error('Not authenticated')
      return
    }
    if (!needsFacility || !selectedFacilityId) return

    setStep('saving')
    try {
      const common = {
        facilityId: selectedFacilityId,
        organizationId: orgId,
        userId: userData.user.id,
        periodStart,
        periodEnd,
        billName,
      }
      if (result.type === 'utility_bill' && result.utilityBill) {
        await saveUtilityBill(
          { ...result.utilityBill, period_start: periodStart, period_end: periodEnd },
          common,
        )
      } else if (result.type === 'water_bill' && result.waterBill) {
        await saveWaterBill(
          { ...result.waterBill, period_start: periodStart, period_end: periodEnd },
          common,
        )
      } else if (result.type === 'waste_bill' && result.wasteBill) {
        await saveWasteBill(
          { ...result.wasteBill, period_start: periodStart, period_end: periodEnd },
          common,
        )
      }
      toast.success('Saved')
      setStep('saved')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
      setStep('review')
    }
  }

  const detectedFacilityName = () =>
    facilities.find((f) => f.id === selectedFacilityId)?.name || 'the selected facility'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#8da300] dark:text-[#ccff00]" />
            Upload anything
          </DialogTitle>
          <DialogDescription>
            Drop a utility bill, water bill, waste invoice, or a product workbook.
            We&apos;ll figure out what it is and file it in the right place.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`w-full flex flex-col items-center gap-3 p-8 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30'
              }`}
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-sm">Drop your file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, image, or Excel · up to 20MB
                </p>
              </div>
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Supports: utility / water / waste bills · product-ingredient-packaging workbooks
            </p>
          </div>
        )}

        {step === 'analysing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Analysing your document…</p>
            <p className="text-xs text-muted-foreground">
              Usually takes a few seconds
            </p>
          </div>
        )}

        {step === 'review' && result && (
          <ReviewPanel
            result={result}
            facilities={facilities}
            selectedFacilityId={selectedFacilityId}
            setSelectedFacilityId={setSelectedFacilityId}
            billName={billName}
            setBillName={setBillName}
            periodStart={periodStart}
            setPeriodStart={setPeriodStart}
            periodEnd={periodEnd}
            setPeriodEnd={setPeriodEnd}
            onSave={handleSave}
            canSave={canSave()}
            needsFacility={needsFacility}
            onClose={() => handleOpenChange(false)}
          />
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Saving…</p>
          </div>
        )}

        {step === 'saved' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium">
              Saved to <span className="font-semibold">{detectedFacilityName()}</span>
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => reset()}>
                Upload another
              </Button>
              <Button size="sm" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// Review panel — shown after classification + extraction completes.
// ───────────────────────────────────────────────────────────────────────────────

interface ReviewPanelProps {
  result: IngestResponse
  facilities: Facility[]
  selectedFacilityId: string
  setSelectedFacilityId: (id: string) => void
  billName: string
  setBillName: (s: string) => void
  periodStart: string
  setPeriodStart: (s: string) => void
  periodEnd: string
  setPeriodEnd: (s: string) => void
  onSave: () => void
  canSave: boolean
  needsFacility: boolean
  /** Closes the Universal Dropzone dialog. Essential for hand-off paths where
   *  we navigate to another page — if we don't close, the dialog stays mounted
   *  in the persistent AppLayout and covers the target page. */
  onClose: () => void
}

function ReviewPanel(props: ReviewPanelProps) {
  const { result } = props

  if (result.type === 'unsupported') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-400/30 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">We don&apos;t recognise this document yet.</p>
            {result.reason && (
              <p className="text-xs text-muted-foreground mt-1">{result.reason}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Were you trying to do one of these?</p>
        <div className="grid grid-cols-2 gap-2">
          <ManualLink href="/company/facilities" icon={<Zap className="h-3.5 w-3.5" />} label="Utility bill" onClose={props.onClose} />
          <ManualLink href="/company/facilities" icon={<Droplets className="h-3.5 w-3.5" />} label="Water bill" onClose={props.onClose} />
          <ManualLink href="/company/facilities" icon={<Trash2 className="h-3.5 w-3.5" />} label="Waste invoice" onClose={props.onClose} />
          <ManualLink href="/products" icon={<FileSpreadsheet className="h-3.5 w-3.5" />} label="Product workbook" onClose={props.onClose} />
          <ManualLink href="/vineyards" icon={<Leaf className="h-3.5 w-3.5" />} label="Spray diary" onClose={props.onClose} />
          <ManualLink href="/products" icon={<ScrollText className="h-3.5 w-3.5" />} label="Bill of materials" onClose={props.onClose} />
        </div>
      </div>
    )
  }

  if (result.type === 'spray_diary') {
    return (
      <AssetHandoffPanel
        kind="spray"
        detectedLabel="spray diary"
        icon={<ClipboardList className="h-4 w-4" />}
        description="Pick the asset type this diary is for — we'll carry the file across so you don't re-upload."
        extraNote={
          result.sprayDiary?.sheetNames?.length
            ? `Sheets: ${result.sprayDiary.sheetNames.join(', ')}`
            : undefined
        }
        stashId={result.sprayDiary?.stashId}
        onClose={props.onClose}
      />
    )
  }

  if (result.type === 'soil_carbon_evidence') {
    return (
      <AssetHandoffPanel
        kind="evidence"
        detectedLabel="soil-carbon evidence"
        icon={<ScrollText className="h-4 w-4" />}
        description="Pick the asset this evidence is for — we'll carry the file across so you don't re-upload."
        extraNote={result.soilCarbonEvidence?.note}
        stashId={result.soilCarbonEvidence?.stashId}
        onClose={props.onClose}
      />
    )
  }

  if (result.type === 'bom') {
    return (
      <BomHandoffPanel bom={result.bom} onClose={props.onClose} />
    )
  }

  if (result.type === 'historical_sustainability_report') {
    return (
      <HistoricalReportPanel result={result} onClose={props.onClose} />
    )
  }

  if (result.type === 'historical_lca_report') {
    return (
      <HistoricalLcaPanel result={result} onClose={props.onClose} />
    )
  }

  if (result.type === 'accounts_csv') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
          <FileSpreadsheet className="h-4 w-4 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">This looks like an accounting export.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Connect Xero (or run a sync if already connected) and we&apos;ll pull the same data, auto-classified to carbon categories.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button asChild size="sm">
            <Link href="/data/spend-data" onClick={props.onClose}>Open spend data</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (result.type === 'bulk_xlsx' && result.xlsx) {
    const { summary, errors } = result.xlsx
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-400/30 bg-emerald-500/5">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">We detected a product workbook.</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.products} products · {summary.ingredients} ingredients · {summary.packaging} packaging items
              {summary.errors > 0 ? ` · ${summary.errors} errors` : ''}
            </p>
          </div>
        </div>
        {errors.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
            {errors.slice(0, 3).map((e, i) => (
              <p key={i}>· {e}</p>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Continue in the bulk-import wizard to review and commit these rows.
        </p>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button asChild size="sm">
            <Link href="/products/import" onClick={props.onClose}>Open bulk import</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Utility / water / waste bill review
  const typeLabel =
    result.type === 'utility_bill'
      ? 'utility bill'
      : result.type === 'water_bill'
        ? 'water bill'
        : 'waste invoice'

  const Icon = result.type === 'utility_bill' ? Zap : result.type === 'water_bill' ? Droplets : Trash2
  const bill =
    result.type === 'utility_bill'
      ? result.utilityBill
      : result.type === 'water_bill'
        ? result.waterBill
        : result.wasteBill

  const entriesSummary = (() => {
    if (!bill?.entries?.length) return 'No entries extracted'
    const n = bill.entries.length
    return `${n} ${n === 1 ? 'entry' : 'entries'} extracted`
  })()

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <Icon className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">We detected a {typeLabel}.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {bill?.supplier_name ? `${bill.supplier_name} · ` : ''}
            {entriesSummary}
          </p>
        </div>
      </div>

      {props.needsFacility && (
        <div className="space-y-1.5">
          <Label htmlFor="dropzone-facility">Facility</Label>
          {props.facilities.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              You need to add a facility before saving bill data.{' '}
              <Link href="/company/facilities" className="underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            <Select
              value={props.selectedFacilityId}
              onValueChange={props.setSelectedFacilityId}
            >
              <SelectTrigger id="dropzone-facility">
                <SelectValue placeholder="Select facility" />
              </SelectTrigger>
              <SelectContent>
                {props.facilities.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="dropzone-start">Period start</Label>
          <Input
            id="dropzone-start"
            type="date"
            value={props.periodStart}
            onChange={(e) => props.setPeriodStart(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dropzone-end">Period end</Label>
          <Input
            id="dropzone-end"
            type="date"
            value={props.periodEnd}
            onChange={(e) => props.setPeriodEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dropzone-name">Bill name (optional)</Label>
        <Input
          id="dropzone-name"
          value={props.billName}
          onChange={(e) => props.setBillName(e.target.value)}
          placeholder="e.g. British Gas Q1 2026"
        />
      </div>

      {/* Enrichment chips — only for utility bills; water/waste don't extract these. */}
      {result.type === 'utility_bill' && result.utilityBill && (
        <UtilityBillEnrichmentSummary bill={result.utilityBill} />
      )}

      {bill?.entries && bill.entries.length > 0 && (
        <div className="rounded-md border border-border p-3 text-xs space-y-1 max-h-32 overflow-y-auto">
          {bill.entries.map((e, i) => {
            const qty = (e as any).quantity
            const unit = (e as any).unit
            const cat = (e as any).utility_type || (e as any).activity_category
            const rateBreakdown = (e as any).rate_breakdown as
              | Array<{ label: string; kwh: number }>
              | undefined
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{cat}</span>
                  <span className="font-mono">{qty} {unit}</span>
                </div>
                {rateBreakdown && rateBreakdown.length > 0 && (
                  <div className="pl-3 space-y-0.5">
                    {rateBreakdown.map((rb, j) => (
                      <div key={j} className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{rb.label}</span>
                        <span className="font-mono">{rb.kwh} kWh</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" onClick={props.onSave} disabled={!props.canSave}>
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          Save to facility
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// BOM handoff — pick a product, then deep-link to its recipe editor with the
// stashed file. RecipeEditorPanel picks up ?stash_kind=bom and opens the BOM
// import wizard automatically with the file pre-loaded.
// ───────────────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────────
// HistoricalReportPanel — review + save panel for prior sustainability reports.
// User can edit extracted fields before saving; headline metrics land in
// historical_imports.extracted_data as-is so schema evolves without migrations.
// ───────────────────────────────────────────────────────────────────────────────

function HistoricalReportPanel({ result, onClose }: { result: IngestResponse; onClose: () => void }) {
  const { currentOrganization } = useOrganization()
  const data = result.historicalSustainabilityReport || {}
  const [form, setForm] = useState({
    reporting_year: data.reporting_year ?? undefined,
    organization_name: data.organization_name ?? '',
    scope1_tco2e: data.scope1_tco2e ?? undefined,
    scope2_tco2e_market: data.scope2_tco2e_market ?? undefined,
    scope2_tco2e_location: data.scope2_tco2e_location ?? undefined,
    scope3_tco2e: data.scope3_tco2e ?? undefined,
    water_m3: data.water_m3 ?? undefined,
    waste_tonnes: data.waste_tonnes ?? undefined,
    waste_diversion_rate_pct: data.waste_diversion_rate_pct ?? undefined,
    headcount: data.headcount ?? undefined,
    revenue_gbp: data.revenue_gbp ?? undefined,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = (key: keyof typeof form, value: string) => {
    const num = value === '' ? undefined : Number(value)
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(num as number) ? num : value }))
  }

  const handleSave = async () => {
    if (!currentOrganization?.id) return
    setSaving(true)
    try {
      const res = await fetch('/api/ingest/historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'sustainability_report',
          organizationId: currentOrganization.id,
          reporting_year: form.reporting_year ?? null,
          source_document_name: data.organization_name
            ? `${data.organization_name} ${form.reporting_year ?? ''} report`.trim()
            : null,
          extracted_data: {
            ...form,
            certifications_held: data.certifications_held || [],
            targets: data.targets || [],
          },
          stash_id: data.stashId,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Save failed')
      }
      toast.success('Historical report saved')
      setSaved(true)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
        <p className="text-sm font-medium">Saved</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/reports/historical" onClick={onClose}>View historical imports</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <ScrollText className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">
            We detected a sustainability report
            {data.organization_name ? ` — ${data.organization_name}` : ''}
            {form.reporting_year ? ` (${form.reporting_year})` : ''}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Check the extracted headline metrics, edit anything that looks off, then save. This is stored as historical reference — it won&apos;t mix with your measured data.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricField label="Reporting year" value={form.reporting_year} onChange={(v) => update('reporting_year', v)} />
        <MetricField label="Scope 1 (tCO₂e)" value={form.scope1_tco2e} onChange={(v) => update('scope1_tco2e', v)} />
        <MetricField label="Scope 2 market (tCO₂e)" value={form.scope2_tco2e_market} onChange={(v) => update('scope2_tco2e_market', v)} />
        <MetricField label="Scope 2 location (tCO₂e)" value={form.scope2_tco2e_location} onChange={(v) => update('scope2_tco2e_location', v)} />
        <MetricField label="Scope 3 (tCO₂e)" value={form.scope3_tco2e} onChange={(v) => update('scope3_tco2e', v)} />
        <MetricField label="Water (m³)" value={form.water_m3} onChange={(v) => update('water_m3', v)} />
        <MetricField label="Waste (tonnes)" value={form.waste_tonnes} onChange={(v) => update('waste_tonnes', v)} />
        <MetricField label="Waste diversion %" value={form.waste_diversion_rate_pct} onChange={(v) => update('waste_diversion_rate_pct', v)} />
        <MetricField label="Headcount" value={form.headcount} onChange={(v) => update('headcount', v)} />
        <MetricField label="Revenue (GBP)" value={form.revenue_gbp} onChange={(v) => update('revenue_gbp', v)} />
      </div>

      {(data.certifications_held?.length || data.targets?.length) ? (
        <div className="text-xs text-muted-foreground space-y-1 p-2">
          {!!data.certifications_held?.length && (
            <p><span className="font-medium text-foreground">Certifications:</span> {data.certifications_held.join(', ')}</p>
          )}
          {!!data.targets?.length && (
            <p><span className="font-medium text-foreground">Targets:</span> {data.targets.map((t) => `${t.metric || '?'} ${t.percent_reduction ?? '?'}% by ${t.year ?? '?'}`).join('; ')}</p>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
          Save historical import
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// HistoricalLcaPanel — review + save panel for prior LCA studies.
// ───────────────────────────────────────────────────────────────────────────────

function HistoricalLcaPanel({ result, onClose }: { result: IngestResponse; onClose: () => void }) {
  const { currentOrganization } = useOrganization()
  const data = result.historicalLcaReport || {}
  const [form, setForm] = useState({
    product_name: data.product_name ?? '',
    functional_unit: data.functional_unit ?? '',
    reference_year: data.reference_year ?? undefined,
    system_boundary: data.system_boundary ?? '',
    total_gwp_kgco2e: data.total_gwp_kgco2e ?? undefined,
    water_footprint_l: data.water_footprint_l ?? undefined,
    methodology: data.methodology ?? '',
    study_commissioned_by: data.study_commissioned_by ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = <K extends keyof typeof form>(key: K, value: string) => {
    const numericKeys: (keyof typeof form)[] = ['reference_year', 'total_gwp_kgco2e', 'water_footprint_l']
    if (numericKeys.includes(key)) {
      const num = value === '' ? undefined : Number(value)
      setForm((prev) => ({ ...prev, [key]: Number.isFinite(num as number) ? (num as any) : value }))
    } else {
      setForm((prev) => ({ ...prev, [key]: value as any }))
    }
  }

  const handleSave = async () => {
    if (!currentOrganization?.id) return
    setSaving(true)
    try {
      const res = await fetch('/api/ingest/historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'lca_report',
          organizationId: currentOrganization.id,
          reporting_year: form.reference_year ?? null,
          source_document_name: form.product_name
            ? `${form.product_name} LCA ${form.reference_year ?? ''}`.trim()
            : null,
          extracted_data: {
            ...form,
            stage_breakdown: data.stage_breakdown || {},
          },
          stash_id: data.stashId,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Save failed')
      }
      toast.success('Historical LCA saved')
      setSaved(true)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
        <p className="text-sm font-medium">Saved</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/reports/historical" onClick={onClose}>View historical imports</Link>
        </Button>
      </div>
    )
  }

  const stages = data.stage_breakdown || {}

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <ScrollText className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">
            We detected a prior LCA{form.product_name ? ` — ${form.product_name}` : ''}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Stored as historical reference — not mixed with your operational LCAs.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lca-product" className="text-xs">Product</Label>
        <Input id="lca-product" value={form.product_name} onChange={(e) => update('product_name', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Functional unit</Label>
          <Input value={form.functional_unit} onChange={(e) => update('functional_unit', e.target.value)} placeholder="e.g. 1 × 750ml bottle" />
        </div>
        <MetricField label="Reference year" value={form.reference_year} onChange={(v) => update('reference_year', v)} />
        <div className="space-y-1.5">
          <Label className="text-xs">System boundary</Label>
          <Input value={form.system_boundary} onChange={(e) => update('system_boundary', e.target.value)} placeholder="cradle-to-gate / grave" />
        </div>
        <MetricField label="Total GWP (kgCO₂e)" value={form.total_gwp_kgco2e} onChange={(v) => update('total_gwp_kgco2e', v)} />
        <MetricField label="Water (L / FU)" value={form.water_footprint_l} onChange={(v) => update('water_footprint_l', v)} />
        <div className="space-y-1.5">
          <Label className="text-xs">Methodology</Label>
          <Input value={form.methodology} onChange={(e) => update('methodology', e.target.value)} placeholder="ISO 14067 / PEFCR Wine…" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Commissioned by</Label>
          <Input value={form.study_commissioned_by} onChange={(e) => update('study_commissioned_by', e.target.value)} />
        </div>
      </div>

      {(Object.keys(stages).length > 0) && (
        <div className="rounded-md border border-border p-3 text-xs space-y-1">
          <p className="font-medium text-foreground mb-1">Stage breakdown (kg CO₂e per FU)</p>
          {Object.entries(stages).map(([stage, value]) => (
            <div key={stage} className="flex justify-between">
              <span className="text-muted-foreground">{stage.replace('_', ' ')}</span>
              <span className="font-mono">{value ?? '—'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
          Save historical LCA
        </Button>
      </div>
    </div>
  )
}

// Compact numeric-field helper used across the historical review panels.
function MetricField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | string | undefined
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

type BomPayload = NonNullable<IngestResponse['bom']>

const PRODUCT_CATEGORY_OPTIONS: BomPayload['product_category'][] = [
  'Spirits',
  'Beer & Cider',
  'Wine',
  'Ready-to-Drink & Cocktails',
  'Non-Alcoholic',
]

// Loads products client-side (matches lib/products.ts's fetchProducts pattern).
// The earlier `fetch('/api/products')` was hitting a non-existent route — this
// path uses Supabase directly with RLS handling the org scope.
function useOrgProducts(orgId: string | undefined) {
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('products')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
      if (err) throw err
      setProducts((data || []) as Array<{ id: string; name: string }>)
    } catch (err: any) {
      setError(err?.message || "Couldn't load products.")
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { products, loading, error, refresh }
}

function BomHandoffPanel({ bom, onClose }: { bom?: BomPayload; onClose: () => void }) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const { products, loading, error } = useOrgProducts(orgId)
  const stashId = bom?.stashId

  // Default mode: if the BOM extractor returned a product name AND no existing
  // product already matches, lean the user toward "Create new". Otherwise
  // default to "Attach to existing".
  const extractedName = (bom?.product_name || '').trim()
  const probableExisting = useMemo(
    () => extractedName
      ? products.find((p) => p.name.toLowerCase().trim() === extractedName.toLowerCase())
      : undefined,
    [products, extractedName],
  )

  const [mode, setMode] = useState<'attach' | 'create'>('attach')
  const [productId, setProductId] = useState('')

  // Auto-select a sensible default: existing match if found, else the only
  // product if count === 1, else nothing. Re-runs when products load.
  useEffect(() => {
    if (!products.length) return
    if (probableExisting) {
      setProductId(probableExisting.id)
      setMode('attach')
    } else if (products.length === 1 && !extractedName) {
      setProductId(products[0].id)
    } else if (!productId && extractedName) {
      // New product — switch mode so the user sees the create form first.
      setMode('create')
    }
  }, [products, probableExisting, extractedName, productId])

  // If there are zero products at all, Create is the only option.
  useEffect(() => {
    if (!loading && products.length === 0) setMode('create')
  }, [loading, products.length])

  const attachDeepLink = productId
    ? (() => {
        const base = `/products/${productId}/recipe`
        if (!stashId) return base
        const params = new URLSearchParams({ stash_id: stashId, stash_kind: 'bom' })
        return `${base}?${params.toString()}`
      })()
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <ScrollText className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">We detected a bill of materials.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {bom?.note || 'Attach to an existing product, or create a new one from the details we pulled.'}
          </p>
        </div>
      </div>

      {/* Mode toggle — hidden if there are zero products (only Create makes sense). */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={mode === 'attach' ? 'default' : 'outline'}
            onClick={() => setMode('attach')}
          >
            Attach to existing
          </Button>
          <Button
            size="sm"
            variant={mode === 'create' ? 'default' : 'outline'}
            onClick={() => setMode('create')}
          >
            Create new product
          </Button>
        </div>
      )}

      {mode === 'attach' ? (
        <AttachToExistingPanel
          products={products}
          loading={loading}
          error={error}
          productId={productId}
          setProductId={setProductId}
          deepLink={attachDeepLink}
          stashId={stashId}
          onClose={onClose}
        />
      ) : (
        <CreateFromBomPanel bom={bom} orgId={orgId} stashId={stashId} onClose={onClose} />
      )}
    </div>
  )
}

function AttachToExistingPanel({
  products,
  loading,
  error,
  productId,
  setProductId,
  deepLink,
  stashId,
  onClose,
}: {
  products: Array<{ id: string; name: string }>
  loading: boolean
  error: string | null
  productId: string
  setProductId: (id: string) => void
  deepLink: string | null
  stashId?: string
  onClose: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="dropzone-bom-product" className="text-xs">Attach to product</Label>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading products…
          </div>
        ) : error ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
        ) : products.length === 0 ? (
          <p className="text-xs text-muted-foreground">No products yet — use Create new product instead.</p>
        ) : (
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger id="dropzone-bom-product">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Next step:</span>{' '}
          {stashId
            ? "Open the product — we'll carry the file across and parse it automatically."
            : 'Open the product, then use the BOM upload button inside the recipe editor.'}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button asChild size="sm" disabled={!deepLink}>
          {deepLink ? (
            <Link href={deepLink} onClick={onClose}>
              <Package className="h-3.5 w-3.5 mr-1.5" />
              Open product
            </Link>
          ) : (
            <span>Open product</span>
          )}
        </Button>
      </div>
    </div>
  )
}

function CreateFromBomPanel({
  bom,
  orgId,
  stashId,
  onClose,
}: {
  bom?: BomPayload
  orgId?: string
  stashId?: string
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(bom?.product_name || '')
  const [sku, setSku] = useState(bom?.product_sku || '')
  const [category, setCategory] = useState<string>(bom?.product_category || '')
  const [description, setDescription] = useState(bom?.product_description || '')
  const [unitSizeValue, setUnitSizeValue] = useState<string>(
    bom?.unit_size_value !== undefined ? String(bom.unit_size_value) : '',
  )
  const [unitSizeUnit, setUnitSizeUnit] = useState(bom?.unit_size_unit || '')
  const [creating, setCreating] = useState(false)

  const canCreate = Boolean(orgId && name.trim())

  const handleCreate = async () => {
    if (!orgId || !name.trim()) return
    setCreating(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) throw new Error('Not authenticated')

      const unitNumeric = unitSizeValue ? Number(unitSizeValue) : null
      const { data: created, error: createErr } = await supabase
        .from('products')
        .insert({
          organization_id: orgId,
          name: name.trim(),
          sku: sku.trim() || null,
          product_category: category || null,
          product_description: description.trim() || null,
          unit_size_value: Number.isFinite(unitNumeric as number) ? unitNumeric : null,
          unit_size_unit: unitSizeUnit.trim() || null,
          created_by: userData.user.id,
          is_draft: false,
        })
        .select('id')
        .single()
      if (createErr || !created) throw new Error(createErr?.message || 'Could not create product')

      toast.success(`Created ${name.trim()} — opening recipe editor…`)
      const params = stashId
        ? `?${new URLSearchParams({ stash_id: stashId, stash_kind: 'bom' }).toString()}`
        : ''
      // Close the Dropzone dialog BEFORE navigating — otherwise it stays
      // mounted on top of the recipe editor and blocks the BOM wizard from
      // auto-opening underneath.
      onClose()
      router.push(`/products/${created.id}/recipe${params}`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create product')
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        We pre-filled these from the BOM. Edit anything and we&apos;ll create the product, then open the recipe editor with your BOM already loaded.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="bom-product-name" className="text-xs">Product name *</Label>
          <Input id="bom-product-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bom-product-sku" className="text-xs">SKU</Label>
          <Input id="bom-product-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bom-product-category" className="text-xs">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="bom-product-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORY_OPTIONS.filter(Boolean).map((c) => (
                <SelectItem key={c as string} value={c as string}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="bom-product-description" className="text-xs">Description</Label>
          <Input
            id="bom-product-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bom-unit-size" className="text-xs">Unit size</Label>
          <Input
            id="bom-unit-size"
            type="number"
            inputMode="decimal"
            value={unitSizeValue}
            onChange={(e) => setUnitSizeValue(e.target.value)}
            placeholder="e.g. 750"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bom-unit-unit" className="text-xs">Unit</Label>
          <Input
            id="bom-unit-unit"
            value={unitSizeUnit}
            onChange={(e) => setUnitSizeUnit(e.target.value)}
            placeholder="ml, L, g…"
          />
        </div>
      </div>

      {bom?.supplier_name && (
        <p className="text-[11px] text-muted-foreground italic">
          Supplier in the BOM: {bom.supplier_name}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" onClick={handleCreate} disabled={!canCreate || creating}>
          {creating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Package className="h-3.5 w-3.5 mr-1.5" />}
          Create product &amp; attach BOM
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// UtilityBillEnrichmentSummary — surfaces the non-kWh data Claude pulled from
// the bill (MPAN, meter type, fuel mix, etc.) so users can sanity-check it
// before saving. All fields are optional; only chips with real values render.
// ───────────────────────────────────────────────────────────────────────────────

function UtilityBillEnrichmentSummary({ bill }: { bill: ExtractedBillData }) {
  // First electricity entry — we show MPAN / meter_type for it.
  const elec = bill.entries.find((e) => e.utility_type === 'electricity_grid')
  // Any gas entry — for MPRN.
  const gas = bill.entries.find(
    (e) => e.utility_type === 'natural_gas' || e.utility_type === 'natural_gas_m3',
  )

  const chips: Array<{ label: string; value: string; tone?: 'emerald' | 'amber' }> = []
  if (elec?.mpan) chips.push({ label: 'MPAN', value: elec.mpan })
  if (gas?.mprn) chips.push({ label: 'MPRN', value: gas.mprn })
  if (elec?.meter_type) {
    chips.push({
      label: 'Meter',
      value: elec.meter_type.replace(/_/g, ' '),
    })
  }
  if (bill.supply_postcode) chips.push({ label: 'Postcode', value: bill.supply_postcode })
  if (bill.gsp_group) chips.push({ label: 'Region', value: bill.gsp_group })
  if (bill.is_green_tariff) chips.push({ label: 'Tariff', value: '100% renewable', tone: 'emerald' })

  if (chips.length === 0 && !bill.fuel_mix) return null

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        Also extracted
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={`${c.label}-${c.value}`}
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                c.tone === 'emerald'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-background border border-border text-muted-foreground'
              }`}
            >
              <span className="opacity-60 mr-1">{c.label}</span>
              {c.value}
            </span>
          ))}
        </div>
      )}
      {bill.fuel_mix && (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Fuel mix</span>
          {bill.fuel_mix.source ? ` (${bill.fuel_mix.source})` : ''}
          {': '}
          {[
            { label: 'Renewable', pct: bill.fuel_mix.renewable_pct },
            { label: 'Gas', pct: bill.fuel_mix.gas_pct },
            { label: 'Nuclear', pct: bill.fuel_mix.nuclear_pct },
            { label: 'Coal', pct: bill.fuel_mix.coal_pct },
            { label: 'Other', pct: bill.fuel_mix.other_pct },
          ]
            .filter((x) => typeof x.pct === 'number')
            .map((x) => `${x.label} ${Math.round(x.pct as number)}%`)
            .join(' · ') || '—'}
        </div>
      )}
    </div>
  )
}

function ManualLink({
  href,
  icon,
  label,
  onClose,
}: {
  href: string
  icon: React.ReactNode
  label: string
  onClose?: () => void
}) {
  return (
    <Button asChild variant="outline" size="sm" className="justify-start gap-2 h-auto py-2">
      <Link href={href} onClick={onClose}>
        {icon}
        <span className="text-xs">{label}</span>
      </Link>
    </Button>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// AssetHandoffPanel — shared UX for spray diaries and soil-carbon evidence.
// These flows can't cleanly save from the dropzone (growing-profile resolution
// and multi-step commits live in the asset questionnaire pages). So we
// detect + pick the asset + deep-link. User re-uploads the file on that page,
// which is the existing fully-featured import UI.
// ───────────────────────────────────────────────────────────────────────────────

type AssetKind = 'vineyards' | 'orchards' | 'arable-fields'
interface AssetOption {
  id: string
  name: string
}

interface AssetHandoffPanelProps {
  kind: 'spray' | 'evidence'
  detectedLabel: string
  icon: React.ReactNode
  description: string
  extraNote?: string
  stashId?: string
  /** Closes the Universal Dropzone dialog. Must fire before navigation or the
   *  dialog stays mounted on top of the target asset page and blocks the
   *  carry-through wizards from auto-opening. */
  onClose: () => void
}

const ASSET_TYPES: { value: AssetKind; label: string; icon: React.ReactNode; apiPath: string; pageBase: string }[] = [
  { value: 'vineyards',     label: 'Vineyard',     icon: <Leaf className="h-3.5 w-3.5" />,     apiPath: '/api/vineyards',     pageBase: '/vineyards' },
  { value: 'orchards',      label: 'Orchard',      icon: <TreePine className="h-3.5 w-3.5" />, apiPath: '/api/orchards',      pageBase: '/orchards' },
  { value: 'arable-fields', label: 'Arable field', icon: <Wheat className="h-3.5 w-3.5" />,    apiPath: '/api/arable-fields', pageBase: '/arable-fields' },
]

function AssetHandoffPanel({ kind, detectedLabel, icon, description, extraNote, stashId, onClose }: AssetHandoffPanelProps) {
  const [assetKind, setAssetKind] = useState<AssetKind | null>(null)
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [assetId, setAssetId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!assetKind) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setAssets([])
    setAssetId('')
    const typeMeta = ASSET_TYPES.find((t) => t.value === assetKind)!
    fetch(typeMeta.apiPath)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then((body) => {
        if (cancelled) return
        const list: AssetOption[] = (body?.data || []).map((a: any) => ({ id: a.id, name: a.name }))
        setAssets(list)
        if (list.length === 1) setAssetId(list[0].id)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(`Couldn't load ${typeMeta.label.toLowerCase()}s. You may not have beta access for this asset type.`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [assetKind])

  const typeMeta = assetKind ? ASSET_TYPES.find((t) => t.value === assetKind)! : null
  const deepLink = typeMeta && assetId
    ? (() => {
        const base = `${typeMeta.pageBase}/${assetId}`
        if (!stashId) return base
        const params = new URLSearchParams({
          stash_id: stashId,
          stash_kind: kind,
        })
        return `${base}?${params.toString()}`
      })()
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <div className="mt-0.5">{icon}</div>
        <div className="text-sm">
          <p className="font-medium">We detected a {detectedLabel}.</p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          {extraNote && (
            <p className="text-xs text-muted-foreground mt-1 italic">{extraNote}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Which asset is this for?</Label>
        <div className="grid grid-cols-3 gap-2">
          {ASSET_TYPES.map((t) => (
            <Button
              key={t.value}
              variant={assetKind === t.value ? 'default' : 'outline'}
              size="sm"
              className="h-auto py-2 flex-col gap-1"
              onClick={() => setAssetKind(t.value)}
            >
              <div className="flex items-center gap-1.5">{t.icon}<span className="text-xs">{t.label}</span></div>
            </Button>
          ))}
        </div>
      </div>

      {assetKind && (
        <div className="space-y-1.5">
          <Label htmlFor="handoff-asset" className="text-xs">Select {typeMeta?.label.toLowerCase()}</Label>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : loadError ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">{loadError}</p>
          ) : assets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No {typeMeta?.label.toLowerCase()}s yet.{' '}
              <Link href={typeMeta!.pageBase} className="underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger id="handoff-asset">
                <SelectValue placeholder={`Select ${typeMeta?.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Next step:</span>{' '}
          {stashId
            ? kind === 'spray'
              ? 'Open the asset — we\'ll hand the file across and parse the chemicals automatically.'
              : 'Open the asset — we\'ll attach the file to the growing profile queue. Complete and Save to finalise.'
            : kind === 'spray'
              ? 'Open the asset page, scroll to Spray / Crop Protection, and drop the same file there to run the full import.'
              : 'Open the asset page, scroll to Soil Carbon Evidence, and attach the same file to your growing profile.'}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button asChild size="sm" disabled={!deepLink}>
          {deepLink ? (
            <Link href={deepLink} onClick={onClose}>
              Open {typeMeta?.label.toLowerCase()}
            </Link>
          ) : (
            <span>Open asset</span>
          )}
        </Button>
      </div>
    </div>
  )
}
