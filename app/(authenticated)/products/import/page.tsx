'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { downloadTemplateAsXLSX } from '@/lib/bulk-import/template-generator';
import { useOrganization } from '@/lib/organizationContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { MaterialMatchCell } from '@/components/bulk-import/MaterialMatchCell';
import {
  batchMatchMaterials,
  getMatchSelection,
  computeConfidence,
} from '@/lib/bulk-import/batch-matcher';
import type {
  ParsedProduct,
  ParsedIngredient,
  ParsedPackaging,
  MaterialMatchState,
  SearchResultForMatch,
  ProxySuggestion,
} from '@/lib/bulk-import/types';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import { Panel } from '@/components/studio/panel';

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
}

interface ImportState {
  status: 'idle' | 'uploading' | 'matching' | 'preview' | 'confirming' | 'complete';
  products: ParsedProduct[];
  ingredients: ParsedIngredient[];
  packaging: ParsedPackaging[];
  errors: string[];
  error: string | null;
  matchStates: Record<string, MaterialMatchState>;
  matchProgress: { completed: number; total: number };
}

const INITIAL_STATE: ImportState = {
  status: 'idle',
  products: [],
  ingredients: [],
  packaging: [],
  errors: [],
  error: null,
  matchStates: {},
  matchProgress: { completed: 0, total: 0 },
};

