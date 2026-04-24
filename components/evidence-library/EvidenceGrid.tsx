'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Upload,
  Loader2,
  FileText,
  Tag,
  Link2,
  ArrowRight,
} from 'lucide-react'

interface EvidenceDocRow {
  id: string
  title: string
  description: string | null
  tags: string[]
  document_name: string
  mime_type: string | null
  file_size_bytes: number | null
  created_at: string
  updated_at: string
  linked_count: number
}

export function EvidenceGrid() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [docs, setDocs] = useState<EvidenceDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/evidence-library?organizationId=${orgId}`)
      if (!res.ok) throw new Error('Failed to load library')
      const body = await res.json()
      setDocs(body.data || [])
    } catch (err: any) {
      toast.error(err.message || 'Failed to load library')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">Evidence Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a policy or evidence doc once — we&apos;ll suggest which B Corp, VSME, ESRS, CDP and SBTi requirements it satisfies.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload document
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Your evidence library is empty.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your first policy or compliance document to start reusing it across frameworks.
              </p>
            </div>
            <Button onClick={() => setUploadOpen(true)} size="sm" className="gap-2">
              <Upload className="h-3.5 w-3.5" />
              Upload document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <Link key={d.id} href={`/evidence-library/${d.id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-4 flex flex-col gap-3 h-full">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{d.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {d.document_name}
                      </p>
                    </div>
                  </div>

                  {d.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                  )}

                  {d.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {d.tags.slice(0, 4).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={
                        d.linked_count > 0
                          ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px] gap-1'
                          : 'text-[10px] gap-1'
                      }
                    >
                      <Link2 className="h-2.5 w-2.5" />
                      {d.linked_count === 0 ? 'Not linked yet' : `Linked to ${d.linked_count}`}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={refresh} />
    </div>
  )
}

function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onUploaded: () => void
}) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [uploading, setUploading] = useState(false)

  const reset = () => {
    setFile(null)
    setTitle('')
    setDescription('')
    setTagsRaw('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = (next: boolean) => {
    if (!uploading) onOpenChange(next)
    if (!next) reset()
  }

  const handleFilePick = (f: File | null) => {
    setFile(f)
    if (f && !title) {
      // default the title to the file name without extension
      setTitle(f.name.replace(/\.[^.]+$/, ''))
    }
  }

  const handleUpload = async () => {
    if (!orgId || !file || !title.trim()) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('organizationId', orgId)
      fd.append('title', title.trim())
      if (description.trim()) fd.append('description', description.trim())
      if (tagsRaw.trim()) fd.append('tags', tagsRaw.trim())

      const res = await fetch('/api/evidence-library', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Upload failed')
      }
      toast.success('Document uploaded')
      reset()
      onOpenChange(false)
      onUploaded()
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload evidence document</DialogTitle>
          <DialogDescription>
            PDFs or images up to 20 MB. You&apos;ll be able to auto-suggest matching framework requirements after upload.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-background file:text-sm file:font-medium hover:file:bg-muted"
            />
            {file && (
              <p className="text-[11px] text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evidence-title">Title</Label>
            <Input
              id="evidence-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Code of Conduct 2026"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evidence-description">Description (optional)</Label>
            <Textarea
              id="evidence-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="One or two sentences describing what this document contains."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evidence-tags">Tags (optional, comma-separated)</Label>
            <Input
              id="evidence-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="policy, governance, 2026"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleUpload} disabled={uploading || !file || !title.trim()}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
