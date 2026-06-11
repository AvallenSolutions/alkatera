"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
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
  /** Product category for benchmark-based impact previews */
  productCategory?: string | null;
  recipeScaleMode?: 'per_unit' | 'per_batch';
  batchYieldValue?: number | null;
  batchYieldUnit?: string | null;
  productUnitSizeValue?: number | null;
  productUnitSizeUnit?: string | null;
  productionStages?: ProductionStage[];
  /** When true, render `data-tour-anchor` attributes on section triggers. Set on
   *  the first ingredient row only so the coachmark tour has stable anchors. */
  enableTourAnchors?: boolean;
  /** Controlled section value. When provided, the tour drives which section is open. */
  controlledTab?: TabValue;
  onTabChange?: (tab: TabValue) => void;
}

/**
 * Row editor: the essentials (name, factor, amount) are always visible; the
 * optional depth lives behind one "Add detail to improve accuracy" strip of
 * chips. Tabs hid what was in them and added a navigation layer to a small
 * form — chips labelled with their benefit communicate "optional extras"
 * and open only the fields for that one thing. Same fields, same depth.
 */
export function IngredientEditorTabs(props: IngredientEditorTabsProps) {
  const { enableTourAnchors, controlledTab, onTabChange } = props;
  const hasStages = (props.productionStages?.length ?? 0) > 0;
  const [openSection, setOpenSection] = useState<Exclude<TabValue, 'basics'> | null>(
    controlledTab && controlledTab !== 'basics' ? controlledTab : null
  );
  // The tour advances by changing controlledTab — mirror it into local state
  // so the highlight follows the tour, but a user click always wins.
  useEffect(() => {
    if (controlledTab != null) {
      setOpenSection(controlledTab === 'basics' ? null : controlledTab);
    }
  }, [controlledTab]);

  const toggleSection = (key: Exclude<TabValue, 'basics'>) => {
    const next = openSection === key ? null : key;
    setOpenSection(next);
    onTabChange?.(next ?? 'basics');
  };

  const status = getIngredientSectionStatus(props.ingredient, hasStages);
  const anchor = (key: 'basics' | 'source' | 'logistics') =>
    enableTourAnchors ? { 'data-tour-anchor': key } : {};

  const sections: Array<{
    key: Exclude<TabValue, 'basics'>;
    label: string;
    hint: string;
    show: boolean;
  }> = [
    {
      key: 'source',
      label: 'Supplier link',
      hint: "Linking a supplier or your own growing data makes this ingredient's footprint more accurate and verifiable.",
      show: true,
    },
    {
      key: 'logistics',
      label: 'Where it comes from',
      hint: 'Adding where this comes from lets us calculate transport instead of leaving it out.',
      show: true,
    },
    {
      key: 'stage',
      label: 'Production stage',
      hint: 'Assigning a production stage unlocks stage-by-stage insights.',
      show: hasStages,
    },
  ];
  const visible = sections.filter((sec) => sec.show);
  const addedCount = visible.filter((sec) => status[sec.key] === 'complete').length;
  const active = visible.find((sec) => sec.key === openSection) ?? null;

  return (
    <div className="space-y-3">
      <div {...anchor('basics')}>
        <IngredientFormCard {...props} sectionFilter="basics" />
      </div>

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
              onClick={() => toggleSection(sec.key)}
              aria-expanded={openSection === sec.key}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                openSection === sec.key
                  ? 'border-primary/60 bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
              {...(sec.key !== 'stage' ? anchor(sec.key) : {})}
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
            <IngredientFormCard {...props} sectionFilter={active.key} />
          </div>
        )}
      </div>
    </div>
  );
}
