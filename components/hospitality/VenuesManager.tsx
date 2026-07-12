'use client'

/**
 * Venues management surface for the Hospitality module.
 * Lists an organisation's venues and provides create / edit / delete.
 */

import { useState } from 'react'
import { Plus, Store, Pencil, Trash2, UtensilsCrossed, Wine, BedDouble, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { useToast } from '@/hooks/use-toast'
import { useHospitalityVenues } from '@/hooks/data/useHospitalityVenues'
import {
  VENUE_TYPES,
  venueTypeLabel,
  type HospitalityVenue,
  type VenueType,
} from '@/lib/hospitality/venue-types'

const VENUE_ICON: Record<VenueType, typeof Store> = {
  restaurant: UtensilsCrossed,
  bar: Wine,
  accommodation: BedDouble,
  events: PartyPopper,
}

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Venues</h2>
          <p className="text-sm text-muted-foreground">
            Your restaurants, bars and accommodation. Each venue anchors its own impact reporting.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add venue
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Store className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No venues yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Add your first restaurant, bar or accommodation to get started.
          </p>
          <Button onClick={openCreate} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add venue
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => {
            const Icon = VENUE_ICON[venue.venue_type] ?? Store
            return (
              <div
                key={venue.id}
                className="group flex flex-col rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{venue.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(venue)}
                      aria-label="Edit venue"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setPendingDelete(venue)}
                      aria-label="Delete venue"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <Badge variant="secondary">{venueTypeLabel(venue.venue_type)}</Badge>
                </div>
                {venue.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{venue.description}</p>
                )}
              </div>
            )
          })}
        </div>
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
