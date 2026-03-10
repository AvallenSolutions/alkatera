"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Check, ChevronDown, ChevronUp, Plus, Lightbulb } from "lucide-react";
import { getRecipeTemplate, type RecipeTemplateItem } from "@/lib/recipe-templates";
import type { PackagingCategory } from "@/lib/types/lca";

interface RecipeChecklistProps {
  productCategory?: string | null;
  type: "ingredient" | "packaging";
  existingItems: Array<{ name?: string; matched_source_name?: string }>;
  onQuickAdd: (name: string, searchQuery: string, packagingCategory?: PackagingCategory) => void;
}

/**
 * Fuzzy-match a template item label against existing recipe items.
 * Returns true if any existing item name or matched_source_name
 * contains meaningful overlap with the template label.
 */
function isItemFilled(
  templateItem: RecipeTemplateItem,
  existingItems: Array<{ name?: string; matched_source_name?: string }>
): boolean {
  const label = templateItem.label.toLowerCase();
  const searchQuery = templateItem.searchQuery.toLowerCase();

  // Extract meaningful keywords from the label (skip short words)
  const labelKeywords = label
    .split(/[\s/()&,]+/)
    .filter((w) => w.length >= 3);

  for (const item of existingItems) {
    const itemName = (item.name || "").toLowerCase();
    const itemSource = (item.matched_source_name || "").toLowerCase();

    if (!itemName && !itemSource) continue;

    // Check if any label keyword appears in the item name or source
    const hasKeywordMatch = labelKeywords.some(
      (kw) => itemName.includes(kw) || itemSource.includes(kw)
    );

    // Also check if the search query appears in the item
    const hasSearchQueryMatch =
      searchQuery.length >= 3 &&
      (itemName.includes(searchQuery) || itemSource.includes(searchQuery));

    if (hasKeywordMatch || hasSearchQueryMatch) return true;
  }

  return false;
}

export function RecipeChecklist({
  productCategory,
  type,
  existingItems,
  onQuickAdd,
}: RecipeChecklistProps) {
  const [isOpen, setIsOpen] = useState(true);

  const template = useMemo(
    () => getRecipeTemplate(productCategory),
    [productCategory]
  );

  // Filter items for this type (ingredient or packaging)
  const templateItems = useMemo(
    () => template.items.filter((item) => item.type === type),
    [template, type]
  );

  // Count filled vs total
  const filledItems = useMemo(
    () => templateItems.filter((item) => isItemFilled(item, existingItems)),
    [templateItems, existingItems]
  );

  const filledCount = filledItems.length;
  const totalCount = templateItems.length;

  // Don't show if no template items for this type
  if (templateItems.length === 0) return null;

  // Auto-collapse if all items filled
  const allFilled = filledCount === totalCount;

  // Don't render at all if recipe is well-populated (>= 3 items filled for
  // this type) and all template items are accounted for
  const existingFilledCount = existingItems.filter(
    (i) => i.name || i.matched_source_name
  ).length;
  if (allFilled && existingFilledCount >= 3) return null;

  const categoryLabel = template.category === "Generic Beverage"
    ? "Beverage"
    : template.category;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-dashed border-muted-foreground/30 rounded-lg bg-muted/30">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-[#ccff00]" />
              <span className="text-sm font-medium">
                Typical {categoryLabel} Recipe
              </span>
              <Badge
                variant={allFilled ? "default" : "secondary"}
                className={
                  allFilled
                    ? "bg-green-600 text-white"
                    : ""
                }
              >
                {filledCount} / {totalCount}
              </Badge>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-1">
            <p className="text-xs text-muted-foreground mb-2">
              Use this checklist to make sure you haven&apos;t missed anything.
              Click &quot;+ Add&quot; to create a new row with the name pre-filled.
            </p>
            {templateItems.map((item, idx) => {
              const filled = isItemFilled(item, existingItems);
              return (
                <div
                  key={`${item.label}-${idx}`}
                  className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${
                    filled
                      ? "text-muted-foreground"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {filled ? (
                      <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-sm border border-muted-foreground/40 flex-shrink-0" />
                    )}
                    <span className={filled ? "line-through" : ""}>
                      {item.label}
                    </span>
                    {item.required && !filled && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-500/50 text-amber-500">
                        expected
                      </Badge>
                    )}
                  </div>
                  {!filled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-[#ccff00] hover:text-[#ccff00] hover:bg-[#ccff00]/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAdd(
                          item.label,
                          item.searchQuery,
                          item.packagingCategory
                        );
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
