"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, ChevronDown, ChevronRight, Layers, AlertTriangle, Sparkles } from "lucide-react";
import type { EPRMaterialType, PackagingMaterialComponent } from "@/lib/types/lca";

// EPR Material types organized by category for the dropdown
const EPR_MATERIAL_CATEGORIES = [
  {
    label: "Paper & Board",
    items: [
      { value: "paper_cardboard", label: "Paper / Cardboard" },
      { value: "fibre_composite", label: "Fibre-based Composite" },
    ],
  },
  {
    label: "Plastics",
    items: [
      { value: "plastic_rigid", label: "Plastic - Rigid" },
      { value: "plastic_flexible", label: "Plastic - Flexible" },
    ],
  },
  {
    label: "Metals",
    items: [
      { value: "aluminium", label: "Aluminium" },
      { value: "steel", label: "Steel" },
    ],
  },
  {
    label: "Other Materials",
    items: [
      { value: "glass", label: "Glass" },
      { value: "wood", label: "Wood" },
      { value: "other", label: "Other (bamboo, ceramic, cork, etc.)" },
    ],
  },
  {
    label: "Consumables",
    items: [
      { value: "adhesive", label: "Adhesive / Glue" },
      { value: "ink", label: "Ink" },
      { value: "coating", label: "Coating" },
      { value: "lacquer", label: "Lacquer" },
    ],
  },
];

// Preset configurations for common packaging types
export const EPR_COMPONENT_PRESETS = {
  paper_label: {
    name: "Paper Label (wet glue)",
    components: [
      { epr_material_type: "paper_cardboard" as EPRMaterialType, component_name: "Paper substrate", weight_pct: 90 },
      { epr_material_type: "adhesive" as EPRMaterialType, component_name: "Wet glue", weight_pct: 8 },
      { epr_material_type: "ink" as EPRMaterialType, component_name: "Printing ink", weight_pct: 2 },
    ],
  },
  self_adhesive_label: {
    name: "Self-Adhesive Label",
    components: [
      { epr_material_type: "paper_cardboard" as EPRMaterialType, component_name: "Paper substrate", weight_pct: 85 },
      { epr_material_type: "adhesive" as EPRMaterialType, component_name: "Adhesive layer", weight_pct: 12 },
      { epr_material_type: "ink" as EPRMaterialType, component_name: "Printing ink", weight_pct: 3 },
    ],
  },
  aluminium_cap: {
    name: "Aluminium Screw Cap",
    components: [
      { epr_material_type: "aluminium" as EPRMaterialType, component_name: "Aluminium shell", weight_pct: 85 },
      { epr_material_type: "plastic_flexible" as EPRMaterialType, component_name: "Plastic liner", weight_pct: 15 },
    ],
  },
  plastic_cap: {
    name: "Plastic Cap",
    components: [
      { epr_material_type: "plastic_rigid" as EPRMaterialType, component_name: "Cap body", weight_pct: 95 },
      { epr_material_type: "plastic_flexible" as EPRMaterialType, component_name: "Seal liner", weight_pct: 5 },
    ],
  },
  cork_closure: {
    name: "Natural Cork",
    components: [
      { epr_material_type: "other" as EPRMaterialType, component_name: "Natural cork", weight_pct: 100 },
    ],
  },
  shipping_box: {
    name: "Shipping Box with Tape",
    components: [
      { epr_material_type: "paper_cardboard" as EPRMaterialType, component_name: "Corrugated cardboard", weight_pct: 92 },
      { epr_material_type: "adhesive" as EPRMaterialType, component_name: "Packing tape", weight_pct: 5 },
      { epr_material_type: "ink" as EPRMaterialType, component_name: "Printing", weight_pct: 3 },
    ],
  },
  gift_box: {
    name: "Gift Box with Label",
    components: [
      { epr_material_type: "paper_cardboard" as EPRMaterialType, component_name: "Cardboard box", weight_pct: 88 },
      { epr_material_type: "paper_cardboard" as EPRMaterialType, component_name: "Paper label", weight_pct: 5 },
      { epr_material_type: "coating" as EPRMaterialType, component_name: "Laminate finish", weight_pct: 4 },
      { epr_material_type: "ink" as EPRMaterialType, component_name: "Printing ink", weight_pct: 3 },
    ],
  },
};

interface PackagingComponentEditorProps {
  components: PackagingMaterialComponent[];
  totalWeight: number;
  onComponentsChange: (components: PackagingMaterialComponent[]) => void;
  disabled?: boolean;
  packagingCategory?: string;
}

