'use client';

import { useState } from 'react';
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
  DialogTrigger,
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
} from 'lucide-react';

interface EvidenceLink {
  id: string;
  requirement_id: string;
  evidence_type: 'document' | 'data_link' | 'policy' | 'metric' | 'external_url';
  source_module: string | null;
  source_table: string | null;
  evidence_description: string;
  document_url: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  verified_by: string | null;
  verification_date: string | null;
  requirement?: {
    requirement_code: string;
    requirement_name: string;
    category: string;
  };
}

interface EvidenceLinkerProps {
  evidence: EvidenceLink[];
  requirementId?: string;
  frameworkId: string;
  onCreateEvidence: (data: CreateEvidenceInput) => Promise<void>;
  onDeleteEvidence: (id: string) => Promise<void>;
  onVerifyEvidence: (id: string) => Promise<void>;
  loading?: boolean;
}

interface CreateEvidenceInput {
  framework_id: string;
  requirement_id: string;
  evidence_type: EvidenceLink['evidence_type'];
  evidence_description: string;
  source_module?: string;
  source_table?: string;
  document_url?: string;
  notes?: string;
}

const evidenceTypeConfig = {
  document: { label: 'Document', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  data_link: { label: 'Data Link', icon: Database, color: 'bg-purple-100 text-purple-700' },
  policy: { label: 'Policy', icon: FileCheck, color: 'bg-emerald-100 text-emerald-700' },
  metric: { label: 'Metric', icon: Database, color: 'bg-amber-100 text-amber-700' },
  external_url: { label: 'External URL', icon: ExternalLink, color: 'bg-slate-100 text-slate-700' },
};

const verificationStatusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-amber-100 text-amber-700' },
  verified: { label: 'Verified', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-700' },
};

const sourceModuleOptions = [
  { value: 'people_culture', label: 'People & Culture' },
  { value: 'governance', label: 'Governance' },
  { value: 'community_impact', label: 'Community Impact' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'supply_chain', label: 'Supply Chain' },
];

export function EvidenceLinker({
  evidence,
  requirementId,
  frameworkId,
  onCreateEvidence,
  onDeleteEvidence,
  onVerifyEvidence,
  loading,
}: EvidenceLinkerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateEvidenceInput>>({
    evidence_type: 'document',
    evidence_description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!requirementId || !formData.evidence_description) return;

    setSubmitting(true);
    try {
      await onCreateEvidence({
        framework_id: frameworkId,
        requirement_id: requirementId,
        evidence_type: formData.evidence_type || 'document',
        evidence_description: formData.evidence_description,
        source_module: formData.source_module,
        document_url: formData.document_url,
      });
      setIsDialogOpen(false);
      setFormData({ evidence_type: 'document', evidence_description: '' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEvidence = requirementId
    ? evidence.filter(e => e.requirement_id === requirementId)
    : evidence;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-blue-600" />
              Evidence Links
            </CardTitle>
            <CardDescription>
              Link evidence to support certification requirements
            </CardDescription>
          </div>
          {requirementId && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Evidence
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link Evidence</DialogTitle>
                  <DialogDescription>
                    Add evidence to support this requirement
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Evidence Type</Label>
                    <Select
                      value={formData.evidence_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, evidence_type: value as EvidenceLink['evidence_type'] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(evidenceTypeConfig).map(([value, config]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.evidence_type === 'data_link' && (
                    <div className="space-y-2">
                      <Label>Source Module</Label>
                      <Select
                        value={formData.source_module || ''}
                        onValueChange={(value) =>
                          setFormData({ ...formData, source_module: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select module" />
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

                  {(formData.evidence_type === 'document' ||
                    formData.evidence_type === 'external_url') && (
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input
                        value={formData.document_url || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, document_url: e.target.value })
                        }
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.evidence_description || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, evidence_description: e.target.value })
                      }
                      placeholder="Describe how this evidence supports the requirement..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !formData.evidence_description}
                  >
                    {submitting ? 'Adding...' : 'Add Evidence'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filteredEvidence.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <LinkIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No evidence linked yet.</p>
            {requirementId && (
              <p className="text-sm">Click &quot;Add Evidence&quot; to link supporting documentation.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvidence.map((item) => {
              const typeConfig = evidenceTypeConfig[item.evidence_type];
              const statusConfig = verificationStatusConfig[item.verification_status];
              const TypeIcon = typeConfig.icon;
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{item.evidence_description}</span>
                        <Badge className={`text-xs ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                      {item.source_module && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Source: {sourceModuleOptions.find(o => o.value === item.source_module)?.label}
                        </p>
                      )}
                      {item.document_url && (
                        <a
                          href={item.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
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
                  <div className="flex items-center gap-2">
                    {item.verification_status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onVerifyEvidence(item.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteEvidence(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
