"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Factory,
  Zap,
  Leaf,
  HelpCircle,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { calculateCorporateEmissions, type ScopeBreakdown } from "@/lib/calculations/corporate-emissions";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Company Footprint
          </h1>
          <p className="text-sm text-muted-foreground">
            Annual greenhouse gas emissions reporting per GHG Protocol
          </p>
        </div>
      </div>

      {/* Year-over-year trend */}
      {trend && (
        <Card className={cn(
          "border",
          trend.change < 0
            ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
            : "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
        )}>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              {trend.change < 0 ? (
                <TrendingDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {Math.abs(trend.change).toFixed(1)}% {trend.change < 0 ? 'decrease' : 'increase'}
              </span>
              <span className="text-xs text-muted-foreground">
                from {trend.previousYear} to {trend.latestYear}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Reports */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Footprints</CardTitle>
            <CardDescription>Manage and view your annual emission reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reports.map((report) => {
                const scopeBar = getScopeBar(report);
                const liveTotal = getLiveTotal(report);
                return (
                  <button
                    key={report.id}
                    onClick={() => router.push(`/reports/company-footprint/${report.year}`)}
                    className="w-full flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Calendar className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-lg">{report.year} Footprint</div>
                        <div className="text-sm text-muted-foreground">
                          {liveTotal > 0
                            ? formatEmissions(liveTotal)
                            : "No data yet"}
                          {report.finalized_at && (
                            <span className="ml-2">
                              • Finalised {new Date(report.finalized_at).toLocaleDateString("en-GB")}
                            </span>
                          )}
                        </div>
                        {/* Scope breakdown mini-bar */}
                        {scopeBar && (
                          <div className="flex h-1.5 rounded-full overflow-hidden mt-2 max-w-48">
                            <div className="bg-orange-500" style={{ width: `${scopeBar.scope1Pct}%` }} />
                            <div className="bg-blue-500" style={{ width: `${scopeBar.scope2Pct}%` }} />
                            <div className="bg-emerald-500" style={{ width: `${scopeBar.scope3Pct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {report.status === "Finalized" ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create New Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Start New Footprint
          </CardTitle>
          <CardDescription>Select a year to begin calculating your emissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {getAvailableYears().map((year) => {
              const exists = reports.find((r) => r.year === year);
              return (
                <Button
                  key={year}
                  variant={exists ? "outline" : "default"}
                  onClick={() => handleCreateReport(year)}
                  className="h-20 flex flex-col gap-1"
                >
                  <Calendar className="h-5 w-5" />
                  <span className="font-semibold">{year}</span>
                  {exists && <span className="text-xs">View</span>}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced empty state with scope explanation */}
      {reports.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10">
            <div className="flex flex-col items-center text-center max-w-lg mx-auto">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <Leaf className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Track Your Carbon Footprint</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Your company footprint measures greenhouse gas emissions across three scopes,
                following the GHG Protocol Corporate Standard.
              </p>

              {/* Three scope badges */}
              <div className="grid grid-cols-3 gap-3 w-full mb-6">
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                  <Factory className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-medium text-orange-800 dark:text-orange-200">Scope 1</span>
                  <span className="text-[10px] text-orange-600/70 dark:text-orange-400/70">Direct emissions</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-800 dark:text-blue-200">Scope 2</span>
                  <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70">Purchased energy</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <Leaf className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Scope 3</span>
                  <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">Value chain</span>
                </div>
              </div>

              {/* How it works collapsible */}
              <Collapsible className="w-full">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground mx-auto">
                    <HelpCircle className="h-3.5 w-3.5 mr-1" />
                    How it works
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-left text-xs text-muted-foreground space-y-2">
                    <p>
                      Most of your footprint is <strong>auto-calculated</strong> from data you&apos;ve already entered
                      across Alkatera — facility utility bills, product assessments, and fleet data.
                    </p>
                    <p>
                      You&apos;ll add a few additional data points like business travel, team commuting, and
                      service spend to complete the picture.
                    </p>
                    <p>
                      Select a year above to get started.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
