"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { PackagingFormCard } from "@/components/products/PackagingFormCard";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";
import type { PackagingCategory } from "@/lib/types/lca";
import { SectionStatusDot } from "@/components/products/SectionStatusDot";
import { getPackagingSectionStatus } from "@/components/products/lib/section-completion";

type SectionKey = 'components' | 'logistics' | 'compliance';

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
  /** Product category for benchmark-based impact previews */
  productCategory?: string | null;
  /** Product unit size in ml, when known — tightens the weight plausibility check */
  containerSizeMl?: number | null;
}

/**
 * Row editor: essentials always visible, optional depth behind one
 * "Add detail" strip of benefit-labelled chips (see IngredientEditorTabs).
 */
export function PackagingEditorTabs(props: PackagingEditorTabsProps) {
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const status = getPackagingSectionStatus(props.packaging);
  const showComponents = !!props.packaging.has_component_breakdown;

  const sections: Array<{ key: SectionKey; label: string; hint: string; show: boolean }> = [
    {
      key: 'components',
      label: 'Materials breakdown',
      hint: 'Breaking this item into its materials improves UK EPR reporting accuracy.',
      show: showComponents,
    },
    {
      key: 'logistics',
      label: 'Where it comes from',
      hint: 'Adding where this comes from lets us calculate transport instead of leaving it out.',
      show: true,
    },
    {
      key: 'compliance',
      label: 'UK EPR details',
      hint: 'Only needed if you report under UK EPR. Safe to skip otherwise.',
      show: true,
    },
  ];
  const visible = sections.filter((sec) => sec.show);
  const addedCount = visible.filter((sec) => status[sec.key] === 'complete').length;
  const active = visible.find((sec) => sec.key === openSection) ?? null;

  return (
    <div className="space-y-3">
      <PackagingFormCard {...props} sectionFilter="basics" />

      <div className="border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Add detail to improve accuracy
          </span>
          <span className="text-[11px] text-muted-foreground">
            {addedCount} of {visible.length} added
          </span>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {visible.map((sec) => (
            <button
              key={sec.key}
              type="button"
              onClick={() => setOpenSection(openSection === sec.key ? null : sec.key)}
              aria-expanded={openSection === sec.key}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                openSection === sec.key
                  ? 'border-primary/60 bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {openSection === sec.key ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {sec.label}
              <SectionStatusDot status={status[sec.key]} />
            </button>
          ))}
        </div>

        {active && (
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/[0.03] p-3">
            <p className="text-xs text-muted-foreground mb-2">{active.hint}</p>
            <PackagingFormCard {...props} sectionFilter={active.key} />
          </div>
        )}
      </div>
    </div>
  );
}
