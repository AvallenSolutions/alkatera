"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  AlertTriangle,
  Link2,
  Link2Off,
  SkipForward,
  Leaf,
  Box,
} from "lucide-react";
import { BOMUploadDialog } from "./BOMUploadDialog";
import { BOMReviewTable, createReviewableItems, type ReviewableBOMItem } from "./BOMReviewTable";
import { MaterialMatchCell } from "@/components/bulk-import/MaterialMatchCell";
import {
  batchMatchMaterials,
  getMatchSelection,
  computeConfidence,
} from "@/lib/bulk-import/batch-matcher";
import { supabase } from "@/lib/supabaseClient";
import type { ExtractedBOMItem, BOMParseResult } from "@/lib/bom/types";
import type { IngredientFormData } from "./IngredientFormCard";
import type { PackagingFormData } from "./PackagingFormCard";
import type {
  MaterialMatchState,
  ProxySuggestion,
  SearchResultForMatch,
} from "@/lib/bulk-import/types";

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
}

type ImportStep = "upload" | "review" | "matching" | "match_review";

interface BOMImportFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (
    ingredients: IngredientFormData[],
    packaging: PackagingFormData[]
  ) => void;
  organizationId: string;
}

export function BOMImportFlow({
  open,
  onOpenChange,
  onImportComplete,
  organizationId,
}: BOMImportFlowProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [reviewItems, setReviewItems] = useState<ReviewableBOMItem[]>([]);
  const [metadata, setMetadata] = useState<BOMParseResult["metadata"]>({});
  const [isImporting, setIsImporting] = useState(false);

  // Matching state
  const [selectedItems, setSelectedItems] = useState<ReviewableBOMItem[]>([]);
  const [matchStates, setMatchStates] = useState<Record<string, MaterialMatchState>>({});
  const [matchProgress, setMatchProgress] = useState({ completed: 0, total: 0 });
  const abortRef = useRef(false);

  // ── Auth token ─────────────────────────────────────────────────────

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  // ── Manual search for MaterialMatchCell ────────────────────────────

  const handleManualSearch = useCallback(
    async (query: string): Promise<SearchResultForMatch[]> => {
      const token = await getAuthToken();
      if (!token) return [];

      const url = `/api/ingredients/search?q=${encodeURIComponent(query)}&organization_id=${organizationId}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.results || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        source_type: r.source_type,
        co2_factor: r.co2_factor,
        source: r.source,
      }));
    },
    [organizationId, getAuthToken]
  );

  // ── Proxy suggestion for MaterialMatchCell ──────────────────────────

  const handleSuggestProxy = useCallback(
    async (ingredientName: string): Promise<ProxySuggestion[]> => {
      const token = await getAuthToken();
      if (!token) return [];

      try {
        const response = await fetch('/api/ingredients/proxy-suggest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ingredient_name: ingredientName,
            ingredient_type: 'ingredient',
          }),
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.suggestions || [];
      } catch {
        return [];
      }
    },
    [getAuthToken]
  );

  // ── Step handlers ──────────────────────────────────────────────────

  const handleItemsExtracted = (
    items: ExtractedBOMItem[],
    extractedMetadata: BOMParseResult["metadata"]
  ) => {
    const reviewable = createReviewableItems(items);
    setReviewItems(reviewable);
    setMetadata(extractedMetadata);
    setStep("review");
  };

  const handleReviewComplete = async (items: ReviewableBOMItem[]) => {
    setSelectedItems(items);

    // Start matching phase
    const token = await getAuthToken();
    if (!token) {
      // Can't match — skip to direct import
      finishImport(items, {});
      return;
    }

    const materials = items.map((item) => ({
      name: item.cleanName,
      type: item.itemType as "ingredient" | "packaging",
    }));

    if (materials.length === 0) {
      finishImport(items, {});
      return;
    }

    setStep("matching");
    setMatchProgress({ completed: 0, total: materials.length });
    abortRef.current = false;

    try {
      const states = await batchMatchMaterials(materials, {
        organizationId,
        authToken: token,
        concurrency: 4,
        onProgress: (completed, total, progressStates) => {
          if (abortRef.current) return;
          setMatchStates(progressStates);
          setMatchProgress({ completed, total });
        },
      });

      if (abortRef.current) return;

      setMatchStates(states);
      setStep("match_review");
    } catch (err) {
      console.error("Matching failed:", err);
      // Move to review even if matching fails
      setStep("match_review");
    }
  };

  const handleSkipMatching = () => {
    abortRef.current = true;
    setStep("match_review");
  };

  const handleSelectMatchResult = useCallback(
    (materialName: string, index: number, manualResults?: SearchResultForMatch[]) => {
      const key = normalise(materialName);
      setMatchStates((prev) => {
        const current = prev[key];
        if (!current) return prev;

        // If manual results provided (from proxy suggestion), replace search results
        const searchResults = manualResults || current.searchResults;

        if (index === -1) {
          return {
            ...prev,
            [key]: {
              ...current,
              searchResults,
              selectedIndex: null,
              status: "no_match",
              userReviewed: true,
            },
          };
        }

        return {
          ...prev,
          [key]: {
            ...current,
            searchResults,
            selectedIndex: index,
            status: "matched",
            autoMatchConfidence: computeConfidence(
              materialName,
              searchResults[index]?.name || ""
            ),
            userReviewed: true,
          },
        };
      });
    },
    []
  );

  const handleConfirmMatches = () => {
    finishImport(selectedItems, matchStates);
  };

  // ── Final import ───────────────────────────────────────────────────

  const finishImport = (
    items: ReviewableBOMItem[],
    states: Record<string, MaterialMatchState>
  ) => {
    setIsImporting(true);

    try {
      const ingredients: IngredientFormData[] = [];
      const packaging: PackagingFormData[] = [];

      for (const item of items) {
        const match = getMatchSelection(item.cleanName, states);

        if (item.itemType === "ingredient") {
          const ingredientData: IngredientFormData = {
            tempId: `ing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.cleanName,
            data_source: match?.data_source ?? null,
            data_source_id: match?.data_source_id ?? undefined,
            supplier_product_id: match?.supplier_product_id ?? undefined,
            amount: item.quantity ?? 0,
            unit: mapUnit(item.unit),
            origin_country: "",
            is_organic_certified: false,
            transport_mode: "truck",
            distance_km: 0,
          };
          ingredients.push(ingredientData);
        } else {
          const packagingData: PackagingFormData = {
            tempId: `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.cleanName,
            data_source: match?.data_source ?? null,
            data_source_id: match?.data_source_id ?? undefined,
            supplier_product_id: match?.supplier_product_id ?? undefined,
            amount: item.quantity ?? 0,
            unit: mapUnit(item.unit),
            packaging_category: detectPackagingCategory(item.cleanName),
            recycled_content_percentage: 0,
            printing_process: "standard_ink",
            net_weight_g: convertToGrams(item.quantity, item.unit),
            origin_country: "",
            transport_mode: "truck",
            distance_km: 0,
            // EPR Compliance fields
            has_component_breakdown: false,
            components: [],
            epr_packaging_level: undefined,
            epr_packaging_activity: undefined,
            epr_is_household: true,
            epr_ram_rating: undefined,
            epr_uk_nation: undefined,
            epr_is_drinks_container: false,
            units_per_group: 1,
          };
          packaging.push(packagingData);
        }
      }

      onImportComplete(ingredients, packaging);
      handleClose();
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setIsImporting(false);
    }
  };

  // ── Dialog management ──────────────────────────────────────────────

  const handleClose = () => {
    setStep("upload");
    setReviewItems([]);
    setSelectedItems([]);
    setMetadata({});
    setMatchStates({});
    setMatchProgress({ completed: 0, total: 0 });
    abortRef.current = true;
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (step === "match_review") {
      setStep("review");
      setMatchStates({});
    } else if (step === "matching") {
      abortRef.current = true;
      setStep("review");
      setMatchStates({});
    } else if (step === "review") {
      setStep("upload");
      setReviewItems([]);
    } else {
      handleClose();
    }
  };

  // ── Match summary stats ────────────────────────────────────────────

  const matchSummary = (() => {
    const states = Object.values(matchStates);
    const matched = states.filter(
      (s) =>
        s.status === "matched" &&
        s.selectedIndex != null &&
        (s.autoMatchConfidence ?? 0) >= 0.7
    ).length;
    const needReview = states.filter(
      (s) =>
        s.status === "matched" &&
        s.selectedIndex != null &&
        (s.autoMatchConfidence ?? 0) < 0.7
    ).length;
    const unlinked = states.filter(
      (s) =>
        s.status === "no_match" ||
        s.status === "error" ||
        s.selectedIndex == null
    ).length;
    return { matched, needReview, unlinked, total: states.length };
  })();

  // ── Render: Upload step ────────────────────────────────────────────

  if (step === "upload") {
    return (
      <BOMUploadDialog
        open={open}
        onOpenChange={handleClose}
        onItemsExtracted={handleItemsExtracted}
      />
    );
  }

  // ── Render: Review step ────────────────────────────────────────────

  if (step === "review") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Extracted Items</DialogTitle>
            <DialogDescription>
              {metadata.productDescription && (
                <span className="block">
                  Product: <strong>{metadata.productDescription}</strong>
                </span>
              )}
              Review and edit the extracted items before matching them to
              emission factor databases.
            </DialogDescription>
          </DialogHeader>

          <BOMReviewTable
            items={reviewItems}
            onItemsChange={setReviewItems}
            onImport={handleReviewComplete}
            onCancel={handleCancel}
            isImporting={false}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // ── Render: Matching progress step ─────────────────────────────────

  if (step === "matching") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-600 animate-pulse" />
              Matching Materials
            </DialogTitle>
            <DialogDescription>
              Searching emission factor databases to find matching entries for
              your materials...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  Matching materials... ({matchProgress.completed}/
                  {matchProgress.total})
                </span>
                <span className="text-muted-foreground">
                  {matchProgress.total > 0
                    ? Math.round(
                        (matchProgress.completed / matchProgress.total) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={
                  matchProgress.total > 0
                    ? (matchProgress.completed / matchProgress.total) * 100
                    : 0
                }
              />
            </div>

            {/* Show matches as they come in */}
            {Object.values(matchStates).filter((s) => s.status === "matched")
              .length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                {Object.values(matchStates)
                  .filter(
                    (s) => s.status === "matched" && s.selectedIndex != null
                  )
                  .slice(0, 8)
                  .map((s) => (
                    <div key={s.materialName} className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                      <span className="truncate">{s.materialName}</span>
                      <span className="text-muted-foreground/50 mx-0.5">
                        →
                      </span>
                      <span className="truncate text-muted-foreground">
                        {s.searchResults[s.selectedIndex!]?.name}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleSkipMatching}
              className="w-full gap-2"
            >
              <SkipForward className="h-4 w-4" />
              Skip Matching
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Render: Match review step ──────────────────────────────────────

  const ingredientItems = selectedItems.filter(
    (i) => i.itemType === "ingredient"
  );
  const packagingItems = selectedItems.filter(
    (i) => i.itemType === "packaging"
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Emission Factor Matches</DialogTitle>
          <DialogDescription>
            Review the auto-matched emission factors for your materials. You can
            change or remove matches before importing.
          </DialogDescription>
        </DialogHeader>

        {/* Match summary banner */}
        {matchSummary.total > 0 && (
          <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg border bg-muted/30">
            <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">Matching:</span>
            {matchSummary.matched > 0 && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                {matchSummary.matched} matched
              </Badge>
            )}
            {matchSummary.needReview > 0 && (
              <Badge variant="secondary" className="gap-1 border-amber-300">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                {matchSummary.needReview} need review
              </Badge>
            )}
            {matchSummary.unlinked > 0 && (
              <Badge variant="outline" className="gap-1">
                <Link2Off className="h-3 w-3 text-red-500" />
                {matchSummary.unlinked} unlinked
              </Badge>
            )}
          </div>
        )}

        <div className="space-y-4">
          {/* Ingredients table */}
          {ingredientItems.length > 0 && (
            <div>
              <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                <Leaf className="h-3.5 w-3.5 text-green-600" />
                Ingredients ({ingredientItems.length})
              </h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground text-xs border-b bg-muted/30">
                      <th className="p-2 pr-4 font-medium">Name</th>
                      <th className="p-2 pr-4 font-medium">Qty</th>
                      <th className="p-2 font-medium">Emission Factor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {ingredientItems.map((item) => {
                      const key = normalise(item.cleanName);
                      const matchState = matchStates[key];
                      return (
                        <tr key={item.id}>
                          <td className="p-2 pr-4">{item.cleanName}</td>
                          <td className="p-2 pr-4 text-muted-foreground">
                            {item.quantity ?? "-"} {item.unit || ""}
                          </td>
                          <td className="p-2">
                            <MaterialMatchCell
                              matchState={matchState}
                              onSelectResult={(idx, manualResults) =>
                                handleSelectMatchResult(item.cleanName, idx, manualResults)
                              }
                              onSuggestProxy={handleSuggestProxy}
                              onManualSearch={async (q) => {
                                return await handleManualSearch(q);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Packaging table */}
          {packagingItems.length > 0 && (
            <div>
              <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                <Box className="h-3.5 w-3.5 text-amber-600" />
                Packaging ({packagingItems.length})
              </h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground text-xs border-b bg-muted/30">
                      <th className="p-2 pr-4 font-medium">Name</th>
                      <th className="p-2 pr-4 font-medium">Qty</th>
                      <th className="p-2 font-medium">Emission Factor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {packagingItems.map((item) => {
                      const key = normalise(item.cleanName);
                      const matchState = matchStates[key];
                      return (
                        <tr key={item.id}>
                          <td className="p-2 pr-4">{item.cleanName}</td>
                          <td className="p-2 pr-4 text-muted-foreground">
                            {item.quantity ?? "-"} {item.unit || ""}
                          </td>
                          <td className="p-2">
                            <MaterialMatchCell
                              matchState={matchState}
                              onSelectResult={(idx, manualResults) =>
                                handleSelectMatchResult(item.cleanName, idx, manualResults)
                              }
                              onSuggestProxy={handleSuggestProxy}
                              onManualSearch={async (q) => {
                                return await handleManualSearch(q);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Back to Review
          </Button>
          <Button onClick={handleConfirmMatches} disabled={isImporting}>
            {isImporting ? "Importing..." : "Confirm & Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function mapUnit(unit: string | null): string {
  if (!unit) return "kg";

  const unitMap: Record<string, string> = {
    kg: "kg",
    g: "g",
    L: "l",
    l: "l",
    ml: "ml",
    m: "unit",
    unit: "unit",
  };

  return unitMap[unit] || "kg";
}

function detectPackagingCategory(
  name: string
): "container" | "label" | "closure" | "secondary" | null {
  const nameLower = name.toLowerCase();

  if (nameLower.includes("label") || nameLower.includes("sticker")) {
    return "label";
  }
  if (
    nameLower.includes("cap") ||
    nameLower.includes("lid") ||
    nameLower.includes("closure") ||
    nameLower.includes("cork") ||
    nameLower.includes("capsule")
  ) {
    return "closure";
  }
  if (
    nameLower.includes("box") ||
    nameLower.includes("carton") ||
    nameLower.includes("divider") ||
    nameLower.includes("tape") ||
    nameLower.includes("case") ||
    nameLower.includes("crate")
  ) {
    return "secondary";
  }
  if (
    nameLower.includes("bottle") ||
    nameLower.includes("glass") ||
    nameLower.includes("jar") ||
    nameLower.includes("can") ||
    nameLower.includes("container") ||
    nameLower.includes("pouch")
  ) {
    return "container";
  }

  return "container";
}

function convertToGrams(quantity: number | null, unit: string | null): number {
  if (!quantity) return 0;

  switch (unit) {
    case "kg":
      return quantity * 1000;
    case "g":
      return quantity;
    default:
      return quantity;
  }
}
