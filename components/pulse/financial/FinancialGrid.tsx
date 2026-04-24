'use client';

/**
 * Pulse Financial -- uniform compact-card grid.
 *
 * Same card vocabulary as the main /pulse grid, arranged as a CFO reading
 * order: annual liability → intensity → scenario sensitivity → regulatory
 * exposure → MACC → carbon budgets → top cost drivers → product cost →
 * ISSB readiness.
 *
 * Wraps in `MetricDrillProvider` + `WidgetDrillOverlay` so clicking any card
 * opens the same full-page drill we built for /pulse. Mounts every expanded
 * slot (including the financial-only ones: cost-intensity + top-cost-drivers
 * + issb-disclosure) so drills resolve their content.
 */

import Link from 'next/link';
import { ArrowLeft, PoundSterling } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { MetricDrillProvider } from '@/lib/pulse/MetricDrillContext';
import { WidgetDrillOverlay } from '@/components/pulse/WidgetDrillOverlay';
import { usePulseDrillUrl } from '@/hooks/usePulseDrillUrl';

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
import { ImpactValuationCard } from '@/components/pulse/widgets/impact-valuation/ImpactValuationCard';

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
import { ImpactValuationExpandedSlot } from '@/components/pulse/widgets/impact-valuation/expanded';

import { BoardPackButton } from '@/components/pulse/financial/BoardPackButton';

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
  return (
    <>
      <div className="space-y-6 pb-12">
        <FinancialHeader />
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
      <ImpactValuationExpandedSlot />

      {/* The overlay itself. Mounted once. */}
      <WidgetDrillOverlay />
    </>
  );
}

function FinancialHeader() {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Link
          href="/pulse"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Pulse
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <PoundSterling className="h-6 w-6 text-[#ccff00]" aria-hidden="true" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Financial
          </h1>
          <Badge
            variant="outline"
            className="border-[#ccff00]/40 bg-[#ccff00]/10 text-[10px] font-semibold uppercase tracking-wider text-[#ccff00]"
          >
            Beta
          </Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every figure here is your live operational data multiplied by your
          shadow prices. Click any card for the deep view -- month-by-month
          tables, scenario analysis, compliance calendars and audit-ready
          exports.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <BoardPackButton />
        <Link
          href="/pulse/settings/shadow-prices/"
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-[#ccff00]/40 hover:text-foreground"
        >
          Manage prices
        </Link>
      </div>
    </header>
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
      className="grid auto-rows-[200px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
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

      {/* Impact Valuation (2x1) -- four-capital monetised impact. Moved here
          from /reports/impact-valuation so the full CFO-facing finance view
          lives in one place. */}
      <div className="sm:col-span-2 sm:row-span-1">
        <ImpactValuationCard />
      </div>
    </div>
  );
}
