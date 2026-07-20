"use client";

// Parametric packaging material picker.
//
// Replaces the free-text emission-factor search for packaging: the user
// states WHAT the material is (class + variant), and the factor is derived
// deterministically from the packaging_factor_endpoints library at the
// item's recycled content. No factor list, no fuzzy matching, no drift.

import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  MATERIAL_CLASS_LIST,
  MATERIAL_CLASSES,
  getMaterialClass,
  resolveVariant,
  type PackagingMaterialClass,
} from "@/lib/constants/packaging-material-classes";
import {
  fetchActivePackagingEndpoints,
  endpointLookupKey,
  type PackagingFactorEndpoint,
} from "@/lib/calculations/packaging-factor";

// Module-level caches: the endpoint library is small (~13 active rows) and
// global, so one fetch serves every packaging card on the page.
let endpointCache: Map<string, PackagingFactorEndpoint> | null = null;
let endpointCachePromise: Promise<Map<string, PackagingFactorEndpoint>> | null = null;
const gapFillerFactorCache = new Map<string, number | null>();

async function loadEndpoints(): Promise<Map<string, PackagingFactorEndpoint>> {
  if (endpointCache) return endpointCache;
  if (!endpointCachePromise) {
    const supabase = getSupabaseBrowserClient();
    const wanted = MATERIAL_CLASS_LIST.filter((c) => c.kind === "parametric").flatMap((c) =>
      c.variants.map((v) => ({ materialClass: c.key, variant: v.key, region: "EU-27" })),
    );
    endpointCachePromise = fetchActivePackagingEndpoints(supabase, wanted).then((map) => {
      endpointCache = map;
      return map;
    });
  }
  return endpointCachePromise;
}

async function loadGapFillerFactor(factorId: string): Promise<number | null> {
  if (gapFillerFactorCache.has(factorId)) return gapFillerFactorCache.get(factorId) ?? null;
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from("staging_emission_factors")
    .select("co2_factor")
    .eq("id", factorId)
    .maybeSingle();
  const value = data?.co2_factor != null ? Number(data.co2_factor) : null;
  gapFillerFactorCache.set(factorId, value);
  return value;
}

export interface MaterialClassSelection {
  packaging_material_class: PackagingMaterialClass;
  packaging_material_variant: string;
  /** Kept in sync for end-of-life classification and EPR derivation. */
  container_material: string;
  /** 'parametric' | 'openlca' (gap-filler pinned by id) */
  data_source: "parametric" | "openlca";
  data_source_id?: string;
  /** Derived kg CO2e per kg at the current recycled content (for the live preview). */
  carbon_intensity?: number;
  ef_source?: string;
  ef_source_type?: string;
  ef_data_quality_grade?: string;
}

interface PackagingMaterialClassPickerProps {
  idPrefix: string;
  materialClass: string | null | undefined;
  variant: string | null | undefined;
  recycledContentPct: number | string | null | undefined;
  onSelect: (selection: MaterialClassSelection) => void;
  disabled?: boolean;
}