export default function ImportPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [state, setState] = useState<ImportState>(INITIAL_STATE);
  const [showConfirm, setShowConfirm] = useState(false);
  const abortRef = useRef(false);

  const handleDownloadTemplate = () => {
    downloadTemplateAsXLSX();
  };

  // ── Get auth token ───────────────────────────────────────────────────

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  // ── Manual search for MaterialMatchCell ──────────────────────────────

  const handleManualSearch = useCallback(
    async (query: string): Promise<SearchResultForMatch[]> => {
      if (!currentOrganization) return [];
      const token = await getAuthToken();
      if (!token) return [];

      const url = `/api/ingredients/search?q=${encodeURIComponent(query)}&organization_id=${currentOrganization.id}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.results || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        source_type: r.source_type,
        co2_factor: r.co2_factor,
        source: r.source,
      }));
    },
    [currentOrganization, getAuthToken]
  );

  // ── Proxy suggestion for MaterialMatchCell ──────────────────────────

  const handleSuggestProxy = useCallback(
    async (ingredientName: string): Promise<ProxySuggestion[]> => {
      const token = await getAuthToken();
      if (!token) return [];

      try {
        const response = await fetch('/api/ingredients/proxy-suggest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ingredient_name: ingredientName,
            ingredient_type: 'ingredient',
            organization_id: currentOrganization?.id,
          }),
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.suggestions || [];
      } catch {
        return [];
      }
    },
    [getAuthToken, currentOrganization]
  );

  // ── File upload ──────────────────────────────────────────────────────

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setState(prev => ({ ...prev, status: 'uploading', error: null }));

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/bulk-import/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        setState(prev => ({
          ...prev,
          status: 'idle',
          error: err.error || 'Upload failed',
          errors: err.errors || [],
        }));
        toast.error(err.error || 'Upload failed');
        return;
      }

      const data = await response.json();

      if (data.success) {
        const { products, ingredients, packaging, errors } = data.data;
        toast.success(
          `Found ${data.summary.products} products, ${data.summary.ingredients} ingredients, ${data.summary.packaging} packaging items`
        );

        // Start matching phase
        startMatching(products, ingredients, packaging, errors || []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setState(prev => ({ ...prev, status: 'idle', error: message }));
      toast.error(message);
    }

    event.target.value = '';
  };

  // ── Matching phase ───────────────────────────────────────────────────

  const startMatching = async (
    products: ParsedProduct[],
    ingredients: ParsedIngredient[],
    packaging: ParsedPackaging[],
    errors: string[]
  ) => {
    if (!currentOrganization) {
      // Can't match without org — skip to preview
      setState(prev => ({
        ...prev,
        status: 'preview',
        products,
        ingredients,
        packaging,
        errors,
      }));
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      setState(prev => ({
        ...prev,
        status: 'preview',
        products,
        ingredients,
        packaging,
        errors,
      }));
      return;
    }

    // Collect all material names
    const materials: Array<{ name: string; type: 'ingredient' | 'packaging' }> = [
      ...ingredients.map(i => ({ name: i.name, type: 'ingredient' as const })),
      ...packaging.map(p => ({ name: p.name, type: 'packaging' as const })),
    ];

    if (materials.length === 0) {
      setState(prev => ({
        ...prev,
        status: 'preview',
        products,
        ingredients,
        packaging,
        errors,
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      status: 'matching',
      products,
      ingredients,
      packaging,
      errors,
      matchProgress: { completed: 0, total: materials.length },
    }));

    abortRef.current = false;

    try {
      const matchStates = await batchMatchMaterials(materials, {
        organizationId: currentOrganization.id,
        authToken: token,
        concurrency: 4,
        onProgress: (completed, total, states) => {
          if (abortRef.current) return;
          setState(prev => ({
            ...prev,
            matchStates: states,
            matchProgress: { completed, total },
          }));
        },
      });

      if (abortRef.current) return;

      setState(prev => ({
        ...prev,
        status: 'preview',
        matchStates,
      }));
    } catch (err) {
      console.error('Matching failed:', err);
      // Move to preview even if matching fails
      setState(prev => ({
        ...prev,
        status: 'preview',
      }));
    }
  };

  const handleSkipMatching = () => {
    abortRef.current = true;
    setState(prev => ({
      ...prev,
      status: 'preview',
    }));
  };

  // ── Select/deselect match result ─────────────────────────────────────

  const handleSelectMatchResult = useCallback(
    (materialName: string, index: number, manualResults?: SearchResultForMatch[]) => {
      const key = normalise(materialName);
      setState(prev => {
        const current = prev.matchStates[key];
        if (!current) return prev;

        // If manual results provided (from search), replace search results
        const searchResults = manualResults || current.searchResults;

        if (index === -1) {
          // Deselect
          return {
            ...prev,
            matchStates: {
              ...prev.matchStates,
              [key]: {
                ...current,
                searchResults,
                selectedIndex: null,
                status: 'no_match',
                userReviewed: true,
              },
            },
          };
        }

        return {
          ...prev,
          matchStates: {
            ...prev.matchStates,
            [key]: {
              ...current,
              searchResults,
              selectedIndex: index,
              status: 'matched',
              autoMatchConfidence: computeConfidence(materialName, searchResults[index]?.name || ''),
              userReviewed: true,
            },
          },
        };
      });
    },
    []
  );

  // ── Confirm import ───────────────────────────────────────────────────

  const handleConfirmImport = async () => {
    if (!currentOrganization) {
      toast.error('No organization selected');
      return;
    }

    try {
      setState(prev => ({ ...prev, status: 'confirming' }));
      setShowConfirm(false);

      // Attach match selections to ingredients and packaging
      const ingredientsWithMatch = state.ingredients.map(ing => {
        const match = getMatchSelection(ing.name, state.matchStates);
        return { ...ing, match: match || undefined };
      });

      const packagingWithMatch = state.packaging.map(pkg => {
        const match = getMatchSelection(pkg.name, state.matchStates);
        return { ...pkg, match: match || undefined };
      });

      const response = await fetch('/api/bulk-import/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          products: state.products,
          ingredients: ingredientsWithMatch,
          packaging: packagingWithMatch,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setState(prev => ({
          ...prev,
          status: 'preview',
          error: err.error || 'Import failed',
        }));
        toast.error(err.error || 'Import failed');
        return;
      }

      const result = await response.json();
      setState(prev => ({ ...prev, status: 'complete' }));
      toast.success(
        `Created ${result.created.products} products with ${result.created.ingredients} ingredients and ${result.created.packaging} packaging items`
      );

      setTimeout(() => {
        router.push('/products');
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      setState(prev => ({ ...prev, status: 'preview', error: message }));
      toast.error(message);
    }
  };

  // ── Match summary stats ──────────────────────────────────────────────

  const matchSummary = (() => {
    const states = Object.values(state.matchStates);
    const matched = states.filter(
      s => s.status === 'matched' && s.selectedIndex != null && (s.autoMatchConfidence ?? 0) >= 0.7
    ).length;
    const needReview = states.filter(
      s => s.status === 'matched' && s.selectedIndex != null && (s.autoMatchConfidence ?? 0) < 0.7
    ).length;
    const unlinked = states.filter(
      s => s.status === 'no_match' || s.status === 'error' || s.selectedIndex == null
    ).length;
    return { matched, needReview, unlinked, total: states.length };
  })();

  // Group ingredients and packaging by product SKU for preview
  const ingredientsBySku: Record<string, ParsedIngredient[]> = {};
  for (const ing of state.ingredients) {
    if (!ingredientsBySku[ing.product_sku]) ingredientsBySku[ing.product_sku] = [];
    ingredientsBySku[ing.product_sku].push(ing);
  }
  const packagingBySku: Record<string, ParsedPackaging[]> = {};
  for (const pkg of state.packaging) {
    if (!packagingBySku[pkg.product_sku]) packagingBySku[pkg.product_sku] = [];
    packagingBySku[pkg.product_sku].push(pkg);
  }

  const progressPct =
    state.matchProgress.total > 0
      ? Math.round((state.matchProgress.completed / state.matchProgress.total) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-2">
      <div className="space-y-4">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        >
          The products
        </Link>
        <Statement eyebrow="THE CELLAR · IMPORT" headline="Bring products in." />
        <p className="max-w-xl text-sm text-muted-foreground">
          Upload bulk product and ingredient data using a template spreadsheet.
        </p>
      </div>

      {/* Get the template */}
      <section className="space-y-4 border-t border-studio-hairline pt-6">
        <Eyebrow>GET THE TEMPLATE</Eyebrow>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>Products sheet: name, SKU, category.</li>
          <li>Ingredients sheet: linked by SKU, with quantities and origins.</li>
          <li>Packaging sheet: materials, EPR data, component breakdowns.</li>
          <li>Example data and a field reference to guide you.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Download the Excel template, fill it in with Excel or Google Sheets, then come back and upload it below.
        </p>
        <PillButton variant="ink" onClick={handleDownloadTemplate}>
          Download the template
        </PillButton>
      </section>

      {/* Import your file */}
      <section className="space-y-4 border-t border-studio-hairline pt-6">
        <Eyebrow>IMPORT YOUR FILE</Eyebrow>

        {/* Upload state */}
        {(state.status === 'idle' || state.status === 'uploading') && (
          <div className="space-y-4">
            <label className="block cursor-pointer rounded-[6px] border border-studio-hairline p-8 text-center transition-colors hover:border-room-accent">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={state.status === 'uploading'}
                className="sr-only"
              />
              <p className="text-sm font-medium text-foreground">Click to select your file</p>
              <p className="mt-1 text-xs text-muted-foreground">or drag and drop here</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Excel files (.xlsx) only
              </p>
            </label>

            {state.error && (
              <div className="flex items-center gap-2">
                <StateChip tone="stale">Error</StateChip>
                <p className="text-sm text-muted-foreground">{state.error}</p>
              </div>
            )}

            {state.status === 'uploading' && (
              <p className="text-sm text-muted-foreground">Uploading and processing…</p>
            )}
          </div>
        )}

        {/* Matching phase */}
        {state.status === 'matching' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Matching your materials to the emission factor databases.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  Matching materials ({state.matchProgress.completed}/{state.matchProgress.total})
                </span>
                <span className="font-mono text-xs text-muted-foreground">{progressPct}%</span>
              </div>
              <Progress value={progressPct} />
            </div>

            {/* Show matches as they come in */}
            {Object.values(state.matchStates).filter(s => s.status === 'matched').length > 0 && (
              <div className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                {Object.values(state.matchStates)
                  .filter(s => s.status === 'matched' && s.selectedIndex != null)
                  .slice(0, 8)
                  .map(s => (
                    <div key={s.materialName} className="flex items-center gap-1">
                      <span className="truncate text-foreground">{s.materialName}</span>
                      <span className="mx-0.5 text-muted-foreground/50">→</span>
                      <span className="truncate">{s.searchResults[s.selectedIndex!]?.name}</span>
                    </div>
                  ))}
              </div>
            )}

            <PillButton variant="outline" onClick={handleSkipMatching}>
              Skip matching
            </PillButton>
          </div>
        )}

        {/* Preview / Confirming state */}
        {(state.status === 'preview' || state.status === 'confirming') && (
          <div className="space-y-4">
            {/* Match summary */}
            {matchSummary.total > 0 && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Material matching
                </span>
                {matchSummary.matched > 0 && (
                  <StateChip tone="good">{matchSummary.matched} matched</StateChip>
                )}
                {matchSummary.needReview > 0 && (
                  <StateChip tone="attention">{matchSummary.needReview} need review</StateChip>
                )}
                {matchSummary.unlinked > 0 && (
                  <StateChip tone="stale">{matchSummary.unlinked} unlinked</StateChip>
                )}
              </div>
            )}

            {/* Warnings */}
            {state.errors.length > 0 && (
              <div className="space-y-1.5 rounded-[6px] border border-studio-hairline bg-studio-cream p-4">
                <StateChip tone="attention">
                  {state.errors.length} warning{state.errors.length !== 1 ? 's' : ''}
                </StateChip>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                  {state.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {state.errors.length > 5 && <li>...and {state.errors.length - 5} more</li>}
                </ul>
              </div>
            )}

            {/* Per-product breakdown */}
            {state.products.map(product => (
              <Panel key={product.sku} flush>
                <div className="flex items-center justify-between border-b border-studio-hairline px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-semibold text-foreground">{product.name}</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      SKU {product.sku}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent">
                    {product.category}
                  </span>
                </div>

                {/* Ingredients table */}
                {(ingredientsBySku[product.sku]?.length ?? 0) > 0 && (
                  <div className="border-b border-studio-hairline p-4">
                    <Eyebrow tone="dim" className="mb-2">
                      {`INGREDIENTS · ${ingredientsBySku[product.sku].length}`}
                    </Eyebrow>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="pb-1 pr-4 font-medium">Name</th>
                            <th className="pb-1 pr-4 font-medium">Qty</th>
                            <th className="pb-1 pr-4 font-medium">Origin</th>
                            <th className="pb-1 font-medium">Emission factor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {ingredientsBySku[product.sku].map((ing, i) => {
                            const key = normalise(ing.name);
                            const matchState = state.matchStates[key];
                            return (
                              <tr key={i}>
                                <td className="py-1.5 pr-4">{ing.name}</td>
                                <td className="py-1.5 pr-4 text-muted-foreground">
                                  {ing.quantity} {ing.unit}
                                </td>
                                <td className="py-1.5 pr-4 text-xs text-muted-foreground">
                                  {ing.origin || '-'}
                                </td>
                                <td className="py-1.5">
                                  <MaterialMatchCell
                                    matchState={matchState}
                                    onSelectResult={(idx, manualResults) =>
                                      handleSelectMatchResult(ing.name, idx, manualResults)
                                    }
                                    onSuggestProxy={handleSuggestProxy}
                                    onManualSearch={async (q) => {
                                      return await handleManualSearch(q);
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Packaging table */}
                {(packagingBySku[product.sku]?.length ?? 0) > 0 && (
                  <div className="p-4">
                    <Eyebrow tone="dim" className="mb-2">
                      {`PACKAGING · ${packagingBySku[product.sku].length}`}
                    </Eyebrow>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="pb-1 pr-4 font-medium">Name</th>
                            <th className="pb-1 pr-4 font-medium">Category</th>
                            <th className="pb-1 pr-4 font-medium">Material</th>
                            <th className="pb-1 pr-4 font-medium">Weight</th>
                            <th className="pb-1 pr-4 font-medium">EPR</th>
                            <th className="pb-1 font-medium">Emission factor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {packagingBySku[product.sku].map((pkg, i) => {
                            const key = normalise(pkg.name);
                            const matchState = state.matchStates[key];
                            return (
                              <tr key={i}>
                                <td className="py-1.5 pr-4">
                                  {pkg.name}
                                  {pkg.components.length > 0 && (
                                    <span className="ml-1 text-xs text-muted-foreground">
                                      ({pkg.components.length} components)
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 pr-4 capitalize text-muted-foreground">
                                  {pkg.category}
                                </td>
                                <td className="py-1.5 pr-4 capitalize text-muted-foreground">
                                  {pkg.main_material}
                                </td>
                                <td className="py-1.5 pr-4 text-muted-foreground">{pkg.weight_g}g</td>
                                <td className="py-1.5 pr-4">
                                  {pkg.epr_level ? (
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                      {pkg.epr_level}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </td>
                                <td className="py-1.5">
                                  <MaterialMatchCell
                                    matchState={matchState}
                                    onSelectResult={(idx, manualResults) =>
                                      handleSelectMatchResult(pkg.name, idx, manualResults)
                                    }
                                    onSuggestProxy={handleSuggestProxy}
                                    onManualSearch={async (q) => {
                                      return await handleManualSearch(q);
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Panel>
            ))}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <PillButton
                variant="outline"
                onClick={() => setState(INITIAL_STATE)}
                disabled={state.status === 'confirming'}
              >
                Upload a different file
              </PillButton>
              <PillButton
                variant="room"
                className="ml-auto"
                onClick={() => setShowConfirm(true)}
                disabled={state.status === 'confirming'}
              >
                {state.status === 'confirming' ? 'Importing…' : 'Confirm and import'}
              </PillButton>
            </div>
          </div>
        )}

        {/* Complete state */}
        {state.status === 'complete' && (
          <div className="space-y-2">
            <StateChip tone="good">Import complete</StateChip>
            <p className="text-sm text-muted-foreground">
              Your data has been imported. Redirecting to products…
            </p>
          </div>
        )}
      </section>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm import</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                This will create {state.products.length} product{state.products.length !== 1 ? 's' : ''} with{' '}
                {state.ingredients.length} ingredients and {state.packaging.length} packaging items.
                Products will be created as drafts.
              </p>
              {matchSummary.total > 0 && (
                <p className="text-sm">
                  {matchSummary.matched + matchSummary.needReview} materials linked to emission factors
                  {matchSummary.unlinked > 0 && (
                    <span className="text-muted-foreground">
                      {' '}· {matchSummary.unlinked} unlinked (can be linked later)
                    </span>
                  )}
                </p>
              )}
              <p>Continue?</p>
            </div>
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>Confirm import</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
