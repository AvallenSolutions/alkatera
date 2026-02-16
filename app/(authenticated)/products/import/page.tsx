'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Download,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Package,
  Leaf,
  Box,
  Link2,
  Link2Off,
  SkipForward,
} from 'lucide-react';
import { downloadTemplateAsXLSX } from '@/lib/bulk-import/template-generator';
import { useOrganization } from '@/lib/organizationContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { MaterialMatchCell } from '@/components/bulk-import/MaterialMatchCell';
import {
  batchMatchMaterials,
  getMatchSelection,
  computeConfidence,
  mapSearchResultToDBSource,
} from '@/lib/bulk-import/batch-matcher';
import type {
  ParsedProduct,
  ParsedIngredient,
  ParsedPackaging,
  MaterialMatchState,
  MaterialMatchSelection,
  SearchResultForMatch,
  ProxySuggestion,
} from '@/lib/bulk-import/types';

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
  const [activeTab, setActiveTab] = useState<string>('template');
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
          }),
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.suggestions || [];
      } catch {
        return [];
      }
    },
    [getAuthToken]
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

  return (
    <div className="space-y-8 py-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Import Product Data</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Upload bulk product and ingredient data using a template spreadsheet
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold">Download Template</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">What you&apos;ll get:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ Products sheet — name, SKU, category</li>
                  <li>✓ Ingredients sheet — linked by SKU, with quantities and origins</li>
                  <li>✓ Packaging sheet — materials, EPR data, component breakdowns</li>
                  <li>✓ Example data and field reference to guide you</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Download the Excel template, fill it out in Excel or Google Sheets, then come
                  back here to upload it.
                </p>
              </div>

              <Button onClick={handleDownloadTemplate} size="lg" className="w-full gap-2">
                <Download className="h-5 w-5" />
                Download Template
              </Button>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-semibold">How to use:</h2>
            </div>

            <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
              <li>Download the template file</li>
              <li>Open in Excel, Google Sheets, or your preferred spreadsheet app</li>
              <li>Fill in products, ingredients, and packaging (linked by SKU)</li>
              <li>Leave optional fields blank if not applicable</li>
              <li>Save as Excel (.xlsx)</li>
              <li>Switch to the Import tab and upload the file</li>
              <li>Review the extracted data and matched emission factors</li>
              <li>Confirm to save everything to your products</li>
            </ol>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          {/* Upload state */}
          {(state.status === 'idle' || state.status === 'uploading') && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold">Upload File</h2>
              </div>

              <label className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={state.status === 'uploading'}
                  className="sr-only"
                />
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">Click to select your file</p>
                    <p className="text-sm text-muted-foreground">or drag and drop here</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Excel files (.xlsx) only</p>
                </div>
              </label>

              {state.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              {state.status === 'uploading' && (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  <p className="text-sm text-muted-foreground">Uploading and processing...</p>
                </div>
              )}
            </Card>
          )}

          {/* Matching phase */}
          {state.status === 'matching' && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-blue-600 animate-pulse" />
                <h2 className="text-xl font-semibold">Matching Materials</h2>
              </div>

              <p className="text-sm text-muted-foreground">
                Searching emission factor databases to find matching entries for your materials...
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    Matching materials... ({state.matchProgress.completed}/{state.matchProgress.total})
                  </span>
                  <span className="text-muted-foreground">
                    {state.matchProgress.total > 0
                      ? Math.round((state.matchProgress.completed / state.matchProgress.total) * 100)
                      : 0}%
                  </span>
                </div>
                <Progress
                  value={
                    state.matchProgress.total > 0
                      ? (state.matchProgress.completed / state.matchProgress.total) * 100
                      : 0
                  }
                />
              </div>

              {/* Show matches as they come in */}
              {Object.values(state.matchStates).filter(s => s.status === 'matched').length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                  {Object.values(state.matchStates)
                    .filter(s => s.status === 'matched' && s.selectedIndex != null)
                    .slice(0, 8)
                    .map(s => (
                      <div key={s.materialName} className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <span className="truncate">{s.materialName}</span>
                        <span className="text-muted-foreground/50 mx-0.5">→</span>
                        <span className="truncate text-muted-foreground">
                          {s.searchResults[s.selectedIndex!]?.name}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              <Button variant="outline" onClick={handleSkipMatching} className="gap-2">
                <SkipForward className="h-4 w-4" />
                Skip Matching
              </Button>
            </Card>
          )}

          {/* Preview / Confirming state */}
          {(state.status === 'preview' || state.status === 'confirming') && (
            <div className="space-y-4">
              {/* Summary counts */}
              <Card className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-2xl font-bold">{state.products.length}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Products</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Leaf className="h-4 w-4 text-green-600" />
                      <span className="text-2xl font-bold">{state.ingredients.length}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Ingredients</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Box className="h-4 w-4 text-amber-600" />
                      <span className="text-2xl font-bold">{state.packaging.length}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Packaging Items</div>
                  </div>
                </div>
              </Card>

              {/* Match summary banner */}
              {matchSummary.total > 0 && (
                <Card className="p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium">Material Matching:</span>
                    {matchSummary.matched > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        {matchSummary.matched} matched
                      </Badge>
                    )}
                    {matchSummary.needReview > 0 && (
                      <Badge variant="secondary" className="gap-1 border-amber-300">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        {matchSummary.needReview} need review
                      </Badge>
                    )}
                    {matchSummary.unlinked > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Link2Off className="h-3 w-3 text-red-500" />
                        {matchSummary.unlinked} unlinked
                      </Badge>
                    )}
                  </div>
                </Card>
              )}

              {/* Warnings */}
              {state.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">
                      {state.errors.length} warning{state.errors.length !== 1 ? 's' : ''}:
                    </p>
                    <ul className="text-xs space-y-0.5 list-disc list-inside">
                      {state.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {state.errors.length > 5 && (
                        <li>...and {state.errors.length - 5} more</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Per-product breakdown */}
              {state.products.map(product => (
                <Card key={product.sku} className="overflow-hidden">
                  <div className="p-4 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          SKU: {product.sku}
                        </p>
                      </div>
                      <Badge variant="outline">{product.category}</Badge>
                    </div>
                  </div>

                  {/* Ingredients table */}
                  {(ingredientsBySku[product.sku]?.length ?? 0) > 0 && (
                    <div className="p-4 border-b">
                      <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                        <Leaf className="h-3.5 w-3.5 text-green-600" />
                        Ingredients ({ingredientsBySku[product.sku].length})
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground text-xs">
                              <th className="pb-1 pr-4 font-medium">Name</th>
                              <th className="pb-1 pr-4 font-medium">Qty</th>
                              <th className="pb-1 pr-4 font-medium">Origin</th>
                              <th className="pb-1 font-medium">Emission Factor</th>
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
                                  <td className="py-1.5 pr-4 text-muted-foreground text-xs">
                                    {ing.origin || '-'}
                                  </td>
                                  <td className="py-1.5">
                                    <MaterialMatchCell
                                      matchState={matchState}
                                      onSelectResult={(idx) =>
                                        handleSelectMatchResult(ing.name, idx)
                                      }
                                      onSuggestProxy={handleSuggestProxy}
                                      onManualSearch={async (q) => {
                                        const results = await handleManualSearch(q);
                                        // Store manual results in matchStates
                                        if (results.length > 0) {
                                          const mKey = normalise(ing.name);
                                          setState(prev => ({
                                            ...prev,
                                            matchStates: {
                                              ...prev.matchStates,
                                              [mKey]: {
                                                ...(prev.matchStates[mKey] || {
                                                  materialName: ing.name,
                                                  materialType: 'ingredient',
                                                  status: 'no_match',
                                                  selectedIndex: null,
                                                  autoMatchConfidence: null,
                                                  userReviewed: false,
                                                }),
                                                searchResults: results,
                                              },
                                            },
                                          }));
                                        }
                                        return results;
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
                      <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                        <Box className="h-3.5 w-3.5 text-amber-600" />
                        Packaging ({packagingBySku[product.sku].length})
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground text-xs">
                              <th className="pb-1 pr-4 font-medium">Name</th>
                              <th className="pb-1 pr-4 font-medium">Category</th>
                              <th className="pb-1 pr-4 font-medium">Material</th>
                              <th className="pb-1 pr-4 font-medium">Weight</th>
                              <th className="pb-1 pr-4 font-medium">EPR</th>
                              <th className="pb-1 font-medium">Emission Factor</th>
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
                                      <span className="text-xs text-muted-foreground ml-1">
                                        ({pkg.components.length} components)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5 pr-4">
                                    <Badge variant="outline" className="capitalize text-xs">
                                      {pkg.category}
                                    </Badge>
                                  </td>
                                  <td className="py-1.5 pr-4 capitalize text-muted-foreground">
                                    {pkg.main_material}
                                  </td>
                                  <td className="py-1.5 pr-4 text-muted-foreground">
                                    {pkg.weight_g}g
                                  </td>
                                  <td className="py-1.5 pr-4">
                                    {pkg.epr_level ? (
                                      <Badge variant="secondary" className="capitalize text-xs">
                                        {pkg.epr_level}
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </td>
                                  <td className="py-1.5">
                                    <MaterialMatchCell
                                      matchState={matchState}
                                      onSelectResult={(idx) =>
                                        handleSelectMatchResult(pkg.name, idx)
                                      }
                                      onSuggestProxy={handleSuggestProxy}
                                      onManualSearch={async (q) => {
                                        const results = await handleManualSearch(q);
                                        if (results.length > 0) {
                                          const mKey = normalise(pkg.name);
                                          setState(prev => ({
                                            ...prev,
                                            matchStates: {
                                              ...prev.matchStates,
                                              [mKey]: {
                                                ...(prev.matchStates[mKey] || {
                                                  materialName: pkg.name,
                                                  materialType: 'packaging',
                                                  status: 'no_match',
                                                  selectedIndex: null,
                                                  autoMatchConfidence: null,
                                                  userReviewed: false,
                                                }),
                                                searchResults: results,
                                              },
                                            },
                                          }));
                                        }
                                        return results;
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
                </Card>
              ))}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setState(INITIAL_STATE)}
                  disabled={state.status === 'confirming'}
                >
                  Upload Different File
                </Button>
                <Button
                  onClick={() => setShowConfirm(true)}
                  className="ml-auto"
                  disabled={state.status === 'confirming'}
                >
                  {state.status === 'confirming' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Importing...
                    </>
                  ) : (
                    'Confirm & Import'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Complete state */}
          {state.status === 'complete' && (
            <Card className="p-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold">Import Complete</h2>
                <p className="text-muted-foreground mt-1">
                  Your data has been successfully imported. Redirecting to products...
                </p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm Import</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                This will create {state.products.length} product{state.products.length !== 1 ? 's' : ''} with{' '}
                {state.ingredients.length} ingredients and {state.packaging.length} packaging items.
                Products will be created as drafts.
              </p>
              {matchSummary.total > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>{matchSummary.matched + matchSummary.needReview} materials linked to emission factors</span>
                  {matchSummary.unlinked > 0 && (
                    <span className="text-muted-foreground">
                      · {matchSummary.unlinked} unlinked (can be linked later)
                    </span>
                  )}
                </div>
              )}
              <p>Continue?</p>
            </div>
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              Confirm Import
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
