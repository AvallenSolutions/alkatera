"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { saveOrUpdateMaterials } from "@/lib/lca";
import type { SimpleMaterialInput, LcaStageWithSubStages, ProductLcaMaterial } from "@/lib/types/lca";

interface IngredientsFormProps {
  lcaId: string;
  stages: LcaStageWithSubStages[];
  initialMaterials: ProductLcaMaterial[];
}

export function IngredientsForm({ lcaId, stages, initialMaterials }: IngredientsFormProps) {
  const router = useRouter();

  const [materials, setMaterials] = useState<SimpleMaterialInput[]>(
    initialMaterials.map((m) => ({
      id: m.id,
      name: m.name || "",
      quantity: m.quantity,
      unit: m.unit || "",
      lca_sub_stage_id: m.lca_sub_stage_id || "",
    }))
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMaterialsByStage = (stageId: number) => {
    return materials.filter((material) => {
      const subStageId = typeof material.lca_sub_stage_id === 'string'
        ? parseInt(material.lca_sub_stage_id)
        : material.lca_sub_stage_id;

      const stage = stages.find((s) =>
        s.sub_stages.some((sub) => sub.id === subStageId)
      );

      return stage?.id === stageId;
    });
  };

  const handleAddMaterial = (stageId: number) => {
    const firstSubStage = stages.find((s) => s.id === stageId)?.sub_stages[0];
    if (!firstSubStage) return;

    const newMaterial: SimpleMaterialInput = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: "",
      quantity: 0,
      unit: "",
      lca_sub_stage_id: firstSubStage.id,
    };

    setMaterials([...materials, newMaterial]);
  };

  const handleUpdateMaterial = (
    id: string,
    field: keyof SimpleMaterialInput,
    value: any
  ) => {
    setMaterials((prev) =>
      prev.map((material) =>
        material.id === id ? { ...material, [field]: value } : material
      )
    );
  };

  const handleRemoveMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((material) => material.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validMaterials = materials.filter((m) => {
      const qty = typeof m.quantity === 'string' ? parseFloat(m.quantity) : m.quantity;
      return m.name.trim() && qty > 0 && m.unit.trim();
    });

    if (validMaterials.length === 0) {
      setError("Please add at least one material with complete information");
      return;
    }

    try {
      setIsSaving(true);

      const materialsToSave = validMaterials.map((m) => ({
        ...m,
        id: m.id?.startsWith('temp-') ? undefined : m.id,
      }));

      const result = await saveOrUpdateMaterials(lcaId, materialsToSave);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Materials saved successfully");
      router.push("/dashboard/products");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save materials";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Accordion type="multiple" defaultValue={stages.map((s) => `stage-${s.id}`)} className="w-full">
        {stages.map((stage) => {
          const stageMaterials = getMaterialsByStage(stage.id);

          return (
            <AccordionItem key={stage.id} value={`stage-${stage.id}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-semibold">{stage.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {stageMaterials.length} material{stageMaterials.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {stage.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {stage.description}
                  </p>
                )}

                {stageMaterials.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground mb-3">
                      No materials added for this stage yet
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddMaterial(stage.id)}
                      disabled={isSaving}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Material
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stageMaterials.map((material) => (
                      <div
                        key={material.id}
                        className="grid grid-cols-12 gap-3 p-4 border rounded-lg bg-card"
                      >
                        <div className="col-span-12 md:col-span-4">
                          <Label htmlFor={`name-${material.id}`}>Material Name</Label>
                          <Input
                            id={`name-${material.id}`}
                            value={material.name}
                            onChange={(e) =>
                              handleUpdateMaterial(material.id!, "name", e.target.value)
                            }
                            placeholder="e.g., Arabica Coffee Beans"
                            disabled={isSaving}
                          />
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <Label htmlFor={`quantity-${material.id}`}>Quantity</Label>
                          <Input
                            id={`quantity-${material.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={material.quantity}
                            onChange={(e) =>
                              handleUpdateMaterial(
                                material.id!,
                                "quantity",
                                e.target.value
                              )
                            }
                            placeholder="0"
                            disabled={isSaving}
                          />
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <Label htmlFor={`unit-${material.id}`}>Unit</Label>
                          <Input
                            id={`unit-${material.id}`}
                            value={material.unit}
                            onChange={(e) =>
                              handleUpdateMaterial(material.id!, "unit", e.target.value)
                            }
                            placeholder="kg, L, kWh"
                            disabled={isSaving}
                          />
                        </div>

                        <div className="col-span-11 md:col-span-3">
                          <Label htmlFor={`sub-stage-${material.id}`}>Sub-Stage</Label>
                          <Select
                            value={material.lca_sub_stage_id.toString()}
                            onValueChange={(value) =>
                              handleUpdateMaterial(material.id!, "lca_sub_stage_id", value)
                            }
                            disabled={isSaving}
                          >
                            <SelectTrigger id={`sub-stage-${material.id}`}>
                              <SelectValue placeholder="Select sub-stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {stage.sub_stages.map((subStage) => (
                                <SelectItem key={subStage.id} value={subStage.id.toString()}>
                                  {subStage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-1 md:col-span-1 flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMaterial(material.id!)}
                            disabled={isSaving}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddMaterial(stage.id)}
                      disabled={isSaving}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Another Material
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="flex justify-between items-center pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/products")}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save and Continue"}
        </Button>
      </div>
    </form>
  );
}
