'use client'

/**
 * Modal form for registering a new byproduct.
 * Visibility defaults to 'private' per locked product preference.
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
import { BYPRODUCT_DESTINATION_TYPES } from '@/lib/byproducts/destination-types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function ByproductCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('')
  const [destinationType, setDestinationType] = useState<string>('animal_feed')
  const [partnerName, setPartnerName] = useState('')
  const [partnerUrl, setPartnerUrl] = useState('')
  const [contractStarted, setContractStarted] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setDestinationType('animal_feed')
    setPartnerName('')
    setPartnerUrl('')
    setContractStarted('')
    setDescription('')
    setError(null)
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('Give it a name (e.g. "Spent grain").')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/byproducts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          destination_type: destinationType,
          partner_name: partnerName.trim() || null,
          partner_url: partnerUrl.trim() || null,
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
          <DialogTitle>Add a byproduct</DialogTitle>
          <DialogDescription>
            Register a co-product stream and where it goes. Mass logs come later — start with the partnership.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bp-name">Byproduct name</Label>
            <Input
              id="bp-name"
              placeholder="Spent grain"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bp-dest">Destination</Label>
            <Select value={destinationType} onValueChange={setDestinationType}>
              <SelectTrigger id="bp-dest">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BYPRODUCT_DESTINATION_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    <span className="mr-2">{d.emoji}</span>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bp-partner">Partner (optional)</Label>
              <Input
                id="bp-partner"
                placeholder="Smith Farms"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bp-since">Since (optional)</Label>
              <Input
                id="bp-since"
                type="date"
                value={contractStarted}
                onChange={(e) => setContractStarted(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bp-url">Partner link (optional)</Label>
            <Input
              id="bp-url"
              placeholder="https://"
              value={partnerUrl}
              onChange={(e) => setPartnerUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bp-desc">Notes (optional)</Label>
            <Textarea
              id="bp-desc"
              placeholder="What is it, what does the partner do with it?"
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
