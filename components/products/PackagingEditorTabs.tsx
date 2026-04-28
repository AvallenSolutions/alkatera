"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackagingFormCard } from "@/components/products/PackagingFormCard";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { PackagingCategory } from "@/lib/types/lca";

interface PackagingEditorTabsProps {
  packaging: PackagingFormData;
  index: number;
  organizationId: string;
  productionFacilities: any[];
  totalLinkedFacilities?: number;
  organizationLat?: number | null;
  organizationLng?: number | null;
  linkedSupplierProducts?: any[];
  onUpdate: (tempId: string, updates: Partial<PackagingFormData>) => void;
  onRemove: (tempId: string) => void;
  onAddNewWithType?: (category: PackagingCategory) => void;
  canRemove: boolean;
}

/**
 * Sectioned mini-editor inside an expanded PackagingRow. The Components tab is
 * hidden unless the user has toggled `has_component_breakdown` on.
 */
export function PackagingEditorTabs(props: PackagingEditorTabsProps) {
  const showComponentsTab = !!props.packaging.has_component_breakdown;
  const [tab, setTab] = useState<'basics' | 'components' | 'logistics' | 'compliance'>('basics');

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList>
        <TabsTrigger value="basics">Basics</TabsTrigger>
        {showComponentsTab && <TabsTrigger value="components">Components</TabsTrigger>}
        <TabsTrigger value="logistics">Logistics</TabsTrigger>
        <TabsTrigger value="compliance">Compliance</TabsTrigger>
      </TabsList>
      <TabsContent value="basics" className="pt-3">
        <PackagingFormCard {...props} sectionFilter="basics" />
      </TabsContent>
      {showComponentsTab && (
        <TabsContent value="components" className="pt-3">
          <PackagingFormCard {...props} sectionFilter="components" />
        </TabsContent>
      )}
      <TabsContent value="logistics" className="pt-3">
        <PackagingFormCard {...props} sectionFilter="logistics" />
      </TabsContent>
      <TabsContent value="compliance" className="pt-3">
        <PackagingFormCard {...props} sectionFilter="compliance" />
      </TabsContent>
    </Tabs>
  );
}
