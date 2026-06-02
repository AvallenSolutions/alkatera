'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import {
  Award,
  ArrowLeft,
  RefreshCw,
  Target,
  FileText,
  Package,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Loader2,
} from 'lucide-react';
import { GapAnalysisView } from '@/components/certifications/GapAnalysisView';
import { ReadinessBanner } from '@/components/certifications/ReadinessBanner';
import { EcgtBanner } from '@/components/certifications/EcgtBanner';
import { JourneySelectionDialog } from '@/components/certifications/JourneySelectionDialog';
import { RiskToolWizard } from '@/components/certifications/RiskToolWizard';
import { PreAuditChecklist } from '@/components/certifications/PreAuditChecklist';
import { AuditTimeline } from '@/components/certifications/AuditTimeline';
import { ClarificationRequests } from '@/components/certifications/ClarificationRequests';
import { UpcomingRequirements } from '@/components/certifications/UpcomingRequirements';
import { SupplyChainEsgCard } from '@/components/certifications/SupplyChainEsgCard';
import { StandardsBanner } from '@/components/certifications/StandardsBanner';
import { RecertBanner } from '@/components/certifications/RecertBanner';
import { useCertificationFrameworks } from '@/hooks/data/useCertificationFrameworks';
import { useCertificationScore } from '@/hooks/data/useCertificationScore';
import { useCertificationEvidence } from '@/hooks/data/useCertificationEvidence';
import { useCertificationAuditPackages } from '@/hooks/data/useCertificationAuditPackages';
import { useCertificationReadiness } from '@/hooks/data/useCertificationReadiness';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

/**
 * The complete B Corp 2026 experience. Lives on the per-framework B Corp
 * page (/certifications/bcorp_2026); the Certifications hub only links here.
 */
