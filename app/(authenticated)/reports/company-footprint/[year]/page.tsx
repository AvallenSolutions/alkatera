"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Factory,
  FileText,
  Leaf,
  Loader2,
  Lock,
  Package,
  Sparkles,
} from "lucide-react";
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
import { FootprintHeroSummary } from "@/components/reports/FootprintHeroSummary";
import { FootprintProgressBanner } from "@/components/reports/FootprintProgressBanner";
// New GHG Protocol Scope 3 category cards
import { UpstreamTransportCard } from "@/components/reports/UpstreamTransportCard";
import { DownstreamTransportCard } from "@/components/reports/DownstreamTransportCard";
import { UsePhaseCard } from "@/components/reports/UsePhaseCard";
import { useScope3Emissions } from "@/hooks/data/useScope3Emissions";
import { calculateScope1, calculateScope2 } from "@/lib/calculations/corporate-emissions";
import { calculateDataCompleteness } from "@/lib/calculations/footprint-completeness";
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

      // Fetch fleet emissions (for CompanyFleetCard display)
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

      // Use the single source of truth calculation functions from corporate-emissions.ts
      // These calculate live from utility_data_entries + fleet_activities,
      // including ALL facilities (owned + 3rd party) assigned to the organization.
      const [scope1Total, scope2Total] = await Promise.all([
        calculateScope1(supabase, currentOrganization.id, yearStart, yearEnd),
        calculateScope2(supabase, currentOrganization.id, yearStart, yearEnd),
      ]);

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
      toast.success("Report finalised successfully!");
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

  // =========================================================================
  // Derived data
  // =========================================================================

  const travelEntries = overheads.filter((o) => o.category === "business_travel");
  const serviceEntries = overheads.filter((o) => o.category === "purchased_services" && !o.material_type);
  const marketingEntries = overheads.filter((o) => o.category === "purchased_services" && o.material_type);
  const commutingEntry = overheads.find((o) => o.category === "employee_commuting");
  const fteCount = commutingEntry?.fte_count || 0;
  const capitalGoodsEntries = overheads.filter((o) => o.category === "capital_goods") as any[];
  const logisticsEntries = overheads.filter((o) => o.category === "downstream_logistics") as any[];
  const wasteEntries = overheads.filter((o) => o.category === "operational_waste") as any[];
  const upstreamTransportEntries = overheads.filter((o) => o.category === "upstream_transport") as any[];
  const downstreamTransportEntries = overheads.filter((o) => o.category === "downstream_transport") as any[];
  const usePhaseEntries = overheads.filter((o) => o.category === "use_phase") as any[];

  // Use the total from the shared hook
  const scope3TotalCO2e = scope3Emissions.total;

  // CRITICAL: Calculate LIVE totals from real-time data to ensure accuracy
  // Note: calculateScope1/calculateScope2 from corporate-emissions.ts already include
  // fleet emissions (Scope 1 fleet + Scope 2 fleet respectively), so DO NOT add fleetCO2e again.
  // fleetCO2e is kept separately only for the CompanyFleetCard display.
  const liveScope1Total = scope1CO2e;
  const liveScope2Total = scope2CO2e;
  const liveScope3Total = scope3TotalCO2e;
  const liveTotalEmissions = liveScope1Total + liveScope2Total + liveScope3Total;

  const scope3Breakdown = {
    products: scope3Emissions.products,
    business_travel: scope3Emissions.business_travel,
    purchased_services: scope3Emissions.purchased_services,
    employee_commuting: scope3Emissions.employee_commuting,
    capital_goods: scope3Emissions.capital_goods,
    downstream_logistics: scope3Emissions.downstream_logistics,
    operational_waste: scope3Emissions.operational_waste,
    marketing_materials: scope3Emissions.marketing_materials,
    upstream_transport: scope3Emissions.upstream_transport,
    downstream_transport: scope3Emissions.downstream_transport,
    use_phase: scope3Emissions.use_phase,
  };

  // Data completeness
  const completeness = calculateDataCompleteness({
    operationsEmissions: operationsCO2e,
    fleetEmissions: fleetCO2e,
    scope3Breakdown,
  });

  // Scope 3 completeness for the accordion trigger
  const scope3Categories = completeness.categories.filter(c => c.scope === 3 && !c.isComingSoon);
  const scope3CompletedCount = scope3Categories.filter(c => c.hasData).length;

  // Format emissions helper
  const formatEmissions = (value: number): string => {
    if (value >= 1000) return `${(value / 1000).toFixed(2)} kt`;
    return `${value.toFixed(2)} t`;
  };

  const isFinalized = report.status === "Finalized";

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* Header                                                            */}
      {/* ================================================================= */}
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
          {isFinalized ? (
            <Button variant="outline" onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </>
              )}
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={handleGenerateReport}
                      disabled={isGenerating || completeness.score < 50}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Finalising...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Finalise Report
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {completeness.score < 50 && (
                  <TooltipContent>
                    <p>Add more data to finalise (currently {completeness.score}% complete)</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* Hero Summary                                                      */}
      {/* ================================================================= */}
      <FootprintHeroSummary
        totalEmissions={liveTotalEmissions}
        scope1Emissions={liveScope1Total}
        scope2Emissions={liveScope2Total}
        scope3Emissions={liveScope3Total}
        dataCompletenessScore={completeness.score}
        year={year}
        status={report.status}
        lastUpdated={report.updated_at}
      />

      {/* ================================================================= */}
      {/* Progress Banner                                                   */}
      {/* ================================================================= */}
      <FootprintProgressBanner
        categories={completeness.categories}
        completedCount={completeness.completedCount}
        totalCount={completeness.totalCount}
        score={completeness.score}
        firstIncompleteCategory={completeness.firstIncompleteCategory}
      />

      {/* ================================================================= */}
      {/* Scope-Grouped Activity Cards (Accordion)                          */}
      {/* ================================================================= */}
      <Accordion type="multiple" defaultValue={["scope12", "scope3"]} className="space-y-3">

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* Scope 1 & 2: Direct & Energy Emissions                        */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <AccordionItem value="scope12" className="border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/50 [&>svg]:ml-auto">
            <span className="flex items-center gap-3 flex-1">
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-blue-500/20">
                <Factory className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </span>
              <span className="flex flex-col items-start">
                <span className="font-semibold text-sm">Scope 1 & 2 — Direct & Energy Emissions</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {formatEmissions(liveScope1Total + liveScope2Total)} CO₂e from operations & fleet
                </span>
              </span>
              {(liveScope1Total + liveScope2Total) > 0 && (
                <Badge variant="outline" className="ml-auto mr-2 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  2 sources
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <OperationsEnergyCard totalCO2e={operationsCO2e} year={year} />
              <CompanyFleetCard totalCO2e={fleetCO2e} year={year} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* Scope 3: Value Chain Emissions                                 */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <AccordionItem value="scope3" className="border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/50 [&>svg]:ml-auto">
            <span className="flex items-center gap-3 flex-1">
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/20">
                <Leaf className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </span>
              <span className="flex flex-col items-start">
                <span className="font-semibold text-sm">Scope 3 — Value Chain Emissions</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {formatEmissions(liveScope3Total)} CO₂e across {scope3Categories.length} categories
                </span>
              </span>
              <Badge variant="outline" className="ml-auto mr-2 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 text-xs">
                {scope3CompletedCount} of {scope3Categories.length} tracked
              </Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 space-y-6">

            {/* Sub-section: Data You Enter */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Data you enter
                </span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {report && (
                  <BusinessTravelCard reportId={report.id} entries={travelEntries} onUpdate={fetchReportData} />
                )}
                {report && (
                  <ServicesOverheadCard reportId={report.id} entries={serviceEntries} onUpdate={fetchReportData} />
                )}
                {report && (
                  <MarketingMaterialsCard reportId={report.id} entries={marketingEntries} onUpdate={fetchReportData} />
                )}
                {report && (
                  <TeamCommutingCard reportId={report.id} initialFteCount={fteCount} onUpdate={fetchReportData} />
                )}
                {report && (
                  <CapitalGoodsCard reportId={report.id} entries={capitalGoodsEntries} onUpdate={fetchReportData} />
                )}
                {report && currentOrganization && (
                  <LogisticsDistributionCard
                    reportId={report.id}
                    organizationId={currentOrganization.id}
                    year={year}
                    entries={logisticsEntries}
                    onUpdate={fetchReportData}
                  />
                )}
                {report && (
                  <OperationalWasteCard reportId={report.id} entries={wasteEntries} onUpdate={fetchReportData} />
                )}
              </div>
            </div>

            {/* Sub-section: Auto-Calculated from Products */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Auto-calculated from products
                </span>
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-l-4 border-emerald-500/20 pl-0 rounded-lg">
                  <ProductsSupplyChainCard
                    totalCO2e={scope3TotalCO2e}
                    productsCO2e={scope3Emissions.products}
                    year={year}
                    report={report}
                    isLoading={isLoadingScope3}
                  />
                </div>
                {report && currentOrganization && (
                  <div className="border-l-4 border-emerald-500/20 pl-0 rounded-lg">
                    <UpstreamTransportCard
                      reportId={report.id}
                      organizationId={currentOrganization.id}
                      year={year}
                      entries={upstreamTransportEntries}
                      onUpdate={fetchReportData}
                    />
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* Coming Soon                                                    */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <AccordionItem value="coming-soon" className="border rounded-xl overflow-hidden">
          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/50 [&>svg]:ml-auto">
            <span className="flex items-center gap-3 flex-1">
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-500/10">
                <Clock className="h-4 w-4 text-slate-500" />
              </span>
              <span className="flex flex-col items-start">
                <span className="font-semibold text-sm text-muted-foreground">Coming Soon</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Cradle-to-grave categories
                </span>
              </span>
              <Badge variant="secondary" className="ml-auto mr-2 text-xs">
                2 categories
              </Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {report && currentOrganization && (
                <DownstreamTransportCard
                  reportId={report.id}
                  organizationId={currentOrganization.id}
                  year={year}
                  entries={downstreamTransportEntries}
                  onUpdate={fetchReportData}
                />
              )}
              {report && currentOrganization && (
                <UsePhaseCard
                  reportId={report.id}
                  organizationId={currentOrganization.id}
                  year={year}
                  entries={usePhaseEntries}
                  onUpdate={fetchReportData}
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ================================================================= */}
      {/* Detailed Summary Dashboard                                        */}
      {/* ================================================================= */}
      <div id="summary-dashboard">
        <FootprintSummaryDashboard
          totalEmissions={liveTotalEmissions}
          scope1Emissions={liveScope1Total}
          scope2Emissions={liveScope2Total}
          scope3Emissions={liveScope3Total}
          scope3Breakdown={scope3Breakdown}
          operationsEmissions={operationsCO2e}
          fleetEmissions={fleetCO2e}
          year={year}
          lastUpdated={report.updated_at}
          status={report.status}
        />
      </div>
    </div>
  );
}
