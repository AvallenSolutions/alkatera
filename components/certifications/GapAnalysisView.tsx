'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  Clock,
  Circle,
  CalendarClock,
  Lock,
  Upload,
  Loader2,
} from 'lucide-react';
import { EvidenceLinker } from '@/components/certifications/EvidenceLinker';
import { AutoEvidencePanel } from '@/components/certifications/AutoEvidencePanel';
import { getRequirementGuidance } from '@/lib/certifications/requirement-guidance';
import { RequirementActionPlan, type RequirementAction } from '@/components/certifications/RequirementActionPlan';
import { AskRosaButton } from '@/components/rosa/AskRosaButton';
import { useOrganization } from '@/lib/organizationContext';
import type {
  CertificationReadiness,
  RequirementStatus,
  RequirementStatusValue,
  YearBand,
} from '@/lib/certifications/scoring';

interface GapEvidence {
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
}

interface CreateEvidenceInput {
  framework_id: string;
  requirement_id: string;
  evidence_type: GapEvidence['evidence_type'];
  evidence_description: string;
  source_module?: string;
  source_table?: string;
  document_url?: string;
  notes?: string;
}

interface GapAnalysisViewProps {
  readiness: CertificationReadiness;
  loading: boolean;
  evidence: GapEvidence[];
  onCreateEvidence: (input: CreateEvidenceInput) => Promise<void>;
  onDeleteEvidence: (id: string) => Promise<void>;
  onVerifyEvidence: (id: string) => Promise<void>;
  onOpenRiskTool?: () => void;
  onRefresh?: () => Promise<void> | void;
  initialBlockingOnly?: boolean;
  /** Increment to force the blocking-only filter + scroll into view. */
  blockingSignal?: number;
  /** A requirement to open (from the Overview tab); paired with focusSignal. */
  focusRequirementId?: string | null;
  /** Increment to (re)open focusRequirementId's evidence dialog. */
  focusSignal?: number;
  /** Framework code; routes per-requirement guidance and gates B Corp-only UI. */
  frameworkCode?: string;
}

