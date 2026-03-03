'use client';

import { useState, useEffect, useCallback } from 'react';
import { useIsAlkateraAdmin } from '@/hooks/usePermissions';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Shield,
  TrendingUp,
  Pencil,
  History,
  X,
  Save,
  Info,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImpactProxyValue {
  id: string;
  capital: 'natural' | 'human' | 'social' | 'governance';
  metric_key: string;
  label: string;
  proxy_value: number;
  unit: string;
  source: string;
  version: string;
  effective_from: string;
  is_active: boolean;
}

// ─── Capital display config ─────────────────────────────────────────────────

const capitalLabels: Record<string, string> = {
  natural: 'Natural Capital',
  human: 'Human Capital',
  social: 'Social Capital',
  governance: 'Governance Capital',
};

const capitalOrder = ['natural', 'human', 'social', 'governance'];

// ─── Main page ──────────────────────────────────────────────────────────────

export default function AdminImpactProxyValuesPage() {
  const { isAlkateraAdmin, isLoading: authLoading } = useIsAlkateraAdmin();
  const [proxies, setProxies] = useState<ImpactProxyValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    proxy_value: string;
    source: string;
    label: string;
  }>({ proxy_value: '', source: '', label: '' });
  const [saving, setSaving] = useState(false);

  // History drawer state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMetricKey, setHistoryMetricKey] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<ImpactProxyValue[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchProxies = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch('/api/admin/impact-proxy-values', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch proxy values');
      }

      const data = await res.json();
      setProxies(data.proxies || []);
    } catch (err) {
      console.error('Error fetching proxies:', err);
      toast.error('Failed to load proxy values');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAlkateraAdmin) {
      fetchProxies();
    }
  }, [isAlkateraAdmin, fetchProxies]);

  const startEditing = (proxy: ImpactProxyValue) => {
    setEditingId(proxy.id);
    setEditValues({
      proxy_value: String(proxy.proxy_value),
      source: proxy.source,
      label: proxy.label,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({ proxy_value: '', source: '', label: '' });
  };

  const handleSave = async () => {
    if (!editingId) return;

    const numericValue = parseFloat(editValues.proxy_value);
    if (isNaN(numericValue)) {
      toast.error('Proxy value must be a valid number');
      return;
    }

    if (!editValues.source.trim()) {
      toast.error('Source is required');
      return;
    }

    try {
      setSaving(true);
      const supabase = getSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch('/api/admin/impact-proxy-values', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingId,
          proxy_value: numericValue,
          source: editValues.source.trim(),
          label: editValues.label.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || 'Failed to update');
      }

      const data = await res.json();
      toast.success(`Proxy value updated. A new version (v${data.version}) has been created.`);
      cancelEditing();
      await fetchProxies();
    } catch (err) {
      console.error('Error saving proxy:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (metricKey: string) => {
    setHistoryMetricKey(metricKey);
    setHistoryOpen(true);
    setHistoryLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch(
        `/api/admin/impact-proxy-values?include_history=true&metric_key=${encodeURIComponent(metricKey)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error('Failed to fetch history');

      const data = await res.json();
      setHistoryItems(data.history || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      toast.error('Failed to load version history');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Group proxies by capital
  const grouped = capitalOrder.reduce(
    (acc, capital) => {
      acc[capital] = proxies.filter((p) => p.capital === capital);
      return acc;
    },
    {} as Record<string, ImpactProxyValue[]>
  );

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need alka<strong>tera</strong> admin privileges to access the proxy value management dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Impact Proxy Values</h1>
          <p className="text-sm text-muted-foreground">
            Manage shadow prices used in Impact Valuation calculations
          </p>
        </div>
      </div>

      {/* Info banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Changes to proxy values create a new version. Existing calculations are not retroactively
          updated. Run a fresh calculation from the Impact Valuation page to apply new values.
        </AlertDescription>
      </Alert>

      {/* Proxy tables grouped by capital */}
      {capitalOrder.map((capital) => {
        const items = grouped[capital];
        if (!items || items.length === 0) return null;

        return (
          <Card key={capital}>
            <CardHeader>
              <CardTitle className="text-lg">{capitalLabels[capital]}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead className="text-right">Proxy Value (£)</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((proxy) => (
                    <TableRow key={proxy.id} className="group">
                      {editingId === proxy.id ? (
                        <>
                          {/* Inline edit form */}
                          <TableCell colSpan={7}>
                            <div className="space-y-4 py-2">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-proxy-value">Proxy Value (£)</Label>
                                  <Input
                                    id="edit-proxy-value"
                                    type="number"
                                    step="any"
                                    value={editValues.proxy_value}
                                    onChange={(e) =>
                                      setEditValues((prev) => ({ ...prev, proxy_value: e.target.value }))
                                    }
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-source">Source</Label>
                                  <Input
                                    id="edit-source"
                                    value={editValues.source}
                                    onChange={(e) =>
                                      setEditValues((prev) => ({ ...prev, source: e.target.value }))
                                    }
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-label">Label (optional)</Label>
                                  <Input
                                    id="edit-label"
                                    value={editValues.label}
                                    onChange={(e) =>
                                      setEditValues((prev) => ({ ...prev, label: e.target.value }))
                                    }
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleSave}
                                  disabled={saving}
                                  className="gap-1.5"
                                >
                                  {saving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Save className="h-3.5 w-3.5" />
                                  )}
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                  disabled={saving}
                                  className="gap-1.5"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{proxy.label}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            £{Number(proxy.proxy_value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{proxy.unit}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {proxy.source}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">v{proxy.version}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(proxy.effective_from).toLocaleDateString('en-GB')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(proxy)}
                                className="gap-1.5 h-8"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openHistory(proxy.metric_key)}
                                className="gap-1.5 h-8"
                              >
                                <History className="h-3.5 w-3.5" />
                                History
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Version history drawer */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
            <SheetDescription>
              {historyMetricKey
                ? `All versions for ${historyItems[0]?.label || historyMetricKey}`
                : 'Version history'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historyItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No version history found.
              </p>
            ) : (
              <div className="space-y-3">
                {historyItems.map((item) => (
                  <Card
                    key={item.id}
                    className={item.is_active ? 'border-emerald-200 dark:border-emerald-800' : ''}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.is_active ? 'default' : 'outline'}>
                            v{item.version}
                          </Badge>
                          {item.is_active && (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                              Current
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.effective_from).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Value: </span>
                          <span className="font-medium tabular-nums">
                            £{Number(item.proxy_value).toLocaleString('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Source: </span>
                          <span className="text-sm">{item.source}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
