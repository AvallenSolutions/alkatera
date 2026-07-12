'use client';

/**
 * The arable harvest history, re-cut for the studio: a quiet mono
 * count, a room pill for the add action, the table on a cream hairline
 * panel with mono heads, typographic deltas and expand marks instead
 * of icons. Sorting, deltas and the expanded detail are unchanged.
 */

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ArableHarvestImpactSummary } from '@/lib/types/arable';
import { Panel } from '@/components/studio/panel';
import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';

interface HarvestHistoryTableProps {
  harvestImpacts: ArableHarvestImpactSummary[];
  fieldId: string;
  onEditHarvest: (year: number) => void;
  onAddHarvest: () => void;
}

const HEAD_CLASS = 'font-mono text-[10px] font-bold uppercase tracking-[0.14em]';

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: decimals });
}

function fmtSci(n: number): string {
  if (n === 0) return '0';
  if (n < 0.001) return n.toExponential(1);
  return n.toFixed(3);
}

function DeltaIndicator({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) return null;
  const pctChange = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pctChange) < 0.5) return null;

  const isUp = pctChange > 0;
  // For most metrics, down = good (green). For yield/removals, up = good.
  const isGood = invert ? isUp : !isUp;
  return (
    <span
      className={`ml-1 font-mono text-[10px] tabular-nums ${
        isGood ? 'text-studio-good' : 'text-studio-stale'
      }`}
    >
      {isUp ? '↑' : '↓'}{Math.abs(pctChange).toFixed(0)}%
    </span>
  );
}

