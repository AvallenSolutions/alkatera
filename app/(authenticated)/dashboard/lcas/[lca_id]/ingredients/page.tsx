"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UnifiedLcaDataCapture, type IngredientData } from "@/components/lca/UnifiedLcaDataCapture";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

interface IngredientsPageProps {
  params: {
    lca_id: string;
  };
}

export default function IngredientsPage({ params }: IngredientsPageProps) {
  const router = useRouter();
  const lcaId = params.lca_id;

  const [ingredientsData, setIngredientsData] = useState<IngredientData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExistingData();
  }, [lcaId]);

  const loadExistingData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: materials, error: materialsError } = await supabase
        .from("product_lca_materials")
        .select("*")
        .eq("product_lca_id", lcaId);

      if (materialsError) throw materialsError;

      if (materials && materials.length > 0) {
        const loadedIngredients: IngredientData[] = materials.map((m) => {
          const metrics = {
            climate_change: {
              display_name: "Climate Change",
              category: "Core Environmental Impacts",
              value: 0,
              unit: "kg CO₂ eq",
              source: "EcoInvent 3.12",
              data_quality: "Secondary" as const,
              is_override: false,
            },
            ozone_depletion: {
              display_name: "Ozone Depletion",
              category: "Core Environmental Impacts",
              value: 0,
              unit: "kg CFC-11 eq",
              source: "EcoInvent 3.12",
              data_quality: "Secondary" as const,
              is_override: false,
            },
            human_toxicity: {
              display_name: "Human Toxicity",
              category: "Core Environmental Impacts",
              value: 0,
              unit: "kg 1,4-DB eq",
              source: "EcoInvent 3.12",
              data_quality: "Secondary" as const,
              is_override: false,
            },
            freshwater_ecotoxicity: {
              display_name: "Freshwater Ecotoxicity",
              category: "Core Environmental Impacts",
              value: 0,
              unit: "kg 1,4-DB eq",
              source: "EcoInvent 3.12",
              data_quality: "Secondary" as const,
              is_override: false,
            },
            terrestrial_ecotoxicity: {
              display_name: "Terrestrial Ecotoxicity",
              category: "Core Environmental Impacts",
              value: 0,
              unit: "kg 1,4-DB eq",
              source: "EcoInvent 3.12",
              data_quality: "Secondary" as const,
              is_override: false,
            },
            eutrophication: {
              display_name: "Eutrophication",
              category: "Core Environmental Impacts",
              value: 0,
              unit: "kg PO₄³⁻ eq",
              source: "EcoInvent 3.12",
              data_quality: "Secondary" as const,
              is_override: false,
            },
            water_use: {
              display_name: "Water Use",
              category: "Resource Use & Waste",
              value: 0,
              unit: "litres",
              source: "EcoInvent 3.12",
              data_quality: "Secondary" as const,
              is_override: false,
            },
            waste_generated: {
              display_name: "Waste Generated",
              category: "Resource Use & Waste",
              value: 0,
              unit: "kg",
              source: "EcoInvent 3.12",
              data_quality: "Secondary" as const,
              is_override: false,
            },
            biodiversity_impact: {
              display_name: "Biodiversity Impact",
              category: "Ecosystem Impact",
              value: 0,
              unit: "PDF.m².yr",
              source: "EcoInvent 3.12",
              data_quality: "Secondary" as const,
              is_override: false,
            },
          };

          return {
            id: m.id,
            name: m.material_name || "",
            weight_kg: m.quantity || 0,
            metrics,
            originalMetrics: JSON.parse(JSON.stringify(metrics)),
          };
        });

        setIngredientsData(loadedIngredients);
      }
    } catch (err: any) {
      console.error("Error loading ingredients:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataChange = (ingredients: IngredientData[]) => {
    setIngredientsData(ingredients);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const invalidIngredients = ingredientsData.filter(
        (ing) => !ing.name.trim() || ing.weight_kg <= 0
      );

      if (invalidIngredients.length > 0) {
        toast.error("Please complete all ingredient names and weights");
        return;
      }

      const overriddenMetrics = ingredientsData.flatMap((ing) =>
        Object.entries(ing.metrics)
          .filter(([_, metric]) => metric.is_override)
          .map(([key, metric]) => ({
            ingredient: ing.name,
            metric: metric.display_name,
            needsSource: !metric.source || metric.source.trim() === "",
          }))
      );

      const missingProvenance = overriddenMetrics.filter((m) => m.needsSource);
      if (missingProvenance.length > 0) {
        toast.error("All overridden metrics must have a data source");
        return;
      }

      const { error: deleteError } = await supabase
        .from("product_lca_materials")
        .delete()
        .eq("product_lca_id", lcaId);

      if (deleteError) throw deleteError;

      const materialsToInsert = ingredientsData.map((ing) => ({
        product_lca_id: lcaId,
        material_name: ing.name,
        quantity: ing.weight_kg,
        unit: "kg",
        data_source: "user_input",
        lca_sub_stage_id: null,
      }));

      const { error: insertError } = await supabase
        .from("product_lca_materials")
        .insert(materialsToInsert);

      if (insertError) throw insertError;

      toast.success(`Saved ${ingredientsData.length} ingredient${ingredientsData.length !== 1 ? "s" : ""} successfully`);

      setTimeout(() => {
        router.push(`/dashboard/lcas/${lcaId}/calculate`);
      }, 500);
    } catch (err: any) {
      console.error("Error saving ingredients:", err);
      toast.error(err.message || "Failed to save ingredients");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    router.push(`/dashboard/lcas/${lcaId}/create/sourcing`);
  };

  if (isLoading) {
    return <PageLoader message="Loading ingredients data..." />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const getValidationSummary = () => {
    const total = ingredientsData.length;
    const withNames = ingredientsData.filter((i) => i.name.trim() !== "").length;
    const withWeights = ingredientsData.filter((i) => i.weight_kg > 0).length;
    const totalOverrides = ingredientsData.reduce(
      (sum, ing) => sum + Object.values(ing.metrics).filter((m) => m.is_override).length,
      0
    );

    return { total, withNames, withWeights, totalOverrides };
  };

  const validation = getValidationSummary();
  const isValid =
    validation.total > 0 &&
    validation.withNames === validation.total &&
    validation.withWeights === validation.total;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Step 2: Ingredient Data Capture</h1>
          <p className="text-muted-foreground mt-2">
            Add ingredients and manage their environmental impact metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? (
              "Saving..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save & Continue
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{validation.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {validation.withNames}/{validation.total}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{validation.totalOverrides}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isValid ? (
              <div className="text-sm font-medium text-green-600">Ready to save</div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground">Incomplete</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environmental Impact Data</CardTitle>
          <CardDescription>
            Enter ingredient details and manage environmental metrics. Default values from
            EcoInvent 3.12 can be overridden with your own primary data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnifiedLcaDataCapture
            initialIngredients={ingredientsData}
            onDataChange={handleDataChange}
          />
        </CardContent>
      </Card>

      {!isValid && ingredientsData.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please ensure all ingredients have names and weights greater than 0 before saving.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
