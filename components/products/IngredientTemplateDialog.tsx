"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Leaf,
  Trash2,
  Pencil,
  Check,
  X,
  Package,
  FileDown,
  RefreshCw,
  AlertTriangle,
  Scale,
  Droplet,
} from "lucide-react";
import {
  useIngredientsTemplates,
  templateItemToIngredientForm,
  maturationProfileToTemplate,
  applyMaturationTemplate,
  type IngredientTemplate,
} from "@/hooks/data/useIngredientsTemplates";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import type { MaturationProfile } from "@/lib/types/maturation";
import { getSpiritTypeDefaults } from "@/lib/types/maturation";
import { productVolumeToMl, formatProductVolume } from "@/lib/utils/product-volume";
import { toast } from "sonner";

interface IngredientTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  mode: "save" | "browse";
  currentIngredients?: IngredientFormData[];
  currentProductVolumeValue: number | null;
  currentProductVolumeUnit: string | null;
  currentMaturation?: MaturationProfile | null;
  productId?: string | number;
  productCategory?: string | null;
  onApplyTemplate?: (items: IngredientFormData[]) => void;
  onMaturationApplied?: () => void;
}

function computeScaleFactor(
  template: IngredientTemplate,
  targetValue: number | null,
  targetUnit: string | null
): number {
  const sourceMl = productVolumeToMl(template.source_volume_value, template.source_volume_unit);
  const targetMl = productVolumeToMl(targetValue, targetUnit);
  if (sourceMl && targetMl && sourceMl > 0) {
    return targetMl / sourceMl;
  }
  return 1;
}

function formatScaleFactor(f: number): string {
  if (f >= 1) return `\u00D7 ${f.toFixed(2)}`;
  if (f >= 0.01) return `\u00D7 ${f.toFixed(3)}`;
  return `\u00D7 ${f.toPrecision(2)}`;
}

