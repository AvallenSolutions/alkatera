'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Package,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  FileText,
  Send,
  Loader2,
} from 'lucide-react';

interface Requirement {
  id: string;
  requirement_code: string;
  requirement_name: string;
  category: string;
  compliance_status?: string;
}

interface EvidenceItem {
  id: string;
  requirement_id: string;
  evidence_type: string;
  evidence_description: string;
  verification_status: string;
}

interface AuditPackageBuilderProps {
  frameworkId: string;
  frameworkName: string;
  compliantRequirements: Requirement[];
  evidence: EvidenceItem[];
  onCreatePackage: (data: {
    framework_id: string;
    package_name: string;
    description?: string;
    included_requirements: string[];
    included_evidence: string[];
    executive_summary?: string;
    methodology?: string;
    notes?: string;
  }) => Promise<any>;
  onCancel: () => void;
}

type Step = 'requirements' | 'evidence' | 'details' | 'review';

export function AuditPackageBuilder({
  frameworkId,
  frameworkName,
  compliantRequirements,
  evidence,
  onCreatePackage,
  onCancel,
}: AuditPackageBuilderProps) {
  const [currentStep, setCurrentStep] = useState<Step>('requirements');
  const [selectedRequirements, setSelectedRequirements] = useState<Set<string>>(
    new Set(compliantRequirements.map(r => r.id))
  );
  const [selectedEvidence, setSelectedEvidence] = useState<Set<string>>(
    new Set(evidence.filter(e => e.verification_status === 'verified').map(e => e.id))
  );
  const [packageName, setPackageName] = useState(`${frameworkName} Audit Package`);
  const [description, setDescription] = useState('');
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [methodology, setMethodology] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'requirements', label: 'Requirements', icon: <CheckCircle2 className="h-4 w-4" /> },
    { key: 'evidence', label: 'Evidence', icon: <FileText className="h-4 w-4" /> },
    { key: 'details', label: 'Details', icon: <Package className="h-4 w-4" /> },
    { key: 'review', label: 'Review', icon: <Send className="h-4 w-4" /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const toggleRequirement = (id: string) => {
    setSelectedRequirements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleEvidence = (id: string) => {
    setSelectedEvidence(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Filter evidence for selected requirements
  const relevantEvidence = useMemo(() => {
    return evidence.filter(e => selectedRequirements.has(e.requirement_id));
  }, [evidence, selectedRequirements]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onCreatePackage({
        framework_id: frameworkId,
        package_name: packageName,
        description: description || undefined,
        included_requirements: Array.from(selectedRequirements),
        included_evidence: Array.from(selectedEvidence),
        executive_summary: executiveSummary || undefined,
        methodology: methodology || undefined,
        notes: notes || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'requirements':
        return selectedRequirements.size > 0;
      case 'evidence':
        return true; // Evidence is optional
      case 'details':
        return packageName.trim().length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-600" />
          Build Audit Package
        </CardTitle>
        <CardDescription>
          Compile compliant requirements and evidence into a submission-ready package
        </CardDescription>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center">
              {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
              <button
                onClick={() => index <= currentStepIndex && setCurrentStep(step.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                  step.key === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : index < currentStepIndex
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 cursor-pointer'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.icon}
                {step.label}
              </button>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Select Requirements */}
        {currentStep === 'requirements' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Select compliant requirements to include ({selectedRequirements.size} selected)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRequirements(new Set(compliantRequirements.map(r => r.id)))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRequirements(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {compliantRequirements.map(req => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedRequirements.has(req.id)}
                    onCheckedChange={() => toggleRequirement(req.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {req.requirement_code}
                      </code>
                      <span className="text-sm">{req.requirement_name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{req.category}</span>
                  </div>
                </div>
              ))}
              {compliantRequirements.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No compliant requirements available. Mark requirements as compliant in gap analysis first.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Evidence */}
        {currentStep === 'evidence' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Select evidence to include ({selectedEvidence.size} selected)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEvidence(new Set(relevantEvidence.map(e => e.id)))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEvidence(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {relevantEvidence.map(ev => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedEvidence.has(ev.id)}
                    onCheckedChange={() => toggleEvidence(ev.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          ev.verification_status === 'verified'
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-amber-500 text-amber-600'
                        }`}
                      >
                        {ev.verification_status}
                      </Badge>
                      <span className="text-sm">{ev.evidence_description}</span>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {ev.evidence_type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {relevantEvidence.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No evidence linked to selected requirements. You can skip this step.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Package Details */}
        {currentStep === 'details' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pkg-name">Package Name</Label>
              <Input
                id="pkg-name"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="e.g., B Corp 2026 Q1 Submission"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-desc">Description</Label>
              <Textarea
                id="pkg-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this audit package..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-summary">Executive Summary (Optional)</Label>
              <Textarea
                id="pkg-summary"
                value={executiveSummary}
                onChange={(e) => setExecutiveSummary(e.target.value)}
                placeholder="High-level summary of compliance status..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-notes">Notes (Optional)</Label>
              <Textarea
                id="pkg-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes for reviewers..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 'review' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Package Name</p>
                <p className="text-sm text-muted-foreground mt-1">{packageName}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Framework</p>
                <p className="text-sm text-muted-foreground mt-1">{frameworkName}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Requirements Included</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{selectedRequirements.size}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Evidence Items</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{selectedEvidence.size}</p>
              </div>
            </div>
            {description && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
            )}
            {executiveSummary && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Executive Summary</p>
                <p className="text-sm text-muted-foreground mt-1">{executiveSummary}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStepIndex === 0) {
                onCancel();
              } else {
                setCurrentStep(steps[currentStepIndex - 1].key);
              }
            }}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep === 'review' ? (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {submitting ? 'Creating...' : 'Create Package'}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep(steps[currentStepIndex + 1].key)}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
