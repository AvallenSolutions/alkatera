"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import {
  useIngredientsTemplates,
  templateItemToIngredientForm,
  type IngredientTemplate,
} from "@/hooks/data/useIngredientsTemplates";
import type { IngredientFormData } from "@/components/products/IngredientFormCard";
import { productVolumeToMl, formatProductVolume } from "@/lib/utils/product-volume";

interface IngredientTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  mode: "save" | "browse";
  currentIngredients?: IngredientFormData[];
  currentProductVolumeValue: number | null;
  currentProductVolumeUnit: string | null;
  onApplyTemplate?: (items: IngredientFormData[]) => void;
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
  onApplyTemplate,
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
  const [saving, setSaving] = useState(false);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Inline confirm states
  const [confirmApplyId, setConfirmApplyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmUpdateId, setConfirmUpdateId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setTemplateName("");
      setTemplateDescription("");
      setRenamingId(null);
      setConfirmApplyId(null);
      setConfirmDeleteId(null);
      setConfirmUpdateId(null);
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
      await saveTemplate(
        templateName,
        templateDescription || null,
        validIngredients,
        currentProductVolumeValue,
        currentProductVolumeUnit
      );
      onOpenChange(false);
    } catch {
      // Error already toasted in hook
    } finally {
      setSaving(false);
    }
  };

  const handleApply = (template: IngredientTemplate) => {
    if (!onApplyTemplate) return;
    const scaleFactor = computeScaleFactor(
      template,
      currentProductVolumeValue,
      currentProductVolumeUnit
    );
    const forms = template.items.map((it) => templateItemToIngredientForm(it, scaleFactor));
    onApplyTemplate(forms);
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
            {mode === "save" ? "Save Ingredients Template" : "Ingredients Templates"}
          </DialogTitle>
          <DialogDescription>
            {mode === "save"
              ? "Save your current recipe as a reusable template. When applied to a product of a different volume, ingredient quantities will scale automatically."
              : "Apply a saved recipe. Quantities will scale to the current product's volume where possible."}
          </DialogDescription>
        </DialogHeader>

        {mode === "save" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ing-template-name">Template Name</Label>
              <Input
                id="ing-template-name"
                placeholder="e.g. Classic London Dry Gin"
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
                placeholder="e.g. Our core botanical recipe for 70cl bottles"
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
            ) : templates.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Package className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No templates yet. Save your current ingredients as a template to
                  reuse them across products.
                </p>
              </div>
            ) : (
              templates.map((template) => {
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
                          <div className="text-xs text-amber-400 flex-1 space-y-0.5">
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
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleApply(template)}
                          >
                            Confirm
                          </Button>
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
                        }}
                      >
                        <FileDown className="h-3.5 w-3.5 mr-1.5" />
                        Apply Template
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
