'use client';

/**
 * The dossier: one product's footprint, as something to read and correct.
 *
 * The compliance wizard asked a founder to author an LCA across ten to
 * fourteen steps, roughly half of them ISO documentation that auto-filled with
 * boilerplate and passed its own validation. A first LCA cost 45 to 55
 * discrete actions, and the honest ones cost more.
 *
 * This page inverts that. The platform states what it already believes, says
 * how much each part can be trusted, and leaves the user with corrections
 * rather than authorship. The wizard survives behind "Open the full record"
 * for the rare expert who wants it.
 *
 * Plum comes from the /products path prefix; no theming code needed here.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Statement,
  BigNumber,
  Eyebrow,
  StateChip,
  PillButton,
  Panel,
  ProvenanceChip,
} from '@/components/studio';
import { PageLoader } from '@/components/ui/page-loader';
import { useOrganization } from '@/lib/organizationContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { DossierSectionPanel } from '@/components/lca/dossier/DossierSectionPanel';
import type { Dossier } from '@/lib/lca/dossier';

interface ActiveRun {
  id: string;
  status: string;
  percent: number;
  phase_message: string | null;
}

interface GateResult {
  allowed: boolean;
  confirmedPct: number;
  threshold: number;
}

export default function DossierPage() {
  const params = useParams();
  const productId = params.id as string;
  const { currentOrganization } = useOrganization();

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [gate, setGate] = useState<GateResult | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const res = await fetch(
        `/api/lca/dossier?product_id=${productId}&organization_id=${currentOrganization.id}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not load this footprint');
      }
      const data = await res.json();
      setDossier(data.dossier);
      setGate(data.gate ?? null);
      setActiveRun(data.activeRun ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this footprint');
    } finally {
      setLoading(false);
    }
  }, [productId, currentOrganization?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // While a calculation is in flight, follow it. The number on screen is stale
  // until it lands, and saying nothing would leave the reader guessing.
  useEffect(() => {
    if (!activeRun) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/lca/recalc/status?runId=${activeRun.id}`);
        if (!res.ok) return;
        const { run } = await res.json();
        if (cancelled) return;
        if (run.status === 'completed' || run.status === 'failed') {
          clearInterval(timer);
          setActiveRun(null);
          setRecalculating(false);
          if (run.status === 'failed') {
            toast.error(run.error || 'The calculation did not finish');
          } else {
            void load();
          }
        } else {
          setActiveRun(run);
        }
      } catch {
        // A dropped poll is not worth surfacing; the next tick will do.
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeRun, load]);

  const handleRecalculate = async () => {
    if (!currentOrganization?.id) return;
    setRecalculating(true);
    try {
      const res = await fetch('/api/lca/recalc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: Number(productId),
          organization_id: currentOrganization.id,
          trigger: 'manual',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Could not start the calculation');
      }
      setActiveRun({ id: body.runId, status: 'queued', percent: 0, phase_message: null });
    } catch (err) {
      setRecalculating(false);
      toast.error(err instanceof Error ? err.message : 'Could not start the calculation');
    }
  };

  if (loading) return <PageLoader message="Opening the dossier" />;

  if (error || !dossier) {
    return (
      <div className="container mx-auto max-w-6xl px-6 py-8">
        <Link
          href={`/products/${productId}`}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim hover:text-foreground"
        >
          &larr; Back to the product
        </Link>
        <p className="mt-6 text-sm text-studio-stale">{error || 'No footprint here yet.'}</p>
      </div>
    );
  }

  const hasNumber = dossier.headlineKgCo2e !== null;

  return (
    <div className="container mx-auto max-w-4xl px-6 py-8">
      <Link
        href={`/products/${productId}`}
        className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim hover:text-foreground"
      >
        &larr; Back to the product
      </Link>

      <div className="mt-6">
        <Statement
          eyebrow="THE CELLAR · DOSSIER"
          headline={
            hasNumber ? (
              <>{dossier.productName}.</>
            ) : (
              <>{dossier.productName} has no footprint yet.</>
            )
          }
        >
          {hasNumber && (
            <BigNumber
              size="display"
              tone="room"
              value={dossier.headlineKgCo2e!.toFixed(3)}
              label="KG CO₂E PER UNIT"
            />
          )}
        </Statement>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ProvenanceChip provenance={dossier.provenance} />
        <StateChip tone="quiet">{dossier.boundaryLabel}</StateChip>
        {dossier.referenceYear && <StateChip tone="quiet">{dossier.referenceYear}</StateChip>}
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
          {dossier.confirmedPct}% confirmed
        </span>
      </div>

      {/* The one saturated block on this surface: what it would take to publish. */}
      {gate && (
        <div className="mt-6">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <Eyebrow tone={gate.allowed ? 'room' : 'dim'}>
                  {gate.allowed ? 'Ready to share' : 'Not ready to share'}
                </Eyebrow>
                <p className="mt-2 max-w-prose text-sm text-studio-dim">
                  {gate.allowed
                    ? 'Enough of this footprint rests on confirmed data to stand behind it in a report.'
                    : `Reports and exports need ${gate.threshold}% of a footprint confirmed. This one is at ${gate.confirmedPct}%.`}
                </p>
              </div>
              <StateChip tone={gate.allowed ? 'good' : 'attention'}>
                {gate.confirmedPct}% / {gate.threshold}%
              </StateChip>
            </div>
          </Panel>
        </div>
      )}

      {activeRun && (
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
          Recalculating · {activeRun.phase_message || 'working'} · {activeRun.percent}%
        </p>
      )}

      <div className="mt-8 space-y-4">
        {dossier.sections.map((section) => (
          <DossierSectionPanel key={section.id} section={section} />
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <PillButton variant="room" onClick={handleRecalculate} disabled={recalculating || !!activeRun}>
          {activeRun || recalculating ? 'Recalculating' : 'Recalculate'}
        </PillButton>
        <PillButton variant="outline" href={`/products/${productId}/compliance-wizard`}>
          Open the full record
        </PillButton>
      </div>

      <p className="mt-6 max-w-prose text-sm text-studio-dim">
        Everything above is what alka<strong>tera</strong> currently believes about this product.
        Correct anything that looks wrong, and the footprint follows.
      </p>
    </div>
  );
}
