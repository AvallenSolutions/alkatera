"use client";

/**
 * The fleet -- a workbench surface in the studio grammar.
 *
 * One statement (the year's fleet emissions standing right), a hairline
 * figures row for the scope split, one quiet line explaining the routing,
 * then three sections down one paper: the picture (two chart panels),
 * the vehicles (the registry) and the log (every recorded activity).
 * The old internal tab bar and icon stat cards are gone; the data
 * queries, calculations, dialogs and gating are unchanged.
 */

import { useState, useEffect } from "react";
import { useOrganization } from "@/lib/organizationContext";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { Statement } from "@/components/studio/statement";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { Panel } from "@/components/studio/panel";
import { PillButton } from "@/components/studio/pill-button";
import { FleetVehicleRegistry } from "@/components/fleet/FleetVehicleRegistry";
import { FleetActivityEntry } from "@/components/fleet/FleetActivityEntry";
import { FleetActivityTable } from "@/components/fleet/FleetActivityTable";

// Lazy-load chart component -- pulls in recharts (~200KB) only when the
// page renders, not in the shared bundle.
const FleetEmissionsChart = dynamic(
  () => import("@/components/fleet/FleetEmissionsChart").then(mod => ({ default: mod.FleetEmissionsChart })),
  { ssr: false, loading: () => <div className="h-[302px] animate-pulse rounded-[6px] bg-border/40" /> }
);

interface FleetSummary {
  totalVehicles: number;
  activeVehicles: number;
  scope1Emissions: number;
  scope2Emissions: number;
  scope3Emissions: number;
  totalEmissions: number;
}

/** A quiet section: mono eyebrow over a hairline rule, then the work. */
function Section({
  label,
  blurb,
  children,
}: {
  label: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>{label}</Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

export default function FleetPage() {
  const { currentOrganization } = useOrganization();
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActivityModal, setShowActivityModal] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchFleetSummary();
    }
  }, [currentOrganization?.id]);

  const fetchFleetSummary = async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const { data: vehicleData } = await supabase
        .from("vehicles")
        .select("id, status")
        .eq("organization_id", currentOrganization.id);

      const currentYear = new Date().getFullYear();
      const { data: emissionsData } = await supabase
        .from("fleet_activities")
        .select("scope, emissions_tco2e")
        .eq("organization_id", currentOrganization.id)
        .gte("activity_date", `${currentYear}-01-01`);

      const vehicles = vehicleData as any[] | null;
      const emissions = emissionsData as any[] | null;

      const totalVehicles = vehicles?.length || 0;
      const activeVehicles = vehicles?.filter((v) => v.status === "active").length || 0;

      let scope1 = 0;
      let scope2 = 0;
      let scope3 = 0;

      emissions?.forEach((activity) => {
        const emissionsVal = activity.emissions_tco2e || 0;
        if (activity.scope === "Scope 1") scope1 += emissionsVal;
        else if (activity.scope === "Scope 2") scope2 += emissionsVal;
        else if (activity.scope?.includes("Scope 3")) scope3 += emissionsVal;
      });

      setSummary({
        totalVehicles,
        activeVehicles,
        scope1Emissions: scope1,
        scope2Emissions: scope2,
        scope3Emissions: scope3,
        totalEmissions: scope1 + scope2 + scope3,
      });
    } catch (error) {
      console.error("Error fetching fleet summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivityAdded = () => {
    setShowActivityModal(false);
    fetchFleetSummary();
  };

  // Whole "0" for nothing recorded; decimals only once there is something.
  const fig = (value: number | undefined) =>
    loading || value === undefined ? (
      <span className="text-muted-foreground">--</span>
    ) : value === 0 ? (
      '0'
    ) : (
      value.toFixed(2)
    );

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <Statement eyebrow="THE WORKBENCH · FLEET" headline="The fleet.">
          <BigNumber
            size="display"
            label="Fleet emissions this year"
            value={
              loading || !summary ? (
                <span className="text-muted-foreground">--</span>
              ) : (
                <>
                  {summary.totalEmissions === 0 ? '0' : summary.totalEmissions.toFixed(2)}
                  <span className="ml-1 text-base font-normal text-muted-foreground">tCO2e</span>
                </>
              )
            }
          />
        </Statement>

        <PillButton variant="room" onClick={() => setShowActivityModal(true)}>
          Log activity
        </PillButton>

        {/* The figures row: the scope split and the fleet, on one hairline. */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-y border-studio-hairline py-5 lg:grid-cols-4">
          <BigNumber label="Scope 1 · fuel" value={fig(summary?.scope1Emissions)} />
          <BigNumber label="Scope 2 · EV charging" value={fig(summary?.scope2Emissions)} />
          <BigNumber label="Scope 3 Cat 6 · grey fleet" value={fig(summary?.scope3Emissions)} />
          <BigNumber
            label={summary?.activeVehicles === 1 ? "Active vehicle" : "Active vehicles"}
            value={
              loading || !summary ? (
                <span className="text-muted-foreground">--</span>
              ) : (
                summary.activeVehicles
              )
            }
          />
        </div>

        <p className="max-w-2xl text-sm text-muted-foreground">
          Company-owned and leased vehicles count in Scope 1 (fuel) and Scope 2 (EV charging);
          employee-owned and hired vehicles count in Scope 3 Category 6. Every figure uses
          official DEFRA 2025 emission factors.
        </p>
      </div>

      <Section
        label="THE PICTURE"
        blurb="This year's fleet emissions, cut by scope and by vehicle type."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FleetEmissionsChart organizationId={currentOrganization?.id} type="scope" />
          <FleetEmissionsChart organizationId={currentOrganization?.id} type="vehicle" />
        </div>
      </Section>

      <Section
        label="THE VEHICLES"
        blurb="The registered fleet. Scope is worked out from ownership and fuel."
      >
        <FeatureGate
          feature="vehicle_registry"
          fallback={
            <Panel className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                The vehicle registry is available on the Blossom and Canopy plans.
              </p>
              <PillButton variant="outline" size="sm" href="/settings/">
                View plans
              </PillButton>
            </Panel>
          }
        >
          <FleetVehicleRegistry
            organizationId={currentOrganization?.id}
            onVehicleAdded={fetchFleetSummary}
          />
        </FeatureGate>
      </Section>

      <Section
        label="THE LOG"
        blurb="Every recorded journey, fill-up and charge."
      >
        <FleetActivityTable
          organizationId={currentOrganization?.id}
          onActivityDeleted={fetchFleetSummary}
        />
      </Section>

      {showActivityModal && (
        <FleetActivityEntry
          organizationId={currentOrganization?.id}
          onClose={() => setShowActivityModal(false)}
          onSuccess={handleActivityAdded}
        />
      )}
    </div>
  );
}
