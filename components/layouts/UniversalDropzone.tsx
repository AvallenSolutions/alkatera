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
  BookOpen,
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
  /** Click target that opens the dialog. Optional when driven by `file`. */
  trigger?: React.ReactNode
  /** Externally-supplied file to classify (e.g. fed from the Rosa drawer).
   *  When set, the dialog opens and processes it automatically, so every
   *  upload surface shares one classifier and one review UI. */
  file?: File | null
  /** Fired once the supplied `file` has been picked up, so the parent can
   *  clear its own state and avoid re-processing the same file. */
  onFileConsumed?: () => void
}

export function UniversalDropzone({ trigger, file, onFileConsumed }: UniversalDropzoneProps) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<IngestResponse | null>(null)
  // Ingest job behind the current result — lets the review panels report what
  // the user actually saved back to /api/ingest/feedback (the learning loop).
  const [jobId, setJobId] = useState<string | null>(null)
  const [phaseMessage, setPhaseMessage] = useState<string>('')
  // Bulk upload: when a user drops more than one file, we process them serially
  // through the existing review flow. `queue` is the remaining files after
  // the one currently being reviewed; `queueTotal` is the original batch size.
  const [queue, setQueue] = useState<File[]>([])
  const [queueTotal, setQueueTotal] = useState(0)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [billName, setBillName] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [selectedFuel, setSelectedFuel] = useState<'electricity' | 'gas'>('electricity')
  const [smConflict, setSmConflict] = useState<{ span: { from: string; to: string } } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollAbortRef = useRef<{ cancelled: boolean } | null>(null)
  const externalFileRef = useRef<File | null>(null)

  const reset = useCallback(() => {
    if (pollAbortRef.current) pollAbortRef.current.cancelled = true
    setStep('upload')
    setDragOver(false)
    setResult(null)
    setJobId(null)
    setPhaseMessage('')
    setBillName('')
    setPeriodStart('')
    setPeriodEnd('')
    setSelectedFuel('electricity')
    setSmConflict(null)
    setQueue([])
    setQueueTotal(0)
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
      setPhaseMessage('Uploading…')
      const abortFlag = { cancelled: false }
      pollAbortRef.current = abortFlag
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
        const { jobId } = (await res.json()) as { jobId: string }
        if (!jobId) throw new Error('No job ID returned')
        setJobId(jobId)

        // Poll until completed/failed. 3 min cap mirrors the import-from-url
        // flow — the background function can run 15 min, but if the classifier
        // hasn't returned in 3 something is wrong and the user shouldn't wait.
        const start = Date.now()
        const POLL_MS = 2000
        const TIMEOUT_MS = 3 * 60 * 1000
        let data: IngestResponse | null = null
        while (!abortFlag.cancelled) {
          if (Date.now() - start > TIMEOUT_MS) {
            throw new Error('This is taking longer than expected — please try again.')
          }
          await new Promise((r) => setTimeout(r, POLL_MS))
          if (abortFlag.cancelled) return
          const pollRes = await fetch(`/api/ingest/auto/${jobId}`)
          if (!pollRes.ok) continue
          const job = await pollRes.json()
          if (job.phaseMessage) setPhaseMessage(job.phaseMessage)
          if (job.status === 'failed') {
            throw new Error(job.error || 'Document analysis failed')
          }
          if (job.status === 'completed') {
            data = job.result as IngestResponse
            break
          }
        }
        if (abortFlag.cancelled || !data) return
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

  const startBatch = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      const [first, ...rest] = files
      setQueue(rest)
      setQueueTotal(files.length)
      processFile(first)
    },
    [processFile],
  )

  const advanceQueue = useCallback(() => {
    if (queue.length === 0) {
      setQueueTotal(0)
      return false
    }
    const [next, ...rest] = queue
    setQueue(rest)
    // Reset review-step state but keep queueTotal so the "X of N" indicator
    // stays accurate across the batch.
    setResult(null)
    setJobId(null)
    setPhaseMessage('')
    setBillName('')
    setPeriodStart('')
    setPeriodEnd('')
    processFile(next)
    return true
  }, [queue, processFile])

  // Externally-fed file (e.g. from the Rosa drawer): open the dialog and run
  // it through the same classify → review flow as a manual drop. Guarded by a
  // ref so the same File object is never processed twice.
  useEffect(() => {
    if (!file || externalFileRef.current === file) return
    externalFileRef.current = file
    setOpen(true)
    startBatch([file])
    onFileConsumed?.()
  }, [file, startBatch, onFileConsumed])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) startBatch(files)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) startBatch(files)
  }

  const needsFacility =
    result?.type === 'utility_bill' ||
    result?.type === 'water_bill' ||
    result?.type === 'waste_bill' ||
    result?.type === 'smart_meter_csv'

  const canSave = () => {
    if (!result) return false
    if (needsFacility && !selectedFacilityId) return false
    // Bills need a period; a smart-meter CSV brings its own dates.
    if (needsFacility && result.type !== 'smart_meter_csv' && (!periodStart || !periodEnd)) return false
    return true
  }

  // Fire-and-forget learning hook: report what the user actually saved so the
  // classifier gains experience of this org's documents. Must never block or
  // break the save UX — all failures are swallowed.
  const recordFeedback = useCallback(
    (savedPayload: Record<string, unknown>, context?: Record<string, unknown>) => {
      if (!jobId) return
      try {
        void fetch('/api/ingest/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({ jobId, savedPayload, context }),
        }).catch(() => {})
      } catch {
        // never surface
      }
    },
    [jobId],
  )

  const handleSave = async (resolution?: 'replace' | 'detail_only') => {
    if (!result || !orgId) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      toast.error('Not authenticated')
      return
    }
    if (!needsFacility || !selectedFacilityId) return

    // Half-hourly smart-meter CSV → the dedicated ingest (derives totals; warns on overlap).
    if (result.type === 'smart_meter_csv' && result.smartMeter?.stashId) {
      setStep('saving')
      try {
        const res = await fetch('/api/energy/smart-meter/ingest-stashed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stashId: result.smartMeter.stashId, facilityId: selectedFacilityId, fuel: selectedFuel, resolution }),
        })
        const body = await res.json().catch(() => ({}))
        if (res.status === 409 && body?.conflict) {
          setSmConflict(body)
          setStep('review')
          return
        }
        if (!res.ok) throw new Error(body?.error || 'Failed to import half-hourly data')
        setSmConflict(null)
        toast.success(
          `Imported ${Number(body.readingsWritten).toLocaleString('en-GB')} readings` +
            (body.replacedBills ? `, ${body.replacedBills} bill(s) replaced` : ''),
        )
        setStep('saved')
      } catch (err: any) {
        toast.error(err.message || 'Failed to import')
        setStep('review')
      }
      return
    }

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
      const savedBill =
        result.type === 'utility_bill'
          ? result.utilityBill
          : result.type === 'water_bill'
            ? result.waterBill
            : result.type === 'waste_bill'
              ? result.wasteBill
              : null
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
      if (savedBill) {
        recordFeedback(
          { ...savedBill, period_start: periodStart, period_end: periodEnd },
          {
            facility_id: selectedFacilityId,
            facility_name: facilities.find((f) => f.id === selectedFacilityId)?.name,
          },
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
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#8da300] dark:text-[#ccff00]" />
            Upload anything
          </DialogTitle>
          <DialogDescription>
            Drop one or more documents. We handle utility, water and waste bills, supplier
            invoices, soil lab reports, product workbooks, bills of materials, and prior
            sustainability and LCA reports, then file each one in the right place.
          </DialogDescription>
          {queueTotal > 1 && (
            <p className="text-xs text-muted-foreground pt-1">
              File {queueTotal - queue.length} of {queueTotal}
            </p>
          )}
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
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
                <p className="font-medium text-sm">Drop files here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, image, or Excel · up to 20MB each · multiple files supported
                </p>
              </div>
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Supports: utility / water / waste bills · supplier & freight invoices · refrigerant records · packaging specs · supplier CoAs · certifications · soil lab reports · product workbooks · BOMs · historical reports
            </p>
          </div>
        )}

        {step === 'analysing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">
              {phaseMessage || 'Analysing your document…'}
            </p>
            <p className="text-xs text-muted-foreground">
              Larger PDFs can take up to a minute
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
            selectedFuel={selectedFuel}
            setSelectedFuel={setSelectedFuel}
            smConflict={smConflict}
            clearConflict={() => setSmConflict(null)}
            onClose={() => handleOpenChange(false)}
            onSaved={recordFeedback}
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
            {queue.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {queue.length} {queue.length === 1 ? 'file' : 'files'} left in this batch
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => reset()}>
                    Stop batch
                  </Button>
                  <Button size="sm" onClick={() => advanceQueue()}>
                    Next file
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => reset()}>
                  Upload another
                </Button>
                <Button size="sm" onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              </div>
            )}
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
  onSave: (resolution?: 'replace' | 'detail_only') => void
  canSave: boolean
  needsFacility: boolean
  selectedFuel: 'electricity' | 'gas'
  setSelectedFuel: (f: 'electricity' | 'gas') => void
  smConflict: { span: { from: string; to: string } } | null
  clearConflict: () => void
  /** Closes the Universal Dropzone dialog. Essential for hand-off paths where
   *  we navigate to another page — if we don't close, the dialog stays mounted
   *  in the persistent AppLayout and covers the target page. */
  onClose: () => void
  /** Learning hook: called once after a successful save with what the user
   *  actually saved (plus bindings like facility/product the classifier
   *  can't see). Fire-and-forget — panels must not await or gate on it. */
  onSaved?: (savedPayload: Record<string, unknown>, context?: Record<string, unknown>) => void
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

  if (result.type === 'smart_meter_csv' && result.smartMeter) {
    const sm = result.smartMeter
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">Half-hourly smart-meter data detected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sm.readings.toLocaleString('en-GB')} readings · {sm.firstDate} → {sm.lastDate} ·{' '}
            {sm.totalKwh.toLocaleString('en-GB')} kWh · {sm.months} month{sm.months === 1 ? '' : 's'} ({sm.format})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            We&apos;ll derive your monthly totals from this — no separate bill needed for these months.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sm-facility">Facility</Label>
          {props.facilities.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add a facility first, then re-upload.</p>
          ) : (
            <Select value={props.selectedFacilityId} onValueChange={props.setSelectedFacilityId}>
              <SelectTrigger id="sm-facility">
                <SelectValue placeholder="Select facility" />
              </SelectTrigger>
              <SelectContent>
                {props.facilities.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Fuel</Label>
          <div className="inline-flex rounded-md border p-0.5 text-sm">
            {(['electricity', 'gas'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => props.setSelectedFuel(f)}
                className={`rounded px-3 py-1 capitalize ${props.selectedFuel === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {props.smConflict ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-800">You already have bill data for these months</p>
            <p className="mt-1 text-xs text-amber-800/90">
              This covers {props.smConflict.span.from} → {props.smConflict.span.to} and overlaps existing entries.
              Choose one so the same energy isn&apos;t counted twice:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => props.onSave('replace')}>Replace the bill</Button>
              <Button size="sm" variant="outline" onClick={() => props.onSave('detail_only')}>Keep bill (detail only)</Button>
              <Button size="sm" variant="ghost" onClick={props.clearConflict}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => props.onSave()} disabled={!props.canSave} className="w-full">
            Import half-hourly data
          </Button>
        )}
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

  if (result.type === 'supplier_invoice') {
    return (
      <SupplierInvoicePanel invoice={result.supplierInvoice} onClose={props.onClose} onSaved={props.onSaved} />
    )
  }

  if (result.type === 'freight_invoice') {
    return (
      <FreightInvoicePanel freight={result.freightInvoice} onClose={props.onClose} onSaved={props.onSaved} />
    )
  }

  if (result.type === 'refrigerant_service') {
    return (
      <RefrigerantPanel service={result.refrigerantService} onClose={props.onClose} onSaved={props.onSaved} />
    )
  }

  if (result.type === 'packaging_spec') {
    return (
      <PackagingSpecPanel spec={result.packagingSpec} onClose={props.onClose} onSaved={props.onSaved} />
    )
  }

  if (result.type === 'supplier_coa') {
    return (
      <SupplierCoaPanel coa={result.supplierCoa} onClose={props.onClose} onSaved={props.onSaved} />
    )
  }

  if (result.type === 'certification') {
    return (
      <CertificationPanel cert={result.certification} onClose={props.onClose} onSaved={props.onSaved} />
    )
  }

  if (result.type === 'soil_carbon_lab') {
    return (
      <SoilCarbonLabPanel lab={result.soilCarbonLab} onClose={props.onClose} onSaved={props.onSaved} />
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
      <HistoricalReportPanel result={result} onClose={props.onClose} onSaved={props.onSaved} />
    )
  }

  if (result.type === 'historical_lca_report') {
    return (
      <HistoricalLcaPanel result={result} onClose={props.onClose} onSaved={props.onSaved} />
    )
  }

  if (result.type === 'hospitality_menu') {
    const stashId = result.hospitalityMenu?.stashId
    const href = stashId
      ? `/hospitality/menus?${new URLSearchParams({ stash_id: stashId, stash_kind: 'hospitality_menu' }).toString()}`
      : '/hospitality/menus'
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
          <BookOpen className="h-4 w-4 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">This looks like a menu.</p>
            <p className="text-xs text-muted-foreground mt-1">
              We&apos;ll open the menu importer with this file so you can turn it into meals and drinks.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button asChild size="sm">
            <Link href={href} onClick={props.onClose}>Import menu</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (result.type === 'pos_sales_export') {
    const stashId = result.posSalesExport?.stashId
    const href = stashId
      ? `/hospitality/sales?${new URLSearchParams({ stash_id: stashId, stash_kind: 'pos_sales' }).toString()}`
      : '/hospitality/sales'
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
          <FileSpreadsheet className="h-4 w-4 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">This looks like a POS sales export.</p>
            <p className="text-xs text-muted-foreground mt-1">
              We&apos;ll open hospitality sales with this file so you can import how many of each item sold.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button asChild size="sm">
            <Link href={href} onClick={props.onClose}>Import sales</Link>
          </Button>
        </div>
      </div>
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
        <Button size="sm" onClick={() => props.onSave()} disabled={!props.canSave}>
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

function HistoricalReportPanel({ result, onClose, onSaved }: { result: IngestResponse; onClose: () => void; onSaved?: ReviewPanelProps['onSaved'] }) {
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
      onSaved?.({ ...form })
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

function HistoricalLcaPanel({ result, onClose, onSaved }: { result: IngestResponse; onClose: () => void; onSaved?: ReviewPanelProps['onSaved'] }) {
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
      onSaved?.({ ...form })
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

      {/* Ingredient / packaging preview — what we read from the document. The
          recipe editor parses the full detail when you open it. */}
      {bom?.line_items && bom.line_items.length > 0 && (
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
            {bom.line_items.length} component{bom.line_items.length === 1 ? '' : 's'} read
          </p>
          <ul className="space-y-0.5 text-xs">
            {bom.line_items.slice(0, 6).map((li, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">{li.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {li.quantity != null ? `${li.quantity} ${li.unit || ''}`.trim() : ''}
                  {li.type ? ` · ${li.type}` : ''}
                </span>
              </li>
            ))}
            {bom.line_items.length > 6 && (
              <li className="text-muted-foreground">+ {bom.line_items.length - 6} more</li>
            )}
          </ul>
        </div>
      )}

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

// ───────────────────────────────────────────────────────────────────────────────
// SupplierInvoicePanel — supplier-invoice / delivery-note path. The classifier
// parsed the priced line items; the user confirms them, picks a Scope 3 spend
// category + currency, and we save each line to /api/spend/invoice as a
// spend-based (Tier 4) corporate-overheads row the footprint reads.
// ───────────────────────────────────────────────────────────────────────────────

const SPEND_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'purchased_services', label: 'Goods & services' },
  { value: 'capital_goods', label: 'Equipment / capital goods' },
  { value: 'upstream_transportation', label: 'Inbound freight / transport' },
  { value: 'operational_waste', label: 'Waste services' },
  { value: 'other', label: 'Other' },
]
const INVOICE_CURRENCIES = ['GBP', 'USD', 'EUR']
const CURRENCY_SYMBOL: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }

interface InvoiceLineDraft {
  description: string
  amount: string
  quantity: string
  unit: string
}

function SupplierInvoicePanel({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: NonNullable<IngestResponse['supplierInvoice']> | undefined
  onClose: () => void
  onSaved?: ReviewPanelProps['onSaved']
}) {
  const [supplierName] = useState(invoice?.supplier_name || '')
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date || '')
  const [currency, setCurrency] = useState<string>(
    invoice?.currency && INVOICE_CURRENCIES.includes(invoice.currency) ? invoice.currency : 'GBP',
  )
  const [category, setCategory] = useState(
    invoice?.suggested_category &&
      SPEND_CATEGORY_OPTIONS.some((o) => o.value === invoice.suggested_category)
      ? invoice.suggested_category
      : 'purchased_services',
  )
  const [rows, setRows] = useState<InvoiceLineDraft[]>(() =>
    (invoice?.line_items || [])
      .filter((l) => l && l.amount != null)
      .map((l) => ({
        description: l.description || '',
        amount: String(l.amount),
        quantity: l.quantity != null ? String(l.quantity) : '',
        unit: l.unit || '',
      })),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ count: number; spend: number; co2e: number } | null>(null)

  const updateRow = (i: number, patch: Partial<InvoiceLineDraft>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))
  const addRow = () =>
    setRows((rs) => [...rs, { description: '', amount: '', quantity: '', unit: '' }])

  const validRows = rows.filter((r) => Number(r.amount) > 0)
  const total = validRows.reduce((s, r) => s + Number(r.amount), 0)
  const symbol = CURRENCY_SYMBOL[currency] || ''
  const canSave = validRows.length > 0 && !saving

  const save = async () => {
    if (validRows.length === 0) {
      toast.error('Add at least one line with an amount.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/spend/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: supplierName,
          invoice_date: invoiceDate || null,
          currency,
          category,
          line_items: validRows.map((r) => ({
            // Fold the activity quantity into the description so the detail
            // survives in the spend-based row.
            description:
              r.quantity && r.unit ? `${r.description} (${r.quantity} ${r.unit})`.trim() : r.description,
            amount: Number(r.amount),
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || 'Could not save the invoice.')
        return
      }
      setSaved({ count: json.saved ?? validRows.length, spend: json.total_spend ?? total, co2e: json.total_co2e_kg ?? 0 })
      toast.success(`Saved ${json.saved ?? validRows.length} spend line${(json.saved ?? validRows.length) === 1 ? '' : 's'}.`)
      // Learning hook: report the confirmed values with quantity/unit kept as
      // separate fields (unlike the POST, which folds them into description)
      // so the diff against the classifier payload is meaningful.
      onSaved?.({
        supplier_name: supplierName,
        invoice_date: invoiceDate || null,
        currency,
        category,
        line_items: validRows.map((r) => ({
          description: r.description,
          amount: Number(r.amount),
          ...(r.quantity ? { quantity: Number(r.quantity) } : {}),
          ...(r.unit ? { unit: r.unit } : {}),
        })),
      })
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    const tonnes = saved.co2e / 1000
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-400/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">
              Saved {saved.count} spend line{saved.count === 1 ? '' : 's'} to your Scope 3 footprint.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {symbol}{saved.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })} spend ·
              ~{tonnes < 1 ? `${Math.round(saved.co2e)} kg` : `${tonnes.toFixed(1)} t`} CO2e (spend-based estimate).
              Map these to supplier or activity data later for a tighter number.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href="/data/spend-data" onClick={onClose}>View spend data</Link>
          </Button>
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <FileText className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">We read a supplier invoice{supplierName ? ` from ${supplierName}` : ''}.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Confirm the lines and category. We&apos;ll add them to your Scope 3 spend as a
            spend-based estimate you can refine later.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Invoice date</Label>
          <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INVOICE_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SPEND_CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Line items</Label>
        {rows.map((r, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Description"
                  value={r.description}
                  onChange={(e) => updateRow(i, { description: e.target.value })}
                />
              </div>
              <div className="w-28">
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Amount (${symbol})`}
                  value={r.amount}
                  onChange={(e) => updateRow(i, { amount: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(i)}
                className="h-9 w-9 p-0 text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {r.quantity && r.unit && (
              <p className="pl-1 text-[11px] text-muted-foreground">
                Quantity read: {r.quantity} {r.unit} (kept with this line)
              </p>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          Add line
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Total spend</span>
        <span className="font-medium">
          {symbol}{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save to Scope 3
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// PackagingSpecPanel — packaging spec sheet → product_materials on a product.
// Needs a product, since packaging is product-scoped.
// ───────────────────────────────────────────────────────────────────────────────

const PACKAGING_ROLES: { value: string; label: string }[] = [
  { value: 'container', label: 'Container (bottle/can)' },
  { value: 'closure', label: 'Closure (cap/cork)' },
  { value: 'label', label: 'Label' },
  { value: 'secondary', label: 'Secondary (case)' },
  { value: 'shipment', label: 'Shipment' },
  { value: 'tertiary', label: 'Tertiary (pallet)' },
]

interface PackagingDraft {
  component_name: string
  material: string
  role: string
  weight_g: string
  recycled_content_pct: string
  recyclability_pct: string
}

function PackagingSpecPanel({
  spec,
  onClose,
  onSaved,
}: {
  spec: NonNullable<IngestResponse['packagingSpec']> | undefined
  onClose: () => void
  onSaved?: ReviewPanelProps['onSaved']
}) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const { products, loading } = useOrgProducts(orgId)
  const [productId, setProductId] = useState('')
  const [rows, setRows] = useState<PackagingDraft[]>(() =>
    (spec?.components || [])
      .filter((c) => c.component_name)
      .map((c) => ({
        component_name: c.component_name || '',
        material: c.material || '',
        role: c.role && PACKAGING_ROLES.some((r) => r.value === c.role) ? c.role : 'container',
        weight_g: c.weight_g != null ? String(c.weight_g) : '',
        recycled_content_pct: c.recycled_content_pct != null ? String(c.recycled_content_pct) : '',
        recyclability_pct: c.recyclability_pct != null ? String(c.recyclability_pct) : '',
      })),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ count: number } | null>(null)

  const updateRow = (i: number, patch: Partial<PackagingDraft>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const validRows = rows.filter((r) => r.component_name && Number(r.weight_g) > 0)
  const canSave = !!productId && validRows.length > 0 && !saving

  const save = async () => {
    if (!productId) { toast.error('Pick which product this packaging is for.'); return }
    if (validRows.length === 0) { toast.error('Each component needs a name and a weight.'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/products/${productId}/packaging`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          components: validRows.map((r) => ({
            component_name: r.component_name,
            material: r.material || null,
            role: r.role,
            weight_g: Number(r.weight_g),
            recycled_content_pct: r.recycled_content_pct ? Number(r.recycled_content_pct) : null,
            recyclability_pct: r.recyclability_pct ? Number(r.recyclability_pct) : null,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error || 'Could not save the packaging.'); return }
      setSaved({ count: json.saved ?? validRows.length })
      toast.success(`Saved ${json.saved ?? validRows.length} packaging component${(json.saved ?? validRows.length) === 1 ? '' : 's'}.`)
      onSaved?.(
        {
          components: validRows.map((r) => ({
            component_name: r.component_name,
            material: r.material || null,
            role: r.role,
            weight_g: Number(r.weight_g),
            recycled_content_pct: r.recycled_content_pct ? Number(r.recycled_content_pct) : null,
            recyclability_pct: r.recyclability_pct ? Number(r.recyclability_pct) : null,
          })),
        },
        {
          product_id: productId,
          product_name: products.find((p) => p.id === productId)?.name,
        },
      )
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    const product = products.find((p) => p.id === productId)
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-400/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">
              Saved {saved.count} component{saved.count === 1 ? '' : 's'} to {product?.name || 'the product'}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Recalculate the product LCA to fold the new packaging into its footprint.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          {product && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/products/${product.id}/recipe`} onClick={onClose}>Open recipe</Link>
            </Button>
          )}
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <Package className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">We read a packaging spec sheet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Confirm the components and pick which product they belong to. They&apos;ll be added to the
            product&apos;s packaging for its LCA.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Product</Label>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : products.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No products yet. <Link href="/products/new" className="underline">Add one</Link>.
          </p>
        ) : (
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-xs">Components</Label>
        {rows.map((r, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Input
                className="mr-2 h-8"
                placeholder="Component name"
                value={r.component_name}
                onChange={(e) => updateRow(i, { component_name: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(i)}
                className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Material</Label>
                <Input placeholder="glass, aluminium, pet…" value={r.material} onChange={(e) => updateRow(i, { material: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Role</Label>
                <Select value={r.role} onValueChange={(v) => updateRow(i, { role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PACKAGING_ROLES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Weight (g)</Label>
                <Input type="number" step="0.1" value={r.weight_g} onChange={(e) => updateRow(i, { weight_g: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Recycled %</Label>
                <Input type="number" value={r.recycled_content_pct} onChange={(e) => updateRow(i, { recycled_content_pct: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save packaging
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// SupplierCoaPanel — CoA / spec sheet → supplier_product_evidence. Needs a
// supplier product to attach to; carries the stashed file across as the evidence.
// ───────────────────────────────────────────────────────────────────────────────

const COA_TYPES: { value: string; label: string }[] = [
  { value: 'specification_sheet', label: 'Specification sheet' },
  { value: 'test_report', label: 'Certificate of Analysis / test report' },
  { value: 'carbon_certificate', label: 'Carbon / EPD certificate' },
]

function SupplierCoaPanel({
  coa,
  onClose,
  onSaved,
}: {
  coa: NonNullable<IngestResponse['supplierCoa']> | undefined
  onClose: () => void
  onSaved?: ReviewPanelProps['onSaved']
}) {
  const [supplierProducts, setSupplierProducts] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [supplierProductId, setSupplierProductId] = useState('')
  const [docName, setDocName] = useState(coa?.product_name || '')
  const [docType, setDocType] = useState<string>(
    coa?.document_type && COA_TYPES.some((t) => t.value === coa.document_type) ? coa.document_type : 'specification_sheet',
  )
  const [docDate, setDocDate] = useState(coa?.document_date || '')
  const [expiry, setExpiry] = useState(coa?.expiry_date || '')
  const [reference, setReference] = useState(coa?.reference_number || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ attached: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/supplier-products/search')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((body) => {
        if (cancelled) return
        setSupplierProducts(((body?.results || []) as any[]).map((s) => ({ id: s.id, name: s.name })))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const canSave = !!supplierProductId && !saving

  const save = async () => {
    if (!supplierProductId) { toast.error('Pick which supplier product this is for.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/supplier-products/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_product_id: supplierProductId,
          stash_id: coa?.stashId || null,
          document_name: docName || null,
          document_type: docType,
          document_date: docDate || null,
          expiry_date: expiry || null,
          reference_number: reference || null,
          covers_climate: !!coa?.covers_climate,
          covers_water: !!coa?.covers_water,
          covers_waste: !!coa?.covers_waste,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error || 'Could not file the document.'); return }
      setSaved({ attached: !!json.attached_file })
      toast.success('Document filed against the supplier product.')
      onSaved?.(
        {
          document_name: docName || null,
          document_type: docType,
          document_date: docDate || null,
          expiry_date: expiry || null,
          reference_number: reference || null,
        },
        {
          supplier_product_id: supplierProductId,
          supplier_product_name: supplierProducts.find((s) => s.id === supplierProductId)?.name,
        },
      )
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-400/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Filed against the supplier product, pending verification.</p>
            <p className="text-xs text-muted-foreground mt-1">
              {saved.attached ? 'The document is attached as evidence.' : 'Saved as a metadata record.'}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href="/suppliers" onClick={onClose}>View suppliers</Link>
          </Button>
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <FileText className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">
            We read a supplier {COA_TYPES.find((t) => t.value === docType)?.label.toLowerCase() || 'document'}
            {coa?.supplier_name ? ` from ${coa.supplier_name}` : ''}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Pick the supplier product to file it against. We&apos;ll keep the file as evidence.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Supplier product</Label>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : supplierProducts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No supplier products yet. <Link href="/suppliers" className="underline">Add suppliers</Link>.
          </p>
        ) : (
          <Select value={supplierProductId} onValueChange={setSupplierProductId}>
            <SelectTrigger><SelectValue placeholder="Select supplier product" /></SelectTrigger>
            <SelectContent>
              {supplierProducts.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-[11px] text-muted-foreground">Document name</Label>
          <Input value={docName} onChange={(e) => setDocName(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label className="text-[11px] text-muted-foreground">Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COA_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Document date</Label>
          <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Expiry</Label>
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label className="text-[11px] text-muted-foreground">Reference / batch no.</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          File document
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// CertificationPanel — certification certificate → organization_certifications.
// Resolves the extracted framework hint to a framework, with a picker fallback.
// ───────────────────────────────────────────────────────────────────────────────

const CERT_HINT_TO_CODE: Record<string, string> = {
  bcorp: 'bcorp_21',
  iso14001: 'iso14001',
  iso50001: 'iso50001',
  csrd: 'csrd',
  sbti: 'sbti',
  gri: 'gri',
  cdp_climate: 'cdp_climate',
  ecovadis: 'ecovadis',
}

function CertificationPanel({
  cert,
  onClose,
  onSaved,
}: {
  cert: NonNullable<IngestResponse['certification']> | undefined
  onClose: () => void
  onSaved?: ReviewPanelProps['onSaved']
}) {
  const [frameworks, setFrameworks] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [loading, setLoading] = useState(true)
  const [frameworkId, setFrameworkId] = useState('')
  const [number, setNumber] = useState(cert?.certificate_number || '')
  const [issueDate, setIssueDate] = useState(cert?.issue_date || '')
  const [expiry, setExpiry] = useState(cert?.expiry_date || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/certifications/frameworks?active_only=true')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((body) => {
        if (cancelled) return
        const list = ((body?.frameworks || []) as any[]).map((f) => ({ id: f.id, name: f.name, code: f.code }))
        setFrameworks(list)
        // Auto-match from the extracted hint.
        const wantCode = cert?.framework_hint ? CERT_HINT_TO_CODE[cert.framework_hint] : undefined
        const match = wantCode ? list.find((f) => f.code === wantCode) : undefined
        if (match) setFrameworkId(match.id)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cert?.framework_hint])

  const canSave = !!frameworkId && !saving

  const save = async () => {
    if (!frameworkId) { toast.error('Pick which certification this is.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/certifications/frameworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framework_id: frameworkId,
          status: 'certified',
          certification_number: number || null,
          certification_date: issueDate || null,
          expiry_date: expiry || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error || json.details || 'Could not save the certification.'); return }
      setSaved(true)
      toast.success('Certification recorded.')
      onSaved?.(
        {
          certification_number: number || null,
          certification_date: issueDate || null,
          expiry_date: expiry || null,
        },
        {
          framework_id: frameworkId,
          framework_code: frameworks.find((f) => f.id === frameworkId)?.code,
        },
      )
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-400/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Certification recorded as certified.</p>
            <p className="text-xs text-muted-foreground mt-1">
              You can track readiness and evidence on the Certifications page.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href="/certifications" onClick={onClose}>View certifications</Link>
          </Button>
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    )
  }

  const noMatch = !loading && cert?.framework_hint === 'other'

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <ScrollText className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">We read a certification certificate{cert?.certificate_name ? `: ${cert.certificate_name}` : ''}.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Confirm the framework and dates. We&apos;ll record it as a held certification.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Framework</Label>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <Select value={frameworkId} onValueChange={setFrameworkId}>
              <SelectTrigger><SelectValue placeholder="Select framework" /></SelectTrigger>
              <SelectContent>
                {frameworks.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {noMatch && !frameworkId && (
              <p className="text-[11px] text-amber-600">
                We couldn&apos;t match this to a known framework. Pick the closest one, or skip if it isn&apos;t tracked here.
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Certificate no.</Label>
          <Input value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Issued</Label>
          <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Expires</Label>
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Record certification
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// FreightInvoicePanel — freight/logistics invoice → Scope 3 upstream transport.
// Prefers activity (mode × weight × distance) and falls back to spend.
// ───────────────────────────────────────────────────────────────────────────────

const FREIGHT_MODES: { value: string; label: string }[] = [
  { value: 'truck', label: 'Road (HGV)' },
  { value: 'train', label: 'Rail' },
  { value: 'ship', label: 'Sea' },
  { value: 'air', label: 'Air' },
]

function FreightInvoicePanel({
  freight,
  onClose,
  onSaved,
}: {
  freight: NonNullable<IngestResponse['freightInvoice']> | undefined
  onClose: () => void
  onSaved?: ReviewPanelProps['onSaved']
}) {
  const [carrier] = useState(freight?.carrier_name || '')
  const [date, setDate] = useState(freight?.shipment_date || '')
  const [mode, setMode] = useState(
    freight?.transport_mode && FREIGHT_MODES.some((m) => m.value === freight.transport_mode)
      ? freight.transport_mode
      : '',
  )
  const [weight, setWeight] = useState(freight?.weight_kg != null ? String(freight.weight_kg) : '')
  const [distance, setDistance] = useState(freight?.distance_km != null ? String(freight.distance_km) : '')
  const [amount, setAmount] = useState(freight?.amount != null ? String(freight.amount) : '')
  const [currency, setCurrency] = useState<string>(
    freight?.currency && INVOICE_CURRENCIES.includes(freight.currency) ? freight.currency : 'GBP',
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ method: string; co2e: number } | null>(null)

  const hasActivity = !!mode && Number(weight) > 0 && Number(distance) > 0
  const hasSpend = Number(amount) > 0
  const canSave = (hasActivity || hasSpend) && !saving

  const save = async () => {
    if (!hasActivity && !hasSpend) {
      toast.error('Add mode + weight + distance, or an invoice amount.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/spend/freight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier_name: carrier,
          shipment_date: date || null,
          transport_mode: mode || null,
          weight_kg: weight ? Number(weight) : null,
          distance_km: distance ? Number(distance) : null,
          amount: amount ? Number(amount) : null,
          currency,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || 'Could not save the freight invoice.')
        return
      }
      setSaved({ method: json.method || 'spend', co2e: json.total_co2e_kg ?? 0 })
      toast.success('Freight saved to Scope 3.')
      onSaved?.({
        carrier_name: carrier,
        shipment_date: date || null,
        transport_mode: mode || null,
        weight_kg: weight ? Number(weight) : null,
        distance_km: distance ? Number(distance) : null,
        amount: amount ? Number(amount) : null,
        currency,
      })
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    const tonnes = saved.co2e / 1000
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-400/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Freight saved to your Scope 3 footprint.</p>
            <p className="text-xs text-muted-foreground mt-1">
              ~{tonnes < 1 ? `${Math.round(saved.co2e)} kg` : `${tonnes.toFixed(1)} t`} CO2e
              ({saved.method === 'activity' ? 'activity-based, tonne-km' : 'spend-based estimate'}).
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href="/data/spend-data" onClick={onClose}>View spend data</Link>
          </Button>
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <FileText className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">We read a freight invoice{carrier ? ` from ${carrier}` : ''}.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add mode, weight and distance for an activity-based estimate (most accurate). If you
            only have the cost, we&apos;ll use a spend-based estimate.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Shipment date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
            <SelectContent>
              {FREIGHT_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Weight (kg)</Label>
          <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Distance (km)</Label>
          <Input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Invoice amount (fallback)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INVOICE_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {hasActivity
          ? 'Will be saved as activity-based (tonne-km).'
          : hasSpend
            ? 'Will be saved as a spend-based estimate. Add weight + distance for a tighter number.'
            : 'Add weight + distance + mode, or an invoice amount.'}
      </p>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save to Scope 3
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// RefrigerantPanel — F-gas service record → Scope 1 fugitive (utility_data_entries).
// Needs a facility, since refrigerant entries are facility-scoped.
// ───────────────────────────────────────────────────────────────────────────────

const REFRIGERANT_OPTIONS: { value: string; label: string }[] = [
  { value: 'r134a', label: 'R-134a' },
  { value: 'r404a', label: 'R-404A' },
  { value: 'r410a', label: 'R-410A' },
  { value: 'r407c', label: 'R-407C' },
  { value: 'r507a', label: 'R-507A' },
  { value: 'r32', label: 'R-32' },
  { value: 'r1234yf', label: 'R-1234yf' },
  { value: 'r717', label: 'R-717 (Ammonia)' },
  { value: 'r744', label: 'R-744 (CO2)' },
  { value: 'r290', label: 'R-290 (Propane)' },
]

function RefrigerantPanel({
  service,
  onClose,
  onSaved,
}: {
  service: NonNullable<IngestResponse['refrigerantService']> | undefined
  onClose: () => void
  onSaved?: ReviewPanelProps['onSaved']
}) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [facilityId, setFacilityId] = useState('')
  const [date, setDate] = useState(service?.service_date || '')
  const [refrigerant, setRefrigerant] = useState(
    service?.refrigerant_type && REFRIGERANT_OPTIONS.some((o) => o.value === service.refrigerant_type)
      ? service.refrigerant_type
      : 'r134a',
  )
  const [quantity, setQuantity] = useState(service?.quantity_kg != null ? String(service.quantity_kg) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!orgId) return
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
        if (list.length === 1) setFacilityId(list[0].id)
      })
    return () => { cancelled = true }
  }, [orgId])

  const canSave = !!facilityId && Number(quantity) > 0 && !saving

  const save = async () => {
    if (!facilityId) { toast.error('Pick which facility this is for.'); return }
    if (!(Number(quantity) > 0)) { toast.error('Enter the recharged quantity in kg.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/data/refrigerant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facilityId,
          service_date: date || null,
          refrigerant_type: refrigerant,
          quantity_kg: Number(quantity),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error || 'Could not save the record.'); return }
      setSaved(true)
      toast.success('Refrigerant record saved to Scope 1.')
      onSaved?.(
        {
          service_date: date || null,
          refrigerant_type: refrigerant,
          quantity_kg: Number(quantity),
        },
        {
          facility_id: facilityId,
          facility_name: facilities.find((f) => f.id === facilityId)?.name,
        },
      )
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-400/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Refrigerant record saved as a Scope 1 fugitive emission.</p>
            <p className="text-xs text-muted-foreground mt-1">
              {quantity} kg of {REFRIGERANT_OPTIONS.find((o) => o.value === refrigerant)?.label}. The
              GWP is applied automatically in your footprint.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href="/data/scope-1-2" onClick={onClose}>View Scope 1 & 2</Link>
          </Button>
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <Zap className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">We read a refrigerant service record.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Confirm the refrigerant and the mass recharged, and pick the facility. This is a Scope 1
            fugitive emission.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Facility</Label>
        {facilities.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No facilities yet. <Link href="/company/facilities" className="underline">Add one</Link>.
          </p>
        ) : (
          <Select value={facilityId} onValueChange={setFacilityId}>
            <SelectTrigger><SelectValue placeholder="Select facility" /></SelectTrigger>
            <SelectContent>
              {facilities.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Service date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Refrigerant</Label>
          <Select value={refrigerant} onValueChange={setRefrigerant}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REFRIGERANT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Recharged (kg)</Label>
          <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save to Scope 1
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// SoilCarbonLabPanel — structured soil-carbon path. The classifier has parsed a
// soil lab report into measured SOC samples; here the grower confirms the
// values, picks which land unit they belong to, and we save each one straight
// to /api/soil-carbon/samples (which recomputes the measured stock-change cache
// + trajectory). No re-upload, no manual keying of the lab numbers.
// ───────────────────────────────────────────────────────────────────────────────

type LandUnitType = 'vineyard' | 'orchard' | 'arable_field'
const LAND_UNIT_TYPE_BY_KIND: Record<AssetKind, LandUnitType> = {
  vineyards: 'vineyard',
  orchards: 'orchard',
  'arable-fields': 'arable_field',
}

interface LabSampleDraft {
  location_label: string
  sample_date: string
  depth_cm: string
  soc_input_method: 'stock' | 'concentration'
  soc_stock_tc_ha: string
  soc_concentration_pct: string
  bulk_density_g_cm3: string
  sampling_points: string
}

function SoilCarbonLabPanel({
  lab,
  onClose,
  onSaved,
}: {
  lab: NonNullable<IngestResponse['soilCarbonLab']> | undefined
  onClose: () => void
  onSaved?: ReviewPanelProps['onSaved']
}) {
  const [assetKind, setAssetKind] = useState<AssetKind | null>(null)
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [assetId, setAssetId] = useState<string>('')
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ count: number } | null>(null)

  const defaultDate = lab?.default_sample_date || ''
  const [rows, setRows] = useState<LabSampleDraft[]>(() =>
    (lab?.samples || []).map((s) => ({
      location_label: s.location_label || '',
      sample_date: s.sample_date || defaultDate || '',
      depth_cm: s.depth_cm != null ? String(s.depth_cm) : '30',
      soc_input_method: s.soc_input_method === 'concentration' ? 'concentration' : 'stock',
      soc_stock_tc_ha: s.soc_stock_tc_ha != null ? String(s.soc_stock_tc_ha) : '',
      soc_concentration_pct: s.soc_concentration_pct != null ? String(s.soc_concentration_pct) : '',
      bulk_density_g_cm3: s.bulk_density_g_cm3 != null ? String(s.bulk_density_g_cm3) : '',
      sampling_points: s.sampling_points != null ? String(s.sampling_points) : '',
    })),
  )

  useEffect(() => {
    if (!assetKind) return
    let cancelled = false
    setLoadingAssets(true)
    setLoadError(null)
    setAssets([])
    setAssetId('')
    const typeMeta = ASSET_TYPES.find((t) => t.value === assetKind)!
    fetch(typeMeta.apiPath)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
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
        if (!cancelled) setLoadingAssets(false)
      })
    return () => {
      cancelled = true
    }
  }, [assetKind])

  const updateRow = (i: number, patch: Partial<LabSampleDraft>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const typeMeta = assetKind ? ASSET_TYPES.find((t) => t.value === assetKind)! : null

  const rowValid = (r: LabSampleDraft) => {
    if (!r.sample_date) return false
    if (!r.depth_cm || Number(r.depth_cm) <= 0) return false
    if (r.soc_input_method === 'stock') return !!r.soc_stock_tc_ha
    return !!r.soc_concentration_pct && !!r.bulk_density_g_cm3
  }
  const allValid = rows.length > 0 && rows.every(rowValid)
  const canSave = !!assetId && allValid && !saving

  const save = async () => {
    if (!assetId || !assetKind) {
      toast.error('Pick which asset these measurements are for.')
      return
    }
    const invalid = rows.findIndex((r) => !rowValid(r))
    if (invalid >= 0) {
      toast.error(`Measurement ${invalid + 1} is missing a date, depth, or value.`)
      return
    }
    setSaving(true)
    const landUnitType = LAND_UNIT_TYPE_BY_KIND[assetKind]
    let savedCount = 0
    try {
      for (const r of rows) {
        const res = await fetch('/api/soil-carbon/samples', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            land_unit_type: landUnitType,
            land_unit_id: assetId,
            sample_date: r.sample_date,
            depth_cm: Number(r.depth_cm),
            soc_input_method: r.soc_input_method,
            soc_stock_tc_ha: r.soc_input_method === 'stock' ? Number(r.soc_stock_tc_ha) : null,
            soc_concentration_pct:
              r.soc_input_method === 'concentration' ? Number(r.soc_concentration_pct) : null,
            bulk_density_g_cm3:
              r.soc_input_method === 'concentration' ? Number(r.bulk_density_g_cm3) : null,
            sampling_points: r.sampling_points ? Number(r.sampling_points) : null,
            lab_name: lab?.lab_name || null,
            methodology: lab?.methodology || null,
            verification_status: 'unverified',
            notes: r.location_label ? `Sample location: ${r.location_label}` : null,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error(j.error || `Could not save measurement ${savedCount + 1}.`)
          break
        }
        savedCount += 1
      }
    } finally {
      setSaving(false)
    }
    if (savedCount > 0) {
      setSaved({ count: savedCount })
      toast.success(`Saved ${savedCount} soil carbon measurement${savedCount === 1 ? '' : 's'}.`)
      onSaved?.(
        {
          lab_name: lab?.lab_name || null,
          methodology: lab?.methodology || null,
          samples: rows.slice(0, savedCount).map((r) => ({
            location_label: r.location_label || null,
            sample_date: r.sample_date,
            depth_cm: Number(r.depth_cm),
            soc_input_method: r.soc_input_method,
            soc_stock_tc_ha: r.soc_input_method === 'stock' ? Number(r.soc_stock_tc_ha) : null,
            soc_concentration_pct:
              r.soc_input_method === 'concentration' ? Number(r.soc_concentration_pct) : null,
            bulk_density_g_cm3:
              r.soc_input_method === 'concentration' ? Number(r.bulk_density_g_cm3) : null,
          })),
        },
        {
          asset_kind: assetKind,
          asset_id: assetId,
          asset_name: assets.find((a) => a.id === assetId)?.name,
          saved_count: savedCount,
        },
      )
    }
  }

  if (saved) {
    const link = typeMeta && assetId ? `${typeMeta.pageBase}/${assetId}` : null
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-400/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">
              Saved {saved.count} measurement{saved.count === 1 ? '' : 's'} to {typeMeta?.label.toLowerCase()}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Once two or more samples exist at a consistent depth, the measured stock-change becomes
              your soil carbon removal. Existing products need a Recalculate LCA pass to pick up the
              new value.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          {link && (
            <Button asChild size="sm" variant="outline">
              <Link href={link} onClick={onClose}>
                View {typeMeta?.label.toLowerCase()}
              </Link>
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5">
        <Leaf className="h-4 w-4 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">We read a soil carbon lab report.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Confirm the {rows.length} measurement{rows.length === 1 ? '' : 's'} below and pick which
            asset they belong to. We&apos;ll save them straight to the field&apos;s soil carbon record.
          </p>
          {(lab?.lab_name || lab?.methodology) && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {[lab?.lab_name, lab?.methodology].filter(Boolean).join(' · ')}
            </p>
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
              <div className="flex items-center gap-1.5">
                {t.icon}
                <span className="text-xs">{t.label}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {assetKind && (
        <div className="space-y-1.5">
          <Label htmlFor="lab-asset" className="text-xs">
            Select {typeMeta?.label.toLowerCase()}
          </Label>
          {loadingAssets ? (
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
              <SelectTrigger id="lab-asset">
                <SelectValue placeholder={`Select ${typeMeta?.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="space-y-3">
        <Label className="text-xs">Measurements</Label>
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">No measurements left to save.</p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                {r.location_label || `Measurement ${i + 1}`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(i)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Sample date</Label>
                <Input
                  type="date"
                  value={r.sample_date}
                  onChange={(e) => updateRow(i, { sample_date: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Depth (cm)</Label>
                <Input
                  type="number"
                  min={1}
                  value={r.depth_cm}
                  onChange={(e) => updateRow(i, { depth_cm: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">How was it measured?</Label>
              <Select
                value={r.soc_input_method}
                onValueChange={(v) => updateRow(i, { soc_input_method: v as 'stock' | 'concentration' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">SOC stock (tonnes C per hectare)</SelectItem>
                  <SelectItem value="concentration">Lab values (concentration % + bulk density)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {r.soc_input_method === 'stock' ? (
              <div>
                <Label className="text-[11px] text-muted-foreground">SOC stock (tonnes C / ha)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={r.soc_stock_tc_ha}
                  onChange={(e) => updateRow(i, { soc_stock_tc_ha: e.target.value })}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">SOC concentration (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.soc_concentration_pct}
                    onChange={(e) => updateRow(i, { soc_concentration_pct: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Bulk density (g/cm³)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.bulk_density_g_cm3}
                    onChange={(e) => updateRow(i, { bulk_density_g_cm3: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save {rows.length} measurement{rows.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  )
}
