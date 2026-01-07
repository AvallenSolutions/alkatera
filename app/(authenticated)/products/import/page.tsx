'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Download, Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { downloadTemplateAsCSV, createGoogleSheetsTemplate } from '@/lib/bulk-import/template-generator';
import { getConfidenceLevel } from '@/lib/bulk-import/material-matcher';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ExtractedItem {
  id: string;
  raw_name: string;
  clean_name: string | null;
  quantity: number | null;
  unit: string | null;
  item_type: 'ingredient' | 'packaging';
  matched_material_id: string | null;
  match_confidence: number | null;
  is_reviewed: boolean;
  is_imported: boolean;
}

interface ImportState {
  status: 'idle' | 'uploading' | 'processing' | 'preview' | 'confirming' | 'complete';
  importId: string | null;
  items: ExtractedItem[];
  error: string | null;
}

export default function ImportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [organizationId, setOrganizationId] = useState<string>('');
  const [state, setState] = useState<ImportState>({
    status: 'idle',
    importId: null,
    items: [],
    error: null,
  });
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDownloadTemplate = () => {
    downloadTemplateAsCSV();
    toast.success('Template downloaded. Fill it out and upload when ready.');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!organizationId) {
      toast.error('Please select an organization first');
      return;
    }

    try {
      setState({ ...state, status: 'uploading', error: null });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('organizationId', organizationId);

      const response = await fetch('/api/bulk-import/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        setState({
          ...state,
          status: 'idle',
          error: error.error || 'Upload failed',
        });
        toast.error(error.error || 'Upload failed');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setState({
          ...state,
          status: 'preview',
          importId: data.importId,
          items: data.items || [],
        });
        toast.success(`Imported ${data.itemCount} items`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setState({
        ...state,
        status: 'idle',
        error: message,
      });
      toast.error(message);
    }
  };

  const handleConfirmImport = async () => {
    if (!state.importId) return;

    try {
      setState({ ...state, status: 'confirming' });
      setShowConfirm(false);

      const response = await fetch(`/api/bulk-import/${state.importId}/confirm`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        setState({
          ...state,
          status: 'preview',
          error: error.error || 'Confirmation failed',
        });
        toast.error(error.error || 'Confirmation failed');
        return;
      }

      setState({
        ...state,
        status: 'complete',
      });
      toast.success('Import completed successfully!');

      setTimeout(() => {
        router.push('/products');
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Confirmation failed';
      setState({
        ...state,
        status: 'preview',
        error: message,
      });
      toast.error(message);
    }
  };

  const matchedCount = state.items.filter(i => i.matched_material_id).length;
  const reviewedCount = state.items.filter(i => i.is_reviewed).length;

  return (
    <div className="space-y-8 py-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Import Product Data</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Upload bulk product and ingredient data using a template spreadsheet
        </p>
      </div>

      <Tabs value={state.status === 'idle' ? 'template' : 'import'} className="space-y-6">
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
                <h3 className="font-medium mb-2">What you'll get:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ Company information sheet</li>
                  <li>✓ Products sheet with ingredient tracking</li>
                  <li>✓ Packaging specifications</li>
                  <li>✓ Instructions and validation rules</li>
                  <li>✓ Example data to guide you</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  The template supports both Excel and CSV formats. You can fill it out
                  in Excel, Google Sheets, or any spreadsheet application, then upload it here.
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
              <li>Fill in your company and product information</li>
              <li>Leave optional fields blank if not applicable</li>
              <li>Save as Excel (.xlsx) or CSV (.csv)</li>
              <li>Come back here and upload the file</li>
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

              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={state.status === 'uploading'}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">Drag and drop your file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <p className="text-xs text-muted-foreground">CSV or Excel files only</p>
                </div>
              </div>

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
          ) : state.status === 'preview' ? (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  Found {state.items.length} items. Review below before confirming.
                </AlertDescription>
              </Alert>

              <Card className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{state.items.length}</div>
                    <div className="text-sm text-muted-foreground">Total Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{matchedCount}</div>
                    <div className="text-sm text-muted-foreground">Auto-Matched</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      {state.items.length - matchedCount}
                    </div>
                    <div className="text-sm text-muted-foreground">Needs Review</div>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Item Name</th>
                        <th className="px-4 py-2 text-left font-medium">Type</th>
                        <th className="px-4 py-2 text-left font-medium">Qty</th>
                        <th className="px-4 py-2 text-left font-medium">Match</th>
                        <th className="px-4 py-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {state.items.slice(0, 20).map(item => (
                        <tr key={item.id} className="hover:bg-muted/50">
                          <td className="px-4 py-2">
                            <div>
                              <p className="font-medium">{item.clean_name}</p>
                              <p className="text-xs text-muted-foreground">{item.raw_name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="capitalize">
                              {item.item_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            {item.quantity && item.unit ? `${item.quantity} ${item.unit}` : '-'}
                          </td>
                          <td className="px-4 py-2">
                            {item.match_confidence ? (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <span className="text-xs font-bold text-green-700">
                                    {Math.round((item.match_confidence || 0) * 100)}%
                                  </span>
                                </div>
                                <span className="text-xs">
                                  {getConfidenceLevel(item.match_confidence || 0).label}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No match</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {item.is_reviewed ? (
                              <Badge variant="secondary">Reviewed</Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {state.items.length > 20 && (
                <p className="text-sm text-muted-foreground text-center">
                  Showing 20 of {state.items.length} items
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setState({
                      ...state,
                      status: 'idle',
                      importId: null,
                      items: [],
                      error: null,
                    })
                  }
                >
                  Upload Different File
                </Button>
                <Button onClick={() => setShowConfirm(true)} className="ml-auto">
                  Confirm & Import
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
            You are about to import {state.items.length} items into your product database. This
            action can be undone by deleting the created products. Continue?
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
