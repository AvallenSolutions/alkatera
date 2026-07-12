'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  RefreshCw,
  Target,
  FileText,
  ListChecks,
  CheckCircle2,
  Clock,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { StateChip } from '@/components/studio';
import { GapAnalysisView } from '@/components/certifications/GapAnalysisView';
import { EvidenceLinker } from '@/components/certifications/EvidenceLinker';
import { PlatformHealthPanel } from '@/components/certifications/PlatformHealthPanel';
import { useCertificationReadiness } from '@/hooks/data/useCertificationReadiness';
import { useCertificationEvidence } from '@/hooks/data/useCertificationEvidence';

interface CertificationExperienceProps {
  /** Framework code, e.g. 'iso14001' | 'iso50001' | 'ecovadis'. */
  frameworkCode: string;
  /** Display name, e.g. 'ISO 14001'. */
  label: string;
  /** One-line description shown under the title. */
  description?: string;
  /** Governing body line. */
  governingBody?: string;
}

/**
 * Generic, framework-aware certification experience for the checklist-style
 * frameworks (ISO 14001, ISO 50001, EcoVadis). It reuses the same graded
 * readiness engine, per-requirement guidance, auto-evidence and evidence
 * library as the B Corp experience, minus the B Corp-only concepts (year
 * progression, recertification deltas, the Risk Tool and audit packages).
 */
export function CertificationExperience({
  frameworkCode,
  label,
  description,
  governingBody,
}: CertificationExperienceProps) {
  const { readiness, loading, refetch } =
    useCertificationReadiness(frameworkCode);
  const frameworkId = readiness?.frameworkId ?? undefined;
  const {
    evidence,
    verificationSummary,
    loading: evidenceLoading,
    refetch: refetchEvidence,
    createEvidence,
    deleteEvidence,
    verifyEvidence,
  } = useCertificationEvidence(frameworkId);

  // URL-synced tabs (?tab=) so surfaces are deep-linkable. The setter wraps the
  // local state so every existing call site (including the focus-requirement
  // jump) keeps working unchanged, it just also writes the tab to the URL.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTabState] = useState(
    () => searchParams.get('tab') || 'overview',
  );
  const setTab = useCallback(
    (next: string) => {
      setTabState(next);
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.set('tab', next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  const [focusRequirementId, setFocusRequirementId] = useState<string | null>(
    null,
  );
  const [focusSignal, setFocusSignal] = useState(0);

  const refreshAll = async () => {
    await Promise.all([refetch(), refetchEvidence()]);
  };

  const requirementOptions = useMemo(
    () =>
      (readiness?.requirementStatuses ?? []).map((rs) => ({
        id: rs.requirementId,
        requirement_code: rs.code,
        requirement_name: rs.name,
        category: rs.topicArea,
      })),
    [readiness?.requirementStatuses],
  );

  // The shortlist of requirements still to evidence, in framework order.
  const nextUp = useMemo(
    () =>
      (readiness?.requirementStatuses ?? [])
        .filter((rs) => rs.applicable !== false && rs.status !== 'passed')
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .slice(0, 5),
    [readiness?.requirementStatuses],
  );

  const openRequirement = (requirementId: string) => {
    setFocusRequirementId(requirementId);
    setFocusSignal((s) => s + 1);
    setTab('requirements');
  };

  if (loading || !readiness) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-dim">
          Loading
        </p>
      </div>
    );
  }

  const applicable = readiness.requirementStatuses.filter(
    (rs) => rs.applicable !== false,
  );
  const passed = applicable.filter((rs) => rs.status === 'passed').length;
  const inProgress = applicable.filter((rs) => rs.status === 'in_progress').length;
  const notStarted = applicable.filter((rs) => rs.status === 'not_started').length;
  const total = applicable.length;
  const pct = readiness.programmeReadinessPct;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/certifications">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
                Standard
              </span>
              {readiness.isReadyToSubmit && (
                <StateChip tone="good">All requirements met</StateChip>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">{label}</h1>
            {description && (
              <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>
            )}
            {governingBody && (
              <p className="mt-2 text-sm text-muted-foreground">
                Governed by: {governingBody}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={refreshAll} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="requirements" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Requirements
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidence
            {verificationSummary.total > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {verificationSummary.total}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-studio-dim" />
                  Readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-3xl font-bold tabular-nums">{pct}%</span>
                  <span className="text-sm text-muted-foreground">
                    {passed}/{total} verified
                  </span>
                </div>
                <Progress value={pct} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Only human-verified evidence counts towards readiness.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <ListChecks className="h-4 w-4 text-studio-dim" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-studio-good" /> Passed
                  </span>
                  <span className="font-medium">{passed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 text-studio-attention" /> In progress
                  </span>
                  <span className="font-medium">{inProgress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Circle className="h-4 w-4 text-studio-dim" /> Not started
                  </span>
                  <span className="font-medium">{notStarted}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <ArrowRight className="h-4 w-4 text-studio-dim" />
                  Next steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nextUp.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Every requirement has verified evidence. Keep it fresh for
                    audit.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {nextUp.map((rs) => (
                      <button
                        key={rs.requirementId}
                        onClick={() => openRequirement(rs.requirementId)}
                        className="flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left text-xs transition-colors hover:bg-muted/50"
                      >
                        <span className="truncate">
                          <span className="font-mono text-muted-foreground">
                            {rs.code}
                          </span>{' '}
                          {rs.name}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <PlatformHealthPanel entries={readiness.platformHealth ?? []} />
        </TabsContent>

        {/* Requirements */}
        <TabsContent value="requirements">
          <GapAnalysisView
            readiness={readiness}
            loading={loading}
            evidence={evidence as any}
            frameworkCode={frameworkCode}
            onCreateEvidence={async (input) => {
              await createEvidence(input as any);
              await refreshAll();
              toast.success('Evidence linked');
            }}
            onDeleteEvidence={async (id) => {
              await deleteEvidence(id);
              await refreshAll();
              toast.success('Evidence removed');
            }}
            onVerifyEvidence={async (id) => {
              await verifyEvidence(id, 'current_user');
              await refreshAll();
              toast.success('Evidence verified');
            }}
            onRefresh={refreshAll}
            focusRequirementId={focusRequirementId}
            focusSignal={focusSignal}
          />
        </TabsContent>

        {/* Evidence */}
        <TabsContent value="evidence">
          {evidenceLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-dim">
                Loading
              </p>
            </div>
          ) : frameworkId ? (
            <EvidenceLinker
              evidence={evidence as any}
              frameworkId={frameworkId}
              requirements={requirementOptions}
              onCreateEvidence={async (data) => {
                await createEvidence(data);
                await refetchEvidence();
                toast.success('Evidence linked');
              }}
              onDeleteEvidence={async (id) => {
                await deleteEvidence(id);
                await refetchEvidence();
                toast.success('Evidence removed');
              }}
              onVerifyEvidence={async (id) => {
                await verifyEvidence(id, 'current_user');
                await refetchEvidence();
                toast.success('Evidence verified');
              }}
              loading={evidenceLoading}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
