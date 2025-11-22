"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Building2, Sprout, Edit, Trash2 } from "lucide-react";
import type { IngredientMaterial } from "@/lib/ingredientOperations";

interface IngredientsListProps {
  ingredients: (IngredientMaterial & { supplier_name?: string | null })[];
  onEdit: (ingredient: IngredientMaterial & { supplier_name?: string | null }) => void;
  onRemove: (ingredientId: string) => void;
  disabled?: boolean;
}

export function IngredientsList({
  ingredients,
  onEdit,
  onRemove,
  disabled = false,
}: IngredientsListProps) {
  const getSourceBadge = (ingredient: IngredientMaterial & { supplier_name?: string | null }) => {
    const { data_source, supplier_name } = ingredient;

    if (data_source === 'supplier') {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
          <Building2 className="h-3 w-3 mr-1" />
          {supplier_name || 'Supplier'}
        </Badge>
      );
    }

    if (data_source === 'primary') {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
          <Sprout className="h-3 w-3 mr-1" />
          Primary Data
        </Badge>
      );
    }

    return (
      <Badge className="bg-grey-100 text-grey-800 dark:bg-grey-800 dark:text-grey-100">
        <Database className="h-3 w-3 mr-1" />
        Database
      </Badge>
    );
  };

  if (ingredients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No ingredients added yet</p>
        <p className="text-xs mt-1">Use the search above to add ingredients</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ingredients.map((ingredient) => (
        <Card key={ingredient.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{ingredient.name}</h3>
                  {getSourceBadge(ingredient)}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Quantity:</span>{' '}
                    <span className="font-medium">
                      {ingredient.quantity} {ingredient.unit}
                    </span>
                  </div>

                  {ingredient.origin_country && (
                    <div className="text-muted-foreground">
                      Origin: {ingredient.origin_country}
                    </div>
                  )}

                  {ingredient.is_organic_certified && (
                    <Badge variant="outline" className="text-xs">
                      Organic
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(ingredient)}
                  disabled={disabled}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(ingredient.id)}
                  disabled={disabled}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
