'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { downloadTemplateAsXLSX } from '@/lib/bulk-import/template-generator';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import type {
  ParsedProduct,
  ParsedIngredient,
  ParsedPackaging,
} from '@/lib/bulk-import/types';

interface ImportState {
  status: 'idle' | 'uploading' | 'preview' | 'confirming' | 'complete';
  products: ParsedProduct[];
  ingredients: ParsedIngredient[];
  packaging: ParsedPackaging[];
  errors: string[];
  error: string | null;
}

const INITIAL_STATE: ImportState = {
  status: 'idle',
  products: [],
  ingredients: [],
  packaging: [],
  errors: [],
  error: null,
};

export default function ImportPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [state, setState] = useState<ImportState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<string>('template');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDownloadTemplate = () => {
    downloadTemplateAsXLSX();
  };

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
        setState(prev => ({
          ...prev,
          status: 'preview',
          products: data.data.products,
          ingredients: data.data.ingredients,
          packaging: data.data.packaging,
          errors: data.data.errors || [],
        }));
        toast.success(
          `Found ${data.summary.products} products, ${data.summary.ingredients} ingredients, ${data.summary.packaging} packaging items`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setState(prev => ({ ...prev, status: 'idle', error: message }));
      toast.error(message);
    }

    // Reset file input so the same file can be re-uploaded
    event.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!currentOrganization) {
      toast.error('No organization selected');
      return;
    }

    try {
      setState(prev => ({ ...prev, status: 'confirming' }));
      setShowConfirm(false);

      const response = await fetch('/api/bulk-import/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          products: state.products,
          ingredients: state.ingredients,
          packaging: state.packaging,
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
              <li>Review the extracted data</li>
              <li>Confirm to save everything to your products</li>
            </ol>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          {state.status === 'idle' || state.status === 'uploading' ? (
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
          ) : state.status === 'preview' || state.status === 'confirming' ? (
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
                              <th className="pb-1 font-medium">Origin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {ingredientsBySku[product.sku].map((ing, i) => (
                              <tr key={i}>
                                <td className="py-1.5 pr-4">{ing.name}</td>
                                <td className="py-1.5 pr-4 text-muted-foreground">
                                  {ing.quantity} {ing.unit}
                                </td>
                                <td className="py-1.5 text-muted-foreground text-xs">
                                  {ing.origin || '-'}
                                </td>
                              </tr>
                            ))}
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
                              <th className="pb-1 font-medium">EPR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {packagingBySku[product.sku].map((pkg, i) => (
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
                                <td className="py-1.5">
                                  {pkg.epr_level ? (
                                    <Badge variant="secondary" className="capitalize text-xs">
                                      {pkg.epr_level}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
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
          ) : state.status === 'complete' ? (
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
          ) : null}
        </TabsContent>
      </Tabs>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm Import</AlertDialogTitle>
          <AlertDialogDescription>
            This will create {state.products.length} product{state.products.length !== 1 ? 's' : ''} with{' '}
            {state.ingredients.length} ingredients and {state.packaging.length} packaging items.
            Products will be created as drafts. Continue?
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
