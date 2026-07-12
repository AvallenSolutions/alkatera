'use client';

/**
 * Emissions -- THE FOOTPRINT.
 *
 * The scope split is told once: a donut standing right, and the three
 * scopes as quiet fact rows with proportion bars in the studio chart inks.
 * Scope 1 and Scope 2 keep their unique by-source and by-facility tables
 * as a quiet disclosure under each row (the old copy-paste tabs retired).
 * Data entry happens in Facilities; that is one quiet line, not an alert.
 */

import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
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
import { ScopeDuplicateWarning } from '@/components/xero/ScopeDuplicateWarning';
import { XeroEnergyBaselineAlert } from '@/components/emissions/XeroEnergyBaselineAlert';
import { RelatableMetric } from '@/components/shared/RelatableMetric';
import type { XeroEntry } from '@/lib/xero/scope-card-mapping';
import {
  SCOPE_COLOURS,
  type FacilityBreakdown,
  type ScopeSources,
  type ScopeTotals,
  type SourceBreakdown,
} from './types';

interface FootprintSectionProps {
  selectedYear: number;
  selectedYearStart: string;
  selectedYearEnd: string;
  isLoading: boolean;
  hasData: boolean;
  totals: ScopeTotals;
  sources: ScopeSources;
  /** Raw utility totals in kg: the denominators the old tables used. */
  scope1CO2eKg: number;
  scope2CO2eKg: number;
  sourceBreakdown: SourceBreakdown[];
  facilityBreakdown: FacilityBreakdown[];
  xeroScope1Entries: XeroEntry[];
  xeroScope2Entries: XeroEntry[];
}

/** Sub-source line inside a scope row: quiet label, mono figure. */
function SourceLine({ label, tonnes }: { label: string; tonnes: number }) {
  if (tonnes <= 0) return null;
  return (
    <div className="flex items-baseline justify-between text-xs text-studio-dim">
      <span>{label}</span>
      <span className="font-mono tabular-nums">{tonnes.toFixed(3)} t</span>
    </div>
  );
}

