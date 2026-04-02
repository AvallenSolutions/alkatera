'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, Trash2, FileText, Loader2, ExternalLink } from 'lucide-react'
import type { SupplierEsgEvidence } from '@/lib/types/supplier-esg'

interface EsgQuestionEvidenceUploadProps {
  questionId: string
  evidence: SupplierEsgEvidence[]
  onUpload: (questionId: string, file: File, name: string) => Promise<any>
  onDelete: (id: string) => Promise<boolean>
  disabled?: boolean
}

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.docx'

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EsgQuestionEvidenceUpload({
  questionId,
  evidence,
  onUpload,
  onDelete,
  disabled = false,
}: EsgQuestionEvidenceUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10 MB limit
    if (file.size > 10 * 1024 * 1024) {
      // Use the browser alert as a lightweight option for inline component
      alert('File is too large. Maximum size is 10 MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    try {
      await onUpload(questionId, file, file.name)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await onDelete(id)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mt-2 space-y-1.5">
      {/* Attached files list */}
      {evidence.length > 0 && (
        <div className="space-y-1">
          {evidence.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1"
            >
              <FileText className="h-3 w-3 flex-shrink-0" />
              <span className="truncate flex-1" title={item.document_name}>
                {item.document_name}
              </span>
              {item.file_size_bytes && (
                <span className="text-muted-foreground/70 flex-shrink-0">
                  {formatFileSize(item.file_size_bytes)}
                </span>
              )}
              {item.document_url && (
                <a
                  href={item.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title="Open file"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {!disabled && (
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  className="flex-shrink-0 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === item.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Paperclip className="h-3 w-3" />
                Attach Evidence
                {evidence.length > 0 && (
                  <span className="ml-1 text-muted-foreground/70">({evidence.length})</span>
                )}
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_TYPES}
            onChange={handleFileSelect}
          />
        </div>
      )}
    </div>
  )
}
