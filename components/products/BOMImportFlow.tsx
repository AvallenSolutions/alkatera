"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  Loader2,
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
import { scaleQuantityToUnit, type QuantityBasis } from "@/lib/bom/basis";
import { unitSizeToMl, canonicaliseUnit } from "@/lib/constants/material-units";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select as SizeSelect,
  SelectContent as SizeSelectContent,
  SelectItem as SizeSelectItem,
  SelectTrigger as SizeSelectTrigger,
  SelectValue as SizeSelectValue,
} from "@/components/ui/select";
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

type ImportStep = "upload" | "auto_parsing" | "review" | "matching" | "match_review";

interface BOMImportFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (
    ingredients: IngredientFormData[],
    packaging: PackagingFormData[]
  ) => void;
  organizationId: string;
  /**
   * Optional pre-supplied file. When provided, the upload step is skipped and
   * the file is sent straight to /api/bom/parse on open. Used by the Universal
   * Dropzone carry-through flow so users don't re-upload a file they already
   * dropped in the header.
   */
  initialFile?: File | null;
  /**
   * Optional pre-extracted line items (from the smart-upload classifier). When
   * present these are used directly and the raw file is NOT re-parsed — the
   * classifier reads recipe workbooks far better than the regex parser, and
   * only it captures the per-litre/per-hectolitre basis.
   */
  initialItems?: ExtractedBOMItem[] | null;
  /**
   * The finished product's size in millilitres, when known (attach-to-existing
   * flows load the product first). Authoritative source for scaling per-litre
   * dosages to per-unit. When null, the review step asks for it.
   */
  productUnitSizeMl?: number | null;
  /** Hint for the finished-size input when productUnitSizeMl is unknown. */
  initialUnitSize?: { value?: number | null; unit?: string | null } | null;
}

