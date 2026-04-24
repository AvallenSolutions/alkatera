'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'

interface Ingredient {
  id: string
  name: string
  unit: string | null
}

interface UnlinkedXero {
  id: string
  transactionDate: string
  supplierName: string
  description: string
  amount: number
  currency: string
  emissionCategory: string
  spendBasedEmissionsKg: number
}

interface XeroInventoryLinkerProps {
  open: boolean
  xeroRow: UnlinkedXero | null
  ingredients: Ingredient[]
  onClose: () => void
  onLinked: () => void
}

const UNIT_OPTIONS = ['kg', 'g', 'litres', 'ml', 'bottles', 'cans', 'units', 'cases']

export function XeroInventoryLinker({
  open, xeroRow, ingredients, onClose, onLinked,
}: XeroInventoryLinkerProps) {
  const [ingredientId, setIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [quantityUnit, setQuantityUnit] = useState('units')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!xeroRow || !ingredientId || !quantity) return
    const q = Number(quantity)
    if (!Number.isFinite(q) || q <= 0) {
      toast.error('Quantity must be a positive number')
      return
    }

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/emissions/material-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          xeroTransactionId: xeroRow.id,
          ingredientId,
          quantity: q,
          quantityUnit,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to link')
      toast.success('Linked. Emission will now book to the consumption period.')
      // Reset and close
      setIngredientId('')
      setQuantity('')
      setQuantityUnit('units')
      setNotes('')
      onLinked()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to link')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Link spend to inventory
          </DialogTitle>
          <DialogDescription>
            Tell us which ingredient this spend stocks, and how much. Emissions
            will book to the production period they&apos;re actually consumed in,
            not the purchase date.
          </DialogDescription>
        </DialogHeader>

        {xeroRow && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="font-medium">{xeroRow.supplierName}</div>
            <div className="text-muted-foreground text-xs">{xeroRow.description}</div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{new Date(xeroRow.transactionDate).toLocaleDateString('en-GB')}</span>
              <span>
                {xeroRow.currency} {xeroRow.amount.toFixed(2)}
                {xeroRow.spendBasedEmissionsKg > 0 && (
                  <span className="ml-2">
                    · {(xeroRow.spendBasedEmissionsKg / 1000).toFixed(3)} tCO₂e (spend-based)
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ingredient</Label>
            <Select value={ingredientId} onValueChange={setIngredientId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick an ingredient..." />
              </SelectTrigger>
              <SelectContent>
                {ingredients.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No ingredients yet. Add one from the Products page first.
                  </div>
                ) : (
                  ingredients.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div className="space-y-1.5">
              <Label>Quantity received</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 10000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={quantityUnit} onValueChange={setQuantityUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. '10,000 × 750ml bottles'"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !ingredientId || !quantity}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Link to inventory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
