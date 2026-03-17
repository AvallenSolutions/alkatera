"use client";

import { useState, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";

export interface PackagingTemplateItem {
  name: string;
  matched_source_name?: string;
  data_source: string | null;
  data_source_id?: string;
  supplier_product_id?: string;
  supplier_name?: string;
  amount: number | string;
  unit: string;
  packaging_category: string | null;
  net_weight_g: number | string;
  recycled_content_percentage: number | string;
  printing_process: string;
  origin_country?: string;
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  origin_country_code?: string;
  transport_mode?: string;
  distance_km?: number | string;
  has_component_breakdown: boolean;
  components: any[];
  epr_packaging_level?: string;
  epr_packaging_activity?: string;
  epr_is_household: boolean;
  epr_ram_rating?: string;
  epr_uk_nation?: string;
  epr_is_drinks_container: boolean;
  units_per_group: number | string;
}

export interface PackagingTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  items: PackagingTemplateItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert a PackagingFormData to a template item, preserving supplier location
 * and origin data so templates can be reused with full supply chain context.
 */
export function packagingToTemplateItem(form: PackagingFormData): PackagingTemplateItem {
  return {
    name: form.name,
    matched_source_name: form.matched_source_name,
    data_source: form.data_source,
    data_source_id: form.data_source_id,
    supplier_product_id: form.supplier_product_id || undefined,
    supplier_name: form.supplier_name || undefined,
    amount: form.amount,
    unit: form.unit,
    packaging_category: form.packaging_category,
    net_weight_g: form.net_weight_g,
    recycled_content_percentage: form.recycled_content_percentage,
    printing_process: form.printing_process,
    origin_country: form.origin_country || undefined,
    origin_address: form.origin_address || undefined,
    origin_lat: form.origin_lat,
    origin_lng: form.origin_lng,
    origin_country_code: form.origin_country_code || undefined,
    transport_mode: form.transport_mode || undefined,
    distance_km: form.distance_km || undefined,
    has_component_breakdown: form.has_component_breakdown,
    components: form.components || [],
    epr_packaging_level: form.epr_packaging_level,
    epr_packaging_activity: form.epr_packaging_activity,
    epr_is_household: form.epr_is_household,
    epr_ram_rating: form.epr_ram_rating,
    epr_uk_nation: form.epr_uk_nation,
    epr_is_drinks_container: form.epr_is_drinks_container,
    units_per_group: form.units_per_group,
  };
}

/**
 * Convert a template item back to a PackagingFormData with fresh tempId.
 * Restores supplier location and origin data if saved in the template.
 */
export function templateItemToPackagingForm(item: PackagingTemplateItem): PackagingFormData {
  return {
    tempId: `temp-pkg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: item.name,
    matched_source_name: item.matched_source_name,
    data_source: item.data_source as any,
    data_source_id: item.data_source_id,
    supplier_product_id: item.supplier_product_id,
    supplier_name: item.supplier_name,
    amount: item.amount,
    unit: item.unit,
    packaging_category: item.packaging_category as any,
    net_weight_g: item.net_weight_g,
    recycled_content_percentage: item.recycled_content_percentage,
    printing_process: item.printing_process,
    origin_country: item.origin_country || '',
    origin_address: item.origin_address || '',
    origin_lat: item.origin_lat,
    origin_lng: item.origin_lng,
    origin_country_code: item.origin_country_code || '',
    transport_mode: (item.transport_mode as any) || 'truck',
    distance_km: item.distance_km || '',
    has_component_breakdown: item.has_component_breakdown,
    components: item.components || [],
    epr_packaging_level: item.epr_packaging_level as any,
    epr_packaging_activity: item.epr_packaging_activity as any,
    epr_is_household: item.epr_is_household,
    epr_ram_rating: item.epr_ram_rating as any,
    epr_uk_nation: item.epr_uk_nation as any,
    epr_is_drinks_container: item.epr_is_drinks_container,
    units_per_group: item.units_per_group,
  };
}

export function usePackagingTemplates(organizationId: string) {
  const [templates, setTemplates] = useState<PackagingTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("packaging_templates")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      console.error("Error fetching packaging templates:", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const saveTemplate = useCallback(
    async (name: string, description: string | null, items: PackagingFormData[]) => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const templateItems = items
        .filter((item) => item.name.trim())
        .map(packagingToTemplateItem);

      const { error } = await supabase.from("packaging_templates").insert({
        organization_id: organizationId,
        name: name.trim(),
        description: description?.trim() || null,
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

      toast.success("Packaging template saved");
      await fetchTemplates();
    },
    [organizationId, fetchTemplates]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("packaging_templates")
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
        .from("packaging_templates")
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

  return {
    templates,
    loading,
    fetchTemplates,
    saveTemplate,
    deleteTemplate,
    renameTemplate,
  };
}
