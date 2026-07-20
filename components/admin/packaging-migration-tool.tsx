'use client';

/**
 * Admin tool: map legacy packaging rows onto parametric material classes.
 *
 * Phase 3 of the parametric packaging factor model. Legacy packaging rows
 * (no packaging_material_class) still resolve via name matching; this tool
 * proposes a class per row (exact from container_material, else inferred from
 * the material/factor name), shows a dry-run factor diff (current cached EF
 * vs the parametric EF at the row's recycled content), and applies the
 * mapping WITHOUT recalculating anything. Products go stale naturally via
 * the calculation fingerprint and are recalculated when their owner (or the
 * batch recalculate tool) next runs them.
 */

import { useMemo, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Search, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { useIsAlkateraAdmin } from '@/hooks/usePermissions';
import { getMaterialFactorKey } from '@/lib/end-of-life-factors';
import {
  MATERIAL_CLASS_LIST,
  MATERIAL_CLASSES,
  getMaterialClass,
  inferMaterialClassFromLegacyRow,
  resolveVariant,
  type PackagingMaterialClass,
} from '@/lib/constants/packaging-material-classes';
import {
  fetchActivePackagingEndpoints,
  endpointLookupKey,
  type PackagingFactorEndpoint,
} from '@/lib/calculations/packaging-factor';

type LegacyRow = {
  id: string;
  material_name: string;
  matched_source_name: string | null;
  container_material: string | null;
  packaging_category: string | null;
  recycled_content_percentage: number | null;
  cached_co2_factor: number | null;
  productName: string;
  proposedClass: PackagingMaterialClass | null;
  proposedVariant: string;
  confidence: 'exact' | 'inferred' | 'none';
  checked: boolean;
};

const CONFIDENCE_LABELS: Record<LegacyRow['confidence'], { label: string; className: string }> = {
  exact: { label: 'Exact', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  inferred: { label: 'Inferred', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  none: { label: 'Unmapped', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
};

export function PackagingMigrationTool() {
  const { isAlkateraAdmin } = useIsAlkateraAdmin();
  const { currentOrganization, userRole } = useOrganization();

  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<LegacyRow[] | null>(null);
  const [endpoints, setEndpoints] = useState<Map<string, PackagingFactorEndpoint> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  const canRun =
    !!currentOrganization &&
    (isAlkateraAdmin || ['owner', 'admin', 'advisor'].includes((userRole ?? '').toLowerCase()));

  const buckets = useMemo(() => {
    if (!rows) return null;
    return {
      exact: rows.filter((r) => r.confidence === 'exact'),
      inferred: rows.filter((r) => r.confidence === 'inferred'),
      none: rows.filter((r) => r.confidence === 'none'),
    };
  }, [rows]);

  async function load() {
    if (!currentOrganization?.id) return;
    setBusy(true);
    setError(null);
    setAppliedCount(null);
    try {
      const sb = getSupabaseBrowserClient();
      const { data, error: qErr } = await sb
        .from('product_materials')
        .select('id, material_name, matched_source_name, container_material, packaging_category, recycled_content_percentage, cached_co2_factor, products!inner(id, name, organization_id)')
        .eq('products.organization_id', currentOrganization.id)
        .eq('material_type', 'packaging')
        .is('packaging_material_class', null)
        .order('material_name');
      if (qErr) throw new Error(qErr.message);

      const mapped: LegacyRow[] = (data ?? []).map((item: any) => {
        const inference = inferMaterialClassFromLegacyRow(item, getMaterialFactorKey);
        return {
          id: item.id,
          material_name: item.material_name,
          matched_source_name: item.matched_source_name,
          container_material: item.container_material,
          packaging_category: item.packaging_category,
          recycled_content_percentage: item.recycled_content_percentage,
          cached_co2_factor: item.cached_co2_factor,
          productName: item.products?.name ?? 'Unknown product',
          proposedClass: inference.class,
          proposedVariant: inference.variant,
          confidence: inference.confidence,
          checked: inference.confidence !== 'none',
        };
      });
      setRows(mapped);

      // One fetch covers every parametric class + variant (small library).
      const wanted = MATERIAL_CLASS_LIST.filter((c) => c.kind === 'parametric').flatMap((c) =>
        c.variants.map((v) => ({ materialClass: c.key, variant: v.key, region: 'EU-27' })),
      );
      setEndpoints(await fetchActivePackagingEndpoints(sb, wanted));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load packaging rows');
    } finally {
      setBusy(false);
    }
  }

  function parametricEf(row: LegacyRow): number | null {
    if (!row.proposedClass || !endpoints) return null;
    const def = getMaterialClass(row.proposedClass);
    if (!def || def.kind !== 'parametric') return null;
    const variant = resolveVariant(row.proposedClass, row.proposedVariant);
    const endpoint = endpoints.get(endpointLookupKey(row.proposedClass, variant, 'EU-27'));
    if (!endpoint) return null;
    const r = Math.max(0, Math.min(100, Number(row.recycled_content_percentage ?? 0))) / 100;
    return endpoint.virgin_climate - r * (endpoint.virgin_climate - endpoint.recycled_climate);
  }

  function updateRow(id: string, updates: Partial<LegacyRow>) {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...updates } : r)) ?? null);
  }

  async function applyMapping() {
    if (!rows) return;
    const toApply = rows.filter((r) => r.checked && r.proposedClass);
    if (toApply.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const sb = getSupabaseBrowserClient();
      let applied = 0;
      for (const row of toApply) {
        const { error: upErr } = await sb
          .from('product_materials')
          .update({
            packaging_material_class: row.proposedClass,
            packaging_material_variant: resolveVariant(row.proposedClass, row.proposedVariant),
          })
          .eq('id', row.id);
        if (upErr) throw new Error(`${row.material_name}: ${upErr.message}`);
        applied += 1;
      }
      setAppliedCount(applied);
      // Refresh: applied rows drop out of the legacy list.
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to apply mapping');
    } finally {
      setApplying(false);
    }
  }

  if (!canRun) {
    return (
      <p className="text-xs text-muted-foreground">
        {currentOrganization
          ? 'You need owner, admin, or advisor access to this organization to run the packaging mapping.'
          : 'Select an organization first, then return to this page.'}
      </p>
    );
  }

  const renderRow = (row: LegacyRow) => {
    const currentEf = row.cached_co2_factor;
    const newEf = parametricEf(row);
    const classDef = getMaterialClass(row.proposedClass);
    return (
      <tr key={row.id} className="border-b border-border/50 text-sm">
        <td className="py-2 pr-2 align-top">
          <Checkbox
            checked={row.checked}
            disabled={!row.proposedClass}
            onCheckedChange={(v) => updateRow(row.id, { checked: v === true })}
          />
        </td>
        <td className="py-2 pr-3 align-top">
          <div className="font-medium">{row.material_name}</div>
          <div className="text-xs text-muted-foreground">{row.productName}</div>
          {row.matched_source_name && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Matched: {row.matched_source_name}
            </div>
          )}
        </td>
        <td className="py-2 pr-3 align-top">
          <Select
            value={row.proposedClass ?? ''}
            onValueChange={(value) =>
              updateRow(row.id, {
                proposedClass: value as PackagingMaterialClass,
                proposedVariant: MATERIAL_CLASSES[value as PackagingMaterialClass].defaultVariant,
                checked: true,
              })
            }
          >
            <SelectTrigger className="h-8 w-[190px]">
              <SelectValue placeholder="Choose class..." />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_CLASS_LIST.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {classDef && classDef.variants.length > 1 && (
            <Select
              value={resolveVariant(row.proposedClass, row.proposedVariant)}
              onValueChange={(value) => updateRow(row.id, { proposedVariant: value })}
            >
              <SelectTrigger className="h-8 w-[190px] mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classDef.variants.map((v) => (
                  <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </td>
        <td className="py-2 pr-3 align-top text-xs whitespace-nowrap">
          {currentEf != null ? `${Number(currentEf).toFixed(3)}` : '—'}
        </td>
        <td className="py-2 pr-3 align-top text-xs whitespace-nowrap">
          {newEf != null
            ? `${newEf.toFixed(3)}`
            : classDef?.kind === 'gap_filler'
              ? 'curated composite'
              : '—'}
          {row.recycled_content_percentage != null && (
            <div className="text-muted-foreground">at {row.recycled_content_percentage}% recycled</div>
          )}
        </td>
        <td className="py-2 align-top">
          <Badge variant="outline" className={CONFIDENCE_LABELS[row.confidence].className}>
            {CONFIDENCE_LABELS[row.confidence].label}
          </Badge>
        </td>
      </tr>
    );
  };

  const renderBucket = (title: string, description: string, bucket: LegacyRow[]) => {
    if (bucket.length === 0) return null;
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{title} ({bucket.length})</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="py-2 pl-2 pr-2 w-8"></th>
                <th className="py-2 pr-3">Packaging item</th>
                <th className="py-2 pr-3">Material class</th>
                <th className="py-2 pr-3">Current EF (kg CO₂e/kg)</th>
                <th className="py-2 pr-3">Parametric EF (kg CO₂e/kg)</th>
                <th className="py-2">Confidence</th>
              </tr>
            </thead>
            <tbody>{bucket.map(renderRow)}</tbody>
          </table>
        </div>
      </div>
    );
  };

  const checkedCount = rows?.filter((r) => r.checked && r.proposedClass).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button onClick={load} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Load legacy packaging rows
        </Button>
        {rows && rows.length > 0 && (
          <Button onClick={applyMapping} disabled={applying || checkedCount === 0} variant="secondary">
            {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Apply mapping to {checkedCount} row{checkedCount === 1 ? '' : 's'} (no recompute)
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {appliedCount != null && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Applied material classes to {appliedCount} row{appliedCount === 1 ? '' : 's'}. No footprints were
          recalculated; affected products will show as stale and pick up the parametric factors on their next
          calculation.
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No legacy packaging rows in this organisation. Every packaging item already has a material class.
        </p>
      )}

      {buckets && (
        <div className="space-y-8">
          {renderBucket(
            'Exact matches',
            'The row already carries a structured container material from the guided wizard; the class follows directly.',
            buckets.exact,
          )}
          {renderBucket(
            'Inferred from names',
            'The class was inferred from the material or factor name. Review before applying.',
            buckets.inferred,
          )}
          {renderBucket(
            'Unmapped',
            'No class could be proposed. Pick one manually or leave the row on the legacy path.',
            buckets.none,
          )}
        </div>
      )}
    </div>
  );
}
