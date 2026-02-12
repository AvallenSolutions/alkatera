'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Award,
  ArrowLeft,
  Calendar,
  Target,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Package,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { GapAnalysisDashboard } from '@/components/certifications/GapAnalysisDashboard';
import { EvidenceLinker } from '@/components/certifications/EvidenceLinker';
import { YearProgressionStepper } from '@/components/certifications/YearProgressionStepper';
import { useCertificationEvidence } from '@/hooks/data/useCertificationEvidence';
import { useCertificationAuditPackages } from '@/hooks/data/useCertificationAuditPackages';
import { toast } from 'sonner';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import type { FeatureCode } from '@/hooks/useSubscription';
import { formatDistanceToNow } from 'date-fns';

interface Framework {
  id: string;
  name: string;
  code: string;
  version: string;
  description: string;
  category: string;
  passing_score: number;
  total_points: number;
  governing_body?: string;
  website_url?: string;
  scoring_model?: 'points' | 'pass_fail';
  progression_model?: { years: number[]; labels: string[] } | null;
  requirements: Requirement[];
}

interface Requirement {
  id: string;
  framework_id: string;
  requirement_code: string;
  requirement_name: string;
  description: string;
  category: string;
  sub_category: string;
  points_available: number;
  is_required: boolean;
  guidance: string;
  data_sources: string[];
  applicable_from_year?: number;
  size_threshold?: string;
  topic_area?: string;
}

interface Certification {
  id: string;
  framework_id: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'certified' | 'expired';
  current_score: number | null;
  target_date: string | null;
  certification_date: string | null;
  expiry_date: string | null;
  certificate_number: string | null;
  current_year?: number;
}

interface GapAnalysis {
  id: string;
  requirement_id: string;
  compliance_status: 'not_assessed' | 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  current_score: number | null;
  gap_description: string | null;
  action_required: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  requirement?: {
    requirement_code: string;
    requirement_name: string;
    category: string;
    sub_category: string;
    points_available: number;
  };
}

interface GapSummary {
  total: number;
  compliant: number;
  partial: number;
  non_compliant: number;
  not_assessed: number;
  not_applicable: number;
  compliance_rate: number;
  total_points_available: number;
  total_points_achieved: number;
}

const statusConfig = {
  not_started: {
    label: 'Not Started',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    icon: Clock,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Target,
  },
  ready: {
    label: 'Ready for Certification',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: CheckCircle2,
  },
  certified: {
    label: 'Certified',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: Award,
  },
  expired: {
    label: 'Expired',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertCircle,
  },
};

const categoryColors: Record<string, string> = {
  'B Corp': 'bg-emerald-500',
  'Climate': 'bg-blue-500',
  'ESG': 'bg-purple-500',
  'Reporting': 'bg-amber-500',
};

// Maps framework codes to their required feature codes (Canopy-only frameworks)
const canopyFrameworkFeatures: Record<string, string> = {
  csrd: 'csrd_compliance',
  gri: 'gri_standards',
  iso14001: 'iso_14001',
  iso50001: 'iso_50001',
  sbti: 'sbti_targets',
};

export default function CertificationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const code = params.code as string;
  const requiredFeature = canopyFrameworkFeatures[code?.toLowerCase()] as FeatureCode | undefined;

  // Gate Canopy-only frameworks
  if (requiredFeature) {
    return (
      <FeatureGate feature={requiredFeature}>
        <CertificationDetailsContent />
      </FeatureGate>
    );
  }

  return <CertificationDetailsContent />;
}

function CertificationDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const code = params.code as string;

  const [framework, setFramework] = useState<Framework | null>(null);
  const [certification, setCertification] = useState<Certification | null>(null);
  const [gapAnalyses, setGapAnalyses] = useState<GapAnalysis[]>([]);
  const [gapSummary, setGapSummary] = useState<GapSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [gapLoading, setGapLoading] = useState(false);

  // Use refs to store current values for use in callbacks without triggering re-renders
  const frameworkRef = useRef<Framework | null>(null);
  const orgIdRef = useRef<string | null>(null);
  const hasFetchedRef = useRef(false);

  // Evidence and audit packages hooks — scoped to current framework once loaded
  const frameworkId = framework?.id;
  const {
    evidence,
    byRequirement: evidenceByRequirement,
    verificationSummary,
    loading: evidenceLoading,
    refetch: refetchEvidence,
    createEvidence,
    deleteEvidence,
    verifyEvidence,
  } = useCertificationEvidence(frameworkId);
  const {
    packages: auditPackages,
    statusSummary: packageStatusSummary,
    loading: packagesLoading,
    refetch: refetchPackages,
    createPackage,
    deletePackage,
  } = useCertificationAuditPackages(frameworkId);

  // Keep refs in sync
  orgIdRef.current = currentOrganization?.id ?? null;

  // Fetch gap analysis for a specific framework - standalone function using refs
  const fetchGapAnalysisForFramework = useCallback(async (orgId: string, frameworkId: string) => {
    try {
      setGapLoading(true);
      const searchParams = new URLSearchParams({
        organization_id: orgId,
        framework_id: frameworkId,
      });

      const response = await fetch(`/api/certifications/gap-analysis?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch gap analysis');
      }

      const data = await response.json();
      setGapAnalyses(data.analyses || []);
      setGapSummary(data.summary || null);
    } catch (error) {
      console.error('Error fetching gap analysis:', error);
    } finally {
      setGapLoading(false);
    }
  }, []);

  // Single effect: fetch framework data + gap analysis in sequence
  useEffect(() => {
    const orgId = currentOrganization?.id;
    if (!orgId) return;

    // Prevent duplicate fetches for same org+code combo
    const fetchKey = `${orgId}:${code}`;
    if (hasFetchedRef.current && frameworkRef.current) return;

    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);

        const searchParams = new URLSearchParams({ organization_id: orgId! });
        const response = await fetch(`/api/certifications/frameworks?${searchParams}`);
        if (!response.ok) throw new Error('Failed to fetch frameworks');
        if (cancelled) return;

        const data = await response.json();
        const matchedFramework = data.frameworks?.find(
          (f: Framework) => f.code.toLowerCase() === code.toLowerCase()
        );

        if (!matchedFramework) {
          toast.error('Certification framework not found');
          router.push('/certifications');
          return;
        }

        frameworkRef.current = matchedFramework;
        setFramework(matchedFramework);

        const matchedCertification = data.certifications?.find(
          (c: Certification) => c.framework_id === matchedFramework.id
        );
        setCertification(matchedCertification || null);
        setLoading(false);

        // Now fetch gap analysis inline - no cascading effect needed
        if (!cancelled) {
          await fetchGapAnalysisForFramework(orgId!, matchedFramework.id);
        }

        hasFetchedRef.current = true;
      } catch (error) {
        console.error('Error fetching framework:', error);
        if (!cancelled) {
          toast.error('Failed to load certification details');
          setLoading(false);
        }
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id, code]);

  // Refresh gap analysis only (for use after status updates)
  const refreshGapAnalysis = useCallback(async () => {
    const orgId = orgIdRef.current;
    const fw = frameworkRef.current;
    if (!orgId || !fw?.id) return;
    await fetchGapAnalysisForFramework(orgId, fw.id);
  }, [fetchGapAnalysisForFramework]);

  // Refresh everything (for the Refresh button)
  const handleRefresh = useCallback(async () => {
    hasFetchedRef.current = false;
    frameworkRef.current = null;
    setFramework(null);
    setGapAnalyses([]);
    setGapSummary(null);
    // Trigger the effect by forcing a re-render - the effect will re-run
    // because hasFetchedRef is now false
    setLoading(true);

    const orgId = orgIdRef.current;
    if (!orgId) return;

    try {
      const searchParams = new URLSearchParams({ organization_id: orgId });
      const response = await fetch(`/api/certifications/frameworks?${searchParams}`);
      if (!response.ok) throw new Error('Failed to fetch frameworks');

      const data = await response.json();
      const matchedFramework = data.frameworks?.find(
        (f: Framework) => f.code.toLowerCase() === code.toLowerCase()
      );

      if (!matchedFramework) {
        toast.error('Certification framework not found');
        return;
      }

      frameworkRef.current = matchedFramework;
      setFramework(matchedFramework);

      const matchedCertification = data.certifications?.find(
        (c: Certification) => c.framework_id === matchedFramework.id
      );
      setCertification(matchedCertification || null);
      setLoading(false);

      await fetchGapAnalysisForFramework(orgId, matchedFramework.id);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [code, fetchGapAnalysisForFramework]);

  const handleUpdateGapStatus = async (
    requirementId: string,
    status: GapAnalysis['compliance_status']
  ) => {
    const orgId = orgIdRef.current;
    const fw = frameworkRef.current;
    if (!orgId || !fw?.id) return;

    const existingAnalysis = gapAnalyses.find(a => a.requirement_id === requirementId);

    try {
      if (existingAnalysis) {
        const response = await fetch('/api/certifications/gap-analysis', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existingAnalysis.id,
            compliance_status: status,
          }),
        });

        if (!response.ok) throw new Error('Failed to update');
      } else {
        const response = await fetch('/api/certifications/gap-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: orgId,
            framework_id: fw.id,
            requirement_id: requirementId,
            compliance_status: status,
          }),
        });

        if (!response.ok) throw new Error('Failed to create');
      }

      await refreshGapAnalysis();
      toast.success('Status updated');
    } catch (error) {
      console.error('Error updating gap analysis:', error);
      toast.error('Failed to update status');
    }
  };

  // Group gap analyses by category
  const analysesByCategory = gapAnalyses.reduce(
    (acc: Record<string, GapAnalysis[]>, analysis) => {
      const category = analysis.requirement?.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(analysis);
      return acc;
    },
    {}
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!framework) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Framework not found</p>
        <Button asChild>
          <Link href="/certifications">Back to Certifications</Link>
        </Button>
      </div>
    );
  }

  const [selectedYear, setSelectedYear] = useState<number>(0);

  const status = certification?.status || 'not_started';
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const isPassFail = framework.scoring_model === 'pass_fail';

  // Derive score from gap summary (which is computed from compliance_status) instead of
  // certification.current_score which is never populated
  const score = isPassFail
    ? (gapSummary && gapSummary.total > 0
        ? Math.round(((gapSummary.compliant || 0) / gapSummary.total) * 100)
        : 0)
    : (gapSummary && gapSummary.total_points_available > 0
        ? Math.round((gapSummary.total_points_achieved / gapSummary.total_points_available) * 100)
        : 0);
  const isPassingScore = isPassFail
    ? (gapSummary?.total ?? 0) > 0 && (gapSummary?.compliant ?? 0) === (gapSummary?.total ?? 0)
    : score >= framework.passing_score;

  // Build requirement counts by year for the stepper
  const requirementCountsByYear = useMemo(() => {
    if (!framework.progression_model?.years || !framework.requirements) return {};
    const counts: Record<number, { total: number; passed: number }> = {};
    for (const year of framework.progression_model.years) {
      const yearReqs = framework.requirements.filter(
        r => (r.applicable_from_year ?? 0) <= year
      );
      // Count requirements at exactly this year tier (not cumulative from previous)
      const thisYearReqs = framework.requirements.filter(
        r => (r.applicable_from_year ?? 0) === year
      );
      const passedCount = thisYearReqs.filter(r => {
        const analysis = gapAnalyses.find(a => a.requirement_id === r.id);
        return analysis?.compliance_status === 'compliant';
      }).length;
      counts[year] = { total: thisYearReqs.length, passed: passedCount };
    }
    return counts;
  }, [framework.progression_model, framework.requirements, gapAnalyses]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/certifications">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={categoryColors[framework.category] || 'bg-slate-500'}>
                {framework.category}
              </Badge>
              <Badge variant="outline">{framework.version}</Badge>
              <Badge className={config.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{framework.name}</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">{framework.description}</p>
            {framework.governing_body && (
              <p className="text-sm text-muted-foreground mt-2">
                Governed by: {framework.governing_body}
                {framework.website_url && (
                  <a
                    href={framework.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 ml-2 text-blue-600 hover:underline"
                  >
                    Learn more <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Year Progression Stepper for pass/fail frameworks */}
      {isPassFail && framework.progression_model && (
        <YearProgressionStepper
          progressionModel={framework.progression_model}
          currentYear={certification?.current_year ?? 0}
          requirementCountsByYear={requirementCountsByYear}
          onYearSelect={setSelectedYear}
          selectedYear={selectedYear}
        />
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Score Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              {isPassFail ? 'Requirements Passed' : 'Current Score'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPassFail ? (
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className={`text-3xl font-bold ${isPassingScore ? 'text-emerald-600' : ''}`}>
                    {gapSummary?.compliant || 0}/{gapSummary?.total || 0}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    mandatory passed
                  </span>
                </div>
                <Progress
                  value={score}
                  className={`h-2 ${isPassingScore ? '[&>div]:bg-emerald-500' : ''}`}
                />
                {!isPassingScore && gapSummary && gapSummary.total > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {gapSummary.total - (gapSummary.compliant || 0)} requirements remaining
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className={`text-3xl font-bold ${isPassingScore ? 'text-emerald-600' : ''}`}>
                    {score}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {framework.passing_score}% required
                  </span>
                </div>
                <Progress
                  value={score}
                  className={`h-2 ${isPassingScore ? '[&>div]:bg-emerald-500' : ''}`}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requirements Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{framework.requirements?.length || 0}</span>
              <span className="text-sm text-muted-foreground">total requirements</span>
            </div>
            {isPassFail ? (
              <p className="text-sm text-muted-foreground mt-1">
                All mandatory &mdash; pass/fail model
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                {framework.total_points} total points available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dates Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              Key Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {certification?.target_date && status !== 'certified' && (
              <div className="text-sm">
                <span className="text-muted-foreground">Target: </span>
                <span className="font-medium">
                  {new Date(certification.target_date).toLocaleDateString()}
                </span>
              </div>
            )}
            {certification?.certification_date && (
              <div className="text-sm">
                <span className="text-muted-foreground">Certified: </span>
                <span className="font-medium text-emerald-600">
                  {new Date(certification.certification_date).toLocaleDateString()}
                </span>
              </div>
            )}
            {certification?.expiry_date && (
              <div className="text-sm">
                <span className="text-muted-foreground">Expires: </span>
                <span className="font-medium">
                  {new Date(certification.expiry_date).toLocaleDateString()}
                </span>
              </div>
            )}
            {!certification?.target_date && !certification?.certification_date && (
              <p className="text-sm text-muted-foreground">No dates set</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="gap-analysis" className="space-y-6">
        <TabsList>
          <TabsTrigger value="gap-analysis" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Gap Analysis
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidence
            {verificationSummary.total > 0 && (
              <Badge variant="secondary" className="text-xs ml-1">
                {verificationSummary.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit-packages" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Audit Packages
            {packageStatusSummary.total > 0 && (
              <Badge variant="secondary" className="text-xs ml-1">
                {packageStatusSummary.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requirements" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All Requirements
          </TabsTrigger>
        </TabsList>

        {/* Gap Analysis Tab */}
        <TabsContent value="gap-analysis">
          {gapLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : gapAnalyses.length > 0 ? (
            <GapAnalysisDashboard
              analyses={gapAnalyses}
              analysesByCategory={analysesByCategory}
              summary={gapSummary}
              onUpdateStatus={handleUpdateGapStatus}
              loading={gapLoading}
              evidenceByRequirement={evidenceByRequirement}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Gap Analysis Started</h3>
                <p className="text-muted-foreground mb-4">
                  Begin your gap analysis by assessing your compliance with each requirement.
                </p>
                <Button
                  onClick={async () => {
                    const orgId = orgIdRef.current;
                    const fw = frameworkRef.current;
                    if (!orgId || !fw?.id || !fw?.requirements?.length) return;

                    try {
                      // Batch-initialize all requirements in a single request
                      const response = await fetch('/api/certifications/gap-analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          organization_id: orgId,
                          framework_id: fw.id,
                          requirements: fw.requirements.map((r: Requirement) => r.id),
                          compliance_status: 'not_assessed',
                        }),
                      });

                      if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        console.error('Gap analysis init error:', errData);
                        throw new Error(errData.details || errData.error || 'Failed to initialize');
                      }

                      await refreshGapAnalysis();
                      toast.success('Gap analysis initialized');
                    } catch (error) {
                      console.error('Error initializing gap analysis:', error);
                      toast.error('Failed to initialize gap analysis');
                    }
                  }}
                >
                  Start Gap Analysis
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence">
          {evidenceLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <EvidenceLinker
              evidence={evidence}
              frameworkId={framework.id}
              onCreateEvidence={async (data) => {
                await createEvidence(data);
                toast.success('Evidence linked');
              }}
              onDeleteEvidence={async (id) => {
                await deleteEvidence(id);
                toast.success('Evidence removed');
              }}
              onVerifyEvidence={async (id) => {
                await verifyEvidence(id, 'current_user');
                toast.success('Evidence verified');
              }}
              loading={evidenceLoading}
            />
          )}
        </TabsContent>

        {/* Audit Packages Tab */}
        <TabsContent value="audit-packages">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    Audit Packages
                  </CardTitle>
                  <CardDescription>
                    {packageStatusSummary.total} packages for {framework.name}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await createPackage({
                        framework_id: framework.id,
                        package_name: `${framework.name} Audit - ${new Date().toLocaleDateString()}`,
                      });
                      toast.success('Audit package created');
                    } catch {
                      toast.error('Failed to create audit package');
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Package
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {packagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : auditPackages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No audit packages for this framework.</p>
                  <p className="text-sm mt-1">
                    Create a package to compile evidence for certification submission.
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
                        className="flex items-start justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{pkg.package_name}</span>
                            <Badge className={`text-xs capitalize ${statusColor}`}>
                              {pkg.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {pkg.description && (
                            <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>
                              Created {formatDistanceToNow(new Date(pkg.created_at), { addSuffix: true })}
                            </span>
                            <span>
                              {pkg.included_requirements?.length || 0} requirements &middot;{' '}
                              {pkg.included_evidence?.length || 0} evidence
                            </span>
                          </div>
                        </div>
                        {pkg.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deletePackage(pkg.id).then(() => toast.success('Package deleted'))
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

        {/* Requirements Tab */}
        <TabsContent value="requirements">
          <Card>
            <CardHeader>
              <CardTitle>Framework Requirements</CardTitle>
              <CardDescription>
                Complete list of requirements for {framework.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {framework.requirements?.length > 0 ? (
                <div className="space-y-4">
                  {framework.requirements.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                              {req.requirement_code}
                            </code>
                            {req.is_required && (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {req.points_available} pts
                            </Badge>
                          </div>
                          <h4 className="font-medium">{req.requirement_name}</h4>
                          {req.description && (
                            <p className="text-sm text-muted-foreground mt-1">{req.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{req.category}</span>
                            {req.sub_category && (
                              <>
                                <span>/</span>
                                <span>{req.sub_category}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No requirements defined for this framework.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
