'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RequirementPill {
  code: string;
  name: string;
  status: string;
}

interface PlatformHealthModule {
  module: string;
  completeness: string;
  note: string | null;
}

const CLIMATE_CODES = ['IT5-Y0-002', 'IT5-Y3-002', 'IT5-Y5-001'];

// Typographic state chips: working tones from components/studio/theme.ts.
const STATUS_STYLES: Record<string, string> = {
  passed: 'text-studio-good',
  in_progress: 'text-studio-attention',
  not_started: 'text-studio-dim',
  future: 'text-studio-dim',
};

const STATUS_LABELS: Record<string, string> = {
  passed: 'Evidenced',
  in_progress: 'In progress',
  not_started: 'Not started',
  future: 'Later year',
};

/**
 * Shows how the targets and action plan currently feed the B Corp climate
 * requirements, with a link through to the certification tool. Quiet when
 * the organisation has no B Corp certification in progress.
 */
export function BcorpClimatePanel() {
  const [pills, setPills] = useState<RequirementPill[] | null>(null);
  const [healthNote, setHealthNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/certifications/readiness')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body?.hasCertification) return;
        const statuses: RequirementPill[] = (body.requirementStatuses ?? [])
          .filter((rs: any) => CLIMATE_CODES.includes(rs.code))
          .map((rs: any) => ({ code: rs.code, name: rs.name, status: rs.status }));
        if (statuses.length > 0) setPills(statuses);
        const targetsModule = (body.platformHealth ?? []).find(
          (m: PlatformHealthModule) => m.module === 'targets',
        );
        if (targetsModule?.note) setHealthNote(targetsModule.note);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!pills) return null;

  return (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-studio-forest" />
            <h3 className="text-sm font-semibold">Your action plan counts towards B Corp</h3>
          </div>
          <Link
            href="/certifications/bcorp_2026"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Open certification
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <div key={p.code} className="flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1">
              <span className="text-xs">{p.name}</span>
              <span className={cn('font-mono text-[10px] font-bold uppercase tracking-[0.18em]', STATUS_STYLES[p.status] ?? STATUS_STYLES.not_started)}>
                {STATUS_LABELS[p.status] ?? p.status}
              </span>
            </div>
          ))}
        </div>

        {healthNote && <p className="text-xs text-muted-foreground">{healthNote}</p>}
      </CardContent>
    </Card>
  );
}
