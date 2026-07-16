'use client'

/** Menus list + create, studio grammar. Each menu opens the menu editor to add items. */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useHospitalityMenus } from '@/hooks/data/useHospitalityMenus'
import { useHospitalityVenues } from '@/hooks/data/useHospitalityVenues'
import { MenuImportDialog } from '@/components/hospitality/MenuImportDialog'
import type { MenuListItem } from '@/lib/hospitality/menu-types'

const NO_VENUE = '__none__'

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits })
}

export function MenusManager() {
  const router = useRouter()
  const { menus, isLoading, error, refresh, createMenu, deleteMenu, setMenuStatus, showArchived, setShowArchived } = useHospitalityMenus()
  const { venues } = useHospitalityVenues()
  const { toast } = useToast()

  const searchParams = useSearchParams()
  const [importOpen, setImportOpen] = useState(false)
  const [stashId, setStashId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Smart Upload handoff: a photographed/exported menu was stashed and deep-linked here.
  useEffect(() => {
    if (searchParams.get('stash_kind') === 'hospitality_menu') {
      const id = searchParams.get('stash_id')
      if (id) {
        setStashId(id)
        setImportOpen(true)
      }
    }
  }, [searchParams])
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

  const toggleArchive = async (menu: MenuListItem) => {
    const next = menu.status === 'archived' ? 'active' : 'archived'
    try {
      await setMenuStatus(menu.id, next)
      toast({ title: next === 'archived' ? 'Menu archived' : 'Menu restored', description: menu.name })
    } catch (e: unknown) {
      toast({
        title: 'Could not update menu',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      })
    }
  }

  const rows: FactRowItem[] = menus.map((menu) => {
    const itemCount = `${menu.item_count} ${menu.item_count === 1 ? 'item' : 'items'}`
    const isArchived = menu.status === 'archived'
    return {
      id: String(menu.id),
      title: menu.name,
      hint: menu.venue_name ? `${menu.venue_name} · ${itemCount}` : itemCount,
      chip: isArchived
        ? { tone: 'quiet' as const, label: 'Archived' }
        : menu.avg_co2e != null
          ? undefined
          : { tone: 'quiet' as const, label: 'No calculated items' },
      value: menu.avg_co2e != null ? fmt(menu.avg_co2e) : undefined,
      unit: menu.avg_co2e != null ? 'KG CO₂E AVG / COVER' : undefined,
      href: `/hospitality/menus/${menu.id}`,
      trailing: (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={isArchived ? `Restore ${menu.name}` : `Archive ${menu.name}`}
            className="rounded px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleArchive(menu)
            }}
          >
            {isArchived ? 'Restore' : 'Archive'}
          </button>
          <button
            type="button"
            aria-label={`Remove ${menu.name}`}
            className="rounded px-2 py-1 text-base leading-none text-muted-foreground transition-colors duration-150 hover:text-studio-stale"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setPendingDelete(menu)
            }}
          >
            &times;
          </button>
        </span>
      ),
    }
  })

  return (
    <div className="space-y-8">
      <div className="min-w-0">
        <Statement eyebrow="THE WORKBENCH · MENUS" headline="The menus.">
          <BigNumber size="display" value={menus.length} label={menus.length === 1 ? 'Menu' : 'Menus'} />
          <div className="flex items-center gap-2">
            <PillButton variant="outline" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </PillButton>
            <PillButton variant="outline" onClick={() => setImportOpen(true)}>
              Import from menu
            </PillButton>
            <PillButton variant="room" onClick={openCreate}>
              New menu
            </PillButton>
          </div>
        </Statement>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Collect meals and drinks into a menu and see its average impact per cover.
        </p>
      </div>

      {error && <p className="text-sm text-studio-stale">{error}</p>}

      {isLoading ? (
        <div className="space-y-3 border-t border-border pt-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-[6px]" />
          ))}
        </div>
      ) : menus.length === 0 ? (
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            No menus yet. Create a menu, then add meals, drinks and your own wines to it.
          </p>
          <PillButton variant="room" className="mt-4" onClick={openCreate}>
            New menu
          </PillButton>
        </div>
      ) : (
        <FactList items={rows} className="border-t border-border" />
      )}

      <MenuImportDialog
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o)
          if (!o) setStashId(null)
        }}
        initialStashId={stashId}
        onStashConsumed={() => {
          // Clear the deep-link params so a refresh doesn't re-trigger the import.
          router.replace('/hospitality/menus')
        }}
        onComplete={({ menuId }) => {
          if (menuId) router.push(`/hospitality/menus/${menuId}`)
          else refresh()
        }}
      />

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