/** By-source and by-facility tables for Scope 1 or 2, behind a quiet disclosure. */
function ScopeDetail({
  scope,
  scopeKgTotal,
  sourceRows,
  facilityRows,
}: {
  scope: 1 | 2;
  scopeKgTotal: number;
  sourceRows: SourceBreakdown[];
  facilityRows: Array<{ facility_id: string; facility_name: string; kg: number }>;
}) {
  if (sourceRows.length === 0 && facilityRows.length === 0) return null;

  return (
    <details className="group mt-3">
      <summary className="cursor-pointer list-none font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show the breakdown</span>
        <span className="hidden group-open:inline">Hide the breakdown</span>
      </summary>
      <div className="mt-3 space-y-4">
        {sourceRows.length > 0 && (
          <div>
            <Eyebrow tone="dim" className="mb-2">By emission source</Eyebrow>
            <Panel flush>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Emissions</TableHead>
                    <TableHead className="text-right">% of Scope {scope}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceRows.map((source) => (
                    <TableRow key={source.utility_type}>
                      <TableCell className="font-medium">{source.label}</TableCell>
                      <TableCell className="text-right">
                        {source.total_quantity.toLocaleString()} {source.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {(source.total_co2e / 1000).toFixed(3)} tCO2e
                      </TableCell>
                      <TableCell className="text-right">
                        {scopeKgTotal > 0
                          ? `${((source.total_co2e / scopeKgTotal) * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>
        )}

        {facilityRows.length > 0 && (
          <div>
            <Eyebrow tone="dim" className="mb-2">By facility</Eyebrow>
            <Panel flush>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facility</TableHead>
                    <TableHead className="text-right">Scope {scope} emissions</TableHead>
                    <TableHead className="text-right">% of total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facilityRows.map((facility) => (
                    <TableRow key={facility.facility_id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/company/facilities/${facility.facility_id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {facility.facility_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {(facility.kg / 1000).toFixed(3)} tCO2e
                      </TableCell>
                      <TableCell className="text-right">
                        {scopeKgTotal > 0
                          ? `${((facility.kg / scopeKgTotal) * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>
        )}
      </div>
    </details>
  );
}

export function FootprintSection({
  selectedYear,
  selectedYearStart,
  selectedYearEnd,
  isLoading,
  hasData,
  totals,
  sources,
  scope1CO2eKg,
  scope2CO2eKg,
  sourceBreakdown,
  facilityBreakdown,
  xeroScope1Entries,
  xeroScope2Entries,
}: FootprintSectionProps) {
  const pct = (v: number) =>
    totals.total > 0 ? ((v / totals.total) * 100).toFixed(1) : '0';

  const donutData = [
    { name: 'Scope 1', value: totals.scope1, colour: SCOPE_COLOURS.scope1 },
    { name: 'Scope 2', value: totals.scope2, colour: SCOPE_COLOURS.scope2 },
    { name: 'Scope 3', value: totals.scope3, colour: SCOPE_COLOURS.scope3 },
  ].filter((d) => d.value > 0);

  const scope1Sources = sourceBreakdown.filter((s) => s.scope === 'Scope 1');
  const scope2Sources = sourceBreakdown.filter((s) => s.scope === 'Scope 2');
  const scope1Facilities = facilityBreakdown
    .filter((f) => f.scope1_co2e > 0)
    .map((f) => ({ facility_id: f.facility_id, facility_name: f.facility_name, kg: f.scope1_co2e }));
  const scope2Facilities = facilityBreakdown
    .filter((f) => f.scope2_co2e > 0)
    .map((f) => ({ facility_id: f.facility_id, facility_name: f.facility_name, kg: f.scope2_co2e }));

  return (
    <section id="footprint" className="space-y-5">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>The footprint</Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">
          Your {selectedYear} greenhouse gas inventory, split across the three scopes.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[6px] bg-studio-ink/5" />
      ) : !hasData ? (
        <div className="py-6">
          <p className="text-sm text-muted-foreground">
            No emissions data for {selectedYear} yet. Scope 1 and 2 come from utility data at{' '}
            <Link href="/company/facilities" className="font-medium text-room-accent underline-offset-4 hover:underline">
              your facilities
            </Link>
            ; Scope 3 starts in the section below.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10 md:flex-row">
          {/* The scope split, told once: quiet rows with proportion bars. */}
          <div className="min-w-0 flex-1">
            {/* Scope 1 */}
            <div className="border-b border-studio-hairline py-4">
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0 text-sm">
                  <span className="font-display font-semibold text-foreground">Scope 1</span>
                  <span className="text-studio-dim"> · Direct emissions</span>
                </div>
                <div className="flex shrink-0 items-baseline gap-3">
                  <span className="font-display text-lg font-bold tabular-nums text-foreground">
                    {totals.scope1 > 0 ? totals.scope1.toFixed(3) : '0'}
                    <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">t</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                    {pct(totals.scope1)}%
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-studio-hairline">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct(totals.scope1)}%`, backgroundColor: SCOPE_COLOURS.scope1 }}
                />
              </div>
              {totals.scope1 > 0 && (
                <div className="mt-3 space-y-1.5">
                  <SourceLine label="Facility fuels" tonnes={sources.s1Utilities} />
                  <SourceLine label="Owned fleet" tonnes={sources.s1Fleet} />
                  <SourceLine label="Spend estimates" tonnes={sources.s1Xero} />
                </div>
              )}
              <div className="mt-3 space-y-3 empty:mt-0">
                <ScopeDuplicateWarning scope={1} yearStart={selectedYearStart} yearEnd={selectedYearEnd} />
                <XeroEnergyBaselineAlert entries={xeroScope1Entries} scope="Scope 1" />
              </div>
              <ScopeDetail
                scope={1}
                scopeKgTotal={scope1CO2eKg}
                sourceRows={scope1Sources}
                facilityRows={scope1Facilities}
              />
            </div>

            {/* Scope 2 */}
            <div className="border-b border-studio-hairline py-4">
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0 text-sm">
                  <span className="font-display font-semibold text-foreground">Scope 2</span>
                  <span className="text-studio-dim"> · Purchased energy</span>
                </div>
                <div className="flex shrink-0 items-baseline gap-3">
                  <span className="font-display text-lg font-bold tabular-nums text-foreground">
                    {totals.scope2 > 0 ? totals.scope2.toFixed(3) : '0'}
                    <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">t</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                    {pct(totals.scope2)}%
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-studio-hairline">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct(totals.scope2)}%`, backgroundColor: SCOPE_COLOURS.scope2 }}
                />
              </div>
              {totals.scope2 > 0 && (
                <div className="mt-3 space-y-1.5">
                  <SourceLine label="Electricity and heat" tonnes={sources.s2Utilities} />
                  <SourceLine label="Electric fleet" tonnes={sources.s2Fleet} />
                  <SourceLine label="Spend estimates" tonnes={sources.s2Xero} />
                </div>
              )}
              {sources.s2Utilities > 0 && (
                <p className="mt-2 text-xs text-studio-dim">
                  Location-based method (UK grid average).
                </p>
              )}
              <div className="mt-3 space-y-3 empty:mt-0">
                <ScopeDuplicateWarning scope={2} yearStart={selectedYearStart} yearEnd={selectedYearEnd} />
                <XeroEnergyBaselineAlert entries={xeroScope2Entries} scope="Scope 2" />
              </div>
              <ScopeDetail
                scope={2}
                scopeKgTotal={scope2CO2eKg}
                sourceRows={scope2Sources}
                facilityRows={scope2Facilities}
              />
            </div>

            {/* Scope 3 */}
            <div className="border-b border-studio-hairline py-4">
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0 text-sm">
                  <span className="font-display font-semibold text-foreground">Scope 3</span>
                  <span className="text-studio-dim"> · Value chain</span>
                </div>
                <div className="flex shrink-0 items-baseline gap-3">
                  <span className="font-display text-lg font-bold tabular-nums text-foreground">
                    {totals.scope3 > 0 ? totals.scope3.toFixed(3) : '0'}
                    <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">t</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                    {pct(totals.scope3)}%
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-studio-hairline">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct(totals.scope3)}%`, backgroundColor: SCOPE_COLOURS.scope3 }}
                />
              </div>
              {totals.scope3 > 0 && (
                <div className="mt-3 space-y-1.5">
                  <SourceLine label="Products (LCA)" tonnes={sources.s3Products} />
                  <SourceLine label="Use phase (Cat 11)" tonnes={sources.s3UsePhase} />
                  <SourceLine label="Activities" tonnes={sources.s3Activities} />
                  <SourceLine label="Spend estimates" tonnes={sources.s3Xero} />
                  <SourceLine label="Grey fleet" tonnes={sources.s3Fleet} />
                </div>
              )}
              <p className="mt-3 text-xs text-studio-dim">
                Category detail and data entry live in the Scope 3 section below.
              </p>
            </div>

            <p className="mt-4 text-xs text-studio-dim">
              Scope 1 and 2 are read only here: add or edit utility data in{' '}
              <Link href="/company/facilities" className="text-room-accent underline-offset-4 hover:underline">
                your facilities
              </Link>
              .
            </p>
          </div>

          {/* The donut, once. */}
          <div className="shrink-0 md:w-64">
            <div className="relative h-56 w-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.colour} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => [`${value.toFixed(3)} t`, '']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="font-display text-lg font-bold tabular-nums text-foreground">
                    {totals.total.toFixed(1)}
                  </div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-studio-dim">
                    t CO2e
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: d.colour }}
                  />
                  <span className="text-studio-dim">{d.name}</span>
                  <span className="ml-auto font-mono tabular-nums text-foreground">
                    {pct(d.value)}%
                  </span>
                </div>
              ))}
            </div>
            <RelatableMetric
              kind="co2e"
              valueKg={totals.total * 1000}
              variant="light"
              className="mt-5"
            />
          </div>
        </div>
      )}
    </section>
  );
}
