'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Target as TargetIcon } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { TargetForm, TARGET_PRESETS } from '@/components/pulse/targets/TargetForm';
import { TargetCard } from '@/components/pulse/targets/TargetCard';
import { InitiativeBoard } from '@/components/pulse/targets/InitiativeBoard';
import { InitiativeDialog } from '@/components/pulse/targets/InitiativeDialog';
import { BcorpClimatePanel } from '@/components/pulse/targets/BcorpClimatePanel';
import { initiativeTargetIds, type Initiative, type Target } from '@/components/pulse/targets/types';

/**
 * Targets & Actions hub: set sustainability targets, build the action plan
 * behind them, and see how both feed B Corp climate evidence.
 */
function TargetsActionsHub() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [targets, setTargets] = useState<Target[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [snapshotsByMetric, setSnapshotsByMetric] = useState<Record<string, { date: string; value: number }[]>>({});
  const [loading, setLoading] = useState(true);

  // Initiative dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const [dialogTargetIds, setDialogTargetIds] = useState<string[]>([]);
  const [dialogLeverId, setDialogLeverId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrganization?.id) return;
    const orgId = currentOrganization.id;

    const [targetsRes, initiativesRes] = await Promise.all([
      fetch(`/api/pulse/targets?organization_id=${orgId}`),
      fetch(`/api/pulse/initiatives?organization_id=${orgId}`),
    ]);
    const targetsBody = await targetsRes.json().catch(() => ({}));
    const initiativesBody = await initiativesRes.json().catch(() => ({}));
    const ts: Target[] = targetsBody.targets ?? [];
    setTargets(ts);
    setInitiatives(initiativesBody.initiatives ?? []);
    setViewerRole(initiativesBody.viewerRole ?? null);

    // Snapshot history for trajectory pills (same source as the Pulse widget).
    const metricKeys = Array.from(new Set(ts.map((t) => t.metric_key)));
    if (metricKeys.length > 0) {
      const { data: snapshotRows } = await supabase
        .from('metric_snapshots')
        .select('metric_key, snapshot_date, value')
        .eq('organization_id', orgId)
        .in('metric_key', metricKeys)
        .order('snapshot_date', { ascending: true });
      const grouped: Record<string, { date: string; value: number }[]> = {};
      for (const row of snapshotRows ?? []) {
        const key = row.metric_key as string;
        (grouped[key] ??= []).push({ date: row.snapshot_date as string, value: Number(row.value) });
      }
      setSnapshotsByMetric(grouped);
    } else {
      setSnapshotsByMetric({});
    }
    setLoading(false);
  }, [currentOrganization?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Deep link from the MACC chart: /pulse/targets?lever=<id>#actions
  useEffect(() => {
    const lever = searchParams.get('lever');
    if (lever && !loading) {
      setEditingInitiative(null);
      setDialogTargetIds([]);
      setDialogLeverId(lever);
      setDialogOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  function openNewInitiative(targetId?: string) {
    setEditingInitiative(null);
    setDialogTargetIds(targetId ? [targetId] : []);
    setDialogLeverId(null);
    setDialogOpen(true);
  }

  function openEditInitiative(initiative: Initiative) {
    setEditingInitiative(initiative);
    setDialogTargetIds([]);
    setDialogLeverId(null);
    setDialogOpen(true);
  }

  async function deleteTarget(id: string) {
    await fetch(`/api/pulse/targets?id=${id}`, { method: 'DELETE' });
    await refresh();
  }

  const initiativesByTarget = useMemo(() => {
    const map = new Map<string, Initiative[]>();
    for (const i of initiatives) {
      for (const tid of initiativeTargetIds(i)) {
        (map.get(tid) ?? map.set(tid, []).get(tid)!).push(i);
      }
    }
    return map;
  }, [initiatives]);

  const rosaSlice = useMemo(
    () => ({
      id: 'sustainability-targets',
      label: 'Targets and action plan',
      priority: 8,
      data: {
        targetCount: targets.length,
        targets: targets.map((t) => ({
          id: t.id,
          metricKey: t.metric_key,
          baselineValue: t.baseline_value,
          baselineDate: t.baseline_date,
          targetValue: t.target_value,
          targetDate: t.target_date,
        })),
        initiativeCount: initiatives.length,
        initiativesByStatus: initiatives.reduce<Record<string, number>>((acc, i) => {
          acc[i.status] = (acc[i.status] ?? 0) + 1;
          return acc;
        }, {}),
        availablePresets: TARGET_PRESETS.map((p) => p.label),
      },
    }),
    [targets, initiatives],
  );
  useRosaPageContext(rosaSlice);

  if (!currentOrganization?.id) return null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/pulse"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Pulse
        </Link>
        <div className="flex items-center gap-2">
          <TargetIcon className="h-6 w-6 text-[#ccff00]" />
          <h1 className="text-3xl font-semibold tracking-tight">Targets &amp; Actions</h1>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          Set sustainability commitments and build the plan behind them. Pulse projects your
          trajectory at the current pace; approved actions count towards your B Corp evidence.
        </p>
      </header>

      <BcorpClimatePanel />

      <TargetForm organizationId={currentOrganization.id} onCreated={refresh} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active targets
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : targets.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No active targets yet.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {targets.map((t) => (
              <li key={t.id}>
                <TargetCard
                  target={t}
                  history={snapshotsByMetric[t.metric_key] ?? []}
                  initiatives={initiativesByTarget.get(t.id) ?? []}
                  onDelete={deleteTarget}
                  onAddInitiative={(targetId) => openNewInitiative(targetId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="actions" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Action plan
          </h2>
          <Button size="sm" onClick={() => openNewInitiative()}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New action
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <InitiativeBoard
            initiatives={initiatives}
            viewerRole={viewerRole}
            viewerUserId={user?.id ?? null}
            onEdit={openEditInitiative}
            onChanged={refresh}
          />
        )}
      </section>

      <InitiativeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        organizationId={currentOrganization.id}
        targets={targets}
        initiative={editingInitiative}
        initialTargetIds={dialogTargetIds}
        initialLeverId={dialogLeverId}
        onSaved={refresh}
      />
    </div>
  );
}

export default function TargetsPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <TargetsActionsHub />
    </Suspense>
  );
}
