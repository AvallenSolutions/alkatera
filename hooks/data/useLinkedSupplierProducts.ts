import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { SupplierProduct } from "@/lib/types/supplier-product";

export interface LinkedSupplierProduct extends SupplierProduct {
  supplier_name: string;
}

/**
 * Fetches all active supplier products from suppliers linked to the
 * brand's organisation. Uses the service-role API to bypass RLS.
 *
 * Results are cached for the component's lifetime (refetch manually if needed).
 */
export function useLinkedSupplierProducts(organizationId: string | undefined) {
  const [products, setProducts] = useState<LinkedSupplierProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError(null);

      const browserClient = getSupabaseBrowserClient();
      const { data: sessionData } = await browserClient.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setError("Not authenticated");
        return;
      }

      const res = await fetch("/api/suppliers/linked-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ organization_id: organizationId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch linked supplier products");
      }

      const data = await res.json();
      setProducts(data.products || []);
    } catch (err: any) {
      console.error("Error fetching linked supplier products:", err);
      setError(err.message || "Failed to load supplier products");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}