export function BOMImportFlow({
  open,
  onOpenChange,
  onImportComplete,
  organizationId,
  initialFile,
  initialItems,
  productUnitSizeMl,
  initialUnitSize,
}: BOMImportFlowProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [reviewItems, setReviewItems] = useState<ReviewableBOMItem[]>([]);
  const [rawItems, setRawItems] = useState<ExtractedBOMItem[]>([]);
  const [metadata, setMetadata] = useState<BOMParseResult["metadata"]>({});
  const [isImporting, setIsImporting] = useState(false);
  const [autoParseError, setAutoParseError] = useState<string | null>(null);
  // When the classifier's line items look like they hit the per-sheet row cap
  // (see lib/ingest/spreadsheet-text.ts maxRowsPerSheet), warn the user that
  // rows near the bottom of a big sheet may have been dropped.
  const [rowCapNotice, setRowCapNotice] = useState(false);
  const autoParsedRef = useRef(false);

  // Finished-product size used to scale per-litre dosages to per-unit. When the
  // caller passes productUnitSizeMl (a loaded product), that wins and the input
  // is locked; otherwise the user sets it in the review step.
  const [sizeValue, setSizeValue] = useState<string>(
    initialUnitSize?.value != null ? String(initialUnitSize.value) : "",
  );
  const [sizeUnit, setSizeUnit] = useState<string>(
    (initialUnitSize?.unit || "ml").toLowerCase() === "l" ? "l" : "ml",
  );
  const sizeLocked = productUnitSizeMl != null && productUnitSizeMl > 0;
  const effectiveSizeMl = sizeLocked
    ? productUnitSizeMl!
    : unitSizeToMl(sizeValue, sizeUnit);

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
            organization_id: organizationId,
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

  // Volumetric ingredient dosages only need scaling; packaging is always
  // per-unit. Used to decide whether to prompt for the finished size.
  const hasVolumetricItems = rawItems.some(
    (i) => i.itemType === "ingredient" && i.quantityBasis && i.quantityBasis !== "per_unit",
  );

  const seedReview = (items: ExtractedBOMItem[], sizeMl: number | null) => {
    setReviewItems(createReviewableItems(convertItemsToUnit(items, sizeMl)));
  };

  const handleItemsExtracted = (
    items: ExtractedBOMItem[],
    extractedMetadata: BOMParseResult["metadata"]
  ) => {
    setRawItems(items);
    seedReview(items, effectiveSizeMl);
    setMetadata(extractedMetadata);
    setStep("review");
  };

  // Re-scale the review rows whenever the finished size changes. This covers
  // the user typing a size AND the create/attach flow where productUnitSizeMl
  // arrives a beat after the dialog opens (the product loads async) — without
  // this, opening before the 250 ml size was known left the rows unscaled and
  // the locked size never re-applied.
  useEffect(() => {
    if (!rawItems.length || !hasVolumetricItems) return;
    seedReview(rawItems, effectiveSizeMl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSizeMl]);

  // Carry-through (preferred): when the smart-upload classifier already
  // extracted line items, use them directly and skip the raw-file re-parse.
  useEffect(() => {
    if (!open || autoParsedRef.current) return;
    if (!initialItems || initialItems.length === 0) return;
    autoParsedRef.current = true;
    // Heuristic: the classifier serialises at most 100 rows per sheet, so a
    // line-item count at or above that threshold is a strong hint the source
    // file was longer than what the model actually read. Non-blocking notice
    // only — we can't tell for certain without the raw row count.
    setRowCapNotice(initialItems.length >= 100);
    handleItemsExtracted(initialItems, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItems]);

  // Carry-through (fallback): when only a file is provided (e.g. a manually
  // uploaded BOM), skip the upload step and parse it directly.
  useEffect(() => {
    if (!open) {
      autoParsedRef.current = false;
      setAutoParseError(null);
      return;
    }
    if (!initialFile || autoParsedRef.current) return;
    autoParsedRef.current = true;
    setStep("auto_parsing");
    setAutoParseError(null);

    (async () => {
      try {
        const fd = new FormData();
        fd.append("file", initialFile);
        const res = await fetch("/api/bom/parse", { method: "POST", body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to parse BOM");
        }
        const result = await res.json();
        if (!result.success || !result.items?.length) {
          throw new Error(result.errors?.[0] || "No items could be extracted");
        }
        handleItemsExtracted(result.items, result.metadata || {});
      } catch (err: any) {
        setAutoParseError(err?.message || "Failed to parse uploaded BOM");
        setStep("upload");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile]);

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
        // Pull the full SearchResultForMatch so we can carry through the
        // matched source's display name + co2_factor into the form. Without
        // this, the import saves only the DB ids and the ingredient cards
        // render as if nothing was matched.
        const stateForItem = states[normalise(item.cleanName)];
        const selectedResult =
          stateForItem && stateForItem.selectedIndex != null
            ? stateForItem.searchResults[stateForItem.selectedIndex]
            : undefined;

        if (item.itemType === "ingredient") {
          const ingredientData: IngredientFormData = {
            // Must carry the `temp-` prefix: every recipe-editor save path
            // classifies a row as new-vs-existing on tempId.startsWith('temp-').
            // A bare `ing-` id is read as an existing DB row and the save tries
            // .update().eq('id', 'ing-...') against a uuid column, which errors.
            tempId: `temp-ing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.cleanName,
            data_source: match?.data_source ?? null,
            data_source_id: match?.data_source_id ?? undefined,
            supplier_product_id: match?.supplier_product_id ?? undefined,
            matched_source_name: selectedResult?.name,
            carbon_intensity: selectedResult?.co2_factor ?? undefined,
            amount: item.quantity ?? 0,
            unit: canonicaliseUnit(item.unit) ?? "kg",
            origin_country: "",
            is_organic_certified: false,
            transport_mode: "truck",
            distance_km: 0,
            // Imported matches are used immediately but flagged for a
            // one-click confirmation (apply + flag model).
            match_status: match?.data_source_id || match?.supplier_product_id ? 'auto_matched' as const : 'needs_review' as const,
          };
          ingredients.push(ingredientData);
        } else {
          const packagingData: PackagingFormData = {
            // `temp-` prefix required (see ingredient note above): without it the
            // save treats this as an existing row and packaging never persists.
            tempId: `temp-pkg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.cleanName,
            data_source: match?.data_source ?? null,
            data_source_id: match?.data_source_id ?? undefined,
            supplier_product_id: match?.supplier_product_id ?? undefined,
            matched_source_name: selectedResult?.name,
            carbon_intensity: selectedResult?.co2_factor ?? undefined,
            amount: item.quantity ?? 0,
            unit: canonicaliseUnit(item.unit) ?? "kg",
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
            // A BOM doesn't say how many products share a case/pallet, so
            // shared-category rows must ask the user before they can save.
            units_per_group: '',
            match_status: match?.data_source_id || match?.supplier_product_id ? 'auto_matched' as const : 'needs_review' as const,
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
    setRawItems([]);
    setSelectedItems([]);
    setMetadata({});
    setMatchStates({});
    setMatchProgress({ completed: 0, total: 0 });
    setRowCapNotice(false);
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

  // ── Render: Auto-parse step (carry-through from Universal Dropzone) ──

  if (step === "auto_parsing") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Parsing your BOM</DialogTitle>
            <DialogDescription>
              Reading the file you uploaded — this usually takes a few seconds.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Extracting ingredients and packaging…</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Render: Upload step ────────────────────────────────────────────

  if (step === "upload") {
    return (
      <>
        {autoParseError && (
          <div className="fixed top-4 right-4 z-[100] max-w-sm rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            Couldn&apos;t parse the uploaded BOM: {autoParseError}. Try uploading it manually.
          </div>
        )}
        <BOMUploadDialog
          open={open}
          onOpenChange={handleClose}
          onItemsExtracted={handleItemsExtracted}
        />
      </>
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

          {hasVolumetricItems && (
            <div className="rounded-lg border border-[#8da300]/40 bg-[#ccff00]/5 p-3 space-y-2">
              <p className="text-sm">
                This recipe is dosed per litre. Amounts are scaled to your finished
                product size so they save as the amount in one unit.
              </p>
              {sizeLocked ? (
                <p className="text-xs text-muted-foreground">
                  Using the product&apos;s size:{" "}
                  <strong>{effectiveSizeMl} ml</strong>. The quantities below are
                  per unit.
                </p>
              ) : (
                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="bom-finished-size" className="text-xs">
                      Finished product size
                    </Label>
                    <Input
                      id="bom-finished-size"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="h-8 w-28"
                      placeholder="250"
                      value={sizeValue}
                      onChange={(e) => setSizeValue(e.target.value)}
                    />
                  </div>
                  <SizeSelect value={sizeUnit} onValueChange={setSizeUnit}>
                    <SizeSelectTrigger className="h-8 w-20">
                      <SizeSelectValue />
                    </SizeSelectTrigger>
                    <SizeSelectContent>
                      <SizeSelectItem value="ml">ml</SizeSelectItem>
                      <SizeSelectItem value="l">L</SizeSelectItem>
                    </SizeSelectContent>
                  </SizeSelect>
                  {!effectiveSizeMl && (
                    <p className="text-xs text-amber-600 pb-1.5">
                      Set a size to scale the per-litre amounts.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {rowCapNotice && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Only the first 100 rows were read from this file; check nothing is
                missing. If your recipe is longer, add any missing items by hand
                below.
              </span>
            </div>
          )}

          <BOMReviewTable
            items={reviewItems}
            onItemsChange={setReviewItems}
            onImport={handleReviewComplete}
            onCancel={handleCancel}
            isImporting={false}
            // Hard gate: a per-litre recipe can't be imported until we know the
            // finished unit size, otherwise dosages would save unscaled.
            blockImportReason={
              hasVolumetricItems && !effectiveSizeMl
                ? "Enter the finished unit size above before importing, so per-litre amounts scale to one unit."
                : null
            }
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

/**
 * Convert extracted items to per-unit amounts. Ingredient dosages carrying a
 * per-litre / per-hectolitre basis are scaled by the product's finished size;
 * packaging and already-per-unit amounts pass through untouched. After this
 * every item's quantity is per finished unit, so the review table shows and
 * saves the right number.
 */
function convertItemsToUnit(
  items: ExtractedBOMItem[],
  sizeMl: number | null,
): ExtractedBOMItem[] {
  return items.map((item) => {
    const basis: QuantityBasis | undefined =
      item.itemType === "packaging" ? "per_unit" : item.quantityBasis;
    if (!basis || basis === "per_unit") return { ...item, quantityBasis: "per_unit" };
    const { amount, scaled } = scaleQuantityToUnit(item.quantity, basis, sizeMl);
    // Only relabel to per_unit when we actually converted using a known finished
    // size. When the size is unknown scaling can't happen, so KEEP the real
    // per-litre / per-hectolitre basis — relabelling it per_unit here would save
    // a per-litre dosage as if it were a per-unit amount, and the Import gate
    // relies on the surviving volumetric basis to know a size is still needed.
    if (!scaled) return { ...item, quantityBasis: basis };
    return { ...item, quantity: amount, quantityBasis: "per_unit" };
  });
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

// Only mass units carry a real gram weight. For counts ("unit"), volumes ("ml",
// "L") or anything unknown we must NOT fabricate a weight — treating "1 unit" as
// "1 g" silently invents a nonsense net weight. Return '' (unset) so the
// packaging card shows a blank the user can fill, rather than a fake number.
function convertToGrams(
  quantity: number | null,
  unit: string | null,
): number | "" {
  if (!quantity || quantity <= 0) return "";

  switch (canonicaliseUnit(unit)) {
    case "kg":
      return quantity * 1000;
    case "g":
      return quantity;
    default:
      return "";
  }
}
