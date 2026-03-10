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
  Box,
  Trash2,
  Pencil,
  Check,
  X,
  Package,
  FileDown,
  AlertTriangle,
} from "lucide-react";
import {
  usePackagingTemplates,
  templateItemToPackagingForm,
  type PackagingTemplate,
} from "@/hooks/data/usePackagingTemplates";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";

// Category display labels
const CATEGORY_LABELS: Record<string, string> = {
  container: "Container",
  label: "Label",
  closure: "Closure",
  secondary: "Secondary",
  shipment: "Shipment",
  tertiary: "Tertiary",
};

interface PackagingTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  mode: "save" | "browse";
  currentPackaging?: PackagingFormData[];
  onApplyTemplate?: (items: PackagingFormData[]) => void;
}

export function PackagingTemplateDialog({
  open,
  onOpenChange,
  organizationId,
  mode,
  currentPackaging = [],
  onApplyTemplate,
}: PackagingTemplateDialogProps) {
  const {
    templates,
    loading,
    fetchTemplates,
    saveTemplate,
    deleteTemplate,
    renameTemplate,
  } = usePackagingTemplates(organizationId);

  // Save mode state
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Inline confirm states (avoids nested dialog z-index issues)
  const [confirmApplyId, setConfirmApplyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setTemplateName("");
      setTemplateDescription("");
      setRenamingId(null);
      setConfirmApplyId(null);
      setConfirmDeleteId(null);
    }
  }, [open, fetchTemplates]);

  const validPackaging = currentPackaging.filter((p) => p.name.trim());

  const handleSave = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      await saveTemplate(templateName, templateDescription || null, validPackaging);
      onOpenChange(false);
    } catch {
      // Error already toasted in hook
    } finally {
      setSaving(false);
    }
  };

  const handleApply = (template: PackagingTemplate) => {
    if (!onApplyTemplate) return;
    const forms = template.items.map(templateItemToPackagingForm);
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

  const startRename = (template: PackagingTemplate) => {
    setRenamingId(template.id);
    setRenameValue(template.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "save" ? "Save Packaging Template" : "Packaging Templates"}
          </DialogTitle>
          <DialogDescription>
            {mode === "save"
              ? "Save your current packaging as a reusable template"
              : "Apply a saved template to pre-fill packaging items"}
          </DialogDescription>
        </DialogHeader>

        {mode === "save" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Standard 330ml Can"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-desc">Description (optional)</Label>
              <Textarea
                id="template-desc"
                placeholder="e.g. Standard aluminium can with printed label and cardboard tray"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Preview of items to save */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Items to save ({validPackaging.length})
              </Label>
              <div className="rounded-lg border divide-y">
                {validPackaging.map((pkg) => (
                  <div
                    key={pkg.tempId}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <Box className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate">{pkg.name}</span>
                    {pkg.packaging_category && (
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[pkg.packaging_category] || pkg.packaging_category}
                      </Badge>
                    )}
                    {pkg.net_weight_g && (
                      <span className="text-xs text-muted-foreground">
                        {pkg.net_weight_g}g
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
                  No templates yet. Save your current packaging as a template to
                  reuse it across products.
                </p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-lg border p-3 space-y-2"
                >
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
                        <Badge variant="secondary" className="text-xs">
                          {template.items.length} item{template.items.length !== 1 ? "s" : ""}
                        </Badge>
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
                          onClick={() => setConfirmDeleteId(template.id)}
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
                        {item.packaging_category && (
                          <span className="ml-1 opacity-60">
                            ({CATEGORY_LABELS[item.packaging_category] || item.packaging_category})
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>

                  {/* Inline delete confirmation */}
                  {confirmDeleteId === template.id ? (
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
                    <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-amber-400 flex-1">
                        This will replace your current packaging.
                      </span>
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
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setConfirmApplyId(template.id)}
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1.5" />
                      Apply Template
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
