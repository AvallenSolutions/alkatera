"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Plus, Download, Lock } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useOrganization } from "@/lib/organizationContext";
import { GapFillWizardModal } from "@/components/reports/GapFillWizardModal";
import { CCFSankeyDashboard } from "@/components/reports/CCFSankeyDashboard";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";

interface CorporateReport {
  id: string;
  year: number;
  status: string;
  total_emissions: number;
  breakdown_json: any;
  finalized_at: string | null;
  created_at: string;
}

export default function CCFReportsPage() {
  const { currentOrganization } = useOrganization();

  const [reports, setReports] = useState<CorporateReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<CorporateReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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

      // Auto-select most recent report
      if (data && data.length > 0) {
        setSelectedReport(data[0]);
      }
    } catch (error: any) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = () => {
    setShowWizard(true);
  };

  const handleWizardSuccess = (reportId: string) => {
    fetchReports();
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i);
    }
    return years;
  };

  const formatEmissions = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)} tCO₂e`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} tCO₂e`;
    }
    return `${value.toFixed(2)} kgCO₂e`;
  };

  if (isLoading) {
    return <PageLoader message="Loading carbon footprint reports..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Corporate Carbon Footprint
          </h1>
          <p className="text-sm text-muted-foreground">
            ISO-compliant annual greenhouse gas emissions reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reports.length > 0 && (
            <Select
              value={selectedReport?.id}
              onValueChange={(id) => {
                const report = reports.find((r) => r.id === id);
                if (report) setSelectedReport(report);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reports.map((report) => (
                  <SelectItem key={report.id} value={report.id}>
                    {report.year} Report
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleGenerateReport}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Annual Carbon Reports
            </CardTitle>
            <CardDescription>
              Generate your first ISO-compliant corporate carbon footprint report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reports Generated</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Create your first corporate carbon footprint report by aggregating facility data,
                production volumes, and product footprints. The system automatically calculates
                Scope 1, 2, and 3 emissions.
              </p>
              <Button onClick={handleGenerateReport}>
                <Plus className="h-4 w-4 mr-2" />
                Generate {new Date().getFullYear()} Report
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : selectedReport ? (
        <>
          {/* Report Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{selectedReport.year} Carbon Footprint Report</CardTitle>
                  <CardDescription className="mt-1">
                    Generated on {new Date(selectedReport.created_at).toLocaleDateString("en-GB")}
                    {selectedReport.finalized_at && (
                      <>
                        {" • "}
                        Finalized on {new Date(selectedReport.finalized_at).toLocaleDateString("en-GB")}
                      </>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedReport.status === "Finalized" ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200">
                      <Lock className="h-3 w-3 mr-1" />
                      Finalized
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Draft</Badge>
                  )}
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Dashboard */}
          <CCFSankeyDashboard
            breakdown={selectedReport.breakdown_json}
            year={selectedReport.year}
          />
        </>
      ) : null}

      {/* Gap-Fill Wizard Modal */}
      {currentOrganization && (
        <GapFillWizardModal
          open={showWizard}
          onOpenChange={setShowWizard}
          organizationId={currentOrganization.id}
          year={selectedYear}
          onSuccess={handleWizardSuccess}
        />
      )}
    </div>
  );
}
