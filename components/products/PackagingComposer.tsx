"use client";

// One-line packaging composer: type a name ("330ml amber glass bottle") →
// match against the same catalogue PackagingWizard uses → add, with weight
// and material inferred and an emission factor matching in the background.
// The full card (PackagingFormCard via PackagingEditorTabs) stays reachable
// from the row's "Open the full record." link for anything the catalogue
// can't infer — this composer never grows a second row builder; it calls
// makePackagingRow/applyPackagingDefaults, the exact functions
// PackagingWizard uses (lib/products/packaging-row-builder.ts).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { StateChip } from "@/components/studio/state-chip";
import { matchPackagingText } from "@/lib/products/match-packaging-text";
import { makePackagingRow, applyPackagingDefaults } from "@/lib/products/packaging-row-builder";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { PackagingCategory } from "@/lib/types/lca";

const CATEGORY_OPTIONS: { value: PackagingCategory; label: string }[] = [
  { value: 'container', label: 'Container' },
  { value: 'closure', label: 'Closure' },
  { value: 'label', label: 'Label' },
  { value: 'secondary', label: 'Multipack' },
];

interface PackagingComposerProps {
  organizationId: string;
  /** Product unit size, used as a fallback when the typed text has no size. */
  containerSizeMl?: number | null;
  /**
   * Receives a complete row and the emission-factor search query the caller
   * should background-match — mirrors IngredientComposer's contract so both
   * composers add instantly and resolve their factor a moment later.
   */
  onAdd: (row: PackagingFormData, efSearchQuery: string) => void;
}

export function PackagingComposer({ organizationId, containerSizeMl, onAdd }: PackagingComposerProps) {
  const [typedName, setTypedName] = useState("");
  const [category, setCategory] = useState<PackagingCategory>('container');
  const [weightOverride, setWeightOverride] = useState("");

  const trimmed = typedName.trim();
  const match = category === 'container' ? matchPackagingText(trimmed, containerSizeMl) : null;
  const inferredWeight = match?.typicalWeight ? String(match.typicalWeight.medianG) : "";
  const effectiveWeight = weightOverride !== "" ? weightOverride : inferredWeight;
  const canAdd = trimmed.length > 0;

  const handleAdd = () => {
    if (!canAdd) return;

    let row: PackagingFormData;
    let efSearchQuery: string;

    if (match) {
      const weight = effectiveWeight;
      row = applyPackagingDefaults(
        makePackagingRow({
          name: match.displayName,
          packaging_category: 'container',
          net_weight_g: weight,
          amount: weight,
          unit: 'g',
          epr_is_drinks_container: true,
          container_format: match.format.key,
          container_material: match.material.key,
          container_size_ml: match.sizeMl,
          weight_source: weightOverride !== "" ? 'measured' : 'typical',
        }),
        match.material.defaults,
      );
      efSearchQuery = match.material.efSearchQuery;
    } else {
      row = makePackagingRow({
        name: trimmed,
        packaging_category: category,
        net_weight_g: weightOverride,
        amount: weightOverride,
        unit: 'g',
      });
      efSearchQuery = trimmed;
    }

    onAdd(row, efSearchQuery);
    setTypedName("");
    setWeightOverride("");
  };

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
        <div className="flex-1 min-w-0">
          <Input
            value={typedName}
            placeholder="Type a packaging item, e.g. 330ml amber glass bottle"
            onChange={(e) => setTypedName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
        </div>
        <div className="flex gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as PackagingCategory)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            step="0.1"
            placeholder={inferredWeight || "Weight (g)"}
            value={weightOverride}
            onChange={(e) => setWeightOverride(e.target.value)}
            className="w-28"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <Button type="button" onClick={handleAdd} disabled={!canAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
      {match ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StateChip tone="quiet">{match.material.label} {match.format.label.toLowerCase()}</StateChip>
          {match.typicalWeight && weightOverride === "" && (
            <StateChip tone="quiet">Typical weight, {match.typicalWeight.medianG} g</StateChip>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Describe the size and material (e.g. &quot;500ml aluminium can&quot;) and we&apos;ll infer the weight
          and material for you. Anything unusual just types the name and we&apos;ll match the emission factor.
        </p>
      )}
    </div>
  );
}
