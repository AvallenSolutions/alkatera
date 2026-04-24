'use client';

/**
 * Pulse -- Shadow price settings.
 *
 * One row per supported metric. For each: show the resolved price (org or
 * global), let owners/admins override the rate + source, and a "revert"
 * action that deletes the org row so the global default takes over again.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, PoundSterling, RotateCcw, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/lib/organizationContext';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import type { ShadowPrice } from '@/lib/pulse/shadow-prices';

interface OrgOverride {
  id: string;
  metric_key: string;
  currency: string;
  price_per_unit: number;
  unit: string;
  native_unit_multiplier: number;
  source: string | null;
  effective_from: string;
}

interface ApiPayload {
  resolved: Record<string, ShadowPrice>;
  org_overrides: OrgOverride[];
  supported_metrics: MetricKey[];
}

export default function ShadowPricesPage() {
  const { currentOrganization, userRole } = useOrganization();
  const { toast } = useToast();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const canEdit = userRole === 'owner' || userRole === 'admin';

  async function load() {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pulse/shadow-prices?organization_id=${currentOrganization.id}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Load failed');
      setData(json);
    } catch (err: any) {
      toast({ title: 'Could not load', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.supported_metrics.map(metric_key => {
      const resolved = data.resolved[metric_key];
      const override = data.org_overrides.find(o => o.metric_key === metric_key);
      return { metric_key, resolved, override };
    });
  }, [data]);

  async function savePrice(row: {
    metric_key: MetricKey;
    price_per_unit: number;
    currency: string;
    unit: string;
    native_unit_multiplier: number;
    source: string;
  }) {
    setSavingKey(row.metric_key);
    try {
      const res = await fetch('/api/pulse/shadow-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...row,
          effective_from: new Date().toISOString().slice(0, 10),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      toast({ title: 'Price saved', description: `${METRIC_DEFINITIONS[row.metric_key].label} updated.` });
      await load();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSavingKey(null);
    }
  }

  async function revert(overrideId: string, metric_key: MetricKey) {
    setSavingKey(metric_key);
    try {
      const res = await fetch(`/api/pulse/shadow-prices?id=${overrideId}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Revert failed');
      }
      toast({ title: 'Reverted to default' });
      await load();
    } catch (err: any) {
      toast({ title: 'Revert failed', description: err.message, variant: 'destructive' });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/pulse">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Pulse
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <PoundSterling className="h-6 w-6 text-[#ccff00]" />
            Shadow prices
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Attach a financial value to each sustainability metric so Pulse can
            show a CFO-legible number alongside every KPI. Defaults start from
            UK market averages (UK ETS carbon price, Ofwat water tariff). Override
            any rate to match your cost of capital or internal carbon price.
          </p>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(({ metric_key, resolved, override }) => (
            <PriceRow
              key={metric_key}
              metricKey={metric_key}
              resolved={resolved}
              override={override}
              canEdit={canEdit}
              saving={savingKey === metric_key}
              onSave={savePrice}
              onRevert={revert}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PriceRow({
  metricKey,
  resolved,
  override,
  canEdit,
  saving,
  onSave,
  onRevert,
}: {
  metricKey: MetricKey;
  resolved: ShadowPrice | undefined;
  override: OrgOverride | undefined;
  canEdit: boolean;
  saving: boolean;
  onSave: (row: {
    metric_key: MetricKey;
    price_per_unit: number;
    currency: string;
    unit: string;
    native_unit_multiplier: number;
    source: string;
  }) => void;
  onRevert: (id: string, metric_key: MetricKey) => void;
}) {
  const def = METRIC_DEFINITIONS[metricKey];
  const effective = override ?? resolved;
  const [price, setPrice] = useState<string>(String(effective?.price_per_unit ?? ''));
  const [source, setSource] = useState<string>(effective?.source ?? '');

  // Whenever the server-side view refreshes (e.g. after save), sync local state.
  useEffect(() => {
    setPrice(String(effective?.price_per_unit ?? ''));
    setSource(effective?.source ?? '');
  }, [effective?.price_per_unit, effective?.source]);

  if (!resolved) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          No price configured for <strong>{def.label}</strong> and no global default is set.
          Ship a migration to add one, or contact support.
        </CardContent>
      </Card>
    );
  }

  const isOverridden = Boolean(override);
  const numericPrice = Number(price);
  const dirty =
    numericPrice !== effective?.price_per_unit ||
    source !== (effective?.source ?? '');

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {def.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Values are stored in {def.unit}; price is quoted in {resolved.unit}.
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {isOverridden ? (
                <span className="inline-flex items-center rounded-full border border-[#ccff00]/40 bg-[#ccff00]/10 px-2 py-0.5 text-[#ccff00]">
                  Org override
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-muted-foreground/80">
                  Using global default
                </span>
              )}
            </p>
          </div>
          <div>
            <Label htmlFor={`price-${metricKey}`} className="text-xs">
              Price per {resolved.unit} ({resolved.currency})
            </Label>
            <Input
              id={`price-${metricKey}`}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={price}
              onChange={e => setPrice(e.target.value)}
              disabled={!canEdit || saving}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`source-${metricKey}`} className="text-xs">
              Source / provenance
            </Label>
            <Input
              id={`source-${metricKey}`}
              type="text"
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="e.g. UK ETS April 2026"
              disabled={!canEdit || saving}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end md:self-center">
          {isOverridden && override && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRevert(override.id, metricKey)}
              disabled={!canEdit || saving}
              title="Revert to the global default"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Revert
            </Button>
          )}
          <Button
            size="sm"
            onClick={() =>
              onSave({
                metric_key: metricKey,
                price_per_unit: numericPrice,
                currency: resolved.currency,
                unit: resolved.unit,
                native_unit_multiplier: resolved.native_unit_multiplier,
                source,
              })
            }
            disabled={!canEdit || saving || !dirty || !Number.isFinite(numericPrice)}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
