'use client';

/**
 * Pulse Financial -- ISSB / IFRS S2 disclosure preview (F10).
 *
 * Renders a structured preview of the quantitative sections an IFRS S2
 * disclosure requires, populated from live Pulse data. The "Copy CSV" /
 * "Download CSV" buttons let an accountant paste the figures straight into
 * the annual report. Narrative stubs are shown too so the company secretary
 * has a scaffold with their own numbers already plugged in.
 */

import { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Disclosure {
  meta: {
    organizationName: string;
    reportingPeriod: string;
    standard: string;
    generatedAt: string;
  };
  strategy: {
    scenarioAnalysisSummary: string;
    sensitivityGbpPer10PerTonne: number;
    lowScenarioGbp: number;
    midScenarioGbp: number;
    stressScenarioGbp: number;
  };
  metricsAndTargets: {
    scope1and2_tco2e: number;
    scope1and2_yoy_pct: number | null;
    carbonIntensity_tco2e_per_m_gbp_revenue: number | null;
    carbonIntensity_tco2e_per_unit: number | null;
    environmentalLiability_gbp: number;
    regulatoryExposure_gbp: number;
    activeTargets: Array<{
      label: string;
      baseline: string;
      target: string;
      status: string;
    }>;
  };
  narrativeStubs: {
    governance: string;
    riskManagement: string;
    transitionPlan: string;
  };
  csvExport: string;
}

export function IssbDisclosureCard() {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [disclosure, setDisclosure] = useState<Disclosure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/issb-disclosure?organization_id=${currentOrganization.id}`,
        );
        const json = await res.json();
        if (!cancelled && res.ok) setDisclosure(json.disclosure as Disclosure);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const downloadCsv = () => {
    if (!currentOrganization?.id) return;
    window.location.href = `/api/pulse/issb-disclosure?organization_id=${currentOrganization.id}&format=csv`;
  };

  const copyCsv = async () => {
    if (!disclosure) return;
    try {
      await navigator.clipboard.writeText(disclosure.csvExport);
      toast({ title: 'CSV copied to clipboard' });
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Try the Download button instead',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3 w-3 text-[#ccff00]" />
              ISSB / IFRS S2 disclosure
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
              Climate-related financial disclosure, auto-populated
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              UK SDS (Sustainability Disclosure Standards) aligned with IFRS S2.
              Quantitative sections are live; governance and risk narrative
              scaffolds are ready for you to fill in.
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={copyCsv} disabled={!disclosure}>
              Copy CSV
            </Button>
            <Button size="sm" variant="default" onClick={downloadCsv} disabled={!disclosure} className="bg-[#ccff00] text-black hover:bg-[#b8e600]">
              <Download className="mr-1 h-3 w-3" />
              CSV
            </Button>
          </div>
        </header>

        {loading && (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && disclosure && (
          <div className="space-y-4">
            {/* Metrics and targets */}
            <Section title="Metrics and targets (S2 §§ 29-37)">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCell
                  label="Scope 1+2"
                  value={`${disclosure.metricsAndTargets.scope1and2_tco2e.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO₂e`}
                  sub={
                    disclosure.metricsAndTargets.scope1and2_yoy_pct === null
                      ? 'baseline year'
                      : `${disclosure.metricsAndTargets.scope1and2_yoy_pct >= 0 ? '+' : ''}${disclosure.metricsAndTargets.scope1and2_yoy_pct.toFixed(1)}% YoY`
                  }
                />
                <MetricCell
                  label="Intensity / £m rev"
                  value={
                    disclosure.metricsAndTargets.carbonIntensity_tco2e_per_m_gbp_revenue === null
                      ? '—'
                      : `${disclosure.metricsAndTargets.carbonIntensity_tco2e_per_m_gbp_revenue.toFixed(2)} tCO₂e`
                  }
                  sub="per £m revenue"
                />
                <MetricCell
                  label="Liability"
                  value={formatGbp(disclosure.metricsAndTargets.environmentalLiability_gbp)}
                  sub="shadow-priced"
                />
                <MetricCell
                  label="Regulatory"
                  value={formatGbp(disclosure.metricsAndTargets.regulatoryExposure_gbp)}
                  sub="UK ETS + CBAM + PPT + EPR"
                />
              </dl>
            </Section>

            {/* Strategy scenario analysis */}
            <Section title="Strategy -- scenario analysis (S2 §§ 22-27)">
              <p className="text-xs text-muted-foreground">
                {disclosure.strategy.scenarioAnalysisSummary}
              </p>
            </Section>

            {/* Targets */}
            {disclosure.metricsAndTargets.activeTargets.length > 0 && (
              <Section title="Active targets">
                <ul className="space-y-1.5 text-xs">
                  {disclosure.metricsAndTargets.activeTargets.map((t, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 rounded-md border border-border/40 bg-card/30 p-2">
                      <span className="truncate text-foreground">{t.label}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                          t.status === 'on_track' && 'bg-emerald-500/15 text-emerald-500',
                          t.status === 'at_risk' && 'bg-amber-500/15 text-amber-500',
                          t.status === 'off_track' && 'bg-red-500/15 text-red-500',
                        )}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Narrative stubs */}
            <Section title="Narrative scaffolds (edit before publishing)">
              <div className="space-y-3 text-xs">
                <NarrativeStub title="Governance (S2 §§ 6-7)" body={disclosure.narrativeStubs.governance} />
                <NarrativeStub title="Risk management (S2 §§ 25-28)" body={disclosure.narrativeStubs.riskManagement} />
                <NarrativeStub title="Transition plan (S2 §§ 14-21)" body={disclosure.narrativeStubs.transitionPlan} />
              </div>
            </Section>

            <p className="text-[10px] text-muted-foreground/70">
              Generated {new Date(disclosure.meta.generatedAt).toLocaleString('en-GB')} for{' '}
              {disclosure.meta.organizationName} ({disclosure.meta.reportingPeriod}).
              Auditor-reviewable numbers; placeholders in [BRACKETS] need manual
              completion. IFRS S2 references are indicative.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-card/30 p-2.5">
      <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function NarrativeStub({ title, body }: { title: string; body: string }) {
  return (
    <details className="rounded-md border border-border/40 bg-card/30 p-2.5">
      <summary className="cursor-pointer text-xs font-medium text-foreground">{title}</summary>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{body}</p>
    </details>
  );
}

function formatGbp(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100_000) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
  return v.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}
