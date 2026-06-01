'use client';

/**
 * Pulse -- shared widget renderer map.
 *
 * Single source of truth mapping a WidgetId to the compact card that renders
 * it. Used by both the draggable Advanced grid (PulseGrid) and the curated,
 * read-only persona grids (PulsePersonaGrid).
 *
 * Includes the financial-only cards (cost-intensity, top-cost-drivers,
 * issb-disclosure, impact-valuation) so persona presets that surface them
 * (e.g. the CFO view) can render directly. Their drill overlays are mounted at
 * shell level.
 */

import type { ReactNode } from 'react';
import type { WidgetId } from '@/lib/pulse/widget-registry';

import { FinancialFootprintCard } from '@/components/pulse/widgets/financial-footprint/FinancialFootprintCard';
import { ScenarioSensitivityCard } from '@/components/pulse/widgets/scenario-sensitivity/ScenarioSensitivityCard';
import { MaccCard } from '@/components/pulse/widgets/macc/MaccCard';
import { CarbonBudgetsCard } from '@/components/pulse/widgets/carbon-budgets/CarbonBudgetsCard';
import { RegulatoryExposureCard } from '@/components/pulse/widgets/regulatory-exposure/RegulatoryExposureCard';
import { TargetTrajectoryCard } from '@/components/pulse/widgets/target-trajectory/TargetTrajectoryCard';
import { FacilityImpactCard } from '@/components/pulse/widgets/facility-impact/FacilityImpactCard';
import { AlertsInboxCard } from '@/components/pulse/widgets/alerts-inbox/AlertsInboxCard';
import { GridCarbonCard } from '@/components/pulse/widgets/grid-carbon/GridCarbonCard';
import { PeerBenchmarkCard } from '@/components/pulse/widgets/peer-benchmark/PeerBenchmarkCard';
import { CsrdGapsCard } from '@/components/pulse/widgets/csrd-gaps/CsrdGapsCard';
import { InsightCardCompact } from '@/components/pulse/widgets/insight-card/InsightCardCompact';
import { WhatIfCard } from '@/components/pulse/widgets/what-if/WhatIfCard';
import { HarvestSeasonsCard } from '@/components/pulse/widgets/harvest-seasons/HarvestSeasonsCard';
import { ProductEnvCostCard } from '@/components/pulse/widgets/product-env-cost/ProductEnvCostCard';
import { SupplierHotspotsCard } from '@/components/pulse/widgets/supplier-hotspots/SupplierHotspotsCard';
import { LiveActivityCard } from '@/components/pulse/widgets/live-activity/LiveActivityCard';
// Financial-only compact cards.
import { CostIntensityCompact } from '@/components/pulse/widgets/cost-intensity/CostIntensityCompact';
import { TopCostDriversCard } from '@/components/pulse/widgets/top-cost-drivers/TopCostDriversCard';
import { IssbDisclosureCompact } from '@/components/pulse/widgets/issb-disclosure/IssbDisclosureCompact';
import { ImpactValuationCard } from '@/components/pulse/widgets/impact-valuation/ImpactValuationCard';

/**
 * Renderers for each widget id. `live-metrics-strip` and `ask-rosa` are
 * rendered by PulseShell as full-width bands and intentionally absent here.
 */
export const WIDGET_RENDERERS: Partial<Record<WidgetId, () => ReactNode>> = {
  'financial-footprint': () => <FinancialFootprintCard />,
  'scenario-sensitivity': () => <ScenarioSensitivityCard />,
  macc: () => <MaccCard />,
  'carbon-budgets': () => <CarbonBudgetsCard />,
  'regulatory-exposure': () => <RegulatoryExposureCard />,
  'target-trajectory': () => <TargetTrajectoryCard />,
  'facility-impact': () => <FacilityImpactCard />,
  'insight-card': () => <InsightCardCompact />,
  'alerts-inbox': () => <AlertsInboxCard />,
  'grid-carbon': () => <GridCarbonCard />,
  'peer-benchmark': () => <PeerBenchmarkCard />,
  'live-activity': () => <LiveActivityCard />,
  'csrd-gaps': () => <CsrdGapsCard />,
  'supplier-hotspots': () => <SupplierHotspotsCard />,
  'what-if': () => <WhatIfCard />,
  'harvest-seasons': () => <HarvestSeasonsCard />,
  'product-env-cost': () => <ProductEnvCostCard />,
  // Financial-only cards (surfaced in the CFO persona).
  'cost-intensity': () => <CostIntensityCompact />,
  'top-cost-drivers': () => <TopCostDriversCard />,
  'issb-disclosure': () => <IssbDisclosureCompact />,
  'impact-valuation': () => <ImpactValuationCard />,
};
