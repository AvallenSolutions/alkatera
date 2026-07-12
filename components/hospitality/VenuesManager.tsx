'use client'

/**
 * Venues management surface for the Hospitality module: studio grammar.
 * One statement, quiet fact rows for the venues, create / edit / delete intact.
 */

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Statement } from '@/components/studio/statement'
import { BigNumber } from '@/components/studio/big-number'
import { PillButton } from '@/components/studio/pill-button'
import { FactList, type FactRowItem } from '@/components/studio/fact-list'
import { useToast } from '@/hooks/use-toast'
import { useHospitalityVenues } from '@/hooks/data/useHospitalityVenues'
import {
  VENUE_TYPES,
  venueTypeLabel,
  type HospitalityVenue,
} from '@/lib/hospitality/venue-types'

export function VenuesManager() {
  const { venues, isLoading, error, createVenue, updateVenue, deleteVenue } =
    useHospitalityVenues()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HospitalityVenue | null>(null)
  const [pendingDelete, setPendingDelete] = useState<HospitalityVenue | null>(null)

  const [name, setName] = useState('')
  const [venueType, setVenueType] = useState<string>('restaurant')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setVenueType('restaurant')
    setDescription('')
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (venue: HospitalityVenue) => {
    setEditing(venue)
    setName(venue.name)
    setVenueType(venue.venue_type)
    setDescription(venue.description ?? '')
    setFormError(null)
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!name.trim()) {
      setFormError('Give the venue a name.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        name: name.trim(),
        venue_type: venueType,
        description: description.trim() || null,
      }
      if (editing) {
        await updateVenue(editing.id, payload)
        toast({ title: 'Venue updated', description: name.trim() })
      } else {
        await createVenue(payload)
        toast({ title: 'Venue added', description: name.trim() })
      }
      setDialogOpen(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteVenue(pendingDelete.id)
      toast({ title: 'Venue removed', description: pendingDelete.name })
    } catch (e: unknown) {
      toast({
        title: 'Could not remove venue',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setPendingDelete(null)
    }
  }

  const rows: FactRowItem[] = venues.map((venue) => ({
    id: venue.id,
    title: venue.name,
    hint: venue.description ?? undefined,
    meta: venueTypeLabel(venue.venue_type),
    trailing: (
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="rounded px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
          onClick={() => openEdit(venue)}
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={`Remove ${venue.name}`}
          className="rounded px-2 py-1 text-base leading-none text-muted-foreground transition-colors duration-150 hover:text-studio-stale"
          onClick={() => setPendingDelete(venue)}
        >
          &times;
        </button>
      </span>
    ),
  }))

  return (
    <div className="space-y-8">
      <div className="min-w-0">
        <Statement eyebrow="THE WORKBENCH · VENUES" headline="The venues.">
          <BigNumber size="display" value={venues.length} label={venues.length === 1 ? 'Venue' : 'Venues'} />
          <PillButton variant="room" onClick={openCreate}>
            Add venue
          </PillButton>
        </Statement>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Your restaurants, bars and accommodation. Each venue anchors its own impact reporting.
        </p>
      </div>

      {error && <p className="text-sm text-studio-stale">{error}</p>}

      {isLoading ? (
        <div className="space-y-3 border-t border-border pt-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-[6px]" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            No venues yet. Add your first restaurant, bar or accommodation to get started.
          </p>
          <PillButton variant="room" className="mt-4" onClick={openCreate}>
            Add venue
          </PillButton>
        </div>
      ) : (
        <FactList items={rows} className="border-t border-border" />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit venue' : 'Add a venue'}</DialogTitle>
            <DialogDescription>
              A venue is a restaurant, bar or accommodation that belongs to your organisation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="venue-name">Venue name</Label>
              <Input
                id="venue-name"
                placeholder="The Cellar Door Restaurant"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="venue-type">Type</Label>
              <Select value={venueType} onValueChange={setVenueType}>
                <SelectTrigger id="venue-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="venue-desc">Notes (optional)</Label>
              <Textarea
                id="venue-desc"
                placeholder="Anything useful about this venue."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save changes' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this venue?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name}" will be removed. This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
