'use client';

import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
import type { WorkingTone } from '@/components/studio/theme';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Heart,
  MessageSquare,
  Gift,
  Users,
  TrendingUp,
  Clock,
  ThumbsUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WellbeingMetrics, BenefitTypeBreakdown, EmployeeSurvey } from '@/hooks/data/useWellbeingMetrics';

interface WellbeingDashboardProps {
  metrics: WellbeingMetrics | null;
  isLoading?: boolean;
}

const BENEFIT_TYPE_ICONS: Record<string, React.ReactNode> = {
  health: <Heart className="h-4 w-4 text-studio-dim" />,
  pension: <Gift className="h-4 w-4 text-studio-dim" />,
  leave: <Clock className="h-4 w-4 text-studio-dim" />,
  flexible_working: <Users className="h-4 w-4 text-studio-dim" />,
  wellness: <Heart className="h-4 w-4 text-studio-dim" />,
  financial: <Gift className="h-4 w-4 text-studio-dim" />,
  family: <Users className="h-4 w-4 text-studio-dim" />,
  development: <TrendingUp className="h-4 w-4 text-studio-dim" />,
};

const SURVEY_STATUS_CONFIG: Record<string, { label: string; tone: WorkingTone }> = {
  draft: { label: 'Draft', tone: 'quiet' },
  active: { label: 'Active', tone: 'attention' },
  closed: { label: 'Closed', tone: 'good' },
  archived: { label: 'Archived', tone: 'quiet' },
};

function ScoreGauge({
  score,
  label,
  maxScore = 5,
}: {
  score: number | null;
  label: string;
  maxScore?: number;
}) {
  if (score === null) {
    return (
      <Panel className="p-4 text-center">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-muted-foreground mt-1">·</p>
      </Panel>
    );
  }

  const percentage = (score / maxScore) * 100;
  const status = percentage >= 80 ? 'excellent' : percentage >= 60 ? 'good' : percentage >= 40 ? 'fair' : 'needs_improvement';
  const statusColors = {
    excellent: 'text-studio-good',
    good: 'text-studio-good',
    fair: 'text-studio-attention',
    needs_improvement: 'text-studio-stale',
  };

  return (
    <Panel className="p-4 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('text-3xl font-bold mt-1', statusColors[status])}>
        {score.toFixed(1)}
        <span className="text-sm text-muted-foreground">/{maxScore}</span>
      </p>
      <Progress value={percentage} indicatorClassName="bg-studio-ink" className="h-2 mt-2" />
    </Panel>
  );
}

