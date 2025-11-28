"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Package,
  Boxes,
  Factory,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface LcaData {
  id: string;
  product_name: string;
  functional_unit: string;
  lca_scope_type: string;
  draft_data: {
    ingredients?: any[];
    packaging?: any[];
    production?: any;
  };
  ingredients_complete: boolean;
  packaging_complete: boolean;
  production_complete: boolean;
}

export default function LcaReviewPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const lcaId = params.lcaId as string;

  const [lca, setLca] = useState<LcaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    loadLcaData();
  }, [lcaId]);

  const loadLcaData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("product_lcas")
        .select("*")
        .eq("id", lcaId)
        .single();

      if (error) throw error;

      setLca(data);
    } catch (error: any) {
      console.error("Error loading LCA data:", error);
      toast.error(error.message || "Failed to load LCA data");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    try {
      setIsCalculating(true);
      toast.info("Starting LCA calculation...");

      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      // Call the invoke-openlca edge function to perform the calculation
      // Note: The edge function will update the status internally
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/invoke-openlca`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_lca_id: lcaId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Calculation request failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[Review] Calculation result:', result);

      // Mark LCA as calculated and not a draft
      await supabase
        .from("product_lcas")
        .update({
          status: 'completed',
          is_draft: false,
        })
        .eq("id", lcaId);

      toast.success("LCA calculation completed successfully");
      router.push(`/dashboard/lcas/${lcaId}/results`);
    } catch (error: any) {
      console.error("Error initiating calculation:", error);
      toast.error(error.message || "Failed to initiate calculation");
    } finally {
      setIsCalculating(false);
    }
  };

  if (loading) {
    return <PageLoader message="Loading review data..." />;
  }

  if (!lca) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Alert variant="destructive">
          <AlertDescription>LCA not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const allComplete = lca.ingredients_complete && lca.packaging_complete && lca.production_complete;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review & Calculate</h1>
          <p className="text-muted-foreground mt-1">{lca.product_name}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}/lca/${lcaId}/data-capture`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Data Entry
        </Button>
      </div>

      {!allComplete && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            All sections must be completed before calculation. Please complete all data entry tabs.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Goal & Scope Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Functional Unit</p>
            <p className="text-base font-medium">{lca.functional_unit}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">System Boundary</p>
            <Badge className={lca.lca_scope_type === 'cradle-to-grave' ? "bg-green-600" : "bg-amber-600"}>
              {lca.lca_scope_type === 'cradle-to-grave' ? 'Cradle-to-Grave' : 'Cradle-to-Gate'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <CardTitle className="text-lg">Ingredients</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {lca.ingredients_complete ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Complete</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Incomplete</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {lca.draft_data?.ingredients?.length || 0} items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              <CardTitle className="text-lg">Packaging</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {lca.packaging_complete ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Complete</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Incomplete</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {lca.draft_data?.packaging?.length || 0} items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              <CardTitle className="text-lg">Production</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {lca.production_complete ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Complete</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Incomplete</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {lca.draft_data?.production ? 'Allocated' : 'Not allocated'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card className={allComplete ? "border-green-500" : ""}>
        <CardHeader>
          <CardTitle>Ready to Calculate</CardTitle>
          <CardDescription>
            {allComplete
              ? "All data is complete. Click below to calculate environmental impacts."
              : "Complete all sections before calculating."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleCalculate}
            disabled={!allComplete || isCalculating}
            size="lg"
            className="w-full"
          >
            <Calculator className="mr-2 h-5 w-5" />
            {isCalculating ? "Calculating..." : "Calculate LCA"}
          </Button>

          {allComplete && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Calculation typically takes 30-60 seconds
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
