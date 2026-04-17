'use client'

import { useState, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, Loader2, CheckCircle2, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import type { ExtractedFacilityBillData, ExtractedWaterEntry } from '@/app/api/facilities/import-bill/route'

interface WaterBillImportDialogProps {
  open: boolean
  onClose: () => void
  facilityId: string
  organizationId: string
  onDataSaved: () => void
}

type Step = 'upload' | 'extracting' | 'review'

const WATER_CATEGORIES = [
  { value: 'water_intake', label: 'Water Intake' },
  { value: 'water_discharge', label: 'Wastewater Discharge' },
  { value: 'water_recycled', label: 'Recycled Water' },
]

const WATER_SOURCES = [
  { value: 'municipal', label: 'Municipal Supply' },
  { value: 'groundwater', label: 'Groundwater' },
  { value: 'surface_water', label: 'Surface Water' },
  { value: 'recycled', label: 'Recycled' },
  { value: 'rainwater', label: 'Rainwater' },
  { value: 'other', label: 'Other' },
]

export function WaterBillImportDialog({
  open,
  onClose,
  facilityId,
  organizationId,
  onDataSaved,
}: WaterBillImportDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedFacilityBillData<ExtractedWaterEntry> | null>(null)
  const [entries, setEntries] = useState<ExtractedWaterEntry[]>([])
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [billName, setBillName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('upload')
    setDragOver(false)
    setExtracted(null)
    setEntries([])
    setPeriodStart('')
    setPeriodEnd('')
    setBillName('')
    setIsSaving(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const processFile = useCallback(async (file: File) => {
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) { toast.error('File must be under 20MB'); return }

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF or image (JPEG, PNG, WebP)')
      return
    }

    setStep('extracting')

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('organizationId', organizationId)
      form.append('mode', 'water')

      const res = await fetch('/api/facilities/import-bill', { method: 'POST', body: form })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Extraction failed')
      }

      const data: ExtractedFacilityBillData<ExtractedWaterEntry> = await res.json()

      if (!data.entries || data.entries.length === 0) {
        toast.error('No water consumption data found in this document')
        setStep('upload')
        return
      }

      setExtracted(data)
      setEntries(data.entries)
      setPeriodStart(data.period_start ?? '')
      setPeriodEnd(data.period_end ?? '')
      const defaultName = data.supplier_name
        ? `${data.supplier_name}${data.period_start ? ` ${data.period_start}` : ''}`
        : file.name.replace(/\.[^.]+$/, '')
      setBillName(defaultName)
      setStep('review')
    } catch (err: any) {
      toast.error(err.message || 'Failed to read the document')
      setStep('upload')
    }
  }, [organizationId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const updateEntry = (i: number, field: keyof ExtractedWaterEntry, value: string | number) => {
    setEntries(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value } as ExtractedWaterEntry
      return next
    })
  }

  const removeEntry = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!periodStart || !periodEnd) { toast.error('Please set the billing period'); return }
    const valid = entries.filter(e => e.activity_category && e.quantity > 0)
    if (valid.length === 0) { toast.error('No valid entries to save'); return }

    setIsSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      for (const entry of valid) {
        const trimmed = billName.trim()
        const catLabel = WATER_CATEGORIES.find(c => c.value === entry.activity_category)?.label || entry.activity_category
        const entryName = trimmed
          ? (valid.length > 1 ? `${trimmed} — ${catLabel}` : trimmed)
          : null

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-facility-activity-entry`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({
              facility_id: facilityId,
              organization_id: organizationId,
              activity_category: entry.activity_category,
              activity_date: periodStart,
              reporting_period_start: periodStart,
              reporting_period_end: periodEnd,
              quantity: entry.quantity,
              unit: entry.unit || 'm³',
              data_provenance: 'primary_measured_onsite',
              allocation_basis: 'none',
              water_source_type: entry.water_source_type || undefined,
              name: entryName,
            }),
          }
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Failed to save entry')
        }
      }

      toast.success(`${valid.length} ${valid.length === 1 ? 'entry' : 'entries'} imported from bill`)
      onDataSaved()
      handleClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from water bill</DialogTitle>
          <DialogDescription>
            Upload a PDF or photo of your water or wastewater bill and we&apos;ll extract the consumption data automatically.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`w-full flex flex-col items-center gap-3 p-8 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30'
              }`}
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-sm">Drop your bill here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF or image (JPEG, PNG) — up to 20MB</p>
              </div>
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Works with water supply and wastewater bills (e.g. Thames Water, SUEZ).
            </p>
          </div>
        )}

        {step === 'extracting' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Reading your bill...</p>
              <p className="text-sm text-muted-foreground mt-1">Claude is extracting the consumption data</p>
            </div>
          </div>
        )}

        {step === 'review' && extracted && (
          <div className="space-y-5">
            {extracted.supplier_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span>Extracted from <strong className="text-foreground">{extracted.supplier_name}</strong> bill</span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Bill name</Label>
              <Input
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                placeholder="e.g. Thames Water Q1 2026"
              />
              <p className="text-xs text-muted-foreground">
                Used to identify this bill if you have multiple for the same facility and period.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Billing period</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Water data</Label>
              <div className="space-y-2">
                {entries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end p-3 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <Select
                        value={entry.activity_category}
                        onValueChange={v => updateEntry(i, 'activity_category', v)}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {WATER_CATEGORIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 w-24">
                      <Label className="text-xs text-muted-foreground">Quantity</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={entry.quantity}
                        onChange={e => updateEntry(i, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1 w-16">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <Input
                        value={entry.unit}
                        onChange={e => updateEntry(i, 'unit', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    {entries.length > 1 && (
                      <button onClick={() => removeEntry(i)} className="mb-0.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {(!periodStart || !periodEnd) && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Please set the billing period before saving.</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('upload')} disabled={isSaving}>
                Upload different bill
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !periodStart || !periodEnd} className="flex-1">
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" />Add {entries.length} {entries.length === 1 ? 'entry' : 'entries'} to records</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
