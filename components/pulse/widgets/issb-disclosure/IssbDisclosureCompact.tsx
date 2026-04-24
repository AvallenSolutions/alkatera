'use client';

/**
 * Pulse -- ISSB / IFRS S2 disclosure, compact card.
 *
 * Headline: readiness percentage (share of quantitative sections with data).
 * Supporting: ring indicator + small "draft" vs "complete" pill.
 */

import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface Disclosure {
  metricsAndTargets: {
    scope1and2_tco2e: number;
    scope1and2_yoy_pct: number | null;
    carbonIntensity_tco2e_per_m_gbp_revenue: number | null;
    carbonIntensity_tco2e_per_unit: number | null;
    environmentalLiability_gbp: number;
    regulatoryExposure_gbp: number;
    activeTargets: Array<{ label: string }>;
  };
}

interface ApiPayload {
  ok: boolean;
  disclosure: Disclosure;
}

export function IssbDisclosureCompact() {
  const { currentOrganization } = useOrganization();
  const { openDrill } = useWidgetDrill();
  const [data, setData] = useState<ApiPayload | null>(null);
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
        if (!cancelled && res.ok) setData(json as ApiPayload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  /**
   * Readiness = share of quantitative points with data. Seven checks:
   *   - Scope 1+2 emissions
   *   - YoY change (needs prior-period data)
   *   - Intensity per £m revenue
   *   - Intensity per unit
   *   - Environmental liability (always available once emissions are > 0)
   *   - Regulatory exposure (available once configured)
   *   - At least one active target
   */
  const readinessPct = useMemo(() => {
    const mt = data?.disclosure?.metricsAndTargets;
    if (!mt) return 0;
    const checks = [
      Number(mt.scope1and2_tco2e ?? 0) > 0,
      mt.scope1and2_yoy_pct !== null && mt.scope1and2_yoy_pct !== undefined,
      mt.carbonIntensity_tco2e_per_m_gbp_revenue !== null &&
        mt.carbonIntensity_tco2e_per_m_gbp_revenue !== undefined,
      mt.carbonIntensity_tco2e_per_unit !== null &&
        mt.carbonIntensity_tco2e_per_unit !== undefined,
      Number(mt.environmentalLiability_gbp ?? 0) > 0,
      Number(mt.regulatoryExposure_gbp ?? 0) > 0,
      Array.isArray(mt.activeTargets) && mt.activeTargets.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [data]);

  const status =
    readinessPct >= 85
      ? ({ tone: 'good' as const, label: 'Ready' })
      : readinessPct >= 50
        ? ({ tone: 'warn' as const, label: 'Draft' })
        : ({ tone: 'bad' as const, label: 'Early' });

  return (
    <PulseCard
      icon={FileText}
      label="ISSB readiness"
      headline={data ? `${readinessPct}%` : '—'}
      sub="IFRS S2 quantitative cover"
      status={data ? status : null}
      footprint="1x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'issb-disclosure' })}
    >
      {data ? <ReadinessRing pct={readinessPct} /> : null}
    </PulseCard>
  );
}

function ReadinessRing({ pct }: { pct: number }) {
  const colour = pct >= 85 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const size = 56;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  return (
    <div className="flex h-full items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colour}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </div>
  );
}
