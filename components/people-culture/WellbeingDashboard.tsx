'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Heart,
  MessageSquare,
  Gift,
  Users,
  TrendingUp,
  CheckCircle2,
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
  health: <Heart className="h-4 w-4 text-red-500" />,
  pension: <Gift className="h-4 w-4 text-blue-500" />,
  leave: <Clock className="h-4 w-4 text-green-500" />,
  flexible_working: <Users className="h-4 w-4 text-purple-500" />,
  wellness: <Heart className="h-4 w-4 text-pink-500" />,
  financial: <Gift className="h-4 w-4 text-amber-500" />,
  family: <Users className="h-4 w-4 text-cyan-500" />,
  development: <TrendingUp className="h-4 w-4 text-indigo-500" />,
};

const SURVEY_STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
  closed: { label: 'Closed', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500' },
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
      <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-muted-foreground mt-1">—</p>
      </div>
    );
  }

  const percentage = (score / maxScore) * 100;
  const status = percentage >= 80 ? 'excellent' : percentage >= 60 ? 'good' : percentage >= 40 ? 'fair' : 'needs_improvement';
  const statusColors = {
    excellent: 'text-emerald-600',
    good: 'text-lime-600',
    fair: 'text-yellow-600',
    needs_improvement: 'text-red-600',
  };

  return (
    <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('text-3xl font-bold mt-1', statusColors[status])}>
        {score.toFixed(1)}
        <span className="text-sm text-muted-foreground">/{maxScore}</span>
      </p>
      <Progress value={percentage} className="h-2 mt-2" />
    </div>
  );
}

function BenefitsCard({ benefits, summary }: { benefits: WellbeingMetrics['benefits']; summary: WellbeingMetrics['benefit_summary'] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Employee Benefits</CardTitle>
            <CardDescription>Available benefits and uptake</CardDescription>
          </div>
          <Badge variant="outline">
            {summary.total} benefits
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
              <p className="text-xs text-muted-foreground uppercase">Avg Uptake</p>
              <p className="text-xl font-bold">{summary.avg_uptake_rate.toFixed(0)}%</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
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
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"
              >
                <div className="flex items-center gap-2">
                  {BENEFIT_TYPE_ICONS[type.type] || <Gift className="h-4 w-4" />}
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
      </CardContent>
    </Card>
  );
}

function SurveysCard({ surveys, latestSurvey, latestResponses }: {
  surveys: EmployeeSurvey[];
  latestSurvey: EmployeeSurvey | null;
  latestResponses: WellbeingMetrics['latest_responses'];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Employee Surveys</CardTitle>
            <CardDescription>Feedback and engagement tracking</CardDescription>
          </div>
          <Badge variant="outline">
            {surveys.length} surveys
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {latestSurvey ? (
            <>
              {/* Latest Survey */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">{latestSurvey.survey_name}</p>
                    <Badge
                      className={cn(
                        'text-xs mt-1',
                        SURVEY_STATUS_CONFIG[latestSurvey.status as keyof typeof SURVEY_STATUS_CONFIG]?.color
                      )}
                    >
                      {SURVEY_STATUS_CONFIG[latestSurvey.status as keyof typeof SURVEY_STATUS_CONFIG]?.label || latestSurvey.status}
                    </Badge>
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
                        <Progress value={(score / 5) * 100} className="flex-1 h-2" />
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
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[150px]">{survey.survey_name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {survey.response_rate ? `${survey.response_rate.toFixed(0)}%` : '—'}
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
      </CardContent>
    </Card>
  );
}

function ParticipationTrendCard({ trend }: { trend: WellbeingMetrics['survey_participation_trend'] }) {
  if (trend.length === 0) return null;

  const maxRate = Math.max(...trend.map(t => t.response_rate));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Survey Participation Trend</CardTitle>
        <CardDescription>Response rates over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-32">
          {trend.map((item, idx) => {
            const height = maxRate > 0 ? (item.response_rate / maxRate) * 100 : 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <span className="text-xs font-medium mb-1">{item.response_rate.toFixed(0)}%</span>
                <div
                  className="w-full bg-blue-500 rounded-t transition-all"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                />
                <span className="text-xs text-muted-foreground mt-2 text-center line-clamp-1">
                  {item.survey_name.substring(0, 8)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Heart className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Wellbeing Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Add employee surveys and benefits to track wellbeing metrics,
            engagement scores, and benefit uptake.
          </p>
        </CardContent>
      </Card>
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Gift className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Benefits</p>
                <p className="text-2xl font-bold">{metrics.active_benefits_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Uptake</p>
                <p className="text-2xl font-bold">{metrics.benefit_summary.avg_uptake_rate.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
