'use client'

/** Menus list + create. Each menu opens the menu editor to add items. */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, BookOpen, Trash2, Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useHospitalityMenus } from '@/hooks/data/useHospitalityMenus'
import { useHospitalityVenues } from '@/hooks/data/useHospitalityVenues'
import type { MenuListItem } from '@/lib/hospitality/menu-types'

const NO_VENUE = '__none__'

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits })
}

export function MenusManager() {
  const router = useRouter()
  const { menus, isLoading, error, createMenu, deleteMenu } = useHospitalityMenus()
  const { venues } = useHospitalityVenues()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [venueId, setVenueId] = useState<string>(NO_VENUE)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MenuListItem | null>(null)

  const openCreate = () => {
    setName('')
    setVenueId(NO_VENUE)
    setFormError(null)
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!name.trim()) {
      setFormError('Give the menu a name.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const menu = await createMenu({ name: name.trim(), venue_id: venueId === NO_VENUE ? null : venueId })
      setDialogOpen(false)
      router.push(`/hospitality/menus/${menu.id}`)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Could not create menu')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteMenu(pendingDelete.id)
      toast({ title: 'Menu removed', description: pendingDelete.name })
    } catch (e: unknown) {
      toast({
        title: 'Could not remove menu',
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
          <h2 className="text-lg font-semibold">Menus</h2>
          <p className="text-sm text-muted-foreground">
            Collect meals and drinks into a menu and see its average impact per cover.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New menu
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : menus.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No menus yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Create a menu, then add meals, drinks and your own wines to it.
          </p>
          <Button onClick={openCreate} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            New menu
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {menus.map((menu) => (
            <div
              key={menu.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/hospitality/menus/${menu.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') router.push(`/hospitality/menus/${menu.id}`)
              }}
              className="group flex cursor-pointer flex-col rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{menu.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPendingDelete(menu)
                  }}
                  aria-label="Delete menu"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {menu.venue_name && <Badge variant="secondary">{menu.venue_name}</Badge>}
                <Badge variant="outline">
                  {menu.item_count} {menu.item_count === 1 ? 'item' : 'items'}
                </Badge>
              </div>
              <div className="mt-3">
                {menu.avg_co2e != null ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Leaf className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{fmt(menu.avg_co2e)} kg CO₂e</span>
                    <span className="text-muted-foreground">avg / cover</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No calculated items yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New menu</DialogTitle>
            <DialogDescription>Name the menu and optionally tie it to a venue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="menu-name">Menu name</Label>
              <Input
                id="menu-name"
                placeholder="Autumn dinner menu"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="menu-venue">Venue (optional)</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger id="menu-venue">
                  <SelectValue placeholder="No venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VENUE}>No venue</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create menu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this menu?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `"${pendingDelete.name}" will be removed. The meals and drinks themselves are not deleted.` : ''}
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
