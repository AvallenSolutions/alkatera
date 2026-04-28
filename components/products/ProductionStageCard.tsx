"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, ChevronDown, ChevronUp, ArrowDown } from "lucide-react";
import type { ProductionStage, StageType } from "@/lib/types/products";

interface ProductionStageCardProps {
  stage: ProductionStage;
  attachedIngredientCount: number;
  onUpdate: (id: string, updates: Partial<ProductionStage>) => void;
  onRemove: (id: string) => void;
  showYieldArrow?: boolean;
}

const STAGE_TYPES: { value: StageType; label: string }[] = [
  { value: "brewing", label: "Brewing / Mashing" },
  { value: "fermentation", label: "Fermentation" },
  { value: "distillation", label: "Distillation" },
  { value: "blending", label: "Blending / Maceration" },
  { value: "maturation", label: "Maturation / Ageing" },
  { value: "bottling", label: "Bottling" },
  { value: "other", label: "Other" },
];

const STAGE_TYPE_COLOURS: Record<StageType, string> = {
  brewing: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  fermentation: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200",
  distillation: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  blending: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  maturation: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  bottling: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  other: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
};

export function ProductionStageCard({
  stage,
  attachedIngredientCount,
  onUpdate,
  onRemove,
  showYieldArrow = false,
}: ProductionStageCardProps) {
  const [expanded, setExpanded] = useState(false);

  const yieldPct =
    stage.input_volume_l && stage.output_volume_l && stage.input_volume_l > 0
      ? (stage.output_volume_l / stage.input_volume_l) * 100
      : null;

  return (
    <>
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={STAGE_TYPE_COLOURS[stage.stage_type]}>
              Stage {stage.ordinal + 1}
            </Badge>
            <Input
              value={stage.name}
              onChange={(e) => onUpdate(stage.id, { name: e.target.value })}
              className="flex-1 min-w-[200px] font-medium"
              placeholder="Stage name"
            />
            <Select
              value={stage.stage_type}
              onValueChange={(v) => onUpdate(stage.id, { stage_type: v as StageType })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse stage" : "Expand stage"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(stage.id)}
              aria-label="Remove stage"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {stage.input_volume_l != null && (
              <span>In: {stage.input_volume_l} L{stage.input_abv_percent != null ? ` @ ${stage.input_abv_percent}%` : ""}</span>
            )}
            {stage.output_volume_l != null && (
              <span>Out: {stage.output_volume_l} L{stage.output_abv_percent != null ? ` @ ${stage.output_abv_percent}%` : ""}</span>
            )}
            {yieldPct != null && (
              <Badge variant="outline" className="text-xs">
                Yield {yieldPct.toFixed(0)}%
              </Badge>
            )}
            <span className="ml-auto">{attachedIngredientCount} ingredient{attachedIngredientCount === 1 ? "" : "s"}</span>
          </div>
        </CardHeader>
        {expanded && (
          <CardContent className="pt-0 pb-4 px-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Input volume (L)</Label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={stage.input_volume_l ?? ""}
                  onChange={(e) =>
                    onUpdate(stage.id, {
                      input_volume_l: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Output volume (L)</Label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={stage.output_volume_l ?? ""}
                  onChange={(e) =>
                    onUpdate(stage.id, {
                      output_volume_l: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Input ABV (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={stage.input_abv_percent ?? ""}
                  onChange={(e) =>
                    onUpdate(stage.id, {
                      input_abv_percent: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Output ABV (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={stage.output_abv_percent ?? ""}
                  onChange={(e) =>
                    onUpdate(stage.id, {
                      output_abv_percent: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input
                value={stage.notes ?? ""}
                onChange={(e) => onUpdate(stage.id, { notes: e.target.value })}
                placeholder="Optional notes about this stage"
              />
            </div>
          </CardContent>
        )}
      </Card>
      {showYieldArrow && (
        <div className="flex justify-center text-muted-foreground" aria-hidden>
          <ArrowDown className="h-4 w-4" />
        </div>
      )}
    </>
  );
}
