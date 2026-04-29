"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wine,
  Layers,
  Workflow,
  Pencil,
  Check,
} from "lucide-react";
import { RecipeScaleToggle } from "@/components/products/RecipeScaleToggle";
import { ProductionChainEditor } from "@/components/products/ProductionChainEditor";
import { ProductionTemplateDialog } from "@/components/products/ProductionTemplateDialog";
import type {
  ProductionStage,
  StageType,
  ProductionChainTemplate,
  RecipeScaleMode,
  BatchYieldUnit,
} from "@/lib/types/products";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";

export type RecipeMode = "per_unit" | "per_batch" | "per_chain";

interface RecipeModePickerProps {
  recipeScaleMode: RecipeScaleMode;
  batchYieldValue: number | null;
  batchYieldUnit: BatchYieldUnit | string | null;
  productionStages: ProductionStage[];
  ingredientForms: IngredientFormData[];
  productUnitSizeValue: number | null;
  productUnitSizeUnit: string | null;
  onSaveScale: (input: {
    recipe_scale_mode: RecipeScaleMode;
    batch_yield_value: number | null;
    batch_yield_unit: string | null;
  }) => Promise<void> | void;
  onAddStage: (input: { name: string; stage_type: StageType }) => Promise<void>;
  onUpdateStage: (id: string, updates: Partial<ProductionStage>) => Promise<void>;
  onRemoveStage: (id: string) => Promise<void>;
  onApplyTemplate: (template: ProductionChainTemplate) => Promise<void>;
  onClearChain: () => Promise<void>;
}

function deriveCurrentMode(
  scale: RecipeScaleMode,
  hasChain: boolean,
): RecipeMode {
  if (hasChain) return "per_chain";
  if (scale === "per_batch") return "per_batch";
  return "per_unit";
}

export function RecipeModePicker(props: RecipeModePickerProps) {
  const {
    recipeScaleMode,
    batchYieldValue,
    batchYieldUnit,
    productionStages,
    ingredientForms,
    productUnitSizeValue,
    productUnitSizeUnit,
    onSaveScale,
    onAddStage,
    onUpdateStage,
    onRemoveStage,
    onApplyTemplate,
    onClearChain,
  } = props;

  const hasChain = productionStages.length > 0;
  const currentMode = deriveCurrentMode(recipeScaleMode, hasChain);

  // The picker collapses to a summary line once the user has made a choice.
  // It re-opens automatically when in the default per_unit + no-chain state so
  // first-time users see the three options.
  const [editing, setEditing] = useState<boolean>(currentMode === "per_unit" && !hasChain);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  useEffect(() => {
    // If the user has actively configured batch or chain, keep the picker
    // collapsed by default on subsequent loads.
    if (currentMode !== "per_unit" || hasChain) {
      setEditing(false);
    }
  }, [currentMode, hasChain]);

  const handleSelect = async (mode: RecipeMode) => {
    if (mode === "per_unit") {
      // Clear any chain + reset scale to per_unit
      if (hasChain) await onClearChain();
      await onSaveScale({
        recipe_scale_mode: "per_unit",
        batch_yield_value: null,
        batch_yield_unit: null,
      });
    } else if (mode === "per_batch") {
      // If a chain exists, clear it; switch scale to per_batch
      if (hasChain) await onClearChain();
      if (recipeScaleMode !== "per_batch") {
        await onSaveScale({
          recipe_scale_mode: "per_batch",
          batch_yield_value: batchYieldValue ?? null,
          batch_yield_unit: batchYieldUnit ?? "bottles",
        });
      }
    } else {
      // per_chain — open template picker; chain itself is created when template
      // applied or "Build custom" pressed inside ProductionChainEditor
      if (recipeScaleMode === "per_batch") {
        await onSaveScale({
          recipe_scale_mode: "per_unit",
          batch_yield_value: null,
          batch_yield_unit: null,
        });
      }
      setTemplateDialogOpen(true);
    }
    setEditing(false);
  };

  // Collapsed summary (default once configured)
  if (!editing) {
    const summary =
      currentMode === "per_chain"
        ? `Multi-stage chain · ${productionStages.length} stage${productionStages.length === 1 ? "" : "s"}`
        : currentMode === "per_batch"
          ? `Per batch · ${batchYieldValue ?? "?"} ${batchYieldUnit ?? "bottles"}`
          : "Per unit";
    return (
      <>
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Recipe mode:</span>
            <span className="font-medium">{summary}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Change
          </Button>
        </div>

        {/* Render the relevant editor for the active mode */}
        {currentMode === "per_batch" && (
          <RecipeScaleToggle
            mode={recipeScaleMode}
            yieldValue={batchYieldValue}
            yieldUnit={batchYieldUnit ?? null}
            onChange={onSaveScale}
          />
        )}
        {currentMode === "per_chain" && (
          <ProductionChainEditor
            stages={productionStages}
            ingredientForms={ingredientForms}
            productUnitSizeValue={productUnitSizeValue}
            productUnitSizeUnit={productUnitSizeUnit}
            onAddStage={onAddStage}
            onUpdateStage={onUpdateStage}
            onRemoveStage={onRemoveStage}
            onApplyTemplate={onApplyTemplate}
            onClearChain={async () => {
              await onClearChain();
              setEditing(true);
            }}
          />
        )}

        {/* Mounted in both branches so it stays open when the picker collapses
            after the user picks "Multi-stage chain". */}
        <ProductionTemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          onApply={async (t) => {
            await onApplyTemplate(t);
            setEditing(false);
          }}
        />
      </>
    );
  }

  // Expanded picker: three radio cards
  const cards: Array<{
    mode: RecipeMode;
    icon: typeof Wine;
    title: string;
    description: string;
  }> = [
    {
      mode: "per_unit",
      icon: Wine,
      title: "Per unit",
      description:
        "I know my ingredients per single bottle / can. Simplest option.",
    },
    {
      mode: "per_batch",
      icon: Layers,
      title: "Per batch",
      description:
        "I track ingredients per production batch. Tell us how many bottles each batch yields and we will allocate per bottle.",
    },
    {
      mode: "per_chain",
      icon: Workflow,
      title: "Multi-stage chain",
      description:
        "My production goes through several stages (mash, ferment, distil, mature, bottle). Best for whisky and other spirits.",
    },
  ];

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">How do you measure your ingredients?</h3>
            <p className="text-xs text-muted-foreground">
              Pick the mode that matches how you track production. You can change this any time.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cards.map((c) => {
              const Icon = c.icon;
              const active = currentMode === c.mode;
              return (
                <button
                  key={c.mode}
                  type="button"
                  onClick={() => handleSelect(c.mode)}
                  className={
                    "text-left rounded-md border p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-ring " +
                    (active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40")
                  }
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{c.title}</span>
                    {active && (
                      <Badge variant="secondary" className="ml-auto">
                        <Check className="h-3 w-3 mr-1" /> Selected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ProductionTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onApply={async (t) => {
          await onApplyTemplate(t);
          setEditing(false);
        }}
      />
    </>
  );
}
