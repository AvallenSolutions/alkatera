import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import type { ProvenanceBlocker } from '@/lib/provenance/gate';

export interface ProvenanceGateState {
  loading: boolean;
  /** True until we know otherwise: never block the UI on a failed check. */
  allowed: boolean;
  confirmedPct: number;
  threshold: number;
  blockers: ProvenanceBlocker[];
  refresh: () => void;
}

/**
 * Client-side read of the confirmed-share gate (lib/provenance/gate.ts) so a
 * surface can say what needs confirming BEFORE the user spends effort on an
 * artefact the server would refuse to produce. The server routes remain the
 * real gate; this is courtesy, so it fails open.
 */
export function useProvenanceGate(
  organizationId: string | null | undefined,
  scope: 'overall' | 'products' | 'utilities' | 'packaging' = 'overall'
): ProvenanceGateState {
  const [state, setState] = useState<Omit<ProvenanceGateState, 'refresh'>>({
    loading: true,
    allowed: true,
    confirmedPct: 100,
    threshold: 80,
    blockers: [],
  });
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/provenance/gate?scope=${scope}`, {
          headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        const gate = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && gate) {
          setState({
            loading: false,
            allowed: gate.allowed !== false,
            confirmedPct: gate.confirmedPct ?? 100,
            threshold: gate.threshold ?? 80,
            blockers: gate.blockers ?? [],
          });
        } else {
          setState(prev => ({ ...prev, loading: false }));
        }
      } catch {
        // Fail open: a broken check must never stand between a user and their work.
        if (!cancelled) setState(prev => ({ ...prev, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, scope, nonce]);

  return { ...state, refresh };
}

/**
 * Pull blockers out of a 403 from a gated route, so a failed action can show
 * the same dialog as a pre-check. Returns null when the response is not a
 * provenance refusal.
 */
export function parseProvenanceRefusal(body: any): ProvenanceBlocker[] | null {
  if (body?.reason !== 'provenance_gate') return null;
  return Array.isArray(body.blockers) ? body.blockers : [];
}
