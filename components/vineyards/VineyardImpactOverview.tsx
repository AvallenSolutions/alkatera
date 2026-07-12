'use client';

/**
 * The vineyard impact overview, re-cut for the studio: a hairline
 * figures row instead of icon stat cards, cream hairline panels with
 * dim mono eyebrows instead of icon-headed cards, and studio inks on
 * the source bar. All figures and their maths are unchanged.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ViticultureImpactResult, VineyardGrowingProfile } from '@/lib/types/viticulture';
import { Panel } from '@/components/studio/panel';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { STUDIO } from '@/components/studio/theme';

interface VineyardImpactOverviewProps {
  impacts: ViticultureImpactResult | null;
  profile: VineyardGrowingProfile | null;
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

const PESTICIDE_LABELS: Record<string, string> = {
  generic: 'Generic',
  copper_fungicide: 'Copper fungicide',
  sulfur: 'Sulphur',
  synthetic_fungicide: 'Synthetic fungicide',
  herbicide_glyphosate: 'Glyphosate',
};

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: decimals });
}

function fmtSci(n: number): string {
  if (n === 0) return '0';
  if (n < 0.001) return n.toExponential(2);
  return n.toFixed(4);
}

export function VineyardImpactOverview({ impacts, profile }: VineyardImpactOverviewProps) {
  if (!impacts || !profile) {
    return (
      <div className="pt-2">
        <p className="text-sm text-muted-foreground">
          No growing data for this vintage yet. Complete the growing questionnaire to see its
          environmental impact.
        </p>
      </div>
    );
  }

  const areaHa = profile.area_ha || 1;
  const emissionsPerHa = impacts.total_emissions / areaHa;
  const waterPerHa = impacts.water_m3 / areaHa;
  const scarcityPerHa = impacts.water_scarcity_m3_eq / areaHa;
  const removalsPerHa = impacts.total_removals / areaHa;
  const yieldPerHa = profile.grape_yield_tonnes / areaHa;

  // Emission source segments
  const fertAndN2o = impacts.flag_emissions.total_flag_co2e + impacts.non_flag_emissions.fertiliser_production_co2e;
  const fuelEmissions = impacts.non_flag_emissions.machinery_fuel_co2e;
  const irrigationEmissions = impacts.non_flag_emissions.irrigation_energy_co2e;
  const pesticideEmissions = impacts.non_flag_emissions.pesticide_production_co2e;
  const totalForBar = fertAndN2o + fuelEmissions + irrigationEmissions + pesticideEmissions;

  const segments = [
    { label: 'Fertiliser & N₂O', value: fertAndN2o, colour: STUDIO.ochre },
    { label: 'Fuel', value: fuelEmissions, colour: STUDIO.brick },
    { label: 'Irrigation', value: irrigationEmissions, colour: STUDIO.cobalt },
    { label: 'Pesticides', value: pesticideEmissions, colour: STUDIO.plum },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
      {/* The figures row: the vintage on one hairline. */}
      <div className="flex flex-wrap gap-x-12 gap-y-5 border-y border-studio-hairline py-5">
        <BigNumber label="Emissions / ha · kg CO₂e" value={fmt(emissionsPerHa)} />
        <BigNumber label="Water / ha · m³" value={fmt(waterPerHa)} />
        <BigNumber label="Removals / ha · kg CO₂e" value={fmt(removalsPerHa)} />
        <BigNumber label="Yield · t/ha" value={fmt(yieldPerHa, 1)} />
      </div>

      {/* Emission source breakdown bar */}
      {totalForBar > 0 && (
        <Panel>
          <Eyebrow tone="dim">EMISSION SOURCES</Eyebrow>
          <div className="mt-3 flex h-5 overflow-hidden rounded-[3px]">
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
          <div className="mt-3 flex flex-wrap gap-4">
            {segments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div
                  className="h-2 w-2 rounded-[2px]"
                  style={{ backgroundColor: seg.colour }}
                />
                {seg.label}: {fmt(seg.value)} kg
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Fertiliser includes both production (Scope 3) and field N₂O emissions (FLAG).
          </p>
        </Panel>
      )}

      {/* Detailed breakdown panels (2 columns) */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* FLAG N2O Breakdown */}
        <Panel>
          <Eyebrow tone="dim" className="mb-3">FLAG EMISSIONS (N₂O + DLUC)</Eyebrow>
          <div className="space-y-2">
            <DetailRow label="Direct N₂O (fertiliser)" value={`${fmt(impacts.flag_emissions.n2o_direct_co2e)} kg CO₂e`} />
            <DetailRow label="Indirect N₂O (volatilisation + leaching)" value={`${fmt(impacts.flag_emissions.n2o_indirect_co2e)} kg CO₂e`} />
            <DetailRow label="Crop residue N₂O (vine prunings)" value={`${fmt(impacts.flag_emissions.n2o_crop_residue_co2e)} kg CO₂e`} />
            {(impacts.flag_emissions.ch4_residue_burning_co2e ?? 0) > 0 && (
              <DetailRow
                label="Biomass burning CH₄ (prunings)"
                value={`${fmt(impacts.flag_emissions.ch4_residue_burning_co2e || 0)} kg CO₂e`}
              />
            )}
            {(impacts.flag_emissions.n2o_residue_burning_co2e ?? 0) > 0 && (
              <DetailRow
                label="Biomass burning N₂O (prunings)"
                value={`${fmt(impacts.flag_emissions.n2o_residue_burning_co2e || 0)} kg CO₂e`}
              />
            )}
            {((impacts.flag_emissions.ch4_residue_burning_co2e ?? 0) > 0 ||
              (impacts.flag_emissions.n2o_residue_burning_co2e ?? 0) > 0) && (
              <p className="text-[10px] text-muted-foreground -mt-1">
                IPCC 2006 Vol 4 Ch 2.4. Biogenic CO₂ from combustion excluded per GHG Protocol / SBTi FLAG.
              </p>
            )}
            {impacts.flag_emissions.luc_co2e > 0 && (
              <DetailRow label="Land use change (dLUC)" value={`${fmt(impacts.flag_emissions.luc_co2e)} kg CO₂e`} />
            )}
            <div className="border-t border-studio-hairline pt-2 mt-2">
              <DetailRow label="Total FLAG emissions" value={`${fmt(impacts.flag_emissions.total_flag_co2e)} kg CO₂e`} bold />
            </div>
            <DetailRow label="Actual N₂O mass" value={`${impacts.n2o_kg.toFixed(3)} kg`} muted />
            <DetailRow label="Land occupation" value={`${fmt(impacts.flag_emissions.land_use_m2)} m²`} muted />
          </div>
        </Panel>

        {/* Non-FLAG Emissions */}
        <Panel>
          <Eyebrow tone="dim" className="mb-3">ENERGY & INDUSTRIAL EMISSIONS</Eyebrow>
          <div className="space-y-2">
            <DetailRow label="Fertiliser production" value={`${fmt(impacts.non_flag_emissions.fertiliser_production_co2e)} kg CO₂e`} />
            <DetailRow label="Machinery fuel" value={`${fmt(impacts.non_flag_emissions.machinery_fuel_co2e)} kg CO₂e`} />
            {(impacts.non_flag_emissions.road_diesel_co2e ?? 0) > 0 && (
              <div className="pl-4">
                <DetailRow label="↳ Road diesel" value={`${fmt(impacts.non_flag_emissions.road_diesel_co2e || 0)} kg CO₂e`} muted />
              </div>
            )}
            {(impacts.non_flag_emissions.red_diesel_co2e ?? 0) > 0 && (
              <div className="pl-4">
                <DetailRow label="↳ Red / agricultural diesel" value={`${fmt(impacts.non_flag_emissions.red_diesel_co2e || 0)} kg CO₂e`} muted />
              </div>
            )}
            {(impacts.non_flag_emissions.petrol_co2e ?? 0) > 0 && (
              <div className="pl-4">
                <DetailRow label="↳ Petrol" value={`${fmt(impacts.non_flag_emissions.petrol_co2e || 0)} kg CO₂e`} muted />
              </div>
            )}
            <DetailRow label="Irrigation energy" value={`${fmt(impacts.non_flag_emissions.irrigation_energy_co2e)} kg CO₂e`} />
            <DetailRow label="Pesticide production" value={`${fmt(impacts.non_flag_emissions.pesticide_production_co2e)} kg CO₂e`} />
            <div className="border-t border-studio-hairline pt-2 mt-2">
              <DetailRow label="Total non-FLAG emissions" value={`${fmt(impacts.non_flag_emissions.total_non_flag_co2e)} kg CO₂e`} bold />
            </div>
            <DetailRow label="Fossil CO₂" value={`${impacts.co2_fossil_kg.toFixed(1)} kg`} muted />
          </div>
        </Panel>

        {/* Water & Scarcity */}
        <Panel>
          <Eyebrow tone="dim" className="mb-3">WATER IMPACT</Eyebrow>
          <div className="space-y-2">
            <DetailRow label="Blue water consumption" value={`${fmt(impacts.water_m3)} m³`} />
            <DetailRow label="Per hectare" value={`${fmt(waterPerHa)} m³/ha`} muted />
            <div className="border-t border-studio-hairline pt-2 mt-2">
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
              <p className="text-xs text-muted-foreground italic">Rainfed vineyard (no irrigation)</p>
            )}
          </div>
        </Panel>

        {/* Ecotoxicity & Environmental Quality */}
        <Panel>
          <Eyebrow tone="dim" className="mb-3">ECOTOXICITY & ENVIRONMENTAL QUALITY</Eyebrow>
          <div className="space-y-2">
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
                Pesticide type: {PESTICIDE_LABELS[profile.pesticide_type] || profile.pesticide_type}
                ({profile.pesticide_applications_per_year} applications/yr)
              </p>
            )}
            {profile.uses_herbicides && (
              <p className="text-xs text-muted-foreground">
                Herbicide type: {PESTICIDE_LABELS[profile.herbicide_type] || profile.herbicide_type}
                ({profile.herbicide_applications_per_year} applications/yr)
              </p>
            )}
          </div>
        </Panel>

        {/* Soil Carbon & Removals */}
        <Panel>
          <Eyebrow tone="dim" className="mb-3">SOIL CARBON & REMOVALS (FLAG)</Eyebrow>
          <div className="space-y-2">
            <DetailRow label="Total FLAG removals" value={`${fmt(impacts.total_removals)} kg CO₂e`} bold />
            <DetailRow label="Per hectare" value={`${fmt(removalsPerHa)} kg CO₂e/ha`} muted />
            <div className="border-t border-studio-hairline pt-2 mt-2">
              <DetailRow label="Soil carbon" value={`${fmt(impacts.flag_removals.soil_carbon_co2e)} kg CO₂e`} />
              <DetailRow label="Soil management" value={SOIL_LABELS[profile.soil_management] || profile.soil_management} muted />
              <DetailRow
                label="Soil methodology"
                value={impacts.flag_removals.methodology === 'measured' ? 'Verified measurement' : 'Practice-based default'}
                muted
              />
              {impacts.flag_removals.is_verified && (
                <StateChip tone="good" className="mt-1">Verified</StateChip>
              )}
            </div>
            <div className="border-t border-studio-hairline pt-2 mt-2">
              <DetailRow label="Above-ground biomass carbon" value={`${fmt(impacts.flag_removals.biomass_carbon_co2e)} kg CO₂e`} />
              <DetailRow
                label="Biomass methodology"
                value={impacts.flag_removals.biomass_carbon_methodology === 'age_based_default' ? 'Age-based default (IPCC 2019 Vol 4 Ch 2)' : 'Not calculated'}
                muted
              />
            </div>
            {impacts.flag_removals.removals_warning && (
              <p className="mt-2 text-xs text-studio-attention">
                {impacts.flag_removals.removals_warning}
              </p>
            )}
            {impacts.flag_removals.biomass_carbon_warning && (
              <p className="mt-2 text-xs text-muted-foreground">
                {impacts.flag_removals.biomass_carbon_warning}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Removals are reported separately from emissions per SBTi FLAG Guidance v1.2 and the GHG Protocol Land Sector and Removals Standard V1.0. They are never netted against the emissions total.
            </p>
          </div>
        </Panel>

        {/* TNFD Location & Nature */}
        {(profile.ecosystem_type || profile.in_biodiversity_sensitive_area || profile.water_stress_index) && (
          <Panel>
            <Eyebrow tone="dim" className="mb-3">LOCATION & NATURE (TNFD)</Eyebrow>
            <div className="space-y-2">
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
                <p className="mt-1 text-xs text-studio-attention">
                  Enhanced TNFD and CSRD ESRS E4 disclosure required for operations in or adjacent to sensitive areas.
                </p>
              )}
              {profile.water_stress_index && (
                <DetailRow label="Water stress" value={profile.water_stress_index.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
              )}
            </div>
          </Panel>
        )}

        {/* Growing Profile Summary */}
        <Panel>
          <Eyebrow tone="dim" className="mb-3">GROWING PROFILE INPUTS</Eyebrow>
          <div className="space-y-2">
            <DetailRow label="Area" value={`${fmt(profile.area_ha, 2)} ha`} />
            <DetailRow label="Grape yield" value={`${fmt(profile.grape_yield_tonnes, 1)} t (${fmt(yieldPerHa, 1)} t/ha)`} />
            <DetailRow label="Fertiliser" value={FERTILISER_LABELS[profile.fertiliser_type] || profile.fertiliser_type} />
            {profile.fertiliser_type !== 'none' && (
              <>
                <DetailRow label="Fertiliser quantity" value={`${fmt(profile.fertiliser_quantity_kg)} kg (${fmt(profile.fertiliser_quantity_kg / areaHa)} kg/ha)`} muted />
                <DetailRow label="Nitrogen content" value={`${profile.fertiliser_n_content_percent}%`} muted />
              </>
            )}
            <div className="border-t border-studio-hairline pt-2 mt-2">
              <DetailRow label="Road diesel" value={`${fmt(profile.diesel_litres_per_year)} L/yr (${fmt(profile.diesel_litres_per_year / areaHa)} L/ha)`} />
              {((profile as any).red_diesel_litres_per_year ?? 0) > 0 && (
                <DetailRow
                  label="Red / agricultural diesel"
                  value={`${fmt((profile as any).red_diesel_litres_per_year)} L/yr (${fmt(((profile as any).red_diesel_litres_per_year) / areaHa)} L/ha)`}
                />
              )}
              <DetailRow label="Petrol" value={`${fmt(profile.petrol_litres_per_year)} L/yr (${fmt(profile.petrol_litres_per_year / areaHa)} L/ha)`} />
            </div>
            {profile.is_irrigated && (
              <div className="border-t border-studio-hairline pt-2 mt-2">
                <DetailRow label="Irrigation" value={`${fmt(profile.water_m3_per_ha)} m³/ha`} />
                <DetailRow label="Energy source" value={profile.irrigation_energy_source.replace(/_/g, ' ')} muted />
              </div>
            )}
            {(() => {
              const t = (profile.pruning_residue_management_type ?? (profile.pruning_residue_returned ? 'in_field' : 'removed_for_biomass')) as
                | 'in_field' | 'removed_for_biomass' | 'chipped_and_spread' | 'burned';
              const label =
                t === 'in_field' ? 'Left in field to decompose'
                : t === 'removed_for_biomass' ? 'Removed for biomass / off-site'
                : t === 'chipped_and_spread' ? 'Chipped and spread back'
                : 'Burned in-field';
              return (
                <>
                  <DetailRow label="Pruning management" value={label} muted />
                  {t === 'burned' && ((profile as any).pruning_residue_burned_kg_per_ha ?? 0) > 0 && (
                    <DetailRow
                      label="Pruning DM burned"
                      value={`${fmt((profile as any).pruning_residue_burned_kg_per_ha)} kg/ha/yr`}
                      muted
                    />
                  )}
                  {(profile.pruning_residue_measured_kg_per_ha ?? 0) > 0 && t !== 'burned' && (
                    <DetailRow
                      label="Pruning DM (measured)"
                      value={`${fmt(profile.pruning_residue_measured_kg_per_ha as number)} kg/ha/yr`}
                      muted
                    />
                  )}
                </>
              );
            })()}
          </div>
        </Panel>
      </div>

      {/* Normalised per-kg metrics */}
      <Panel>
        <Eyebrow tone="dim">PER KILOGRAM (FARM GATE)</Eyebrow>
        <div className="mt-4 flex flex-wrap gap-x-12 gap-y-5">
          <BigNumber label="kg CO₂e / kg grapes" value={impacts.total_emissions_per_kg.toFixed(3)} />
          <BigNumber label="kg CO₂e removed / kg" value={impacts.removals_per_kg.toFixed(3)} />
          <BigNumber label="m³ water / kg grapes" value={(impacts.water_m3 / (profile.grape_yield_tonnes * 1000)).toFixed(3)} />
          <BigNumber label="CTUe / kg grapes" value={(impacts.freshwater_ecotoxicity / (profile.grape_yield_tonnes * 1000)).toFixed(1)} />
        </div>
      </Panel>

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
              <span className="cursor-help font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground underline decoration-dotted underline-offset-4">
                Methodology
              </span>
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

// ─── Sub-components ────────────────────────────────────────────────────────

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
