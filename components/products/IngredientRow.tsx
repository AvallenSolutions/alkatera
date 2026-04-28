"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  Shield,
  Database,
  Leaf,
} from "lucide-react";
import { IngredientEditorTabs } from "@/components/products/IngredientEditorTabs";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { ProductionStage } from "@/lib/types/products";

interface IngredientRowProps {
  ingredient: IngredientFormData;
  index: number;
  organizationId: string;
  productionFacilities: any[];
  organizationLat?: number | null;
  organizationLng?: number | null;
  linkedSupplierProducts?: any[];
  onUpdate: (tempId: string, updates: Partial<IngredientFormData>) => void;
  onRemove: (tempId: string) => void;
  canRemove: boolean;
  recipeScaleMode?: 'per_unit' | 'per_batch';
  batchYieldValue?: number | null;
  batchYieldUnit?: string | null;
  productUnitSizeValue?: number | null;
  productUnitSizeUnit?: string | null;
  productionStages?: ProductionStage[];
  /** Auto-expand new (empty) rows so the user can fill them immediately. */
  defaultExpanded?: boolean;
}

function dataSourceBadge(ingredient: IngredientFormData) {
  if (ingredient.is_self_grown) {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Leaf className="h-3 w-3 text-[#ccff00]" /> Self-grown
      </Badge>
    );
  }
  if (ingredient.data_source === 'supplier') {
    return (
      <Badge variant="outline" className="text-xs gap-1 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
        <Shield className="h-3 w-3 text-emerald-600" /> Supplier
      </Badge>
    );
  }
  if (ingredient.data_source === 'openlca' || ingredient.data_source === 'ecoinvent') {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Database className="h-3 w-3" /> Database
      </Badge>
    );
  }
  return null;
}

function isRowComplete(ingredient: IngredientFormData): boolean {
  return Boolean(
    ingredient.name &&
    Number(ingredient.amount) > 0 &&
    ingredient.unit &&
    (ingredient.is_self_grown || ingredient.data_source),
  );
}

export function IngredientRow(props: IngredientRowProps) {
  const { ingredient, index, onRemove, canRemove, defaultExpanded } = props;
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded ?? !isRowComplete(ingredient));

  const carbonPreview = ingredient.carbon_intensity != null
    ? `${ingredient.carbon_intensity.toFixed(3)} kg CO₂e/${ingredient.unit || 'kg'}`
    : null;

  return (
    <Card>
      {/* Compact summary row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 rounded-t-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded bg-orange-500 text-white font-medium text-xs flex-shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {ingredient.name || <span className="text-muted-foreground italic">New ingredient</span>}
            </span>
            {!isRowComplete(ingredient) && (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" aria-label="Incomplete" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {ingredient.amount && ingredient.unit && (
              <span>{ingredient.amount} {ingredient.unit}</span>
            )}
            {dataSourceBadge(ingredient)}
            {carbonPreview && <span>· {carbonPreview}</span>}
          </div>
        </div>
        <span className="text-muted-foreground flex-shrink-0" aria-hidden>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
        {canRemove && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(ingredient.tempId);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onRemove(ingredient.tempId);
              }
            }}
            className="flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded text-destructive hover:bg-destructive/10 cursor-pointer"
            aria-label="Remove ingredient"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {/* Sectioned editor when expanded */}
      {expanded && (
        <div className="border-t px-3 py-3">
          <IngredientEditorTabs {...props} />
        </div>
      )}
    </Card>
  );
}
