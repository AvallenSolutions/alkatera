"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { QuantifiedInputWithDQI } from "@/components/lca/QuantifiedInputWithDQI";
import { ChevronLeft, ChevronRight, Save, Calculator, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";

interface LCADefinition {
  product_name: string;
  functional_unit: string;
  system_boundary: string;
}

interface QuantifiedInput {
  label: string;
  value: number;
  unit: string;
  dqi: {
    reliability: number;
    temporal: number;
    geographical: number;
    technological: number;
    completeness: number;
  };
  evidenceUrl?: string;
  stage: string;
  category: string;
}

const LIFE_CYCLE_STAGES = [
  { id: "raw-materials", label: "Raw Materials", description: "Materials extraction and processing" },
  { id: "manufacturing", label: "Manufacturing", description: "Product manufacturing and assembly" },
  { id: "transportation", label: "Transportation", description: "Distribution and logistics" },
  { id: "use-phase", label: "Use Phase", description: "Product use and maintenance" },
  { id: "end-of-life", label: "End of Life", description: "Disposal, recycling, or recovery" },
];

const INPUT_CATEGORIES = {
  "raw-materials": [
    { label: "Steel", unit: "kg" },
    { label: "Aluminium", unit: "kg" },
    { label: "Plastic (HDPE)", unit: "kg" },
    { label: "Plastic (PET)", unit: "kg" },
    { label: "Glass", unit: "kg" },
    { label: "Cardboard", unit: "kg" },
    { label: "Other Material", unit: "kg" },
  ],
  manufacturing: [
    { label: "Electricity Consumption", unit: "kWh" },
    { label: "Natural Gas", unit: "m³" },
    { label: "Water Usage", unit: "m³" },
    { label: "Process Emissions", unit: "kg CO₂e" },
  ],
  transportation: [
    { label: "Road Transport", unit: "tonne-km" },
    { label: "Sea Freight", unit: "tonne-km" },
    { label: "Air Freight", unit: "tonne-km" },
    { label: "Rail Transport", unit: "tonne-km" },
  ],
  "use-phase": [
    { label: "Annual Electricity Use", unit: "kWh/year" },
    { label: "Consumables per Year", unit: "kg/year" },
    { label: "Maintenance per Year", unit: "kg/year" },
  ],
  "end-of-life": [
    { label: "Recycled Material", unit: "kg" },
    { label: "Incinerated Material", unit: "kg" },
    { label: "Landfilled Material", unit: "kg" },
  ],
};

export default function NewLCAPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [step, setStep] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  const [lcaDefinition, setLcaDefinition] = useState<LCADefinition>({
    product_name: "",
    functional_unit: "",
    system_boundary: "",
  });

  const [inputs, setInputs] = useState<Record<string, QuantifiedInput[]>>({
    "raw-materials": [],
    manufacturing: [],
    transportation: [],
    "use-phase": [],
    "end-of-life": [],
  });

  const handleAddInput = (stageId: string, category: { label: string; unit: string }) => {
    const newInput: QuantifiedInput = {
      label: category.label,
      value: 0,
      unit: category.unit,
      dqi: {
        reliability: 3,
        temporal: 3,
        geographical: 3,
        technological: 3,
        completeness: 3,
      },
      stage: stageId,
      category: category.label,
    };

    setInputs((prev) => ({
      ...prev,
      [stageId]: [...prev[stageId], newInput],
    }));
  };

  const handleUpdateInput = (stageId: string, index: number, data: any) => {
    setInputs((prev) => {
      const stageInputs = [...prev[stageId]];
      stageInputs[index] = {
        ...stageInputs[index],
        ...data,
      };
      return {
        ...prev,
        [stageId]: stageInputs,
      };
    });
  };

  const handleRemoveInput = (stageId: string, index: number) => {
    setInputs((prev) => ({
      ...prev,
      [stageId]: prev[stageId].filter((_, i) => i !== index),
    }));
  };

  const handleSaveDraft = async () => {
    if (!currentOrganization?.id) {
      toast.error("No organisation selected");
      return;
    }

    if (!lcaDefinition.product_name || !lcaDefinition.functional_unit || !lcaDefinition.system_boundary) {
      toast.error("Please complete all product definition fields");
      return;
    }

    const allInputs = Object.values(inputs).flat();
    if (allInputs.length === 0) {
      toast.error("Please add at least one data point");
      return;
    }

    const missingEvidence = allInputs.filter(
      (input) => (input.dqi.reliability === 1 || input.dqi.reliability === 2) && !input.evidenceUrl
    );

    if (missingEvidence.length > 0) {
      toast.error("Please upload evidence for all high-reliability data points");
      return;
    }

    setSaving(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        toast.error("You must be logged in");
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/request-product-lca`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lcaDefinition: {
            ...lcaDefinition,
            organization_id: currentOrganization.id,
          },
          lcaInputs: allInputs,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save LCA draft");
      }

      toast.success("LCA draft saved successfully");
      router.push("/dashboard/reports/product-lca");
    } catch (error: any) {
      console.error("Error saving LCA:", error);
      toast.error(error.message || "Failed to save LCA draft");
    } finally {
      setSaving(false);
    }
  };

  const totalInputs = Object.values(inputs).flat().length;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Product LCA</h1>
        <p className="text-muted-foreground mt-2">
          Complete the multi-step process to create a comprehensive life cycle assessment
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step >= s
                  ? "bg-slate-900 border-slate-900 text-white dark:bg-slate-50 dark:border-slate-50 dark:text-slate-900"
                  : "border-slate-300 text-slate-400"
              }`}
            >
              {s}
            </div>
            {s < 3 && <div className="w-16 h-0.5 bg-slate-300" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Define Product Details</CardTitle>
            <CardDescription>Provide basic information about the product being assessed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name *</Label>
              <Input
                id="product_name"
                value={lcaDefinition.product_name}
                onChange={(e) => setLcaDefinition((prev) => ({ ...prev, product_name: e.target.value }))}
                placeholder="e.g., Aluminium Beverage Can"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="functional_unit">Functional Unit *</Label>
              <Input
                id="functional_unit"
                value={lcaDefinition.functional_unit}
                onChange={(e) => setLcaDefinition((prev) => ({ ...prev, functional_unit: e.target.value }))}
                placeholder="e.g., 1 can (330ml)"
              />
              <p className="text-xs text-muted-foreground">
                The reference unit for all calculations (e.g., 1 product, 1 kg, 1 service)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_boundary">System Boundary *</Label>
              <Textarea
                id="system_boundary"
                value={lcaDefinition.system_boundary}
                onChange={(e) => setLcaDefinition((prev) => ({ ...prev, system_boundary: e.target.value }))}
                placeholder="Describe what is included and excluded in this assessment..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Define the scope of your analysis (cradle-to-gate, cradle-to-grave, etc.)
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setStep(2)}
                disabled={!lcaDefinition.product_name || !lcaDefinition.functional_unit || !lcaDefinition.system_boundary}
              >
                Next: Enter Activity Data
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Enter Activity Data</CardTitle>
            <CardDescription>Add quantified inputs for each life cycle stage</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="raw-materials" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                {LIFE_CYCLE_STAGES.map((stage) => (
                  <TabsTrigger key={stage.id} value={stage.id} className="text-xs">
                    {stage.label}
                    {inputs[stage.id].length > 0 && (
                      <span className="ml-1 text-xs bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900 rounded-full w-5 h-5 flex items-center justify-center">
                        {inputs[stage.id].length}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {LIFE_CYCLE_STAGES.map((stage) => (
                <TabsContent key={stage.id} value={stage.id} className="space-y-4 mt-4">
                  <div>
                    <h3 className="text-lg font-semibold">{stage.label}</h3>
                    <p className="text-sm text-muted-foreground">{stage.description}</p>
                  </div>

                  {inputs[stage.id].length === 0 ? (
                    <Alert>
                      <AlertDescription>No data points added for this stage yet</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      {inputs[stage.id].map((input, index) => (
                        <div key={index} className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute -right-2 -top-2 z-10"
                            onClick={() => handleRemoveInput(stage.id, index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                          <QuantifiedInputWithDQI
                            label={input.label}
                            unit={input.unit}
                            onUpdate={(data) => handleUpdateInput(stage.id, index, data)}
                            initialValue={input}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-2">Add Data Point:</p>
                    <div className="flex flex-wrap gap-2">
                      {INPUT_CATEGORIES[stage.id as keyof typeof INPUT_CATEGORIES]?.map((category) => (
                        <Button
                          key={category.label}
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddInput(stage.id, category)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {category.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-between pt-6 border-t mt-6">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={totalInputs === 0}>
                Review & Save
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review & Save</CardTitle>
            <CardDescription>Review your LCA data before saving as draft</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Product Information</h3>
              <dl className="grid grid-cols-1 gap-3">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Product Name</dt>
                  <dd className="text-sm">{lcaDefinition.product_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Functional Unit</dt>
                  <dd className="text-sm">{lcaDefinition.functional_unit}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">System Boundary</dt>
                  <dd className="text-sm whitespace-pre-wrap">{lcaDefinition.system_boundary}</dd>
                </div>
              </dl>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-3">Activity Data Summary</h3>
              <div className="space-y-4">
                {LIFE_CYCLE_STAGES.map((stage) => {
                  const stageInputs = inputs[stage.id];
                  if (stageInputs.length === 0) return null;

                  return (
                    <div key={stage.id}>
                      <h4 className="text-sm font-semibold mb-2">{stage.label}</h4>
                      <div className="space-y-2">
                        {stageInputs.map((input, index) => (
                          <div key={index} className="flex items-center justify-between text-sm p-2 bg-slate-50 dark:bg-slate-900 rounded">
                            <span>
                              {input.label}: {input.value} {input.unit}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              DQI Avg: {(
                                (input.dqi.reliability +
                                  input.dqi.temporal +
                                  input.dqi.geographical +
                                  input.dqi.technological +
                                  input.dqi.completeness) /
                                5
                              ).toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 pt-4">
              <Button size="lg" onClick={handleSaveDraft} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving Draft...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Save Draft
                  </>
                )}
              </Button>

              <Button size="lg" variant="secondary" disabled={true}>
                <Calculator className="mr-2 h-5 w-5" />
                Calculate LCA (Available in Phase 2)
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                The calculation engine will be available in the next phase
              </p>
            </div>

            <div className="flex justify-start pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Edit Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
