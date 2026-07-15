"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  MultipackSecondaryPackagingForm,
  type SecondaryPackagingItem,
} from "@/components/products/MultipackSecondaryPackagingForm";
import {
  fetchMultipackPackagingMaterials,
  insertMultipackPackaging,
  updateMultipackPackaging,
  deleteMultipackPackaging,
  type MultipackPackagingInput,
} from "@/lib/multipacks";

interface MultipackPackagingSectionProps {
  /** The multipack product being edited. */
  productId: string;
  /**
   * Kept for parity with MultipackContentsEditor and future use (e.g. a shared
   * staleness banner); not currently read.
   */
  organizationId?: string;
}

// Legacy multipack packaging rows (created before we persisted the user's
// material choice into container_material) only carry the derived
// epr_material_type. Map it back to a form option so a cardboard box doesn't
// render as "Other".
const EPR_TO_FORM_MATERIAL: Record<string, string> = {
  paper_cardboard: "cardboard",
  plastic_rigid: "plastic_rigid",
  plastic_flexible: "plastic_film",
  plastic_film: "plastic_film",
  wood: "wood",
  steel: "metal",
  aluminium: "metal",
};

/** DB packaging row -> the form's editable item shape. */
function rowToItem(row: any): SecondaryPackagingItem {
  const category = ["shipment", "secondary", "tertiary"].includes(row.packaging_category)
    ? (row.packaging_category as SecondaryPackagingItem["packaging_category"])
    : "shipment";
  return {
    id: String(row.id),
    material_name: row.material_name || "",
    // We store the user's material choice in container_material on create/update;
    // fall back to the EPR-derived type for legacy rows that predate that.
    material_type:
      row.container_material || EPR_TO_FORM_MATERIAL[row.epr_material_type] || "other",
    packaging_category: category,
    weight_grams: Number(row.net_weight_g) || 0,
    // Recyclability is stored all-or-nothing (100/0) from this mini editor.
    is_recyclable: Number(row.recyclability_percent) > 0,
    recycled_content_percentage: Number(row.recycled_content_percentage) || 0,
    notes: row.notes || "",
  };
}

/** Drop the id — the helpers rebuild the row from these fields. */
function itemToInput(item: SecondaryPackagingItem): MultipackPackagingInput {
  return {
    material_name: item.material_name,
    material_type: item.material_type,
    packaging_category: item.packaging_category,
    weight_grams: item.weight_grams,
    is_recyclable: item.is_recyclable,
    recycled_content_percentage: item.recycled_content_percentage,
    notes: item.notes,
  };
}

function sameItem(a: SecondaryPackagingItem, b: SecondaryPackagingItem): boolean {
  return (
    a.material_name === b.material_name &&
    a.material_type === b.material_type &&
    a.packaging_category === b.packaging_category &&
    a.weight_grams === b.weight_grams &&
    a.is_recyclable === b.is_recyclable &&
    a.recycled_content_percentage === b.recycled_content_percentage &&
    a.notes === b.notes
  );
}

/**
 * Post-creation editor for a multipack's OWN transit/grouping packaging (its
 * shipper box, shrink wrap, pallet...). These live on product_materials as
 * ordinary packaging rows on the multipack product, so this reads and writes
 * the same rows the CREATE flow, the LCA calculator and EPR use — the pack's
 * packaging finally becomes editable and visible after creation, not just at
 * creation time.
 */
export function MultipackPackagingSection({
  productId,
}: MultipackPackagingSectionProps) {
  const [items, setItems] = useState<SecondaryPackagingItem[]>([]);
  // The last-saved snapshot, to diff against on save.
  const [original, setOriginal] = useState<SecondaryPackagingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await fetchMultipackPackagingMaterials(productId);
      const mapped = rows.map(rowToItem);
      setItems(mapped);
      setOriginal(mapped);
    } catch (error) {
      console.error("Error loading multipack packaging:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not load multipack packaging",
      );
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const originalById = new Map(original.map((o) => [o.id, o]));
  const currentIds = new Set(items.map((i) => i.id));
  const removedIds = original.filter((o) => !currentIds.has(o.id)).map((o) => o.id);
  const toInsert = items.filter((i) => i.id.startsWith("temp-"));
  const toUpdate = items.filter((i) => {
    if (i.id.startsWith("temp-")) return false;
    const prev = originalById.get(i.id);
    return prev ? !sameItem(prev, i) : false;
  });
  const isDirty = removedIds.length > 0 || toInsert.length > 0 || toUpdate.length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await deleteMultipackPackaging(removedIds);
      for (const item of toUpdate) {
        await updateMultipackPackaging(item.id, itemToInput(item), productId);
      }
      if (toInsert.length > 0) {
        await insertMultipackPackaging(productId, toInsert.map(itemToInput));
      }
      // Reload so we hold canonical rows + real ids for the next diff.
      await load();
      toast.success("Multipack packaging saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save multipack packaging",
      );
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading packaging...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* No staleness banner here: the MultipackContentsEditor above already
          renders one for the whole Specification tab, so a second identical
          banner would just be noise. Saving still writes to product_materials,
          which the tab's banner reflects on reload. */}
      <MultipackSecondaryPackagingForm
        packagingItems={items}
        onPackagingChange={setItems}
        disabled={saving}
      />

      <div className="flex items-center justify-end gap-3">
        {isDirty && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
        <Button onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save packaging
        </Button>
      </div>
    </div>
  );
}
