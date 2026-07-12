'use client';

/**
 * Visual 12-month dashboard of all facility data (utilities, water, waste).
 * Shows a coverage grid (one row per data series, one column per month) so
 * gaps in uploaded bill data are immediately visible, plus a trend chart
 * for any selected series.
 *
 * Bills spanning multiple months (e.g. quarterly water bills) are allocated
 * across the covered months proportionally by days, so a quarterly bill
 * fills 3 months rather than showing false gaps.
 */

import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { UTILITY_TYPES, WATER_CATEGORIES, WASTE_CATEGORIES } from '@/lib/constants/utility-types';

interface UtilityEntryLike {
  utility_type: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  data_quality: string;
  activity_date?: string | null;
}

interface ActivityEntryLike {
  activity_category: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  data_provenance: string;
  activity_date?: string | null;
}

interface DataContractLike {
  utility_type: string;
}

interface FacilityDataDashboardProps {
  utilityData: UtilityEntryLike[];
  waterData: ActivityEntryLike[];
  wasteData: ActivityEntryLike[];
  dataContracts: DataContractLike[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthBucket {
  key: string;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
  isCurrent: boolean;
}

interface NormalisedEntry {
  quantity: number;
  unit: string;
  start: Date;
  end: Date;
  estimated: boolean;
}

interface MonthCell {
  value: number | null;
  covered: boolean;
  estimated: boolean;
  tracked: boolean;
}

interface SeriesData {
  key: string;
  label: string;
  group: 'Energy & Fuel' | 'Water' | 'Waste';
  unit: string;
  cells: MonthCell[];
  coveredCount: number;
  trackedCount: number;
  hasMixedUnits: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date-only strings parse as UTC midnight; split into parts so month buckets align with local dates. */
function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

function buildMonths(): MonthBucket[] {
  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    // Midnight on the last day, so inclusive day counts stay exact
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    months.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`,
      shortLabel: MONTH_NAMES[start.getMonth()],
      start,
      end,
      isCurrent: i === 0,
    });
  }
  return months;
}

/** Convert a quantity into the series' dominant unit; null if incompatible. */
function convertUnit(quantity: number, from: string, to: string): number | null {
  const f = (from || '').toLowerCase().replace('³', '3');
  const t = (to || '').toLowerCase().replace('³', '3');
  if (f === t) return quantity;
  const litres = ['litre', 'litres', 'l'];
  const tonnes = ['tonne', 'tonnes', 't'];
  if (litres.includes(f) && t === 'm3') return quantity / 1000;
  if (f === 'm3' && litres.includes(t)) return quantity * 1000;
  if (f === 'kg' && tonnes.includes(t)) return quantity / 1000;
  if (tonnes.includes(f) && t === 'kg') return quantity * 1000;
  return null;
}

function buildSeries(
  key: string,
  label: string,
  group: SeriesData['group'],
  entries: NormalisedEntry[],
  months: MonthBucket[],
  contracted: boolean
): SeriesData | null {
  if (entries.length === 0 && !contracted) return null;

  const unitCounts = new Map<string, number>();
  for (const e of entries) {
    unitCounts.set(e.unit, (unitCounts.get(e.unit) || 0) + 1);
  }
  const unit = Array.from(unitCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  // Tracking starts at the earliest entry; contracted series are tracked for the whole window
  const firstEntryTime = entries.length > 0 ? Math.min(...entries.map(e => e.start.getTime())) : null;
  let hasMixedUnits = false;

  const cells: MonthCell[] = months.map((m) => {
    const tracked = contracted || (firstEntryTime !== null && firstEntryTime <= m.end.getTime());
    let value: number | null = null;
    let covered = false;
    let estimated = false;

    for (const e of entries) {
      const overlapStart = Math.max(e.start.getTime(), m.start.getTime());
      const overlapEnd = Math.min(e.end.getTime(), m.end.getTime());
      if (overlapEnd < overlapStart) continue;

      covered = true;
      if (e.estimated) estimated = true;

      const totalDays = Math.max(1, Math.round((e.end.getTime() - e.start.getTime()) / DAY_MS) + 1);
      const overlapDays = Math.max(1, Math.round((overlapEnd - overlapStart) / DAY_MS) + 1);
      const convertedQuantity = convertUnit(e.quantity, e.unit, unit);
      if (convertedQuantity === null) {
        hasMixedUnits = true;
        continue;
      }
      value = (value || 0) + convertedQuantity * (overlapDays / totalDays);
    }

    return { value, covered, estimated, tracked };
  });

  const coveredCount = cells.filter(c => c.covered).length;
  // The current month is excluded from the tracked count when empty (bill may not have arrived yet)
  const trackedCount = cells.filter((c, i) => c.tracked && !(months[i].isCurrent && !c.covered)).length;

  return { key, label, group, unit, cells, coveredCount, trackedCount, hasMixedUnits };
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 100_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (value >= 100) return `${Math.round(value)}`;
  if (value >= 1) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/\.?0+$/, '') || '0';
}

export function FacilityDataDashboard({
  utilityData,
  waterData,
  wasteData,
  dataContracts,
}: FacilityDataDashboardProps) {
  const months = useMemo(buildMonths, []);

  const allSeries = useMemo(() => {
    const series: SeriesData[] = [];

    const normaliseUtility = (e: UtilityEntryLike): NormalisedEntry => ({
      quantity: e.quantity,
      unit: e.unit,
      start: parseDate(e.activity_date || e.reporting_period_start),
      end: parseDate(e.activity_date || e.reporting_period_end || e.reporting_period_start),
      estimated: e.data_quality !== 'actual',
    });
    const normaliseActivity = (e: ActivityEntryLike): NormalisedEntry => ({
      quantity: e.quantity,
      unit: e.unit,
      start: parseDate(e.activity_date || e.reporting_period_start),
      end: parseDate(e.activity_date || e.reporting_period_end || e.reporting_period_start),
      estimated: !e.data_provenance?.includes('primary'),
    });

    const contractedTypes = new Set(dataContracts.map(c => c.utility_type));

    for (const ut of UTILITY_TYPES) {
      const entries = utilityData.filter(e => e.utility_type === ut.value).map(normaliseUtility);
      const s = buildSeries(ut.value, ut.label, 'Energy & Fuel', entries, months, contractedTypes.has(ut.value));
      if (s) series.push(s);
    }
    for (const wc of WATER_CATEGORIES) {
      const entries = waterData.filter(e => e.activity_category === wc.value).map(normaliseActivity);
      const s = buildSeries(wc.value, wc.label, 'Water', entries, months, false);
      if (s) series.push(s);
    }
    for (const wc of WASTE_CATEGORIES) {
      const entries = wasteData.filter(e => e.activity_category === wc.value).map(normaliseActivity);
      const s = buildSeries(wc.value, wc.label, 'Waste', entries, months, false);
      if (s) series.push(s);
    }

    return series;
  }, [utilityData, waterData, wasteData, dataContracts, months]);

  const defaultSeriesKey =
    allSeries.find(s => s.key === 'electricity_grid' && s.coveredCount > 0)?.key ||
    allSeries.find(s => s.coveredCount > 0)?.key ||
    allSeries[0]?.key ||
    '';
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = allSeries.find(s => s.key === (selectedKey ?? defaultSeriesKey)) || null;

  const chartData = useMemo(() => {
    if (!selected) return [];
    return months.map((m, i) => ({
      shortLabel: m.shortLabel,
      label: m.label,
      value: selected.cells[i].covered && selected.cells[i].value !== null
        ? Math.round((selected.cells[i].value as number) * 100) / 100
        : null,
      estimated: selected.cells[i].estimated,
    }));
  }, [selected, months]);

  const stats = useMemo(() => {
    if (!selected) return null;
    const coveredValues = selected.cells
      .filter(c => c.covered && c.value !== null)
      .map(c => c.value as number);
    const total = coveredValues.reduce((sum, v) => sum + v, 0);
    const average = coveredValues.length > 0 ? total / coveredValues.length : 0;

    const recent = coveredValues.slice(-3);
    const previous = coveredValues.slice(-6, -3);
    let trend: { direction: 'up' | 'down' | 'stable'; percentage: number } = { direction: 'stable', percentage: 0 };
    if (recent.length > 0 && previous.length > 0) {
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const previousAvg = previous.reduce((s, v) => s + v, 0) / previous.length;
      if (previousAvg > 0) {
        const change = ((recentAvg - previousAvg) / previousAvg) * 100;
        trend = {
          direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
          percentage: Math.abs(change),
        };
      }
    }

    const gapMonths = months.filter((m, i) => {
      const c = selected.cells[i];
      return c.tracked && !c.covered && !m.isCurrent;
    });

    return { total, average, trend, gapMonths, coveredCount: selected.coveredCount, trackedCount: selected.trackedCount };
  }, [selected, months]);

  if (allSeries.length === 0) {
    return (
      <section>
        <Eyebrow className="mb-1">Data coverage</Eyebrow>
        <p className="py-4 text-sm text-studio-dim">
          No data recorded yet. Upload a bill or add entries in the data entry tab to see coverage here.
        </p>
      </section>
    );
  }

  const groups: SeriesData['group'][] = ['Energy & Fuel', 'Water', 'Waste'];
  const trendTone =
    stats?.trend.direction === 'down' ? 'good' : stats?.trend.direction === 'up' ? 'attention' : 'ink';

  return (
    <div className="space-y-10">
      {/* Coverage grid */}
      <section>
        <Eyebrow className="mb-1">Data coverage</Eyebrow>
        <p className="mb-4 max-w-3xl text-xs text-muted-foreground">
          Last 12 months of recorded data. Amber cells are months with no data, so you can see exactly where the gaps are.
        </p>
        <div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="text-left font-medium text-muted-foreground py-2 pr-3 min-w-[160px]">Data series</th>
                  {months.map(m => (
                    <th key={m.key} className="font-medium text-muted-foreground px-0.5 py-2 text-center min-w-[52px]">
                      {m.shortLabel}
                      <div className="text-[10px] font-normal opacity-60">{String(m.start.getFullYear()).slice(2)}</div>
                    </th>
                  ))}
                  <th className="font-medium text-muted-foreground pl-3 py-2 text-right min-w-[70px]">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => {
                  const groupSeries = allSeries.filter(s => s.group === group);
                  if (groupSeries.length === 0) return null;
                  return [
                    <tr key={`${group}-header`}>
                      <td colSpan={months.length + 2} className="pt-4 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                        {group}
                      </td>
                    </tr>,
                    ...groupSeries.map(s => {
                      const coveragePct = s.trackedCount > 0 ? Math.round((s.coveredCount / s.trackedCount) * 100) : 0;
                      return (
                        <tr key={s.key} className="border-t border-border/40">
                          <td className="py-1.5 pr-3">
                            <button
                              type="button"
                              onClick={() => setSelectedKey(s.key)}
                              className={`text-left transition-colors hover:text-room-accent ${selected?.key === s.key ? 'font-medium text-room-accent' : ''}`}
                              title="Show in trend chart"
                            >
                              {s.label}
                              <span className="text-muted-foreground ml-1">({s.unit || 'no unit'})</span>
                            </button>
                          </td>
                          {s.cells.map((c, i) => {
                            const m = months[i];
                            let cellClass = '';
                            let cellContent: React.ReactNode = '';
                            let title = m.label;

                            if (c.covered && c.value !== null) {
                              cellClass = c.estimated
                                ? 'bg-studio-attention/10 text-studio-attention border border-studio-attention/30'
                                : 'bg-studio-good/10 text-studio-good border border-studio-good/25';
                              cellContent = formatValue(c.value);
                              title = `${m.label}: ${c.value.toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${s.unit}${c.estimated ? ' (estimated)' : ''}`;
                            } else if (c.covered) {
                              // Covered but value excluded due to incompatible units
                              cellClass = 'bg-studio-good/10 text-studio-good border border-studio-good/25';
                              cellContent = '✓';
                              title = `${m.label}: data recorded (mixed units)`;
                            } else if (m.isCurrent && c.tracked) {
                              cellClass = 'border border-dashed border-border text-muted-foreground';
                              cellContent = '…';
                              title = `${m.label}: current month, bill may not have arrived yet`;
                            } else if (c.tracked) {
                              cellClass = 'bg-studio-attention/5 border border-dashed border-studio-attention/50 text-studio-attention';
                              cellContent = '–';
                              title = `${m.label}: no data recorded (gap)`;
                            } else {
                              cellClass = 'text-muted-foreground/40';
                              cellContent = '·';
                              title = `${m.label}: before tracking started`;
                            }

                            return (
                              <td key={m.key} className="px-0.5 py-1">
                                <div
                                  className={`rounded-[6px] h-7 flex items-center justify-center font-medium tabular-nums text-[11px] ${cellClass}`}
                                  title={title}
                                >
                                  {cellContent}
                                </div>
                              </td>
                            );
                          })}
                          <td className="pl-3 py-1.5 text-right">
                            <span
                              className={`font-mono text-[10px] font-bold tabular-nums tracking-[0.08em] ${
                                coveragePct >= 75 ? 'text-studio-good' : 'text-studio-attention'
                              }`}
                            >
                              {s.coveredCount}/{s.trackedCount || 12}
                            </span>
                          </td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-[3px] bg-studio-good/10 border border-studio-good/25" />
              <span>Data recorded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-[3px] bg-studio-attention/10 border border-studio-attention/30" />
              <span>Estimated data</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-[3px] bg-studio-attention/5 border border-dashed border-studio-attention/50" />
              <span>Gap (no data)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-[3px] border border-dashed border-border" />
              <span>Current month (pending)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 text-center text-muted-foreground/40">·</span>
              <span>Before tracking started</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trend chart */}
      {selected && stats && (
        <section className="border-t border-border pt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Eyebrow className="mb-1">The 12-month trend</Eyebrow>
              <p className="text-xs text-muted-foreground">
                Monthly consumption, with multi-month bills spread across the months they cover.
              </p>
            </div>
            <Select value={selected.key} onValueChange={setSelectedKey}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select data series" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(group => {
                  const groupSeries = allSeries.filter(s => s.group === group);
                  if (groupSeries.length === 0) return null;
                  return groupSeries.map(s => (
                    <SelectItem key={s.key} value={s.key}>
                      {group}: {s.label}
                    </SelectItem>
                  ));
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="my-6 flex flex-wrap gap-x-12 gap-y-6 border-y border-border py-4">
              <BigNumber
                value={stats.total.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                label={`12-month total · ${selected.unit || 'units'}`}
              />
              <BigNumber
                value={stats.average.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                label={`Monthly average · ${selected.unit || 'units'}`}
              />
              <BigNumber
                value={
                  stats.trend.percentage > 0
                    ? `${stats.trend.direction === 'up' ? '+' : '-'}${stats.trend.percentage.toFixed(1)}%`
                    : 'Stable'
                }
                tone={trendTone}
                label="Trend · last 3 months"
              />
              <BigNumber
                value={`${stats.coveredCount}/${stats.trackedCount || 12}`}
                label="Months with data"
              />
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, _name: string, item: any) => [
                    `${value.toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${selected.unit}${item?.payload?.estimated ? ' (estimated)' : ''}`,
                    selected.label,
                  ]}
                  labelFormatter={(label) => chartData.find(d => d.shortLabel === label)?.label || label}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                />
                {stats.average > 0 && (
                  <ReferenceLine
                    y={stats.average}
                    stroke="#6F6F68"
                    strokeDasharray="5 5"
                    label={{ value: 'Avg', position: 'right', fontSize: 10, fill: '#6F6F68' }}
                  />
                )}
                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.estimated ? '#B45309' : '#2B46C0'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {stats.gapMonths.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs">
                <span className="text-studio-attention font-medium">Missing months:</span>
                {stats.gapMonths.map(m => (
                  <span key={m.key} className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-studio-attention">
                    {m.label}
                  </span>
                ))}
              </div>
            )}
            {selected.hasMixedUnits && (
              <p className="text-xs text-muted-foreground mt-2">
                Some entries use a different unit and are excluded from the totals above (they still count towards coverage).
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
