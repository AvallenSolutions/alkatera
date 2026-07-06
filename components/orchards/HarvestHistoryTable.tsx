'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Edit2, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react';
import type { HarvestImpactSummary } from '@/lib/types/orchard';
import { StateChip } from '@/components/studio/state-chip';

interface HarvestHistoryTableProps {
  harvestImpacts: HarvestImpactSummary[];
  orchardId: string;
  onEditHarvest: (year: number) => void;
  onAddHarvest: () => void;
}

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
      className={`inline-flex items-center gap-0.5 text-xs ml-1 ${
        isGood ? 'text-studio-good' : 'text-studio-stale'
      }`}
    >
      {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pctChange).toFixed(0)}%
    </span>
  );
}

export function HarvestHistoryTable({
  harvestImpacts,
  orchardId,
  onEditHarvest,
  onAddHarvest,
}: HarvestHistoryTableProps) {
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  // Sort descending for display (most recent first)
  const sorted = [...harvestImpacts].sort((a, b) => b.harvest_year - a.harvest_year);
  // For delta calculation, keep ascending order lookup
  const ascending = [...harvestImpacts].sort((a, b) => a.harvest_year - b.harvest_year);

  function getPrevious(year: number): HarvestImpactSummary | undefined {
    const idx = ascending.findIndex((v) => v.harvest_year === year);
    return idx > 0 ? ascending[idx - 1] : undefined;
  }

  // Suggest next year to add
  const currentYear = new Date().getFullYear();
  const mostRecentYear = sorted.length > 0 ? sorted[0].harvest_year : currentYear - 1;
  const suggestedYear = mostRecentYear < currentYear ? mostRecentYear + 1 : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {sorted.length} harvest{sorted.length !== 1 ? 's' : ''} recorded
        </h3>
        <Button onClick={onAddHarvest} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add New Harvest
          {suggestedYear && (
            <span className="text-xs opacity-70 ml-1">
              (copied from {mostRecentYear})
            </span>
          )}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Year</TableHead>
              <TableHead className="text-right">Yield (t/ha)</TableHead>
              <TableHead className="text-right">Emissions (kg CO{'₂'}e/ha)</TableHead>
              <TableHead className="text-right">Water (m{'³'}/ha)</TableHead>
              <TableHead className="text-right">Removals (kg CO{'₂'}e/ha)</TableHead>
              <TableHead className="text-right">Ecotox (CTUe/ha)</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell className="font-medium">
                        {v.harvest_year}
                        {v.is_draft && (
                          <StateChip tone="attention" className="ml-2">Draft</StateChip>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.yield_tonnes_per_ha.toFixed(1)}
                        {prev && <DeltaIndicator current={v.yield_tonnes_per_ha} previous={prev.yield_tonnes_per_ha} invert />}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmt(v.emissions_per_ha)}
                        {prev && <DeltaIndicator current={v.emissions_per_ha} previous={prev.emissions_per_ha} />}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmt(v.water_per_ha)}
                        {prev && <DeltaIndicator current={v.water_per_ha} previous={prev.water_per_ha} />}
                      </TableCell>
                      <TableCell className="text-right text-studio-forest">
                        {fmt(v.removals_per_ha)}
                      </TableCell>
                      <TableCell className="text-right">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditHarvest(v.harvest_year);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <TableRow key={`${v.profile_id}-detail`}>
                        <TableCell colSpan={9} className="bg-muted/30 p-0">
                          <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-xs">
                            {/* Column 1: FLAG N2O */}
                            <div className="space-y-1.5">
                              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">FLAG N{'₂'}O Emissions</p>
                              <DetailItem label="Direct (fertiliser)" value={`${fmt(imp.flag_emissions.n2o_direct_co2e)} kg`} />
                              <DetailItem label="Indirect (vol.+leach.)" value={`${fmt(imp.flag_emissions.n2o_indirect_co2e)} kg`} />
                              <DetailItem label="Crop residue" value={`${fmt(imp.flag_emissions.n2o_crop_residue_co2e)} kg`} />
                              <DetailItem label="N₂O mass" value={`${imp.n2o_kg.toFixed(3)} kg`} muted />
                            </div>

                            {/* Column 2: Non-FLAG */}
                            <div className="space-y-1.5">
                              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Energy & Industrial</p>
                              <DetailItem label="Fertiliser production" value={`${fmt(imp.non_flag_emissions.fertiliser_production_co2e)} kg`} />
                              <DetailItem label="Machinery fuel" value={`${fmt(imp.non_flag_emissions.machinery_fuel_co2e)} kg`} />
                              <DetailItem label="Irrigation energy" value={`${fmt(imp.non_flag_emissions.irrigation_energy_co2e)} kg`} />
                              <DetailItem label="Pesticide production" value={`${fmt(imp.non_flag_emissions.pesticide_production_co2e)} kg`} />
                              <DetailItem label="Transport" value={`${fmt(imp.non_flag_emissions.transport_co2e)} kg`} />
                            </div>

                            {/* Column 3: Water & ecotox */}
                            <div className="space-y-1.5">
                              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Water & Ecotoxicity</p>
                              <DetailItem label="Water volume" value={`${fmt(imp.water_m3)} m³`} />
                              <DetailItem label="Scarcity-weighted" value={`${fmt(imp.water_scarcity_m3_eq)} m³ eq`} />
                              <DetailItem label="Freshwater ecotox" value={`${fmt(imp.freshwater_ecotoxicity)} CTUe`} />
                              <DetailItem label="Terrestrial ecotox" value={`${fmt(imp.terrestrial_ecotoxicity)} CTUe`} />
                              <DetailItem label="Human toxicity" value={`${fmtSci(imp.human_toxicity_non_carcinogenic)} CTUh`} />
                              <DetailItem label="Eutrophication" value={`${fmtSci(imp.freshwater_eutrophication)} kg P eq`} />
                            </div>

                            {/* Column 4: Normalised */}
                            <div className="space-y-1.5">
                              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Per kg Fruit</p>
                              <DetailItem label="Emissions" value={`${imp.total_emissions_per_kg.toFixed(3)} kg CO₂e`} />
                              <DetailItem label="Removals" value={`${imp.removals_per_kg.toFixed(3)} kg CO₂e`} />
                              <DetailItem label="Soil carbon method" value={imp.flag_removals.methodology === 'measured' ? 'Verified' : 'Practice default'} />
                              <DetailItem label="Soil management" value={imp.flag_removals.is_verified ? '✅ Verified' : 'Unverified'} muted />
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
      </div>

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
