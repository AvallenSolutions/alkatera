'use client';

import { useState } from 'react';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase,
  PlusCircle,
  RefreshCw,
  Upload,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { FairWorkDashboard } from '@/components/people-culture/FairWorkDashboard';
import { useFairWorkMetrics, type CompensationRecord } from '@/hooks/data/useFairWorkMetrics';

// ─── Shared form fields ─────────────────────────────────────────────────────

interface CompensationFormData {
  role_title: string;
  department: string;
  employment_type: string;
  annual_salary: string;
  hourly_rate: string;
  work_country: string;
  work_region: string;
  gender: string;
  role_level: string;
}

const emptyForm: CompensationFormData = {
  role_title: '',
  department: '',
  employment_type: 'full_time',
  annual_salary: '',
  hourly_rate: '',
  work_country: 'United Kingdom',
  work_region: '',
  gender: '',
  role_level: '',
};

function CompensationFormFields({
  formData,
  setFormData,
}: {
  formData: CompensationFormData;
  setFormData: (data: CompensationFormData) => void;
}) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role_title">Role Title</Label>
          <Input
            id="role_title"
            value={formData.role_title}
            onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
            placeholder="e.g., Software Engineer"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            placeholder="e.g., Engineering"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="employment_type">Employment Type *</Label>
          <Select
            value={formData.employment_type}
            onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full Time</SelectItem>
              <SelectItem value="part_time">Part Time</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role_level">Role Level</Label>
          <Select
            value={formData.role_level}
            onValueChange={(value) => setFormData({ ...formData, role_level: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entry">Entry Level</SelectItem>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="mid">Mid Level</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="director">Director</SelectItem>
              <SelectItem value="executive">Executive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="annual_salary">Annual Salary ({'\u00A3'})</Label>
          <Input
            id="annual_salary"
            type="number"
            value={formData.annual_salary}
            onChange={(e) => setFormData({ ...formData, annual_salary: e.target.value })}
            placeholder="e.g., 45000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hourly_rate">Hourly Rate ({'\u00A3'})</Label>
          <Input
            id="hourly_rate"
            type="number"
            step="0.01"
            value={formData.hourly_rate}
            onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
            placeholder="e.g., 21.63"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="work_country">Country</Label>
          <Select
            value={formData.work_country}
            onValueChange={(value) => setFormData({ ...formData, work_country: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="United Kingdom">United Kingdom</SelectItem>
              <SelectItem value="Ireland">Ireland</SelectItem>
              <SelectItem value="United States">United States</SelectItem>
              <SelectItem value="Germany">Germany</SelectItem>
              <SelectItem value="France">France</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="work_region">Region</Label>
          <Input
            id="work_region"
            value={formData.work_region}
            onChange={(e) => setFormData({ ...formData, work_region: e.target.value })}
            placeholder="e.g., London"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gender">Gender (for pay gap analysis)</Label>
        <Select
          value={formData.gender}
          onValueChange={(value) => setFormData({ ...formData, gender: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="non_binary">Non-binary</SelectItem>
            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Helper: get auth headers ───────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('@/lib/supabaseClient');
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

// ─── Add Compensation Dialog ────────────────────────────────────────────────

function AddCompensationDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CompensationFormData>({ ...emptyForm });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const headers = await getAuthHeaders();

      const response = await fetch('/api/people-culture/compensation', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          annual_salary: formData.annual_salary ? parseFloat(formData.annual_salary) : null,
          hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add compensation record');
      }

      setOpen(false);
      setFormData({ ...emptyForm });
      toast.success('Compensation record added');
      onSuccess();
    } catch (error) {
      console.error('Error adding compensation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Compensation Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Compensation Record</DialogTitle>
          <DialogDescription>
            Add anonymised employee compensation data for fair work analysis
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <CompensationFormFields formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Compensation Dialog ───────────────────────────────────────────────

function EditCompensationDialog({
  record,
  open,
  onOpenChange,
  onSuccess,
}: {
  record: CompensationRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CompensationFormData>({
    role_title: record.role_title || '',
    department: record.department || '',
    employment_type: record.employment_type || 'full_time',
    annual_salary: record.annual_salary != null ? String(record.annual_salary) : '',
    hourly_rate: record.hourly_rate != null ? String(record.hourly_rate) : '',
    work_country: record.work_country || 'United Kingdom',
    work_region: record.work_region || '',
    gender: record.gender || '',
    role_level: record.role_level || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const headers = await getAuthHeaders();

      const response = await fetch('/api/people-culture/compensation', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          id: record.id,
          ...formData,
          annual_salary: formData.annual_salary ? parseFloat(formData.annual_salary) : null,
          hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update compensation record');
      }

      onOpenChange(false);
      toast.success('Compensation record updated');
      onSuccess();
    } catch (error) {
      console.error('Error updating compensation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Compensation Record</DialogTitle>
          <DialogDescription>
            Update remuneration details for {record.role_title || 'this employee'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <CompensationFormFields formData={formData} setFormData={setFormData} />
          <DialogFooter>
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

// ─── Page ───────────────────────────────────────────────────────────────────

export default function FairWorkPage() {
  return (
    <FeatureGate feature="people_fair_work">
      <FairWorkPageContent />
    </FeatureGate>
  );
}

function FairWorkPageContent() {
  const { metrics, loading, refetch } = useFairWorkMetrics();
  const [editingRecord, setEditingRecord] = useState<CompensationRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<CompensationRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingRecord) return;
    setIsDeleting(true);

    try {
      const headers = await getAuthHeaders();

      const response = await fetch('/api/people-culture/compensation', {
        method: 'DELETE',
        headers,
        credentials: 'include',
        body: JSON.stringify({ id: deletingRecord.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete record');
      }

      setDeletingRecord(null);
      toast.success('Compensation record removed');
      refetch();
    } catch (error) {
      console.error('Error deleting compensation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/people-culture">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-blue-600" />
              Fair Work
            </h1>
            <p className="text-muted-foreground mt-1">
              Living wage compliance, pay equity, and compensation analytics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <AddCompensationDialog onSuccess={refetch} />
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>About Fair Work:</strong> Track compensation data to analyse living wage compliance,
            gender pay gaps, and pay ratios. Data is anonymised and supports UK Gender Pay Gap Reporting
            and B Corp Fair Work requirements.
          </p>
        </CardContent>
      </Card>

      {/* Dashboard */}
      <FairWorkDashboard
        metrics={metrics}
        isLoading={loading}
        onEditRecord={setEditingRecord}
        onDeleteRecord={setDeletingRecord}
      />

      {/* Edit Dialog */}
      {editingRecord && (
        <EditCompensationDialog
          record={editingRecord}
          open={!!editingRecord}
          onOpenChange={(open) => { if (!open) setEditingRecord(null); }}
          onSuccess={refetch}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRecord} onOpenChange={(open) => { if (!open) setDeletingRecord(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove compensation record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the record for {deletingRecord?.role_title || 'this employee'}{deletingRecord?.department ? ` (${deletingRecord.department})` : ''} from your fair work analysis.
              The data is retained for audit purposes but will no longer appear in calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
