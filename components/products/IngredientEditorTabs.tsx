"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IngredientFormCard } from "@/components/products/IngredientFormCard";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { ProductionStage } from "@/lib/types/products";

interface IngredientEditorTabsProps {
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
}

/**
 * Sectioned mini-editor used inside an expanded IngredientRow. The Stage tab
 * is hidden entirely unless the product has a configured production chain.
 */
export function IngredientEditorTabs(props: IngredientEditorTabsProps) {
  const hasStages = (props.productionStages?.length ?? 0) > 0;
  const showSourceTab = true; // Source tab always shown; sub-toggles are feature-gated inside.
  const [tab, setTab] = useState<'basics' | 'source' | 'logistics' | 'stage'>('basics');

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList>
        <TabsTrigger value="basics">Basics</TabsTrigger>
        {showSourceTab && <TabsTrigger value="source">Source</TabsTrigger>}
        <TabsTrigger value="logistics">Logistics</TabsTrigger>
        {hasStages && <TabsTrigger value="stage">Stage</TabsTrigger>}
      </TabsList>
      <TabsContent value="basics" className="pt-3">
        <IngredientFormCard {...props} sectionFilter="basics" />
      </TabsContent>
      {showSourceTab && (
        <TabsContent value="source" className="pt-3">
          <IngredientFormCard {...props} sectionFilter="source" />
        </TabsContent>
      )}
      <TabsContent value="logistics" className="pt-3">
        <IngredientFormCard {...props} sectionFilter="logistics" />
      </TabsContent>
      {hasStages && (
        <TabsContent value="stage" className="pt-3">
          <IngredientFormCard {...props} sectionFilter="stage" />
        </TabsContent>
      )}
    </Tabs>
  );
}
