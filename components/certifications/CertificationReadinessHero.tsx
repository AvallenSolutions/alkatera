'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StateChip } from '@/components/studio/state-chip';
import { Award, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react';

interface ReadinessSummary {
  totalFrameworks: number;
  certified: number;
  ready: number;
  inProgress: number;
  notStarted: number;
  averageScore: number;
}

interface CertificationReadinessHeroProps {
  summary: ReadinessSummary | null;
  loading?: boolean;
}

export function CertificationReadinessHero({ summary, loading }: CertificationReadinessHeroProps) {
  if (loading) {
    return (
      <Card className="rounded-[6px] border-border bg-card">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="rounded-[6px] border-border bg-card">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No certification tracking data available yet.</p>
            <p className="text-sm">Select a framework to start tracking your certification journey.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallReadiness = summary.totalFrameworks > 0
    ? Math.round(((summary.certified + summary.ready) / summary.totalFrameworks) * 100)
    : 0;

  return (
    <Card className="rounded-[6px] border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-studio-brick" />
            <CardTitle className="font-display">Certification Readiness</CardTitle>
          </div>
          <StateChip tone={overallReadiness >= 80 ? 'good' : overallReadiness >= 50 ? 'attention' : 'quiet'}>
            {overallReadiness}% Ready
          </StateChip>
        </div>
        <CardDescription>
          Track your progress across sustainability certification frameworks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              Overall Progress
            </span>
            <span className="text-sm font-medium tabular-nums">{summary.averageScore}% Average Score</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-studio-brick"
              style={{ width: `${Math.max(0, Math.min(100, summary.averageScore))}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatusCard
            icon={<Award className="h-4 w-4 text-studio-good" />}
            label="Certified"
            value={summary.certified}
          />
          <StatusCard
            icon={<CheckCircle2 className="h-4 w-4 text-studio-brick" />}
            label="Ready"
            value={summary.ready}
          />
          <StatusCard
            icon={<TrendingUp className="h-4 w-4 text-studio-attention" />}
            label="In Progress"
            value={summary.inProgress}
          />
          <StatusCard
            icon={<Clock className="h-4 w-4 text-studio-dim" />}
            label="Not Started"
            value={summary.notStarted}
          />
          <StatusCard
            icon={<AlertCircle className="h-4 w-4 text-foreground" />}
            label="Total"
            value={summary.totalFrameworks}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface StatusCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

function StatusCard({ icon, label, value }: StatusCardProps) {
  return (
    <div className="p-4 rounded-[6px] border border-border bg-card">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
          {label}
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold leading-none tabular-nums">{value}</p>
    </div>
  );
}
