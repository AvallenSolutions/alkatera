'use client';

/**
 * Admin tool: recalculate every product LCA in the CURRENT organization.
 *
 * Why this exists: when a calculator/aggregator fix lands (e.g. the shared-
 * packaging end-of-life amortisation + cardboard "box" classification fix), the
 * stored `aggregated_impacts` on each product's PCF are stale until the LCA is
 * re-run. This loops the org's products through the SAME client-side calculator
 * the wizard uses, faithfully reusing each product's saved settings:
 *   - boundary / reference year / use-phase / EoL / distribution / loss configs
 *     from `products.last_wizard_settings`
 *   - facility allocations from the product's most recent PCF `draft_data`
 *     (mapped exactly as the wizard's CalculationStep does)
 *
 * A product with no recoverable facility allocations is SKIPPED (not silently
 * recalculated with zero facility data, which would understate processing/scope
 * emissions) and surfaced in the summary so it can be re-run via the wizard.
 *
 * Gated to alkatera admins. Operates on whichever org is currently active, so an
 * advisor switches to the client org first, then runs it.
 */

import { useState } from 'react';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { useIsAlkateraAdmin } from '@/hooks/usePermissions';
import { recalculateProductLca } from '@/lib/utils/recalculate-product-lca';

type ProductRow = {
  id: number | string;
  name: string | null;
  unit?: string | null;
  organization_id: string;
  last_wizard_settings: Record<string, any> | null;
};

type Outcome = { name: string; status: 'done' | 'skipped' | 'error'; detail?: string };

export function RecalculateOrgLcasButton() {
  const { isAlkateraAdmin } = useIsAlkateraAdmin();
  const { currentOrganization, userRole } = useOrganization();

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Anyone who can manage the active org should be able to repropagate a fix to
  // its own products: an alkatera admin, an org owner/admin, or an advisor acting
  // within the org. RLS still enforces that only accessible orgs can be written.
  const canRun =
    !!currentOrganization &&
    (isAlkateraAdmin || ['owner', 'admin', 'advisor'].includes((userRole ?? '').toLowerCase()));

  if (!canRun) {
    return (
      <p className="text-xs text-muted-foreground">
        {currentOrganization
          ? 'You need owner, admin, or advisor access to this organization to recalculate its LCAs.'
          : 'Select an organization first, then return to this page.'}
      </p>
    );
  }

  async function run() {
    if (!currentOrganization?.id) {
      setError('No active organization. Switch to the client org first.');
      return;
    }
    setBusy(true);
    setError(null);
    setOutcomes(null);

    const sb = getSupabaseBrowserClient();
    const orgId = currentOrganization.id;

    const { data: products, error: prodErr } = await sb
      .from('products')
      .select('*')
      .eq('organization_id', orgId)
      .order('name');

    if (prodErr) {
      setError(`Failed to load products: ${prodErr.message}`);
      setBusy(false);
      return;
    }

    const rows = (products ?? []) as ProductRow[];

    if (rows.length === 0) {
      setError('No products found in this organization.');
      setBusy(false);
      return;
    }

    const proceed =
      typeof window === 'undefined' ||
      window.confirm(
        `Recalculate ${rows.length} product LCA${rows.length === 1 ? '' : 's'} in "${currentOrganization?.name ?? 'this org'}"? ` +
          `This creates a new footprint per product and supersedes the current one.`
      );
    if (!proceed) {
      setBusy(false);
      return;
    }

    const results: Outcome[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const product = rows[i];
      const name = product.name || `Product ${product.id}`;
      setProgress({ done: i, total: rows.length, current: name });

      try {
        const outcome = await recalculateProductLca(sb, product, orgId);
        if (outcome === 'skipped') {
          results.push({ name, status: 'skipped', detail: 'no recoverable facility allocations — re-run via the wizard' });
        } else {
          results.push({ name, status: 'done' });
        }
      } catch (err: unknown) {
        results.push({ name, status: 'error', detail: err instanceof Error ? err.message : String(err) });
      }
    }

    setProgress(null);
    setOutcomes(results);
    setBusy(false);
  }

  const doneCount = outcomes?.filter(o => o.status === 'done').length ?? 0;
  const skipCount = outcomes?.filter(o => o.status === 'skipped').length ?? 0;
  const errCount = outcomes?.filter(o => o.status === 'error').length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy} variant="outline" size="sm">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {busy ? 'Recalculating…' : 'Recalculate all LCAs in this org'}
        </Button>
        {currentOrganization?.name && (
          <span className="text-xs text-muted-foreground">Target org: {currentOrganization.name}</span>
        )}
      </div>

      {busy && progress && (
        <p className="text-xs text-muted-foreground">
          {progress.done}/{progress.total} — recalculating <span className="font-medium">{progress.current}</span>…
        </p>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {outcomes && (
        <div className="space-y-2 text-xs">
          <p className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> {doneCount} recalculated</span>
            {skipCount > 0 && <span className="flex items-center gap-1 text-amber-600"><SkipForward className="h-3.5 w-3.5" /> {skipCount} skipped</span>}
            {errCount > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> {errCount} failed</span>}
          </p>
          {(skipCount > 0 || errCount > 0) && (
            <ul className="space-y-1 text-muted-foreground">
              {outcomes.filter(o => o.status !== 'done').map((o, idx) => (
                <li key={idx}>
                  <span className={o.status === 'error' ? 'text-destructive' : 'text-amber-600'}>{o.status}</span>
                  {': '}<span className="font-medium">{o.name}</span>{o.detail ? ` — ${o.detail}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
