"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Loader2, Lock } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { PageLoader } from "@/components/ui/page-loader";
import { OperationsEnergyCard } from "@/components/reports/OperationsEnergyCard";
import { ProductsSupplyChainCard } from "@/components/reports/ProductsSupplyChainCard";
import { BusinessTravelCard } from "@/components/reports/BusinessTravelCard";
import { ServicesOverheadCard } from "@/components/reports/ServicesOverheadCard";
import { TeamCommutingCard } from "@/components/reports/TeamCommutingCard";
import { CapitalGoodsCard } from "@/components/reports/CapitalGoodsCard";
import { LogisticsDistributionCard } from "@/components/reports/LogisticsDistributionCard";
import { OperationalWasteCard } from "@/components/reports/OperationalWasteCard";
import { CompanyFleetCard } from "@/components/reports/CompanyFleetCard";
import { MarketingMaterialsCard } from "@/components/reports/MarketingMaterialsCard";
import { FootprintSummaryDashboard } from "@/components/reports/FootprintSummaryDashboard";
import { useScope3Emissions } from "@/hooks/data/useScope3Emissions";
import { toast } from "sonner";

interface CorporateReport {
  id: string;
  year: number;
  status: string;
  total_emissions: number;
  breakdown_json: any;
  created_at: string;
  updated_at: string;
}

interface OverheadEntry {
  id: string;
  category: string;
  description: string;
  spend_amount: number;
  currency: string;
  entry_date: string;
  computed_co2e: number;
  fte_count?: number;
  asset_type?: string;
  transport_mode?: string;
  distance_km?: number;
  weight_kg?: number;
  material_type?: string;
  disposal_method?: string;
}

