'use client';

import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GraduationCap,
  Clock,
  Users,
  Award,
  TrendingUp,
  BookOpen,
  Video,
  MonitorPlay,
  Building2,
} from 'lucide-react';
import type { TrainingMetrics, TrainingTypeBreakdown } from '@/hooks/data/useTrainingMetrics';

interface TrainingDashboardProps {
  metrics: TrainingMetrics | null;
  isLoading?: boolean;
}

const DELIVERY_ICONS: Record<string, React.ReactNode> = {
  in_person: <Building2 className="h-4 w-4 text-studio-dim" />,
  virtual: <Video className="h-4 w-4 text-studio-dim" />,
  self_paced: <MonitorPlay className="h-4 w-4 text-studio-dim" />,
  blended: <BookOpen className="h-4 w-4 text-studio-dim" />,
};

function StatCard({
  title,
  value,
  subtitle,
  icon,
  target,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  target?: { value: number; label: string };
  className?: string;
}) {
  return (
    <Panel className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {target && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{target.label}</span>
                <span>{Math.round(target.value)}%</span>
              </div>
              <Progress value={target.value} indicatorClassName="bg-studio-ink" className="h-1.5" />
            </div>
          )}
        </div>
        <div className="h-10 w-10 rounded-[6px] bg-studio-ink/[0.05] text-studio-dim flex items-center justify-center">
          {icon}
        </div>
      </div>
    </Panel>
  );
}

