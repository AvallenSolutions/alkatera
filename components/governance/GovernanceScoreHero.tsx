'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GovernanceScoreHeroProps {
  overallScore: number | null;
  policyScore: number | null;
  stakeholderScore: number | null;
  boardScore: number | null;
  ethicsScore: number | null;
  transparencyScore: number | null;
  dataCompleteness: number | null;
  isLoading?: boolean;
  onRecalculate?: () => void;
  isRecalculating?: boolean;
}

function ScoreRing({
  score,
  size = 'large',
  label,
  color = 'emerald',
}: {
  score: number | null;
  size?: 'large' | 'small';
  label?: string;
  color?: string;
}) {
  const radius = size === 'large' ? 70 : 30;
  const strokeWidth = size === 'large' ? 10 : 6;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 100) * circumference : 0;
  const viewBoxSize = (radius + strokeWidth) * 2;

  const colorClasses: Record<string, { stroke: string; text: string }> = {
    emerald: { stroke: 'stroke-emerald-500', text: 'text-emerald-600' },
    blue: { stroke: 'stroke-blue-500', text: 'text-blue-600' },
    purple: { stroke: 'stroke-purple-500', text: 'text-purple-600' },
    amber: { stroke: 'stroke-amber-500', text: 'text-amber-600' },
    pink: { stroke: 'stroke-pink-500', text: 'text-pink-600' },
    slate: { stroke: 'stroke-slate-500', text: 'text-slate-600' },
  };

  const colors = colorClasses[color] || colorClasses.emerald;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={viewBoxSize}
        height={viewBoxSize}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="transform -rotate-90"
      >
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-700"
        />
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colors.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      <div
        className={`absolute flex flex-col items-center justify-center ${
          size === 'large' ? 'w-[160px] h-[160px]' : 'w-[72px] h-[72px]'
        }`}
      >
        <span
          className={`font-bold ${colors.text} ${
            size === 'large' ? 'text-4xl' : 'text-lg'
          }`}
        >
          {score !== null ? Math.round(score) : '—'}
        </span>
        {size === 'large' && (
          <span className="text-sm text-muted-foreground">/ 100</span>
        )}
      </div>
      {label && (
        <span className="mt-2 text-sm font-medium text-center">{label}</span>
      )}
    </div>
  );
}

function PillarCard({
  title,
  score,
  color,
  description,
  weight,
}: {
  title: string;
  score: number | null;
  color: string;
  description: string;
  weight: string;
}) {
  const getScoreStatus = (score: number | null) => {
    if (score === null) return { label: 'No data', icon: Minus, color: 'text-slate-400' };
    if (score >= 80) return { label: 'Excellent', icon: TrendingUp, color: 'text-emerald-500' };
    if (score >= 60) return { label: 'Good', icon: TrendingUp, color: 'text-blue-500' };
    if (score >= 40) return { label: 'Developing', icon: Minus, color: 'text-amber-500' };
    return { label: 'Needs attention', icon: TrendingDown, color: 'text-red-500' };
  };

  const status = getScoreStatus(score);
  const StatusIcon = status.icon;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{title}</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">{description}</p>
                    <p className="text-xs text-muted-foreground mt-1">Weight: {weight}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-2xl font-bold ${status.color}`}>
                {score !== null ? Math.round(score) : '—'}
              </span>
              <StatusIcon className={`h-4 w-4 ${status.color}`} />
            </div>
            <span className="text-xs text-muted-foreground">{status.label}</span>
          </div>
          <div className="relative w-[72px] h-[72px] flex items-center justify-center">
            <ScoreRing score={score} size="small" color={color} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GovernanceScoreHero({
  overallScore,
  policyScore,
  stakeholderScore,
  boardScore,
  ethicsScore,
  transparencyScore,
  dataCompleteness,
  isLoading,
  onRecalculate,
  isRecalculating,
}: GovernanceScoreHeroProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Skeleton className="w-[160px] h-[160px] rounded-full" />
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const getOverallTier = (score: number | null) => {
    if (score === null) return { label: 'Not calculated', description: 'Add data to calculate score' };
    if (score >= 80) return { label: 'Excellent', description: 'B Corp ready - exceeds governance best practices' };
    if (score >= 60) return { label: 'Good', description: 'Strong governance foundation' };
    if (score >= 40) return { label: 'Developing', description: 'Progress made - key gaps identified' };
    return { label: 'Starting', description: 'Significant governance improvements needed' };
  };

  const tier = getOverallTier(overallScore);

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Governance Score</CardTitle>
            {onRecalculate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRecalculate}
                disabled={isRecalculating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                {isRecalculating ? 'Calculating...' : 'Recalculate'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Score Ring */}
            <div className="relative w-[160px] h-[160px] flex items-center justify-center">
              <ScoreRing score={overallScore} size="large" color="emerald" />
            </div>

            {/* Score Details */}
            <div className="flex-1 text-center lg:text-left">
              <div className="mb-4">
                <span className="text-2xl font-bold">{tier.label}</span>
                <p className="text-muted-foreground mt-1">{tier.description}</p>
              </div>

              {dataCompleteness !== null && (
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <div className="flex-1 max-w-xs bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${dataCompleteness}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(dataCompleteness)}% data completeness
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pillar Scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <PillarCard
          title="Policies"
          score={policyScore}
          color="blue"
          description="Policy coverage, review compliance, and public disclosure"
          weight="20%"
        />
        <PillarCard
          title="Stakeholders"
          score={stakeholderScore}
          color="purple"
          description="Stakeholder identification and engagement quality"
          weight="20%"
        />
        <PillarCard
          title="Board"
          score={boardScore}
          color="emerald"
          description="Board composition, diversity, and independence"
          weight="25%"
        />
        <PillarCard
          title="Ethics"
          score={ethicsScore}
          color="amber"
          description="Ethics training, compliance, and whistleblowing"
          weight="20%"
        />
        <PillarCard
          title="Transparency"
          score={transparencyScore}
          color="pink"
          description="Mission clarity, benefit corp status, and disclosure"
          weight="15%"
        />
      </div>
    </div>
  );
}
