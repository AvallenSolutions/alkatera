'use client';

/**
 * Emissions -- SCOPE 3.
 *
 * The category cards, grouped as before but re-cut quiet: mono eyebrow
 * group headers on hairlines, the shared cards quietened via the
 * quiet-cards wrapper (they are also mounted by the footprint report
 * page, so they cannot be edited directly). The old sticky sidebar is
 * gone: the Xero link is one quiet fact row and the spend importer sits
 * at the end of the section. The suppression notice is a quiet line
 * pointing at the inventory ledger.
 */

import Link from 'next/link';
import { Eyebrow } from '@/components/studio/eyebrow';
import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
import { BigNumber } from '@/components/studio/big-number';
import { FactList } from '@/components/studio/fact-list';
import { BusinessTravelCard } from '@/components/reports/BusinessTravelCard';
import { ServicesOverheadCard } from '@/components/reports/ServicesOverheadCard';
import { TeamCommutingCard } from '@/components/reports/TeamCommutingCard';
import { CapitalGoodsCard } from '@/components/reports/CapitalGoodsCard';
import { LogisticsDistributionCard } from '@/components/reports/LogisticsDistributionCard';
import { OperationalWasteCard } from '@/components/reports/OperationalWasteCard';
import { MarketingMaterialsCard } from '@/components/reports/MarketingMaterialsCard';
import { UpstreamTransportCard } from '@/components/reports/UpstreamTransportCard';
import { DownstreamTransportCard } from '@/components/reports/DownstreamTransportCard';
import { UsePhaseCard } from '@/components/reports/UsePhaseCard';
import { SpendImportCard } from '@/components/emissions/SpendImportCard';
import type { XeroEntry } from '@/lib/xero/scope-card-mapping';
import { cn } from '@/lib/utils';
import type { CorporateReport } from './types';
import styles from './quiet-cards.module.css';

interface ScopeThreeSectionProps {
  report: CorporateReport | null;
  organizationId?: string;
  selectedYear: number;
  isLoading: boolean;
  onUpdate: () => void;
  /* Headline figures (tonnes unless noted). */
  scope3Cat1CO2e: number;
  scope3Cat11CO2e: number;
  calculatedScope3OverheadsKg: number;
  xeroScope3Kg: number;
  fleetScope3CO2e: number;
  /* Cat 1 detail. */
  scope3Cat1Breakdown: Array<{
    product_name: string;
    total_tco2e: number;
    materials_tco2e: number;
    packaging_tco2e: number;
    production_volume: number;
  }>;
  scope3Cat1PendingProducts: Array<{ product_name: string; status: string }>;
  scope3Cat1DataQuality: string;
  /* Category entries. */
  travelEntries: any[];
  serviceEntries: any[];
  marketingEntries: any[];
  fteCount: number;
  capitalGoodsEntries: any[];
  logisticsEntries: any[];
  wasteEntries: any[];
  upstreamTransportEntries: any[];
  downstreamTransportEntries: any[];
  xeroByCategory: Map<string, XeroEntry[]>;
  /* Xero suppression (double-counting) facts. */
  suppressedCount: number;
  suppressedKg: number;
  suppressedByLcaCount: number;
  suppressedByInventoryCount: number;
  inventoryLedgerKg: number;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow tone="dim" className="mb-3 border-b border-studio-hairline pb-2">
        {label}
      </Eyebrow>
      <div className="columns-1 gap-4 md:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {children}
      </div>
    </div>
  );
}

