"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Box, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SecondaryPackagingItem {
  id: string;
  material_name: string;
  material_type: string;
  weight_grams: number;
  is_recyclable: boolean;
  recycled_content_percentage: number;
  notes: string;
}

const MATERIAL_TYPES = [
  { value: "cardboard", label: "Cardboard" },
  { value: "corrugated_cardboard", label: "Corrugated Cardboard" },
  { value: "paper", label: "Paper" },
  { value: "plastic_film", label: "Plastic Film / Shrink Wrap" },
  { value: "plastic_rigid", label: "Rigid Plastic" },
  { value: "wood", label: "Wood / Pallet" },
  { value: "foam", label: "Foam / Polystyrene" },
  { value: "fabric", label: "Fabric / Textile" },
  { value: "metal", label: "Metal" },
  { value: "other", label: "Other" },
];

const COMMON_PACKAGING_PRESETS = [
  { name: "Cardboard Box", type: "cardboard", weight: 150 },
  { name: "Corrugated Shipping Box", type: "corrugated_cardboard", weight: 250 },
  { name: "Shrink Wrap", type: "plastic_film", weight: 15 },
  { name: "Paper Wrap", type: "paper", weight: 20 },
  { name: "Wooden Crate", type: "wood", weight: 2000 },
  { name: "Gift Box", type: "cardboard", weight: 100 },
];

interface MultipackSecondaryPackagingFormProps {
  packagingItems: SecondaryPackagingItem[];
  onPackagingChange: (items: SecondaryPackagingItem[]) => void;
  disabled?: boolean;
}

export function MultipackSecondaryPackagingForm({
  packagingItems,
  onPackagingChange,
  disabled = false,
}: MultipackSecondaryPackagingFormProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<Omit<SecondaryPackagingItem, "id">>({
    material_name: "",
    material_type: "cardboard",
    weight_grams: 0,
    is_recyclable: true,
    recycled_content_percentage: 0,
    notes: "",
  });

  const handleAddItem = () => {
    if (!newItem.material_name || newItem.weight_grams <= 0) {
      return;
    }

    const item: SecondaryPackagingItem = {
      ...newItem,
      id: `temp-${Date.now()}`,
    };

    onPackagingChange([...packagingItems, item]);
    setNewItem({
      material_name: "",
      material_type: "cardboard",
      weight_grams: 0,
      is_recyclable: true,
      recycled_content_percentage: 0,
      notes: "",
    });
    setShowAddForm(false);
  };

  const handleRemoveItem = (id: string) => {
    onPackagingChange(packagingItems.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<SecondaryPackagingItem>) => {
    onPackagingChange(
      packagingItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const handlePresetClick = (preset: typeof COMMON_PACKAGING_PRESETS[0]) => {
    setNewItem({
      ...newItem,
      material_name: preset.name,
      material_type: preset.type,
      weight_grams: preset.weight,
    });
    setShowAddForm(true);
  };

  // Calculate total weight
  const totalWeight = packagingItems.reduce(
    (sum, item) => sum + item.weight_grams,
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Box className="h-5 w-5" />
          Secondary Packaging
        </CardTitle>
        <CardDescription>
          Add outer packaging for your multipack (boxes, shrink wrap, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Add Presets */}
        {!showAddForm && packagingItems.length === 0 && (
          <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">Quick add common packaging:</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_PACKAGING_PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  disabled={disabled}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Packaging Items */}
        {packagingItems.length > 0 && (
          <div className="space-y-3">
            {packagingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 border rounded-lg bg-card"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.material_name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({MATERIAL_TYPES.find((t) => t.value === item.material_type)?.label || item.material_type})
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{item.weight_grams}g</span>
                    {item.is_recyclable && (
                      <span className="text-green-600">Recyclable</span>
                    )}
                    {item.recycled_content_percentage > 0 && (
                      <span className="text-blue-600">
                        {item.recycled_content_percentage}% recycled content
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Form */}
        {showAddForm ? (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material_name">Packaging Name *</Label>
                <Input
                  id="material_name"
                  placeholder="e.g., Cardboard Box"
                  value={newItem.material_name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, material_name: e.target.value })
                  }
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="material_type">Material Type *</Label>
                <Select
                  value={newItem.material_type}
                  onValueChange={(value) =>
                    setNewItem({ ...newItem, material_type: value })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger id="material_type">
                    <SelectValue placeholder="Select material type" />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="weight_grams">Weight (grams) *</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Weight of the packaging material in grams</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="weight_grams"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="150"
                  value={newItem.weight_grams || ""}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      weight_grams: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="recycled_content">Recycled Content (%)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Percentage of recycled material in the packaging</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="recycled_content"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={newItem.recycled_content_percentage || ""}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      recycled_content_percentage: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_recyclable"
                checked={newItem.is_recyclable}
                onCheckedChange={(checked) =>
                  setNewItem({ ...newItem, is_recyclable: checked })
                }
                disabled={disabled}
              />
              <Label htmlFor="is_recyclable">This packaging is recyclable</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this packaging..."
                value={newItem.notes}
                onChange={(e) =>
                  setNewItem({ ...newItem, notes: e.target.value })
                }
                disabled={disabled}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleAddItem}
                disabled={
                  disabled || !newItem.material_name || newItem.weight_grams <= 0
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Packaging
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewItem({
                    material_name: "",
                    material_type: "cardboard",
                    weight_grams: 0,
                    is_recyclable: true,
                    recycled_content_percentage: 0,
                    notes: "",
                  });
                }}
                disabled={disabled}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowAddForm(true)}
            disabled={disabled}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Secondary Packaging
          </Button>
        )}

        {/* Summary */}
        {packagingItems.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {packagingItems.length} packaging item{packagingItems.length !== 1 ? "s" : ""}
            </div>
            <div className="font-medium">
              Total weight: {totalWeight.toFixed(1)}g
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
