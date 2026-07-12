'use client';

/**
 * Data quality (/data/quality/), recomposed in the studio grammar.
 *
 * One statement (the overall score standing right with a working-tone
 * chip), a hairline figures row instead of the five icon stat cards,
 * then sections down one paper: THE PICTURE (distribution, sources and
 * the per-product table, each fact counted once), UPGRADE OPPORTUNITIES
 * (the simulator as one quiet line plus the ranked, filterable table,
 * kept intact), and WHERE THE DATA COMES FROM compressed to the foot
 * with a line out to /data/sources/. The internal tabs are gone; the
 * hook and every filter behaviour are unchanged.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import { FactList } from '@/components/studio/fact-list';
import { FactRow } from '@/components/studio/fact-row';
import type { WorkingTone } from '@/components/studio/theme';
import { useDataQualityMetrics } from '@/hooks/data/useDataQualityMetrics';
import { useOrganization } from '@/lib/organizationContext';

const WHAT_WE_MEASURE = [
  'Climate change',
  'Water consumption',
  'Land use',
  'Ozone depletion',
  'Particulate matter',
  'Eutrophication',
  'Acidification',
  'Ecotoxicity',
  'Resource scarcity',
];

/** A quiet section: mono eyebrow on a hairline, then the work. */
function Section({
  label,
  blurb,
  children,
}: {
  label: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>{label}</Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

/** One band of the quality distribution: name, mono figures, a thin working-tone bar. */
function DistributionBand({
  name,
  count,
  percentage,
  tone,
  description,
}: {
  name: string;
  count: number;
  percentage: number;
  tone: 'good' | 'attention' | 'stale';
  description: string;
}) {
  const barClass =
    tone === 'good' ? 'bg-studio-good' : tone === 'attention' ? 'bg-studio-attention' : 'bg-studio-stale';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-display text-sm font-semibold text-foreground">{name}</span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim tabular-nums">
          {count} · {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-studio-hairline">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default function DataQualityDashboard() {
  const { currentOrganization } = useOrganization();
  const {
    distribution,
    averageConfidence,
    hybridSourcesCount,
    defraCount,
    supplierVerifiedCount,
    upgradeOpportunities,
    totalUpgradeOpportunities,
    carbonAtRisk,
    productQualityBreakdown,
    loading,
    error,
  } = useDataQualityMetrics(currentOrganization?.id);

  // Upgrade Opportunities filter + pagination state
  const [opportunityQualityFilter, setOpportunityQualityFilter] = useState<'ALL' | 'LOW' | 'MEDIUM'>('ALL');
  const [opportunityProductFilter, setOpportunityProductFilter] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Reset visible count whenever filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [opportunityQualityFilter, opportunityProductFilter]);

  const filteredOpportunities = upgradeOpportunities
    .filter(o => opportunityQualityFilter === 'ALL' || o.current_quality === opportunityQualityFilter)
    .filter(o => opportunityProductFilter === 'ALL' || o.product_id === opportunityProductFilter);

  const visibleOpportunities = filteredOpportunities.slice(0, visibleCount);

  const opportunityProducts = Array.from(
    new Map(upgradeOpportunities.map(o => [o.product_id, o.product_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  // Improvement simulator: what would upgrading top 3 materials do to the score?
  const simulatorData = (() => {
    if (upgradeOpportunities.length < 3 || distribution.total_count === 0) return null;
    const top3 = upgradeOpportunities.slice(0, 3);
    const gainedConfidence = top3.reduce((sum, opp) => sum + opp.confidence_gain, 0);
    const simulatedScore = Math.min(
      100,
      Math.round(averageConfidence + gainedConfidence / distribution.total_count)
    );
    return { simulatedScore, top3Names: top3.map(o => o.material_name) };
  })();

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-24 animate-pulse rounded-[6px] bg-studio-cream" aria-hidden="true" />
        <div className="h-64 animate-pulse rounded-[6px] bg-studio-cream" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="border-t border-studio-hairline pt-6 text-sm text-muted-foreground">
          <StateChip tone="stale" className="mr-2">ERROR</StateChip>
          Error loading data quality metrics: {error}
        </p>
      </div>
    );
  }

  // An org with nothing measured has no quality to judge yet: quiet, not scolded.
  const rating: { label: string; tone: WorkingTone } =
    distribution.total_count === 0
      ? { label: 'NO DATA YET', tone: 'quiet' }
      : averageConfidence >= 85
        ? { label: 'EXCELLENT', tone: 'good' }
        : averageConfidence >= 70
          ? { label: 'GOOD', tone: 'good' }
          : averageConfidence >= 50
            ? { label: 'FAIR', tone: 'attention' }
            : { label: 'NEEDS WORK', tone: 'stale' };

  const ecoinventCount = distribution.total_count - defraCount - supplierVerifiedCount;

  const scoreTone = (score: number): string =>
    score >= 70 ? 'text-studio-good' : score >= 40 ? 'text-studio-attention' : 'text-studio-stale';

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="space-y-4">
        <Statement eyebrow="THE WORKBENCH · DATA QUALITY" headline="Data quality.">
          <div>
            <BigNumber size="display" value={`${averageConfidence}%`} label="Overall data quality" />
            <div className="mt-1 h-4">
              <StateChip tone={rating.tone}>{rating.label}</StateChip>
            </div>
          </div>
        </Statement>
        <p className="max-w-xl text-sm text-muted-foreground">
          How accurate your footprint data is across your products, and where better numbers from
          your suppliers would improve it.
        </p>
      </div>

      {/* The figures, once each, on one hairline row. */}
      <div className="flex flex-wrap gap-x-12 gap-y-6 border-y border-studio-hairline py-5">
        <BigNumber value={distribution.total_count.toLocaleString('en-GB')} label="Materials measured" />
        <BigNumber
          value={totalUpgradeOpportunities.toLocaleString('en-GB')}
          label="Can be improved"
          tone={totalUpgradeOpportunities > 0 ? 'attention' : 'ink'}
        />
        <BigNumber value={carbonAtRisk.toFixed(1)} label="kg CO2e at risk" />
      </div>

      <Section
        label="THE PICTURE"
        blurb="How reliable the numbers are, and which databases they come from."
      >
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {/* Quality distribution */}
          <div className="space-y-5">
            <DistributionBand
              name="Well established"
              count={distribution.high_count}
              percentage={distribution.high_percentage}
              tone="good"
              description="Primary verified data: supplier EPDs, direct measurements, or peer-reviewed primary datasets"
            />
            <DistributionBand
              name="Good estimate"
              count={distribution.medium_count}
              percentage={distribution.medium_percentage}
              tone="attention"
              description="Based on trusted regional databases: good accuracy for most reporting needs"
            />
            <DistributionBand
              name="Best available"
              count={distribution.low_count}
              percentage={distribution.low_percentage}
              tone="stale"
              description="Based on general industry averages: can be improved with supplier-specific data"
            />
            {distribution.low_percentage > 30 && (
              <p className="text-xs text-muted-foreground">
                <StateChip tone="attention" className="mr-2">WORTH A LOOK</StateChip>
                Over 30% of your materials rely on general estimates. Asking your suppliers for
                their own data could make your carbon footprint much more accurate.
              </p>
            )}
          </div>

          {/* Where the numbers come from */}
          <div>
            <FactList
              dense
              items={[
                {
                  id: 'defra',
                  title: 'UK Government (DEFRA 2025)',
                  hint: 'Official UK emission factors used for regulatory reporting',
                  value: String(defraCount),
                  unit: 'MATERIALS',
                },
                {
                  id: 'hybrid',
                  title: 'Combined (UK + international)',
                  hint: 'UK carbon data combined with international environmental data',
                  value: String(hybridSourcesCount),
                  unit: 'MATERIALS',
                },
                {
                  id: 'supplier',
                  title: 'Direct from suppliers',
                  hint: 'Verified data provided by your own suppliers',
                  value: String(supplierVerifiedCount),
                  unit: 'MATERIALS',
                },
                {
                  id: 'ecoinvent',
                  title: 'International research (Ecoinvent)',
                  hint: 'Comprehensive environmental database used worldwide',
                  value: String(ecoinventCount),
                  unit: 'MATERIALS',
                },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              We combine UK government data (DEFRA) with international research databases
              (Ecoinvent) to give you the most complete and compliant picture possible.
            </p>
          </div>
        </div>

        {/* Per-product quality breakdown */}
        {productQualityBreakdown.length > 0 && (
          <div className="pt-2">
            <Eyebrow tone="dim" className="mb-1">QUALITY BY PRODUCT</Eyebrow>
            <p className="mb-2 text-xs text-muted-foreground">
              Sorted by quality score: the products most in need of improvement appear first.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Materials</TableHead>
                  <TableHead className="text-right">Quality score</TableHead>
                  <TableHead className="w-[200px]">Breakdown</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productQualityBreakdown.map((row) => (
                  <TableRow key={row.product_id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/products/${row.product_id}`}
                        className="hover:underline"
                      >
                        {row.product_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.material_count}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-xs font-bold tabular-nums ${scoreTone(row.quality_score)}`}>
                        {row.quality_score}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        {row.high_count > 0 && (
                          <div
                            className="h-2 rounded-sm bg-studio-good"
                            style={{ width: `${(row.high_count / row.material_count) * 120}px` }}
                            title={`${row.high_count} high quality`}
                          />
                        )}
                        {row.medium_count > 0 && (
                          <div
                            className="h-2 rounded-sm bg-studio-attention"
                            style={{ width: `${(row.medium_count / row.material_count) * 120}px` }}
                            title={`${row.medium_count} medium quality`}
                          />
                        )}
                        {row.low_count > 0 && (
                          <div
                            className="h-2 rounded-sm bg-studio-stale"
                            style={{ width: `${(row.low_count / row.material_count) * 120}px` }}
                            title={`${row.low_count} low quality`}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section
        label="UPGRADE OPPORTUNITIES"
        blurb="Ranked by how much upgrading each material would improve your overall accuracy."
      >
        {/* Improvement simulator: one quiet line. */}
        {simulatorData && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            Upgrade your top three materials ({simulatorData.top3Names.join(', ')}) to
            high-quality data and your overall score could move from{' '}
            <span className="font-semibold text-foreground">{averageConfidence}%</span> to{' '}
            <span className="font-semibold text-foreground">{simulatorData.simulatedScore}%</span>.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
            {filteredOpportunities.length !== totalUpgradeOpportunities
              ? `SHOWING ${filteredOpportunities.length} OF ${totalUpgradeOpportunities} MATERIALS`
              : `${totalUpgradeOpportunities} MATERIAL${totalUpgradeOpportunities !== 1 ? 'S' : ''} IDENTIFIED`}
          </span>
          <div className="flex flex-shrink-0 gap-2">
            <Select
              value={opportunityQualityFilter}
              onValueChange={(v) => setOpportunityQualityFilter(v as 'ALL' | 'LOW' | 'MEDIUM')}
            >
              <SelectTrigger className="h-9 w-[130px] text-sm">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All quality</SelectItem>
                <SelectItem value="LOW">Low only</SelectItem>
                <SelectItem value="MEDIUM">Medium only</SelectItem>
              </SelectContent>
            </Select>

            {opportunityProducts.length > 1 && (
              <Select
                value={opportunityProductFilter}
                onValueChange={setOpportunityProductFilter}
              >
                <SelectTrigger className="h-9 w-[160px] text-sm">
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All products</SelectItem>
                  {opportunityProducts.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {filteredOpportunities.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              {upgradeOpportunities.length === 0
                ? 'Your data is in great shape.'
                : 'No results match the current filters.'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {upgradeOpportunities.length === 0
                ? 'All your materials are using well-established data sources.'
                : 'Try adjusting the quality or product filter above.'}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Current quality</TableHead>
                  <TableHead className="text-right">Carbon impact</TableHead>
                  <TableHead className="text-right">Potential improvement</TableHead>
                  <TableHead>Suggested action</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOpportunities.map((opp) => (
                  <TableRow key={opp.material_id}>
                    <TableCell className="font-medium">{opp.material_name}</TableCell>
                    <TableCell className="text-muted-foreground">{opp.product_name}</TableCell>
                    <TableCell>
                      <StateChip tone={opp.current_quality === 'LOW' ? 'stale' : 'attention'}>
                        {opp.current_quality} · {opp.current_confidence}%
                      </StateChip>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {opp.ghg_impact.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-xs font-bold tabular-nums text-studio-good">
                        +{opp.confidence_gain}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{opp.recommendation}</span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/products/${opp.product_id}`}
                        className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent transition-opacity hover:opacity-70"
                      >
                        View product
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination footer */}
            {filteredOpportunities.length > visibleCount && (
              <div className="flex items-center justify-between border-t border-studio-hairline pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                  SHOWING {visibleCount} OF {filteredOpportunities.length}
                </p>
                <PillButton
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount(v => v + 10)}
                >
                  Show more
                </PillButton>
              </div>
            )}
            {filteredOpportunities.length <= visibleCount && filteredOpportunities.length > 10 && (
              <p className="border-t border-studio-hairline pt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                SHOWING ALL {filteredOpportunities.length} RESULTS
              </p>
            )}
          </>
        )}
      </Section>

      {/* The foot of the paper: rarely used, but everyone should be able to
          see where their data comes from. */}
      <Section
        label="WHERE THE DATA COMES FROM"
        blurb="The standards behind the numbers, and everything we measure."
      >
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <div>
            <Eyebrow tone="dim" className="mb-1">STANDARDS WE FOLLOW</Eyebrow>
            <FactRow
              subject="UK Government standards"
              detail="official DEFRA 2025 numbers for UK energy and emissions reporting"
            />
            <FactRow
              subject="International best practice"
              detail="ISO standards for lifecycle assessment and carbon footprinting"
            />
            <FactRow
              subject="EU sustainability reporting"
              detail="climate, water, biodiversity and resource use for CSRD compliance"
            />
          </div>

          <div>
            <Eyebrow tone="dim" className="mb-1">WHAT WE MEASURE</Eyebrow>
            <div className="grid grid-cols-2 gap-x-6">
              {WHAT_WE_MEASURE.map(name => (
                <div
                  key={name}
                  className="flex items-baseline justify-between border-b border-studio-hairline py-1.5 text-sm"
                >
                  <span className="text-muted-foreground">{name}</span>
                  <StateChip tone="good">TRACKED</StateChip>
                </div>
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              18 IMPACT CATEGORIES IN TOTAL
            </p>
          </div>
        </div>

        <FactRow
          subject="The sources"
          detail="every emission factor we use, and where it comes from"
          meta="OPEN THE FACTOR LIBRARY"
          href="/data/sources/"
        />
      </Section>
    </div>
  );
}
