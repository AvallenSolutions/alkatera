import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  contact_name: string | null;
  website: string | null;
  industry_sector: string | null;
  country: string | null;
  annual_spend: number | null;
  spend_currency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierEngagement {
  id: string;
  supplier_id: string;
  status: "invited" | "active" | "data_provided" | "inactive";
  invited_date: string | null;
  accepted_date: string | null;
  data_submitted_date: string | null;
  last_contact_date: string | null;
  data_quality_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierWithEngagement extends Supplier {
  engagement_status?: string;
  product_count?: number;
  engagement?: SupplierEngagement;
}

export function useSuppliers(organizationId: string | undefined) {
  const [suppliers, setSuppliers] = useState<SupplierWithEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (suppliersError) throw suppliersError;

      // Batch fetch engagements and product counts to avoid N+1 queries
      const supplierIds = (suppliersData || []).map(s => s.id);

      const [{ data: allEngagements }, { data: productCounts }] = await Promise.all([
        supabase
          .from("supplier_engagements")
          .select("*")
          .in("supplier_id", supplierIds),
        supabase
          .from("supplier_products")
          .select("supplier_id")
          .in("supplier_id", supplierIds),
      ]);

      const engagementMap = new Map(
        (allEngagements || []).map(e => [e.supplier_id, e])
      );
      const productCountMap = new Map<string, number>();
      for (const p of (productCounts || [])) {
        productCountMap.set(p.supplier_id, (productCountMap.get(p.supplier_id) || 0) + 1);
      }

      const suppliersWithEngagement = (suppliersData || []).map(supplier => {
        const engagement = engagementMap.get(supplier.id);
        return {
          ...supplier,
          engagement_status: engagement?.status || "no_engagement",
          product_count: productCountMap.get(supplier.id) || 0,
          engagement: engagement || undefined,
        };
      });

      setSuppliers(suppliersWithEngagement);
    } catch (err: any) {
      console.error("Error fetching suppliers:", err);
      setError(err.message || "Failed to load suppliers");
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [organizationId]);

  return {
    suppliers,
    loading,
    error,
    refetch: fetchSuppliers,
  };
}

export function useSupplier(supplierId: string | undefined) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [engagement, setEngagement] = useState<SupplierEngagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSupplier = async () => {
    if (!supplierId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: supplierData, error: supplierError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", supplierId)
        .maybeSingle();

      if (supplierError) throw supplierError;
      if (!supplierData) {
        throw new Error("Supplier not found");
      }

      setSupplier(supplierData);

      const { data: engagementData } = await supabase
        .from("supplier_engagements")
        .select("*")
        .eq("supplier_id", supplierId)
        .maybeSingle();

      setEngagement(engagementData);
    } catch (err: any) {
      console.error("Error fetching supplier:", err);
      setError(err.message || "Failed to load supplier");
      toast.error(err.message || "Failed to load supplier");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplier();
  }, [supplierId]);

  return {
    supplier,
    engagement,
    loading,
    error,
    refetch: fetchSupplier,
  };
}
