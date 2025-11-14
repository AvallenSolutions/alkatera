"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, ArrowLeft, Calculator, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActivityDataTable } from "@/components/facilities/ActivityDataTable";
import { AddActivityDataModal } from "@/components/facilities/AddActivityDataModal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";

interface Facility {
  id: string;
  name: string;
  location: string;
  facility_type: string;
  organization_id: string;
}

interface EmissionSource {
  id: string;
  source_name: string;
  scope: string;
  category: string;
  default_unit: string;
}

interface ActivityData {
  id: string;
  emission_source_id: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  created_at: string;
  scope_1_2_emission_sources: {
    source_name: string;
    scope: string;
    category: string;
  };
}

export default function FacilityDetailPage() {
  const searchParams = useSearchParams();
  const facilityId = searchParams.get("id");

  const [facility, setFacility] = useState<Facility | null>(null);
  const [scope1Sources, setScope1Sources] = useState<EmissionSource[]>([]);
  const [scope2Sources, setScope2Sources] = useState<EmissionSource[]>([]);
  const [scope1Data, setScope1Data] = useState<ActivityData[]>([]);
  const [scope2Data, setScope2Data] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScope1ModalOpen, setIsScope1ModalOpen] = useState(false);
  const [isScope2ModalOpen, setIsScope2ModalOpen] = useState(false);
  const [isCalculateModalOpen, setIsCalculateModalOpen] = useState(false);
  const [reportingPeriodStart, setReportingPeriodStart] = useState("");
  const [reportingPeriodEnd, setReportingPeriodEnd] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [calculationResults, setCalculationResults] = useState<any>(null);
  const [existingCalculations, setExistingCalculations] = useState<any[]>([]);
  const [loadingCalculations, setLoadingCalculations] = useState(false);

  useEffect(() => {
    if (facilityId) {
      fetchFacilityData();
      fetchEmissionSources();
      fetchActivityData();
      fetchExistingCalculations();
    } else {
      setLoading(false);
      setError("No facility ID provided");
    }
  }, [facilityId]);

  const fetchFacilityData = async () => {
    try {
      const { data, error } = await supabase
        .from("facilities")
        .select("*")
        .eq("id", facilityId)
        .single();

      if (error) throw error;
      setFacility(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchEmissionSources = async () => {
    try {
      const { data, error } = await supabase
        .from("scope_1_2_emission_sources")
        .select("*")
        .order("scope", { ascending: true })
        .order("category", { ascending: true });

      if (error) throw error;

      const scope1 = data.filter((s) => s.scope === "Scope 1");
      const scope2 = data.filter((s) => s.scope === "Scope 2");

      setScope1Sources(scope1);
      setScope2Sources(scope2);
    } catch (err: any) {
      console.error("Error fetching emission sources:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityData = async () => {
    try {
      const { data, error } = await supabase
        .from("facility_activity_data")
        .select(`
          *,
          scope_1_2_emission_sources (
            source_name,
            scope,
            category
          )
        `)
        .eq("facility_id", facilityId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const scope1 = data.filter((d) => d.scope_1_2_emission_sources.scope === "Scope 1");
      const scope2 = data.filter((d) => d.scope_1_2_emission_sources.scope === "Scope 2");

      setScope1Data(scope1);
      setScope2Data(scope2);
    } catch (err: any) {
      console.error("Error fetching activity data:", err);
    }
  };

  const handleDataAdded = () => {
    fetchActivityData();
    setIsScope1ModalOpen(false);
    setIsScope2ModalOpen(false);
  };

  const fetchExistingCalculations = async () => {
    setLoadingCalculations(true);
    try {
      const { data, error } = await supabase
        .from("facility_emissions_aggregated")
        .select("*")
        .eq("facility_id", facilityId)
        .order("calculation_date", { ascending: false });

      if (error) throw error;
      setExistingCalculations(data || []);
    } catch (err: any) {
      console.error("Error fetching calculations:", err);
    } finally {
      setLoadingCalculations(false);
    }
  };

  const handleCalculateEmissions = async () => {
    if (!reportingPeriodStart || !reportingPeriodEnd) {
      toast.error("Please select both start and end dates");
      return;
    }

    if (new Date(reportingPeriodStart) > new Date(reportingPeriodEnd)) {
      toast.error("Start date must be before end date");
      return;
    }

    setCalculating(true);
    setCalculationResults(null);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error("You must be logged in");
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invoke-corporate-calculations`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facility_id: facilityId,
          reporting_period: {
            start: reportingPeriodStart,
            end: reportingPeriodEnd,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to calculate emissions");
      }

      setCalculationResults(result);
      toast.success("Emissions calculated successfully!");
      await fetchExistingCalculations();
    } catch (error: any) {
      console.error("Error calculating emissions:", error);
      toast.error(error.message || "Failed to calculate emissions");
    } finally {
      setCalculating(false);
    }
  };

  const formatValue = (value: number) => {
    if (value >= 1000) {
      return value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
    }
    return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !facilityId) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || "No facility ID provided"}</AlertDescription>
        </Alert>
        <Link href="/company/facilities" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Facilities
          </Button>
        </Link>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>Facility not found</AlertDescription>
        </Alert>
        <Link href="/company/facilities" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Facilities
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/company/facilities">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{facility.name}</h1>
          <p className="text-muted-foreground mt-1">
            {facility.location} • {facility.facility_type}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scope1">Scope 1 Emissions</TabsTrigger>
          <TabsTrigger value="scope2">Scope 2 Emissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Facility Information</CardTitle>
              <CardDescription>Basic details about this facility</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <p className="text-sm text-muted-foreground">{facility.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <p className="text-sm text-muted-foreground">{facility.location}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <p className="text-sm text-muted-foreground">{facility.facility_type}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Data Points</label>
                <p className="text-sm text-muted-foreground">
                  Scope 1: {scope1Data.length} entries • Scope 2: {scope2Data.length} entries
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Corporate Emissions Calculations</CardTitle>
                  <CardDescription>
                    Calculate total Scope 1 & 2 emissions for this facility by reporting period
                  </CardDescription>
                </div>
                <Button onClick={() => setIsCalculateModalOpen(true)} size="lg" className="gap-2">
                  <Calculator className="h-5 w-5" />
                  Calculate Emissions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCalculations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : existingCalculations.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No calculations performed yet. Click "Calculate Emissions" to get started.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reporting Period</TableHead>
                        <TableHead className="text-right">Total CO₂e</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Calculated</TableHead>
                        <TableHead className="text-right">Sources</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existingCalculations.map((calc) => (
                        <TableRow key={calc.id}>
                          <TableCell className="font-medium">
                            {formatDate(calc.reporting_period_start)} - {formatDate(calc.reporting_period_end)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-lg">
                            {formatValue(calc.total_co2e)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{calc.unit}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(calc.calculation_date)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {Object.keys(calc.results_payload?.disaggregated_summary || {}).length} sources
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope1" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scope 1 Emissions Data</CardTitle>
                  <CardDescription>
                    Direct emissions from sources owned or controlled by your organisation
                  </CardDescription>
                </div>
                <Button onClick={() => setIsScope1ModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Data
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ActivityDataTable data={scope1Data} onRefresh={fetchActivityData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope2" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scope 2 Emissions Data</CardTitle>
                  <CardDescription>
                    Indirect emissions from purchased energy
                  </CardDescription>
                </div>
                <Button onClick={() => setIsScope2ModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Data
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ActivityDataTable data={scope2Data} onRefresh={fetchActivityData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {facilityId && (
        <>
          <AddActivityDataModal
            open={isScope1ModalOpen}
            onOpenChange={setIsScope1ModalOpen}
            facilityId={facilityId}
            scope="Scope 1"
            emissionSources={scope1Sources}
            onSuccess={handleDataAdded}
          />

          <AddActivityDataModal
            open={isScope2ModalOpen}
            onOpenChange={setIsScope2ModalOpen}
            facilityId={facilityId}
            scope="Scope 2"
            emissionSources={scope2Sources}
            onSuccess={handleDataAdded}
          />

          <Dialog open={isCalculateModalOpen} onOpenChange={setIsCalculateModalOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Calculate Corporate Emissions</DialogTitle>
                <DialogDescription>
                  Calculate total Scope 1 and Scope 2 emissions for {facility.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="period-start">Reporting Period Start *</Label>
                    <Input
                      id="period-start"
                      type="date"
                      value={reportingPeriodStart}
                      onChange={(e) => setReportingPeriodStart(e.target.value)}
                      disabled={calculating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="period-end">Reporting Period End *</Label>
                    <Input
                      id="period-end"
                      type="date"
                      value={reportingPeriodEnd}
                      onChange={(e) => setReportingPeriodEnd(e.target.value)}
                      disabled={calculating}
                    />
                  </div>
                </div>

                {calculationResults && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-5 w-5" />
                      <span className="font-semibold">Calculation Complete</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Total CO₂ Equivalent</p>
                        <p className="text-4xl font-bold text-primary">
                          {formatValue(calculationResults.total_co2e)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">{calculationResults.unit}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Disaggregated Summary by Source</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Emission Source</TableHead>
                            <TableHead className="text-right">CO₂e</TableHead>
                            <TableHead className="text-right">% of Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(calculationResults.disaggregated_summary || {}).map(
                            ([source, value]: [string, any]) => {
                              const percentage = (value / calculationResults.total_co2e) * 100;
                              return (
                                <TableRow key={source}>
                                  <TableCell className="font-medium">{source}</TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatValue(value)}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {percentage.toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              );
                            }
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Activity Records:</span>{" "}
                        {calculationResults.activity_records_processed}
                      </div>
                      <div>
                        <span className="font-medium">Duration:</span>{" "}
                        {calculationResults.calculation_duration_ms}ms
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                {!calculationResults ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsCalculateModalOpen(false)}
                      disabled={calculating}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCalculateEmissions} disabled={calculating}>
                      {calculating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <Calculator className="mr-2 h-4 w-4" />
                          Calculate
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setIsCalculateModalOpen(false);
                      setCalculationResults(null);
                      setReportingPeriodStart("");
                      setReportingPeriodEnd("");
                    }}
                  >
                    Close
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
