"use client";

import { useState, useCallback, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { DistributionLeg } from "@/lib/distribution-factors";

export interface IngredientTemplateItem {
  name: string;
  matched_source_name?: string;
  data_source: string | null;
  data_source_id?: string;
  supplier_product_id?: string;
  supplier_name?: string;
  amount: number | string;
  unit: string;
  origin_country: string;
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  origin_country_code?: string;
  is_organic_certified: boolean;
  transport_mode: 'truck' | 'train' | 'ship' | 'air';
  distance_km: number | string;
  transport_legs?: DistributionLeg[] | null;
  inbound_container_type?: string | null;
  inbound_container_volume_l?: number | null;
  inbound_container_tare_kg?: number | null;
  inbound_container_reuse_cycles?: number | null;
  inbound_container_ef?: number | null;
  is_self_grown?: boolean;
  vineyard_id?: string | null;
  is_biogenic_carbon?: boolean;
}

export interface IngredientTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  source_volume_value: number | null;
  source_volume_unit: string | null;
  items: IngredientTemplateItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert an IngredientFormData to a template item, preserving supplier,
 * location, transport and container context so templates can be reused with
 * full supply-chain data. Transient UI state (tempId, cached EF metadata)
 * is intentionally dropped — it will be re-resolved on next LCA recalc.
 */
export function ingredientToTemplateItem(form: IngredientFormData): IngredientTemplateItem {
  return {
    name: form.name,
    matched_source_name: form.matched_source_name,
    data_source: form.data_source,
    data_source_id: form.data_source_id,
    supplier_product_id: form.supplier_product_id || undefined,
    supplier_name: form.supplier_name || undefined,
    amount: form.amount,
    unit: form.unit,
    origin_country: form.origin_country,
    origin_address: form.origin_address || undefined,
    origin_lat: form.origin_lat,
    origin_lng: form.origin_lng,
    origin_country_code: form.origin_country_code || undefined,
    is_organic_certified: form.is_organic_certified,
    transport_mode: form.transport_mode,
    distance_km: form.distance_km,
    transport_legs: form.transport_legs ?? null,
    inbound_container_type: form.inbound_container_type ?? null,
    inbound_container_volume_l: form.inbound_container_volume_l ?? null,
    inbound_container_tare_kg: form.inbound_container_tare_kg ?? null,
    inbound_container_reuse_cycles: form.inbound_container_reuse_cycles ?? null,
    inbound_container_ef: form.inbound_container_ef ?? null,
    is_self_grown: form.is_self_grown,
    vineyard_id: form.vineyard_id ?? null,
    is_biogenic_carbon: form.is_biogenic_carbon,
  };
}

/**
 * Scale a numeric/string amount by a dimensionless factor.
 * Returns the original value unchanged if it can't be parsed or if
 * scaleFactor is 1, so templates that don't need scaling pass through
 * with no floating-point noise.
 */
function scaleAmount(amount: number | string, scaleFactor: number): number | string {
  if (scaleFactor === 1) return amount;
  const qty = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(qty)) return amount;
  const scaled = qty * scaleFactor;
  // Round to 6 significant figures to avoid floating-point tail.
  return parseFloat(scaled.toPrecision(6));
}

/**
 * Convert a template item back to IngredientFormData with a fresh tempId.
 * When scaleFactor !== 1, the ingredient amount is multiplied by the factor
 * (transport distances and container details are volume-independent and
 * pass through unchanged).
 */
export function templateItemToIngredientForm(
  item: IngredientTemplateItem,
  scaleFactor: number = 1
): IngredientFormData {
  return {
    tempId: `temp-ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: item.name,
    matched_source_name: item.matched_source_name,
    data_source: (item.data_source as IngredientFormData['data_source']) ?? null,
    data_source_id: item.data_source_id,
    supplier_product_id: item.supplier_product_id,
    supplier_name: item.supplier_name,
    amount: scaleAmount(item.amount, scaleFactor),
    unit: item.unit,
    origin_country: item.origin_country || '',
    origin_address: item.origin_address || '',
    origin_lat: item.origin_lat,
    origin_lng: item.origin_lng,
    origin_country_code: item.origin_country_code || '',
    is_organic_certified: item.is_organic_certified,
    transport_mode: item.transport_mode || 'truck',
    distance_km: item.distance_km ?? '',
    transport_legs: item.transport_legs ?? null,
    inbound_container_type: item.inbound_container_type ?? null,
    inbound_container_volume_l: item.inbound_container_volume_l ?? null,
    inbound_container_tare_kg: item.inbound_container_tare_kg ?? null,
    inbound_container_reuse_cycles: item.inbound_container_reuse_cycles ?? null,
    inbound_container_ef: item.inbound_container_ef ?? null,
    is_self_grown: item.is_self_grown,
    vineyard_id: item.vineyard_id ?? null,
    is_biogenic_carbon: item.is_biogenic_carbon,
  };
}

export function useIngredientsTemplates(organizationId: string) {
  const [templates, setTemplates] = useState<IngredientTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("ingredients_templates")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error("Error fetching ingredients templates:", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const saveTemplate = useCallback(
    async (
      name: string,
      description: string | null,
      items: IngredientFormData[],
      sourceVolumeValue: number | null,
      sourceVolumeUnit: string | null
    ) => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const templateItems = items
        .filter((item) => item.name.trim())
        .map(ingredientToTemplateItem);

      const { error } = await supabase.from("ingredients_templates").insert({
        organization_id: organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        source_volume_value: sourceVolumeValue,
        source_volume_unit: sourceVolumeUnit,
        items: templateItems,
        created_by: user?.id || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("A template with this name already exists");
        } else {
          toast.error(error.message || "Failed to save template");
        }
        throw error;
      }

      toast.success("Ingredients template saved");
      await fetchTemplates();
    },
    [organizationId, fetchTemplates]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("ingredients_templates")
        .delete()
        .eq("id", id);

      if (error) {
        toast.error(error.message || "Failed to delete template");
        throw error;
      }

      toast.success("Template deleted");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    []
  );

  const renameTemplate = useCallback(
    async (id: string, name: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("ingredients_templates")
        .update({ name: name.trim() })
        .eq("id", id);

      if (error) {
        if (error.code === "23505") {
          toast.error("A template with this name already exists");
        } else {
          toast.error(error.message || "Failed to rename template");
        }
        throw error;
      }

      toast.success("Template renamed");
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, name: name.trim() } : t))
      );
    },
    []
  );

  const updateTemplateItems = useCallback(
    async (
      id: string,
      items: IngredientFormData[],
      sourceVolumeValue: number | null,
      sourceVolumeUnit: string | null
    ) => {
      const supabase = getSupabaseBrowserClient();
      const templateItems = items
        .filter((item) => item.name.trim())
        .map(ingredientToTemplateItem);

      const { error } = await supabase
        .from("ingredients_templates")
        .update({
          items: templateItems,
          source_volume_value: sourceVolumeValue,
          source_volume_unit: sourceVolumeUnit,
        })
        .eq("id", id);

      if (error) {
        toast.error(error.message || "Failed to update template");
        throw error;
      }

      toast.success("Template updated with current ingredients");
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                items: templateItems,
                source_volume_value: sourceVolumeValue,
                source_volume_unit: sourceVolumeUnit,
              }
            : t
        )
      );
    },
    []
  );

  return {
    templates,
    loading,
    fetchTemplates,
    saveTemplate,
    deleteTemplate,
    renameTemplate,
    updateTemplateItems,
  };
}
