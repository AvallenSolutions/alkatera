'use client';

/**
 * Emissions -- THE TRENDS.
 *
 * Year on year in one quiet section: the stacked bars, the mix per year,
 * the comparison table and the closing figures. Same recharts, same data,
 * re-cut to hairline panels in the studio chart inks.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eyebrow } from '@/components/studio/eyebrow';
import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
import { BigNumber } from '@/components/studio/big-number';
import { STUDIO } from '@/components/studio';
import { SCOPE_COLOURS, type TrendYear } from './types';

interface TrendsSectionProps {
  trendData: TrendYear[];
  isLoading: boolean;
}

export function TrendsSection({ trendData, isLoading }: TrendsSectionProps) {
  const first = trendData[0];
  const last = trendData[trendData.length - 1];
  const overallChange =
    trendData.length >= 2 && first.total > 0
      ? ((last.total - first.total) / first.total) * 100
      : null;
  const biggestScope =
    trendData.length >= 1
      ? last.scope3 >= last.scope1 && last.scope3 >= last.scope2
        ? 'Scope 3 (value chain)'
        : last.scope1 >= last.scope2
          ? 'Scope 1 (direct)'
          : 'Scope 2 (purchased energy)'
      : null;

  return (
    <section id="trends" className="space-y-5">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>The trends</Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">
          Year on year, across every reporting period you have calculated.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[6px] bg-studio-ink/5" />
      ) : trendData.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No trends yet. Calculate your footprint for at least one year to see the picture over
          time.
        </p>
      ) : (
        <>
          {/* Stacked bars: the scopes per year. */}
          <Panel>
            <Eyebrow tone="dim" className="mb-4">Total emissions by year · t CO2e</Eyebrow>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12, fill: STUDIO.dim }}
                    stroke={STUDIO.hairline}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: STUDIO.dim }}
                    stroke={STUDIO.hairline}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v.toFixed(0)} t`}
                  />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [`${value.toFixed(2)} tCO2e`, name]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                    cursor={{ fill: 'rgba(26, 27, 29, 0.04)' }}
                  />
                  <Bar dataKey="scope1" name="Scope 1" stackId="a" fill={SCOPE_COLOURS.scope1} isAnimationActive={false} />
                  <Bar dataKey="scope2" name="Scope 2" stackId="a" fill={SCOPE_COLOURS.scope2} isAnimationActive={false} />
                  <Bar
                    dataKey="scope3"
                    name="Scope 3"
                    stackId="a"
                    fill={SCOPE_COLOURS.scope3}
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
              {(
                [
                  ['Scope 1 · direct', SCOPE_COLOURS.scope1],
                  ['Scope 2 · energy', SCOPE_COLOURS.scope2],
                  ['Scope 3 · value chain', SCOPE_COLOURS.scope3],
                ] as const
              ).map(([label, colour]) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-studio-dim">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colour }} />
                  {label}
                </span>
              ))}
            </div>
          </Panel>

          {/* The mix per year. */}
          <div className="space-y-4">
            <Eyebrow tone="dim">The mix by year</Eyebrow>
            {trendData.map((yr) => {
              const t = yr.total || 1;
              const s1Pct = (yr.scope1 / t) * 100;
              const s2Pct = (yr.scope2 / t) * 100;
              const s3Pct = (yr.scope3 / t) * 100;
              return (
                <div key={yr.year}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="font-display font-semibold">{yr.year}</span>
                    <span className="font-mono text-xs tabular-nums text-studio-dim">
                      {yr.total.toFixed(2)} tCO2e
                    </span>
                  </div>
                  <div className="flex h-4 overflow-hidden rounded-[3px]">
                    {s1Pct > 0 && (
                      <div
                        className="flex items-center justify-center font-mono text-[9px] font-bold text-studio-cream"
                        style={{ width: `${s1Pct}%`, backgroundColor: SCOPE_COLOURS.scope1 }}
                        title={`Scope 1: ${s1Pct.toFixed(1)}%`}
                      >
                        {s1Pct >= 10 && 'S1'}
                      </div>
                    )}
                    {s2Pct > 0 && (
                      <div
                        className="flex items-center justify-center font-mono text-[9px] font-bold text-studio-cream"
                        style={{ width: `${s2Pct}%`, backgroundColor: SCOPE_COLOURS.scope2 }}
                        title={`Scope 2: ${s2Pct.toFixed(1)}%`}
                      >
                        {s2Pct >= 10 && 'S2'}
                      </div>
                    )}
                    {s3Pct > 0 && (
                      <div
                        className="flex items-center justify-center font-mono text-[9px] font-bold text-studio-cream"
                        style={{ width: `${s3Pct}%`, backgroundColor: SCOPE_COLOURS.scope3 }}
                        title={`Scope 3: ${s3Pct.toFixed(1)}%`}
                      >
                        {s3Pct >= 10 && 'S3'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Year on year. */}
          {trendData.length >= 2 && (
            <div>
              <Eyebrow tone="dim" className="mb-2">Year on year</Eyebrow>
              <Panel flush>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Scope 1</TableHead>
                      <TableHead className="text-right">Scope 2</TableHead>
                      <TableHead className="text-right">Scope 3</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trendData.map((yr, i) => {
                      const prev = i > 0 ? trendData[i - 1] : null;
                      const change =
                        prev && prev.total > 0
                          ? ((yr.total - prev.total) / prev.total) * 100
                          : null;
                      const absChange = prev ? yr.total - prev.total : null;
                      return (
                        <TableRow key={yr.year}>
                          <TableCell className="font-semibold">{yr.year}</TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">
                            {yr.scope1.toFixed(2)} t
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">
                            {yr.scope2.toFixed(2)} t
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">
                            {yr.scope3.toFixed(2)} t
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold tabular-nums">
                            {yr.total.toFixed(2)} t
                          </TableCell>
                          <TableCell className="text-right">
                            {change !== null && absChange !== null ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <StateChip tone={change < 0 ? 'good' : 'stale'}>
                                  {change < 0 ? '' : '+'}
                                  {change.toFixed(1)}%
                                </StateChip>
                                <span className="font-mono text-xs tabular-nums text-studio-dim">
                                  {absChange > 0 ? '+' : ''}
                                  {absChange.toFixed(2)} t
                                </span>
                              </div>
                            ) : (
                              <StateChip>Baseline</StateChip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Panel>
            </div>
          )}

          {/* The closing figures. */}
          {trendData.length >= 2 && (
            <div className="flex flex-wrap gap-x-12 gap-y-4 border-t border-studio-hairline pt-4">
              <BigNumber
                value={
                  overallChange !== null
                    ? `${overallChange > 0 ? '+' : ''}${overallChange.toFixed(1)}%`
                    : 'N/A'
                }
                label={`Overall since ${first.year}`}
                tone={overallChange !== null && overallChange < 0 ? 'good' : 'stale'}
              />
              <div>
                <div className="font-display text-[1.75rem] font-bold leading-none text-foreground">
                  {biggestScope}
                </div>
                <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
                  Largest scope · {last.year}
                </div>
              </div>
              <BigNumber value={trendData.length} label="Years tracked" />
            </div>
          )}
        </>
      )}
    </section>
  );
}