function BenefitsCard({ benefits, summary }: { benefits: WellbeingMetrics['benefits']; summary: WellbeingMetrics['benefit_summary'] }) {
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between pb-4">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
            Employee Benefits
          </span>
          <p className="text-sm text-muted-foreground">Available benefits and uptake</p>
        </div>
        <StateChip tone="quiet">{summary.total} benefits</StateChip>
      </div>
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded-[6px] bg-studio-ink/[0.03]">
            <p className="text-xs text-muted-foreground uppercase">Avg Uptake</p>
            <p className="text-xl font-bold">{summary.avg_uptake_rate.toFixed(0)}%</p>
          </div>
          <div className="text-center p-3 rounded-[6px] bg-studio-ink/[0.03]">
            <p className="text-xs text-muted-foreground uppercase">Total Investment</p>
            <p className="text-xl font-bold">£{summary.total_employer_investment.toLocaleString()}</p>
          </div>
        </div>

        {/* By Type */}
        <div className="space-y-2">
          <p className="text-sm font-medium">By Category</p>
          {summary.by_type.map((type) => (
            <div
              key={type.type}
              className="flex items-center justify-between p-2 rounded-[6px] bg-studio-ink/[0.03]"
            >
              <div className="flex items-center gap-2">
                {BENEFIT_TYPE_ICONS[type.type] || <Gift className="h-4 w-4 text-studio-dim" />}
                <span className="text-sm">{type.type_display}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium">{type.count}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {type.avg_uptake_rate.toFixed(0)}% uptake
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function SurveysCard({ surveys, latestSurvey, latestResponses }: {
  surveys: EmployeeSurvey[];
  latestSurvey: EmployeeSurvey | null;
  latestResponses: WellbeingMetrics['latest_responses'];
}) {
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between pb-4">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
            Employee Surveys
          </span>
          <p className="text-sm text-muted-foreground">Feedback and engagement tracking</p>
        </div>
        <StateChip tone="quiet">{surveys.length} surveys</StateChip>
      </div>
      <div className="space-y-4">
        {latestSurvey ? (
          <>
            {/* Latest Survey */}
            <div className="p-4 rounded-[6px] border border-studio-hairline">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium">{latestSurvey.survey_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StateChip tone={SURVEY_STATUS_CONFIG[latestSurvey.status as keyof typeof SURVEY_STATUS_CONFIG]?.tone || 'quiet'}>
                      {SURVEY_STATUS_CONFIG[latestSurvey.status as keyof typeof SURVEY_STATUS_CONFIG]?.label || latestSurvey.status}
                    </StateChip>
                    {latestSurvey.survey_provider && (
                      <span className="text-xs text-muted-foreground">
                        via {latestSurvey.survey_provider.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
                {latestSurvey.response_rate && (
                  <div className="text-right">
                    <p className="text-2xl font-bold">{latestSurvey.response_rate.toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">response rate</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Invited</p>
                  <p className="font-medium">{latestSurvey.total_invited}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Responses</p>
                  <p className="font-medium">{latestSurvey.total_responses}</p>
                </div>
              </div>

              {/* Category Scores */}
              {latestResponses?.category_scores && Object.keys(latestResponses.category_scores).length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Category Scores</p>
                  {Object.entries(latestResponses.category_scores).map(([category, score]) => (
                    <div key={category} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground capitalize w-24">
                        {category.replace(/_/g, ' ')}
                      </span>
                      <Progress value={(score / 5) * 100} indicatorClassName="bg-studio-ink" className="flex-1 h-2" />
                      <span className="text-sm font-medium w-10">{score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Survey History */}
            {surveys.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Previous Surveys</p>
                {surveys.slice(1, 4).map((survey) => (
                  <div
                    key={survey.id}
                    className="flex items-center justify-between p-2 rounded-[6px] bg-studio-ink/[0.03] text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[150px]">{survey.survey_name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {survey.response_rate ? `${survey.response_rate.toFixed(0)}%` : '·'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No surveys created yet</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function ParticipationTrendCard({ trend }: { trend: WellbeingMetrics['survey_participation_trend'] }) {
  if (trend.length === 0) return null;

  const maxRate = Math.max(...trend.map(t => t.response_rate));

  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          Survey Participation Trend
        </span>
        <p className="text-sm text-muted-foreground">Response rates over time</p>
      </div>
      <div className="flex items-end gap-2 h-32">
        {trend.map((item, idx) => {
          const height = maxRate > 0 ? (item.response_rate / maxRate) * 100 : 0;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <span className="text-xs font-medium mb-1">{item.response_rate.toFixed(0)}%</span>
              <div
                className="w-full bg-studio-ink rounded-t transition-all"
                style={{ height: `${height}%`, minHeight: '4px' }}
              />
              <span className="text-xs text-muted-foreground mt-2 text-center line-clamp-1">
                {item.survey_name.substring(0, 8)}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function WellbeingDashboard({ metrics, isLoading }: WellbeingDashboardProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Panel className="flex flex-col items-center justify-center py-12 text-center">
        <Heart className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No Wellbeing Data</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Add employee surveys and benefits to track wellbeing metrics,
          engagement scores, and benefit uptake.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreGauge
          score={metrics.engagement_score}
          label="Engagement Score"
          maxScore={5}
        />
        <ScoreGauge
          score={metrics.wellbeing_score}
          label="Wellbeing Score"
          maxScore={5}
        />
        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[6px] bg-studio-ink/[0.05] text-studio-dim flex items-center justify-center">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Benefits</p>
              <p className="text-2xl font-bold">{metrics.active_benefits_count}</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[6px] bg-studio-ink/[0.05] text-studio-dim flex items-center justify-center">
              <ThumbsUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Uptake</p>
              <p className="text-2xl font-bold">{metrics.benefit_summary.avg_uptake_rate.toFixed(0)}%</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Benefits */}
        <BenefitsCard benefits={metrics.benefits} summary={metrics.benefit_summary} />

        {/* Surveys */}
        <SurveysCard
          surveys={metrics.surveys}
          latestSurvey={metrics.latest_survey}
          latestResponses={metrics.latest_responses}
        />

        {/* Participation Trend */}
        {metrics.survey_participation_trend.length > 0 && (
          <ParticipationTrendCard trend={metrics.survey_participation_trend} />
        )}
      </div>
    </div>
  );
}

export { ScoreGauge, BenefitsCard, SurveysCard, ParticipationTrendCard };
