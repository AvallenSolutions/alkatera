"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { LcaSubStage } from "@/lib/types/lca";

interface IngredientQuantityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientName: string;
  defaultUnit?: string;
  subStages: LcaSubStage[];
  onConfirm: (data: {
    quantity: number;
    unit: string;
    lca_sub_stage_id: string | null;
  }) => void;
  onCancel: () => void;
}

const UNIT_OPTIONS = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "L", label: "Litres (L)" },
  { value: "mL", label: "Millilitres (mL)" },
  { value: "units", label: "Units" },
];

export function IngredientQuantityDialog({
  open,
  onOpenChange,
  ingredientName,
  defaultUnit = "kg",
  subStages,
  onConfirm,
  onCancel,
}: IngredientQuantityDialogProps) {
  const [quantity, setQuantity] = useState<string>("1");
  const [unit, setUnit] = useState<string>(defaultUnit);
  const [lcaSubStageId, setLcaSubStageId] = useState<string | null>(
    subStages[0]?.id || null
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setQuantity("1");
      setUnit(defaultUnit);
      setLcaSubStageId(subStages[0]?.id || null);
      setError("");
    }
  }, [open, defaultUnit, subStages]);

  const handleConfirm = () => {
    const numQuantity = parseFloat(quantity);

    if (isNaN(numQuantity) || numQuantity <= 0) {
      setError("Please enter a valid quantity greater than 0");
      return;
    }

    if (!lcaSubStageId) {
      setError("Please select a life cycle stage");
      return;
    }

    onConfirm({
      quantity: numQuantity,
      unit,
      lca_sub_stage_id: lcaSubStageId,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Specify Quantity</DialogTitle>
          <DialogDescription>
            How much of <strong>{ingredientName}</strong> is used per unit of product?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Enter the amount of this ingredient used per functional unit (e.g., per 700ml bottle).
            </AlertDescription>
          </Alert>

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
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setError("");
                }}
                placeholder="e.g. 500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">
                Unit <span className="text-red-600">*</span>
              </Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="unit">
                  <SelectValue />
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
            <Label htmlFor="lca_stage">
              Life Cycle Stage <span className="text-red-600">*</span>
            </Label>
            <Select
              value={lcaSubStageId || ""}
              onValueChange={(value) => {
                setLcaSubStageId(value);
                setError("");
              }}
            >
              <SelectTrigger id="lca_stage">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {subStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
