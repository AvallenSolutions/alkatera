"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Plus, FileText, Calendar, AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";

interface ProductLCA {
  id: string;
  product_name: string;
  functional_unit: string;
  system_boundary: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface LCAResult {
  id: string;
  impact_category: string;
  value: number;
  unit: string;
  method: string;
}

const STATUS_COLORS = {
  draft: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  pending: "bg-amber-200 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  completed: "bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-200 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function ProductLCAReportsPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [lcas, setLcas] = useState<ProductLCA[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLca, setSelectedLca] = useState<ProductLCA | null>(null);
  const [lcaResults, setLcaResults] = useState<LCAResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchLCAs();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchLCAs = async () => {
    try {
      const { data, error } = await supabase
        .from("product_lcas")
        .select("*")
        .eq("organization_id", currentOrganization!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setLcas(data || []);
    } catch (error) {
      console.error("Error fetching LCAs:", error);
      toast.error("Failed to load LCAs");
    } finally {
      setLoading(false);
    }
  };

  const fetchLCAResults = async (lcaId: string) => {
    setLoadingResults(true);
    try {
      const { data, error } = await supabase
        .from("product_lca_results")
        .select("*")
        .eq("product_lca_id", lcaId)
        .order("impact_category", { ascending: true });

      if (error) throw error;

      setLcaResults(data || []);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast.error("Failed to load results");
    } finally {
      setLoadingResults(false);
    }
  };

  const handleViewDetails = async (lca: ProductLCA) => {
    setSelectedLca(lca);
    if (lca.status === "completed") {
      await fetchLCAResults(lca.id);
    }
  };

  const handleCalculate = async (lcaId: string) => {
    setCalculating(true);
    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error("You must be logged in");
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invoke-openlca`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_lca_id: lcaId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to calculate LCA");
      }

      toast.success("LCA calculation completed successfully!");
      await fetchLCAs();
      setSelectedLca(null);
    } catch (error: any) {
      console.error("Error calculating LCA:", error);
      toast.error(error.message || "Failed to calculate LCA");
    } finally {
      setCalculating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatValue = (value: number) => {
    if (value >= 1000) {
      return value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
    }
    return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  };

  if (loading) {
    return <PageLoader message="Loading product LCAs..." />;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Product LCA Reports</h1>
            <p className="text-muted-foreground mt-2">
              View and manage life cycle assessments for your products
            </p>
          </div>
          <Link href="/lca/new">
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Create New LCA
            </Button>
          </Link>
        </div>

        {lcas.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No product LCAs found. Create your first LCA to get started.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>All Product LCAs</CardTitle>
              <CardDescription>
                {lcas.length} {lcas.length === 1 ? "assessment" : "assessments"} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Functional Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lcas.map((lca) => (
                    <TableRow key={lca.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {lca.product_name}
                        </div>
                      </TableCell>
                      <TableCell>{lca.functional_unit}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[lca.status as keyof typeof STATUS_COLORS]}
                        >
                          {lca.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(lca.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(lca.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(lca)}>
                          <BarChart3 className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedLca} onOpenChange={(open) => !open && setSelectedLca(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedLca?.product_name}</DialogTitle>
            <DialogDescription>Life Cycle Assessment Details</DialogDescription>
          </DialogHeader>

          {selectedLca && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Information</TabsTrigger>
                <TabsTrigger value="results" disabled={selectedLca.status !== "completed"}>
                  Results
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge
                        variant="secondary"
                        className={STATUS_COLORS[selectedLca.status as keyof typeof STATUS_COLORS]}
                      >
                        {selectedLca.status}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Functional Unit</Label>
                    <p className="text-sm mt-1">{selectedLca.functional_unit}</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">System Boundary</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{selectedLca.system_boundary}</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                    <p className="text-sm mt-1">{formatDate(selectedLca.created_at)}</p>
                  </div>

                  {selectedLca.status === "draft" && (
                    <div className="pt-4">
                      <Button
                        onClick={() => handleCalculate(selectedLca.id)}
                        disabled={calculating}
                        className="w-full"
                      >
                        {calculating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Calculating...
                          </>
                        ) : (
                          "Calculate LCA"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="results" className="space-y-4 mt-4">
                {loadingResults ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : lcaResults.length === 0 ? (
                  <Alert>
                    <AlertDescription>No results available</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {lcaResults[0]?.method && (
                      <div className="text-sm text-muted-foreground">
                        Method: {lcaResults[0].method}
                      </div>
                    )}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Impact Category</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lcaResults.map((result) => (
                          <TableRow key={result.id}>
                            <TableCell className="font-medium">{result.impact_category}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatValue(result.value)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{result.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
