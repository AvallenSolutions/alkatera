'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ShieldCheck,
  Leaf,
  Send,
  ArrowRight,
  Users,
  FileDown,
} from 'lucide-react';
import { StateChip } from '@/components/studio';
import type { WorkingTone } from '@/components/studio/theme';
import { SendEsgSurveyDialog } from '@/components/suppliers/SendEsgSurveyDialog';

// Local response shape (mirrors lib/certifications/supplier-esg-evidence; that file
// is server-only, so we don't import it into this client component).
interface EsgCoverage {
  tierBasis: 'tier_1' | 'all';
  denominator: number;
  assessed: number;
  verified: number;
  coveragePct: number;
  completeness: 'complete' | 'partial' | 'missing';
  note: string | null;
  avgLabour: number | null;
  avgEthics: number | null;
  distribution: { leader: number; progressing: number; needs_improvement: number };
  assessedSuppliers: Array<{
    assessmentId: string;
    name: string;
    rating: string | null;
    labour: number | null;
    ethics: number | null;
    verified: boolean;
  }>;
}

interface ClimateCoverage {
  denominator: number;
  engaged: number;
  measuresScope3: number;
  hasScienceTarget: number;
  coveragePct: number;
  completeness: 'complete' | 'partial' | 'missing';
  note: string | null;
}

interface CoverageResponse {
  esg: EsgCoverage;
  climate: ClimateCoverage;
}

const COMPLETENESS_STYLES: Record<
  EsgCoverage['completeness'],
  { label: string; tone: WorkingTone }
> = {
  complete: { label: 'On track', tone: 'good' },
  partial: { label: 'In progress', tone: 'attention' },
  missing: { label: 'Not started', tone: 'quiet' },
};

export function SupplyChainEsgCard() {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const downloadReport = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch('/api/certifications/supplier-esg-report', { method: 'POST' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Could not generate the report');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'supply-chain-esg-due-diligence.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the report');
    } finally {
      setDownloading(false);
    }
  };

  const fetchCoverage = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/certifications/supplier-esg-coverage');
      if (!res.ok) throw new Error('Failed to load supplier ESG coverage');
      setData((await res.json()) as CoverageResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-studio-dim" />
        Supply chain ESG
      </CardTitle>
      <CardDescription>
        How your suppliers&apos; ESG self-assessments support your Human Rights (IT4)
        and Scope 3 (IT5) requirements.
      </CardDescription>
    </CardHeader>
  );

  if (loading) {
    return (
      <Card>
        {header}
        <CardContent>
          <div className="flex items-center gap-2 py-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-dim">
              Loading supplier coverage
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        {header}
        <CardContent>
          <p className="py-4 text-sm text-muted-foreground">
            {error || 'No coverage data available.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { esg, climate } = data;
  const tierWord = esg.tierBasis === 'tier_1' ? 'direct (Tier 1) suppliers' : 'suppliers';
  const coveragePct = Math.round(esg.coveragePct * 100);
  const statusStyle = COMPLETENESS_STYLES[esg.completeness];

  // Empty state: no suppliers at all.
  if (esg.denominator === 0) {
    return (
      <Card>
        {header}
        <CardContent className="space-y-4">
          <div className="py-6 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p className="text-sm">
              Add your suppliers, then send them the ESG survey to build supply-chain
              evidence for B Corp.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => setSurveyOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send ESG survey
            </Button>
            <Button variant="outline" asChild>
              <Link href="/suppliers">
                Manage suppliers
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
        <SendEsgSurveyDialog open={surveyOpen} onOpenChange={setSurveyOpen} onSent={fetchCoverage} />
      </Card>
    );
  }

  // Suppliers to follow up: lowest labour scores first (unassessed-but-required are
  // captured by the coverage gap above).
  const followUp = [...esg.assessedSuppliers]
    .sort((a, b) => (a.labour ?? 101) - (b.labour ?? 101))
    .filter((s) => s.rating === 'needs_improvement' || s.rating === 'progressing')
    .slice(0, 3);

  return (
    <Card>
      {header}
      <CardContent className="space-y-6">
        {/* Coverage headline */}
        <div>
          <div className="flex items-end justify-between">
            <div>
              <p className="font-display text-3xl font-bold tabular-nums">
                {esg.assessed}
                <span className="text-lg font-normal text-muted-foreground"> / {esg.denominator}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {coveragePct}% of {tierWord} assessed
                {esg.verified > 0 ? ` · ${esg.verified} verified` : ''}
              </p>
            </div>
            <StateChip tone={statusStyle.tone}>{statusStyle.label}</StateChip>
          </div>
          <Progress value={coveragePct} className="mt-3 h-2 [&>div]:bg-studio-brick" />
        </div>

        {/* Rating distribution + averages */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {esg.distribution.leader > 0 && (
            <StateChip tone="good">
              {esg.distribution.leader} leader{esg.distribution.leader === 1 ? '' : 's'}
            </StateChip>
          )}
          {esg.distribution.progressing > 0 && (
            <StateChip tone="attention">
              {esg.distribution.progressing} progressing
            </StateChip>
          )}
          {esg.distribution.needs_improvement > 0 && (
            <StateChip tone="stale">
              {esg.distribution.needs_improvement} need improvement
            </StateChip>
          )}
          {esg.avgLabour != null && (
            <span className="text-muted-foreground">Avg labour {esg.avgLabour}</span>
          )}
          {esg.avgEthics != null && (
            <span className="text-muted-foreground">· Avg ethics {esg.avgEthics}</span>
          )}
        </div>

        {/* Value-chain climate (IT5 Scope 3) */}
        <div className="flex items-start gap-2 rounded-[6px] border border-border bg-card p-3">
          <Leaf className="mt-0.5 h-4 w-4 flex-shrink-0 text-studio-dim" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Value-chain climate (Scope 3):</span>{' '}
            {climate.engaged} of {climate.denominator} {tierWord} engage
            {' '}({climate.measuresScope3} measure Scope 3, {climate.hasScienceTarget} hold a
            science-based target). Supplementary to your own emissions and targets.
          </p>
        </div>

        {/* Follow-up suppliers */}
        {followUp.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Suppliers to follow up
            </p>
            {followUp.map((s) => (
              <div key={s.assessmentId} className="flex items-center justify-between text-sm">
                <span className="truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.labour != null ? `labour ${s.labour}` : 'no score'}
                </span>
              </div>
            ))}
          </div>
        )}

        {esg.note && <p className="text-xs text-muted-foreground">{esg.note}</p>}

        <div className="flex flex-wrap gap-3 pt-1">
          <Button onClick={() => setSurveyOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Send ESG survey
          </Button>
          {esg.assessed > 0 && (
            <Button variant="outline" onClick={downloadReport} disabled={downloading}>
              {!downloading && <FileDown className="mr-2 h-4 w-4" />}
              Download due-diligence report
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/suppliers">
              Manage suppliers
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
      <SendEsgSurveyDialog open={surveyOpen} onOpenChange={setSurveyOpen} onSent={fetchCoverage} />
    </Card>
  );
}
