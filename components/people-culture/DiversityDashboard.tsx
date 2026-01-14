'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  UserPlus,
  UserMinus,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiversityMetrics, DEIAction, GenderRepresentation } from '@/hooks/data/useDiversityMetrics';

interface DiversityDashboardProps {
  metrics: DiversityMetrics | null;
  isLoading?: boolean;
}

const STATUS_CONFIG = {
  planned: { label: 'Planned', color: 'bg-slate-100 text-slate-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: TrendingUp },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  recruitment: 'Recruitment',
  retention: 'Retention',
  development: 'Development',
  culture: 'Culture',
  accessibility: 'Accessibility',
  policy: 'Policy',
};

function GenderBreakdownChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  if (total === 0) return null;

  const colors = {
    male: 'bg-blue-500',
    female: 'bg-pink-500',
    non_binary: 'bg-purple-500',
    prefer_not_to_say: 'bg-slate-400',
    not_disclosed: 'bg-slate-300',
  };

  return (
    <div className="space-y-3">
      <div className="flex h-4 rounded-full overflow-hidden">
        {Object.entries(data).map(([key, value]) => {
          const percentage = (value / total) * 100;
          if (percentage === 0) return null;
          return (
            <div
              key={key}
              className={cn(colors[key as keyof typeof colors] || 'bg-slate-400')}
              style={{ width: `${percentage}%` }}
              title={`${key}: ${value} (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {Object.entries(data).map(([key, value]) => {
          const percentage = (value / total) * 100;
          if (value === 0) return null;
          return (
            <div key={key} className="flex items-center gap-2">
              <div className={cn('h-3 w-3 rounded-full', colors[key as keyof typeof colors] || 'bg-slate-400')} />
              <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="font-medium">{percentage.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RepresentationCard({ representation }: { representation: GenderRepresentation[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gender Representation by Level</CardTitle>
        <CardDescription>Women in leadership positions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {representation.map((level) => (
            <div key={level.level} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{level.level}</span>
                <span className="font-medium">{level.female_percentage.toFixed(0)}% women</span>
              </div>
              <Progress value={level.female_percentage} className="h-2" />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Total: {level.total}</span>
                <span>Women: {level.female}</span>
                <span>Men: {level.male}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DEIActionsCard({ actions, summary }: { actions: DEIAction[]; summary: DiversityMetrics['dei_summary'] }) {
  const recentActions = actions.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">DEI Actions</CardTitle>
            <CardDescription>Diversity, equity & inclusion initiatives</CardDescription>
          </div>
          <Badge variant="outline">
            {summary.completion_rate.toFixed(0)}% complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary by status */}
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(summary.by_status).map(([status, count]) => {
              const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
              if (!config) return null;
              return (
                <div key={status} className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              );
            })}
          </div>

          {/* Recent actions */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Actions</p>
            {recentActions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No DEI actions recorded yet
              </p>
            ) : (
              recentActions.map((action) => {
                const config = STATUS_CONFIG[action.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planned;
                const Icon = config.icon;
                return (
                  <div
                    key={action.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                  >
                    <div className={cn('p-1.5 rounded-full', config.color)}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{action.action_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[action.action_category] || action.action_category}
                        </Badge>
                        {action.target_date && (
                          <span className="text-xs text-muted-foreground">
                            Due: {new Date(action.target_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TurnoverCard({
  turnoverRate,
  voluntaryTurnoverRate,
  newHires,
  departures,
}: {
  turnoverRate: number | null;
  voluntaryTurnoverRate: number | null;
  newHires: number;
  departures: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Employee Movement</CardTitle>
        <CardDescription>Hiring and turnover metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
            <UserPlus className="h-6 w-6 mx-auto text-emerald-600" />
            <p className="text-2xl font-bold mt-2">{newHires}</p>
            <p className="text-xs text-muted-foreground">New Hires</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950/30">
            <UserMinus className="h-6 w-6 mx-auto text-red-600" />
            <p className="text-2xl font-bold mt-2">{departures}</p>
            <p className="text-xs text-muted-foreground">Departures</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Turnover Rate</span>
            <span className="font-medium">
              {turnoverRate !== null ? `${turnoverRate.toFixed(1)}%` : '—'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Voluntary Turnover</span>
            <span className="font-medium">
              {voluntaryTurnoverRate !== null ? `${voluntaryTurnoverRate.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>Industry average turnover: ~15-20% annually</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DiversityDashboard({ metrics, isLoading }: DiversityDashboardProps) {
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
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Diversity Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Add workforce demographics to see diversity analytics including gender breakdown,
            representation by level, and turnover metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { demographics, dei_actions, dei_summary, gender_representation, turnover_rate, voluntary_turnover_rate } = metrics;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold">{demographics?.total_employees || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">DEI Actions</p>
                <p className="text-2xl font-bold">{dei_summary.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{dei_summary.by_status.completed || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Response Rate</p>
                <p className="text-2xl font-bold">
                  {demographics?.response_rate ? `${demographics.response_rate.toFixed(0)}%` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gender Breakdown */}
      {demographics?.gender_data && Object.keys(demographics.gender_data).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gender Distribution</CardTitle>
            <CardDescription>Workforce breakdown by gender</CardDescription>
          </CardHeader>
          <CardContent>
            <GenderBreakdownChart data={demographics.gender_data} />
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Representation by Level */}
        {gender_representation.length > 0 && (
          <RepresentationCard representation={gender_representation} />
        )}

        {/* DEI Actions */}
        <DEIActionsCard actions={dei_actions} summary={dei_summary} />

        {/* Turnover */}
        <TurnoverCard
          turnoverRate={turnover_rate}
          voluntaryTurnoverRate={voluntary_turnover_rate}
          newHires={demographics?.new_hires || 0}
          departures={demographics?.departures || 0}
        />
      </div>
    </div>
  );
}

export { GenderBreakdownChart, RepresentationCard, DEIActionsCard, TurnoverCard };
