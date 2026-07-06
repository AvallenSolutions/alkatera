'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TreePine,
  Droplets,
  Wheat,
  Info,
  Fuel,
  Bug,
  Sprout,
  FlaskConical,
  Zap,
  AlertTriangle,
  Truck,
} from 'lucide-react';
import { ORCHARD_PESTICIDE_TYPE_LABELS } from '@/lib/orchard-utils';
import type { OrchardImpactResult, OrchardGrowingProfile } from '@/lib/types/orchard';
import { StateChip } from '@/components/studio/state-chip';

interface OrchardImpactOverviewProps {
  impacts: OrchardImpactResult | null;
  profile: OrchardGrowingProfile | null;
}

const DATA_QUALITY_TONES: Record<string, 'good' | 'attention' | 'stale'> = {
  HIGH: 'good',
  MEDIUM: 'attention',
  LOW: 'stale',
};

const SOIL_LABELS: Record<string, string> = {
  conventional_tillage: 'Conventional tillage',
  minimum_tillage: 'Minimum tillage',
  no_till: 'No-till',
  cover_cropping: 'Cover cropping',
  composting: 'Composting',
  biochar_compost: 'Biochar + compost',
  regenerative_integrated: 'Regenerative integrated',
};

const FERTILISER_LABELS: Record<string, string> = {
  none: 'None',
  synthetic_n: 'Synthetic nitrogen',
  organic_manure: 'Organic (manure)',
  organic_compost: 'Organic (compost)',
  mixed: 'Mixed (synthetic + organic)',
};

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: decimals });
}

function fmtSci(n: number): string {
  if (n === 0) return '0';
  if (n < 0.001) return n.toExponential(2);
  return n.toFixed(4);
}

