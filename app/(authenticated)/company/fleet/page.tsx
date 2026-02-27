"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Car,
  Zap,
  Fuel,
  Plus,
  TrendingDown,
  Truck,
  Users,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { useOrganization } from "@/lib/organizationContext";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { FleetOverviewCards } from "@/components/fleet/FleetOverviewCards";
import { FleetVehicleRegistry } from "@/components/fleet/FleetVehicleRegistry";
import { FleetActivityEntry } from "@/components/fleet/FleetActivityEntry";
import { FleetActivityTable } from "@/components/fleet/FleetActivityTable";

// Lazy-load chart component — pulls in recharts (~200KB) only when the
// Analytics tab is viewed, not on initial fleet page load.
const FleetEmissionsChart = dynamic(
  () => import("@/components/fleet/FleetEmissionsChart").then(mod => ({ default: mod.FleetEmissionsChart })),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> }
);

interface FleetSummary {
  totalVehicles: number;
  activeVehicles: number;
  scope1Emissions: number;
  scope2Emissions: number;
  scope3Emissions: number;
  totalEmissions: number;
}

export default function FleetPage() {
  const { currentOrganization } = useOrganization();
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fleet Management</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage vehicle emissions across Scope 1, 2, and 3
          </p>
        </div>
        <Button onClick={() => setShowActivityModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Log Fleet Activity
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emissions</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.totalEmissions.toFixed(2)} tCO2e
                </div>
                <p className="text-xs text-muted-foreground">Current year</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scope 1</CardTitle>
            <Fuel className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.scope1Emissions.toFixed(2)} tCO2e
                </div>
                <p className="text-xs text-muted-foreground">Direct combustion</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scope 2</CardTitle>
            <Zap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.scope2Emissions.toFixed(2)} tCO2e
                </div>
                <p className="text-xs text-muted-foreground">EV charging</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scope 3 Cat 6</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.scope3Emissions.toFixed(2)} tCO2e
                </div>
                <p className="text-xs text-muted-foreground">Grey fleet / business travel</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicle Registry</TabsTrigger>
          <TabsTrigger value="activities">Activity Log</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <FleetOverviewCards />
          <div className="grid gap-4 md:grid-cols-2">
            <FleetEmissionsChart organizationId={currentOrganization?.id} />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scope Assignment Guide</CardTitle>
                <CardDescription>
                  How vehicle emissions are automatically categorised
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-0.5">Scope 1</Badge>
                  <div>
                    <p className="font-medium">Company-owned ICE vehicles</p>
                    <p className="text-sm text-muted-foreground">
                      Diesel, petrol, LPG vehicles owned or leased by the company
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">Scope 2</Badge>
                  <div>
                    <p className="font-medium">Company-owned EVs</p>
                    <p className="text-sm text-muted-foreground">
                      Electric vehicles charged using grid electricity
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">Scope 3</Badge>
                  <div>
                    <p className="font-medium">Grey Fleet / Employee vehicles</p>
                    <p className="text-sm text-muted-foreground">
                      Employee-owned vehicles used for business purposes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vehicles">
          <FeatureGate
            feature="vehicle_registry"
            fallback={
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Vehicle Registry</h3>
                  <p className="text-muted-foreground mb-4">
                    Upgrade to Blossom or Canopy to access the vehicle registry feature
                  </p>
                  <Button variant="outline">View Plans</Button>
                </CardContent>
              </Card>
            }
          >
            <FleetVehicleRegistry
              organizationId={currentOrganization?.id}
              onVehicleAdded={fetchFleetSummary}
            />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="activities">
          <FleetActivityTable
            organizationId={currentOrganization?.id}
            onActivityDeleted={fetchFleetSummary}
          />
        </TabsContent>

        <TabsContent value="reporting">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Emissions by Scope
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FleetEmissionsChart organizationId={currentOrganization?.id} type="scope" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Emissions by Vehicle Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FleetEmissionsChart organizationId={currentOrganization?.id} type="vehicle" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

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
