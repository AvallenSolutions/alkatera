"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Cloud,
  Droplets,
  Trash2,
  Leaf,
  ChevronDown,
  Info,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import {
  type SupplierProductFormData,
  type DataSourceType,
  type SystemBoundaryType,
  type UncertaintyType,
  type EndOfLifePathway,
  DATA_SOURCE_TYPE_LABELS,
  SYSTEM_BOUNDARY_LABELS,
  METHODOLOGY_STANDARDS,
} from "@/lib/types/supplier-product";

interface SupplierProductImpactFormProps {
  formData: SupplierProductFormData;
  onChange: (data: Partial<SupplierProductFormData>) => void;
  unit: string;
  readOnly?: boolean;
}

const IMPACT_CATEGORIES = [
  {
    key: "climate",
    label: "Climate",
    icon: Cloud,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    unit: "kg CO₂e",
    description: "Greenhouse gas emissions contributing to global warming",
    standard: "ISO 14067",
  },
  {
    key: "water",
    label: "Water",
    icon: Droplets,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-950",
    borderColor: "border-cyan-200 dark:border-cyan-800",
    unit: "m³",
    description: "Water consumption and scarcity impact",
    standard: "ISO 14046",
  },
  {
    key: "waste",
    label: "Waste",
    icon: Trash2,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800",
    unit: "kg",
    description: "Waste generation and circularity metrics",
    standard: "EU WFD",
  },
  {
    key: "land",
    label: "Land & Biodiversity",
    icon: Leaf,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    unit: "m²a crop eq",
    description: "Land use and biodiversity impact",
    standard: "ReCiPe 2016",
  },
] as const;

