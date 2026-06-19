'use client'

import { useEffect, useState } from 'react'
import { Upload, Inbox } from 'lucide-react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'

/**
 * "Get data into Rosa" card. Two ways to feed her:
 *   1. Drop a document (opens the same file picker the input bar uses)
 *   2. Open the queue (shortcut to the agent's pending items)
 *
 * Everything stays in the platform: upload only, no email-in.
 */
interface Props {
  onOpenQueue?: () => void
}

export function QuickActions({ onOpenQueue }: Props) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [openCount, setOpenCount] = useState<number | null>(null)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    const load = async () => {
      const exRes = await supabase
        .from('agent_exceptions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'open')
      if (cancelled) return
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
