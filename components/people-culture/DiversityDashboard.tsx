'use client';

import { Button } from '@/components/ui/button';
import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
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
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPeriodRange } from '@/lib/reporting-period-utils';
import type { DiversityMetrics, DEIAction, GenderRepresentation, PeriodChanges } from '@/hooks/data/useDiversityMetrics';

interface DiversityDashboardProps {
  metrics: DiversityMetrics | null;
  isLoading?: boolean;
  onEditAction?: (action: DEIAction) => void;
}

const STATUS_CONFIG = {
  planned: { label: 'Planned', medallion: 'bg-studio-ink/[0.05] text-studio-dim', icon: Clock },
  in_progress: { label: 'In Progress', medallion: 'bg-studio-attention/10 text-studio-attention', icon: TrendingUp },
  completed: { label: 'Completed', medallion: 'bg-studio-good/10 text-studio-good', icon: CheckCircle2 },
  on_hold: { label: 'On Hold', medallion: 'bg-studio-attention/10 text-studio-attention', icon: AlertCircle },
  cancelled: { label: 'Cancelled', medallion: 'bg-studio-stale/10 text-studio-stale', icon: AlertCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  recruitment: 'Recruitment',
  retention: 'Retention',
  development: 'Development',
  culture: 'Culture',
  accessibility: 'Accessibility',
  policy: 'Policy',
};

function ChangeIndicator({ delta, percentage, invertColor = false }: {
  delta: number;
  percentage: number | null;
  invertColor?: boolean;
}) {
  if (delta === 0) {
    return (
      <span className="flex items-center text-xs text-muted-foreground">
        <Minus className="h-3 w-3 mr-0.5" />
        No change
      </span>
    );
  }

  const isPositive = delta > 0;
  // For some metrics (like turnover), positive = bad, so we invert the colour
  const isGood = invertColor ? !isPositive : isPositive;

  return (
    <span className={cn(
      'flex items-center text-xs font-medium',
      isGood ? 'text-studio-good' : 'text-studio-stale'
    )}>
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3 mr-0.5" />
      ) : (
        <ArrowDownRight className="h-3 w-3 mr-0.5" />
      )}
      {percentage !== null ? `${Math.abs(percentage).toFixed(1)}%` : `${Math.abs(delta).toFixed(1)}`}
    </span>
  );
}

function ReportingPeriodBadge({ demographics }: { demographics: DiversityMetrics['demographics'] }) {
  if (!demographics) return null;

  let periodLabel: string;
  if (demographics.reporting_period_start && demographics.reporting_period_end) {
    periodLabel = formatPeriodRange(demographics.reporting_period_start, demographics.reporting_period_end);
  } else if (demographics.reporting_period) {
    periodLabel = new Date(demographics.reporting_period).toLocaleDateString('en-GB', {
      month: 'short', year: 'numeric'
    });
  } else {
    return null;
  }

  return (
    <StateChip tone="quiet" className="inline-flex items-center gap-1">
      <Calendar className="h-3 w-3" />
      {periodLabel}
    </StateChip>
  );
}

