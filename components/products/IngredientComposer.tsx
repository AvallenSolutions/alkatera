"use client";

// One-line ingredient composer: search → amount → unit → Add. The whole
// happy path in a single row, now that factors auto-match. The full card
// (origin, supplier, transport, stage) is for refining an existing row,
// not the price of adding one.

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
import { InlineIngredientSearch } from "@/components/lca/InlineIngredientSearch";
import { INGREDIENT_UNITS, canonicaliseUnit } from "@/lib/constants/material-units";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { MatchStatus } from "@/lib/types/lca";

interface ComposerSelection {
  name: string;
  user_query?: string;
  data_source: any;
  data_source_id?: string;
  supplier_product_id?: string;
  supplier_name?: string;
  unit: string;
  ef_reference_unit?: string;
  auto_matched?: boolean;
  carbon_intensity?: number;
  ef_source?: string;
  ef_source_type?: string;
  ef_data_quality_grade?: string;
  ef_uncertainty_percent?: number;
}

interface IngredientComposerProps {
  organizationId: string;
  /**
   * Receives a complete row. When the user picked a factor it arrives
   * verified; when they only typed a name, `needsAutoMatch` is the query the
   * caller should background-match (same flow as checklist quick-adds).
   */
  onAdd: (row: IngredientFormData, needsAutoMatch: string | null) => void;
}

let composerSeq = 0;

export function IngredientComposer({ organizationId, onAdd }: IngredientComposerProps) {
  const [typedName, setTypedName] = useState("");
  const [selection, setSelection] = useState<ComposerSelection | null>(null);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("g");
  // Remount the search input after each add to clear its internal state
  const [searchKey, setSearchKey] = useState(0);

  const displayName = selection ? (selection.user_query || selection.name) : typedName;
  const canAdd = displayName.trim().length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    const tempId = `temp-composer-${Date.now()}-${composerSeq++}`;
    const row: IngredientFormData = {
      tempId,
      name: displayName.trim(),
      data_source: selection?.data_source ?? null,
      data_source_id: selection?.data_source_id,
      supplier_product_id: selection?.supplier_product_id,
      supplier_name: selection?.supplier_name,
      matched_source_name: selection?.name,
      carbon_intensity: selection?.carbon_intensity,
      ef_source: selection?.ef_source,
      ef_source_type: selection?.ef_source_type,
      ef_data_quality_grade: selection?.ef_data_quality_grade,
      ef_uncertainty_percent: selection?.ef_uncertainty_percent,
      ef_reference_unit: selection?.ef_reference_unit,
      match_status: (selection ? 'verified' : undefined) as MatchStatus | undefined,
      amount,
      unit,
      origin_country: "",
      is_organic_certified: false,
      transport_mode: "truck",
      distance_km: "",
    };
    onAdd(row, selection ? null : displayName.trim());
    setTypedName("");
    setSelection(null);
    setAmount("");
    setUnit("g");
    setSearchKey((k) => k + 1);
  };

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
        <div className="flex-1 min-w-0">
          <InlineIngredientSearch
            key={searchKey}
            organizationId={organizationId}
            value={displayName}
            placeholder="Type an ingredient, e.g. hops"
            materialType="ingredient"
            onSelect={(sel) => {
              setSelection(sel as ComposerSelection);
              const canonical = sel.unit ? canonicaliseUnit(sel.unit) : null;
              if (canonical && INGREDIENT_UNITS.some((u) => u.value === canonical)) {
                setUnit(canonical);
              }
            }}
            onChange={(value) => {
              setTypedName(value);
              setSelection(null);
            }}
          />
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INGREDIENT_UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={handleAdd} disabled={!canAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">
        Pick a match from the list, or just type a name and we&apos;ll match it for you.
        Details like origin can be added afterwards.
      </p>
    </div>
  );
}
