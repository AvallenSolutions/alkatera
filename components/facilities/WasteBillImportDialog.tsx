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
import type { ExtractedFacilityBillData, ExtractedWasteEntry } from '@/app/api/facilities/import-bill/route'

interface WasteBillImportDialogProps {
  open: boolean
  onClose: () => void
  facilityId: string
  organizationId: string
  onDataSaved: () => void
}

type Step = 'upload' | 'extracting' | 'review'

const WASTE_CATEGORIES = [
  { value: 'waste_general', label: 'General Waste' },
  { value: 'waste_hazardous', label: 'Hazardous Waste' },
  { value: 'waste_recycling', label: 'Recycling' },
]

export function WasteBillImportDialog({
  open,
  onClose,
  facilityId,
  organizationId,
  onDataSaved,
}: WasteBillImportDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedFacilityBillData<ExtractedWasteEntry> | null>(null)
  const [entries, setEntries] = useState<ExtractedWasteEntry[]>([])
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

  const handleClose = () => { reset(); onClose() }

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
      form.append('mode', 'waste')

      const res = await fetch('/api/facilities/import-bill', { method: 'POST', body: form })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Extraction failed')
      }

      const data: ExtractedFacilityBillData<ExtractedWasteEntry> = await res.json()

      if (!data.entries || data.entries.length === 0) {
        toast.error('No waste data found in this document')
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

  const updateEntry = (i: number, field: keyof ExtractedWasteEntry, value: string | number) => {
    setEntries(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value } as ExtractedWasteEntry
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
        const catLabel = WASTE_CATEGORIES.find(c => c.value === entry.activity_category)?.label || entry.activity_category
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
              unit: entry.unit || 'kg',
              data_provenance: 'primary_measured_onsite',
              allocation_basis: 'none',
              waste_treatment_method: entry.waste_treatment_method || undefined,
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
          <DialogTitle>Import from waste invoice</DialogTitle>
          <DialogDescription>
            Upload a PDF or photo of your waste collection invoice and we&apos;ll extract the disposal data automatically.
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
                <p className="font-medium text-sm">Drop your invoice here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF or image (JPEG, PNG) — up to 20MB</p>
              </div>
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Works with waste collection invoices (e.g. Biffa, Veolia, SUEZ).
            </p>
          </div>
        )}

        {step === 'extracting' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Reading your invoice...</p>
              <p className="text-sm text-muted-foreground mt-1">Claude is extracting the disposal data</p>
            </div>
          </div>
        )}

        {step === 'review' && extracted && (
          <div className="space-y-5">
            {extracted.supplier_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span>Extracted from <strong className="text-foreground">{extracted.supplier_name}</strong> invoice</span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Invoice name</Label>
              <Input
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                placeholder="e.g. Biffa Q1 2026"
              />
              <p className="text-xs text-muted-foreground">
                Used to identify this invoice if you have multiple for the same facility and period.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Service period</Label>
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
              <Label className="text-sm font-medium">Waste streams</Label>
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
                          {WASTE_CATEGORIES.map(c => (
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
                <span>Please set the service period before saving.</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('upload')} disabled={isSaving}>
                Upload different invoice
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
