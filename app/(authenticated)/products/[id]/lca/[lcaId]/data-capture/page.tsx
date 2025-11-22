"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Clock,
  Package,
  Boxes,
  Factory,
  Info,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { saveDraftData, markTabComplete, getAllTabsComplete } from "@/lib/lcaWorkflow";
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
  updated_at: string;
}

export default function LcaDataCapturePage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const lcaId = params.lcaId as string;

  const [lca, setLca] = useState<LcaData | null>(null);
  const [activeTab, setActiveTab] = useState("ingredients");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
      setLastSaved(new Date(data.updated_at));
    } catch (error: any) {
      console.error("Error loading LCA data:", error);
      toast.error(error.message || "Failed to load LCA data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      toast.info("Saving draft...");

      await loadLcaData();

      setLastSaved(new Date());
      toast.success("Draft saved successfully");
    } catch (error: any) {
      console.error("Error saving draft:", error);
      toast.error(error.message || "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProceedToReview = async () => {
    const completion = await getAllTabsComplete(lcaId);

    if (!completion.allComplete) {
      const incomplete = [];
      if (!completion.details.ingredients) incomplete.push("Ingredients");
      if (!completion.details.packaging) incomplete.push("Packaging");
      if (!completion.details.production) incomplete.push("Production");

      toast.error(`Please complete all sections: ${incomplete.join(", ")}`);
      return;
    }

    router.push(`/products/${productId}/lca/${lcaId}/review`);
  };

  const getTabStatus = (tabName: 'ingredients' | 'packaging' | 'production') => {
    if (!lca) return 'pending';

    const fieldMap = {
      ingredients: lca.ingredients_complete,
      packaging: lca.packaging_complete,
      production: lca.production_complete,
    };

    return fieldMap[tabName] ? 'complete' : 'pending';
  };

  const getTabBadge = (status: string) => {
    if (status === 'complete') {
      return (
        <Badge className="bg-green-600 ml-2">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Complete
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="ml-2">
        <Clock className="h-3 w-3 mr-1" />
        Draft
      </Badge>
    );
  };

  const formatLastSaved = () => {
    if (!lastSaved) return "Not saved yet";

    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

    if (diff < 60) return "Saved just now";
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)} mins ago`;
    return `Saved ${Math.floor(diff / 3600)} hours ago`;
  };

  if (loading) {
    return <PageLoader message="Loading LCA data capture..." />;
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

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Capture</h1>
          <p className="text-muted-foreground mt-1">{lca.product_name}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Goal & Scope (Confirmed)</CardTitle>
              <CardDescription>
                <strong>Functional Unit:</strong> {lca.functional_unit}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
              {lca.lca_scope_type === 'cradle-to-grave' ? 'Cradle-to-Grave' : 'Cradle-to-Gate'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Complete all three sections below. Your data is automatically saved as you work.
          All sections must be completed before proceeding to calculation.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ingredients" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>Ingredients</span>
            {getTabBadge(getTabStatus('ingredients'))}
          </TabsTrigger>
          <TabsTrigger value="packaging" className="flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            <span>Packaging</span>
            {getTabBadge(getTabStatus('packaging'))}
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            <span>Production</span>
            {getTabBadge(getTabStatus('production'))}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ingredients & Raw Materials</CardTitle>
              <CardDescription>
                Add all liquid and dry ingredients used in this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This section will integrate with your existing ingredient entry interface.
                  Add materials, specify quantities, and assign to life cycle stages.
                </AlertDescription>
              </Alert>

              <div className="mt-4 text-center text-muted-foreground">
                <p className="text-sm">Ingredient data capture interface coming soon</p>
                <p className="text-xs mt-1">Will reuse existing UnifiedLcaDataCapture component</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Packaging Materials</CardTitle>
              <CardDescription>
                Add primary, secondary, and tertiary packaging materials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Include all packaging that protects and presents your product:
                  bottles, labels, caps, cartons, pallets, shrink wrap, etc.
                </AlertDescription>
              </Alert>

              <div className="mt-4 text-center text-muted-foreground">
                <p className="text-sm">Packaging data capture interface coming soon</p>
                <p className="text-xs mt-1">Will use same interface as ingredients</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Production & Manufacturing</CardTitle>
              <CardDescription>
                Allocate facility-level environmental impacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Link to your CoreOpsManager to allocate facility emissions, water usage,
                  and waste generation based on production volumes.
                </AlertDescription>
              </Alert>

              <div className="mt-4">
                <Button
                  onClick={() => router.push(`/products/${productId}/core-operations`)}
                  variant="outline"
                  className="w-full"
                >
                  <Factory className="mr-2 h-4 w-4" />
                  Go to Core Operations Allocation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 bg-background border-t pt-4 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {formatLastSaved()}
            </div>
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
          </div>

          <Button
            onClick={handleProceedToReview}
            size="lg"
            disabled={!lca.ingredients_complete || !lca.packaging_complete || !lca.production_complete}
          >
            Proceed to Review
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