export function ScopeThreeSection({
  report,
  organizationId,
  selectedYear,
  isLoading,
  onUpdate,
  scope3Cat1CO2e,
  scope3Cat11CO2e,
  calculatedScope3OverheadsKg,
  xeroScope3Kg,
  fleetScope3CO2e,
  scope3Cat1Breakdown,
  scope3Cat1PendingProducts,
  scope3Cat1DataQuality,
  travelEntries,
  serviceEntries,
  marketingEntries,
  fteCount,
  capitalGoodsEntries,
  logisticsEntries,
  wasteEntries,
  upstreamTransportEntries,
  downstreamTransportEntries,
  xeroByCategory,
  suppressedCount,
  suppressedKg,
  suppressedByLcaCount,
  suppressedByInventoryCount,
  inventoryLedgerKg,
}: ScopeThreeSectionProps) {
  const scope3Total =
    scope3Cat1CO2e +
    scope3Cat11CO2e +
    calculatedScope3OverheadsKg / 1000 +
    xeroScope3Kg / 1000 +
    fleetScope3CO2e;

  const suppressionParts: string[] = [];
  if (suppressedByLcaCount > 0) {
    suppressionParts.push(`${suppressedByLcaCount} covered by a completed product LCA`);
  }
  if (suppressedByInventoryCount > 0) {
    suppressionParts.push(
      `${suppressedByInventoryCount} re-booked to the consumption period via the inventory ledger${
        inventoryLedgerKg > 0
          ? ` (+${(inventoryLedgerKg / 1000).toFixed(2)} t on consumption dates)`
          : ''
      }`
    );
  }
  const otherSuppressed = suppressedCount - suppressedByLcaCount - suppressedByInventoryCount;
  if (otherSuppressed > 0) {
    suppressionParts.push(`${otherSuppressed} superseded by a higher-quality source in the same month`);
  }

  return (
    <section id="scope-3" className="space-y-6">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>Scope 3 · The value chain</Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">
          For most drinks companies this is 80% or more of total emissions. Start with the
          categories where you have the best data.
        </p>
      </div>

      {/* The headline figures, standing on the paper. */}
      <div className="flex flex-wrap gap-x-12 gap-y-4">
        <BigNumber
          value={scope3Total > 0 ? scope3Total.toFixed(2) : '0'}
          label={`Total Scope 3 · T CO2E · ${selectedYear}`}
        />
        <BigNumber
          value={scope3Cat1CO2e > 0 ? scope3Cat1CO2e.toFixed(2) : '0'}
          label="From products · Tier 1"
          tone={scope3Cat1CO2e > 0 ? 'good' : 'ink'}
        />
        <BigNumber
          value={
            calculatedScope3OverheadsKg > 0
              ? (calculatedScope3OverheadsKg / 1000).toFixed(2)
              : '0'
          }
          label="From activities · Tier 2"
        />
        <BigNumber
          value={xeroScope3Kg > 0 ? (xeroScope3Kg / 1000).toFixed(2) : '0'}
          label="From spend data · Tier 4"
          tone={xeroScope3Kg > 0 ? 'attention' : 'ink'}
        />
      </div>

      {suppressedCount > 0 && (
        <p className="text-xs text-studio-dim">
          {suppressedCount} Xero transaction{suppressedCount === 1 ? '' : 's'} hidden (
          {(suppressedKg / 1000).toFixed(2)} t CO2e) to prevent double-counting
          {suppressionParts.length > 0 ? `: ${suppressionParts.join('; ')}` : ''}. See{' '}
          <Link
            href="/data/inventory-ledger/"
            className="text-room-accent underline-offset-4 hover:underline"
          >
            the inventory ledger
          </Link>
          .
        </p>
      )}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[6px] bg-studio-ink/5" />
      ) : report ? (
        <div className={cn('space-y-8', styles.quiet)}>
          <Group label="Purchased goods · Cat 1-2">
            {/* Cat 1: products, fed by completed LCAs. Page-local, cut quiet. */}
            <Panel>
              <div className="flex items-baseline justify-between gap-3">
                <Eyebrow tone="dim">Cat 1 · Products</Eyebrow>
                {scope3Cat1CO2e > 0 && <StateChip tone="good">Auto</StateChip>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Raw materials and packaging from product LCAs
              </p>
              {scope3Cat1CO2e > 0 ? (
                <div className="mt-4">
                  <div className="font-display text-2xl font-bold tabular-nums text-foreground">
                    {scope3Cat1CO2e.toFixed(3)}
                    <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      t CO2e
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-studio-dim">{scope3Cat1DataQuality}</div>
                  {scope3Cat1Breakdown.length > 0 && (
                    <div className="mt-3 divide-y divide-studio-hairline">
                      {scope3Cat1Breakdown.map((product, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 text-xs">
                          <span className="mr-2 truncate">{product.product_name}</span>
                          <span className="shrink-0 font-mono tabular-nums">
                            {product.total_tco2e.toFixed(3)} t
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {scope3Cat1PendingProducts.length > 0 && (
                    <p className="mt-2 text-xs text-studio-attention">
                      {scope3Cat1PendingProducts.length} product
                      {scope3Cat1PendingProducts.length !== 1 ? 's' : ''} excluded (incomplete LCA)
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  No product LCA data yet.{' '}
                  <Link
                    href="/products"
                    className="text-room-accent underline-offset-4 hover:underline"
                  >
                    Go to products
                  </Link>
                  .
                </p>
              )}
            </Panel>

            <CapitalGoodsCard
              reportId={report.id}
              entries={capitalGoodsEntries}
              onUpdate={onUpdate}
            />

            <MarketingMaterialsCard
              reportId={report.id}
              entries={marketingEntries}
              onUpdate={onUpdate}
              xeroEntries={xeroByCategory.get('purchased_services_materials')}
            />
          </Group>

          <Group label="Travel and commuting · Cat 6-7">
            <BusinessTravelCard
              reportId={report.id}
              entries={travelEntries}
              onUpdate={onUpdate}
              xeroEntries={xeroByCategory.get('business_travel')}
            />

            <TeamCommutingCard
              reportId={report.id}
              initialFteCount={fteCount}
              onUpdate={onUpdate}
            />
          </Group>

          <Group label="Purchased services · Cat 8">
            <ServicesOverheadCard
              reportId={report.id}
              entries={serviceEntries}
              onUpdate={onUpdate}
              xeroEntries={xeroByCategory.get('purchased_services')}
            />
          </Group>

          <Group label="Logistics and transport · Cat 4, 9">
            {organizationId && (
              <LogisticsDistributionCard
                reportId={report.id}
                organizationId={organizationId}
                year={selectedYear}
                entries={logisticsEntries}
                onUpdate={onUpdate}
                xeroEntries={xeroByCategory.get('downstream_logistics')}
              />
            )}

            {organizationId && (
              <UpstreamTransportCard
                reportId={report.id}
                organizationId={organizationId}
                year={selectedYear}
                entries={upstreamTransportEntries}
                onUpdate={onUpdate}
              />
            )}

            {organizationId && (
              <DownstreamTransportCard
                reportId={report.id}
                organizationId={organizationId}
                year={selectedYear}
                entries={downstreamTransportEntries}
                onUpdate={onUpdate}
              />
            )}
          </Group>

          <Group label="Waste and water · Cat 5">
            <OperationalWasteCard
              reportId={report.id}
              entries={wasteEntries}
              onUpdate={onUpdate}
              xeroEntries={xeroByCategory.get('operational_waste')}
            />
          </Group>

          <Group label="Product use phase · Cat 11">
            {organizationId && (
              <UsePhaseCard
                reportId={report.id}
                organizationId={organizationId}
                year={selectedYear}
                totalCO2eTonnes={scope3Cat11CO2e}
              />
            )}
          </Group>

          {/* Import routes: a quiet row and the spend importer, no sidebar. */}
          <div>
            <Eyebrow tone="dim" className="mb-1 border-b border-studio-hairline pb-2">
              Import data
            </Eyebrow>
            <FactList
              dense
              items={[
                {
                  id: 'xero',
                  title: 'Spend data from Xero',
                  hint: 'Classify suppliers by category to estimate emissions from spend.',
                  href: '/data/spend-data/',
                },
              ]}
            />
            {organizationId && (
              <div className="mt-4">
                <SpendImportCard
                  reportId={report.id}
                  organizationId={organizationId}
                  year={selectedYear}
                  onUpdate={onUpdate}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Unable to load the Scope 3 categories. Try refreshing the page.
        </p>
      )}
    </section>
  );
}
