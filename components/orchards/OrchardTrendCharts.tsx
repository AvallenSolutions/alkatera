'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Droplets, TreePine, Flame, Bug, Wheat, FlaskConical, Fuel } from 'lucide-react';
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
import type { HarvestImpactSummary } from '@/lib/types/orchard';

// Colour palette
const COLOURS = {
  primary: '#ccff00',
  green: '#22c55e',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  teal: '#14b8a6',
} as const;

interface OrchardTrendChartsProps {
  harvestImpacts: HarvestImpactSummary[];
}

// Custom tooltip for dark theme
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
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-semibold mb-2">Harvest {label}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2 text-sm">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-medium">
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

export function OrchardTrendCharts({ harvestImpacts }: OrchardTrendChartsProps) {
  if (harvestImpacts.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">
          Add more harvests to see trends
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          At least two harvests are needed to display trend charts.
        </p>
      </div>
    );
  }

  // Build chart data arrays
  const emissionsData = harvestImpacts.map((v) => ({
    harvest_year: v.harvest_year,
    emissions_per_ha: v.emissions_per_ha,
  }));

  const sourceData = harvestImpacts.map((v) => {
    const imp = v.impacts;
    const area = imp.flag_emissions.land_use_m2 / 10000 || 1;
    return {
      harvest_year: v.harvest_year,
      'Fertiliser & N\u2082O': (imp.flag_emissions.total_flag_co2e + imp.non_flag_emissions.fertiliser_production_co2e) / area,
      Fuel: imp.non_flag_emissions.machinery_fuel_co2e / area,
      Irrigation: imp.non_flag_emissions.irrigation_energy_co2e / area,
      Pesticides: imp.non_flag_emissions.pesticide_production_co2e / area,
      Transport: imp.non_flag_emissions.transport_co2e / area,
    };
  });

  const n2oBreakdownData = harvestImpacts.map((v) => {
    const imp = v.impacts;
    const area = imp.flag_emissions.land_use_m2 / 10000 || 1;
    return {
      harvest_year: v.harvest_year,
      'Direct (fertiliser)': imp.flag_emissions.n2o_direct_co2e / area,
      'Indirect (vol. + leach.)': imp.flag_emissions.n2o_indirect_co2e / area,
      'Crop residue (prunings)': imp.flag_emissions.n2o_crop_residue_co2e / area,
    };
  });

  const waterData = harvestImpacts.map((v) => ({
    harvest_year: v.harvest_year,
    water_per_ha: v.water_per_ha,
    scarcity_weighted: v.impacts.water_scarcity_m3_eq / (v.impacts.flag_emissions.land_use_m2 / 10000 || 1),
  }));

  const removalsData = harvestImpacts.map((v) => ({
    harvest_year: v.harvest_year,
    removals_per_ha: v.removals_per_ha,
  }));

  const ecotoxData = harvestImpacts.map((v) => {
    const area = v.impacts.flag_emissions.land_use_m2 / 10000 || 1;
    return {
      harvest_year: v.harvest_year,
      'Freshwater ecotox': v.impacts.freshwater_ecotoxicity / area,
      'Terrestrial ecotox': v.impacts.terrestrial_ecotoxicity / area,
    };
  });

  const eutrophData = harvestImpacts.map((v) => {
    const area = v.impacts.flag_emissions.land_use_m2 / 10000 || 1;
    return {
      harvest_year: v.harvest_year,
      'Freshwater eutroph.': v.impacts.freshwater_eutrophication / area,
    };
  });

  const yieldData = harvestImpacts.map((v) => ({
    harvest_year: v.harvest_year,
    yield_per_ha: v.yield_tonnes_per_ha,
    emissions_per_tonne: v.emissions_per_ha / (v.yield_tonnes_per_ha || 1),
  }));

  const fuelData = harvestImpacts.map((v) => {
    const area = v.impacts.flag_emissions.land_use_m2 / 10000 || 1;
    return {
      harvest_year: v.harvest_year,
      'Fuel CO\u2082e/ha': v.impacts.non_flag_emissions.machinery_fuel_co2e / area,
    };
  });

  const axisProps = {
    tick: { fontSize: 12 },
    tickLine: false,
    axisLine: false,
  } as const;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* 1. Emissions per hectare */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Flame className="h-4 w-4 text-muted-foreground" />
            Total Emissions per Hectare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={emissionsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="harvest_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="kg CO\u2082e/ha" />} />
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
        </CardContent>
      </Card>

      {/* 2. Emissions by source (stacked area) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Emissions by Source (per ha)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={sourceData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="harvest_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="kg CO\u2082e/ha" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Area type="monotone" dataKey="Fertiliser & N\u2082O" stackId="1" stroke={COLOURS.amber} fill={COLOURS.amber} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Fuel" stackId="1" stroke={COLOURS.red} fill={COLOURS.red} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Irrigation" stackId="1" stroke={COLOURS.blue} fill={COLOURS.blue} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Pesticides" stackId="1" stroke={COLOURS.purple} fill={COLOURS.purple} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Transport" stackId="1" stroke={COLOURS.teal} fill={COLOURS.teal} fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. N2O breakdown (FLAG emissions detail) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            N{'\u2082'}O Emissions Breakdown (per ha)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={n2oBreakdownData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="harvest_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="kg CO\u2082e/ha" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="Direct (fertiliser)" stackId="1" fill={COLOURS.amber} radius={[0, 0, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Indirect (vol. + leach.)" stackId="1" fill={COLOURS.red} radius={[0, 0, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Crop residue (prunings)" stackId="1" fill={COLOURS.teal} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 4. Water consumption + scarcity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            Water Consumption (per ha)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={waterData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="gradWaterOrchard" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLOURS.blue} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLOURS.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="harvest_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="m\u00B3/ha" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Area type="monotone" dataKey="water_per_ha" name="Volume" stroke={COLOURS.blue} fill="url(#gradWaterOrchard)" strokeWidth={2} dot={{ r: 3, fill: COLOURS.blue }} />
              <Line type="monotone" dataKey="scarcity_weighted" name="Scarcity-weighted (AWARE)" stroke={COLOURS.blue} strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 5. Soil carbon removals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TreePine className="h-4 w-4 text-muted-foreground" />
            Soil Carbon Removals (per ha)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={removalsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="harvest_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="kg CO\u2082e/ha" />} />
              <Bar dataKey="removals_per_ha" name="Removals" fill={COLOURS.green} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 6. Ecotoxicity trends */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bug className="h-4 w-4 text-muted-foreground" />
            Ecotoxicity (per ha)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ecotoxData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="harvest_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={70}
                tickFormatter={(v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              />
              <Tooltip content={<ChartTooltip unit="CTUe/ha" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line type="monotone" dataKey="Freshwater ecotox" stroke={COLOURS.blue} strokeWidth={2} dot={{ r: 3, fill: COLOURS.blue }} />
              <Line type="monotone" dataKey="Terrestrial ecotox" stroke={COLOURS.teal} strokeWidth={2} dot={{ r: 3, fill: COLOURS.teal }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 7. Freshwater eutrophication */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Droplets className="h-4 w-4 text-purple-500" />
            Freshwater Eutrophication (per ha)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={eutrophData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="harvest_year" {...axisProps} />
              <YAxis
                {...axisProps}
                width={70}
                tickFormatter={(v: number) => v < 0.001 ? v.toExponential(1) : v.toFixed(3)}
              />
              <Tooltip content={<ChartTooltip unit="kg P eq/ha" />} />
              <Bar dataKey="Freshwater eutroph." name="Eutrophication" fill={COLOURS.purple} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 8. Yield and emission intensity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wheat className="h-4 w-4 text-muted-foreground" />
            Yield and Emission Intensity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={yieldData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="harvest_year" {...axisProps} />
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
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line yAxisId="left" type="monotone" dataKey="yield_per_ha" name="Yield (t/ha)" stroke={COLOURS.amber} strokeWidth={2} dot={{ r: 4, fill: COLOURS.amber }} />
              <Line yAxisId="right" type="monotone" dataKey="emissions_per_tonne" name="kg CO\u2082e/t fruit" stroke={COLOURS.red} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: COLOURS.red }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
