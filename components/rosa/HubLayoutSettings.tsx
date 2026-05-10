'use client'

import { useState } from 'react'
import { Settings2, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { trackRosa } from '@/lib/rosa/track'
import {
  HUB_CARD_IDS,
  HUB_CARD_LABELS,
  useHubLayout,
  type HubCardId,
} from '@/lib/rosa/useHubLayout'

/**
 * Light-touch hub customisation: per-user visibility toggles for each
 * card on /rosa/. The hero greeting can't be hidden (it's the always-on
 * entry point + holds these settings).
 *
 * Reorder is intentionally out of scope for v1 — visibility alone covers
 * 80% of the value without the drag-and-drop cost.
 */
export function HubLayoutSettings() {
  const [open, setOpen] = useState(false)
  const { layout, toggleCard, reset, isLoading } = useHubLayout()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Customise hub"
          title="Customise hub"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customise your hub</DialogTitle>
          <DialogDescription>
            Hide cards you don&apos;t use. Your changes are private to you and saved
            instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-1">
          {HUB_CARD_IDS.map((id: HubCardId) => {
            const card = layout.find(c => c.id === id)
            const visible = card?.visible ?? true
            return (
              <label
                key={id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/40 cursor-pointer"
              >
                <span className="text-sm">{HUB_CARD_LABELS[id]}</span>
                <Switch
                  checked={visible}
                  disabled={isLoading}
                  onCheckedChange={next => {
                    toggleCard(id)
                    trackRosa('hub.layout_toggled', { card_id: id, visible: next })
                  }}
                  aria-label={`Show ${HUB_CARD_LABELS[id]}`}
                />
              </label>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            The hero greeting is always shown.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset()
              trackRosa('hub.layout_reset', {})
            }}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
