'use client';

/**
 * Vineyard trends, re-cut for the studio: cream hairline panels with
 * dim mono labels, studio inks for the series, a cream tooltip, no
 * icon titles and no gradients. The data series are unchanged.
 */

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { VintageImpactSummary } from '@/lib/types/viticulture';
import { Panel } from '@/components/studio/panel';
import { Eyebrow } from '@/components/studio/eyebrow';
import { STUDIO } from '@/components/studio/theme';

// Studio inks for the series
const COLOURS = {
  primary: STUDIO.cobalt,
  green: STUDIO.forest,
  blue: STUDIO.teal,
  amber: STUDIO.ochre,
  red: STUDIO.brick,
  purple: STUDIO.plum,
  teal: STUDIO.dim,
} as const;

interface VineyardTrendChartsProps {
  vintageImpacts: VintageImpactSummary[];
}

// Cream studio tooltip
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; name: string; value: number; color: string }>;
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-[6px] border border-studio-hairline bg-studio-cream p-3 text-studio-ink">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
        Vintage {label}
      </p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-studio-dim">{item.name}:</span>
          <span className="font-medium tabular-nums">
            {typeof item.value === 'number' && item.value < 0.01 && item.value > 0
              ? item.value.toExponential(2)
              : item.value.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

export function VineyardTrendCharts({ vintageImpacts }: VineyardTrendChartsProps) {
  if (vintageImpacts.length < 2) {
    return (
      <div className="pt-2">
        <p className="text-sm text-muted-foreground">
          At least two vintages are needed to draw trends. Add another vintage to see the picture.
        </p>
      </div>
    );
  }

  // Build chart data arrays
  const emissionsData = vintageImpacts.map((v) => ({
    vintage_year: v.vintage_year,
    emissions_per_ha: v.emissions_per_ha,
  }));

  const sourceData = vintageImpacts.map((v) => {
    const imp = v.impacts;
    const area = imp.flag_emissions.land_use_m2 / 10000 || 1;
    return {
      vintage_year: v.vintage_year,
      'Fertiliser & N₂O': (imp.flag_emissions.total_flag_co2e + imp.non_flag_emissions.fertiliser_production_co2e) / area,
      Fuel: imp.non_flag_emissions.machinery_fuel_co2e / area,
      Irrigation: imp.non_flag_emissions.irrigation_energy_co2e / area,
      Pesticides: imp.non_flag_emissions.pesticide_production_co2e / area,
    };
  });

  const n2oBreakdownData = vintageImpacts.map((v) => {
    const imp = v.impacts;
    const area = imp.flag_emissions.land_use_m2 / 10000 || 1;
    return {
      vintage_year: v.vintage_year,
      'Direct (fertiliser)': imp.flag_emissions.n2o_direct_co2e / area,
      'Indirect (vol. + leach.)': imp.flag_emissions.n2o_indirect_co2e / area,
      'Crop residue (prunings)': imp.flag_emissions.n2o_crop_residue_co2e / area,
    };
  });

  const waterData = vintageImpacts.map((v) => ({
    vintage_year: v.vintage_year,
    water_per_ha: v.water_per_ha,
    scarcity_weighted: v.impacts.water_scarcity_m3_eq / (v.impacts.flag_emissions.land_use_m2 / 10000 || 1),
  }));

  const removalsData = vintageImpacts.map((v) => ({
    vintage_year: v.vintage_year,
    removals_per_ha: v.removals_per_ha,
  }));

  const ecotoxData = vintageImpacts.map((v) => {
    const area = v.impacts.flag_emissions.land_use_m2 / 10000 || 1;
    return {
      vintage_year: v.vintage_year,
      'Freshwater ecotox': v.impacts.freshwater_ecotoxicity / area,
      'Terrestrial ecotox': v.impacts.terrestrial_ecotoxicity / area,
    };
  });

  const eutrophData = vintageImpacts.map((v) => {
    const area = v.impacts.flag_emissions.land_use_m2 / 10000 || 1;
    return {
      vintage_year: v.vintage_year,
      'Freshwater eutroph.': v.impacts.freshwater_eutrophication / area,
    };
  });

  const yieldData = vintageImpacts.map((v) => ({
    vintage_year: v.vintage_year,
    yield_per_ha: v.yield_tonnes_per_ha,
    emissions_per_tonne: v.emissions_per_ha / (v.yield_tonnes_per_ha || 1),
  }));

  const axisProps = {
    tick: { fontSize: 10, fill: STUDIO.dim },
    tickLine: false,
    axisLine: false,
  } as const;

  const legendStyle = { fontSize: '11px', color: STUDIO.dim, paddingTop: '8px' } as const;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 1. Emissions per hectare */}
      <Panel>
        <Eyebrow tone="dim">EMISSIONS PER HECTARE</Eyebrow>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={emissionsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO.hairline} />
              <XAxis dataKey="vintage_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="kg CO₂e/ha" />} />
              <Line
                type="monotone"
                dataKey="emissions_per_ha"
                name="Emissions"
                stroke={COLOURS.primary}
                strokeWidth={2}
                dot={{ r: 4, fill: COLOURS.primary }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* 2. Emissions by source (stacked area) */}
      <Panel>
        <Eyebrow tone="dim">EMISSIONS BY SOURCE · PER HA</Eyebrow>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={sourceData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO.hairline} />
              <XAxis dataKey="vintage_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="kg CO₂e/ha" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
              <Area type="monotone" dataKey="Fertiliser & N₂O" stackId="1" stroke={COLOURS.amber} fill={COLOURS.amber} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Fuel" stackId="1" stroke={COLOURS.red} fill={COLOURS.red} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Irrigation" stackId="1" stroke={COLOURS.blue} fill={COLOURS.blue} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Pesticides" stackId="1" stroke={COLOURS.purple} fill={COLOURS.purple} fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* 3. N2O breakdown (FLAG emissions detail) */}
      <Panel>
        <Eyebrow tone="dim">N₂O BREAKDOWN · PER HA</Eyebrow>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={n2oBreakdownData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO.hairline} />
              <XAxis dataKey="vintage_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="kg CO₂e/ha" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
              <Bar dataKey="Direct (fertiliser)" stackId="1" fill={COLOURS.amber} radius={[0, 0, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Indirect (vol. + leach.)" stackId="1" fill={COLOURS.red} radius={[0, 0, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Crop residue (prunings)" stackId="1" fill={COLOURS.teal} radius={[2, 2, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* 4. Water consumption + scarcity */}
      <Panel>
        <Eyebrow tone="dim">WATER CONSUMPTION · PER HA</Eyebrow>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={waterData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO.hairline} />
              <XAxis dataKey="vintage_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="m³/ha" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
              <Area type="monotone" dataKey="water_per_ha" name="Volume" stroke={COLOURS.blue} fill={COLOURS.blue} fillOpacity={0.15} strokeWidth={2} dot={{ r: 3, fill: COLOURS.blue }} />
              <Line type="monotone" dataKey="scarcity_weighted" name="Scarcity-weighted (AWARE)" stroke={COLOURS.blue} strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* 5. Soil carbon removals */}
      <Panel>
        <Eyebrow tone="dim">SOIL CARBON REMOVALS · PER HA</Eyebrow>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={removalsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO.hairline} />
              <XAxis dataKey="vintage_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="kg CO₂e/ha" />} />
              <Bar dataKey="removals_per_ha" name="Removals" fill={COLOURS.green} radius={[2, 2, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* 6. Ecotoxicity trends */}
      <Panel>
        <Eyebrow tone="dim">ECOTOXICITY · PER HA</Eyebrow>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ecotoxData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO.hairline} />
              <XAxis dataKey="vintage_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={70}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="CTUe/ha" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
              <Line type="monotone" dataKey="Freshwater ecotox" stroke={COLOURS.blue} strokeWidth={2} dot={{ r: 3, fill: COLOURS.blue }} />
              <Line type="monotone" dataKey="Terrestrial ecotox" stroke={COLOURS.teal} strokeWidth={2} dot={{ r: 3, fill: COLOURS.teal }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* 7. Freshwater eutrophication */}
      <Panel>
        <Eyebrow tone="dim">FRESHWATER EUTROPHICATION · PER HA</Eyebrow>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={eutrophData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO.hairline} />
              <XAxis dataKey="vintage_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={70}
                tickFormatter={(v: number) => v < 0.001 ? v.toExponential(1) : v.toFixed(3)}
              />
              <Tooltip content={<ChartTooltip unit="kg P eq/ha" />} />
              <Bar dataKey="Freshwater eutroph." name="Eutrophication" fill={COLOURS.purple} radius={[2, 2, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* 8. Yield and emission intensity */}
      <Panel>
        <Eyebrow tone="dim">YIELD & EMISSION INTENSITY</Eyebrow>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={yieldData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO.hairline} />
              <XAxis dataKey="vintage_year" {...axisProps} />
              <YAxis
                yAxisId="left"
                {...axisProps}
                width={50}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                {...axisProps}
                width={50}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
              <Line yAxisId="left" type="monotone" dataKey="yield_per_ha" name="Yield (t/ha)" stroke={COLOURS.amber} strokeWidth={2} dot={{ r: 4, fill: COLOURS.amber }} />
              <Line yAxisId="right" type="monotone" dataKey="emissions_per_tonne" name="kg CO₂e/t grapes" stroke={COLOURS.red} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: COLOURS.red }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
