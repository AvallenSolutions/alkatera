'use client'

/**
 * Modal form for registering a new nature-positive action.
 * Visibility defaults to 'private'. Status defaults to 'in_progress'.
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NATURE_ACTION_TYPES } from '@/lib/nature-actions/action-types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function NatureActionCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('')
  const [actionType, setActionType] = useState<string>('regenerative_agriculture')
  const [hectares, setHectares] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [partnerUrl, setPartnerUrl] = useState('')
  const [location, setLocation] = useState('')
  const [contractStarted, setContractStarted] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setActionType('regenerative_agriculture')
    setHectares('')
    setPartnerName('')
    setPartnerUrl('')
    setLocation('')
    setContractStarted('')
    setDescription('')
    setError(null)
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('Give it a name (e.g. "Cairngorms peatland project").')
      return
    }
    const ha = Number(hectares)
    if (!Number.isFinite(ha) || ha < 0) {
      setError('Hectares must be a non-negative number.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/nature-actions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          action_type: actionType,
          hectares: ha,
          partner_name: partnerName.trim() || null,
          partner_url: partnerUrl.trim() || null,
          location: location.trim() || null,
          contract_started: contractStarted || null,
          description: description.trim() || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json?.error ?? 'Could not save')
        return
      }
      reset()
      onCreated()
    } catch (e: any) {
      setError(e?.message ?? 'Could not save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a nature-positive action</DialogTitle>
          <DialogDescription>
            Register a regenerative-ag, restoration, or habitat-creation partnership. Hectares now,
            log activity over time later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="na-name">Action name</Label>
            <Input
              id="na-name"
              placeholder="Cairngorms peatland restoration"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="na-type">Type</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger id="na-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATURE_ACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="mr-2">{t.emoji}</span>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="na-ha">Hectares</Label>
              <Input
                id="na-ha"
                type="number"
                inputMode="decimal"
                placeholder="50"
                value={hectares}
                onChange={(e) => setHectares(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="na-since">Since (optional)</Label>
              <Input
                id="na-since"
                type="date"
                value={contractStarted}
                onChange={(e) => setContractStarted(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="na-partner">Partner (optional)</Label>
            <Input
              id="na-partner"
              placeholder="Cairngorms National Park Authority"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="na-url">Partner link (optional)</Label>
            <Input
              id="na-url"
              placeholder="https://"
              value={partnerUrl}
              onChange={(e) => setPartnerUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="na-location">Location (optional)</Label>
            <Input
              id="na-location"
              placeholder="Speyside, Scotland"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="na-desc">Notes (optional)</Label>
            <Textarea
              id="na-desc"
              placeholder="What's the story? What does the partner do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
