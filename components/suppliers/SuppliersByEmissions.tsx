'use client';

/**
 * Suppliers ranked by their spend-based emissions, with a one-click route to
 * ask each for real data. Turns "we pay these companies" into "these are the
 * ones whose footprint we should chase". Figures are spend-based estimates
 * until a supplier returns primary data.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Connect Xero and reconcile your suppliers (on the Spend data page) to see which suppliers
          carry the most emissions.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your biggest-impact suppliers</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ranked by spend-based emissions (an estimate). Ask your top suppliers for real data to
          improve it.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 px-3 py-2"
            >
              <Link href={`/suppliers/${r.id}`} className="min-w-0 flex-1 font-medium hover:underline">
                {r.name}
              </Link>
              {r.tier && (
                <Badge variant="outline" className="text-[10px]">
                  {TIER_LABEL[r.tier] ?? r.tier}
                </Badge>
              )}
              <span className="text-sm tabular-nums text-muted-foreground">{gbp(r.annualSpendGbp)}</span>
              <span className="w-24 text-right text-sm font-medium tabular-nums">{co2(r.spendEmissionsKg)} CO2e</span>
              {r.esgSubmitted ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Data in
                </span>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSurveyFor(r)}>
                  <Mail className="mr-1 h-3.5 w-3.5" />
                  Ask for data
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          <Link href="/data/spend-data" className="inline-flex items-center gap-1 hover:text-foreground">
            Reconcile more Xero suppliers <ArrowUpRight className="h-3 w-3" />
          </Link>
        </p>
      </CardContent>

      <SendEsgSurveyDialog
        open={surveyFor !== null}
        onOpenChange={(o) => !o && setSurveyFor(null)}
        defaultSupplierName={surveyFor?.name ?? ''}
        onSent={() => {
          setSurveyFor(null);
          load();
        }}
      />
    </Card>
  );
}
