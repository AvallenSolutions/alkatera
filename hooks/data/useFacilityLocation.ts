"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export interface FacilityLocation {
  id: string;
  name: string;
  address_lat: number;
  address_lng: number;
  address_line1?: string;
  address_city?: string;
  address_country?: string;
  location?: string;
}

interface UseFacilityLocationReturn {
  facility: FacilityLocation | null;
  loading: boolean;
  error: string | null;
}

export function useFacilityLocation(organizationId: string | undefined): UseFacilityLocationReturn {
  const [facility, setFacility] = useState<FacilityLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFacility = async () => {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseBrowserClient();

        const { data, error: fetchError } = await supabase
          .from("facilities")
          .select("id, name, address_lat, address_lng, address_line1, address_city, address_country, location")
          .eq("organization_id", organizationId)
          .not("address_lat", "is", null)
          .not("address_lng", "is", null)
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        setFacility(data);
      } catch (err: any) {
        console.error("Error fetching facility location:", err);
        setError(err.message || "Failed to fetch facility location");
      } finally {
        setLoading(false);
      }
    };

    fetchFacility();
  }, [organizationId]);

  return { facility, loading, error };
}