export function PackagingMaterialClassPicker({
  idPrefix,
  materialClass,
  variant,
  recycledContentPct,
  onSelect,
  disabled,
}: PackagingMaterialClassPickerProps) {
  const classDef = getMaterialClass(materialClass);
  const activeVariant = resolveVariant(materialClass, variant);
  const [derivedEf, setDerivedEf] = useState<number | null>(null);
  const [endpointMeta, setEndpointMeta] = useState<PackagingFactorEndpoint | null>(null);
  // Guards the async effect against out-of-order resolution.
  const requestSeq = useRef(0);

  const recycledR = useMemo(() => {
    const n = Number(recycledContentPct);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n)) / 100;
  }, [recycledContentPct]);

  // Keep the derived factor (and the form's carbon_intensity, via onSelect)
  // current whenever class, variant or recycled content changes.
  useEffect(() => {
    if (!classDef) {
      setDerivedEf(null);
      setEndpointMeta(null);
      return;
    }
    const seq = ++requestSeq.current;
    (async () => {
      if (classDef.kind === "parametric") {
        const endpoints = await loadEndpoints();
        if (seq !== requestSeq.current) return;
        const endpoint = endpoints.get(endpointLookupKey(classDef.key, activeVariant, "EU-27"));
        if (!endpoint) {
          setDerivedEf(null);
          setEndpointMeta(null);
          return;
        }
        setEndpointMeta(endpoint);
        setDerivedEf(
          endpoint.virgin_climate - recycledR * (endpoint.virgin_climate - endpoint.recycled_climate),
        );
      } else if (classDef.gapFillerFactorId) {
        const factor = await loadGapFillerFactor(classDef.gapFillerFactorId);
        if (seq !== requestSeq.current) return;
        setEndpointMeta(null);
        setDerivedEf(factor);
      }
    })().catch(() => {
      /* preview only — the calculator derives the authoritative factor */
    });
  }, [classDef, activeVariant, recycledR]);

  const applySelection = (clsKey: string, variantKey?: string) => {
    const def = getMaterialClass(clsKey);
    if (!def) return;
    const nextVariant = resolveVariant(def.key, variantKey ?? (clsKey === materialClass ? activeVariant : def.defaultVariant));
    const base: MaterialClassSelection = {
      packaging_material_class: def.key,
      packaging_material_variant: nextVariant,
      container_material: def.key,
      data_source: def.kind === "parametric" ? "parametric" : "openlca",
      data_source_id: def.kind === "gap_filler" ? def.gapFillerFactorId : undefined,
      ef_source:
        def.kind === "parametric"
          ? "Parametric (ecoinvent endpoints)"
          : "Curated composite factor",
      ef_source_type: "secondary",
      ef_data_quality_grade: undefined,
      carbon_intensity: undefined,
    };
    onSelect(base);
    // The effect above refreshes the derived EF; push it into the form once
    // available so the live impact preview works. Fire-and-forget.
    (async () => {
      if (def.kind === "parametric") {
        const endpoints = await loadEndpoints();
        const endpoint = endpoints.get(endpointLookupKey(def.key, nextVariant, "EU-27"));
        if (endpoint) {
          onSelect({
            ...base,
            carbon_intensity:
              endpoint.virgin_climate - recycledR * (endpoint.virgin_climate - endpoint.recycled_climate),
            ef_data_quality_grade: endpoint.is_provisional ? "MEDIUM" : "HIGH",
          });
        }
      } else if (def.gapFillerFactorId) {
        const factor = await loadGapFillerFactor(def.gapFillerFactorId);
        if (factor != null) {
          onSelect({ ...base, carbon_intensity: factor, ef_data_quality_grade: "MEDIUM" });
        }
      }
    })().catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-material-class`}>
            Material <span className="text-destructive">*</span>
          </Label>
          <Select
            value={classDef?.key ?? ""}
            onValueChange={(value) => applySelection(value)}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-material-class`}>
              <SelectValue placeholder="Choose the material..." />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_CLASS_LIST.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {classDef && classDef.variants.length > 1 && (
          <div>
            <Label htmlFor={`${idPrefix}-material-variant`}>
              {classDef.key === "glass" ? "Glass colour" : "Variant"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Select
              value={activeVariant}
              onValueChange={(value) => applySelection(classDef.key, value)}
              disabled={disabled}
            >
              <SelectTrigger id={`${idPrefix}-material-variant`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classDef.variants.map((v) => (
                  <SelectItem key={v.key} value={v.key}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {classDef && derivedEf != null && (
        <p className="text-xs text-muted-foreground">
          {classDef.kind === "parametric" && endpointMeta ? (
            <>
              Derived factor:{" "}
              <span className="font-medium text-foreground">
                {derivedEf.toFixed(3)} kg CO₂e/kg
              </span>{" "}
              at {(recycledR * 100).toFixed(0)}% recycled content (virgin{" "}
              {endpointMeta.virgin_climate.toFixed(2)}, fully recycled{" "}
              {endpointMeta.recycled_climate.toFixed(2)};{" "}
              {endpointMeta.dataset} {endpointMeta.dataset_version}, library v
              {endpointMeta.library_version})
            </>
          ) : (
            <>
              Curated composite factor:{" "}
              <span className="font-medium text-foreground">
                {derivedEf.toFixed(3)} kg CO₂e/kg
              </span>{" "}
              (no recycled-content interpolation for composites)
            </>
          )}
        </p>
      )}
    </div>
  );
}
