"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Wand2, Trash } from "lucide-react";
import { ProductionStageCard } from "@/components/products/ProductionStageCard";
import { ProductionTemplateDialog } from "@/components/products/ProductionTemplateDialog";
import type { ProductionStage, StageType, ProductionChainTemplate } from "@/lib/types/products";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";

interface ProductionChainEditorProps {
  stages: ProductionStage[];
  ingredientForms: IngredientFormData[];
  productUnitSizeValue: number | null;
  productUnitSizeUnit: string | null;
  onAddStage: (input: { name: string; stage_type: StageType }) => Promise<void>;
  onUpdateStage: (id: string, updates: Partial<ProductionStage>) => Promise<void>;
  onRemoveStage: (id: string) => Promise<void>;
  onApplyTemplate: (template: ProductionChainTemplate) => Promise<void>;
  onClearChain: () => Promise<void>;
}

export function ProductionChainEditor({
  stages,
  ingredientForms,
  productUnitSizeValue,
  productUnitSizeUnit,
  onAddStage,
  onUpdateStage,
  onRemoveStage,
  onApplyTemplate,
  onClearChain,
}: ProductionChainEditorProps) {
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const ingredientCountByStage = useMemo(() => {
    const counts = new Map<string, number>();
    ingredientForms.forEach((f) => {
      if (f.stage_id) counts.set(f.stage_id, (counts.get(f.stage_id) ?? 0) + 1);
    });
    return counts;
  }, [ingredientForms]);

  const bottlingStage = stages.find((s) => s.stage_type === "bottling");
  const derivedBottles = useMemo(() => {
    if (!bottlingStage?.output_volume_l || !productUnitSizeValue || !productUnitSizeUnit) return null;
    const sizeUnit = productUnitSizeUnit.toLowerCase();
    const factor = sizeUnit === "ml" ? 0.001 : sizeUnit === "l" ? 1 : null;
    if (!factor) return null;
    const bottleLitres = productUnitSizeValue * factor;
    if (bottleLitres <= 0) return null;
    return bottlingStage.output_volume_l / bottleLitres;
  }, [bottlingStage, productUnitSizeValue, productUnitSizeUnit]);

  if (stages.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Production chain</CardTitle>
          <CardDescription>
            Multi-stage producers (whisky, rum, beer) can describe each step of production. Ingredients
            attach to the stage where they are consumed and the LCA calculator allocates them per bottle
            using the bottling stage&apos;s output volume.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => setTemplateDialogOpen(true)}>
            <Wand2 className="h-4 w-4 mr-1.5" />
            Apply a template
          </Button>
          <Button variant="outline" onClick={() => onAddStage({ name: "Stage 1", stage_type: "other" })}>
            <Plus className="h-4 w-4 mr-1.5" />
            Build custom chain
          </Button>
        </CardContent>
        <ProductionTemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          onApply={onApplyTemplate}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Production chain</CardTitle>
            <CardDescription>
              Describe each stage from raw input to bottled product. Volumes are diagnostic; the bottling
              stage&apos;s output volume drives per-bottle allocation.
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAddStage({ name: `Stage ${stages.length + 1}`, stage_type: "other" })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add stage
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTemplateDialogOpen(true)}>
              <Wand2 className="h-3.5 w-3.5 mr-1" />
              Replace with template
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm("Clear the production chain? Ingredients will be detached but kept.")) {
                  onClearChain();
                }
              }}
            >
              <Trash className="h-3.5 w-3.5 mr-1 text-destructive" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {derivedBottles != null && (
          <Alert>
            <AlertDescription className="text-sm">
              Per-bottle allocation: <strong>{Math.round(derivedBottles).toLocaleString()} bottles</strong>{" "}
              per chain run, derived from {bottlingStage?.output_volume_l} L bottling output ÷{" "}
              {productUnitSizeValue}{productUnitSizeUnit} bottle size. Each ingredient&apos;s impact is
              divided by this number.
            </AlertDescription>
          </Alert>
        )}
        {!derivedBottles && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">
              Add a <strong>bottling</strong> stage with a non-zero output volume so the calculator can
              derive per-bottle allocation. Without it, LCA calculation will fail.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {stages.map((s, idx) => (
            <ProductionStageCard
              key={s.id}
              stage={s}
              attachedIngredientCount={ingredientCountByStage.get(s.id) ?? 0}
              onUpdate={onUpdateStage}
              onRemove={onRemoveStage}
              showYieldArrow={idx < stages.length - 1}
            />
          ))}
        </div>
      </CardContent>
      <ProductionTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onApply={onApplyTemplate}
      />
    </Card>
  );
}
