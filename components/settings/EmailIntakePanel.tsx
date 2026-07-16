'use client'

import { useState, useEffect, useCallback } from 'react'
import { Panel, Eyebrow, StateChip } from '@/components/studio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check, Mail, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'

interface EmailIntakeState {
  address: string
  allowlist: string[]
  live: boolean
}

/**
 * "Email documents straight in" — the settings surface for the org's
 * intake+{token}@alkatera.com address (data-revolution-plan.md Pillar 1).
 *
 * Always shows the address (the token generates lazily on first view, via
 * GET /api/organization/email-intake) — the poller simply isn't live until
 * EMAIL_INTAKE_HOST/USER/PASSWORD are set, which the `live` flag reflects
 * as a quiet chip rather than hiding the panel. Confirmed senders (people
 * outside the org whose forwarded documents should still be accepted) are
 * a one-line-at-a-time list, editable by an owner or admin.
 */
export function EmailIntakePanel() {
  const { currentOrganization, userRole } = useOrganization()
  const canManage = userRole === 'owner' || userRole === 'admin'

  const [state, setState] = useState<EmailIntakeState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const authHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }, [])

  const fetchState = useCallback(async () => {
    if (!currentOrganization?.id) return
    try {
      setIsLoading(true)
      const headers = await authHeader()
      const res = await fetch(`/api/organization/email-intake?organizationId=${currentOrganization.id}`, { headers })
      if (res.ok) {
        setState(await res.json())
      }
    } catch (err) {
      console.error('Failed to load email intake address:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentOrganization?.id, authHeader])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  async function handleCopy() {
    if (!state?.address) return
    await navigator.clipboard.writeText(state.address)
    setCopied(true)
    toast.success('Address copied')
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveAllowlist(next: string[]) {
    if (!currentOrganization?.id || !state) return
    setIsSaving(true)
    try {
      const headers = await authHeader()
      const res = await fetch('/api/organization/email-intake', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: currentOrganization.id, allowlist: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save')
      }
      const body = await res.json()
      setState({ ...state, allowlist: body.allowlist ?? next })
      setNewAddress('')
    } catch (err: any) {
      toast.error(err?.message || 'Could not save confirmed senders')
    } finally {
      setIsSaving(false)
    }
  }

  function handleAddSender() {
    const trimmed = newAddress.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      toast.error('Enter a full email address')
      return
    }
    if (state?.allowlist.includes(trimmed)) {
      setNewAddress('')
      return
    }
    saveAllowlist([...(state?.allowlist ?? []), trimmed])
  }

  function handleRemoveSender(email: string) {
    saveAllowlist((state?.allowlist ?? []).filter((e) => e !== email))
  }

  if (isLoading || !state) {
    return (
      <Panel className="space-y-2">
        <Eyebrow tone="dim">Email intake</Eyebrow>
        <p className="text-sm text-studio-dim">Loading your intake address…</p>
      </Panel>
    )
  }

  return (
    <Panel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Eyebrow tone="dim">Email documents straight in</Eyebrow>
          <p className="text-sm text-studio-dim">
            Forward bills and supplier documents; they arrive in your uploads.
          </p>
        </div>
        <StateChip tone={state.live ? 'good' : 'quiet'}>{state.live ? 'Live' : 'Coming soon'}</StateChip>
      </div>

      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-studio-dim shrink-0" />
        <Input readOnly value={state.address} className="font-mono text-sm" />
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      {canManage && (
        <div className="space-y-2 pt-2 border-t border-studio-hairline">
          <p className="text-xs text-studio-dim">
            Confirmed senders. Documents only arrive from an alka<strong>tera</strong> team member or
            an address you add here, such as a bookkeeper or supplier.
          </p>
          <div className="space-y-1.5">
            {state.allowlist.length === 0 && (
              <p className="text-xs text-studio-dim italic">No confirmed senders added yet.</p>
            )}
            {state.allowlist.map((email) => (
              <div key={email} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-mono">{email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => handleRemoveSender(email)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="name@supplier.com"
              className="text-sm"
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddSender()
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleAddSender} disabled={isSaving}>
              Add
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}