const STATUS_CONFIG: Record<
  RequirementStatusValue,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  passed: {
    label: 'Passed',
    icon: CheckCircle2,
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  not_started: {
    label: 'Not Started',
    icon: Circle,
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  },
  future: {
    label: 'Future',
    icon: CalendarClock,
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

const YEAR_BANDS: YearBand[] = [0, 3, 5];

function topicLabel(topicArea: string): string {
  return topicArea === 'foundation' ? 'Foundation Requirements' : topicArea;
}

export function GapAnalysisView({
  readiness,
  loading,
  evidence,
  onCreateEvidence,
  onDeleteEvidence,
  onVerifyEvidence,
  onOpenRiskTool,
  onRefresh,
  initialBlockingOnly = false,
  blockingSignal = 0,
  focusRequirementId = null,
  focusSignal = 0,
  frameworkCode = 'bcorp_2026',
}: GapAnalysisViewProps) {
  const isBcorp = frameworkCode === 'bcorp_2026';
  const [statusFilter, setStatusFilter] = useState<string>(
    initialBlockingOnly ? 'blocking' : 'all',
  );
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [activeRequirement, setActiveRequirement] =
    useState<RequirementStatus | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Assigned actions (owner / due date / next step) per requirement, from the
  // gap-analysis table — so "who's doing what by when" is visible on each card.
  const { currentOrganization } = useOrganization();
  const [actionByReq, setActionByReq] = useState<Record<string, RequirementAction>>({});

  const loadActions = useMemo(
    () => async () => {
      const orgId = currentOrganization?.id;
      if (!orgId || !readiness.frameworkId) return;
      try {
        const res = await fetch(
          `/api/certifications/gap-analysis?organization_id=${orgId}&framework_id=${readiness.frameworkId}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        const map: Record<string, RequirementAction> = {};
        for (const a of json.analyses ?? []) {
          if (a.assigned_to || a.target_completion_date || a.action_required) {
            map[a.requirement_id] = {
              assigned_to: a.assigned_to,
              target_completion_date: a.target_completion_date,
              action_required: a.action_required,
              compliance_status: a.compliance_status,
            };
          }
        }
        setActionByReq(map);
      } catch {
        /* non-fatal */
      }
    },
    [currentOrganization?.id, readiness.frameworkId],
  );

  useEffect(() => {
    void loadActions();
  }, [loadActions]);

  // Anonymised peer benchmark: % of brands that meet each requirement. Null
  // until loaded; the API suppresses it entirely below a minimum cohort size.
  const [benchmark, setBenchmark] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!isBcorp) return; // The peer benchmark cohort is B Corp-specific.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/certifications/benchmark');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.available) setBenchmark(json.byRequirement ?? {});
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isBcorp]);

  // "View blocking requirements" can be triggered while this view is already
  // mounted, so react to the signal rather than only the initial prop.
  useEffect(() => {
    if (blockingSignal > 0) {
      setStatusFilter('blocking');
      setYearFilter('all');
      rootRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [blockingSignal]);

  // Open a specific requirement's evidence dialog when asked from the Overview
  // tab (the "Open" buttons on the roadmap / recert cards live there now).
  useEffect(() => {
    if (focusSignal > 0 && focusRequirementId) {
      const rs = readiness.requirementStatuses.find(
        (r) => r.requirementId === focusRequirementId,
      );
      if (rs) setActiveRequirement(rs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  const blockingIds = useMemo(
    () => new Set(readiness.blockingRequirements.map((r) => r.requirementId)),
    [readiness.blockingRequirements],
  );

  const lockImpactTopics =
    readiness.certificationType === 'new' && !readiness.foundationComplete;

  // Requirements that don't apply to this org's size are hidden so users only
  // see what's relevant to them.
  const notApplicableCount = readiness.requirementStatuses.filter(
    (rs) => rs.applicable === false,
  ).length;

  const matchesFilters = (rs: RequirementStatus): boolean => {
    if (rs.applicable === false) return false;
    if (statusFilter === 'blocking' && !blockingIds.has(rs.requirementId)) {
      return false;
    }
    if (
      statusFilter !== 'all' &&
      statusFilter !== 'blocking' &&
      rs.status !== statusFilter
    ) {
      return false;
    }
    if (yearFilter !== 'all' && String(rs.applicableFromYear) !== yearFilter) {
      return false;
    }
    return true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={rootRef}>
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="blocking">Blocking only</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="future">Future</SelectItem>
            </SelectContent>
          </Select>
          {isBcorp && (
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Year band" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All year bands</SelectItem>
                <SelectItem value="0">Year 0</SelectItem>
                <SelectItem value="3">Year 3</SelectItem>
                <SelectItem value="5">Year 5</SelectItem>
              </SelectContent>
            </Select>
          )}
          {notApplicableCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {notApplicableCount} requirement{notApplicableCount === 1 ? '' : 's'} hidden — they don&apos;t apply to your company size.
            </p>
          )}
        </CardContent>
      </Card>

      {readiness.topicSummaries.map((topic) => {
        const topicRequirements = readiness.requirementStatuses
          .filter((rs) => rs.topicArea === topic.topicArea)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        const visible = topicRequirements.filter(matchesFilters);
        const locked = !topic.isFoundation && lockImpactTopics;

        if (visible.length === 0 && !locked) return null;

        const aggregate = YEAR_BANDS.filter(
          (band) => topic.byYear[band].total > 0,
        )
          .map((band) => {
            const yb = topic.byYear[band];
            const suffix = yb.applicable ? '' : ' (not yet due)';
            return `Year ${band}: ${yb.met}/${yb.total} met${suffix}`;
          })
          .join(' | ');

        return (
          <Card key={topic.topicArea}>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {topic.isFoundation && (
                    <Badge variant="outline" className="text-xs">
                      Foundation
                    </Badge>
                  )}
                  {topicLabel(topic.topicArea)}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{aggregate}</p>
              </div>
            </CardHeader>
            <CardContent>
              {topic.isFoundation &&
                !readiness.riskToolComplete &&
                onOpenRiskTool && (
                  <div className="mb-3 flex flex-col gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-blue-900 dark:text-blue-200">
                      The Risk Tool has not been completed. It is a required
                      Foundation step.
                    </span>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={onOpenRiskTool}
                    >
                      Complete Risk Tool
                    </Button>
                  </div>
                )}
              {locked ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  <Lock className="h-5 w-5 shrink-0" />
                  Complete all Foundation Requirements to unlock this Impact
                  Topic.
                </div>
              ) : (
                <div className="space-y-2">
                  {visible.map((rs) => {
                    const cfg = STATUS_CONFIG[rs.status];
                    const StatusIcon = cfg.icon;
                    const isBlocking = blockingIds.has(rs.requirementId);
                    return (
                      <div
                        key={rs.requirementId}
                        className={`flex items-start justify-between gap-4 rounded-lg border p-3 ${
                          isBlocking
                            ? 'border-amber-300 dark:border-amber-800'
                            : ''
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {rs.code}
                            </span>
                            <span className="font-medium text-sm">
                              {rs.name}
                            </span>
                            <Badge className={`text-xs ${cfg.className}`}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {cfg.label}
                            </Badge>
                            {rs.applicableFromYear > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Year {rs.applicableFromYear}
                              </Badge>
                            )}
                            {benchmark && benchmark[rs.requirementId] != null && (
                              <span
                                className="text-[10px] text-muted-foreground"
                                title="Share of brands pursuing B Corp 2026 that meet this requirement"
                              >
                                {benchmark[rs.requirementId]}% of brands meet this
                              </span>
                            )}
                            {readiness.staleRequirementCodes?.includes(
                              rs.code,
                            ) && (
                              <Badge
                                className="bg-amber-100 text-amber-700 text-xs dark:bg-amber-900/30 dark:text-amber-400"
                                title="This evidence is over 18 months old. Consider updating it before your next recertification."
                              >
                                Evidence stale
                              </Badge>
                            )}
                          </div>
                          {rs.description && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {rs.description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {rs.evidenceCount} evidence item
                            {rs.evidenceCount === 1 ? '' : 's'} ·{' '}
                            {rs.verifiedCount} verified
                          </p>
                          {actionByReq[rs.requirementId] && (
                            <p className="mt-1 text-xs text-[#7c3aed] dark:text-purple-400">
                              {actionByReq[rs.requirementId].assigned_to
                                ? `Owner: ${actionByReq[rs.requirementId].assigned_to}`
                                : 'Action assigned'}
                              {actionByReq[rs.requirementId].target_completion_date
                                ? ` · due ${actionByReq[rs.requirementId].target_completion_date}`
                                : ''}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setActiveRequirement(rs)}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Evidence
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={!!activeRequirement}
        onOpenChange={(open) => !open && setActiveRequirement(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <DialogTitle>
                {activeRequirement?.code} — {activeRequirement?.name}
              </DialogTitle>
              {isBcorp && activeRequirement && (
                <AskRosaButton
                  variant="pill"
                  label="Draft with Rosa"
                  className="shrink-0"
                  entity={{
                    type: 'bcorp_requirement',
                    id: activeRequirement.code,
                    label: `B Corp requirement ${activeRequirement.code} — ${activeRequirement.name}`,
                    data: {
                      code: activeRequirement.code,
                      name: activeRequirement.name,
                      topic: activeRequirement.topicArea,
                      status: activeRequirement.status,
                    },
                  }}
                  prompt={`Help me answer the B Corp requirement ${activeRequirement.code} (${activeRequirement.name}). Explain what it needs and draft an answer from my data.`}
                />
              )}
            </div>
          </DialogHeader>
          {activeRequirement && readiness.frameworkId && (
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <div className="space-y-4">
              {(() => {
                const g = getRequirementGuidance(activeRequirement.code, activeRequirement.topicArea, frameworkCode);
                return (
                  <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                    <div>
                      <p className="font-semibold text-foreground">What this needs</p>
                      <p className="mt-0.5 text-muted-foreground">{g.summary}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Evidence that works</p>
                      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-muted-foreground">
                        {g.evidence.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </div>
                    {g.pitfalls && g.pitfalls.length > 0 && (
                      <div>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">Watch out for</p>
                        <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-muted-foreground">
                          {g.pitfalls.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {g.template && (
                      <div>
                        <p className="font-semibold text-foreground">Starter you can adapt</p>
                        <p className="mt-0.5 whitespace-pre-wrap rounded border border-border/60 bg-background/60 p-2 italic text-muted-foreground">
                          {g.template}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
                <RequirementActionPlan
                  frameworkId={readiness.frameworkId}
                  requirementId={activeRequirement.requirementId}
                  initial={actionByReq[activeRequirement.requirementId]}
                  onSaved={loadActions}
                />
              </div>
              <div className="space-y-4">
                <AutoEvidencePanel
                  requirementId={activeRequirement.requirementId}
                  onAccepted={async () => {
                    if (onRefresh) await onRefresh();
                  }}
                />
                <EvidenceLinker
                  evidence={evidence}
                  requirementId={activeRequirement.requirementId}
                  frameworkId={readiness.frameworkId}
                  onCreateEvidence={onCreateEvidence}
                  onDeleteEvidence={onDeleteEvidence}
                  onVerifyEvidence={onVerifyEvidence}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