export function IngredientTemplateDialog({
  open,
  onOpenChange,
  organizationId,
  mode,
  currentIngredients = [],
  currentProductVolumeValue,
  currentProductVolumeUnit,
  currentMaturation = null,
  productId,
  productCategory,
  onApplyTemplate,
  onMaturationApplied,
}: IngredientTemplateDialogProps) {
  const {
    templates,
    loading,
    fetchTemplates,
    saveTemplate,
    deleteTemplate,
    renameTemplate,
    updateTemplateItems,
  } = useIngredientsTemplates(organizationId);

  // Save mode state
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [includeMaturation, setIncludeMaturation] = useState(true);
  const [saving, setSaving] = useState(false);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Inline confirm states
  const [confirmApplyId, setConfirmApplyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmUpdateId, setConfirmUpdateId] = useState<string | null>(null);
  const [applyMaturationChoice, setApplyMaturationChoice] = useState(true);

  const isAgedSpiritProduct = useMemo(
    () => getSpiritTypeDefaults(productCategory ?? null) !== null,
    [productCategory]
  );

  const sortedTemplates = useMemo(() => {
    if (!isAgedSpiritProduct) return templates;
    return [...templates].sort((a, b) => {
      if (a.has_maturation === b.has_maturation) return a.name.localeCompare(b.name);
      return a.has_maturation ? -1 : 1;
    });
  }, [templates, isAgedSpiritProduct]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setTemplateName("");
      setTemplateDescription("");
      setIncludeMaturation(true);
      setRenamingId(null);
      setConfirmApplyId(null);
      setConfirmDeleteId(null);
      setConfirmUpdateId(null);
      setApplyMaturationChoice(true);
    }
  }, [open, fetchTemplates]);

  const validIngredients = currentIngredients.filter((i) => i.name.trim());
  const currentVolumeLabel = formatProductVolume(
    currentProductVolumeValue,
    currentProductVolumeUnit
  );

  const handleSave = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      const maturationPayload =
        currentMaturation && includeMaturation
          ? maturationProfileToTemplate(currentMaturation)
          : null;
      await saveTemplate(
        templateName,
        templateDescription || null,
        validIngredients,
        currentProductVolumeValue,
        currentProductVolumeUnit,
        maturationPayload
      );
      onOpenChange(false);
    } catch {
      // Error already toasted in hook
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async (
    template: IngredientTemplate,
    maturationAction: "apply" | "skip" = "skip"
  ) => {
    if (!onApplyTemplate) return;
    const scaleFactor = computeScaleFactor(
      template,
      currentProductVolumeValue,
      currentProductVolumeUnit
    );
    const forms = template.items.map((it) => templateItemToIngredientForm(it, scaleFactor));
    onApplyTemplate(forms);

    if (
      maturationAction === "apply" &&
      template.maturation &&
      productId != null &&
      organizationId
    ) {
      try {
        const numericProductId =
          typeof productId === "string" ? parseInt(productId, 10) : productId;
        if (Number.isFinite(numericProductId)) {
          await applyMaturationTemplate(
            template.maturation,
            numericProductId as number,
            organizationId
          );
          toast.success("Maturation profile applied");
          onMaturationApplied?.();
        }
      } catch (err) {
        console.error("Failed to apply maturation template", err);
        toast.error("Failed to apply maturation profile");
      }
    }

    onOpenChange(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
    } catch {
      // Error already toasted
    }
    setConfirmDeleteId(null);
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await renameTemplate(id, renameValue);
    } catch {
      // Error already toasted
    }
    setRenamingId(null);
  };

  const handleUpdate = async (id: string) => {
    try {
      // Preserve existing maturation payload on refresh (pass undefined = don't change it).
      await updateTemplateItems(
        id,
        validIngredients,
        currentProductVolumeValue,
        currentProductVolumeUnit
      );
    } catch {
      // Error already toasted
    }
    setConfirmUpdateId(null);
  };

  const startRename = (template: IngredientTemplate) => {
    setRenamingId(template.id);
    setRenameValue(template.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "save" ? "Save Liquid Template" : "Liquid Templates"}
          </DialogTitle>
          <DialogDescription>
            {mode === "save"
              ? "Save your current recipe (and maturation profile, if set) as a reusable template. Apply it to other bottle formats to scale ingredients automatically."
              : "Apply a saved recipe. Ingredient quantities scale to the current product's volume. Liquid templates also include a maturation profile you can apply in one click."}
          </DialogDescription>
        </DialogHeader>

        {mode === "save" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ing-template-name">Template Name</Label>
              <Input
                id="ing-template-name"
                placeholder="e.g. 12yr Single Malt — core liquid"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ing-template-desc">Description (optional)</Label>
              <Textarea
                id="ing-template-desc"
                placeholder="e.g. Barley + first-fill oak, 12 year warehouse maturation"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={2}
              />
            </div>

            {currentVolumeLabel && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Scale className="h-3.5 w-3.5" />
                <span>
                  Source product volume: <strong>{currentVolumeLabel}</strong>
                  <span className="ml-1 opacity-70">
                    (used to scale quantities when applied elsewhere)
                  </span>
                </span>
              </div>
            )}

            {currentMaturation && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <Checkbox
                  id="include-maturation"
                  checked={includeMaturation}
                  onCheckedChange={(checked) => setIncludeMaturation(checked === true)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="include-maturation"
                    className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                  >
                    <Droplet className="h-3.5 w-3.5 text-amber-500" />
                    Include maturation profile
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Barrel type, aging duration, ABV and warehouse energy travel with this
                    template. Batch-level fields (number of barrels, fill volume, bottles
                    produced) must be re-entered per product.
                  </p>
                </div>
              </div>
            )}

            {/* Preview of items to save */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Items to save ({validIngredients.length})
              </Label>
              <div className="rounded-lg border divide-y">
                {validIngredients.map((ing) => (
                  <div
                    key={ing.tempId}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <Leaf className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate">{ing.name}</span>
                    {ing.amount && (
                      <span className="text-xs text-muted-foreground">
                        {ing.amount} {ing.unit}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={!templateName.trim() || saving}
              className="w-full"
            >
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading templates...
              </div>
            ) : sortedTemplates.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Package className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No liquid templates yet. Save your current recipe to reuse it across
                  bottle formats.
                </p>
              </div>
            ) : (
              sortedTemplates.map((template) => {
                const sourceLabel = formatProductVolume(
                  template.source_volume_value,
                  template.source_volume_unit
                );
                const scaleFactor = computeScaleFactor(
                  template,
                  currentProductVolumeValue,
                  currentProductVolumeUnit
                );
                const willScale = scaleFactor !== 1;
                const hasMaturation = template.has_maturation && !!template.maturation;
                const targetHasMaturation = !!currentMaturation;

                return (
                  <div key={template.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {renamingId === template.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(template.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRename(template.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setRenamingId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-sm flex-1">
                            {template.name}
                          </span>
                          {hasMaturation ? (
                            <Badge className="text-xs font-normal bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                              <Droplet className="h-3 w-3 mr-1" />
                              Liquid
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs font-normal">
                              Ingredients
                            </Badge>
                          )}
                          {sourceLabel && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {sourceLabel}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {template.items.length} item
                            {template.items.length !== 1 ? "s" : ""}
                          </Badge>
                          {validIngredients.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Update template with current ingredients"
                              onClick={() => {
                                setConfirmUpdateId(template.id);
                                setConfirmApplyId(null);
                                setConfirmDeleteId(null);
                              }}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startRename(template)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              setConfirmDeleteId(template.id);
                              setConfirmApplyId(null);
                              setConfirmUpdateId(null);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>

                    {template.description && (
                      <p className="text-xs text-muted-foreground">
                        {template.description}
                      </p>
                    )}

                    {/* Item preview */}
                    <div className="flex flex-wrap gap-1">
                      {template.items.map((item, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {item.name || "Unnamed"}
                          {item.amount !== "" && item.amount != null && (
                            <span className="ml-1 opacity-60">
                              ({item.amount}
                              {item.unit})
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>

                    {/* Inline confirmations */}
                    {confirmUpdateId === template.id ? (
                      <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                        <RefreshCw className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        <span className="text-xs text-amber-400 flex-1">
                          Replace this template&apos;s items with your current
                          ingredients
                          {currentVolumeLabel ? ` (${currentVolumeLabel})` : ""}?
                        </span>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleUpdate(template.id)}
                        >
                          Update
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setConfirmUpdateId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : confirmDeleteId === template.id ? (
                      <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/30">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        <span className="text-xs text-red-400 flex-1">
                          Delete this template?
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleDelete(template.id)}
                        >
                          Delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : confirmApplyId === template.id ? (
                      <div className="flex flex-col gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-400 flex-1 space-y-1">
                            <div>This will replace your current ingredients.</div>
                            <div className="flex items-center gap-1 font-medium">
                              <Scale className="h-3 w-3" />
                              {willScale && currentVolumeLabel && sourceLabel ? (
                                <span>
                                  Scaling {sourceLabel} &rarr; {currentVolumeLabel} (
                                  {formatScaleFactor(scaleFactor)})
                                </span>
                              ) : (
                                <span>Will apply as-is (1:1)</span>
                              )}
                            </div>
                            {hasMaturation && !targetHasMaturation && (
                              <label className="flex items-start gap-2 pt-1 cursor-pointer text-foreground">
                                <Checkbox
                                  checked={applyMaturationChoice}
                                  onCheckedChange={(c) =>
                                    setApplyMaturationChoice(c === true)
                                  }
                                  className="mt-0.5"
                                />
                                <span className="flex items-center gap-1">
                                  <Droplet className="h-3 w-3 text-amber-500" />
                                  Also apply maturation profile
                                </span>
                              </label>
                            )}
                            {hasMaturation && targetHasMaturation && (
                              <div className="pt-1 text-foreground">
                                This product already has a maturation profile. Choose
                                how to handle it:
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {hasMaturation && targetHasMaturation ? (
                            <>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleApply(template, "apply")}
                              >
                                Overwrite maturation
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleApply(template, "skip")}
                              >
                                Keep current
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                handleApply(
                                  template,
                                  hasMaturation && applyMaturationChoice
                                    ? "apply"
                                    : "skip"
                                )
                              }
                            >
                              Confirm
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setConfirmApplyId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setConfirmApplyId(template.id);
                          setConfirmDeleteId(null);
                          setConfirmUpdateId(null);
                          setApplyMaturationChoice(true);
                        }}
                      >
                        <FileDown className="h-3.5 w-3.5 mr-1.5" />
                        Apply Liquid Template
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
