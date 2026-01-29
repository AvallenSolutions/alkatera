'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { GapAnalysisDashboard } from '@/components/certifications/GapAnalysisDashboard';
import { toast } from 'sonner';

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

export default function CertificationDetailsPage() {
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

  const fetchFrameworkData = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        organization_id: currentOrganization.id,
      });

      const response = await fetch(`/api/certifications/frameworks?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch frameworks');
      }

      const data = await response.json();
      const matchedFramework = data.frameworks?.find(
        (f: Framework) => f.code.toLowerCase() === code.toLowerCase()
      );

      if (!matchedFramework) {
        toast.error('Certification framework not found');
        router.push('/certifications');
        return;
      }

      setFramework(matchedFramework);

      const matchedCertification = data.certifications?.find(
        (c: Certification) => c.framework_id === matchedFramework.id
      );
      setCertification(matchedCertification || null);
    } catch (error) {
      console.error('Error fetching framework:', error);
      toast.error('Failed to load certification details');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id, code]);

  const fetchGapAnalysis = useCallback(async () => {
    if (!currentOrganization?.id || !framework?.id) return;

    try {
      setGapLoading(true);
      const params = new URLSearchParams({
        organization_id: currentOrganization.id,
        framework_id: framework.id,
      });

      const response = await fetch(`/api/certifications/gap-analysis?${params}`);
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
  }, [currentOrganization?.id, framework?.id]);

  useEffect(() => {
    fetchFrameworkData();
  }, [fetchFrameworkData]);

  useEffect(() => {
    if (framework?.id) {
      fetchGapAnalysis();
    }
  }, [framework?.id, fetchGapAnalysis]);

  const handleUpdateGapStatus = async (
    requirementId: string,
    status: GapAnalysis['compliance_status']
  ) => {
    if (!currentOrganization?.id || !framework?.id) return;

    const existingAnalysis = gapAnalyses.find(a => a.requirement_id === requirementId);

    try {
      if (existingAnalysis) {
        // Update existing
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
        // Create new
        const response = await fetch('/api/certifications/gap-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: currentOrganization.id,
            framework_id: framework.id,
            requirement_id: requirementId,
            compliance_status: status,
          }),
        });

        if (!response.ok) throw new Error('Failed to create');
      }

      // Refresh data
      await fetchGapAnalysis();
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

  const status = certification?.status || 'not_started';
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const score = certification?.current_score ?? 0;
  const isPassingScore = score >= framework.passing_score;

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
        <Button variant="outline" onClick={fetchFrameworkData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Score Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Current Score
            </CardTitle>
          </CardHeader>
          <CardContent>
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
            <p className="text-sm text-muted-foreground mt-1">
              {framework.total_points} total points available
            </p>
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
                    if (!framework?.requirements?.length) return;
                    // Initialize gap analysis for all requirements
                    for (const req of framework.requirements) {
                      await handleUpdateGapStatus(req.id, 'not_assessed');
                    }
                    toast.success('Gap analysis initialized');
                  }}
                >
                  Start Gap Analysis
                </Button>
              </CardContent>
            </Card>
          )}
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
