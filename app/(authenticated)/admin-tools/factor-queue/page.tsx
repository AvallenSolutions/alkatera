'use client';

/**
 * /admin-tools/factor-queue
 *
 * The alkatera-side queue behind "the user never sees a factor picker"
 * (tasks/data-revolution-plan.md, Pillar 2 — see the API routes at
 * app/api/admin/factor-queue for the full mechanics). Every ingredient or
 * packaging row across every organisation that computed with a conservative
 * proxy — or never matched at all — lands here so an alkatera admin can
 * find the real factor and apply it back to the source material.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Search, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useIsAlkateraAdmin } from '@/hooks/usePermissions';
import { useOrganization } from '@/lib/organizationContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Statement } from '@/components/studio/statement';
import { Panel } from '@/components/studio/panel';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface QueueItem {
  productMaterialId: string;
  exceptionId: string | null;
  materialName: string;
  materialType: string;
  packagingCategory: string | null;
  matchedSourceName: string | null;
  efSource: string | null;
  efSourceType: string | null;
  efUncertaintyPercent: number | null;
  carbonIntensity: number | null;
  matchStatus: string | null;
  unit: string | null;
  quantity: number | null;
  productId: string;
  productName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  updatedAt: string;
}

interface FactorOption {
  id: string;
  name: string;
  category: string;
  co2_factor: number;
  source: string;
  reference_unit?: string;
  metadata?: { data_quality_grade?: string };
}

export default function FactorQueuePage() {
  const { isAlkateraAdmin, isLoading: adminLoading } = useIsAlkateraAdmin();
  const { currentOrganization } = useOrganization();

  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch('/api/admin/factor-queue', {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load the factor queue');
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load the factor queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAlkateraAdmin) load();
  }, [isAlkateraAdmin, load]);

  const applyFactor = async (item: QueueItem, factor: FactorOption) => {
    setBusyId(item.productMaterialId);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(`/api/admin/factor-queue/${item.productMaterialId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ action: 'apply', factorId: factor.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to apply the factor');
      toast.success(`Applied "${factor.name}" to ${item.materialName}`);
      setItems((prev) => (prev || []).filter((i) => i.productMaterialId !== item.productMaterialId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply the factor');
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (item: QueueItem) => {
    setBusyId(item.productMaterialId);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(`/api/admin/factor-queue/${item.productMaterialId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ action: 'dismiss' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to dismiss');
      }
      toast.success('Dismissed. It will reappear here unless a real factor is applied.');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss');
    } finally {
      setBusyId(null);
    }
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-studio-dim">
        <AlertCircle className="h-4 w-4" />
        Admin access required.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <Statement eyebrow="THE WIRING · ADMIN" headline="Factor queue." />
        <p className="mt-2 max-w-2xl text-sm text-studio-dim">
          Every ingredient or packaging row across every organisation that is computing with a conservative
          stand-in, or has no factor at all. Users never see this list or a factor picker — find the real
          factor and apply it back to the material below.
        </p>
      </div>

      {loading && (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-studio-stale">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
      {!loading && !error && items && items.length === 0 && (
        <p className="text-sm text-studio-dim">Nothing waiting. Every material has a real factor.</p>
      )}

      {!loading && items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <FactorQueueRow
              key={item.productMaterialId}
              item={item}
              busy={busyId === item.productMaterialId}
              canRecalcHere={currentOrganization?.id === item.organizationId}
              onApply={(factor) => applyFactor(item, factor)}
              onDismiss={() => dismiss(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FactorQueueRow({
  item,
  busy,
  canRecalcHere,
  onApply,
  onDismiss,
}: {
  item: QueueItem;
  busy: boolean;
  canRecalcHere: boolean;
  onApply: (factor: FactorOption) => void;
  onDismiss: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FactorOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const sb = getSupabaseBrowserClient();
        const { data: { session } } = await sb.auth.getSession();
        const params = new URLSearchParams({ search: query.trim(), global_only: 'true', limit: '8' });
        const res = await fetch(`/api/admin/emission-factors?${params.toString()}`, {
          headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        setResults(res.ok ? (data.factors || []) : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{item.materialName}</p>
          <p className="mt-0.5 text-xs text-studio-dim">
            {item.materialType}
            {item.packagingCategory ? ` · ${item.packagingCategory}` : ''}
            {' · '}
            {item.productName || `Product ${item.productId}`}
            {' · '}
            {item.organizationName || 'Unknown organisation'}
          </p>
          <p className="mt-1 text-xs text-studio-dim">
            {item.matchedSourceName ? (
              <>
                Currently: <span className="text-foreground">{item.matchedSourceName}</span>
                {item.efUncertaintyPercent != null ? ` (±${item.efUncertaintyPercent}% uncertainty)` : ''}
              </>
            ) : (
              'Not computing at all.'
            )}
          </p>
        </div>
        <StateChip tone={item.efSourceType === 'proxy' ? 'attention' : 'stale'}>
          {item.efSourceType === 'proxy' ? 'Estimated' : 'Needs review'}
        </StateChip>
      </div>

      {applied ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-studio-good">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Applied.{' '}
          {canRecalcHere
            ? 'Recalculate this product\'s LCA from Admin tools > Recalculate LCAs.'
            : `Switch into ${item.organizationName || 'this organisation'} to recalculate this product's LCA (Admin tools > Recalculate LCAs).`}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-studio-dim" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the factor library…"
              className="pl-8 h-8 text-sm"
              disabled={busy}
            />
          </div>
          {searching && <p className="text-xs text-studio-dim">Searching…</p>}
          {!searching && results.length > 0 && (
            <div className="space-y-1">
              {results.map((factor) => (
                <button
                  key={factor.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setApplied(true);
                    onApply(factor);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-[6px] border border-border bg-card px-3 py-2 text-left text-xs hover:border-room-accent disabled:opacity-50"
                >
                  <span className="truncate">{factor.name}</span>
                  <span className="shrink-0 text-studio-dim">
                    {factor.co2_factor?.toFixed(3)} kg CO₂e/{factor.reference_unit || 'kg'} · {factor.source}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-studio-dim" />}
            <button
              type="button"
              onClick={onDismiss}
              disabled={busy}
              className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-dim hover:text-foreground disabled:opacity-50"
            >
              <XCircle className="h-3 w-3" /> Dismiss
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
