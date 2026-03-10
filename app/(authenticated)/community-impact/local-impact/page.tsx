'use client';

import { useState, useEffect, useCallback } from 'react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, PlusCircle, TrendingUp, Users, Building2, Pencil, Trash2 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import Link from 'next/link';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface LocalImpactRecord {
  id: string;
  organization_id: string;
  reporting_year: number;
  reporting_quarter: number | null;
  total_employees: number | null;
  local_employees: number | null;
  local_definition: string | null;
  total_procurement_spend: number | null;
  local_procurement_spend: number | null;
  local_supplier_count: number | null;
  total_supplier_count: number | null;
  corporate_tax_paid: number | null;
  payroll_taxes_paid: number | null;
  business_rates_paid: number | null;
  community_investment_total: number | null;
  infrastructure_investment: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LocalImpactMetrics {
  local_employment_rate: number | null;
  local_sourcing_rate: number | null;
  total_tax_contribution: number;
  community_investment: number;
}

interface LocalImpactFormData {
  reporting_year: string;
  reporting_quarter: string;
  total_employees: string;
  local_employees: string;
  local_definition: string;
  total_procurement_spend: string;
  local_procurement_spend: string;
  local_supplier_count: string;
  total_supplier_count: string;
  corporate_tax_paid: string;
  payroll_taxes_paid: string;
  business_rates_paid: string;
  community_investment_total: string;
  infrastructure_investment: string;
  notes: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

const emptyForm: LocalImpactFormData = {
  reporting_year: String(currentYear),
  reporting_quarter: '',
  total_employees: '',
  local_employees: '',
  local_definition: '',
  total_procurement_spend: '',
  local_procurement_spend: '',
  local_supplier_count: '',
  total_supplier_count: '',
  corporate_tax_paid: '',
  payroll_taxes_paid: '',
  business_rates_paid: '',
  community_investment_total: '',
  infrastructure_investment: '',
  notes: '',
};

function formatGBP(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '—';
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
}

function formToPayload(formData: LocalImpactFormData) {
  return {
    reporting_year: parseInt(formData.reporting_year),
    reporting_quarter: formData.reporting_quarter ? parseInt(formData.reporting_quarter) : null,
    total_employees: formData.total_employees ? parseInt(formData.total_employees) : null,
    local_employees: formData.local_employees ? parseInt(formData.local_employees) : null,
    local_definition: formData.local_definition || null,
    total_procurement_spend: formData.total_procurement_spend ? parseFloat(formData.total_procurement_spend) : null,
    local_procurement_spend: formData.local_procurement_spend ? parseFloat(formData.local_procurement_spend) : null,
    local_supplier_count: formData.local_supplier_count ? parseInt(formData.local_supplier_count) : null,
    total_supplier_count: formData.total_supplier_count ? parseInt(formData.total_supplier_count) : null,
    corporate_tax_paid: formData.corporate_tax_paid ? parseFloat(formData.corporate_tax_paid) : null,
    payroll_taxes_paid: formData.payroll_taxes_paid ? parseFloat(formData.payroll_taxes_paid) : null,
    business_rates_paid: formData.business_rates_paid ? parseFloat(formData.business_rates_paid) : null,
    community_investment_total: formData.community_investment_total ? parseFloat(formData.community_investment_total) : null,
    infrastructure_investment: formData.infrastructure_investment ? parseFloat(formData.infrastructure_investment) : null,
    notes: formData.notes || null,
  };
}

function recordToForm(record: LocalImpactRecord): LocalImpactFormData {
  return {
    reporting_year: String(record.reporting_year),
    reporting_quarter: record.reporting_quarter ? String(record.reporting_quarter) : '',
    total_employees: record.total_employees !== null ? String(record.total_employees) : '',
    local_employees: record.local_employees !== null ? String(record.local_employees) : '',
    local_definition: record.local_definition || '',
    total_procurement_spend: record.total_procurement_spend !== null ? String(record.total_procurement_spend) : '',
    local_procurement_spend: record.local_procurement_spend !== null ? String(record.local_procurement_spend) : '',
    local_supplier_count: record.local_supplier_count !== null ? String(record.local_supplier_count) : '',
    total_supplier_count: record.total_supplier_count !== null ? String(record.total_supplier_count) : '',
    corporate_tax_paid: record.corporate_tax_paid !== null ? String(record.corporate_tax_paid) : '',
    payroll_taxes_paid: record.payroll_taxes_paid !== null ? String(record.payroll_taxes_paid) : '',
    business_rates_paid: record.business_rates_paid !== null ? String(record.business_rates_paid) : '',
    community_investment_total: record.community_investment_total !== null ? String(record.community_investment_total) : '',
    infrastructure_investment: record.infrastructure_investment !== null ? String(record.infrastructure_investment) : '',
    notes: record.notes || '',
  };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('@/lib/supabaseClient');
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

// ─── Shared Form Fields ─────────────────────────────────────────────────────────

function LocalImpactFormFields({
  formData,
  setFormData,
}: {
  formData: LocalImpactFormData;
  setFormData: (data: LocalImpactFormData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Reporting Year *</Label>
          <Select
            value={formData.reporting_year}
            onValueChange={(v) => setFormData({ ...formData, reporting_year: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Quarter (optional)</Label>
          <Select
            value={formData.reporting_quarter}
            onValueChange={(v) => setFormData({ ...formData, reporting_quarter: v === 'none' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Full year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Full year</SelectItem>
              <SelectItem value="1">Q1</SelectItem>
              <SelectItem value="2">Q2</SelectItem>
              <SelectItem value="3">Q3</SelectItem>
              <SelectItem value="4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="employment" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="sourcing">Sourcing</TabsTrigger>
          <TabsTrigger value="investment">Investment</TabsTrigger>
        </TabsList>

        <TabsContent value="employment" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Total Employees</Label>
              <Input
                type="number"
                step="1"
                value={formData.total_employees}
                onChange={(e) => setFormData({ ...formData, total_employees: e.target.value })}
                placeholder="e.g., 50"
              />
            </div>
            <div className="space-y-2">
              <Label>Local Employees</Label>
              <Input
                type="number"
                step="1"
                value={formData.local_employees}
                onChange={(e) => setFormData({ ...formData, local_employees: e.target.value })}
                placeholder="e.g., 42"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Local Definition</Label>
            <Input
              value={formData.local_definition}
              onChange={(e) => setFormData({ ...formData, local_definition: e.target.value })}
              placeholder="e.g., Within 50 miles of production site"
            />
          </div>
        </TabsContent>

        <TabsContent value="sourcing" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Total Procurement Spend (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.total_procurement_spend}
                onChange={(e) => setFormData({ ...formData, total_procurement_spend: e.target.value })}
                placeholder="e.g., 500000"
              />
            </div>
            <div className="space-y-2">
              <Label>Local Procurement Spend (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.local_procurement_spend}
                onChange={(e) => setFormData({ ...formData, local_procurement_spend: e.target.value })}
                placeholder="e.g., 350000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Total Suppliers</Label>
              <Input
                type="number"
                step="1"
                value={formData.total_supplier_count}
                onChange={(e) => setFormData({ ...formData, total_supplier_count: e.target.value })}
                placeholder="e.g., 40"
              />
            </div>
            <div className="space-y-2">
              <Label>Local Suppliers</Label>
              <Input
                type="number"
                step="1"
                value={formData.local_supplier_count}
                onChange={(e) => setFormData({ ...formData, local_supplier_count: e.target.value })}
                placeholder="e.g., 28"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="investment" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">Tax contributions and community investment in GBP.</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Corporation Tax (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.corporate_tax_paid}
                onChange={(e) => setFormData({ ...formData, corporate_tax_paid: e.target.value })}
                placeholder="e.g., 25000"
              />
            </div>
            <div className="space-y-2">
              <Label>Payroll Taxes (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.payroll_taxes_paid}
                onChange={(e) => setFormData({ ...formData, payroll_taxes_paid: e.target.value })}
                placeholder="e.g., 80000"
              />
            </div>
            <div className="space-y-2">
              <Label>Business Rates (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.business_rates_paid}
                onChange={(e) => setFormData({ ...formData, business_rates_paid: e.target.value })}
                placeholder="e.g., 12000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Community Investment (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.community_investment_total}
                onChange={(e) => setFormData({ ...formData, community_investment_total: e.target.value })}
                placeholder="e.g., 15000"
              />
            </div>
            <div className="space-y-2">
              <Label>Infrastructure Investment (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.infrastructure_investment}
                onChange={(e) => setFormData({ ...formData, infrastructure_investment: e.target.value })}
                placeholder="e.g., 30000"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any additional context..."
          rows={2}
        />
      </div>
    </div>
  );
}

// ─── Add Dialog ─────────────────────────────────────────────────────────────────

function AddLocalImpactDialog({ onSuccess }: { onSuccess: () => void }) {
  const { currentOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<LocalImpactFormData>({ ...emptyForm });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id) return;
    setIsSubmitting(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/community-impact/local-impact', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...formToPayload(formData),
          organization_id: currentOrganization.id,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add local impact data');
      }

      toast.success('Local impact data added successfully');
      setOpen(false);
      setFormData({ ...emptyForm });
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add local impact data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Local Impact Data</DialogTitle>
          <DialogDescription>
            Record local economic impact metrics for a reporting period.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <LocalImpactFormFields formData={formData} setFormData={setFormData} />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Add Data'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog ────────────────────────────────────────────────────────────────

function EditLocalImpactDialog({
  record,
  open,
  onOpenChange,
  onSuccess,
}: {
  record: LocalImpactRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<LocalImpactFormData>(recordToForm(record));

  useEffect(() => {
    if (open) {
      setFormData(recordToForm(record));
    }
  }, [open, record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/community-impact/local-impact', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          id: record.id,
          ...formToPayload(formData),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update record');
      }

      toast.success('Local impact data updated');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Local Impact Data</DialogTitle>
          <DialogDescription>
            Update the record for {record.reporting_year}
            {record.reporting_quarter ? ` Q${record.reporting_quarter}` : ''}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <LocalImpactFormFields formData={formData} setFormData={setFormData} />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function LocalImpactPage() {
  return (
    <FeatureGate feature="community_local_impact">
      <LocalImpactPageContent />
    </FeatureGate>
  );
}

function LocalImpactPageContent() {
  const { currentOrganization } = useOrganization();
  const [records, setRecords] = useState<LocalImpactRecord[]>([]);
  const [metrics, setMetrics] = useState<LocalImpactMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<LocalImpactRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<LocalImpactRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const response = await fetch(
        `/api/community-impact/local-impact?organization_id=${currentOrganization.id}`
      );
      if (response.ok) {
        const result = await response.json();
        setRecords(result.records || []);
        setMetrics(result.metrics || null);
      }
    } catch (error) {
      console.error('Error fetching local impact data:', error);
      toast.error('Failed to load local impact data');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchData();
    }
  }, [currentOrganization?.id, fetchData]);

  const handleDelete = async () => {
    if (!deletingRecord) return;
    setIsDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/community-impact/local-impact', {
        method: 'DELETE',
        headers,
        credentials: 'include',
        body: JSON.stringify({ id: deletingRecord.id }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete record');
      }
      setDeletingRecord(null);
      toast.success('Local impact record removed');
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatPeriod = (r: LocalImpactRecord) =>
    r.reporting_quarter ? `${r.reporting_year} Q${r.reporting_quarter}` : String(r.reporting_year);

  const formatRatio = (local: number | null, total: number | null) => {
    if (local === null && total === null) return '—';
    return `${local ?? 0} / ${total ?? 0}`;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/community-impact" className="text-muted-foreground hover:text-foreground">
              Community & Impact
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">Local Impact</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-2">
            <MapPin className="h-6 w-6 text-emerald-600" />
            Local Economic Impact
          </h1>
          <p className="text-muted-foreground mt-1">
            Track local employment, sourcing, and community investment
          </p>
        </div>
        <AddLocalImpactDialog onSuccess={fetchData} />
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Local Employment</p>
                <p className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-16" /> : formatPercent(metrics?.local_employment_rate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Local Sourcing</p>
                <p className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-16" /> : formatPercent(metrics?.local_sourcing_rate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Community Investment</p>
                <p className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-16" /> : formatGBP(metrics?.community_investment)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Local Impact Records</CardTitle>
          <CardDescription>Historical data by reporting period</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No local impact data logged yet. Click &quot;Add Data&quot; to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Employees (local / total)</TableHead>
                    <TableHead>Procurement (local / total)</TableHead>
                    <TableHead>Suppliers (local / total)</TableHead>
                    <TableHead>Tax Contribution</TableHead>
                    <TableHead>Community Investment</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const taxTotal = (record.corporate_tax_paid || 0)
                      + (record.payroll_taxes_paid || 0)
                      + (record.business_rates_paid || 0);
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{formatPeriod(record)}</TableCell>
                        <TableCell>{formatRatio(record.local_employees, record.total_employees)}</TableCell>
                        <TableCell>
                          {record.local_procurement_spend !== null || record.total_procurement_spend !== null
                            ? `${formatGBP(record.local_procurement_spend)} / ${formatGBP(record.total_procurement_spend)}`
                            : '—'}
                        </TableCell>
                        <TableCell>{formatRatio(record.local_supplier_count, record.total_supplier_count)}</TableCell>
                        <TableCell>{taxTotal > 0 ? formatGBP(taxTotal) : '—'}</TableCell>
                        <TableCell>{formatGBP(record.community_investment_total)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingRecord(record)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingRecord(record)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Edit Dialog */}
      {editingRecord && (
        <EditLocalImpactDialog
          record={editingRecord}
          open={!!editingRecord}
          onOpenChange={(open) => { if (!open) setEditingRecord(null); }}
          onSuccess={fetchData}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRecord} onOpenChange={(open) => { if (!open) setDeletingRecord(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete local impact record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the record for{' '}
              {deletingRecord && (
                <span className="font-medium">
                  {deletingRecord.reporting_year}
                  {deletingRecord.reporting_quarter ? ` Q${deletingRecord.reporting_quarter}` : ''}
                </span>
              )}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
