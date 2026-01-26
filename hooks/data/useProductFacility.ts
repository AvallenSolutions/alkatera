"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export interface ProductFacilityLocation {
  id: string;
  name: string;
  address_lat: number;
  address_lng: number;
  address_line1?: string;
  address_city?: string;
  address_country?: string;
  location?: string;
  operational_control?: string;
  is_primary?: boolean;
}

interface UseProductFacilityReturn {
  facility: ProductFacilityLocation | null;
  loading: boolean;
  error: string | null;
}

/**
 * Get the primary facility assigned to a specific product.
 * Falls back to first assigned facility with coordinates if no primary is set.
 */
export function useProductFacility(
  productId: number | undefined,
  organizationId: string | undefined
): UseProductFacilityReturn {
  const [facility, setFacility] = useState<ProductFacilityLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFacility = async () => {
      if (!productId || !organizationId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseBrowserClient();

        // First try to get the primary facility for this product
        const { data: primaryData, error: primaryError } = await supabase
          .from("facility_product_allocation_matrix")
          .select("facility_id, facility_name, address_city, address_country, operational_control, primary_facility")
          .eq("product_id", productId)
          .eq("organization_id", organizationId)
          .eq("primary_facility", true)
          .maybeSingle();

        let facilityId = primaryData?.facility_id;

        // If no primary, get the first facility assigned to this product
        if (!facilityId) {
          const { data: firstData } = await supabase
            .from("facility_product_allocation_matrix")
            .select("facility_id, facility_name, address_city, address_country, operational_control, primary_facility")
            .eq("product_id", productId)
            .eq("organization_id", organizationId)
            .limit(1)
            .maybeSingle();

          facilityId = firstData?.facility_id;
        }

        if (!facilityId) {
          // No facility assigned to this product
          setFacility(null);
          setLoading(false);
          return;
        }

        // Get full facility details with coordinates
        const { data: facilityData, error: fetchError } = await supabase
          .from("facilities")
          .select("id, name, address_lat, address_lng, address_line1, address_city, address_country, location, operational_control")
          .eq("id", facilityId)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (facilityData && facilityData.address_lat && facilityData.address_lng) {
          setFacility({
            ...facilityData,
            is_primary: primaryData?.primary_facility || false,
          });
        } else {
          setFacility(null);
        }
      } catch (err: any) {
        console.error("Error fetching product facility location:", err);
        setError(err.message || "Failed to fetch product facility location");
      } finally {
        setLoading(false);
      }
    };

    fetchFacility();
  }, [productId, organizationId]);

  return { facility, loading, error };
}
