"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MetricInput } from "./MetricInput";

interface MetricData {
  display_name: string;
  category: string;
  value: number;
  unit: string;
  source: string;
  data_quality: "Primary" | "Secondary" | "Proxy";
  is_override: boolean;
}

interface IngredientData {
  id: string;
  name: string;
  weight_kg: number;
  metrics: Record<string, MetricData>;
  originalMetrics: Record<string, MetricData>;
}

interface IngredientRowProps {
  ingredient: IngredientData;
  onUpdate: (id: string, updatedIngredient: IngredientData) => void;
}

export function IngredientRow({ ingredient, onUpdate }: IngredientRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNameChange = (newName: string) => {
    onUpdate(ingredient.id, {
      ...ingredient,
      name: newName,
    });
  };

  const handleWeightChange = (newWeight: string) => {
    const numWeight = parseFloat(newWeight);
    if (!isNaN(numWeight) && numWeight >= 0) {
      onUpdate(ingredient.id, {
        ...ingredient,
        weight_kg: numWeight,
      });
    }
  };

  const handleMetricUpdate = (metricKey: string, updatedMetric: MetricData) => {
    onUpdate(ingredient.id, {
      ...ingredient,
      metrics: {
        ...ingredient.metrics,
        [metricKey]: updatedMetric,
      },
    });
  };

  const groupedMetrics = Object.entries(ingredient.metrics).reduce(
    (acc, [key, metric]) => {
      const category = metric.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({ key, metric });
      return acc;
    },
    {} as Record<string, Array<{ key: string; metric: MetricData }>>
  );

  const overrideCount = Object.values(ingredient.metrics).filter(
    (m) => m.is_override
  ).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-3">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div onClick={(e) => e.stopPropagation()}>
                  <Label htmlFor={`${ingredient.id}-name`} className="text-xs text-muted-foreground">
                    Ingredient Name
                  </Label>
                  <Input
                    id={`${ingredient.id}-name`}
                    value={ingredient.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="mt-1 font-medium"
                    placeholder="Enter ingredient name"
                  />
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Label htmlFor={`${ingredient.id}-weight`} className="text-xs text-muted-foreground">
                    Weight (kg)
                  </Label>
                  <Input
                    id={`${ingredient.id}-weight`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={ingredient.weight_kg}
                    onChange={(e) => handleWeightChange(e.target.value)}
                    className="mt-1 font-medium"
                    placeholder="0.00"
                  />
                </div>
              </div>
              {overrideCount > 0 && (
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200">
                    {overrideCount} override{overrideCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-4">
            <div className="space-y-6">
              {Object.entries(groupedMetrics).map(([category, metrics]) => (
                <div key={category}>
                  <h4 className="font-bold text-sm mb-3 text-foreground">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {metrics.map(({ key, metric }) => (
                      <MetricInput
                        key={key}
                        metricKey={key}
                        metric={metric}
                        originalMetric={ingredient.originalMetrics[key]}
                        onUpdate={handleMetricUpdate}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