export function SupplierProductImpactForm({
  formData,
  onChange,
  unit,
  readOnly = false,
}: SupplierProductImpactFormProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["climate"]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const getCompletionStatus = () => {
    const hasClimate = formData.impact_climate !== undefined && formData.impact_climate !== null;
    const hasWater = formData.impact_water !== undefined && formData.impact_water !== null;
    const hasWaste = formData.impact_waste !== undefined && formData.impact_waste !== null;
    const hasLand = formData.impact_land !== undefined && formData.impact_land !== null;

    const count = [hasClimate, hasWater, hasWaste, hasLand].filter(Boolean).length;
    return { count, total: 4, hasClimate, hasWater, hasWaste, hasLand };
  };

  const completion = getCompletionStatus();

  return (
    <div className="space-y-6">
      {/* Completion Status */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
        <div className="flex items-center gap-2">
          {completion.count === 4 ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : completion.count > 0 ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <Info className="h-5 w-5 text-gray-400" />
          )}
          <span className="text-sm font-medium">
            Impact Data: {completion.count} of {completion.total} categories
          </span>
        </div>
        <div className="flex gap-1">
          {IMPACT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const hasValue =
              cat.key === "climate"
                ? completion.hasClimate
                : cat.key === "water"
                ? completion.hasWater
                : cat.key === "waste"
                ? completion.hasWaste
                : completion.hasLand;
            return (
              <TooltipProvider key={cat.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`p-1.5 rounded ${
                        hasValue ? cat.bgColor : "bg-gray-100 dark:bg-gray-800"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${hasValue ? cat.color : "text-gray-400"}`}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {cat.label}: {hasValue ? "Provided" : "Not provided"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="impacts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="impacts">Impact Data</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
          <TabsTrigger value="validity">Validity & Verification</TabsTrigger>
        </TabsList>

        {/* Impact Data Tab */}
        <TabsContent value="impacts" className="space-y-4 mt-4">
          {/* Climate Impact */}
          <Card className={`${IMPACT_CATEGORIES[0].borderColor} border-l-4`}>
            <Collapsible
              open={expandedSections.includes("climate")}
              onOpenChange={() => toggleSection("climate")}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${IMPACT_CATEGORIES[0].bgColor}`}>
                        <Cloud className={`h-5 w-5 ${IMPACT_CATEGORIES[0].color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          Climate Impact
                          <Badge variant="outline" className="text-xs font-normal">
                            ISO 14067
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          Greenhouse gas emissions per {unit}
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        expandedSections.includes("climate") ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="impact_climate" className="flex items-center gap-1">
                        Total Climate Impact
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Total GHG emissions in kg CO₂e per {unit}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="relative">
                        <Input
                          id="impact_climate"
                          type="number"
                          step="0.000001"
                          min="0"
                          value={formData.impact_climate ?? ""}
                          onChange={(e) =>
                            onChange({
                              impact_climate: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="0.00"
                          disabled={readOnly}
                          className="pr-20"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          kg CO₂e/{unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* GHG Breakdown */}
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium text-muted-foreground mb-3 block">
                      GHG Breakdown (Optional - ISO 14067 Compliance)
                    </Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ghg_fossil" className="text-xs">
                          Fossil Carbon
                        </Label>
                        <Input
                          id="ghg_fossil"
                          type="number"
                          step="0.000001"
                          min="0"
                          value={formData.ghg_fossil ?? ""}
                          onChange={(e) =>
                            onChange({
                              ghg_fossil: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="kg CO₂e"
                          disabled={readOnly}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ghg_biogenic" className="text-xs">
                          Biogenic Carbon
                        </Label>
                        <Input
                          id="ghg_biogenic"
                          type="number"
                          step="0.000001"
                          value={formData.ghg_biogenic ?? ""}
                          onChange={(e) =>
                            onChange({
                              ghg_biogenic: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="kg CO₂e"
                          disabled={readOnly}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ghg_land_use_change" className="text-xs">
                          Land Use Change (dLUC)
                        </Label>
                        <Input
                          id="ghg_land_use_change"
                          type="number"
                          step="0.000001"
                          min="0"
                          value={formData.ghg_land_use_change ?? ""}
                          onChange={(e) =>
                            onChange({
                              ghg_land_use_change: e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            })
                          }
                          placeholder="kg CO₂e"
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Water Impact */}
          <Card className={`${IMPACT_CATEGORIES[1].borderColor} border-l-4`}>
            <Collapsible
              open={expandedSections.includes("water")}
              onOpenChange={() => toggleSection("water")}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${IMPACT_CATEGORIES[1].bgColor}`}>
                        <Droplets className={`h-5 w-5 ${IMPACT_CATEGORIES[1].color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          Water Impact
                          <Badge variant="outline" className="text-xs font-normal">
                            ISO 14046
                          </Badge>
                        </CardTitle>
                        <CardDescription>Water consumption per {unit}</CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        expandedSections.includes("water") ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="impact_water">Total Water Consumption</Label>
                      <div className="relative">
                        <Input
                          id="impact_water"
                          type="number"
                          step="0.000001"
                          min="0"
                          value={formData.impact_water ?? ""}
                          onChange={(e) =>
                            onChange({
                              impact_water: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="0.00"
                          disabled={readOnly}
                          className="pr-16"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          m³/{unit}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="water_scarcity_factor">AWARE Scarcity Factor</Label>
                      <Input
                        id="water_scarcity_factor"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.water_scarcity_factor ?? ""}
                        onChange={(e) =>
                          onChange({
                            water_scarcity_factor: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="1.0 = world avg"
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* Water Breakdown */}
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium text-muted-foreground mb-3 block">
                      Water Footprint Breakdown (Optional)
                    </Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="water_blue" className="text-xs">
                          Blue Water
                        </Label>
                        <Input
                          id="water_blue"
                          type="number"
                          step="0.000001"
                          min="0"
                          value={formData.water_blue ?? ""}
                          onChange={(e) =>
                            onChange({
                              water_blue: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="m³"
                          disabled={readOnly}
                        />
                        <p className="text-xs text-muted-foreground">Surface/groundwater</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="water_green" className="text-xs">
                          Green Water
                        </Label>
                        <Input
                          id="water_green"
                          type="number"
                          step="0.000001"
                          min="0"
                          value={formData.water_green ?? ""}
                          onChange={(e) =>
                            onChange({
                              water_green: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="m³"
                          disabled={readOnly}
                        />
                        <p className="text-xs text-muted-foreground">Rainwater in soil</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="water_grey" className="text-xs">
                          Grey Water
                        </Label>
                        <Input
                          id="water_grey"
                          type="number"
                          step="0.000001"
                          min="0"
                          value={formData.water_grey ?? ""}
                          onChange={(e) =>
                            onChange({
                              water_grey: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="m³"
                          disabled={readOnly}
                        />
                        <p className="text-xs text-muted-foreground">Dilution footprint</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Waste & Circularity */}
          <Card className={`${IMPACT_CATEGORIES[2].borderColor} border-l-4`}>
            <Collapsible
              open={expandedSections.includes("waste")}
              onOpenChange={() => toggleSection("waste")}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${IMPACT_CATEGORIES[2].bgColor}`}>
                        <Trash2 className={`h-5 w-5 ${IMPACT_CATEGORIES[2].color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          Waste & Circularity
                          <Badge variant="outline" className="text-xs font-normal">
                            CSRD ESRS E5
                          </Badge>
                        </CardTitle>
                        <CardDescription>Waste generation and circular economy metrics</CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        expandedSections.includes("waste") ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="impact_waste">Waste Generated</Label>
                      <div className="relative">
                        <Input
                          id="impact_waste"
                          type="number"
                          step="0.000001"
                          min="0"
                          value={formData.impact_waste ?? ""}
                          onChange={(e) =>
                            onChange({
                              impact_waste: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="0.00"
                          disabled={readOnly}
                          className="pr-16"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          kg/{unit}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_of_life_pathway">End-of-Life Pathway</Label>
                      <Select
                        value={formData.end_of_life_pathway || ""}
                        onValueChange={(value) =>
                          onChange({ end_of_life_pathway: value as EndOfLifePathway })
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pathway" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recycling">Recycling</SelectItem>
                          <SelectItem value="composting">Composting</SelectItem>
                          <SelectItem value="reuse">Reuse</SelectItem>
                          <SelectItem value="incineration_with_recovery">
                            Incineration (Energy Recovery)
                          </SelectItem>
                          <SelectItem value="incineration">Incineration</SelectItem>
                          <SelectItem value="anaerobic_digestion">Anaerobic Digestion</SelectItem>
                          <SelectItem value="landfill">Landfill</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="recycled_content_pct" className="text-xs">
                        Recycled Content (%)
                      </Label>
                      <Input
                        id="recycled_content_pct"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.recycled_content_pct ?? ""}
                        onChange={(e) =>
                          onChange({
                            recycled_content_pct: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="0-100"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recyclability_pct" className="text-xs">
                        Recyclability (%)
                      </Label>
                      <Input
                        id="recyclability_pct"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.recyclability_pct ?? ""}
                        onChange={(e) =>
                          onChange({
                            recyclability_pct: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="0-100"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="circularity_score" className="text-xs">
                        Circularity Score
                      </Label>
                      <Input
                        id="circularity_score"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.circularity_score ?? ""}
                        onChange={(e) =>
                          onChange({
                            circularity_score: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="0-100"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Land & Biodiversity */}
          <Card className={`${IMPACT_CATEGORIES[3].borderColor} border-l-4`}>
            <Collapsible
              open={expandedSections.includes("land")}
              onOpenChange={() => toggleSection("land")}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${IMPACT_CATEGORIES[3].bgColor}`}>
                        <Leaf className={`h-5 w-5 ${IMPACT_CATEGORIES[3].color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          Land & Biodiversity
                          <Badge variant="outline" className="text-xs font-normal">
                            ReCiPe 2016
                          </Badge>
                        </CardTitle>
                        <CardDescription>Land use and ecosystem impacts</CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        expandedSections.includes("land") ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="impact_land">Land Use</Label>
                      <div className="relative">
                        <Input
                          id="impact_land"
                          type="number"
                          step="0.000001"
                          min="0"
                          value={formData.impact_land ?? ""}
                          onChange={(e) =>
                            onChange({
                              impact_land: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          placeholder="0.00"
                          disabled={readOnly}
                          className="pr-24"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          m²a/{unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="terrestrial_ecotoxicity" className="text-xs">
                        Terrestrial Ecotoxicity
                      </Label>
                      <Input
                        id="terrestrial_ecotoxicity"
                        type="number"
                        step="0.000001"
                        min="0"
                        value={formData.terrestrial_ecotoxicity ?? ""}
                        onChange={(e) =>
                          onChange({
                            terrestrial_ecotoxicity: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="kg 1,4-DCB eq"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="freshwater_eutrophication" className="text-xs">
                        Freshwater Eutrophication
                      </Label>
                      <Input
                        id="freshwater_eutrophication"
                        type="number"
                        step="0.000001"
                        min="0"
                        value={formData.freshwater_eutrophication ?? ""}
                        onChange={(e) =>
                          onChange({
                            freshwater_eutrophication: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="kg P eq"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="terrestrial_acidification" className="text-xs">
                        Terrestrial Acidification
                      </Label>
                      <Input
                        id="terrestrial_acidification"
                        type="number"
                        step="0.000001"
                        min="0"
                        value={formData.terrestrial_acidification ?? ""}
                        onChange={(e) =>
                          onChange({
                            terrestrial_acidification: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="kg SO₂ eq"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </TabsContent>

        {/* Data Quality Tab */}
        <TabsContent value="quality" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Quality & Methodology</CardTitle>
              <CardDescription>
                Information about data sources, methodology, and quality indicators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_source_type">Data Source Type</Label>
                  <Select
                    value={formData.data_source_type || ""}
                    onValueChange={(value) =>
                      onChange({ data_source_type: value as DataSourceType })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DATA_SOURCE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="methodology_standard">Methodology Standard</Label>
                  <Select
                    value={formData.methodology_standard || ""}
                    onValueChange={(value) => onChange({ methodology_standard: value })}
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select standard" />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODOLOGY_STANDARDS.map((std) => (
                        <SelectItem key={std.value} value={std.value}>
                          {std.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="system_boundary">System Boundary</Label>
                  <Select
                    value={formData.system_boundary || ""}
                    onValueChange={(value) =>
                      onChange({ system_boundary: value as SystemBoundaryType })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select boundary" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SYSTEM_BOUNDARY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="functional_unit">Functional Unit</Label>
                  <Input
                    id="functional_unit"
                    value={formData.functional_unit || ""}
                    onChange={(e) => onChange({ functional_unit: e.target.value })}
                    placeholder="e.g., 1 kg of product at factory gate"
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="data_quality_score" className="flex items-center gap-1">
                    Data Quality (1-5)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>ISO 14044 scale: 1 = Excellent, 5 = Very Poor</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Select
                    value={formData.data_quality_score?.toString() || ""}
                    onValueChange={(value) =>
                      onChange({ data_quality_score: parseInt(value) })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Excellent</SelectItem>
                      <SelectItem value="2">2 - Good</SelectItem>
                      <SelectItem value="3">3 - Fair</SelectItem>
                      <SelectItem value="4">4 - Poor</SelectItem>
                      <SelectItem value="5">5 - Very Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_confidence_pct">Confidence (%)</Label>
                  <Input
                    id="data_confidence_pct"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={formData.data_confidence_pct ?? ""}
                    onChange={(e) =>
                      onChange({
                        data_confidence_pct: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="0-100"
                    disabled={readOnly}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="geographic_scope">Geographic Scope</Label>
                  <Input
                    id="geographic_scope"
                    value={formData.geographic_scope || ""}
                    onChange={(e) => onChange({ geographic_scope: e.target.value })}
                    placeholder="e.g., EU-27, Global, UK"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* Uncertainty */}
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Uncertainty (Optional)
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="uncertainty_type" className="text-xs">
                      Uncertainty Type
                    </Label>
                    <Select
                      value={formData.uncertainty_type || ""}
                      onValueChange={(value) =>
                        onChange({ uncertainty_type: value as UncertaintyType })
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="range">Range (min-max)</SelectItem>
                        <SelectItem value="std_dev">Standard Deviation</SelectItem>
                        <SelectItem value="coefficient_of_variation">
                          Coefficient of Variation (%)
                        </SelectItem>
                        <SelectItem value="pedigree_matrix">Pedigree Matrix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uncertainty_value" className="text-xs">
                      Uncertainty Value
                    </Label>
                    <Input
                      id="uncertainty_value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.uncertainty_value ?? ""}
                      onChange={(e) =>
                        onChange({
                          uncertainty_value: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        })
                      }
                      placeholder="± value or %"
                      disabled={readOnly}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Validity & Verification Tab */}
        <TabsContent value="validity" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Validity Period</CardTitle>
              <CardDescription>
                Define the time period for which this impact data is valid
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reference_year">Reference Year</Label>
                  <Input
                    id="reference_year"
                    type="number"
                    min="1990"
                    max="2100"
                    value={formData.reference_year ?? ""}
                    onChange={(e) =>
                      onChange({
                        reference_year: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    placeholder="e.g., 2024"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_from">Valid From</Label>
                  <Input
                    id="valid_from"
                    type="date"
                    value={formData.valid_from || ""}
                    onChange={(e) => onChange({ valid_from: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={formData.valid_until || ""}
                    onChange={(e) => onChange({ valid_until: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">External Verification</CardTitle>
              <CardDescription>
                Third-party verification details (EPD, independent verification)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="external_verifier_name">Verification Body</Label>
                  <Input
                    id="external_verifier_name"
                    value={formData.external_verifier_name || ""}
                    onChange={(e) => onChange({ external_verifier_name: e.target.value })}
                    placeholder="e.g., SGS, Bureau Veritas, DNV"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="external_verification_standard">Verification Standard</Label>
                  <Input
                    id="external_verification_standard"
                    value={formData.external_verification_standard || ""}
                    onChange={(e) => onChange({ external_verification_standard: e.target.value })}
                    placeholder="e.g., ISO 14025, ISO 14064-3"
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="external_verification_date">Verification Date</Label>
                  <Input
                    id="external_verification_date"
                    type="date"
                    value={formData.external_verification_date || ""}
                    onChange={(e) => onChange({ external_verification_date: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="external_verification_expiry">Verification Expiry</Label>
                  <Input
                    id="external_verification_expiry"
                    type="date"
                    value={formData.external_verification_expiry || ""}
                    onChange={(e) => onChange({ external_verification_expiry: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="external_verification_url">Verification URL</Label>
                <Input
                  id="external_verification_url"
                  type="url"
                  value={formData.external_verification_url || ""}
                  onChange={(e) => onChange({ external_verification_url: e.target.value })}
                  placeholder="Link to EPD registry or verification statement"
                  disabled={readOnly}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
