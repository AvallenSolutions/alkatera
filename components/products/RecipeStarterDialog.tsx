"use client";

// "Start from a typical recipe": pick a drink style, see the typical
// ingredient list scaled to this product's size, add the lot in one click.
// Every amount is a mid-range starting point and every row arrives
// auto-matched + flagged for review — editing a plausible recipe instead of
// authoring from a blank page.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import {
  RECIPE_STARTERS,
  startersForCategory,
  scaleStarterAmount,
  type RecipeStarter,
} from "@/lib/constants/recipe-starters";

interface RecipeStarterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productCategory?: string | null;
  unitSizeMl?: number | null;
  onApply: (starter: RecipeStarter) => void;
}

export function RecipeStarterDialog({
  open,
  onOpenChange,
  productCategory,
  unitSizeMl,
  onApply,
}: RecipeStarterDialogProps) {
  const ordered = startersForCategory(productCategory);
  const [selectedKey, setSelectedKey] = useState<string>(ordered[0]?.key ?? RECIPE_STARTERS[0].key);
  const selected = RECIPE_STARTERS.find((s) => s.key === selectedKey) ?? RECIPE_STARTERS[0];
  const sizeLabel = unitSizeMl && unitSizeMl > 0
    ? (unitSizeMl >= 1000 ? `${unitSizeMl / 1000} litre` : `${unitSizeMl} ml`)
    : '1 litre';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start from a typical recipe</DialogTitle>
          <DialogDescription>
            Pick the closest style. We add the usual ingredients with matching
            emission factors, scaled to your {sizeLabel} product. Every amount
            is a typical starting point for you to adjust.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {ordered.map((s) => (
            <Button
              key={s.key}
              type="button"
              variant={selectedKey === s.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedKey(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">{selected.description}</p>
          {selected.ingredients.map((ing) => (
            <div key={ing.name} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{ing.name}</span>
                {ing.note && (
                  <p className="text-[11px] text-muted-foreground">{ing.note}</p>
                )}
              </div>
              <Badge variant="secondary" className="shrink-0">
                {scaleStarterAmount(ing.amountPerLitre, unitSizeMl)} {ing.unit}
              </Badge>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(selected);
              onOpenChange(false);
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Add these ingredients
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
