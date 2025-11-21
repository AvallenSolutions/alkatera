"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Calendar, FileText } from "lucide-react";
import Link from "next/link";
import { ResultsBreakdownChart } from "./components/ResultsBreakdownChart";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";

interface CalculationSummary {
  total_co2e: number;
  unit: string;
}

interface BreakdownItem {
  stage_name: string;
  co2e_value: number;
}

interface CalculationResponse {
  summary?: CalculationSummary;
  breakdown?: BreakdownItem[];
  results?: Array<{
    impactCategory: string;
    value: number;
    unit: string;
    method: string;
  }>;
}

interface CalculationLog {
  response_data: CalculationResponse;
  created_at: string;
  status: string;
}

export default function ResultsPage() {
  const params = useParams();
  const lcaId = params.lca_id as string;
  const [calculationLog, setCalculationLog] = useState<CalculationLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      try {
        setIsLoading(true);
        setError(null);

        console.log('[ResultsPage] Fetching calculation logs for LCA:', lcaId);

        const { data, error: fetchError } = await supabase
          .from('product_lca_calculation_logs')
          .select('response_data, created_at, status')
          .eq('product_lca_id', lcaId)
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('[ResultsPage] Query result:', { data, fetchError });

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        if (!data) {
          console.warn('[ResultsPage] No calculation log found. Checking product_lca_results table...');

          // First, verify we can access the product_lcas table
          const { data: lcaData, error: lcaError } = await supabase
            .from('product_lcas')
            .select('id, product_name, organization_id')
            .eq('id', lcaId)
            .maybeSingle();

          console.log('[ResultsPage] LCA access test:', { lcaData, lcaError });

          const { data: results, error: resultsError } = await supabase
            .from('product_lca_results')
            .select('*')
            .eq('product_lca_id', lcaId)
            .order('created_at', { ascending: false });

          console.log('[ResultsPage] Direct results query:', {
            results,
            resultsError,
            resultsCount: results?.length,
            firstResult: results?.[0]
          });

          if (resultsError) {
            throw new Error(resultsError.message);
          }

          if (results && results.length > 0) {
            const syntheticLog: CalculationLog = {
              response_data: {
                results: results.map(r => ({
                  impactCategory: r.impact_category,
                  value: r.value,
                  unit: r.unit,
                  method: r.method,
                })),
              },
              created_at: results[0].created_at,
              status: 'success',
            };
            setCalculationLog(syntheticLog);
            return;
          }
        }

        setCalculationLog(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load calculation results");
      } finally {
        setIsLoading(false);
      }
    }

    fetchResults();
  }, [lcaId]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Step 4: Calculation Results</h1>
          <p className="text-muted-foreground mt-2">Loading results...</p>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !calculationLog) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Step 4: Calculation Results</h1>
          <p className="text-muted-foreground mt-2">
            View your LCA calculation results
          </p>
        </div>

        <Alert>
          <AlertDescription>
            {error || "Calculation results are not available. Please run the calculation first."}
          </AlertDescription>
        </Alert>

        <div className="mt-6 flex gap-4">
          <Link href={`/dashboard/lcas/${lcaId}/calculate`}>
            <Button variant="outline">Back to Calculate</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const responseData = calculationLog.response_data;
  const calculationDate = calculationLog.created_at;

  const summary = responseData.summary;
  const breakdown = responseData.breakdown || [];

  let totalEmissions = summary?.total_co2e || 0;
  let emissionsUnit = summary?.unit || "kg CO₂e";

  if (!summary && responseData.results && responseData.results.length > 0) {
    const climateChangeResult = responseData.results.find(
      r => r.impactCategory === "Climate Change"
    );
    if (climateChangeResult) {
      totalEmissions = climateChangeResult.value;
      emissionsUnit = climateChangeResult.unit;
    }
  }

  const hasBreakdown = breakdown.length > 0;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold">Step 4: Calculation Results</h1>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <p>
            Calculated on {format(new Date(calculationDate), "PPpp")}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="border-2 border-primary">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">Total Emissions</CardTitle>
            <CardDescription>
              Complete life cycle assessment result
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="space-y-2">
              <div className="text-6xl font-bold text-primary">
                {totalEmissions.toFixed(2)}
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {emissionsUnit}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {hasBreakdown && (
          <>
            <Separator />
            <ResultsBreakdownChart data={breakdown} />
          </>
        )}

        {responseData.results && responseData.results.length > 0 && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle>Impact Categories</CardTitle>
                <CardDescription>
                  Environmental impact across different categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {responseData.results.map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{result.impactCategory}</div>
                        <div className="text-sm text-muted-foreground">
                          {result.method}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {result.value.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.unit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Separator />

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="audit">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>View Raw Audit Data</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-md bg-muted p-4 overflow-auto max-h-96">
                <pre className="text-xs">
                  <code>{JSON.stringify(responseData, null, 2)}</code>
                </pre>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This raw data provides complete transparency and auditability of the calculation results.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-between items-center pt-6">
          <Link href={`/dashboard/lcas/${lcaId}/calculate`}>
            <Button variant="outline">Back to Review</Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg">
              Finish
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
