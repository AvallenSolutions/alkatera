"use client";

import { useState } from "react";
import { UnifiedLcaDataCapture, type IngredientData } from "@/components/lca/UnifiedLcaDataCapture";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Code, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function UnifiedDataCapturePage() {
  const [ingredientsData, setIngredientsData] = useState<IngredientData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleDataChange = (ingredients: IngredientData[]) => {
    setIngredientsData(ingredients);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      console.log("Saving ingredients data:", JSON.stringify(ingredientsData, null, 2));

      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success(`Successfully saved ${ingredientsData.length} ingredient${ingredientsData.length !== 1 ? 's' : ''}`);
    } catch (error) {
      toast.error("Failed to save data");
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getValidationSummary = () => {
    const total = ingredientsData.length;
    const withNames = ingredientsData.filter(i => i.name.trim() !== "").length;
    const withWeights = ingredientsData.filter(i => i.weight_kg > 0).length;
    const totalOverrides = ingredientsData.reduce(
      (sum, ing) => sum + Object.values(ing.metrics).filter(m => m.is_override).length,
      0
    );

    return { total, withNames, withWeights, totalOverrides };
  };

  const validation = getValidationSummary();
  const isValid = validation.total > 0 && validation.withNames === validation.total && validation.withWeights === validation.total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Unified LCA Data Capture</h1>
        <p className="text-muted-foreground mt-2">
          Single source of truth for ingredient-level environmental impact data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{validation.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Complete Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {validation.withNames}/{validation.total}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Data Overrides</CardTitle>
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
            <div className="flex items-center gap-2">
              {isValid ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Valid</span>
                </>
              ) : (
                <>
                  <div className="h-5 w-5 rounded-full border-2 border-muted" />
                  <span className="text-sm font-medium text-muted-foreground">Incomplete</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="capture" className="w-full">
        <TabsList>
          <TabsTrigger value="capture">Data Capture</TabsTrigger>
          <TabsTrigger value="json">JSON Output</TabsTrigger>
          <TabsTrigger value="info">Component Info</TabsTrigger>
        </TabsList>

        <TabsContent value="capture" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ingredient Data</CardTitle>
                  <CardDescription>
                    Add ingredients and manage environmental metrics with dual-path data entry
                  </CardDescription>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={!isValid || isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save All"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <UnifiedLcaDataCapture
                initialIngredients={ingredientsData}
                onDataChange={handleDataChange}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current State (JSON)</CardTitle>
              <CardDescription>
                This is the exact data structure sent to the backend calculation engine
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(ingredientsData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Component Architecture</CardTitle>
              <CardDescription>
                How the Unified LCA Data Capture component is structured
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Component Hierarchy</h3>
                <div className="ml-4 space-y-2 text-sm">
                  <div>
                    <Code className="inline h-3 w-3 mr-1" />
                    <strong>UnifiedLcaDataCapture</strong> (Main Container)
                  </div>
                  <div className="ml-4">
                    <Code className="inline h-3 w-3 mr-1" />
                    <strong>IngredientList</strong> (Iterator)
                  </div>
                  <div className="ml-8">
                    <Code className="inline h-3 w-3 mr-1" />
                    <strong>IngredientRow</strong> (Collapsible Card)
                  </div>
                  <div className="ml-12">
                    <Code className="inline h-3 w-3 mr-1" />
                    <strong>MetricInput</strong> (Conditional Renderer)
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Key Features</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Single source of truth for all ingredient data</li>
                  <li>Dual-path data entry (EcoInvent default + user overrides)</li>
                  <li>Mandatory provenance tracking for overrides</li>
                  <li>Real-time state management with parent callback</li>
                  <li>Grouped metrics by category (Core, Resource Use, Ecosystem)</li>
                  <li>Data quality indicators with tooltips</li>
                  <li>Revert functionality to restore EcoInvent defaults</li>
                </ul>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Integration Note:</strong> This component is designed to be embedded in larger LCA workflows.
                  The parent page handles the final save action and receives the complete validated state via the
                  <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">onDataChange</code> callback.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
