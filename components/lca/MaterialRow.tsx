"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LcaStageClassifierModal } from "./LcaStageClassifierModal";
import type { LcaSubStage } from "@/hooks/data/useLcaStages";

export interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  lca_sub_stage_id: string | null;
  lca_sub_stage_name?: string;
}

interface MaterialRowProps {
  material: Material;
  index: number;
  onUpdate: (id: string, field: keyof Material, value: any) => void;
  onRemove: (id: string) => void;
}

export function MaterialRow({
  material,
  index,
  onUpdate,
  onRemove,
}: MaterialRowProps) {
  const [isClassifierOpen, setIsClassifierOpen] = useState(false);

  const handleSubStageSelect = (subStage: LcaSubStage) => {
    onUpdate(material.id, "lca_sub_stage_id", subStage.id);
    onUpdate(material.id, "lca_sub_stage_name", subStage.name);
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-4 p-4 border rounded-lg bg-card">
        <div className="col-span-12 md:col-span-3">
          <Label htmlFor={`material-name-${material.id}`}>Material Name</Label>
          <Input
            id={`material-name-${material.id}`}
            value={material.name}
            onChange={(e) => onUpdate(material.id, "name", e.target.value)}
            placeholder="e.g., Coffee Beans"
          />
        </div>

        <div className="col-span-6 md:col-span-2">
          <Label htmlFor={`material-quantity-${material.id}`}>Quantity</Label>
          <Input
            id={`material-quantity-${material.id}`}
            type="number"
            min="0"
            step="0.01"
            value={material.quantity || ""}
            onChange={(e) =>
              onUpdate(material.id, "quantity", parseFloat(e.target.value) || 0)
            }
            placeholder="0"
          />
        </div>

        <div className="col-span-6 md:col-span-2">
          <Label htmlFor={`material-unit-${material.id}`}>Unit</Label>
          <Input
            id={`material-unit-${material.id}`}
            value={material.unit}
            onChange={(e) => onUpdate(material.id, "unit", e.target.value)}
            placeholder="kg, L, units"
          />
        </div>

        <div className="col-span-12 md:col-span-4">
          <Label htmlFor={`material-classify-${material.id}`}>
            LCA Classification
          </Label>
          <div className="flex gap-2">
            <Button
              id={`material-classify-${material.id}`}
              variant={material.lca_sub_stage_id ? "secondary" : "outline"}
              className="flex-1"
              onClick={() => setIsClassifierOpen(true)}
            >
              {material.lca_sub_stage_name || "Classify"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(material.id)}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <LcaStageClassifierModal
        open={isClassifierOpen}
        onOpenChange={setIsClassifierOpen}
        onSelect={handleSubStageSelect}
        currentSubStageId={material.lca_sub_stage_id}
      />
    </>
  );
}
