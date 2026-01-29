'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Package,
  Plus,
  Trash2,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  Edit3,
  FileText,
  Calendar,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { useAuditPackages, AuditPackage } from '@/hooks/data/useAuditPackages';
import { useCertificationFrameworks } from '@/hooks/data/useCertificationFrameworks';
import { toast } from 'sonner';

const statusConfig: Record<AuditPackage['status'], { label: string; icon: typeof Clock; color: string }> = {
  draft: { label: 'Draft', icon: Edit3, color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  in_review: { label: 'In Review', icon: Eye, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  submitted: { label: 'Submitted', icon: Send, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  accepted: { label: 'Accepted', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const packageTypeConfig: Record<string, { label: string; description: string }> = {
  full_assessment: { label: 'Full Assessment', description: 'Complete initial certification audit' },
  partial_update: { label: 'Partial Update', description: 'Incremental update to existing certification' },
  annual_review: { label: 'Annual Review', description: 'Periodic review submission' },
};

interface Framework {
  id: string;
  name: string;
  code: string;
}

export function AuditPackageManager() {
  const { frameworks } = useCertificationFrameworks(true);
  const {
    packages,
    statusSummary,
    loading,
    createPackage,
    updatePackage,
    deletePackage,
  } = useAuditPackages();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [frameworkFilter, setFrameworkFilter] = useState('all');
  const [showGuide, setShowGuide] = useState(false);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    framework_id: '',
    package_name: '',
    package_type: 'full_assessment' as AuditPackage['package_type'],
    description: '',
    submission_deadline: '',
    executive_summary: '',
    methodology: '',
  });
  const [creating, setCreating] = useState(false);

  // Detail/edit dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<AuditPackage | null>(null);
  const [editForm, setEditForm] = useState({
    package_name: '',
    package_type: 'full_assessment' as AuditPackage['package_type'],
    description: '',
    submission_deadline: '',
    executive_summary: '',
    methodology: '',
    review_notes: '',
  });
  const [updating, setUpdating] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<AuditPackage | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Status transition dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ pkg: AuditPackage; newStatus: AuditPackage['status'] } | null>(null);

  // Filter packages
  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = !searchTerm ||
        pkg.package_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.framework?.framework_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
      const matchesFramework = frameworkFilter === 'all' || pkg.framework_id === frameworkFilter;
      return matchesSearch && matchesStatus && matchesFramework;
    });
  }, [packages, searchTerm, statusFilter, frameworkFilter]);

  // Handlers
  const handleCreate = async () => {
    if (!createForm.framework_id || !createForm.package_name) return;
    setCreating(true);
    try {
      await createPackage({
        framework_id: createForm.framework_id,
        package_name: createForm.package_name,
        package_type: createForm.package_type,
        description: createForm.description || undefined,
        submission_deadline: createForm.submission_deadline || undefined,
        executive_summary: createForm.executive_summary || undefined,
        methodology: createForm.methodology || undefined,
      });
      toast.success('Audit package created');
      setCreateDialogOpen(false);
      resetCreateForm();
    } catch {
      toast.error('Failed to create audit package');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDetail = (pkg: AuditPackage) => {
    setSelectedPackage(pkg);
    setEditForm({
      package_name: pkg.package_name,
      package_type: pkg.package_type,
      description: pkg.description || '',
      submission_deadline: pkg.submission_deadline || '',
      executive_summary: pkg.executive_summary || '',
      methodology: pkg.methodology || '',
      review_notes: pkg.review_notes || '',
    });
    setDetailDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedPackage) return;
    setUpdating(true);
    try {
      await updatePackage({
        id: selectedPackage.id,
        package_name: editForm.package_name,
        package_type: editForm.package_type,
        description: editForm.description || undefined,
        submission_deadline: editForm.submission_deadline || undefined,
        executive_summary: editForm.executive_summary || undefined,
        methodology: editForm.methodology || undefined,
        review_notes: editForm.review_notes || undefined,
      });
      toast.success('Audit package updated');
      setDetailDialogOpen(false);
      setSelectedPackage(null);
    } catch {
      toast.error('Failed to update audit package');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!packageToDelete) return;
    setDeleting(true);
    try {
      await deletePackage(packageToDelete.id);
      toast.success('Audit package deleted');
      setDeleteDialogOpen(false);
      setPackageToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete audit package');
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusTarget) return;
    setUpdating(true);
    try {
      const updateData: Record<string, unknown> = {
        id: statusTarget.pkg.id,
        status: statusTarget.newStatus,
      };
      if (statusTarget.newStatus === 'submitted') {
        updateData.submitted_date = new Date().toISOString().split('T')[0];
      }
      await updatePackage(updateData as any);
      toast.success(`Package status updated to ${statusConfig[statusTarget.newStatus].label}`);
      setStatusDialogOpen(false);
      setStatusTarget(null);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const openStatusDialog = (pkg: AuditPackage, newStatus: AuditPackage['status']) => {
    setStatusTarget({ pkg, newStatus });
    setStatusDialogOpen(true);
  };

  const resetCreateForm = () => {
    setCreateForm({
      framework_id: '',
      package_name: '',
      package_type: 'full_assessment',
      description: '',
      submission_deadline: '',
      executive_summary: '',
      methodology: '',
    });
  };

  const getNextStatuses = (current: AuditPackage['status']): AuditPackage['status'][] => {
    switch (current) {
      case 'draft': return ['in_review'];
      case 'in_review': return ['submitted', 'draft'];
      case 'submitted': return ['accepted', 'rejected'];
      case 'rejected': return ['draft'];
      case 'accepted': return [];
      default: return [];
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isOverdue = (pkg: AuditPackage) => {
    if (!pkg.submission_deadline || pkg.status === 'accepted' || pkg.status === 'submitted') return false;
    return new Date(pkg.submission_deadline) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* How to use guide */}
      <button
        onClick={() => setShowGuide(!showGuide)}
        className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900 dark:text-blue-300">How to use Audit Packages</span>
        </div>
        {showGuide ? (
          <ChevronUp className="h-4 w-4 text-blue-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-600" />
        )}
      </button>

      {showGuide && (
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-sm space-y-4">
          <p className="text-muted-foreground">
            Audit Packages let you compile your gap analysis findings, evidence, and supporting documentation into a single submission-ready package for certification bodies.
          </p>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
            <div>
              <p className="font-medium">Create a package</p>
              <p className="text-muted-foreground">Click &quot;New Package&quot; and select the certification framework. Choose a package type: Full Assessment for initial certifications, Partial Update for incremental changes, or Annual Review for periodic submissions.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">2</div>
            <div>
              <p className="font-medium">Add details</p>
              <p className="text-muted-foreground">Write an executive summary and methodology. Set a submission deadline to track your timeline. The package starts in Draft status.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">3</div>
            <div>
              <p className="font-medium">Move through the workflow</p>
              <p className="text-muted-foreground">Progress your package: Draft &rarr; In Review &rarr; Submitted &rarr; Accepted/Rejected. Use the status actions on each package card to advance the workflow.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">4</div>
            <div>
              <p className="font-medium">Manage and track</p>
              <p className="text-muted-foreground">Use filters to find packages by status or framework. Click any package to view or edit its details. Only draft packages can be deleted to protect submitted records.</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-xl font-bold">{statusSummary.total}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Edit3 className="h-4 w-4 text-slate-600" />
            <span className="text-xs text-muted-foreground">Draft</span>
          </div>
          <p className="text-xl font-bold">{statusSummary.draft}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Send className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground">Submitted</span>
          </div>
          <p className="text-xl font-bold">{statusSummary.submitted}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Accepted</span>
          </div>
          <p className="text-xl font-bold">{statusSummary.accepted}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs text-muted-foreground">Rejected</span>
          </div>
          <p className="text-xl font-bold">{statusSummary.rejected}</p>
        </div>
      </div>

      {/* Actions and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search packages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frameworks</SelectItem>
                {frameworks.map((fw: Framework) => (
                  <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Package
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Package List */}
      {filteredPackages.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              {packages.length === 0 ? 'No Audit Packages Yet' : 'No Matching Packages'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {packages.length === 0
                ? 'Create your first audit package to compile evidence and findings for a certification submission.'
                : 'Try adjusting your search or filters to find the package you are looking for.'}
            </p>
            {packages.length === 0 && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Package
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPackages.map((pkg) => {
            const config = statusConfig[pkg.status];
            const StatusIcon = config.icon;
            const overdue = isOverdue(pkg);
            const nextStatuses = getNextStatuses(pkg.status);

            return (
              <Card key={pkg.id} className={overdue ? 'border-red-300 dark:border-red-800' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg flex-shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleOpenDetail(pkg)}
                            className="font-medium text-sm hover:underline text-left"
                          >
                            {pkg.package_name}
                          </button>
                          <Badge className={`text-xs ${config.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {packageTypeConfig[pkg.package_type]?.label || pkg.package_type}
                          </Badge>
                          {overdue && (
                            <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>

                        {pkg.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {pkg.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          {pkg.framework && (
                            <span className="flex items-center gap-1">
                              <ClipboardList className="h-3 w-3" />
                              {pkg.framework.framework_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created {formatDate(pkg.created_date)}
                          </span>
                          {pkg.submission_deadline && (
                            <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                              <Clock className="h-3 w-3" />
                              Deadline {formatDate(pkg.submission_deadline)}
                            </span>
                          )}
                          {pkg.submitted_date && (
                            <span className="flex items-center gap-1">
                              <Send className="h-3 w-3" />
                              Submitted {formatDate(pkg.submitted_date)}
                            </span>
                          )}
                          {(pkg.included_requirements?.length || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {pkg.included_requirements.length} requirements
                            </span>
                          )}
                          {(pkg.included_evidence?.length || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {pkg.included_evidence.length} evidence items
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Status transition buttons */}
                      {nextStatuses.map((nextStatus) => {
                        const nextConfig = statusConfig[nextStatus];
                        const NextIcon = nextConfig.icon;
                        return (
                          <Button
                            key={nextStatus}
                            variant="ghost"
                            size="sm"
                            onClick={() => openStatusDialog(pkg, nextStatus)}
                            title={`Move to ${nextConfig.label}`}
                          >
                            <ArrowRight className="h-3 w-3 mr-1" />
                            <NextIcon className="h-4 w-4" />
                          </Button>
                        );
                      })}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetail(pkg)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {pkg.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPackageToDelete(pkg);
                            setDeleteDialogOpen(true);
                          }}
                          title="Delete package"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Package Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Audit Package</DialogTitle>
            <DialogDescription>
              Create a new audit package to compile evidence and findings for a certification submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Certification Framework <span className="text-red-500">*</span></Label>
              <Select
                value={createForm.framework_id}
                onValueChange={(value) => setCreateForm({ ...createForm, framework_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a framework..." />
                </SelectTrigger>
                <SelectContent>
                  {frameworks.map((fw: Framework) => (
                    <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Package Name <span className="text-red-500">*</span></Label>
              <Input
                value={createForm.package_name}
                onChange={(e) => setCreateForm({ ...createForm, package_name: e.target.value })}
                placeholder="e.g. B Corp 2026 Full Assessment"
              />
            </div>

            <div className="space-y-2">
              <Label>Package Type</Label>
              <Select
                value={createForm.package_type}
                onValueChange={(value) => setCreateForm({ ...createForm, package_type: value as AuditPackage['package_type'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(packageTypeConfig).map(([value, cfg]) => (
                    <SelectItem key={value} value={value}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {packageTypeConfig[createForm.package_type]?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Submission Deadline</Label>
              <Input
                type="date"
                value={createForm.submission_deadline}
                onChange={(e) => setCreateForm({ ...createForm, submission_deadline: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Brief description of this audit package..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Executive Summary</Label>
              <Textarea
                value={createForm.executive_summary}
                onChange={(e) => setCreateForm({ ...createForm, executive_summary: e.target.value })}
                placeholder="High-level overview of findings and compliance status..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Methodology</Label>
              <Textarea
                value={createForm.methodology}
                onChange={(e) => setCreateForm({ ...createForm, methodology: e.target.value })}
                placeholder="Approach and methods used for the assessment..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetCreateForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createForm.framework_id || !createForm.package_name}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Package
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail/Edit Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={(open) => { setDetailDialogOpen(open); if (!open) setSelectedPackage(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              {selectedPackage?.status === 'draft' || selectedPackage?.status === 'in_review'
                ? 'Edit Audit Package'
                : 'View Audit Package'}
            </DialogTitle>
            <DialogDescription>
              {selectedPackage?.framework?.framework_name} &mdash;{' '}
              {packageTypeConfig[selectedPackage?.package_type || '']?.label}
            </DialogDescription>
          </DialogHeader>

          {selectedPackage && (
            <div className="space-y-4 py-4">
              {/* Status bar */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge className={`${statusConfig[selectedPackage.status].color}`}>
                  {statusConfig[selectedPackage.status].label}
                </Badge>
                {selectedPackage.submitted_date && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Submitted {formatDate(selectedPackage.submitted_date)}
                  </span>
                )}
              </div>

              {/* Editable fields for draft/in_review, read-only for others */}
              {selectedPackage.status === 'draft' || selectedPackage.status === 'in_review' ? (
                <>
                  <div className="space-y-2">
                    <Label>Package Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={editForm.package_name}
                      onChange={(e) => setEditForm({ ...editForm, package_name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Package Type</Label>
                    <Select
                      value={editForm.package_type}
                      onValueChange={(value) => setEditForm({ ...editForm, package_type: value as AuditPackage['package_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(packageTypeConfig).map(([value, cfg]) => (
                          <SelectItem key={value} value={value}>{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Submission Deadline</Label>
                    <Input
                      type="date"
                      value={editForm.submission_deadline}
                      onChange={(e) => setEditForm({ ...editForm, submission_deadline: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Brief description..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Executive Summary</Label>
                    <Textarea
                      value={editForm.executive_summary}
                      onChange={(e) => setEditForm({ ...editForm, executive_summary: e.target.value })}
                      placeholder="High-level overview of findings..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Methodology</Label>
                    <Textarea
                      value={editForm.methodology}
                      onChange={(e) => setEditForm({ ...editForm, methodology: e.target.value })}
                      placeholder="Approach and methods used..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Review Notes</Label>
                    <Textarea
                      value={editForm.review_notes}
                      onChange={(e) => setEditForm({ ...editForm, review_notes: e.target.value })}
                      placeholder="Internal review notes or auditor feedback..."
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                <>
                  {selectedPackage.description && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="text-sm">{selectedPackage.description}</p>
                    </div>
                  )}
                  {selectedPackage.submission_deadline && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Submission Deadline</Label>
                      <p className="text-sm">{formatDate(selectedPackage.submission_deadline)}</p>
                    </div>
                  )}
                  {selectedPackage.executive_summary && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Executive Summary</Label>
                      <p className="text-sm whitespace-pre-wrap">{selectedPackage.executive_summary}</p>
                    </div>
                  )}
                  {selectedPackage.methodology && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Methodology</Label>
                      <p className="text-sm whitespace-pre-wrap">{selectedPackage.methodology}</p>
                    </div>
                  )}
                  {selectedPackage.review_notes && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Review Notes</Label>
                      <p className="text-sm whitespace-pre-wrap">{selectedPackage.review_notes}</p>
                    </div>
                  )}
                </>
              )}

              {/* Included items summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-xs text-muted-foreground">Requirements Included</span>
                  <p className="text-lg font-bold">{selectedPackage.included_requirements?.length || 0}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-xs text-muted-foreground">Evidence Included</span>
                  <p className="text-lg font-bold">{selectedPackage.included_evidence?.length || 0}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDetailDialogOpen(false); setSelectedPackage(null); }}>
              {selectedPackage?.status === 'draft' || selectedPackage?.status === 'in_review' ? 'Cancel' : 'Close'}
            </Button>
            {(selectedPackage?.status === 'draft' || selectedPackage?.status === 'in_review') && (
              <Button
                onClick={handleUpdate}
                disabled={updating || !editForm.package_name}
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Audit Package</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{packageToDelete?.package_name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Transition Confirmation Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Package Status</DialogTitle>
            <DialogDescription>
              {statusTarget && (
                <>
                  Move &quot;{statusTarget.pkg.package_name}&quot; from{' '}
                  <strong>{statusConfig[statusTarget.pkg.status].label}</strong> to{' '}
                  <strong>{statusConfig[statusTarget.newStatus].label}</strong>?
                  {statusTarget.newStatus === 'submitted' && (
                    <span className="block mt-2 text-amber-600">
                      This will record today as the submission date.
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