// Gender distribution is categorical data-viz: distinct studio inks per category,
// muted to gallery grade, not a working-tone ladder.
function GenderBreakdownChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  if (total === 0) return null;

  const colors = {
    male: 'bg-studio-cobalt',
    female: 'bg-studio-plum',
    non_binary: 'bg-studio-ochre',
    prefer_not_to_say: 'bg-studio-teal',
    not_disclosed: 'bg-studio-dim',
  };

  return (
    <div className="space-y-3">
      <div className="flex h-4 rounded-[6px] overflow-hidden">
        {Object.entries(data).map(([key, value]) => {
          const percentage = (value / total) * 100;
          if (percentage === 0) return null;
          return (
            <div
              key={key}
              className={cn(colors[key as keyof typeof colors] || 'bg-studio-dim')}
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
              <div className={cn('h-3 w-3 rounded-[2px]', colors[key as keyof typeof colors] || 'bg-studio-dim')} />
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
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          Gender Representation by Level
        </span>
        <p className="text-sm text-muted-foreground">Women in leadership positions</p>
      </div>
      <div className="space-y-4">
        {representation.map((level) => (
          <div key={level.level} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{level.level}</span>
              <span className="font-medium">{level.female_percentage.toFixed(0)}% women</span>
            </div>
            <Progress value={level.female_percentage} indicatorClassName="bg-studio-ink" className="h-2" />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Total: {level.total}</span>
              <span>Women: {level.female}</span>
              <span>Men: {level.male}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DEIActionsCard({ actions, summary, onEditAction }: { actions: DEIAction[]; summary: DiversityMetrics['dei_summary']; onEditAction?: (action: DEIAction) => void }) {
  const recentActions = actions.slice(0, 5);

  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between pb-4">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
            DEI Actions
          </span>
          <p className="text-sm text-muted-foreground">Diversity, equity and inclusion initiatives</p>
        </div>
        <StateChip tone="quiet">{summary.completion_rate.toFixed(0)}% complete</StateChip>
      </div>
      <div className="space-y-4">
        {/* Summary by status */}
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(summary.by_status).map(([status, count]) => {
            const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
            if (!config) return null;
            return (
              <div key={status} className="text-center p-2 rounded-[6px] bg-studio-ink/[0.03]">
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
                  className="flex items-center justify-between w-full p-3 rounded-[6px] bg-studio-ink/[0.03]"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn('p-1.5 rounded-full', config.medallion)}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{action.action_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StateChip tone="quiet">
                          {CATEGORY_LABELS[action.action_category] || action.action_category}
                        </StateChip>
                        {action.target_date && (
                          <span className="text-xs text-muted-foreground">
                            Due: {new Date(action.target_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {onEditAction && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 ml-2 shrink-0" onClick={() => onEditAction(action)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Panel>
  );
}

function TurnoverCard({
  turnoverRate,
  voluntaryTurnoverRate,
  newHires,
  departures,
  periodChanges,
}: {
  turnoverRate: number | null;
  voluntaryTurnoverRate: number | null;
  newHires: number;
  departures: number;
  periodChanges: PeriodChanges | null;
}) {
  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          Employee Movement
        </span>
        <p className="text-sm text-muted-foreground">Hiring and turnover metrics</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 rounded-[6px] bg-studio-good/5">
          <UserPlus className="h-6 w-6 mx-auto text-studio-good" />
          <p className="text-2xl font-bold mt-2">{newHires}</p>
          <p className="text-xs text-muted-foreground">New Hires</p>
          {periodChanges && (
            <div className="mt-1">
              <ChangeIndicator
                delta={periodChanges.new_hires.delta}
                percentage={periodChanges.new_hires.percentage}
              />
            </div>
          )}
        </div>
        <div className="text-center p-4 rounded-[6px] bg-studio-stale/5">
          <UserMinus className="h-6 w-6 mx-auto text-studio-stale" />
          <p className="text-2xl font-bold mt-2">{departures}</p>
          <p className="text-xs text-muted-foreground">Departures</p>
          {periodChanges && (
            <div className="mt-1">
              <ChangeIndicator
                delta={periodChanges.departures.delta}
                percentage={periodChanges.departures.percentage}
                invertColor
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Turnover Rate</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {turnoverRate !== null ? `${turnoverRate.toFixed(1)}%` : '·'}
            </span>
            {periodChanges && (
              <ChangeIndicator
                delta={periodChanges.turnover_rate.delta}
                percentage={null}
                invertColor
              />
            )}
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Voluntary Turnover</span>
          <span className="font-medium">
            {voluntaryTurnoverRate !== null ? `${voluntaryTurnoverRate.toFixed(1)}%` : '·'}
          </span>
        </div>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        <p>Industry average turnover: ~15-20% annually</p>
      </div>
    </Panel>
  );
}

function PeriodComparisonCard({ changes }: { changes: PeriodChanges }) {
  const metrics = [
    { label: 'Total Employees', ...changes.total_employees },
    { label: 'Female Representation', ...changes.female_percentage, suffix: 'pp' },
    { label: 'New Hires', ...changes.new_hires },
    { label: 'Departures', ...changes.departures, invertColor: true },
    { label: 'Turnover Rate', ...changes.turnover_rate, suffix: 'pp', invertColor: true },
  ];

  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Period Comparison
        </span>
        <p className="text-sm text-muted-foreground">
          {changes.current_period_label && changes.previous_period_label
            ? `${changes.current_period_label} vs ${changes.previous_period_label}`
            : 'Current vs previous reporting period'}
        </p>
      </div>
      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-studio-hairline last:border-0">
            <span className="text-sm text-muted-foreground">{m.label}</span>
            <ChangeIndicator
              delta={m.delta}
              percentage={m.percentage}
              invertColor={'invertColor' in m ? (m as { invertColor: boolean }).invertColor : false}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function DiversityDashboard({ metrics, isLoading, onEditAction }: DiversityDashboardProps) {
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
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No Diversity Data</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Add workforce demographics to see diversity analytics including gender breakdown,
          representation by level, and turnover metrics.
        </p>
      </Panel>
    );
  }

  const { demographics, dei_actions, dei_summary, gender_representation, turnover_rate, voluntary_turnover_rate, period_changes } = metrics;

  return (
    <div className="space-y-6">
      {/* Reporting Period Badge */}
      {demographics && (
        <div className="flex items-center gap-2">
          <ReportingPeriodBadge demographics={demographics} />
          {demographics.created_at && (
            <span className="text-xs text-muted-foreground">
              Data entered: {new Date(demographics.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[6px] bg-studio-ink/[0.05] text-studio-dim flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Employees</p>
              <p className="text-2xl font-bold">{demographics?.total_employees || 0}</p>
              {period_changes && (
                <ChangeIndicator
                  delta={period_changes.total_employees.delta}
                  percentage={period_changes.total_employees.percentage}
                />
              )}
            </div>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[6px] bg-studio-ink/[0.05] text-studio-dim flex items-center justify-center">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">DEI Actions</p>
              <p className="text-2xl font-bold">{dei_summary.total}</p>
            </div>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[6px] bg-studio-ink/[0.05] text-studio-dim flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{dei_summary.by_status.completed || 0}</p>
            </div>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[6px] bg-studio-ink/[0.05] text-studio-dim flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Response Rate</p>
              <p className="text-2xl font-bold">
                {demographics?.response_rate ? `${demographics.response_rate.toFixed(0)}%` : '·'}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Gender Breakdown */}
      {demographics?.gender_data && Object.keys(demographics.gender_data).length > 0 && (
        <Panel className="p-6">
          <div className="pb-4">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
              Gender Distribution
            </span>
            <p className="text-sm text-muted-foreground">Workforce breakdown by gender</p>
          </div>
          <GenderBreakdownChart data={demographics.gender_data} />
        </Panel>
      )}

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Representation by Level */}
        {gender_representation.length > 0 && (
          <RepresentationCard representation={gender_representation} />
        )}

        {/* DEI Actions */}
        <DEIActionsCard actions={dei_actions} summary={dei_summary} onEditAction={onEditAction} />

        {/* Turnover */}
        <TurnoverCard
          turnoverRate={turnover_rate}
          voluntaryTurnoverRate={voluntary_turnover_rate}
          newHires={demographics?.new_hires || 0}
          departures={demographics?.departures || 0}
          periodChanges={period_changes}
        />

        {/* Period Comparison */}
        {period_changes && (
          <PeriodComparisonCard changes={period_changes} />
        )}
      </div>
    </div>
  );
}

export { GenderBreakdownChart, RepresentationCard, DEIActionsCard, TurnoverCard, PeriodComparisonCard, ChangeIndicator, ReportingPeriodBadge };