export function HarvestHistoryTable({
  harvestImpacts,
  fieldId,
  onEditHarvest,
  onAddHarvest,
}: HarvestHistoryTableProps) {
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  // Sort descending for display (most recent first)
  const sorted = [...harvestImpacts].sort((a, b) => b.harvest_year - a.harvest_year);
  // For delta calculation, keep ascending order lookup
  const ascending = [...harvestImpacts].sort((a, b) => a.harvest_year - b.harvest_year);

  function getPrevious(year: number): ArableHarvestImpactSummary | undefined {
    const idx = ascending.findIndex((v) => v.harvest_year === year);
    return idx > 0 ? ascending[idx - 1] : undefined;
  }

  // Suggest next year to add
  const currentYear = new Date().getFullYear();
  const mostRecentYear = sorted.length > 0 ? sorted[0].harvest_year : currentYear - 1;
  const suggestedYear = mostRecentYear < currentYear ? mostRecentYear + 1 : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {sorted.length} harvest{sorted.length !== 1 ? 's' : ''} recorded
        </p>
        <PillButton variant="room" size="sm" onClick={onAddHarvest}>
          Add harvest
          {suggestedYear && (
            <span className="text-xs opacity-70">(copied from {mostRecentYear})</span>
          )}
        </PillButton>
      </div>

      <Panel flush className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className={HEAD_CLASS}>Year</TableHead>
              <TableHead className={`${HEAD_CLASS} text-right`}>Yield (t/ha)</TableHead>
              <TableHead className={`${HEAD_CLASS} text-right`}>Emissions (kg CO{'₂'}e/ha)</TableHead>
              <TableHead className={`${HEAD_CLASS} text-right`}>Water (m{'³'}/ha)</TableHead>
              <TableHead className={`${HEAD_CLASS} text-right`}>Removals (kg CO{'₂'}e/ha)</TableHead>
              <TableHead className={`${HEAD_CLASS} text-right`}>Ecotox (CTUe/ha)</TableHead>
              <TableHead className={HEAD_CLASS}>Quality</TableHead>
              <TableHead className={`${HEAD_CLASS} text-right`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No harvests recorded yet. Add your first harvest to get started.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((v) => {
                const prev = getPrevious(v.harvest_year);
                const imp = v.impacts;
                const area = imp.flag_emissions.land_use_m2 / 10000 || 1;
                const ecotoxPerHa = imp.freshwater_ecotoxicity / area;
                const isExpanded = expandedYear === v.harvest_year;

                return (
                  <>
                    <TableRow
                      key={v.profile_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedYear(isExpanded ? null : v.harvest_year)}
                    >
                      <TableCell className="w-[30px] pr-0">
                        <span className="font-mono text-xs text-muted-foreground">
                          {isExpanded ? '−' : '+'}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {v.harvest_year}
                        {v.is_draft && (
                          <StateChip tone="attention" className="ml-2">Draft</StateChip>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {v.yield_tonnes_per_ha.toFixed(1)}
                        {prev && <DeltaIndicator current={v.yield_tonnes_per_ha} previous={prev.yield_tonnes_per_ha} invert />}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(v.emissions_per_ha)}
                        {prev && <DeltaIndicator current={v.emissions_per_ha} previous={prev.emissions_per_ha} />}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(v.water_per_ha)}
                        {prev && <DeltaIndicator current={v.water_per_ha} previous={prev.water_per_ha} />}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-studio-forest">
                        {fmt(v.removals_per_ha)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(ecotoxPerHa)}
                        {prev && (
                          <DeltaIndicator
                            current={ecotoxPerHa}
                            previous={prev.impacts.freshwater_ecotoxicity / (prev.impacts.flag_emissions.land_use_m2 / 10000 || 1)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <StateChip
                          tone={
                            imp.data_quality_grade === 'HIGH'
                              ? 'good'
                              : imp.data_quality_grade === 'MEDIUM'
                              ? 'attention'
                              : 'stale'
                          }
                        >
                          {imp.data_quality_grade}
                        </StateChip>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          className="rounded px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditHarvest(v.harvest_year);
                          }}
                        >
                          Edit
                        </button>
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <TableRow key={`${v.profile_id}-detail`}>
                        <TableCell colSpan={9} className="bg-muted/30 p-0">
                          <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-xs">
                            {/* Column 1: FLAG N2O + Lime */}
                            <div className="space-y-1.5">
                              <p className="font-mono font-bold text-muted-foreground uppercase tracking-[0.18em] text-[10px]">FLAG Emissions</p>
                              <DetailItem label="Direct N₂O (fertiliser)" value={`${fmt(imp.flag_emissions.n2o_direct_co2e)} kg`} />
                              <DetailItem label="Indirect N₂O (vol.+leach.)" value={`${fmt(imp.flag_emissions.n2o_indirect_co2e)} kg`} />
                              <DetailItem label="Crop residue N₂O" value={`${fmt(imp.flag_emissions.n2o_crop_residue_co2e)} kg`} />
                              <DetailItem label="Lime CO₂" value={`${fmt(imp.flag_emissions.lime_co2e)} kg`} />
                              <DetailItem label="N₂O mass" value={`${imp.n2o_kg.toFixed(3)} kg`} muted />
                            </div>

                            {/* Column 2: Non-FLAG */}
                            <div className="space-y-1.5">
                              <p className="font-mono font-bold text-muted-foreground uppercase tracking-[0.18em] text-[10px]">Energy & Industrial</p>
                              <DetailItem label="Fertiliser production" value={`${fmt(imp.non_flag_emissions.fertiliser_production_co2e)} kg`} />
                              <DetailItem label="Machinery fuel" value={`${fmt(imp.non_flag_emissions.machinery_fuel_co2e)} kg`} />
                              <DetailItem label="Grain drying" value={`${fmt(imp.non_flag_emissions.grain_drying_co2e)} kg`} />
                              <DetailItem label="Seed production" value={`${fmt(imp.non_flag_emissions.seed_production_co2e)} kg`} />
                              <DetailItem label="Pesticide production" value={`${fmt(imp.non_flag_emissions.pesticide_production_co2e)} kg`} />
                              <DetailItem label="Growth regulator" value={`${fmt(imp.non_flag_emissions.growth_regulator_co2e)} kg`} />
                              <DetailItem label="Irrigation energy" value={`${fmt(imp.non_flag_emissions.irrigation_energy_co2e)} kg`} />
                              <DetailItem label="Transport" value={`${fmt(imp.non_flag_emissions.transport_co2e)} kg`} />
                            </div>

                            {/* Column 3: Water & ecotox */}
                            <div className="space-y-1.5">
                              <p className="font-mono font-bold text-muted-foreground uppercase tracking-[0.18em] text-[10px]">Water & Ecotoxicity</p>
                              <DetailItem label="Water volume" value={`${fmt(imp.water_m3)} m³`} />
                              <DetailItem label="Scarcity-weighted" value={`${fmt(imp.water_scarcity_m3_eq)} m³ eq`} />
                              <DetailItem label="Freshwater ecotox" value={`${fmt(imp.freshwater_ecotoxicity)} CTUe`} />
                              <DetailItem label="Terrestrial ecotox" value={`${fmt(imp.terrestrial_ecotoxicity)} CTUe`} />
                              <DetailItem label="Human toxicity" value={`${fmtSci(imp.human_toxicity_non_carcinogenic)} CTUh`} />
                              <DetailItem label="Eutrophication" value={`${fmtSci(imp.freshwater_eutrophication)} kg P eq`} />
                            </div>

                            {/* Column 4: Normalised */}
                            <div className="space-y-1.5">
                              <p className="font-mono font-bold text-muted-foreground uppercase tracking-[0.18em] text-[10px]">Per kg Grain</p>
                              <DetailItem label="Emissions" value={`${imp.total_emissions_per_kg.toFixed(3)} kg CO₂e`} />
                              <DetailItem label="Removals" value={`${imp.removals_per_kg.toFixed(3)} kg CO₂e`} />
                              <DetailItem label="Soil carbon method" value={imp.flag_removals.methodology === 'measured' ? 'Verified' : 'Practice default'} />
                              <DetailItem label="Soil management" value={imp.flag_removals.is_verified ? 'Verified' : 'Unverified'} muted />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </Panel>

      <p className="text-xs text-muted-foreground">
        Click a row to expand full impact detail. Green/red arrows show year-on-year change
        (green = improvement). For emissions, down is good. For yield, up is good.
      </p>
    </div>
  );
}

function DetailItem({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className={muted ? 'text-muted-foreground/60' : 'text-muted-foreground'}>{label}</span>
      <span className={muted ? 'text-muted-foreground/60 font-mono' : 'font-mono text-foreground'}>{value}</span>
    </div>
  );
}