export function PackagingComponentEditor({
  components,
  totalWeight,
  onComponentsChange,
  disabled = false,
  packagingCategory,
}: PackagingComponentEditorProps) {
  const [isOpen, setIsOpen] = useState(components.length > 0);

  // Calculate sum of component weights
  const componentWeightSum = components.reduce((sum, c) => sum + (c.weight_grams || 0), 0);
  const weightVariance = totalWeight > 0 ? Math.abs(componentWeightSum - totalWeight) : 0;
  const weightVariancePct = totalWeight > 0 ? (weightVariance / totalWeight) * 100 : 0;
  const hasWeightMismatch = totalWeight > 0 && weightVariancePct > 5;

  const addComponent = () => {
    const newComponent: PackagingMaterialComponent = {
      epr_material_type: "paper_cardboard",
      component_name: "",
      weight_grams: 0,
      recycled_content_percentage: 0,
      is_recyclable: true,
    };
    onComponentsChange([...components, newComponent]);
  };

  const updateComponent = (index: number, updates: Partial<PackagingMaterialComponent>) => {
    const updated = components.map((c, i) => (i === index ? { ...c, ...updates } : c));
    onComponentsChange(updated);
  };

  const removeComponent = (index: number) => {
    onComponentsChange(components.filter((_, i) => i !== index));
  };

  const applyPreset = (presetKey: keyof typeof EPR_COMPONENT_PRESETS) => {
    const preset = EPR_COMPONENT_PRESETS[presetKey];
    if (!preset || totalWeight <= 0) return;

    const newComponents: PackagingMaterialComponent[] = preset.components.map((pc) => ({
      epr_material_type: pc.epr_material_type,
      component_name: pc.component_name,
      weight_grams: Number(((totalWeight * pc.weight_pct) / 100).toFixed(2)),
      recycled_content_percentage: 0,
      is_recyclable: true,
    }));

    onComponentsChange(newComponents);
    setIsOpen(true);
  };

  // Get relevant presets based on packaging category
  const getRelevantPresets = () => {
    switch (packagingCategory) {
      case "label":
        return ["paper_label", "self_adhesive_label"] as const;
      case "closure":
        return ["aluminium_cap", "plastic_cap", "cork_closure"] as const;
      case "secondary":
      case "shipment":
        return ["shipping_box", "gift_box"] as const;
      default:
        return [] as const;
    }
  };

  const relevantPresets = getRelevantPresets();

  return (
    <div className="pt-2 border-t">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto hover:bg-transparent">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Layers className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">EPR Material Breakdown</span>
              {components.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {components.length} component{components.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-3 space-y-3">
          {/* Presets section */}
          {relevantPresets.length > 0 && totalWeight > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Quick presets:
              </span>
              {relevantPresets.map((presetKey) => (
                <Button
                  key={presetKey}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => applyPreset(presetKey)}
                  disabled={disabled}
                >
                  {EPR_COMPONENT_PRESETS[presetKey].name}
                </Button>
              ))}
            </div>
          )}

          {/* Components list */}
          {components.map((component, index) => (
            <div key={index} className="flex gap-2 items-start p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Material Type</Label>
                  <Select
                    value={component.epr_material_type}
                    onValueChange={(value) => updateComponent(index, { epr_material_type: value as EPRMaterialType })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EPR_MATERIAL_CATEGORIES.map((category) => (
                        <SelectGroup key={category.label}>
                          <SelectLabel className="text-xs">{category.label}</SelectLabel>
                          {category.items.map((item) => (
                            <SelectItem key={item.value} value={item.value} className="text-xs">
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Name</Label>
                  <Input
                    value={component.component_name}
                    onChange={(e) => updateComponent(index, { component_name: e.target.value })}
                    placeholder="e.g., Paper substrate"
                    className="h-8 text-xs"
                    disabled={disabled}
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Weight (g)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={component.weight_grams || ""}
                    onChange={(e) => updateComponent(index, { weight_grams: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-xs"
                    disabled={disabled}
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Recycled %</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={component.recycled_content_percentage || ""}
                    onChange={(e) =>
                      updateComponent(index, { recycled_content_percentage: parseFloat(e.target.value) || 0 })
                    }
                    className="h-8 text-xs"
                    disabled={disabled}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeComponent(index)}
                disabled={disabled}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* Add component button */}
          <Button variant="outline" size="sm" onClick={addComponent} disabled={disabled} className="w-full gap-2">
            <Plus className="h-3 w-3" />
            Add Material Component
          </Button>

          {/* Weight validation */}
          {components.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Components total: <strong>{componentWeightSum.toFixed(2)}g</strong>
                {totalWeight > 0 && (
                  <span className="ml-2">
                    (Package weight: {totalWeight}g)
                  </span>
                )}
              </span>
              {hasWeightMismatch && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {weightVariancePct.toFixed(1)}% difference
                </Badge>
              )}
            </div>
          )}

          {hasWeightMismatch && (
            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                Component weights ({componentWeightSum.toFixed(2)}g) don&apos;t match the package weight ({totalWeight}g).
                This is a warning only - you can still save.
              </AlertDescription>
            </Alert>
          )}

          {components.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Add material components for detailed EPR reporting (e.g., paper, glue, ink weights)
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
