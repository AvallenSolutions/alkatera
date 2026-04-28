"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info } from "lucide-react";

type Mode = "per_unit" | "per_batch";

interface RecipeScaleToggleProps {
  mode: Mode;
  yieldValue: number | null;
  yieldUnit: string | null;
  onChange: (input: {
    recipe_scale_mode: Mode;
    batch_yield_value: number | null;
    batch_yield_unit: string | null;
  }) => void | Promise<void>;
}

const YIELD_UNITS = ["bottles", "units", "L", "hL", "kL", "ml"] as const;

export function RecipeScaleToggle({
  mode,
  yieldValue,
  yieldUnit,
  onChange,
}: RecipeScaleToggleProps) {
  const [localValue, setLocalValue] = useState<string>(
    yieldValue != null ? String(yieldValue) : "",
  );
  const [localUnit, setLocalUnit] = useState<string>(yieldUnit || "bottles");

  useEffect(() => {
    setLocalValue(yieldValue != null ? String(yieldValue) : "");
    setLocalUnit(yieldUnit || "bottles");
  }, [yieldValue, yieldUnit]);

  const handleModeChange = (next: string) => {
    const nextMode = (next === "per_batch" ? "per_batch" : "per_unit") as Mode;
    if (nextMode === "per_unit") {
      onChange({
        recipe_scale_mode: "per_unit",
        batch_yield_value: null,
        batch_yield_unit: null,
      });
    } else {
      const numeric = Number(localValue);
      onChange({
        recipe_scale_mode: "per_batch",
        batch_yield_value: Number.isFinite(numeric) && numeric > 0 ? numeric : null,
        batch_yield_unit: localUnit || "bottles",
      });
    }
  };

  const commitYield = (nextValue: string, nextUnit: string) => {
    const numeric = Number(nextValue);
    onChange({
      recipe_scale_mode: "per_batch",
      batch_yield_value: Number.isFinite(numeric) && numeric > 0 ? numeric : null,
      batch_yield_unit: nextUnit || "bottles",
    });
  };

  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-3">
      <div>
        <Label className="text-sm font-medium">Recipe scale</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Choose how you enter ingredient quantities. Batch mode is for producers
          who track inputs at the production-run level (e.g. mash bill, fermentation tank).
        </p>
      </div>

      <Tabs value={mode} onValueChange={handleModeChange}>
        <TabsList>
          <TabsTrigger value="per_unit">Per bottle / can</TabsTrigger>
          <TabsTrigger value="per_batch">Per batch</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "per_batch" && (
        <div className="space-y-2 pt-1">
          <Label className="text-sm">Batch yield</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="e.g. 5000"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={() => commitYield(localValue, localUnit)}
              className="max-w-[180px]"
            />
            <Select
              value={localUnit}
              onValueChange={(v) => {
                setLocalUnit(v);
                commitYield(localValue, v);
              }}
            >
              <SelectTrigger className="max-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YIELD_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            Volume yields (L, hL, kL, ml) are converted to bottle count using this product&apos;s unit size.
          </p>
        </div>
      )}
    </div>
  );
}