export function OrchardImpactOverview({ impacts, profile }: OrchardImpactOverviewProps) {
  if (!impacts || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TreePine className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">
          No growing profile data available for this harvest.
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Complete the growing questionnaire to see environmental impacts.
        </p>
      </div>
    );
  }

  const areaHa = profile.area_ha || 1;
  const emissionsPerHa = impacts.total_emissions / areaHa;
  const waterPerHa = impacts.water_m3 / areaHa;
  const scarcityPerHa = impacts.water_scarcity_m3_eq / areaHa;
  const removalsPerHa = impacts.total_removals / areaHa;
  const yieldPerHa = profile.fruit_yield_tonnes / areaHa;

  // Emission source segments
  const fertAndN2o = impacts.flag_emissions.total_flag_co2e + impacts.non_flag_emissions.fertiliser_production_co2e;
  const fuelEmissions = impacts.non_flag_emissions.machinery_fuel_co2e;
  const irrigationEmissions = impacts.non_flag_emissions.irrigation_energy_co2e;
  const pesticideEmissions = impacts.non_flag_emissions.pesticide_production_co2e;
  const transportEmissions = impacts.non_flag_emissions.transport_co2e;
  const totalForBar = fertAndN2o + fuelEmissions + irrigationEmissions + pesticideEmissions + transportEmissions;

  const segments = [
    { label: 'Fertiliser & N₂O', value: fertAndN2o, colour: '#f59e0b' },
    { label: 'Fuel', value: fuelEmissions, colour: '#ef4444' },
    { label: 'Irrigation', value: irrigationEmissions, colour: '#3b82f6' },
    { label: 'Pesticides', value: pesticideEmissions, colour: '#8b5cf6' },
    { label: 'Transport', value: transportEmissions, colour: '#14b8a6' },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
      {/* Headline metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Emissions/ha"
          value={fmt(emissionsPerHa)}
          unit="kg CO₂e"
          icon={<TreePine className="h-5 w-5 text-studio-good" />}
          bgClass="bg-secondary"
        />
        <MetricCard
          label="Water/ha"
          value={fmt(waterPerHa)}
          unit="m³"
          icon={<Droplets className="h-5 w-5 text-studio-dim" />}
          bgClass="bg-secondary"
        />
        <MetricCard
          label="Removals/ha"
          value={fmt(removalsPerHa)}
          unit="kg CO₂e"
          icon={<TreePine className="h-5 w-5 text-studio-forest" />}
          bgClass="bg-secondary"
        />
        <MetricCard
          label="Yield"
          value={fmt(yieldPerHa, 1)}
          unit="t/ha"
          icon={<Wheat className="h-5 w-5 text-studio-attention" />}
          bgClass="bg-secondary"
        />
      </div>

      {/* Emission source breakdown bar */}
      {totalForBar > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Emission Sources</h4>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Breakdown of orchard emissions by source. Fertiliser includes both
                      production (Scope 3) and field N₂O emissions (FLAG).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="h-6 rounded-full overflow-hidden flex">
              {segments.map((seg) => {
                const pct = (seg.value / totalForBar) * 100;
                return (
                  <TooltipProvider key={seg.label}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: seg.colour,
                            minWidth: pct > 0 ? '4px' : '0',
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          {seg.label}: {fmt(seg.value)} kg CO₂e ({pct.toFixed(0)}%)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {segments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: seg.colour }}
                  />
                  {seg.label}: {fmt(seg.value)} kg
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed breakdown cards (2 columns) */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* FLAG N2O Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-studio-attention" />
              FLAG Emissions (N₂O + dLUC)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailRow label="Direct N₂O (fertiliser)" value={`${fmt(impacts.flag_emissions.n2o_direct_co2e)} kg CO₂e`} />
            <DetailRow label="Indirect N₂O (volatilisation + leaching)" value={`${fmt(impacts.flag_emissions.n2o_indirect_co2e)} kg CO₂e`} />
            <DetailRow label="Crop residue N₂O (tree prunings)" value={`${fmt(impacts.flag_emissions.n2o_crop_residue_co2e)} kg CO₂e`} />
            {impacts.flag_emissions.luc_co2e > 0 && (
              <DetailRow label="Land use change (dLUC)" value={`${fmt(impacts.flag_emissions.luc_co2e)} kg CO₂e`} />
            )}
            <div className="border-t pt-2 mt-2">
              <DetailRow label="Total FLAG emissions" value={`${fmt(impacts.flag_emissions.total_flag_co2e)} kg CO₂e`} bold />
            </div>
            <DetailRow label="Actual N₂O mass" value={`${impacts.n2o_kg.toFixed(3)} kg`} muted />
            <DetailRow label="Land occupation" value={`${fmt(impacts.flag_emissions.land_use_m2)} m²`} muted />
          </CardContent>
        </Card>

        {/* Non-FLAG Emissions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-studio-dim" />
              Energy & Industrial Emissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailRow label="Fertiliser production" value={`${fmt(impacts.non_flag_emissions.fertiliser_production_co2e)} kg CO₂e`} />
            <DetailRow label="Machinery fuel" value={`${fmt(impacts.non_flag_emissions.machinery_fuel_co2e)} kg CO₂e`} />
            <DetailRow label="Irrigation energy" value={`${fmt(impacts.non_flag_emissions.irrigation_energy_co2e)} kg CO₂e`} />
            <DetailRow label="Pesticide production" value={`${fmt(impacts.non_flag_emissions.pesticide_production_co2e)} kg CO₂e`} />
            <DetailRow label="Transport to facility" value={`${fmt(impacts.non_flag_emissions.transport_co2e)} kg CO₂e`} />
            <div className="border-t pt-2 mt-2">
              <DetailRow label="Total non-FLAG emissions" value={`${fmt(impacts.non_flag_emissions.total_non_flag_co2e)} kg CO₂e`} bold />
            </div>
            <DetailRow label="Fossil CO₂" value={`${impacts.co2_fossil_kg.toFixed(1)} kg`} muted />
          </CardContent>
        </Card>

        {/* Water & Scarcity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Droplets className="h-4 w-4 text-studio-dim" />
              Water Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailRow label="Blue water consumption" value={`${fmt(impacts.water_m3)} m³`} />
            <DetailRow label="Per hectare" value={`${fmt(waterPerHa)} m³/ha`} muted />
            <div className="border-t pt-2 mt-2">
              <DetailRow label="AWARE scarcity-weighted" value={`${fmt(impacts.water_scarcity_m3_eq)} m³ eq`} bold />
              <DetailRow label="Per hectare (scarcity-weighted)" value={`${fmt(scarcityPerHa)} m³ eq/ha`} muted />
            </div>
            {impacts.water_scarcity_m3_eq !== impacts.water_m3 && impacts.water_m3 > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                AWARE factor: {(impacts.water_scarcity_m3_eq / impacts.water_m3).toFixed(2)}x
                {(impacts.water_scarcity_m3_eq / impacts.water_m3) > 3 && (
                  <span className="text-studio-attention ml-1">(high water stress region)</span>
                )}
              </p>
            )}
            {!profile.is_irrigated && (
              <p className="text-xs text-muted-foreground italic">Rainfed orchard (no irrigation)</p>
            )}
          </CardContent>
        </Card>

        {/* Ecotoxicity & Environmental Quality */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="h-4 w-4 text-studio-dim" />
              Ecotoxicity & Environmental Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailRow label="Freshwater ecotoxicity" value={`${fmt(impacts.freshwater_ecotoxicity)} CTUe`} />
            <DetailRow label="Terrestrial ecotoxicity" value={`${fmt(impacts.terrestrial_ecotoxicity)} CTUe`} />
            <DetailRow label="Human toxicity (non-carc.)" value={`${fmtSci(impacts.human_toxicity_non_carcinogenic)} CTUh`} />
            <DetailRow label="Freshwater eutrophication" value={`${fmtSci(impacts.freshwater_eutrophication)} kg P eq`} />
            {!profile.uses_pesticides && !profile.uses_herbicides && (
              <p className="text-xs text-studio-good mt-2">
                No pesticides or herbicides applied
              </p>
            )}
            {profile.uses_pesticides && (
              <p className="text-xs text-muted-foreground mt-2">
                Pesticide type: {ORCHARD_PESTICIDE_TYPE_LABELS[profile.pesticide_type] || profile.pesticide_type}
                ({profile.pesticide_applications_per_year} applications/yr)
              </p>
            )}
            {profile.uses_herbicides && (
              <p className="text-xs text-muted-foreground">
                Herbicide type: {ORCHARD_PESTICIDE_TYPE_LABELS[profile.herbicide_type] || profile.herbicide_type}
                ({profile.herbicide_applications_per_year} applications/yr)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Soil Carbon & Removals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TreePine className="h-4 w-4 text-studio-forest" />
              Soil Carbon & Removals (FLAG)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailRow label="Total soil carbon removals" value={`${fmt(impacts.total_removals)} kg CO₂e`} bold />
            <DetailRow label="Per hectare" value={`${fmt(removalsPerHa)} kg CO₂e/ha`} muted />
            <div className="border-t pt-2 mt-2">
              <DetailRow label="Soil management" value={SOIL_LABELS[profile.soil_management] || profile.soil_management} />
              <DetailRow
                label="Methodology"
                value={impacts.flag_removals.methodology === 'measured' ? 'Verified measurement' : 'Practice-based default'}
              />
              {impacts.flag_removals.is_verified && (
                <StateChip tone="good" className="mt-1">Verified</StateChip>
              )}
            </div>
            {impacts.flag_removals.removals_warning && (
              <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-secondary border border-border">
                <AlertTriangle className="h-3.5 w-3.5 text-studio-attention shrink-0 mt-0.5" />
                <p className="text-xs text-studio-attention">
                  {impacts.flag_removals.removals_warning}
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Removals are reported separately from emissions per SBTi FLAG Guidance v1.2 and the GHG Protocol Land Sector and Removals Standard V1.0. They are never netted against the emissions total.
            </p>
          </CardContent>
        </Card>

        {/* TNFD Location & Nature */}
        {(profile.ecosystem_type || profile.in_biodiversity_sensitive_area || profile.water_stress_index) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TreePine className="h-4 w-4 text-studio-forest" />
                Location & Nature (TNFD)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.ecosystem_type && (
                <DetailRow label="Ecosystem type" value={profile.ecosystem_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
              )}
              <DetailRow
                label="Biodiversity-sensitive area"
                value={profile.in_biodiversity_sensitive_area ? 'Yes' : 'No'}
              />
              {profile.in_biodiversity_sensitive_area && profile.sensitive_area_details && (
                <DetailRow label="Designation" value={profile.sensitive_area_details} muted />
              )}
              {profile.in_biodiversity_sensitive_area && (
                <div className="rounded-md border border-border bg-secondary p-2 mt-1">
                  <p className="text-xs text-studio-attention">
                    Enhanced TNFD and CSRD ESRS E4 disclosure required for operations in or adjacent to sensitive areas.
                  </p>
                </div>
              )}
              {profile.water_stress_index && (
                <DetailRow label="Water stress" value={profile.water_stress_index.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
              )}
            </CardContent>
          </Card>
        )}

        {/* Growing Profile Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sprout className="h-4 w-4 text-studio-forest" />
              Growing Profile Inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailRow label="Area" value={`${fmt(profile.area_ha, 2)} ha`} />
            <DetailRow label="Fruit yield" value={`${fmt(profile.fruit_yield_tonnes, 1)} t (${fmt(yieldPerHa, 1)} t/ha)`} />
            <DetailRow label="Fertiliser" value={FERTILISER_LABELS[profile.fertiliser_type] || profile.fertiliser_type} />
            {profile.fertiliser_type !== 'none' && (
              <>
                <DetailRow label="Fertiliser quantity" value={`${fmt(profile.fertiliser_quantity_kg)} kg (${fmt(profile.fertiliser_quantity_kg / areaHa)} kg/ha)`} muted />
                <DetailRow label="Nitrogen content" value={`${profile.fertiliser_n_content_percent}%`} muted />
              </>
            )}
            <div className="border-t pt-2 mt-2">
              <DetailRow label="Diesel" value={`${fmt(profile.diesel_litres_per_year)} L/yr (${fmt(profile.diesel_litres_per_year / areaHa)} L/ha)`} />
              <DetailRow label="Petrol" value={`${fmt(profile.petrol_litres_per_year)} L/yr (${fmt(profile.petrol_litres_per_year / areaHa)} L/ha)`} />
            </div>
            {profile.is_irrigated && (
              <div className="border-t pt-2 mt-2">
                <DetailRow label="Irrigation" value={`${fmt(profile.water_m3_per_ha)} m³/ha`} />
                <DetailRow label="Energy source" value={profile.irrigation_energy_source.replace(/_/g, ' ')} muted />
              </div>
            )}
            {profile.transport_distance_km != null && profile.transport_distance_km > 0 && (
              <div className="border-t pt-2 mt-2">
                <DetailRow label="Transport distance" value={`${fmt(profile.transport_distance_km)} km`} />
                <DetailRow label="Transport mode" value={profile.transport_mode === 'rail' ? 'Rail' : 'Road (HGV)'} muted />
              </div>
            )}
            <DetailRow label="Pruning residue returned" value={profile.pruning_residue_returned ? 'Yes' : 'No'} muted />
          </CardContent>
        </Card>
      </div>

      {/* Normalised per-kg metrics */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <h4 className="text-sm font-semibold mb-3">Per-Kilogram Metrics (farm gate)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-lg font-bold">{impacts.total_emissions_per_kg.toFixed(3)}</p>
              <p className="text-xs text-muted-foreground">kg CO₂e/kg fruit</p>
            </div>
            <div>
              <p className="text-lg font-bold text-studio-forest">{impacts.removals_per_kg.toFixed(3)}</p>
              <p className="text-xs text-muted-foreground">kg CO₂e removed/kg</p>
            </div>
            <div>
              <p className="text-lg font-bold">{(impacts.water_m3 / (profile.fruit_yield_tonnes * 1000)).toFixed(3)}</p>
              <p className="text-xs text-muted-foreground">m³ water/kg fruit</p>
            </div>
            <div>
              <p className="text-lg font-bold">{(impacts.freshwater_ecotoxicity / (profile.fruit_yield_tonnes * 1000)).toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">CTUe/kg fruit</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data quality and methodology */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Data quality:</span>
        <StateChip tone={DATA_QUALITY_TONES[impacts.data_quality_grade] || 'quiet'}>
          {impacts.data_quality_grade}
        </StateChip>
        {impacts.flag_removals.methodology === 'measured' && (
          <StateChip tone="good">Verified soil carbon</StateChip>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="cursor-help">
                <Info className="h-3 w-3 mr-1" />
                Methodology
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md">
              <p className="text-xs whitespace-pre-wrap">{impacts.methodology_notes}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// Sub-components

function MetricCard({
  label,
  value,
  unit,
  icon,
  bgClass,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  bgClass: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${bgClass}`}>{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{unit}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className={`text-xs ${muted ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-xs text-right ${bold ? 'font-semibold text-foreground' : muted ? 'text-muted-foreground/70' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
