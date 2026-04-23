'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Info, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import {
  listFacilityArchetypes,
  pedigreeToConfidencePct,
  type FacilityArchetype,
  type HybridOverrides,
  type DataCollectionMode,
} from '@/lib/facility-archetypes';

interface Props {
  mode: Exclude<DataCollectionMode, 'primary'>;
  selectedArchetypeId: string | null | undefined;
  onArchetypeChange: (archetypeId: string) => void;
  justification: string;
  onJustificationChange: (value: string) => void;
  hybridOverrides?: HybridOverrides;
  onHybridOverridesChange?: (overrides: HybridOverrides) => void;
}

export function FacilityArchetypeProxyForm({
  mode,
  selectedArchetypeId,
  onArchetypeChange,
  justification,
  onJustificationChange,
  hybridOverrides,
  onHybridOverridesChange,
}: Props) {
  const [archetypes, setArchetypes] = useState<FacilityArchetype[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listFacilityArchetypes(getSupabaseBrowserClient() as any)
      .then((rows) => {
        if (!cancelled) setArchetypes(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = archetypes.find((a) => a.id === selectedArchetypeId) ?? null;
  const predictedDqi = selected
    ? pedigreeToConfidencePct({
        reliability: selected.pedigreeReliability,
        completeness: selected.pedigreeCompleteness,
        temporal: selected.pedigreeTemporal,
        geographical: selected.pedigreeGeographical,
        technological: selected.pedigreeTechnological,
      })
    : null;

  const updateOverride = (key: keyof HybridOverrides, value: string) => {
    if (!onHybridOverridesChange) return;
    const next: HybridOverrides = { ...(hybridOverrides ?? {}) };
    if (value === '' || value === null) {
      delete next[key];
    } else {
      const n = parseFloat(value);
      if (Number.isFinite(n) && n >= 0) next[key] = n;
    }
    onHybridOverridesChange(next);
  };

  return (
    <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-amber-600 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          {mode === 'archetype_proxy'
            ? 'Emissions will be estimated from an industry-typical archetype. This is Secondary data per ISO 14044 §4.2.3.6 and will be clearly labelled in your report.'
            : 'Enter the values you know; unchecked fields will be backfilled from the selected archetype.'}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Facility archetype</Label>
        <Select
          value={selectedArchetypeId ?? ''}
          onValueChange={onArchetypeChange}
          disabled={loading}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={loading ? 'Loading archetypes\u2026' : 'Select the best match'} />
          </SelectTrigger>
          <SelectContent>
            {archetypes.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && (
        <div className="rounded-md border bg-background p-3 space-y-2 text-xs">
          <div className="font-medium">{selected.displayName}</div>
          {selected.description && (
            <div className="text-muted-foreground">{selected.description}</div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <IntensityRow
              label="Electricity"
              value={selected.electricityKwhPerUnit}
              unit={`kWh / ${selected.unit.replace('_', ' ')}`}
              editable={mode === 'hybrid'}
              override={hybridOverrides?.electricity_kwh_per_unit}
              onChange={(v) => updateOverride('electricity_kwh_per_unit', v)}
            />
            <IntensityRow
              label="Natural gas"
              value={selected.naturalGasKwhPerUnit}
              unit={`kWh / ${selected.unit.replace('_', ' ')}`}
              editable={mode === 'hybrid'}
              override={hybridOverrides?.natural_gas_kwh_per_unit}
              onChange={(v) => updateOverride('natural_gas_kwh_per_unit', v)}
            />
            <IntensityRow
              label="Thermal fuel"
              value={selected.thermalFuelKwhPerUnit}
              unit={`kWh / ${selected.unit.replace('_', ' ')}`}
              editable={mode === 'hybrid'}
              override={hybridOverrides?.thermal_fuel_kwh_per_unit}
              onChange={(v) => updateOverride('thermal_fuel_kwh_per_unit', v)}
            />
            <IntensityRow
              label="Water"
              value={selected.waterLitresPerUnit}
              unit={`L / ${selected.unit.replace('_', ' ')}`}
              editable={mode === 'hybrid'}
              override={hybridOverrides?.water_litres_per_unit}
              onChange={(v) => updateOverride('water_litres_per_unit', v)}
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t text-[11px] text-muted-foreground">
            <span>
              Source: {selected.sourceCitation} ({selected.sourceYear})
              {selected.sourceUrl && (
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 underline"
                >
                  link <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </span>
            <span className="tabular-nums">
              Predicted DQI: <strong>{predictedDqi}%</strong> · &plusmn;{selected.uncertaintyPct}%
            </span>
          </div>
        </div>
      )}

      {mode === 'archetype_proxy' && (
        <div className="space-y-1">
          <Label className="text-xs">
            Why primary data could not be obtained
            <span className="text-red-500 ml-0.5">*</span>
          </Label>
          <Textarea
            rows={2}
            value={justification}
            onChange={(e) => onJustificationChange(e.target.value)}
            placeholder="e.g. 3rd-party canning facility runs multiple SKUs on shared lines and does not track per-run energy; allocation methodology unavailable."
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Required for ISO 14044 §4.2.3.6 audit trail. Will appear in the Data Quality Declaration of your report.
          </p>
        </div>
      )}

      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs">
          This facility will be reported as <strong>Secondary data – Archetype Proxy</strong>. The overall DQI score of your assessment will be downgraded accordingly.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function IntensityRow({
  label,
  value,
  unit,
  editable,
  override,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  editable: boolean;
  override?: number;
  onChange: (value: string) => void;
}) {
  if (editable) {
    return (
      <div className="space-y-0.5">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <Input
          type="number"
          step="0.001"
          min="0"
          value={override ?? ''}
          placeholder={value.toString()}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-xs"
        />
        <div className="text-[10px] text-muted-foreground">{unit}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="tabular-nums font-medium">
        {value.toFixed(3)} <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
