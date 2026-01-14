'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
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
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
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
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-600" />
            <CardTitle>Certification Readiness</CardTitle>
          </div>
          <Badge
            variant={overallReadiness >= 80 ? 'default' : overallReadiness >= 50 ? 'secondary' : 'outline'}
            className={overallReadiness >= 80 ? 'bg-emerald-500' : ''}
          >
            {overallReadiness}% Ready
          </Badge>
        </div>
        <CardDescription>
          Track your progress across sustainability certification frameworks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{summary.averageScore}% Average Score</span>
          </div>
          <Progress value={summary.averageScore} className="h-3" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatusCard
            icon={<Award className="h-5 w-5 text-emerald-600" />}
            label="Certified"
            value={summary.certified}
            bgColor="bg-emerald-50 dark:bg-emerald-950/30"
            borderColor="border-emerald-200 dark:border-emerald-800"
          />
          <StatusCard
            icon={<CheckCircle2 className="h-5 w-5 text-blue-600" />}
            label="Ready"
            value={summary.ready}
            bgColor="bg-blue-50 dark:bg-blue-950/30"
            borderColor="border-blue-200 dark:border-blue-800"
          />
          <StatusCard
            icon={<TrendingUp className="h-5 w-5 text-amber-600" />}
            label="In Progress"
            value={summary.inProgress}
            bgColor="bg-amber-50 dark:bg-amber-950/30"
            borderColor="border-amber-200 dark:border-amber-800"
          />
          <StatusCard
            icon={<Clock className="h-5 w-5 text-slate-500" />}
            label="Not Started"
            value={summary.notStarted}
            bgColor="bg-slate-50 dark:bg-slate-800"
            borderColor="border-slate-200 dark:border-slate-700"
          />
          <StatusCard
            icon={<AlertCircle className="h-5 w-5 text-purple-600" />}
            label="Total"
            value={summary.totalFrameworks}
            bgColor="bg-purple-50 dark:bg-purple-950/30"
            borderColor="border-purple-200 dark:border-purple-800"
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
  bgColor: string;
  borderColor: string;
}

function StatusCard({ icon, label, value, bgColor, borderColor }: StatusCardProps) {
  return (
    <div className={`p-4 rounded-lg border ${bgColor} ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
