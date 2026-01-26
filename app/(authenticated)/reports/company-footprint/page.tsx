"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Plus, Calendar, ChevronRight } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";

interface CorporateReport {
  id: string;
  year: number;
  status: string;
  total_emissions: number;
  created_at: string;
  finalized_at: string | null;
}

export default function CompanyFootprintPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();

  const [reports, setReports] = useState<CorporateReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const formatEmissions = (value: number) => {
    // Always display in tonnes
    return `${(value / 1000).toFixed(3)} tCO₂e`;
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i);
    }
    return years;
  };

  if (isLoading) {
    return <PageLoader message="Loading company footprints..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Company Footprint
          </h1>
          <p className="text-sm text-muted-foreground">
            Annual greenhouse gas emissions reporting
          </p>
        </div>
      </div>

      {/* Recent Reports */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Footprints</CardTitle>
            <CardDescription>Manage and view your annual emission reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => router.push(`/reports/company-footprint/${report.year}`)}
                  className="w-full flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">{report.year} Footprint</div>
                      <div className="text-sm text-muted-foreground">
                        {formatEmissions(report.total_emissions)}
                        {report.finalized_at && (
                          <span className="ml-2">
                            • Finalised {new Date(report.finalized_at).toLocaleDateString("en-GB")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
              ))}
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

      {reports.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <TrendingUp className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Footprints Yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Create your first company footprint to track your organisation&apos;s greenhouse gas
                emissions across all operations, products, and services.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
