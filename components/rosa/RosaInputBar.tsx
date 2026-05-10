'use client'

import { useCallback, useRef, useState } from 'react'
import { Paperclip, Sparkles, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

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
 * Persistent input bar at the bottom of the Rosa canvas. Three things go in:
 *   1. Free text → handed to onSubmit; caller switches to chat takeover
 *   2. File drop / paperclip → routed through /api/ingest/auto (existing
 *      pipeline). On success, surfaces a toast and lets the queue handle it
 *   3. Slash commands like /queue, /footprint
 *
 * Visually: a single rounded composer pinned at the canvas's bottom edge.
 * The chat itself has its own input; this bar is what users see when they're
 * NOT yet in a conversation thread.
 */
export function RosaInputBar({ onSubmit, placeholder, defaultValue }: Props) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [value, setValue] = useState(defaultValue || '')
  const [showSlash, setShowSlash] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    async (file: File) => {
      if (!orgId) {
        toast.error('No organisation context.')
        return
      }
      setUploading(true)
      try {
        const session = (await supabase.auth.getSession()).data.session
        const formData = new FormData()
        formData.append('file', file)
        formData.append('organizationId', orgId)
        const res = await fetch('/api/ingest/auto', {
          method: 'POST',
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
          body: formData,
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error || 'Upload failed')
        toast.success(`I'm reading ${file.name}…`, {
          description: 'It will appear in your queue once classified.',
        })
      } catch (err: any) {
        toast.error(err?.message || 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [orgId],
  )

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="relative">
      {showSlash && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <ul className="py-1 max-h-64 overflow-y-auto">
            {SLASH_COMMANDS.filter(c => c.command.startsWith(value.toLowerCase())).map(c => (
              <li key={c.command}>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-3"
                  onClick={() => {
                    setValue(c.command)
                    setShowSlash(false)
                    setTimeout(() => submit(), 0)
                  }}
                >
                  <code className="font-mono text-[#ccff00]">{c.command}</code>
                  <span className="text-muted-foreground text-xs">{c.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border border-border bg-card',
          'p-2 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-[#ccff00]/40',
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,image/jpeg,image/png,image/webp"
          onChange={onPickFile}
          className="hidden"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 flex-shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Upload a document"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
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
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 flex-shrink-0 bg-[#ccff00] text-black hover:bg-[#b8e600] disabled:opacity-50"
          onClick={submit}
          disabled={!value.trim() || uploading}
          aria-label="Send"
        >
          {uploading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <ArrowUp className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
