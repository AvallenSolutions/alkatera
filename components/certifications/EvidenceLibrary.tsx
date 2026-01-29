'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  FileText,
  Link as LinkIcon,
  Database,
  FileCheck,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  Info,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Shield,
} from 'lucide-react';
import { useCertificationEvidence } from '@/hooks/data/useCertificationEvidence';
import { useCertificationFrameworks } from '@/hooks/data/useCertificationFrameworks';
import { toast } from 'sonner';

const evidenceTypeConfig = {
  document: { label: 'Document', icon: FileText, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  data_link: { label: 'Data Link', icon: Database, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  policy: { label: 'Policy', icon: FileCheck, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  metric: { label: 'Metric', icon: Database, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  external_url: { label: 'External URL', icon: ExternalLink, color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
};

const verificationStatusConfig = {
  pending: { label: 'Pending Review', icon: Clock, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  verified: { label: 'Verified', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const sourceModuleOptions = [
  { value: 'people_culture', label: 'People & Culture' },
  { value: 'governance', label: 'Governance' },
  { value: 'community_impact', label: 'Community Impact' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'supply_chain', label: 'Supply Chain' },
];

interface Framework {
  id: string;
  name: string;
  code: string;
  requirements?: { id: string; requirement_code: string; requirement_name: string; category: string }[];
}

export function EvidenceLibrary() {
  const { frameworks } = useCertificationFrameworks(true);
  const {
    evidence,
    verificationSummary,
    loading,
    refetch,
    createEvidence,
    deleteEvidence,
    verifyEvidence,
  } = useCertificationEvidence();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [frameworkFilter, setFrameworkFilter] = useState('all');
  const [showGuide, setShowGuide] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedFrameworkId, setSelectedFrameworkId] = useState('');
  const [selectedRequirementId, setSelectedRequirementId] = useState('');
  const [formData, setFormData] = useState({
    evidence_type: 'document' as keyof typeof evidenceTypeConfig,
    evidence_description: '',
    document_url: '',
    source_module: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Get requirements for selected framework
  const selectedFramework = frameworks.find((f: Framework) => f.id === selectedFrameworkId);
  const availableRequirements = selectedFramework?.requirements || [];

  // Filter evidence
  const filteredEvidence = useMemo(() => {
    return evidence.filter(item => {
      const matchesSearch = !searchTerm ||
        item.evidence_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.requirement?.requirement_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.requirement?.requirement_code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || item.evidence_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || item.verification_status === statusFilter;
      const matchesFramework = frameworkFilter === 'all' || item.framework_id === frameworkFilter;
      return matchesSearch && matchesType && matchesStatus && matchesFramework;
    });
  }, [evidence, searchTerm, typeFilter, statusFilter, frameworkFilter]);

  // Group by framework
  const evidenceByFramework = useMemo(() => {
    const grouped: Record<string, typeof filteredEvidence> = {};
    for (const item of filteredEvidence) {
      const fwId = item.framework_id;
      if (!grouped[fwId]) grouped[fwId] = [];
      grouped[fwId].push(item);
    }
    return grouped;
  }, [filteredEvidence]);

  const handleAddEvidence = async () => {
    if (!selectedFrameworkId || !selectedRequirementId || !formData.evidence_description) return;

    setSubmitting(true);
    try {
      await createEvidence({
        framework_id: selectedFrameworkId,
        requirement_id: selectedRequirementId,
        evidence_type: formData.evidence_type,
        evidence_description: formData.evidence_description,
        document_url: formData.document_url || undefined,
        source_module: formData.source_module || undefined,
        notes: formData.notes || undefined,
      });
      toast.success('Evidence added successfully');
      setAddDialogOpen(false);
      resetForm();
    } catch {
      toast.error('Failed to add evidence');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEvidence(id);
      toast.success('Evidence removed');
    } catch {
      toast.error('Failed to remove evidence');
    }
  };

  const handleVerify = async (id: string) => {
    try {
      await verifyEvidence(id, 'Current User');
      toast.success('Evidence verified');
    } catch {
      toast.error('Failed to verify evidence');
    }
  };

  const resetForm = () => {
    setSelectedFrameworkId('');
    setSelectedRequirementId('');
    setFormData({
      evidence_type: 'document',
      evidence_description: '',
      document_url: '',
      source_module: '',
      notes: '',
    });
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
          <span className="text-sm font-medium text-blue-900 dark:text-blue-300">How to use the Evidence Library</span>
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
            The Evidence Library is your central place to manage all the documents, policies, and data that prove your organisation meets certification requirements. Each piece of evidence is linked to a specific requirement in a certification framework.
          </p>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
            <div>
              <p className="font-medium">Add evidence</p>
              <p className="text-muted-foreground">Click &quot;Add Evidence&quot; to link a document, policy, URL, or data reference to a specific certification requirement. Choose the framework and requirement it applies to.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">2</div>
            <div>
              <p className="font-medium">Choose the right evidence type</p>
              <ul className="mt-1.5 space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-blue-600" /> <strong className="text-foreground">Document</strong> &mdash; PDFs, reports, certificates (provide a URL to the document)</li>
                <li className="flex items-center gap-2"><FileCheck className="h-3.5 w-3.5 text-emerald-600" /> <strong className="text-foreground">Policy</strong> &mdash; Internal policies (e.g. ethics policy, environmental policy)</li>
                <li className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-purple-600" /> <strong className="text-foreground">Data Link</strong> &mdash; Reference to data already in Alkatera (select the source module)</li>
                <li className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-amber-600" /> <strong className="text-foreground">Metric</strong> &mdash; A specific KPI or measurement that proves compliance</li>
                <li className="flex items-center gap-2"><ExternalLink className="h-3.5 w-3.5 text-slate-600" /> <strong className="text-foreground">External URL</strong> &mdash; A link to a third-party website or public resource</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">3</div>
            <div>
              <p className="font-medium">Verification workflow</p>
              <p className="text-muted-foreground">New evidence starts as &quot;Pending Review&quot;. A team member can verify it by clicking the green tick, confirming it genuinely supports the requirement. This builds an audit trail for certification bodies.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">4</div>
            <div>
              <p className="font-medium">Track coverage</p>
              <p className="text-muted-foreground">Use the summary cards and filters to see how much evidence you have, how much is verified, and which frameworks have the most coverage. When preparing for an audit, filter by framework to see all supporting evidence in one place.</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground">Total Evidence</span>
          </div>
          <p className="text-xl font-bold">{verificationSummary.total}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Verified</span>
          </div>
          <p className="text-xl font-bold">{verificationSummary.verified}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-muted-foreground">Pending Review</span>
          </div>
          <p className="text-xl font-bold">{verificationSummary.pending}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground">Frameworks Covered</span>
          </div>
          <p className="text-xl font-bold">{Object.keys(evidenceByFramework).length}</p>
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
                  placeholder="Search evidence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(evidenceTypeConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
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
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Evidence
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Evidence List */}
      {filteredEvidence.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <LinkIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              {evidence.length === 0 ? 'No Evidence Yet' : 'No Matching Evidence'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {evidence.length === 0
                ? 'Start building your evidence library by adding documents, policies, and data links that support your certification requirements.'
                : 'Try adjusting your search or filters to find the evidence you are looking for.'}
            </p>
            {evidence.length === 0 && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Evidence
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEvidence.map((item) => {
            const typeConfig = evidenceTypeConfig[item.evidence_type] || evidenceTypeConfig.document;
            const statusCfg = verificationStatusConfig[item.verification_status] || verificationStatusConfig.pending;
            const TypeIcon = typeConfig.icon;
            const StatusIcon = statusCfg.icon;
            const fw = frameworks.find((f: Framework) => f.id === item.framework_id);

            return (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-lg flex-shrink-0 ${typeConfig.color}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{item.evidence_description}</span>
                          <Badge className={`text-xs ${statusCfg.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {typeConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          {fw && (
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              {fw.name}
                            </span>
                          )}
                          {item.requirement && (
                            <span>
                              <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">
                                {item.requirement.requirement_code}
                              </code>
                              {' '}{item.requirement.requirement_name}
                            </span>
                          )}
                          {item.source_module && (
                            <span>
                              Source: {sourceModuleOptions.find(o => o.value === item.source_module)?.label}
                            </span>
                          )}
                        </div>
                        {item.document_url && (
                          <a
                            href={item.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1.5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View document
                          </a>
                        )}
                        {item.verified_by && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Verified by {item.verified_by} on{' '}
                            {new Date(item.verification_date!).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.verification_status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerify(item.id)}
                          title="Verify evidence"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        title="Remove evidence"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Evidence Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Evidence</DialogTitle>
            <DialogDescription>
              Link a document, policy, or data reference to a certification requirement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Framework selection */}
            <div className="space-y-2">
              <Label>Certification Framework</Label>
              <Select
                value={selectedFrameworkId}
                onValueChange={(value) => {
                  setSelectedFrameworkId(value);
                  setSelectedRequirementId('');
                }}
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

            {/* Requirement selection */}
            {selectedFrameworkId && (
              <div className="space-y-2">
                <Label>Requirement</Label>
                <Select
                  value={selectedRequirementId}
                  onValueChange={setSelectedRequirementId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a requirement..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRequirements.map((req: any) => (
                      <SelectItem key={req.id} value={req.id}>
                        <span className="font-mono text-xs mr-2">{req.requirement_code}</span>
                        {req.requirement_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Evidence type */}
            <div className="space-y-2">
              <Label>Evidence Type</Label>
              <Select
                value={formData.evidence_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, evidence_type: value as keyof typeof evidenceTypeConfig })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(evidenceTypeConfig).map(([value, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Source module for data links */}
            {formData.evidence_type === 'data_link' && (
              <div className="space-y-2">
                <Label>Source Module</Label>
                <Select
                  value={formData.source_module}
                  onValueChange={(value) => setFormData({ ...formData, source_module: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select module..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceModuleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* URL for documents and external URLs */}
            {(formData.evidence_type === 'document' || formData.evidence_type === 'external_url') && (
              <div className="space-y-2">
                <Label>Document URL</Label>
                <Input
                  value={formData.document_url}
                  onChange={(e) => setFormData({ ...formData, document_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label>Description <span className="text-red-500">*</span></Label>
              <Textarea
                value={formData.evidence_description}
                onChange={(e) => setFormData({ ...formData, evidence_description: e.target.value })}
                placeholder="Describe what this evidence is and how it supports the requirement..."
                rows={3}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes for reviewers..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddEvidence}
              disabled={submitting || !selectedFrameworkId || !selectedRequirementId || !formData.evidence_description}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Evidence
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
