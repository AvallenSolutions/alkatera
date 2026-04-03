import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import type { SupplierProduct } from "@/lib/types/supplier-product";
import type { SupplierEsgAssessment } from "@/lib/types/supplier-esg";

// supabase client is still needed for the organization_suppliers_view query
// (which has its own RLS allowing brand users to read their own org's suppliers)

/**
 * Brand-side read-only supplier detail hook.
 *
 * Accepts an `organization_suppliers.id` (the ID that the list page passes via
 * the URL) and resolves the full chain:
 *
 *   organization_suppliers_view (by id)
 *     -> contact_email
 *       -> suppliers (by contact_email match)
 *         -> supplier_products (by supplier_id)
 *         -> supplier_esg_assessments (by supplier_id)
 *
 * When the supplier has joined the platform, we merge the richer data from
 * the `suppliers` table (logo, address, phone, etc.) over the stub data
 * in `platform_suppliers`.
 *
 * Returns read-only data only. No write operations.
 */

export interface SupplierProfile {
  /** organization_suppliers.id (the URL param) */
  orgSupplierId: string;
  name: string;
  country: string | null;
  website: string | null;
  contact_email: string | null;
  contact_name: string | null;
  industry_sector: string | null;
  description: string | null;
  logo_url: string | null;
  is_verified: boolean;
  /** Rich fields from suppliers table (when supplier has joined) */
  address: string | null;
  city: string | null;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  catalogue_url: string | null;
}

export interface BrandRelationship {
  annual_spend: number | null;
  spend_currency: string | null;
  relationship_type: string | null;
  engagement_status: string | null;
  notes: string | null;
  added_at: string | null;
}

export interface OrganizationSupplierDetail {
  supplierProfile: SupplierProfile | null;
  brandRelationship: BrandRelationship | null;
  /** The suppliers.id if the supplier has joined the platform. Null if not yet joined. */
  resolvedSupplierId: string | null;
  products: SupplierProduct[];
  esgAssessment: SupplierEsgAssessment | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrganizationSupplierDetail(
  orgSupplierId: string | undefined
): OrganizationSupplierDetail {
  const [supplierProfile, setSupplierProfile] = useState<SupplierProfile | null>(null);
  const [brandRelationship, setBrandRelationship] = useState<BrandRelationship | null>(null);
  const [resolvedSupplierId, setResolvedSupplierId] = useState<string | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [esgAssessment, setEsgAssessment] = useState<SupplierEsgAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!orgSupplierId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Fetch from organization_suppliers_view using the URL param ID
      const { data: viewData, error: viewError } = await supabase
        .from("organization_suppliers_view")
        .select("*")
        .eq("id", orgSupplierId)
        .maybeSingle();

      if (viewError) throw viewError;
      if (!viewData) {
        throw new Error("Supplier not found in your organisation");
      }

      // Build the brand relationship from the org_suppliers fields
      setBrandRelationship({
        annual_spend: viewData.annual_spend,
        spend_currency: viewData.spend_currency,
        relationship_type: viewData.relationship_type,
        engagement_status: viewData.engagement_status,
        notes: viewData.notes,
        added_at: viewData.added_at,
      });

      // Step 2: Fetch the supplier's full data (profile, products, ESG)
      // via the server-side detail API. The suppliers, supplier_products,
      // and supplier_esg_assessments tables are all RLS-protected to the
      // supplier's own org, so brand users can't read them directly.
      let supplierId: string | null = null;
      let supplierRecord: any = null;
      let fetchedProducts: SupplierProduct[] = [];
      let fetchedEsg: SupplierEsgAssessment | null = null;

      if (viewData.contact_email) {
        try {
          const browserClient = getSupabaseBrowserClient();
          const { data: sessionData } = await browserClient.auth.getSession();
          const token = sessionData?.session?.access_token;

          if (token) {
            const res = await fetch("/api/suppliers/detail", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ email: viewData.contact_email }),
            });

            if (res.ok) {
              const detail = await res.json();
              if (detail.supplier) {
                supplierId = detail.supplier.supplier_id;
                supplierRecord = detail.supplier;
                fetchedProducts = detail.products || [];
                fetchedEsg = detail.esg_assessment || null;
              }
            }
          }
        } catch (enrichErr) {
          console.warn("Could not resolve supplier by email:", enrichErr);
        }
      }

      setResolvedSupplierId(supplierId);
      setProducts(fetchedProducts);
      setEsgAssessment(fetchedEsg);

      // Build the profile: prefer suppliers table data (supplier-managed)
      // over platform_suppliers data (invite stub). Use a simple "first
      // non-null" merge so the supplier's own data always wins.
      const pick = <T,>(supplierVal: T | null | undefined, platformVal: T | null | undefined): T | null =>
        (supplierVal != null ? supplierVal : platformVal ?? null) as T | null;

      setSupplierProfile({
        orgSupplierId: viewData.id,
        name: pick(supplierRecord?.name, viewData.supplier_name) || "Unknown Supplier",
        country: pick(supplierRecord?.country, viewData.country),
        website: pick(supplierRecord?.website, viewData.website),
        contact_email: pick(supplierRecord?.contact_email, viewData.contact_email),
        contact_name: pick(supplierRecord?.contact_name, viewData.contact_name),
        industry_sector: pick(supplierRecord?.industry_sector, viewData.industry_sector),
        description: pick(supplierRecord?.description, viewData.description),
        logo_url: pick(supplierRecord?.logo_url, viewData.logo_url),
        is_verified: viewData.is_verified ?? false,
        // Rich fields only available from suppliers table
        address: supplierRecord?.address ?? null,
        city: supplierRecord?.city ?? null,
        country_code: supplierRecord?.country_code ?? null,
        lat: supplierRecord?.lat != null ? Number(supplierRecord.lat) : null,
        lng: supplierRecord?.lng != null ? Number(supplierRecord.lng) : null,
        phone: supplierRecord?.phone ?? null,
        catalogue_url: supplierRecord?.catalogue_url ?? null,
      });
    } catch (err: any) {
      console.error("Error fetching supplier detail:", err);
      setError(err.message || "Failed to load supplier details");
      toast.error(err.message || "Failed to load supplier details");
    } finally {
      setLoading(false);
    }
  }, [orgSupplierId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    supplierProfile,
    brandRelationship,
    resolvedSupplierId,
    products,
    esgAssessment,
    loading,
    error,
    refetch: fetchDetail,
  };
}
