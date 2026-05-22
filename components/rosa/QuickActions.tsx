'use client'

import { useEffect, useState } from 'react'
import { Upload, Mail, Inbox, Copy, Check } from 'lucide-react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * "Get data into Rosa" card. Three ways to feed her:
 *   1. Drop a document (opens the same file picker the input bar uses)
 *   2. Forward an email (shows the org's inbox address, copyable)
 *   3. Open the queue (shortcut to the agent's pending items)
 *
 * The email row is only shown when managed_footprint is enabled and the
 * inbox address is set. For non-managed orgs, the row hides itself.
 */
interface Props {
  onOpenQueue?: () => void
}

export function QuickActions({ onOpenQueue }: Props) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [inbox, setInbox] = useState<string | null>(null)
  const [managedEnabled, setManagedEnabled] = useState(false)
  const [copied, setCopied] = useState(false)
  const [openCount, setOpenCount] = useState<number | null>(null)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    const load = async () => {
      const [orgRes, exRes] = await Promise.all([
        supabase
          .from('organizations')
          .select('agent_inbox_address, managed_footprint_enabled')
          .eq('id', orgId)
          .maybeSingle(),
        supabase
          .from('agent_exceptions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'open'),
      ])
      if (cancelled) return
      setInbox(orgRes.data?.agent_inbox_address || null)
      setManagedEnabled(!!orgRes.data?.managed_footprint_enabled)
      setOpenCount(exRes.count || 0)
    }
    load().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [orgId])

  const triggerFilePicker = () => {
    const input = document.querySelector<HTMLInputElement>('input[type=file]')
    input?.click()
  }

  const copyInbox = () => {
    if (!inbox) return
    navigator.clipboard.writeText(inbox)
    setCopied(true)
    toast.success('Inbox address copied')
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 h-full">
      <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
        <Upload className="h-4 w-4 text-[#ccff00]" />
        Send Rosa your data
      </h2>
      <div className="space-y-3">
        <ActionRow
          icon={<Upload className="h-4 w-4" />}
          title="Drop a document"
          hint="PDFs, images, spreadsheets. I'll classify and queue it."
          onClick={triggerFilePicker}
        />

        {managedEnabled && inbox && (
          <ActionRow
            icon={<Mail className="h-4 w-4" />}
            title="Forward an email"
            hint={
              <span className="font-mono text-xs break-all">{inbox}</span>
            }
            onClick={copyInbox}
            cta={
              copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )
            }
          />
        )}

        <ActionRow
          icon={<Inbox className="h-4 w-4" />}
          title="Open the queue"
          hint={
            openCount && openCount > 0
              ? `${openCount} ${openCount === 1 ? 'item' : 'items'} waiting your sign-off`
              : 'Items I\'ve parsed and need your confirmation'
          }
          onClick={() => onOpenQueue?.()}
          highlight={!!openCount && openCount > 0}
        />
      </div>
    </div>
  )
}

function ActionRow({
  icon,
  title,
  hint,
  onClick,
  cta,
  highlight,
}: {
  icon: React.ReactNode
  title: string
  hint: React.ReactNode
  onClick: () => void
  cta?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-left flex items-start gap-3 rounded-lg p-3 transition-colors',
        'border border-transparent hover:border-border hover:bg-muted/50',
        highlight && 'border-[#ccff00]/30 bg-[#ccff00]/[0.04]',
      )}
    >
      <span
        className={cn(
          'flex-shrink-0 rounded-md p-1.5 transition-colors',
          'bg-muted text-muted-foreground group-hover:bg-[#ccff00]/15 group-hover:text-[#ccff00]',
          highlight && 'bg-[#ccff00]/15 text-[#ccff00]',
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      {cta && <span className="flex-shrink-0">{cta}</span>}
    </button>
  )
}
