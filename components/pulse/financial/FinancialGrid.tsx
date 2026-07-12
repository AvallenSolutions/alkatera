'use client';

/**
 * Pulse Financial -- the CFO page, in the studio language.
 *
 * Opens with the surface's statement ("What your impact costs.") with the
 * annual environmental cost standing right as a display-bold figure over a
 * mono label. The board pack pill is the surface's one room-colour act;
 * shadow-price configuration sits beside it as the outline pill.
 *
 * The cards keep the uniform compact grid in CFO reading order: annual
 * liability → scenario sensitivity → intensity → regulatory exposure →
 * carbon budgets → MACC → top cost drivers → product cost → ISSB readiness.
 * They render through the shared PulseCard, re-cut number-first for this
 * surface by financial-studio.module.css (mono eyebrow labels, no header
 * icons, display-bold figures).
 *
 * Wraps in `MetricDrillProvider` + `WidgetDrillOverlay` so clicking any card
 * opens the same full-page drill we built for /pulse. Mounts every expanded
 * slot (including the financial-only ones: cost-intensity + top-cost-drivers
 * + issb-disclosure) so drills resolve their content.
 */

import { useMemo } from 'react';

import { Statement } from '@/components/studio/statement';
import { BigNumber } from '@/components/studio/big-number';
import { PillButton } from '@/components/studio/pill-button';

