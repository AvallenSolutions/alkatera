'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Recycle,
  Lock,
  Sparkles,
  ArrowRight,
  PoundSterling,
  TrendingUp,
  Package,
  RefreshCw,
  Pencil,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/organizationContext';
import { useSubscription } from '@/hooks/useSubscription';
import type { EPRPRNObligation } from '@/lib/epr/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PRNSummary {
  year: number;
  total_prn_spend_gbp: number;
  overall_fulfilment_pct: number;
  materials_count: number;
  fulfilled_count: number;
}

interface PRNResponse {
  obligations: EPRPRNObligation[];
  summary: PRNSummary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: EPRPRNObligation['status']) {
  switch (status) {
    case 'not_started':
      return <Badge variant="destructive">Not Started</Badge>;
    case 'partial':
      return <Badge variant="warning">Partial</Badge>;
    case 'fulfilled':
      return <Badge variant="success">Fulfilled</Badge>;
    case 'exceeded':
      return <Badge variant="info">Exceeded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function fmtGBP(value: number | null | undefined): string {
  if (value == null) return '--';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtTonnes(value: number | null | undefined): string {
  if (value == null) return '--';
  return value.toFixed(3);
}

function fmtPct(value: number | null | undefined): string {
  if (value == null) return '--';
  return `${value.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Update Dialog
// ---------------------------------------------------------------------------

function UpdatePRNDialog({
  obligation,
  onSave,
}: {
  obligation: EPRPRNObligation;
  onSave: (obligationId: string, purchased: number, costPerTonne: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purchased, setPurchased] = useState(String(obligation.prns_purchased_tonnage || 0));
  const [costPerTonne, setCostPerTonne] = useState(String(obligation.prn_cost_per_tonne_gbp || 0));

  const handleOpen = () => {
    setPurchased(String(obligation.prns_purchased_tonnage || 0));
    setCostPerTonne(String(obligation.prn_cost_per_tonne_gbp || 0));
    setOpen(true);
  };

  const handleSave = async () => {
    const purchasedNum = parseFloat(purchased);
    const costNum = parseFloat(costPerTonne);

    if (isNaN(purchasedNum) || purchasedNum < 0) {
      toast.error('PRNs purchased must be a valid non-negative number');
      return;
    }
    if (isNaN(costNum) || costNum < 0) {
      toast.error('Cost per tonne must be a valid non-negative number');
      return;
    }

    setSaving(true);
    try {
      await onSave(obligation.id, purchasedNum, costNum);
      setOpen(false);
    } catch {
      // Error already handled via toast in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        <Pencil className="h-3.5 w-3.5 mr-1.5" />
        Update
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update PRN Purchase</DialogTitle>
            <DialogDescription>
              Record PRN purchases for {obligation.material_name} ({obligation.material_code})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Obligation Tonnage</Label>
              <p className="text-sm text-muted-foreground font-mono">
                {fmtTonnes(obligation.obligation_tonnage)} tonnes
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prns-purchased">PRNs Purchased (tonnes)</Label>
              <Input
                id="prns-purchased"
                type="number"
                min="0"
                step="0.001"
                value={purchased}
                onChange={(e) => setPurchased(e.target.value)}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost-per-tonne">Cost per Tonne (GBP)</Label>
              <Input
                id="cost-per-tonne"
                type="number"
                min="0"
                step="0.01"
                value={costPerTonne}
                onChange={(e) => setCostPerTonne(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {purchased && costPerTonne && (
              <div className="space-y-2">
                <Label>Estimated Total Cost</Label>
                <p className="text-sm font-mono text-neon-lime">
                  {fmtGBP(parseFloat(purchased) * parseFloat(costPerTonne))}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Locked State
// ---------------------------------------------------------------------------

function LockedView() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 max-w-2xl mx-auto text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 border border-border mb-4">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">PRN Tracker</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Track your Packaging Recovery Note obligations, record purchases, and monitor fulfilment
        across all material types. Available on the Canopy plan.
      </p>
      <div className="rounded-lg border border-neon-lime/30 bg-neon-lime/5 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Upgrade to Canopy</h3>
          <Sparkles className="h-5 w-5 text-neon-lime" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Unlock PRN tracking, advanced compliance tools, and full EPR management capabilities.
        </p>
        <Link href="/settings/">
          <Button className="w-full gap-2">
            <Sparkles className="h-4 w-4" />
            Upgrade to Canopy
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PRNTrackerPage() {
  const { currentOrganization } = useOrganization();
  const { tierLevel, isLoading: tierLoading } = useSubscription();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [obligations, setObligations] = useState<EPRPRNObligation[]>([]);
  const [summary, setSummary] = useState<PRNSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [feeData, setFeeData] = useState<{ total_fee_gbp: number } | null>(null);

  // ---- Fetch obligations ----
  const fetchObligations = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/epr/prn?organizationId=${currentOrganization.id}&year=${year}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch PRN obligations');
      }
      const data: PRNResponse = await res.json();
      setObligations(data.obligations);
      setSummary(data.summary);
    } catch (err) {
      console.error('Error fetching PRN data:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load PRN data');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, year]);

  // ---- Fetch fee data for combined cost view ----
  const fetchFeeData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const res = await fetch(
        `/api/epr/calculate-fees?organizationId=${currentOrganization.id}&fee_year=${year}`
      );
      if (res.ok) {
        const data = await res.json();
        setFeeData({ total_fee_gbp: data.total_fee_gbp ?? 0 });
      }
    } catch {
      // Fee data is optional; silently fail
    }
  }, [currentOrganization?.id, year]);

  useEffect(() => {
    if (tierLevel >= 3) {
      fetchObligations();
      fetchFeeData();
    }
  }, [tierLevel, fetchObligations, fetchFeeData]);

  // ---- Save handler ----
  const handleSave = async (
    obligationId: string,
    prns_purchased_tonnage: number,
    prn_cost_per_tonne_gbp: number
  ) => {
    if (!currentOrganization?.id) return;

    const res = await fetch('/api/epr/prn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: currentOrganization.id,
        obligationId,
        prns_purchased_tonnage,
        prn_cost_per_tonne_gbp,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || 'Failed to update PRN purchase');
      throw new Error(err.error);
    }

    toast.success('PRN purchase updated');
    await fetchObligations();
  };

  // ---- Loading state ----
  if (tierLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // ---- Tier gate ----
  if (tierLevel < 3) {
    return <LockedView />;
  }

  // ---- Derived values ----
  const totalPRNSpend = summary?.total_prn_spend_gbp ?? 0;
  const fulfilmentPct = summary?.overall_fulfilment_pct ?? 0;
  const totalEPRFees = feeData?.total_fee_gbp ?? 0;
  const totalComplianceCost = totalPRNSpend + totalEPRFees;
  const hasFeeData = feeData !== null && totalEPRFees > 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Recycle className="h-6 w-6 text-neon-lime" />
            PRN Tracker
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your Packaging Recovery Note obligations and track fulfilment across material types
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchObligations();
              fetchFeeData();
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-lime/10">
                <PoundSterling className="h-5 w-5 text-neon-lime" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total PRN Spend</p>
                <p className="text-xl font-bold font-mono">{fmtGBP(totalPRNSpend)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Overall Fulfilment</p>
                <p className="text-xl font-bold font-mono">{fmtPct(fulfilmentPct)}</p>
              </div>
            </div>
            <Progress
              value={Math.min(fulfilmentPct, 100)}
              className="mt-3 h-2"
              indicatorColor={fulfilmentPct >= 100 ? 'lime' : fulfilmentPct >= 50 ? 'cyan' : 'purple'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Package className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Materials Tracked</p>
                <p className="text-xl font-bold font-mono">
                  {summary?.fulfilled_count ?? 0} / {summary?.materials_count ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">fulfilled</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combined Cost View */}
      {hasFeeData && (
        <Card className="bg-neon-lime/5 border-neon-lime/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Combined Compliance Cost ({year})
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono">{fmtGBP(totalEPRFees)}</span>
                  <span className="text-muted-foreground">EPR Fees</span>
                  <span className="text-muted-foreground">+</span>
                  <span className="font-mono">{fmtGBP(totalPRNSpend)}</span>
                  <span className="text-muted-foreground">PRN Costs</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="font-mono text-base font-bold text-neon-lime">
                    {fmtGBP(totalComplianceCost)}
                  </span>
                  <span className="text-muted-foreground font-medium">Total</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Obligations Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">PRN Obligations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : obligations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Recycle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No PRN obligations found for {year}.</p>
              <p className="text-xs mt-1">
                Obligations are auto-generated from your packaging data. Ensure products have
                packaging materials and production logs recorded.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Tonnage Placed</TableHead>
                    <TableHead className="text-right">Target %</TableHead>
                    <TableHead className="text-right">Obligation</TableHead>
                    <TableHead className="text-right">Purchased</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Cost/Tonne</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {obligations.map((ob) => {
                    const remaining = Math.max(0, ob.obligation_tonnage - ob.prns_purchased_tonnage);
                    return (
                      <TableRow key={ob.id}>
                        <TableCell className="font-medium">
                          <div>
                            <span>{ob.material_name}</span>
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({ob.material_code})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtTonnes(ob.total_tonnage_placed)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtPct(ob.recycling_target_pct)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtTonnes(ob.obligation_tonnage)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtTonnes(ob.prns_purchased_tonnage)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {remaining > 0 ? (
                            <span className="text-orange-400">{fmtTonnes(remaining)}</span>
                          ) : (
                            <span className="text-green-400">0.000</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtGBP(ob.prn_cost_per_tonne_gbp)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtGBP(ob.total_prn_cost_gbp)}
                        </TableCell>
                        <TableCell className="text-center">
                          {statusBadge(ob.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <UpdatePRNDialog obligation={ob} onSave={handleSave} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