export function BcorpExperience() {
  const { frameworks, certifications, startCertification, refetch } =
    useCertificationFrameworks(true);
  const { refetch: refetchScores } = useCertificationScore();
  const {
    evidence,
    verificationSummary,
    loading: evidenceLoading,
    refetch: refetchEvidence,
    createEvidence,
    deleteEvidence,
    verifyEvidence,
  } = useCertificationEvidence();
  const {
    packages: auditPackages,
    statusSummary: packageStatusSummary,
    loading: packagesLoading,
    refetch: refetchPackages,
    createPackage,
    deletePackage,
  } = useCertificationAuditPackages();
  const {
    readiness,
    loading: readinessLoading,
    refetch: refetchReadiness,
  } = useCertificationReadiness();

  const [activeTab, setActiveTab] = useState('gap-analysis');
  const [blockingSignal, setBlockingSignal] = useState(0);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [riskToolOpen, setRiskToolOpen] = useState(false);
  const [checklistReady, setChecklistReady] = useState(false);
  const [exportingPackageId, setExportingPackageId] = useState<string | null>(
    null,
  );
  const [createPackageDialogOpen, setCreatePackageDialogOpen] = useState(false);
  const [newPackageName, setNewPackageName] = useState('');
  const [newPackageFramework, setNewPackageFramework] = useState('');
  const [newPackageDescription, setNewPackageDescription] = useState('');
  const [creatingPackage, setCreatingPackage] = useState(false);

  const bcorpFrameworkId =
    readiness?.frameworkId ||
    frameworks.find((f) => f.code === 'bcorp_2026')?.id ||
    null;

  // Auto-open journey selection when the org has no B Corp certification yet.
  useEffect(() => {
    if (!readinessLoading && readiness && !readiness.hasCertification) {
      setJourneyOpen(true);
    }
  }, [readinessLoading, readiness]);

  // Once a package is submitted, the audit workflow becomes the primary view.
  const hasSubmittedPackage = auditPackages.some((p) =>
    ['submitted', 'scheduled', 'in_progress', 'clarifications'].includes(
      p.audit_stage ?? '',
    ),
  );
  useEffect(() => {
    if (hasSubmittedPackage) setActiveTab('audit-packages');
  }, [hasSubmittedPackage]);

  const handleCreateEvidence = async (
    input: Parameters<typeof createEvidence>[0],
  ) => {
    await createEvidence(input);
    await Promise.all([refetchEvidence(), refetchReadiness(), refetchScores()]);
  };
  const handleDeleteEvidence = async (id: string) => {
    await deleteEvidence(id);
    await Promise.all([refetchEvidence(), refetchReadiness(), refetchScores()]);
  };
  const handleVerifyEvidence = async (id: string) => {
    await verifyEvidence(id, 'current_user');
    await Promise.all([refetchEvidence(), refetchReadiness(), refetchScores()]);
  };
  const handleJourneyConfirm = async (choice: {
    certification_type: 'new' | 'recertification';
    certification_start_date: string;
    ecgt_applicable: boolean;
    previous_bia_score?: number;
  }) => {
    if (!bcorpFrameworkId) return;
    await startCertification(bcorpFrameworkId, choice);
    await Promise.all([refetch(), refetchReadiness(), refetchScores()]);
    setActiveTab('gap-analysis');
  };

  const handleExportPackage = async (packageId: string) => {
    setExportingPackageId(packageId);
    try {
      const res = await fetch('/api/certifications/audit-package/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Export failed');
      }
      toast.success('Audit package exported');
      await refetchPackages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingPackageId(null);
    }
  };

  const isCertified =
    certifications.find((c) => c.framework_id === bcorpFrameworkId)?.status ===
    'certified';

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/certifications/"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Certifications
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Award className="h-6 w-6 text-amber-600" />
            B Corp Certification
          </h1>
          <p className="mt-1 text-muted-foreground">
            The 2026 B Corp Standards: Foundation Requirements and 7 Impact
            Topics, with Year 0, 3 and 5 progression.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            refetch();
            refetchReadiness();
          }}
          disabled={readinessLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${readinessLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Binary readiness signal + ECGT deadline (sticky) */}
      {readiness?.hasCertification && (
        <div className="sticky top-0 z-20 space-y-3 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <EcgtBanner
            ecgtApplicable={readiness.ecgtApplicable}
            isReadyToSubmit={readiness.isReadyToSubmit}
          />
          <ReadinessBanner
            readiness={readiness}
            onPrepareAudit={() => setActiveTab('audit-packages')}
            onViewBlocking={() => {
              setActiveTab('gap-analysis');
              setBlockingSignal((n) => n + 1);
            }}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="gap-analysis" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Gap Analysis
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidence
          </TabsTrigger>
          <TabsTrigger
            value="audit-packages"
            className="flex items-center gap-2"
          >
            <Package className="h-4 w-4" />
            Audit Packages
          </TabsTrigger>
        </TabsList>

        {/* Gap Analysis Tab */}
        <TabsContent value="gap-analysis">
          {readiness && readiness.hasCertification ? (
            <div className="space-y-6">
              <StandardsBanner onApplied={() => refetchReadiness()} />
              <RecertBanner active={!!readiness.recertPrepActive} />
              {isCertified && <UpcomingRequirements readiness={readiness} />}
              <GapAnalysisView
                readiness={readiness}
                loading={readinessLoading}
                evidence={evidence}
                onCreateEvidence={handleCreateEvidence}
                onDeleteEvidence={handleDeleteEvidence}
                onVerifyEvidence={handleVerifyEvidence}
                onOpenRiskTool={() => setRiskToolOpen(true)}
                onRefresh={async () => {
                  await Promise.all([
                    refetchReadiness(),
                    refetchEvidence(),
                    refetchScores(),
                  ]);
                }}
                blockingSignal={blockingSignal}
              />
              <SupplyChainEsgCard />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Gap Analysis
                </CardTitle>
                <CardDescription>
                  Start your B Corp certification to see a live gap analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center text-muted-foreground">
                  <Target className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p>No active B Corp certification yet.</p>
                  <Button
                    className="mt-4"
                    onClick={() => setJourneyOpen(true)}
                    disabled={!bcorpFrameworkId}
                  >
                    Begin your B Corp journey
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    Evidence Library
                  </CardTitle>
                  <CardDescription>
                    {verificationSummary.total} evidence items &middot;{' '}
                    {verificationSummary.verified} verified &middot;{' '}
                    {verificationSummary.pending} pending
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refetchEvidence}
                  disabled={evidenceLoading}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${evidenceLoading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {evidenceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : evidence.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p>No evidence linked yet.</p>
                  <p className="mt-1 text-sm">
                    Link evidence from the gap analysis view above.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {evidence.map((item) => {
                    const statusIcon =
                      item.verification_status === 'verified' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : item.verification_status === 'rejected' ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      );
                    const statusColor =
                      item.verification_status === 'verified'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : item.verification_status === 'rejected'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {item.evidence_description}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs capitalize"
                            >
                              {item.evidence_type.replace('_', ' ')}
                            </Badge>
                            <Badge className={`text-xs ${statusColor}`}>
                              {statusIcon}
                              <span className="ml-1 capitalize">
                                {item.verification_status}
                              </span>
                            </Badge>
                          </div>
                          {item.requirement && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.requirement.requirement_code} &mdash;{' '}
                              {item.requirement.requirement_name}
                            </p>
                          )}
                          {item.document_url && (
                            <a
                              href={item.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                            >
                              View document
                            </a>
                          )}
                        </div>
                        <div className="ml-2 flex items-center gap-1">
                          {item.verification_status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                verifyEvidence(item.id, 'current_user').then(
                                  () => toast.success('Evidence verified'),
                                )
                              }
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deleteEvidence(item.id).then(() =>
                                toast.success('Evidence removed'),
                              )
                            }
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
        </TabsContent>

        {/* Audit Packages Tab */}
        <TabsContent value="audit-packages" className="space-y-6">
          {readiness?.isReadyToSubmit && (
            <PreAuditChecklist onReadyChange={setChecklistReady} />
          )}

          {auditPackages.length > 0 && (
            <div className="space-y-4">
              {auditPackages.map((pkg) => (
                <div key={`wf-${pkg.id}`} className="space-y-3">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">
                          {pkg.package_name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {pkg.export_url && (
                            <a
                              href={pkg.export_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="outline" size="sm">
                                Download ZIP
                              </Button>
                            </a>
                          )}
                          <Button
                            size="sm"
                            disabled={
                              !checklistReady || exportingPackageId === pkg.id
                            }
                            onClick={() => handleExportPackage(pkg.id)}
                          >
                            {exportingPackageId === pkg.id
                              ? 'Exporting...'
                              : pkg.exported_at
                                ? 'Re-export package'
                                : 'Prepare Audit Package'}
                          </Button>
                        </div>
                      </div>
                      {!checklistReady && (
                        <CardDescription>
                          Complete the pre-audit checklist above to enable
                          export.
                        </CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                  {(pkg.exported_at || pkg.audit_stage) && (
                    <AuditTimeline
                      packageId={pkg.id}
                      auditStage={pkg.audit_stage ?? 'exported'}
                      auditScheduledDate={pkg.audit_scheduled_date ?? null}
                      auditorName={pkg.auditor_name ?? null}
                      sizeBand={null}
                      onUpdated={refetchPackages}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <ClarificationRequests />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    Audit Packages
                  </CardTitle>
                  <CardDescription>
                    {packageStatusSummary.total} packages &middot;{' '}
                    {packageStatusSummary.draft} draft &middot;{' '}
                    {packageStatusSummary.submitted} submitted &middot;{' '}
                    {packageStatusSummary.approved} approved
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refetchPackages}
                    disabled={packagesLoading}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${packagesLoading ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setCreatePackageDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Package
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {packagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : auditPackages.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p>No audit packages created yet.</p>
                  <p className="mt-1 text-sm">
                    When you&apos;re ready to submit, create an audit package to
                    compile all evidence.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditPackages.map((pkg) => {
                    const statusColor =
                      pkg.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : pkg.status === 'submitted'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : pkg.status === 'in_review'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : pkg.status === 'rejected'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                    return (
                      <div
                        key={pkg.id}
                        className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {pkg.package_name}
                            </span>
                            <Badge
                              className={`text-xs capitalize ${statusColor}`}
                            >
                              {pkg.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {pkg.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {pkg.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              Created{' '}
                              {formatDistanceToNow(new Date(pkg.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                            {pkg.submission_deadline && (
                              <span>
                                Deadline:{' '}
                                {new Date(
                                  pkg.submission_deadline,
                                ).toLocaleDateString()}
                              </span>
                            )}
                            <span>
                              {pkg.included_requirements?.length || 0}{' '}
                              requirements &middot;{' '}
                              {pkg.included_evidence?.length || 0} evidence items
                            </span>
                          </div>
                        </div>
                        {pkg.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deletePackage(pkg.id).then(() =>
                                toast.success('Package deleted'),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Audit Package Dialog */}
      <Dialog
        open={createPackageDialogOpen}
        onOpenChange={setCreatePackageDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Audit Package</DialogTitle>
            <DialogDescription>
              Compile evidence and requirements into a submission-ready package.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="package_name">Package Name</Label>
              <Input
                id="package_name"
                value={newPackageName}
                onChange={(e) => setNewPackageName(e.target.value)}
                placeholder="e.g. B Corp 2026 Submission"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="package_desc">Description (Optional)</Label>
              <Input
                id="package_desc"
                value={newPackageDescription}
                onChange={(e) => setNewPackageDescription(e.target.value)}
                placeholder="Brief description of this audit package"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreatePackageDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newPackageName || !bcorpFrameworkId) return;
                setCreatingPackage(true);
                try {
                  await createPackage({
                    framework_id: bcorpFrameworkId,
                    package_name: newPackageName,
                    description: newPackageDescription || undefined,
                  });
                  setCreatePackageDialogOpen(false);
                  setNewPackageName('');
                  setNewPackageFramework('');
                  setNewPackageDescription('');
                  toast.success('Audit package created');
                } catch {
                  toast.error('Failed to create audit package');
                } finally {
                  setCreatingPackage(false);
                }
              }}
              disabled={creatingPackage || !newPackageName || !bcorpFrameworkId}
            >
              {creatingPackage ? 'Creating...' : 'Create Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dual journey selection (first entry) */}
      <JourneySelectionDialog
        open={journeyOpen}
        onOpenChange={setJourneyOpen}
        onConfirm={handleJourneyConfirm}
      />

      {/* Risk Tool */}
      <RiskToolWizard
        open={riskToolOpen}
        onOpenChange={setRiskToolOpen}
        onCompleted={async () => {
          await Promise.all([
            refetchReadiness(),
            refetchEvidence(),
            refetchScores(),
          ]);
        }}
      />
    </div>
  );
}