export default function FootprintBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { currentOrganization } = useOrganization();

  const year = parseInt(params.year as string);

  const [report, setReport] = useState<CorporateReport | null>(null);
  const [overheads, setOverheads] = useState<OverheadEntry[]>([]);
  const [operationsCO2e, setOperationsCO2e] = useState(0);
  const [scope1CO2e, setScope1CO2e] = useState(0);
  const [scope2CO2e, setScope2CO2e] = useState(0);
  const [fleetCO2e, setFleetCO2e] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Use the shared Scope 3 hook
  const { scope3Emissions, isLoading: isLoadingScope3, refetch: refetchScope3 } = useScope3Emissions(
    currentOrganization?.id,
    year
  );

  useEffect(() => {
    if (currentOrganization?.id && year) {
      fetchReportData();
    }
  }, [currentOrganization?.id, year]);

  const fetchReportData = async () => {
    if (!currentOrganization?.id) return;

    try {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();

      // Fetch report
      const { data: reportData, error: reportError } = await supabase
        .from("corporate_reports")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .eq("year", year)
        .maybeSingle();

      if (reportError) throw reportError;

      if (!reportData) {
        // Create draft report if it doesn't exist
        const { data: newReport, error: createError } = await supabase
          .from("corporate_reports")
          .insert({
            organization_id: currentOrganization.id,
            year,
            status: "Draft",
            total_emissions: 0,
            breakdown_json: {},
          })
          .select()
          .single();

        if (createError) throw createError;
        setReport(newReport);
      } else {
        setReport(reportData);

        // Fetch overheads
        const { data: overheadData, error: overheadError } = await supabase
          .from("corporate_overheads")
          .select("*")
          .eq("report_id", reportData.id)
          .order("created_at", { ascending: false });

        if (overheadError) throw overheadError;
        setOverheads(overheadData || []);
      }

      // Fetch operations emissions (Scope 1 & 2)
      await fetchOperationsEmissions();

      // Fetch fleet emissions (Scope 1 & 2)
      await fetchFleetEmissions();

      // Refetch Scope 3 emissions
      await refetchScope3();
    } catch (error: any) {
      console.error("Error fetching report data:", error);
      toast.error("Failed to load footprint data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOperationsEmissions = async () => {
    if (!currentOrganization?.id) return;

    try {
      const supabase = getSupabaseBrowserClient();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      // Fetch Scope 1 and 2 separately to avoid mixing them
      const { data: scope1Data, error: scope1Error } = await supabase
        .from("calculated_emissions")
        .select("total_co2e")
        .eq("organization_id", currentOrganization.id)
        .gte("date", yearStart)
        .lte("date", yearEnd)
        .eq("scope", 1);

      if (scope1Error) throw scope1Error;

      const { data: scope2Data, error: scope2Error } = await supabase
        .from("calculated_emissions")
        .select("total_co2e")
        .eq("organization_id", currentOrganization.id)
        .gte("date", yearStart)
        .lte("date", yearEnd)
        .eq("scope", 2);

      if (scope2Error) throw scope2Error;

      const scope1Total = scope1Data?.reduce((sum, item) => sum + (item.total_co2e || 0), 0) || 0;
      const scope2Total = scope2Data?.reduce((sum, item) => sum + (item.total_co2e || 0), 0) || 0;

      setScope1CO2e(scope1Total);
      setScope2CO2e(scope2Total);
      setOperationsCO2e(scope1Total + scope2Total);
    } catch (error: any) {
      console.error("Error fetching operations emissions:", error);
    }
  };


  const fetchFleetEmissions = async () => {
    if (!currentOrganization?.id) return;

    try {
      const supabase = getSupabaseBrowserClient();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const { data, error } = await supabase
        .from("fleet_activities")
        .select("emissions_tco2e")
        .eq("organization_id", currentOrganization.id)
        .gte("activity_date", yearStart)
        .lte("activity_date", yearEnd);

      if (error) throw error;

      const total = data?.reduce((sum, item) => sum + (item.emissions_tco2e || 0), 0) || 0;
      setFleetCO2e(total);
    } catch (error: any) {
      console.error("Error fetching fleet emissions:", error);
    }
  };

  const handleGenerateReport = async () => {
    if (!report || !currentOrganization?.id) return;

    setIsGenerating(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-ccf-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          year,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate report");
      }

      const data = await response.json();
      toast.success("Footprint calculated successfully!");
      fetchReportData();
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast.error(error.message || "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <PageLoader message="Loading footprint builder..." />;
  }

  if (!report) {
    return <div>Report not found</div>;
  }

  const travelEntries = overheads.filter((o) => o.category === "business_travel");
  const serviceEntries = overheads.filter((o) => o.category === "purchased_services" && !o.material_type);
  const marketingEntries = overheads.filter((o) => o.category === "purchased_services" && o.material_type);
  const commutingEntry = overheads.find((o) => o.category === "employee_commuting");
  const fteCount = commutingEntry?.fte_count || 0;
  const capitalGoodsEntries = overheads.filter((o) => o.category === "capital_goods") as any[];
  const logisticsEntries = overheads.filter((o) => o.category === "downstream_logistics") as any[];
  const wasteEntries = overheads.filter((o) => o.category === "operational_waste") as any[];

  // Use the total from the shared hook
  const scope3TotalCO2e = scope3Emissions.total;

  // CRITICAL: Calculate LIVE totals from real-time data to ensure accuracy
  // Fleet emissions are Scope 1 (mobile combustion), so add to Scope 1 total
  const liveScope1Total = scope1CO2e + fleetCO2e;
  const liveScope2Total = scope2CO2e;
  const liveScope3Total = scope3TotalCO2e;

  // Calculate the actual live total emissions
  const liveTotalEmissions = liveScope1Total + liveScope2Total + liveScope3Total;

  const canGenerate = true; // Always allow generation

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {year} Company Footprint
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build your annual greenhouse gas inventory
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {report.status === "Finalized" ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200">
              <Lock className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
          <Button onClick={handleGenerateReport} disabled={!canGenerate || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Activity Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Card 1: Operations & Energy */}
        <OperationsEnergyCard totalCO2e={operationsCO2e} year={year} />

        {/* Card 2: Scope 3 - All Categories */}
        <ProductsSupplyChainCard
          totalCO2e={scope3TotalCO2e}
          productsCO2e={scope3Emissions.products}
          year={year}
          report={report}
          isLoading={isLoadingScope3}
        />

        {/* Card 3: Company Fleet & Vehicles */}
        <CompanyFleetCard totalCO2e={fleetCO2e} year={year} />

        {/* Card 4: Business Travel */}
        {report && (
          <BusinessTravelCard reportId={report.id} entries={travelEntries} onUpdate={fetchReportData} />
        )}

        {/* Card 5: Marketing Materials & Merchandise */}
        {report && (
          <MarketingMaterialsCard reportId={report.id} entries={marketingEntries} onUpdate={fetchReportData} />
        )}

        {/* Card 6: Services & Overhead */}
        {report && (
          <ServicesOverheadCard reportId={report.id} entries={serviceEntries} onUpdate={fetchReportData} />
        )}

        {/* Card 7: Team & Commuting */}
        {report && (
          <TeamCommutingCard reportId={report.id} initialFteCount={fteCount} onUpdate={fetchReportData} />
        )}

        {/* Card 8: Capital Goods & Assets */}
        {report && (
          <CapitalGoodsCard reportId={report.id} entries={capitalGoodsEntries} onUpdate={fetchReportData} />
        )}

        {/* Card 9: Logistics & Distribution */}
        {report && currentOrganization && (
          <LogisticsDistributionCard
            reportId={report.id}
            organizationId={currentOrganization.id}
            year={year}
            entries={logisticsEntries}
            onUpdate={fetchReportData}
          />
        )}

        {/* Card 10: Operational Waste */}
        {report && (
          <OperationalWasteCard reportId={report.id} entries={wasteEntries} onUpdate={fetchReportData} />
        )}
      </div>

      {/* Summary Dashboard */}
      <FootprintSummaryDashboard
        totalEmissions={liveTotalEmissions}
        scope1Emissions={liveScope1Total}
        scope2Emissions={liveScope2Total}
        scope3Emissions={liveScope3Total}
        scope3Breakdown={{
          products: scope3Emissions.products,
          business_travel: scope3Emissions.business_travel,
          purchased_services: scope3Emissions.purchased_services,
          employee_commuting: scope3Emissions.employee_commuting,
          capital_goods: scope3Emissions.capital_goods,
          downstream_logistics: scope3Emissions.downstream_logistics,
          operational_waste: scope3Emissions.operational_waste,
          marketing_materials: scope3Emissions.marketing_materials,
        }}
        operationsEmissions={operationsCO2e}
        fleetEmissions={fleetCO2e}
        year={year}
        lastUpdated={report.updated_at}
        status={report.status}
      />
    </div>
  );
}
