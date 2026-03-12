"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Droplets,
  TreePine,
  Trash2,
  MapPin,
  Calendar,
  FlaskConical,
  Layers,
  Truck,
  Zap,
  Factory,
} from "lucide-react";
import type { SearchResult } from "./InlineIngredientSearch";

// ── Mini Bar Chart ──────────────────────────────────────────────────────

function ImpactMiniBar({
  label,
  value,
  unit,
  colour,
  maxValue,
}: {
  label: string;
  value: number;
  unit: string;
  colour: string;
  maxValue: number;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-right text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full ${colour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-28 text-right font-mono text-muted-foreground shrink-0">
        {value.toFixed(3)} {unit}
      </span>
    </div>
  );
}

// ── Decomposition Stacked Bar ───────────────────────────────────────────

function DecompositionBar({
  productionPct,
  transportPct,
  electricityPct,
  electricityGeo,
}: {
  productionPct: number;
  transportPct: number;
  electricityPct: number;
  electricityGeo?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      {/* Stacked bar */}
      <div className="h-2.5 rounded-full overflow-hidden flex bg-secondary">
        {productionPct > 0 && (
          <div
            className="h-full bg-slate-500 dark:bg-slate-400"
            style={{ width: `${productionPct}%` }}
            title={`Production ~${productionPct.toFixed(0)}%`}
          />
        )}
        {transportPct > 0 && (
          <div
            className="h-full bg-amber-500 dark:bg-amber-400"
            style={{ width: `${transportPct}%` }}
            title={`Transport ~${transportPct.toFixed(0)}%`}
          />
        )}
        {electricityPct > 0 && (
          <div
            className="h-full bg-blue-500 dark:bg-blue-400"
            style={{ width: `${electricityPct}%` }}
            title={`Electricity ~${electricityPct.toFixed(0)}%`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        <span className="inline-flex items-center gap-1">
          <Factory className="h-2.5 w-2.5 text-slate-500 dark:text-slate-400" />
          Production ~{productionPct.toFixed(0)}%
        </span>
        {transportPct > 0 && (
          <span className="inline-flex items-center gap-1">
            <Truck className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />
            Transport ~{transportPct.toFixed(0)}%
          </span>
        )}
        {electricityPct > 0 && (
          <span className="inline-flex items-center gap-1">
            <Zap className="h-2.5 w-2.5 text-blue-500 dark:text-blue-400" />
            Electricity ~{electricityPct.toFixed(0)}%
            {electricityGeo && (
              <span className="text-muted-foreground/70">({electricityGeo})</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Quality Grade Helpers ───────────────────────────────────────────────

function getQualityBadgeProps(grade: string): {
  label: string;
  className: string;
} {
  switch (grade) {
    case "HIGH":
      return {
        label: "High Quality",
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      };
    case "MEDIUM":
      return {
        label: "Medium Quality",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      };
    case "LOW":
      return {
        label: "Low Quality",
        className:
          "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      };
    default:
      return {
        label: grade,
        className: "bg-secondary text-secondary-foreground",
      };
  }
}

// ── Main Component ──────────────────────────────────────────────────────

interface EmissionFactorDetailPopoverProps {
  result: SearchResult;
  children: React.ReactNode;
}

export function EmissionFactorDetailPopover({
  result,
  children,
}: EmissionFactorDetailPopoverProps) {
  const co2 = result.co2_factor;
  const water = result.water_factor;
  const land = result.land_factor;
  const waste = result.waste_factor;
  const unit = result.unit || "kg";

  // Decomposition data (from metadata, when available for ecoinvent proxies)
  const climateProduction = result.metadata?.impact_climate_production as
    | number
    | undefined;
  const climateTransport = result.metadata?.impact_climate_transport as
    | number
    | undefined;
  const climateElectricity = result.metadata?.impact_climate_electricity as
    | number
    | undefined;
  const electricityGeo = result.metadata?.embedded_electricity_geography as
    | string
    | undefined;
  const hasDecomposition =
    climateProduction != null && climateProduction > 0 && co2 != null && co2 > 0;

  // Compute decomposition percentages
  const totalClimate = co2 || 1;
  const transportPct = climateTransport
    ? (climateTransport / totalClimate) * 100
    : 0;
  const electricityPct = climateElectricity
    ? (climateElectricity / totalClimate) * 100
    : 0;
  const productionPct = hasDecomposition
    ? Math.max(0, (climateProduction / totalClimate) * 100)
    : 0;

  // Data quality
  const qualityGrade =
    result.data_quality_grade || result.metadata?.data_quality_grade;
  const uncertaintyPct =
    result.uncertainty_percent || result.metadata?.uncertainty_percent;

  // Geographic & temporal scope
  const geoScope = result.metadata?.geographic_scope;
  const temporalCoverage = result.metadata?.temporal_coverage;
  const systemBoundary = result.metadata?.system_boundary;

  // Methodology (ecoinvent)
  const systemModel = result.metadata?.system_model;
  const lciaMethod = result.metadata?.lcia_method;
  const ecoinventProcessName = result.metadata?.ecoinvent_process_name;

  // Source citation
  const citation = result.source_citation || result.source;

  // Determine which sections to show
  const hasImpactData = co2 != null && co2 > 0;
  const hasMultiImpact =
    (water != null && water > 0) ||
    (land != null && land > 0) ||
    (waste != null && waste > 0);
  const hasQuality = qualityGrade || uncertaintyPct;
  const hasMethodology = systemModel || lciaMethod || ecoinventProcessName;
  const hasGeoTemporal = geoScope || temporalCoverage || systemBoundary;

  // Max value for impact bars (use the largest of the 4 for relative sizing)
  const maxImpact = Math.max(co2 || 0, water || 0, land || 0, waste || 0, 0.001);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-80 p-0 text-[11px]"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b">
          <p className="font-medium text-xs leading-snug">
            {result.friendly_name || result.name}
          </p>
          {result.friendly_name && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-snug truncate">
              {result.name}
            </p>
          )}
          {citation && (
            <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug line-clamp-2">
              {citation}
            </p>
          )}
        </div>

        {/* Impact Summary */}
        {hasImpactData && (
          <div className="px-3 py-2 border-b space-y-1">
            <p className="font-medium text-muted-foreground uppercase tracking-wider text-[9px] mb-1.5">
              Impact Summary
            </p>
            <ImpactMiniBar
              label="Climate"
              value={co2!}
              unit={`CO₂e/${unit}`}
              colour="bg-orange-500 dark:bg-orange-400"
              maxValue={maxImpact}
            />
            {water != null && water > 0 && (
              <ImpactMiniBar
                label="Water"
                value={water}
                unit={`m³/${unit}`}
                colour="bg-blue-500 dark:bg-blue-400"
                maxValue={maxImpact}
              />
            )}
            {land != null && land > 0 && (
              <ImpactMiniBar
                label="Land"
                value={land}
                unit={`m²·yr/${unit}`}
                colour="bg-green-500 dark:bg-green-400"
                maxValue={maxImpact}
              />
            )}
            {waste != null && waste > 0 && (
              <ImpactMiniBar
                label="Waste"
                value={waste}
                unit={`kg/${unit}`}
                colour="bg-slate-500 dark:bg-slate-400"
                maxValue={maxImpact}
              />
            )}
          </div>
        )}

        {/* Factor Composition (decomposition) */}
        {hasDecomposition && (
          <div className="px-3 py-2 border-b space-y-1.5">
            <p className="font-medium text-muted-foreground uppercase tracking-wider text-[9px]">
              Factor Composition
            </p>
            <DecompositionBar
              productionPct={productionPct}
              transportPct={transportPct}
              electricityPct={electricityPct}
              electricityGeo={electricityGeo}
            />
            <p className="text-[9px] text-muted-foreground/60 leading-snug mt-1">
              If you specify ingredient origin and transport, your actual data
              will replace these generic estimates during calculation.
            </p>
          </div>
        )}

        {/* Data Quality */}
        {(hasQuality || hasGeoTemporal) && (
          <div className="px-3 py-2 border-b">
            <p className="font-medium text-muted-foreground uppercase tracking-wider text-[9px] mb-1.5">
              Data Quality
            </p>
            <div className="space-y-1">
              {qualityGrade && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">Grade</span>
                  <Badge
                    className={`text-[9px] px-1.5 py-0 ${getQualityBadgeProps(qualityGrade).className}`}
                  >
                    {getQualityBadgeProps(qualityGrade).label}
                  </Badge>
                </div>
              )}
              {uncertaintyPct != null && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">Uncertainty</span>
                  <span>±{uncertaintyPct}%</span>
                </div>
              )}
              {geoScope && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-[68px]">Geography</span>
                  <span>{geoScope}</span>
                </div>
              )}
              {temporalCoverage && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-[68px]">Period</span>
                  <span>{temporalCoverage}</span>
                </div>
              )}
              {systemBoundary && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">Boundary</span>
                  <span className="line-clamp-1">{systemBoundary}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Methodology (ecoinvent) */}
        {hasMethodology && (
          <div className="px-3 py-2">
            <p className="font-medium text-muted-foreground uppercase tracking-wider text-[9px] mb-1.5">
              Methodology
            </p>
            <div className="space-y-1">
              {systemModel && (
                <div className="flex items-center gap-2">
                  <Layers className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-[68px]">Model</span>
                  <span>{systemModel}</span>
                </div>
              )}
              {lciaMethod && (
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-[68px]">LCIA</span>
                  <span className="line-clamp-1">{lciaMethod}</span>
                </div>
              )}
              {ecoinventProcessName && (
                <div className="flex items-start gap-2 mt-1">
                  <span className="text-muted-foreground w-[68px] shrink-0">Process</span>
                  <span className="text-[10px] text-muted-foreground/70 leading-snug line-clamp-2">
                    {ecoinventProcessName}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fallback: if no data at all */}
        {!hasImpactData && !hasQuality && !hasMethodology && !hasGeoTemporal && (
          <div className="px-3 py-3 text-muted-foreground/60 text-center">
            No additional factor details available.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
