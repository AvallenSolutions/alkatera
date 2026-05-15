'use client'

import { useCallback, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'

export type OnboardingUploadKind = 'csv' | 'utility_bill'

interface KindConfig {
  title: string
  description: string
  acceptMimes: string
  acceptLabel: string
  maxBytes: number
  onUpload: (
    file: File,
    organizationId: string,
    userId: string,
  ) => Promise<{ summary: string; subline?: string }>
}

const CONFIG: Record<OnboardingUploadKind, KindConfig> = {
  csv: {
    title: 'Upload your products',
    description:
      'Drop your Excel of products. We parse it on the spot and add the products to your account as drafts. Refine ingredients and packaging later.',
    acceptMimes: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
    acceptLabel: 'Excel (.xlsx, .xls)',
    maxBytes: 10 * 1024 * 1024,
    onUpload: async (file, organizationId) => {
      const fd = new FormData()
      fd.append('file', file)
      const parseRes = await fetch('/api/bulk-import/upload', { method: 'POST', body: fd })
      const parseBody = await parseRes.json().catch(() => ({}))
      if (!parseRes.ok) throw new Error(parseBody?.error || 'Failed to read the spreadsheet')

      const products = (parseBody?.data?.products ?? []) as Array<{ name: string; sku: string; category: string }>
      const summary = parseBody?.summary ?? {}

      // Inline-insert as drafts so the user lands on /rosa/ with real products,
      // skipping the bulk-import wizard (material matching) for the W3 fast
      // path. They can refine recipes and packaging later from /products/.
      let createdCount = 0
      if (products.length > 0) {
        const rows = products
          .filter(p => p.name?.trim().length > 0)
          .map(p => ({
            organization_id: organizationId,
            name: p.name.trim(),
            sku: p.sku?.trim() || null,
            product_category: p.category?.trim() || null,
            is_draft: true,
          }))
        if (rows.length > 0) {
          const { error: insErr } = await supabase.from('products').insert(rows)
          if (insErr) throw new Error(insErr.message)
          createdCount = rows.length
        }
      }

      const sub: string[] = []
      if (summary.ingredients) sub.push(`${summary.ingredients} ingredient row${summary.ingredients === 1 ? '' : 's'}`)
      if (summary.packaging) sub.push(`${summary.packaging} packaging row${summary.packaging === 1 ? '' : 's'}`)
      if (summary.errors) sub.push(`${summary.errors} parse warning${summary.errors === 1 ? '' : 's'}`)
      return {
        summary: `Added ${createdCount} product${createdCount === 1 ? '' : 's'}`,
        subline: sub.length > 0 ? `Also detected: ${sub.join(', ')}. Refine these later from Products.` : undefined,
      }
    },
  },
  utility_bill: {
    title: 'Upload a utility bill',
    description:
      "Drop in a recent energy, gas or water bill (PDF or image). Rosa will read it in the background and queue it for you to assign to a facility on /rosa/.",
    acceptMimes: 'application/pdf,image/png,image/jpeg,image/webp',
    acceptLabel: 'PDF, PNG, JPEG, WebP',
    maxBytes: 20 * 1024 * 1024,
    onUpload: async (file, organizationId, userId) => {
      // Stash the file in the ingest-staging bucket and queue a row in
      // ingest_jobs. Rosa picks it up post-onboarding via the existing
      // background path; user gets a clear "Rosa is reading this" signal
      // both here and in RecentlyFromRosa.
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const stashPath = `${organizationId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('ingest-staging')
        .upload(stashPath, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

      const queueRes = await fetch('/api/onboarding/utility-bill/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          stashPath,
          fileName: file.name,
          fileMime: file.type,
        }),
      })
      const queueBody = await queueRes.json().catch(() => ({}))
      if (!queueRes.ok) throw new Error(queueBody?.error || 'Could not queue the bill')

      return {
        summary: `Got it — Rosa is reading "${file.name}"`,
        subline: 'You can review the extracted entries from /rosa/ once she\'s done.',
      }
    },
  },
}

interface Props {
  open: boolean
  onClose: () => void
  organizationId: string
  userId: string
  kind: OnboardingUploadKind
  onSuccess: () => void
}

export function OnboardingUploadDialog({ open, onClose, organizationId, userId, kind, onSuccess }: Props) {
  const cfg = CONFIG[kind]
  const [stage, setStage] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')
  const [subline, setSubline] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStage('idle')
    setMessage('')
    setSubline('')
    setError('')
    setDragOver(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const processFile = useCallback(async (file: File) => {
    if (file.size > cfg.maxBytes) {
      setError(`File is too large (max ${Math.round(cfg.maxBytes / 1024 / 1024)}MB)`)
      setStage('error')
      return
    }
    setStage('uploading')
    try {
      const result = await cfg.onUpload(file, organizationId, userId)
      setMessage(result.summary)
      setSubline(result.subline || '')
      setStage('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStage('error')
    }
  }, [cfg, organizationId, userId])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>

        {stage === 'idle' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void processFile(f)
            }}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
              dragOver ? 'border-[#ccff00] bg-[#ccff00]/5' : 'border-border hover:border-foreground/30',
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Drop a file here, or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">{cfg.acceptLabel}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={cfg.acceptMimes}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void processFile(f)
              }}
            />
          </div>
        )}

        {stage === 'uploading' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#ccff00]" />
            <p className="text-sm text-muted-foreground">Uploading and reading...</p>
          </div>
        )}

        {stage === 'success' && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-sm font-medium">{message}</p>
            {subline && <p className="text-xs text-muted-foreground max-w-xs">{subline}</p>}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => { onSuccess(); handleClose() }} className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90">
                Continue
              </Button>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm font-medium text-red-300">{error}</p>
            <Button variant="outline" onClick={reset}>Try again</Button>
          </div>
        )}

        {stage === 'idle' && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            All processing happens here in onboarding — we won't redirect you anywhere.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
