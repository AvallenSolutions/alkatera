"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { IngredientRow } from "./IngredientRow";

interface MetricData {
  display_name: string;
  category: string;
  value: number;
  unit: string;
  source: string;
  data_quality: "Primary" | "Secondary" | "Proxy";
  is_override: boolean;
}

interface IngredientData {
  id: string;
  name: string;
  weight_kg: number;
  metrics: Record<string, MetricData>;
  originalMetrics: Record<string, MetricData>;
}

interface IngredientListProps {
  ingredients: IngredientData[];
  onIngredientsChange: (ingredients: IngredientData[]) => void;
  onAddIngredient: () => void;
}

export function IngredientList({
  ingredients,
  onIngredientsChange,
  onAddIngredient,
}: IngredientListProps) {
  const handleUpdateIngredient = (id: string, updatedIngredient: IngredientData) => {
    const updatedIngredients = ingredients.map((ing) =>
      ing.id === id ? updatedIngredient : ing
    );
    onIngredientsChange(updatedIngredients);
  };

  const handleDeleteIngredient = (id: string) => {
    const updatedIngredients = ingredients.filter((ing) => ing.id !== id);
    onIngredientsChange(updatedIngredients);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ingredients</h3>
          <p className="text-sm text-muted-foreground">
            Add ingredients and manage their environmental impact metrics
          </p>
        </div>
        <Button onClick={onAddIngredient}>
          <Plus className="mr-2 h-4 w-4" />
          Add Ingredient
        </Button>
      </div>

      {ingredients.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No ingredients added yet. Click "Add Ingredient" to get started.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {ingredients.map((ingredient) => (
            <div key={ingredient.id} className="relative group">
              <IngredientRow
                ingredient={ingredient}
                onUpdate={handleUpdateIngredient}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteIngredient(ingredient.id)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
