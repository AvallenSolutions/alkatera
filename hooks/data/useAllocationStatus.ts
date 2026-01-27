import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface AllocationStatus {
  hasProvisionalAllocations: boolean;
  provisionalCount: number;
  verifiedCount: number;
  totalAllocatedEmissions: number;
  loading: boolean;
  error: string | null;
}

export function useAllocationStatus(productId: number | null): AllocationStatus {
  const [status, setStatus] = useState<AllocationStatus>({
    hasProvisionalAllocations: false,
    provisionalCount: 0,
    verifiedCount: 0,
    totalAllocatedEmissions: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!productId) {
      setStatus((prev) => ({ ...prev, loading: false }));
      return;
    }

    const fetchStatus = async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        // Fetch contract manufacturer allocations
        const { data: cmData, error: cmError } = await supabase
          .from("contract_manufacturer_allocations")
          .select("status, is_energy_intensive_process, allocated_emissions_kg_co2e")
          .eq("product_id", productId);

        if (cmError) throw cmError;

        // Fetch owned facility allocations via production sites
        const { data: ownedData, error: ownedError } = await supabase
          .from("facility_product_allocation_matrix")
          .select("has_allocations, latest_allocation")
          .eq("product_id", productId);

        if (ownedError) {
          console.warn("Failed to fetch owned allocations:", ownedError);
        }

        const cmAllocations = cmData || [];
        const ownedAllocations = (ownedData || []).filter((a: any) => a.has_allocations);

        const provisional = [
          ...cmAllocations.filter(
            (a) => a.status === "provisional" || a.is_energy_intensive_process
          ),
          ...ownedAllocations.filter(
            (a: any) => a.latest_allocation?.status === "provisional"
          ),
        ];
        const verified = [
          ...cmAllocations.filter(
            (a) => a.status === "verified" || a.status === "approved"
          ),
          ...ownedAllocations.filter(
            (a: any) => a.latest_allocation?.status === "verified" || a.latest_allocation?.status === "approved"
          ),
        ];
        const totalEmissions =
          cmAllocations.reduce(
            (sum, a) => sum + (a.allocated_emissions_kg_co2e || 0),
            0
          ) +
          ownedAllocations.reduce(
            (sum: number, a: any) => sum + (a.latest_allocation?.allocated_emissions || 0),
            0
          );

        setStatus({
          hasProvisionalAllocations: provisional.length > 0,
          provisionalCount: provisional.length,
          verifiedCount: verified.length,
          totalAllocatedEmissions: totalEmissions,
          loading: false,
          error: null,
        });
      } catch (error: any) {
        console.error("Error fetching allocation status:", error);
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }));
      }
    };

    fetchStatus();
  }, [productId]);

  return status;
}

export function useOrganizationAllocationStatus(organizationId: string | null) {
  const [status, setStatus] = useState({
    provisionalCount: 0,
    verifiedCount: 0,
    approvedCount: 0,
    loading: true,
    error: null as string | null,
  });

  useEffect(() => {
    if (!organizationId) {
      setStatus((prev) => ({ ...prev, loading: false }));
      return;
    }

    const fetchStatus = async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        const { data, error } = await supabase
          .from("contract_manufacturer_allocations")
          .select("status")
          .eq("organization_id", organizationId);

        if (error) throw error;

        const allocations = data || [];

        setStatus({
          provisionalCount: allocations.filter((a) => a.status === "provisional").length,
          verifiedCount: allocations.filter((a) => a.status === "verified").length,
          approvedCount: allocations.filter((a) => a.status === "approved").length,
          loading: false,
          error: null,
        });
      } catch (error: any) {
        console.error("Error fetching organization allocation status:", error);
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }));
      }
    };

    fetchStatus();
  }, [organizationId]);

  return status;
}
