'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Briefcase,
  Heart,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PillarScore {
  name: string;
  score: number | null;
  icon: React.ReactNode;
  description: string;
}

interface PeopleCultureScoreHeroProps {
  overallScore: number | null;
  fairWorkScore: number | null;
  diversityScore: number | null;
  wellbeingScore: number | null;
  trainingScore: number | null;
  previousScore?: number | null;
  dataCompleteness?: number | null;
  isLoading?: boolean;
  onRecalculate?: () => void;
  isRecalculating?: boolean;
}

function ScoreRing({
  score,
  size = 'lg',
  className,
}: {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
  };

  const strokeWidth = size === 'lg' ? 8 : size === 'md' ? 6 : 4;
  const radius = size === 'lg' ? 56 : size === 'md' ? 42 : 28;
  const circumference = 2 * Math.PI * radius;
  const offset = score !== null ? circumference - (score / 100) * circumference : circumference;

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'stroke-slate-300';
    if (score >= 80) return 'stroke-emerald-500';
    if (score >= 60) return 'stroke-lime-500';
    if (score >= 40) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  return (
    <div className={cn('relative', sizeClasses[size], className)}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-700"
        />
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-1000 ease-out', getScoreColor(score))}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn(
          'font-bold',
          size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-sm'
        )}>
          {score !== null ? score : '—'}
        </span>
      </div>
    </div>
  );
}

function PillarMiniCard({
  pillar,
  className,
}: {
  pillar: PillarScore;
  className?: string;
}) {
  const getScoreBadge = (score: number | null) => {
    if (score === null) return { label: 'No Data', variant: 'outline' as const };
    if (score >= 80) return { label: 'Excellent', variant: 'default' as const };
    if (score >= 60) return { label: 'Good', variant: 'secondary' as const };
    if (score >= 40) return { label: 'Fair', variant: 'outline' as const };
    return { label: 'Needs Work', variant: 'destructive' as const };
  };

  const badge = getScoreBadge(pillar.score);

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50',
      className
    )}>
      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center">
        {pillar.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{pillar.name}</span>
          <span className="text-lg font-bold">{pillar.score ?? '—'}</span>
        </div>
        <Badge variant={badge.variant} className="text-xs mt-1">
          {badge.label}
        </Badge>
      </div>
    </div>
  );
}

function TrendIndicator({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return null;

  const diff = current - previous;
  if (Math.abs(diff) < 1) return null;

  return (
    <div className={cn(
      'flex items-center gap-1 text-sm font-medium',
      diff > 0 ? 'text-emerald-600' : 'text-red-600'
    )}>
      {diff > 0 ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <span>{diff > 0 ? '+' : ''}{diff.toFixed(0)}</span>
    </div>
  );
}

export function PeopleCultureScoreHero({
  overallScore,
  fairWorkScore,
  diversityScore,
  wellbeingScore,
  trainingScore,
  previousScore,
  dataCompleteness,
  isLoading,
  onRecalculate,
  isRecalculating,
}: PeopleCultureScoreHeroProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <Skeleton className="h-32 w-32 rounded-full" />
            <div className="grid grid-cols-2 gap-4 flex-1">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pillars: PillarScore[] = [
    {
      name: 'Fair Work',
      score: fairWorkScore,
      icon: <Briefcase className="h-5 w-5 text-blue-600" />,
      description: 'Living wage, pay equity, compensation',
    },
    {
      name: 'Diversity & Inclusion',
      score: diversityScore,
      icon: <Users className="h-5 w-5 text-purple-600" />,
      description: 'Demographics, representation, DEI actions',
    },
    {
      name: 'Wellbeing',
      score: wellbeingScore,
      icon: <Heart className="h-5 w-5 text-pink-600" />,
      description: 'Employee satisfaction, benefits, engagement',
    },
    {
      name: 'Training & Development',
      score: trainingScore,
      icon: <GraduationCap className="h-5 w-5 text-amber-600" />,
      description: 'Learning hours, skills development',
    },
  ];

  const hasAnyScore = overallScore !== null;

  return (
    <Card className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20" />

      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              People & Culture Score
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Workforce wellbeing, diversity, and development metrics
            </p>
          </div>
          {onRecalculate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRecalculate}
              disabled={isRecalculating}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isRecalculating && 'animate-spin')} />
              {isRecalculating ? 'Calculating...' : 'Recalculate'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative">
        {!hasAnyScore ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Score Available</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Add compensation data, workforce demographics, and training records to calculate your People & Culture score.
            </p>
            {onRecalculate && (
              <Button onClick={onRecalculate} disabled={isRecalculating}>
                <RefreshCw className={cn('h-4 w-4 mr-2', isRecalculating && 'animate-spin')} />
                Calculate Score
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Main Score Ring */}
            <div className="flex flex-col items-center">
              <ScoreRing score={overallScore} size="lg" />
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-medium">Overall Score</span>
                <TrendIndicator current={overallScore} previous={previousScore ?? null} />
              </div>
              {dataCompleteness != null && dataCompleteness < 100 && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {dataCompleteness.toFixed(0)}% data completeness
                </Badge>
              )}
            </div>

            {/* Pillar Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 w-full">
              {pillars.map((pillar) => (
                <PillarMiniCard key={pillar.name} pillar={pillar} />
              ))}
            </div>
          </div>
        )}

        {/* Score methodology note */}
        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
          <p>
            <strong>Methodology:</strong> Fair Work (30%) + Diversity (30%) + Wellbeing (20%) + Training (20%).
            Aligned with B Corp People requirements and CSRD ESRS S1.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export { ScoreRing, PillarMiniCard };
