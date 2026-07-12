"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronRight,
  ChevronDown,
  HelpCircle,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { calculateCorporateEmissions, type ScopeBreakdown } from "@/lib/calculations/corporate-emissions";
import { EmissionsTrendChart } from "@/components/reports/company-footprint/EmissionsTrendChart";
import { Scope3BreakdownChart } from "@/components/reports/company-footprint/Scope3BreakdownChart";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Statement,
  Eyebrow,
  BigNumber,
  Panel,
  PillButton,
  StateChip,
  FactRow,
} from "@/components/studio";
import { toast } from "sonner";

interface CorporateReport {
  id: string;
  year: number;
  status: string;
  total_emissions: number;
  breakdown_json: any;
  created_at: string;
  finalized_at: string | null;
}

export default function CompanyFootprintPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();

  const [reports, setReports] = useState<CorporateReport[]>([]);
  const [liveEmissions, setLiveEmissions] = useState<Record<number, { total: number; breakdown: ScopeBreakdown | null }>>({});
  const [isLoading, setIsLoading] = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchReports();
    }
  }, [currentOrganization?.id]);

  const fetchReports = async () => {
    if (!currentOrganization?.id) return;

    try {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("corporate_reports")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("year", { ascending: false });

      if (error) throw error;
      setReports(data || []);

      // Calculate live emissions for every report year — same calculation as dashboard
      if (data && data.length > 0) {
        const liveResults: Record<number, { total: number; breakdown: ScopeBreakdown | null }> = {};
        await Promise.all(
          data.map(async (report) => {
            try {
              const result = await calculateCorporateEmissions(supabase, currentOrganization.id, report.year);
              liveResults[report.year] = {
                total: result.breakdown.total,
                breakdown: result.breakdown,
              };
            } catch {
              // Fall back to stored value on error
              liveResults[report.year] = { total: report.total_emissions, breakdown: null };
            }
          })
        );
        setLiveEmissions(liveResults);
      }
    } catch (error: any) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateReport = async (year: number) => {
    if (!currentOrganization?.id) return;

    try {
      const supabase = getSupabaseBrowserClient();

      // Check if report already exists
      const { data: existing } = await supabase
        .from("corporate_reports")
        .select("id")
        .eq("organization_id", currentOrganization.id)
        .eq("year", year)
        .maybeSingle();

      if (existing) {
        router.push(`/reports/company-footprint/${year}`);
        return;
      }

      // Create new draft report
      const { data, error } = await supabase
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

      if (error) throw error;

      toast.success(`${year} footprint created`);
      router.push(`/reports/company-footprint/${year}`);
    } catch (error: any) {
      console.error("Error creating report:", error);
      toast.error("Failed to create footprint");
    }
  };

  /**
   * Get the live total for a report year.
   * Uses calculateCorporateEmissions (same as dashboard) for all years.
   * All values are in kg CO₂e.
   */
  const getLiveTotal = (report: CorporateReport): number => {
    return liveEmissions[report.year]?.total ?? report.total_emissions;
  };

  // Display: values are in kg CO₂e — convert to tonnes for display
  // Matches dashboard: (value / 1000).toFixed(1) for tonnes
  const formatEmissions = (kgValue: number) => {
    const t = kgValue / 1000;
    if (t >= 1000) return `${(t / 1000).toFixed(2)} kt CO₂e`;
    return `${t.toFixed(2)} t CO₂e`;
  };

  const getAvailableYears = () => {
    const years = [];
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i);
    }
    return years;
  };

  // Year-over-year trend calculation (uses live totals)
  const getTrend = () => {
    if (reports.length < 2) return null;
    const latestReport = reports[0];
    const previousReport = reports[1];
    const latestTotal = getLiveTotal(latestReport);
    const previousTotal = getLiveTotal(previousReport);
    if (latestTotal === 0 || previousTotal === 0) return null;
    const change = ((latestTotal - previousTotal) / previousTotal) * 100;
    return {
      change,
      latestYear: latestReport.year,
      previousYear: previousReport.year,
    };
  };

  // Get scope breakdown from live calculation
  const getScopeBar = (report: CorporateReport) => {
    const live = liveEmissions[report.year];
    if (live?.breakdown) {
      const bd = live.breakdown;
      const total = bd.total || 1;
      return {
        scope1Pct: ((bd.scope1 || 0) / total) * 100,
        scope2Pct: ((bd.scope2 || 0) / total) * 100,
        scope3Pct: ((bd.scope3?.total || 0) / total) * 100,
      };
    }

    // Fallback to stored breakdown
    const bj = report.breakdown_json;
    if (!bj || report.total_emissions === 0) return null;

    const scope1 = bj.scope1 || 0;
    const scope2 = bj.scope2 || 0;
    const scope3Total = bj.scope3?.total || bj.scope3_total || 0;
    const total = scope1 + scope2 + scope3Total;
    if (total === 0) return null;

    return {
      scope1Pct: (scope1 / total) * 100,
      scope2Pct: (scope2 / total) * 100,
      scope3Pct: (scope3Total / total) * 100,
    };
  };

  const trend = getTrend();

  if (isLoading) {
    return <PageLoader message="Loading company footprints..." />;
  }

  const latestReport = reports[0];
  const latestTotal = latestReport ? getLiveTotal(latestReport) : 0;

  return (
    <div className="space-y-10">
      {/* ================================================================= */}
      {/* The statement                                                     */}
      {/* ================================================================= */}
      <Statement
        eyebrow="THE EVIDENCE · COMPANY FOOTPRINT"
        headline="The annual footprint."
      >
        {latestReport && latestTotal > 0 && (
          <BigNumber
            size="display"
            value={formatEmissions(latestTotal)}
            label={`${latestReport.year} total`}
          />
        )}
      </Statement>

      {/* Year-over-year trend, told quietly */}
      {trend && (
        <div className="flex items-center gap-3 border-b border-studio-hairline pb-4">
          {trend.change < 0 ? (
            <TrendingDown className="h-4 w-4 text-studio-good" />
          ) : (
            <TrendingUp className="h-4 w-4 text-studio-attention" />
          )}
          <span className="font-display text-lg font-bold tabular-nums text-foreground">
            {Math.abs(trend.change).toFixed(1)}%
          </span>
          <StateChip tone={trend.change < 0 ? "good" : "stale"}>
            {trend.change < 0 ? "decrease" : "increase"}
          </StateChip>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
            {trend.previousYear} to {trend.latestYear}
          </span>
        </div>
      )}

      {/* Multi-year trend + Scope 3 breakdown (fed by liveEmissions) */}
      <EmissionsTrendChart liveEmissions={liveEmissions} />
      <Scope3BreakdownChart liveEmissions={liveEmissions} />

      {/* ================================================================= */}
      {/* Your footprints                                                   */}
      {/* ================================================================= */}
      {reports.length > 0 && (
        <section>
          <Eyebrow tone="dim" className="mb-3">
            YOUR FOOTPRINTS
          </Eyebrow>
          <Panel flush>
            <ul className="divide-y divide-studio-hairline">
              {reports.map((report) => {
                const scopeBar = getScopeBar(report);
                const liveTotal = getLiveTotal(report);
                return (
                  <li key={report.id}>
                    <button
                      onClick={() => router.push(`/reports/company-footprint/${report.year}`)}
                      className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 ease-studio hover:bg-studio-ink/[0.03]"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-secondary">
                          <Calendar className="h-5 w-5 text-studio-dim" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-base font-semibold text-foreground">
                            {report.year} footprint
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {liveTotal > 0 ? formatEmissions(liveTotal) : "No data yet"}
                            {report.finalized_at && (
                              <span className="ml-2">
                                · Finalised{" "}
                                {new Date(report.finalized_at).toLocaleDateString("en-GB")}
                              </span>
                            )}
                          </div>
                          {/* Scope breakdown mini-bar, one quiet studio bar */}
                          {scopeBar && (
                            <div className="mt-2 flex h-1.5 max-w-48 overflow-hidden rounded-full bg-secondary">
                              <div className="bg-foreground" style={{ width: `${scopeBar.scope1Pct}%` }} />
                              <div className="bg-studio-dim" style={{ width: `${scopeBar.scope2Pct}%` }} />
                              <div className="bg-studio-brick" style={{ width: `${scopeBar.scope3Pct}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <StateChip tone={report.status === "Finalized" ? "good" : "quiet"}>
                          {report.status === "Finalized" ? "Complete" : "Draft"}
                        </StateChip>
                        <ChevronRight className="h-5 w-5 text-studio-dim transition-transform duration-150 ease-studio group-hover:translate-x-0.5 group-hover:text-room-accent" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </section>
      )}

      {/* ================================================================= */}
      {/* Start a footprint                                                 */}
      {/* ================================================================= */}
      <section>
        <Eyebrow tone="dim" className="mb-3">
          START A FOOTPRINT
        </Eyebrow>
        {reports.length === 0 ? (
          <p className="mb-5 max-w-xl text-sm text-muted-foreground">
            Your company footprint measures greenhouse gas emissions across three scopes,
            following the GHG Protocol Corporate Standard. Most of it is auto-calculated from
            data you have already entered. Pick a year to begin.
          </p>
        ) : (
          <p className="mb-5 text-sm text-muted-foreground">
            Select a year to begin calculating your emissions.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {getAvailableYears().map((year) => {
            const exists = reports.find((r) => r.year === year);
            return (
              <PillButton
                key={year}
                variant={exists ? "outline" : "ink"}
                onClick={() => handleCreateReport(year)}
                className="h-16 flex-col gap-1 rounded-[6px]"
              >
                <span className="font-display text-base font-semibold tabular-nums">{year}</span>
                {exists && (
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] opacity-70">
                    View
                  </span>
                )}
              </PillButton>
            );
          })}
        </div>

        {/* Quiet "how it works" explainer, shown only before the first footprint */}
        {reports.length === 0 && (
          <Collapsible className="mt-5">
            <CollapsibleTrigger className="group inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
              How it works
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 max-w-xl space-y-2 border-l-2 border-studio-hairline pl-4 text-xs text-muted-foreground">
                <p>
                  Most of your footprint is auto-calculated from data you have already entered
                  across alka<strong>tera</strong>: facility utility bills, product assessments,
                  and fleet data.
                </p>
                <p>
                  You then add a few extra data points like business travel, team commuting, and
                  service spend to complete the picture.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </section>

      {/* ================================================================= */}
      {/* Delineation: the live workbench                                   */}
      {/* ================================================================= */}
      <FactRow
        subject="See your live emissions data"
        detail="the workbench, scope 1 and 2"
        meta="→"
        href="/data/scope-1-2/"
      />
    </div>
  );
}