import { useAnnualEnvironmentalCost } from './use-annual-cost';
import { MetricDrillProvider, useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { WidgetDrillOverlay } from '@/components/pulse/WidgetDrillOverlay';
import { usePulseDrillUrl } from '@/hooks/usePulseDrillUrl';
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider';

// Compact cards -- shared with /pulse.
import { FinancialFootprintCard } from '@/components/pulse/widgets/financial-footprint/FinancialFootprintCard';
import { ScenarioSensitivityCard } from '@/components/pulse/widgets/scenario-sensitivity/ScenarioSensitivityCard';
import { MaccCard } from '@/components/pulse/widgets/macc/MaccCard';
import { CarbonBudgetsCard } from '@/components/pulse/widgets/carbon-budgets/CarbonBudgetsCard';
import { RegulatoryExposureCard } from '@/components/pulse/widgets/regulatory-exposure/RegulatoryExposureCard';
import { ProductEnvCostCard } from '@/components/pulse/widgets/product-env-cost/ProductEnvCostCard';
// Financial-only compact cards.
import { CostIntensityCompact } from '@/components/pulse/widgets/cost-intensity/CostIntensityCompact';
import { TopCostDriversCard as TopCostDriversCompact } from '@/components/pulse/widgets/top-cost-drivers/TopCostDriversCard';
import { IssbDisclosureCompact } from '@/components/pulse/widgets/issb-disclosure/IssbDisclosureCompact';

// Expanded slot mounts -- register drill renderers.
import { FinancialFootprintExpandedSlot } from '@/components/pulse/widgets/financial-footprint/expanded';
import { ScenarioSensitivityExpandedSlot } from '@/components/pulse/widgets/scenario-sensitivity/expanded';
import { MaccExpandedSlot } from '@/components/pulse/widgets/macc/expanded';
import { CarbonBudgetsExpandedSlot } from '@/components/pulse/widgets/carbon-budgets/expanded';
import { RegulatoryExposureExpandedSlot } from '@/components/pulse/widgets/regulatory-exposure/expanded';
import { ProductEnvCostExpandedSlot } from '@/components/pulse/widgets/product-env-cost/expanded';
import { TopCostDriversExpandedSlot } from '@/components/pulse/widgets/top-cost-drivers/expanded';
import { CostIntensityExpandedSlot } from '@/components/pulse/widgets/cost-intensity/expanded';
import { IssbDisclosureExpandedSlot } from '@/components/pulse/widgets/issb-disclosure/expanded';

import { BoardPackButton } from '@/components/pulse/financial/BoardPackButton';
import styles from './financial-studio.module.css';

export function PulseFinancialShell() {
  return (
    <MetricDrillProvider>
      <PulseFinancialShellBody />
    </MetricDrillProvider>
  );
}

function PulseFinancialShellBody() {
  // Two-way sync between ?drill= query param and drill context.
  usePulseDrillUrl();

  const { activeTarget, open: drillOpen } = useWidgetDrill();
  const rosaSlice = useMemo(
    () => ({
      id: 'pulse-financial',
      label: 'Pulse Financial (CFO view)',
      priority: 7,
      data: {
        activeDrill: drillOpen && activeTarget ? activeTarget : null,
        availableExports: ['board_pack_pdf', 'issb_csv'],
        cardIds: [
          'financial-footprint',
          'scenario-sensitivity',
          'macc',
          'carbon-budgets',
          'regulatory-exposure',
          'product-env-cost',
          'cost-intensity',
          'top-cost-drivers',
          'issb-disclosure',
        ],
      },
    }),
    [activeTarget, drillOpen],
  );
  useRosaPageContext(rosaSlice);

  return (
    <>
      <div className="space-y-8 pb-12">
        <FinancialStatement />
        <FinancialCardGrid />
      </div>

      {/* Drill renderers register here. */}
      <FinancialFootprintExpandedSlot />
      <ScenarioSensitivityExpandedSlot />
      <MaccExpandedSlot />
      <CarbonBudgetsExpandedSlot />
      <RegulatoryExposureExpandedSlot />
      <ProductEnvCostExpandedSlot />
      <TopCostDriversExpandedSlot />
      <CostIntensityExpandedSlot />
      <IssbDisclosureExpandedSlot />

      {/* The overlay itself. Mounted once. */}
      <WidgetDrillOverlay />
    </>
  );
}

function FinancialStatement() {
  const { figure: annualCost } = useAnnualEnvironmentalCost();

  return (
    <div className="space-y-5">
      <Statement eyebrow="PULSE · FINANCIAL" headline="What your impact costs.">
        {annualCost !== null && (
          <BigNumber size="display" value={annualCost} label="Last 12 months" />
        )}
      </Statement>

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-studio-dim">
          Live operational data multiplied by your shadow prices. Click any
          card for the deep view: month-by-month tables, scenario analysis,
          compliance calendars and audit-ready exports.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <BoardPackButton />
          <PillButton variant="outline" href="/pulse/settings/shadow-prices/">
            Manage prices
          </PillButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Uniform card grid. Each cell has a fixed height that matches PulseCard's
 * footprint semantics:
 *   - 1x1  = 1 col × 1 row (200px tall)
 *   - 2x1  = 2 cols × 1 row
 *   - 2x2  = 2 cols × 2 rows
 *
 * Using CSS grid directly (no RGL) because the financial page is static --
 * no drag/drop, no per-user persistence. Cleaner + faster.
 */
function FinancialCardGrid() {
  // Grid footprints are `col-span × row-span` at the `lg` breakpoint (4 cols).
  // At `sm` (2 cols) everything collapses sensibly via col-span-2/row-span-*.
  // At base (mobile, 1 col) all cards stack full-width.
  return (
    <div
      className={`${styles.recut} grid auto-rows-[200px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`}
      role="group"
      aria-label="Financial cards"
    >
      {/* Hero liability -- 2x2 on large, 2x2 on tablet, full-width on mobile */}
      <div className="sm:col-span-2 sm:row-span-2">
        <FinancialFootprintCard />
      </div>

      {/* Scenario sensitivity (2x1) */}
      <div className="sm:col-span-2 sm:row-span-1">
        <ScenarioSensitivityCard />
      </div>

      {/* Cost intensity (2x1) */}
      <div className="sm:col-span-2 sm:row-span-1">
        <CostIntensityCompact />
      </div>

      {/* Regulatory exposure + carbon budgets (2x1 each) */}
      <div className="sm:col-span-2 sm:row-span-1">
        <RegulatoryExposureCard />
      </div>
      <div className="sm:col-span-2 sm:row-span-1">
        <CarbonBudgetsCard />
      </div>

      {/* MACC hero + top cost drivers hero (2x2 each) */}
      <div className="sm:col-span-2 sm:row-span-2">
        <MaccCard />
      </div>
      <div className="sm:col-span-2 sm:row-span-2">
        <TopCostDriversCompact />
      </div>

      {/* Product cost + ISSB readiness */}
      <div className="sm:col-span-2 sm:row-span-1">
        <ProductEnvCostCard />
      </div>
      <div className="sm:col-span-1 sm:row-span-1">
        <IssbDisclosureCompact />
      </div>
    </div>
  );
}

