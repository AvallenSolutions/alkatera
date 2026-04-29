"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IngredientFormCard } from "@/components/products/IngredientFormCard";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { ProductionStage } from "@/lib/types/products";
import { SectionStatusDot } from "@/components/products/SectionStatusDot";
import { getIngredientSectionStatus } from "@/components/products/lib/section-completion";

type TabValue = 'basics' | 'source' | 'logistics' | 'stage';

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
  /** When true, render `data-tour-anchor` attributes on tab triggers. Set on
   *  the first ingredient row only so the coachmark tour has stable anchors. */
  enableTourAnchors?: boolean;
  /** Controlled tab value. When provided, the tour drives which tab is active. */
  controlledTab?: TabValue;
  onTabChange?: (tab: TabValue) => void;
}

/**
 * Sectioned mini-editor used inside an expanded IngredientRow. The Stage tab
 * is hidden entirely unless the product has a configured production chain.
 */
export function IngredientEditorTabs(props: IngredientEditorTabsProps) {
  const { enableTourAnchors, controlledTab, onTabChange } = props;
  const hasStages = (props.productionStages?.length ?? 0) > 0;
  const [internalTab, setInternalTab] = useState<TabValue>('basics');
  const tab = controlledTab ?? internalTab;
  const setTab = (v: TabValue) => {
    if (onTabChange) onTabChange(v);
    if (controlledTab == null) setInternalTab(v);
  };

  const status = getIngredientSectionStatus(props.ingredient, hasStages);
  const anchor = (key: 'basics' | 'source' | 'logistics') =>
    enableTourAnchors ? { 'data-tour-anchor': key } : {};

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
      <TabsList>
        <TabsTrigger value="basics" className="gap-2" {...anchor('basics')}>
          <span>Basics</span>
          <SectionStatusDot status={status.basics} />
        </TabsTrigger>
        <TabsTrigger value="source" className="gap-2" {...anchor('source')}>
          <span>Source</span>
          <SectionStatusDot status={status.source} />
        </TabsTrigger>
        <TabsTrigger value="logistics" className="gap-2" {...anchor('logistics')}>
          <span>Logistics</span>
          <SectionStatusDot status={status.logistics} />
        </TabsTrigger>
        {hasStages && (
          <TabsTrigger value="stage" className="gap-2">
            <span>Stage</span>
            <SectionStatusDot status={status.stage} />
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="basics" className="pt-3">
        <IngredientFormCard {...props} sectionFilter="basics" />
      </TabsContent>
      <TabsContent value="source" className="pt-3">
        <IngredientFormCard {...props} sectionFilter="source" />
      </TabsContent>
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
