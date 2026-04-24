import type { Metadata } from 'next';
import { PulseFinancialShell } from '@/components/pulse/financial/FinancialGrid';

export const metadata: Metadata = {
  title: 'Financial -- Pulse -- alkatera',
  description:
    "Your environmental footprint translated into £. The CFO view of your sustainability data.",
};

/**
 * Pulse Financial -- CFO view.
 *
 * Uniform compact-card grid matching the main /pulse surface. Click any card
 * for the drill-in overlay with rich data. Board-pack PDF + ISSB CSV export
 * are in the page header; shadow-price configuration sits one click away.
 */
export default function PulseFinancialPage() {
  return <PulseFinancialShell />;
}