function TrainingByTypeCard({ breakdown }: { breakdown: TrainingTypeBreakdown[] }) {
  const totalHours = breakdown.reduce((sum, item) => sum + item.total_hours, 0);

  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          Training by Type
        </span>
        <p className="text-sm text-muted-foreground">Hours breakdown by training category</p>
      </div>
      <div className="space-y-4">
        {breakdown.map((item) => {
          const percentage = totalHours > 0 ? (item.total_hours / totalHours) * 100 : 0;
          return (
            <div key={item.type} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StateChip tone="quiet">{item.type_display}</StateChip>
                  <span className="text-sm text-muted-foreground">
                    {item.count} sessions
                  </span>
                </div>
                <span className="text-sm font-medium">{item.total_hours.toFixed(0)} hrs</span>
              </div>
              <Progress value={percentage} indicatorClassName="bg-studio-ink" className="h-2" />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function DeliveryMethodCard({ byMethod }: { byMethod: Record<string, { count: number; hours: number }> }) {
  const methods = Object.entries(byMethod);
  if (methods.length === 0) return null;

  const totalSessions = methods.reduce((sum, [, data]) => sum + data.count, 0);

  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          Delivery Methods
        </span>
        <p className="text-sm text-muted-foreground">How training is delivered</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {methods.map(([method, data]) => {
          const percentage = totalSessions > 0 ? (data.count / totalSessions) * 100 : 0;
          const displayMethod = method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return (
            <div
              key={method}
              className="flex items-center gap-3 p-3 rounded-[6px] bg-studio-ink/[0.03]"
            >
              <div className="h-8 w-8 rounded-full bg-studio-paper border border-studio-hairline flex items-center justify-center">
                {DELIVERY_ICONS[method] || <BookOpen className="h-4 w-4 text-studio-dim" />}
              </div>
              <div>
                <p className="text-sm font-medium">{displayMethod}</p>
                <p className="text-xs text-muted-foreground">
                  {data.count} ({percentage.toFixed(0)}%)
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function RecentTrainingCard({ records }: { records: TrainingMetrics['records'] }) {
  const recentRecords = records.slice(0, 5);

  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          Recent Training
        </span>
        <p className="text-sm text-muted-foreground">Latest training activities</p>
      </div>
      {recentRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No training records yet
        </p>
      ) : (
        <div className="space-y-3">
          {recentRecords.map((record) => (
            <div
              key={record.id}
              className="flex items-start gap-3 p-3 rounded-[6px] bg-studio-ink/[0.03]"
            >
              <div className="h-8 w-8 rounded-full bg-studio-paper border border-studio-hairline flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-studio-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{record.training_name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StateChip tone="quiet">
                    {record.training_type.replace(/_/g, ' ')}
                  </StateChip>
                  <span className="text-xs text-muted-foreground">
                    {record.participants} participants
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {record.total_hours?.toFixed(0) || record.hours_per_participant} hrs
                  </span>
                </div>
              </div>
              {record.certification_awarded && (
                <Award className="h-4 w-4 text-studio-good flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function MonthlyTrendCard({ trend }: { trend: TrainingMetrics['monthly_trend'] }) {
  if (trend.length === 0) return null;

  const maxHours = Math.max(...trend.map(t => t.hours));

  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          Monthly Training Hours
        </span>
        <p className="text-sm text-muted-foreground">Training activity over time</p>
      </div>
      <div className="flex items-end gap-1 h-32">
        {trend.map((month) => {
          const height = maxHours > 0 ? (month.hours / maxHours) * 100 : 0;
          return (
            <div key={month.month} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-studio-ink rounded-t transition-all"
                style={{ height: `${height}%`, minHeight: month.hours > 0 ? '4px' : '0' }}
                title={`${month.hours.toFixed(0)} hours`}
              />
              <span className="text-xs text-muted-foreground mt-1 rotate-45 origin-left">
                {month.month.substring(5)}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function TrainingDashboard({ metrics, isLoading }: TrainingDashboardProps) {
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
        <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No Training Data</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Add training records to track learning and development activities,
          hours per employee, and certifications.
        </p>
      </Panel>
    );
  }

  // B Corp suggests 20+ hours per employee as excellent
  const hoursTarget = Math.min(100, (metrics.avg_hours_per_employee / 20) * 100);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Hours"
          value={metrics.total_hours.toLocaleString()}
          subtitle="Training hours delivered"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Hours per Employee"
          value={metrics.avg_hours_per_employee.toFixed(1)}
          subtitle="Average annual hours"
          icon={<TrendingUp className="h-5 w-5" />}
          target={{ value: hoursTarget, label: 'vs 20hr target' }}
        />
        <StatCard
          title="Participants"
          value={metrics.total_participants.toLocaleString()}
          subtitle="Total participations"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Certifications"
          value={metrics.certifications_awarded}
          subtitle="Awarded this year"
          icon={<Award className="h-5 w-5" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Training by Type */}
        {metrics.by_type.length > 0 && (
          <TrainingByTypeCard breakdown={metrics.by_type} />
        )}

        {/* Recent Training */}
        <RecentTrainingCard records={metrics.records} />

        {/* Delivery Methods */}
        <DeliveryMethodCard byMethod={metrics.by_delivery_method} />

        {/* Monthly Trend */}
        {metrics.monthly_trend.length > 0 && (
          <MonthlyTrendCard trend={metrics.monthly_trend} />
        )}
      </div>

      {/* Quality Metrics */}
      {(metrics.avg_satisfaction || metrics.avg_completion_rate) && (
        <Panel className="p-6">
          <div className="pb-4">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
              Quality Metrics
            </span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {metrics.avg_satisfaction && (
              <div>
                <p className="text-sm text-muted-foreground">Average Satisfaction</p>
                <p className="text-2xl font-bold">{metrics.avg_satisfaction.toFixed(1)}/5</p>
                <Progress value={(metrics.avg_satisfaction / 5) * 100} indicatorClassName="bg-studio-ink" className="h-2 mt-2" />
              </div>
            )}
            {metrics.avg_completion_rate && (
              <div>
                <p className="text-sm text-muted-foreground">Average Completion Rate</p>
                <p className="text-2xl font-bold">{metrics.avg_completion_rate.toFixed(0)}%</p>
                <Progress value={metrics.avg_completion_rate} indicatorClassName="bg-studio-ink" className="h-2 mt-2" />
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

export { StatCard, TrainingByTypeCard, DeliveryMethodCard, RecentTrainingCard, MonthlyTrendCard };
