"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { saveOrUpdateMaterials } from "@/lib/lca";
import { IngredientCard } from "./IngredientCard";
import { useOrganization } from "@/lib/organizationContext";
import type { IngredientCardData, LcaStageWithSubStages, ProductLcaMaterial, LcaSubStage } from "@/lib/types/lca";

interface IngredientsFormProps {
  lcaId: string;
  stages: LcaStageWithSubStages[];
  initialMaterials: ProductLcaMaterial[];
}

export function IngredientsForm({ lcaId, stages, initialMaterials }: IngredientsFormProps) {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id || "";

  const allSubStages: LcaSubStage[] = stages.flatMap((stage) => stage.sub_stages);

  const [ingredients, setIngredients] = useState<IngredientCardData[]>(
    initialMaterials.length > 0
      ? initialMaterials.map((m) => ({
          tempId: m.id,
          data_source: m.data_source || "openlca",
          name: m.name || "",
          quantity: m.quantity,
          unit: m.unit || "",
          lca_sub_stage_id: m.lca_sub_stage_id || null,
          data_source_id: m.data_source_id || undefined,
          supplier_product_id: m.supplier_product_id || undefined,
          origin_country: m.origin_country || "",
          is_organic_certified: m.is_organic_certified || false,
        }))
      : []
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddIngredient = useCallback(() => {
    const newIngredient: IngredientCardData = {
      tempId: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      data_source: "openlca",
      name: "",
      quantity: "",
      unit: "",
      lca_sub_stage_id: null,
      origin_country: "",
      is_organic_certified: false,
    };

    setIngredients((prev) => [...prev, newIngredient]);
  }, []);

  const handleUpdateIngredient = useCallback(
    (index: number, field: keyof IngredientCardData, value: any) => {
      setIngredients((prev) =>
        prev.map((ingredient, i) =>
          i === index ? { ...ingredient, [field]: value } : ingredient
        )
      );
    },
    []
  );

  const handleRemoveIngredient = useCallback((index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const validateIngredients = useCallback(() => {
    const errors: string[] = [];

    console.log('[IngredientsForm] Validating ingredients:', ingredients);

    ingredients.forEach((ingredient, index) => {
      console.log(`[IngredientsForm] Validating ingredient ${index + 1}:`, ingredient);

      if (!ingredient.name) {
        errors.push(`Ingredient ${index + 1}: Name is required`);
      }

      const qty = typeof ingredient.quantity === "string"
        ? parseFloat(ingredient.quantity)
        : ingredient.quantity;

      if (!ingredient.quantity || isNaN(qty) || qty <= 0) {
        errors.push(`Ingredient ${index + 1}: Valid quantity is required`);
      }

      if (!ingredient.unit) {
        errors.push(`Ingredient ${index + 1}: Unit is required`);
      }

      if (!ingredient.lca_sub_stage_id) {
        errors.push(`Ingredient ${index + 1}: Life cycle sub-stage is required`);
      }

      if (ingredient.data_source === "openlca" && !ingredient.data_source_id) {
        console.error(`[IngredientsForm] Ingredient ${index + 1} missing data_source_id:`, ingredient);
        errors.push(`Ingredient ${index + 1}: OpenLCA material must be selected from search results`);
      }

      if (ingredient.data_source === "supplier" && !ingredient.supplier_product_id) {
        console.error(`[IngredientsForm] Ingredient ${index + 1} missing supplier_product_id:`, ingredient);
        errors.push(`Ingredient ${index + 1}: Supplier product must be selected from search results`);
      }
    });

    console.log('[IngredientsForm] Validation complete. Errors:', errors);
    return errors;
  }, [ingredients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    console.log('[IngredientsForm] Submit triggered', { ingredientsCount: ingredients.length, ingredients });

    if (ingredients.length === 0) {
      setError("Please add at least one ingredient");
      return;
    }

    const validationErrors = validateIngredients();
    if (validationErrors.length > 0) {
      console.error('[IngredientsForm] Validation errors:', validationErrors);
      setError(validationErrors.join("; "));
      return;
    }

    try {
      setIsSaving(true);

      const materialsToSave = ingredients.map((ingredient) => ({
        id: ingredient.tempId.startsWith("temp-") ? undefined : ingredient.tempId,
        name: ingredient.name,
        quantity: typeof ingredient.quantity === "string"
          ? parseFloat(ingredient.quantity)
          : ingredient.quantity,
        unit: ingredient.unit,
        lca_sub_stage_id: ingredient.lca_sub_stage_id!,
        data_source: ingredient.data_source,
        data_source_id: ingredient.data_source_id,
        supplier_product_id: ingredient.supplier_product_id,
        origin_country: ingredient.origin_country || undefined,
        is_organic_certified: ingredient.is_organic_certified,
      }));

      console.log('[IngredientsForm] Materials to save:', materialsToSave);

      const result = await saveOrUpdateMaterials(lcaId, materialsToSave);

      console.log('[IngredientsForm] Save result:', result);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Materials saved successfully");

      // Small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate and force refresh
      router.push(`/dashboard/lcas/${lcaId}/calculate`);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save materials";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!organizationId) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Please select an organisation to manage ingredients.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ingredients & Materials</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ingredients.length === 0
              ? "No ingredients added yet"
              : `${ingredients.length} ingredient${ingredients.length !== 1 ? "s" : ""} added`}
          </p>
        </div>
        <Button
          type="button"
          onClick={handleAddIngredient}
          disabled={isSaving}
          variant="outline"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Ingredient
        </Button>
      </div>

      {ingredients.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            No ingredients have been added yet
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Add ingredients from the OpenLCA database or your supplier network to build your product LCA
          </p>
          <Button type="button" onClick={handleAddIngredient} disabled={isSaving}>
            <Plus className="mr-2 h-4 w-4" />
            Add First Ingredient
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {ingredients.map((ingredient, index) => (
            <IngredientCard
              key={ingredient.tempId}
              ingredient={ingredient}
              index={index}
              subStages={allSubStages}
              organizationId={organizationId}
              onUpdate={handleUpdateIngredient}
              onRemove={handleRemoveIngredient}
              disabled={isSaving}
            />
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/products")}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || ingredients.length === 0}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save and Continue"}
        </Button>
      </div>
    </form>
  );
}
