"use client";

import { useState } from "react";
import { IngredientList } from "./IngredientList";

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

interface UnifiedLcaDataCaptureProps {
  initialIngredients?: IngredientData[];
  onDataChange?: (ingredients: IngredientData[]) => void;
}

const DEFAULT_METRICS: Record<string, MetricData> = {
  climate_change: {
    display_name: "Climate Change",
    category: "Core Environmental Impacts",
    value: 0,
    unit: "kg CO₂ eq",
    source: "EcoInvent 3.12",
    data_quality: "Secondary",
    is_override: false,
  },
  ozone_depletion: {
    display_name: "Ozone Depletion",
    category: "Core Environmental Impacts",
    value: 0,
    unit: "kg CFC-11 eq",
    source: "EcoInvent 3.12",
    data_quality: "Secondary",
    is_override: false,
  },
  human_toxicity: {
    display_name: "Human Toxicity",
    category: "Core Environmental Impacts",
    value: 0,
    unit: "kg 1,4-DB eq",
    source: "EcoInvent 3.12",
    data_quality: "Secondary",
    is_override: false,
  },
  freshwater_ecotoxicity: {
    display_name: "Freshwater Ecotoxicity",
    category: "Core Environmental Impacts",
    value: 0,
    unit: "kg 1,4-DB eq",
    source: "EcoInvent 3.12",
    data_quality: "Secondary",
    is_override: false,
  },
  terrestrial_ecotoxicity: {
    display_name: "Terrestrial Ecotoxicity",
    category: "Core Environmental Impacts",
    value: 0,
    unit: "kg 1,4-DB eq",
    source: "EcoInvent 3.12",
    data_quality: "Secondary",
    is_override: false,
  },
  eutrophication: {
    display_name: "Eutrophication",
    category: "Core Environmental Impacts",
    value: 0,
    unit: "kg PO₄³⁻ eq",
    source: "EcoInvent 3.12",
    data_quality: "Secondary",
    is_override: false,
  },
  water_use: {
    display_name: "Water Use",
    category: "Resource Use & Waste",
    value: 0,
    unit: "litres",
    source: "EcoInvent 3.12",
    data_quality: "Secondary",
    is_override: false,
  },
  waste_generated: {
    display_name: "Waste Generated",
    category: "Resource Use & Waste",
    value: 0,
    unit: "kg",
    source: "EcoInvent 3.12",
    data_quality: "Secondary",
    is_override: false,
  },
  biodiversity_impact: {
    display_name: "Biodiversity Impact",
    category: "Ecosystem Impact",
    value: 0,
    unit: "PDF.m².yr",
    source: "EcoInvent 3.12",
    data_quality: "Secondary",
    is_override: false,
  },
};

function generateId(): string {
  return `ing_${Math.random().toString(36).substr(2, 9)}`;
}

function createDefaultIngredient(): IngredientData {
  const metrics = JSON.parse(JSON.stringify(DEFAULT_METRICS));
  return {
    id: generateId(),
    name: "",
    weight_kg: 0,
    metrics: metrics,
    originalMetrics: JSON.parse(JSON.stringify(metrics)),
  };
}

export function UnifiedLcaDataCapture({
  initialIngredients = [],
  onDataChange,
}: UnifiedLcaDataCaptureProps) {
  const [ingredients, setIngredients] = useState<IngredientData[]>(
    initialIngredients.length > 0 ? initialIngredients : []
  );

  const handleIngredientsChange = (updatedIngredients: IngredientData[]) => {
    setIngredients(updatedIngredients);
    if (onDataChange) {
      onDataChange(updatedIngredients);
    }
  };

  const handleAddIngredient = () => {
    const newIngredient = createDefaultIngredient();
    const updatedIngredients = [...ingredients, newIngredient];
    handleIngredientsChange(updatedIngredients);
  };

  return (
    <div className="w-full">
      <IngredientList
        ingredients={ingredients}
        onIngredientsChange={handleIngredientsChange}
        onAddIngredient={handleAddIngredient}
      />
    </div>
  );
}

export type { IngredientData, MetricData };
