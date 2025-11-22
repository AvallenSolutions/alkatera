"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import type { LcaSubStage } from "@/lib/types/lca";

interface PrimaryIngredientData {
  name: string;
  quantity: number;
  unit: string;
  lca_sub_stage_id: number;
  origin_country: string;
  is_organic_certified: boolean;
  notes?: string;
}

interface PrimaryIngredientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  subStages: LcaSubStage[];
  onSave: (data: PrimaryIngredientData) => Promise<void>;
}

const UNIT_OPTIONS = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "L", label: "Litres (L)" },
  { value: "mL", label: "Millilitres (mL)" },
  { value: "kWh", label: "Kilowatt-hours (kWh)" },
  { value: "m", label: "Metres (m)" },
  { value: "m2", label: "Square metres (m²)" },
  { value: "m3", label: "Cubic metres (m³)" },
  { value: "unit", label: "Units" },
];

export function PrimaryIngredientForm({
  open,
  onOpenChange,
  initialName,
  subStages,
  onSave,
}: PrimaryIngredientFormProps) {
  const [formData, setFormData] = useState<PrimaryIngredientData>({
    name: initialName,
    quantity: 0,
    unit: "kg",
    lca_sub_stage_id: 0,
    origin_country: "",
    is_organic_certified: false,
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Ingredient name is required";
    }

    if (formData.quantity <= 0) {
      newErrors.quantity = "Quantity must be greater than 0";
    }

    if (!formData.lca_sub_stage_id || formData.lca_sub_stage_id === 0) {
      newErrors.lca_sub_stage_id = "Please select a life cycle stage";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);
      await onSave(formData);

      setFormData({
        name: "",
        quantity: 0,
        unit: "kg",
        lca_sub_stage_id: 0,
        origin_country: "",
        is_organic_certified: false,
        notes: "",
      });
      setErrors({});
      onOpenChange(false);
    } catch (error) {
      console.error('[PrimaryIngredientForm] Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      quantity: 0,
      unit: "kg",
      lca_sub_stage_id: 0,
      origin_country: "",
      is_organic_certified: false,
      notes: "",
    });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Primary Ingredient Data</DialogTitle>
          <DialogDescription>
            Enter detailed information about this ingredient. This data will be stored
            as primary data for your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Primary data provides the most accurate LCA results. Required fields are marked with an asterisk (*).
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="name">
              Ingredient Name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Apple Concentrate"
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantity <span className="text-red-600">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                value={formData.quantity || ""}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className={errors.quantity ? "border-red-500" : ""}
              />
              {errors.quantity && (
                <p className="text-sm text-red-600">{errors.quantity}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">
                Unit <span className="text-red-600">*</span>
              </Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lca_sub_stage">
              Life Cycle Stage <span className="text-red-600">*</span>
            </Label>
            <Select
              value={formData.lca_sub_stage_id.toString()}
              onValueChange={(value) => setFormData({ ...formData, lca_sub_stage_id: parseInt(value) })}
            >
              <SelectTrigger id="lca_sub_stage" className={errors.lca_sub_stage_id ? "border-red-500" : ""}>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {subStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id.toString()}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.lca_sub_stage_id && (
              <p className="text-sm text-red-600">{errors.lca_sub_stage_id}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="origin_country">Origin Country (Optional)</Label>
            <Input
              id="origin_country"
              value={formData.origin_country}
              onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })}
              placeholder="e.g., United Kingdom, France, etc."
            />
            <p className="text-xs text-muted-foreground">
              Country or region where this ingredient is sourced from
            </p>
          </div>

          <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border">
            <div className="flex-1">
              <Label htmlFor="organic" className="text-base font-medium">
                Organic Certification
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Does this ingredient have organic certification?
              </p>
            </div>
            <Switch
              id="organic"
              checked={formData.is_organic_certified}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_organic_certified: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information about this ingredient..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Ingredient'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
