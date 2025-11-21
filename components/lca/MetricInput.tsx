"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, RotateCcw } from "lucide-react";

interface MetricData {
  display_name: string;
  category: string;
  value: number;
  unit: string;
  source: string;
  data_quality: "Primary" | "Secondary" | "Proxy";
  is_override: boolean;
}

interface MetricInputProps {
  metricKey: string;
  metric: MetricData;
  originalMetric: MetricData;
  onUpdate: (metricKey: string, updatedMetric: MetricData) => void;
}

const DATA_QUALITY_DEFINITIONS = {
  Primary: "Data sourced directly from the specific process (e.g., metered usage).",
  Secondary: "Data from a published source for an average process (e.g., EcoInvent).",
  Proxy: "Data from a similar, but not identical, process.",
};

export function MetricInput({
  metricKey,
  metric,
  originalMetric,
  onUpdate,
}: MetricInputProps) {
  const [localValue, setLocalValue] = useState(metric.value.toString());
  const [localSource, setLocalSource] = useState(metric.source);
  const [localQuality, setLocalQuality] = useState(metric.data_quality);

  const handleOverride = () => {
    onUpdate(metricKey, {
      ...metric,
      is_override: true,
    });
  };

  const handleRevert = () => {
    setLocalValue(originalMetric.value.toString());
    setLocalSource(originalMetric.source);
    setLocalQuality(originalMetric.data_quality);
    onUpdate(metricKey, {
      ...originalMetric,
      is_override: false,
    });
  };

  const handleValueChange = (newValue: string) => {
    setLocalValue(newValue);
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      onUpdate(metricKey, {
        ...metric,
        value: numValue,
      });
    }
  };

  const handleSourceChange = (newSource: string) => {
    setLocalSource(newSource);
    onUpdate(metricKey, {
      ...metric,
      source: newSource,
    });
  };

  const handleQualityChange = (newQuality: "Primary" | "Secondary" | "Proxy") => {
    setLocalQuality(newQuality);
    onUpdate(metricKey, {
      ...metric,
      data_quality: newQuality,
    });
  };

  if (!metric.is_override) {
    return (
      <div className="flex items-center justify-between py-3 border-b last:border-b-0">
        <div className="flex-1">
          <p className="font-medium text-sm">{metric.display_name}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base">
              {metric.value.toLocaleString()} {metric.unit}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Source: {metric.source}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOverride}
          className="ml-4"
        >
          Override
        </Button>
      </div>
    );
  }

  return (
    <div className="py-4 border-b last:border-b-0 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-medium text-sm">{metric.display_name}</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRevert}
          className="h-8 w-8 p-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        <div>
          <Label htmlFor={`${metricKey}-value`} className="text-xs">
            Value ({metric.unit})
          </Label>
          <Input
            id={`${metricKey}-value`}
            type="number"
            step="any"
            value={localValue}
            onChange={(e) => handleValueChange(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={`${metricKey}-source`} className="text-xs">
            Data Source *
          </Label>
          <Input
            id={`${metricKey}-source`}
            type="text"
            value={localSource}
            onChange={(e) => handleSourceChange(e.target.value)}
            placeholder="Enter data source"
            className="mt-1"
            required
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <Label htmlFor={`${metricKey}-quality`} className="text-xs">
              Data Quality *
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-2 text-xs">
                    <div>
                      <strong>Primary Data:</strong> {DATA_QUALITY_DEFINITIONS.Primary}
                    </div>
                    <div>
                      <strong>Secondary Data:</strong> {DATA_QUALITY_DEFINITIONS.Secondary}
                    </div>
                    <div>
                      <strong>Proxy Data:</strong> {DATA_QUALITY_DEFINITIONS.Proxy}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select value={localQuality} onValueChange={handleQualityChange}>
            <SelectTrigger id={`${metricKey}-quality`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Primary">Primary</SelectItem>
              <SelectItem value="Secondary">Secondary</SelectItem>
              <SelectItem value="Proxy">Proxy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
