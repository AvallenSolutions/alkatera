'use client';

/**
 * Suppliers ranked by their spend-based emissions, with a one-click route to
 * ask each for real data. Turns "we pay these companies" into "these are the
 * ones whose footprint we should chase". Figures are spend-based estimates
 * until a supplier returns primary data.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { SendEsgSurveyDialog } from '@/components/suppliers/SendEsgSurveyDialog';

interface Row {
  id: string;
  name: string;
  annualSpendGbp: number;
  spendEmissionsKg: number;
  tier: string | null;
  esgSubmitted: boolean;
}

const TIER_LABEL: Record<string, string> = { tier_1: 'Direct', tier_2: 'Tier 2', tier_3: 'Tier 3' };

function gbp(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
function co2(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`;
  return `${Math.round(kg).toLocaleString('en-GB')} kg`;
}

export function SuppliersByEmissions({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [surveyFor, setSurveyFor] = useState<Row | null>(null);

  async function load() {
    const res = await fetch(`/api/suppliers/by-emissions?organization_id=${organizationId}`);
    const body = await res.json().catch(() => ({}));
    setRows(res.ok ? body.suppliers ?? [] : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (rows === null) return null;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect Xero and reconcile your suppliers on the spend page to rank them by emissions.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Ranked by spend-based emissions (an estimate). Ask your top suppliers for real data to
        improve it.
      </p>
      <ul className="divide-y divide-studio-hairline border-t border-studio-hairline">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <Link
              href={`/suppliers/${r.id}`}
              className="min-w-0 flex-1 font-display text-sm font-semibold text-foreground hover:text-room-accent"
            >
              {r.name}
            </Link>
            {r.tier && <StateChip tone="quiet">{TIER_LABEL[r.tier] ?? r.tier}</StateChip>}
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {gbp(r.annualSpendGbp)}
            </span>
            <span className="w-24 text-right font-display text-sm font-bold tabular-nums text-foreground">
              {co2(r.spendEmissionsKg)}
              <span className="ml-1 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">
                CO2e
              </span>
            </span>
            {r.esgSubmitted ? (
              <StateChip tone="good">DATA IN</StateChip>
            ) : (
              <PillButton variant="outline" size="sm" onClick={() => setSurveyFor(r)}>
                Ask for data
              </PillButton>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        <Link href="/data/spend-data" className="inline-flex items-center gap-1 hover:text-foreground">
          Reconcile more Xero suppliers <ArrowUpRight className="h-3 w-3" />
        </Link>
      </p>

      <SendEsgSurveyDialog
        open={surveyFor !== null}
        onOpenChange={(o) => !o && setSurveyFor(null)}
        defaultSupplierName={surveyFor?.name ?? ''}
        onSent={() => {
          setSurveyFor(null);
          load();
        }}
      />
    </div>
  );
}
