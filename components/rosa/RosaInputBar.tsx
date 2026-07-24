'use client'

import { useCallback, useRef, useState } from 'react'
import { Paperclip, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/lib/organizationContext'
import { toast } from 'sonner'
import { UniversalDropzone } from '@/components/layouts/UniversalDropzone'

interface Props {
  /** Called when user submits text. Caller decides what to do (chat takeover). */
  onSubmit: (prompt: string) => void
  /** Optional placeholder; defaults to a Rosa-voiced prompt. */
  placeholder?: string
  /** Optional pre-filled value (e.g. coming back from a slash command). */
  defaultValue?: string
}

const SLASH_COMMANDS: Array<{ command: string; hint: string; href?: string; seed?: string }> = [
  { command: '/queue', hint: 'review what I parsed', href: '/rosa/?view=queue' },
  { command: '/dashboard', hint: 'show the full vitality breakdown', href: '/dashboard/?view=vitality' },
  { command: '/footprint', hint: 'summarise my carbon footprint', seed: 'Summarise my carbon footprint by scope and category for this year.' },
  { command: '/anomalies', hint: 'list open anomalies', seed: 'What anomalies have you flagged in the last 30 days, and how serious are they?' },
  { command: '/deadlines', hint: 'upcoming regulatory deadlines', seed: 'List my upcoming regulatory deadlines and how prepared I am for each.' },
]

/**
 * Persistent input bar at the bottom of the Rosa canvas.
 *
 * Three things go in:
 *   1. Free text → handed to onSubmit; caller switches to chat takeover
 *   2. File drop / paperclip → handed to the shared smart-upload dialog
 *      (UniversalDropzone), so every upload surface uses ONE classifier and
 *      one review UI regardless of file type (PDF, image, or spreadsheet)
 *   3. Slash commands like /queue, /footprint
 */
export function RosaInputBar({ onSubmit, placeholder, defaultValue }: Props) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [value, setValue] = useState(defaultValue || '')
  const [showSlash, setShowSlash] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // File handed to the shared smart-upload dialog.
  const [dropzoneFile, setDropzoneFile] = useState<File | null>(null)

  const submit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return

    if (trimmed.startsWith('/')) {
      const cmd = SLASH_COMMANDS.find(c => c.command === trimmed.split(/\s+/)[0])
      if (cmd) {
        if (cmd.href) {
          window.location.href = cmd.href
          return
        }
        if (cmd.seed) {
          onSubmit(cmd.seed)
          setValue('')
          setShowSlash(false)
          return
        }
      }
    }

    onSubmit(trimmed)
    setValue('')
    setShowSlash(false)
  }, [value, onSubmit])

  const handleChange = (next: string) => {
    setValue(next)
    setShowSlash(next.startsWith('/') && !next.includes(' '))
  }

  const handleFile = useCallback(
    (file: File) => {
      if (!orgId) {
        toast.error('No organisation context.')
        return
      }
      // One classifier, one review UI everywhere: hand the file to the shared
      // smart-upload dialog (the same flow as the /rosa "Drop a document"
      // button), instead of the old 3-type rosa-uploads extractor.
      setDropzoneFile(file)
    },
    [orgId],
  )

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  return (
    <>
      <UniversalDropzone
        file={dropzoneFile}
        onFileConsumed={() => setDropzoneFile(null)}
        channel="rosa"
      />
      <div className="relative">
        {showSlash && (
          <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-[6px] border border-studio-hairline bg-studio-cream">
            <ul className="max-h-64 overflow-y-auto py-1">
              {SLASH_COMMANDS.filter(c => c.command.startsWith(value.toLowerCase())).map(c => (
                <li key={c.command}>
                  <button
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 ease-studio hover:bg-studio-ink/5"
                    onClick={() => {
                      setValue(c.command)
                      setShowSlash(false)
                      setTimeout(() => submit(), 0)
                    }}
                  >
                    <code className="font-mono text-xs font-bold text-room-accent">{c.command}</code>
                    <span className="text-xs text-muted-foreground">{c.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div
          className={cn(
            'flex items-end gap-2 rounded-[6px] border border-studio-hairline bg-studio-paper/60',
            'p-2 transition-colors duration-150 ease-studio focus-within:border-studio-ink/30',
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,image/jpeg,image/png,image/webp"
            onChange={onPickFile}
            className="hidden"
          />
          <button
            type="button"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-studio-dim transition-colors duration-150 ease-studio hover:bg-studio-ink/5 hover:text-foreground"
            onClick={() => fileRef.current?.click()}
            aria-label="Upload a document"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={value}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') setShowSlash(false)
            }}
            placeholder={placeholder || 'Ask Rosa, drop a document, or type / for shortcuts'}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent border-0 outline-none focus:ring-0',
              'px-2 py-2 text-sm placeholder:text-muted-foreground',
              'min-h-[36px] max-h-32',
            )}
          />
          {/* Ink, round, and the one act this bar exists for. */}
          <button
            type="button"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-studio-ink text-studio-cream transition-colors duration-150 ease-studio hover:bg-studio-ink/85 disabled:pointer-events-none disabled:opacity-40"
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )
}
