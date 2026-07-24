'use client'

/**
 * One member's section access, as a row of switches.
 *
 * Everything is ON by default — this is a feature for taking access away from
 * the few, not granting it to the many, so the dialog opens looking like the
 * status quo and each switch is a deliberate act.
 *
 * The disabled states here are a courtesy. The rules are enforced in
 * PATCH /api/team-members/[id]/section-access, which is the only door: the
 * table has no write policy, so a hand-rolled browser write is refused.
 */

import { useEffect, useState } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { RESTRICTABLE_SECTIONS, SECTION_KEYS, type SectionAccess, type SectionKey } from '@/lib/access/sections'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: { membership_id: string; user_id: string; full_name: string | null; email: string; role: string }
  /** The signed-in user's role in this org. */
  callerRole: string | null
  /** The signed-in user's own id — nobody edits their own access. */
  callerUserId: string | undefined
  /** Called after a successful change so the caller can refresh its summary. */
  onChanged?: () => void
}

export function MemberSectionAccess({
  open,
  onOpenChange,
  member,
  callerRole,
  callerUserId,
  onChanged,
}: Props) {
  const { toast } = useToast()
  const [access, setAccess] = useState<SectionAccess>({})
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState<SectionKey | null>(null)

  const isOwnerTarget = member.role === 'owner'
  const isSelf = member.user_id === callerUserId
  const adminEditingAdmin = callerRole === 'admin' && member.role === 'admin'
  const readOnly = isOwnerTarget || isSelf || adminEditingAdmin

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/team-members/${member.membership_id}/section-access`)
      .then((res) => (res.ok ? res.json() : { access: {} }))
      .then((data) => {
        if (!cancelled) {
          setAccess(data.access ?? {})
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, member.membership_id])

  const toggle = async (section: SectionKey, granted: boolean) => {
    setSaving(section)
    // Optimistic: the switch should feel like a switch.
    const previous = access[section]
    setAccess((a) => ({ ...a, [section]: granted }))
    try {
      const res = await fetch(`/api/team-members/${member.membership_id}/section-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, granted }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not save the change')
      }
      onChanged?.()
    } catch (err) {
      setAccess((a) => ({ ...a, [section]: previous }))
      toast({
        title: 'Not saved',
        description: err instanceof Error ? err.message : 'Could not save the change.',
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }

  const who = member.full_name || member.email

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What {who} can see</DialogTitle>
          <DialogDescription>
            Everything is on unless you switch it off. The rest of the platform
            stays available either way.
          </DialogDescription>
        </DialogHeader>

        {isOwnerTarget ? (
          <div className="flex items-start gap-3 rounded-[6px] border border-studio-hairline bg-studio-cream/40 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-studio-dim" />
            <p className="text-sm text-studio-dim">
              The organisation owner always has full access. That way there is
              never a door nobody in the business can open.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {isSelf && (
              <div className="mb-3 flex items-start gap-3 rounded-[6px] border border-studio-hairline bg-studio-cream/40 p-4">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-studio-dim" />
                <p className="text-sm text-studio-dim">
                  You cannot change your own access. Ask the organisation owner.
                </p>
              </div>
            )}
            {adminEditingAdmin && !isSelf && (
              <div className="mb-3 flex items-start gap-3 rounded-[6px] border border-studio-hairline bg-studio-cream/40 p-4">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-studio-dim" />
                <p className="text-sm text-studio-dim">
                  Only the organisation owner can change another
                  administrator&apos;s access.
                </p>
              </div>
            )}

            {SECTION_KEYS.map((key) => {
              const def = RESTRICTABLE_SECTIONS[key]
              const allowed = access[key] !== false
              return (
                <div
                  key={key}
                  className="flex items-start justify-between gap-6 border-b border-studio-hairline py-4 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{def.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-studio-dim">{def.blurb}</p>
                  </div>
                  <Switch
                    checked={allowed}
                    disabled={readOnly || isLoading || saving === key}
                    onCheckedChange={(next) => toggle(key, next)}
                    aria-label={`${def.label} access for ${who}`}
                  />
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
