"use client";

import { useState, useEffect } from "react";
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
  CheckCircle2,
} from "lucide-react";
import { IngredientEditorTabs } from "@/components/products/IngredientEditorTabs";
import { MatchStatusBadge } from "@/components/products/MatchStatusBadge";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import { AskRosaButton } from "@/components/rosa/AskRosaButton";
import type { ProductionStage } from "@/lib/types/products";
import {
  getIngredientSectionStatus,
  summariseIngredientSections,
} from "@/components/products/lib/section-completion";

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
  /** Product category for benchmark-based impact previews */
  productCategory?: string | null;
  recipeScaleMode?: 'per_unit' | 'per_batch';
  batchYieldValue?: number | null;
  batchYieldUnit?: string | null;
  productUnitSizeValue?: number | null;
  productUnitSizeUnit?: string | null;
  productionStages?: ProductionStage[];
  /** Auto-expand new (empty) rows so the user can fill them immediately. */
  defaultExpanded?: boolean;
  /** Force expanded externally (used by the first-run tour). */
  forceExpanded?: boolean;
  /** Render data-tour-anchor attributes on the inner tabs. */
  enableTourAnchors?: boolean;
  /** Controlled tab value (used by the tour to drive which tab is active). */
  controlledTab?: 'basics' | 'source' | 'logistics' | 'stage';
  onTabChange?: (tab: 'basics' | 'source' | 'logistics' | 'stage') => void;
}

function dataSourceBadge(ingredient: IngredientFormData) {
  if (ingredient.is_self_grown) {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Leaf className="h-3 w-3 text-studio-good" /> Self-grown
      </Badge>
    );
  }
  if (ingredient.data_source === 'supplier') {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Shield className="h-3 w-3 text-studio-good" /> Supplier
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

export function IngredientRow(props: IngredientRowProps) {
  const {
    ingredient,
    index,
    onRemove,
    onUpdate,
    canRemove,
    defaultExpanded,
    forceExpanded,
    enableTourAnchors,
    controlledTab,
    onTabChange,
    productionStages,
  } = props;
  // Rows added by the composer arrive collapsed even before their factor
  // resolves — the full record (IngredientEditorTabs) opens only via the
  // "Open the full record." row, never automatically, so the composer stays
  // the only visible add path (tasks/data-revolution-plan.md Pillar 2).
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded ?? false);
  // The onboarding tour opens the first row so its tabs are visible for the
  // coachmarks, but the user must still be able to collapse it — guide, don't
  // lock. So forceExpanded nudges the row open rather than pinning it.
  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);
  const isExpanded = expanded;

  const carbonPreview = ingredient.carbon_intensity != null
    ? `${ingredient.carbon_intensity.toFixed(3)} kg CO₂e/${ingredient.unit || 'kg'}`
    : null;

  const hasChain = (productionStages?.length ?? 0) > 0;
  const sectionStatus = getIngredientSectionStatus(ingredient, hasChain);
  const summary = summariseIngredientSections(sectionStatus);
  const allComplete = summary.complete === summary.total && summary.total > 0;

  return (
    <Card>
      {/* Compact summary row. A div (not a <button>) because it contains other
          interactive controls (AskRosaButton, remove) — a button nested in a
          button is invalid HTML and triggers a hydration warning. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 rounded-t-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-studio-ink/5 font-mono text-[10px] text-studio-dim flex-shrink-0">
          {String(index + 1).padStart(2, '0')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {ingredient.name || <span className="text-muted-foreground italic">New ingredient</span>}
            </span>
            {allComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-studio-good flex-shrink-0" aria-label="Complete" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-studio-attention flex-shrink-0" aria-label="Incomplete" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {ingredient.amount && ingredient.unit && (
              <span>{ingredient.amount} {ingredient.unit}</span>
            )}
            {dataSourceBadge(ingredient)}
            <MatchStatusBadge
              status={ingredient.match_status}
              onConfirm={() => onUpdate(ingredient.tempId, { match_status: 'verified' })}
            />
            {carbonPreview && <span>· {carbonPreview}</span>}
            {summary.total > 0 && (
              <span>· {summary.complete} of {summary.total} sections complete</span>
            )}
          </div>
        </div>
        {/* "Ask Rosa about this ingredient" — only shown when there's no
            matched factor yet, so the user gets help right when they need
            it. Pins this specific ingredient as Rosa's selectedEntity so
            she can answer "which factor for maple syrup?" with full
            context. */}
        {!ingredient.matched_source_name && ingredient.name && (
          <span
            onClick={e => e.stopPropagation()}
            className="flex-shrink-0"
          >
            <AskRosaButton
              entity={{
                type: 'ingredient',
                id: ingredient.tempId,
                label: `Ingredient: ${ingredient.name}`,
                data: {
                  name: ingredient.name,
                  amount: ingredient.amount,
                  unit: ingredient.unit,
                  origin_country: ingredient.origin_country || null,
                  is_organic: ingredient.is_organic_certified,
                },
              }}
              prompt={`Help me pick the right emission factor for "${ingredient.name}". Walk me through the most likely matches and what you'd recommend.`}
            />
          </span>
        )}
        <span className="flex items-center gap-1 flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-dim">
          {isExpanded ? 'Close the full record.' : 'Open the full record.'}
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
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
      </div>

      {/* Sectioned editor when expanded */}
      {isExpanded && (
        <div className="border-t px-3 py-3">
          <IngredientEditorTabs
            {...props}
            enableTourAnchors={enableTourAnchors}
            controlledTab={controlledTab}
            onTabChange={onTabChange}
          />
        </div>
      )}
    </Card>
  );
}
