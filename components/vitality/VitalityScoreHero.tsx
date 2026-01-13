"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { VitalityRing } from './VitalityRing';
import { Sparkline } from '@/components/shared/TrendIndicator';
import { RefreshCw, Calendar, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScoreExplainer } from './ScoreExplainer';

interface VitalityScoreHeroProps {
  overallScore: number;
  climateScore: number;
  waterScore: number;
  circularityScore: number;
  natureScore: number;
  trend?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  trendData?: number[];
  lastUpdated?: string;
  benchmark?: number;
  benchmarkData?: {
    platform_average?: number;
    category_average?: number;
    category_name?: string;
    top_performer?: number;
  };
  onRefresh?: () => void;
  loading?: boolean;
  className?: string;
}

function getOverallLabel(score: number): { label: string; description: string } {
  if (score >= 85) return {
    label: 'EXCELLENT',
    description: 'Your organisation is a sustainability leader'
  };
  if (score >= 70) return {
    label: 'HEALTHY',
    description: 'Your organisation is performing well across all pillars'
  };
  if (score >= 50) return {
    label: 'DEVELOPING',
    description: 'Good progress, with opportunities for improvement'
  };
  if (score >= 30) return {
    label: 'EMERGING',
    description: 'Early stage - focused action can drive quick gains'
  };
  return {
    label: 'NEEDS ATTENTION',
    description: 'Significant opportunities to improve sustainability performance'
  };
}

export function VitalityScoreHero({
  overallScore,
  climateScore,
  waterScore,
  circularityScore,
  natureScore,
  trend,
  trendDirection,
  trendData,
  lastUpdated,
  benchmark,
  benchmarkData,
  onRefresh,
  loading,
  className,
}: VitalityScoreHeroProps) {
  const { label, description } = getOverallLabel(overallScore);

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl',
      'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
      'border border-slate-700/50',
      'p-6 md:p-8',
      className
    )}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white/90">
                Company Vitality Score
              </h2>
              <ScoreExplainer
                scoreType="overall"
                currentScore={overallScore}
                benchmark={benchmarkData}
              />
            </div>
            <p className="text-sm text-white/60 mt-1">
              Multi-dimensional sustainability performance
            </p>
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <Calendar className="h-3.5 w-3.5" />
                <span>Updated {lastUpdated}</span>
              </div>
            )}
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="flex flex-col items-center">
            <VitalityRing
              score={overallScore}
              size="xl"
              label={label}
              trend={trend}
              trendDirection={trendDirection}
              benchmark={benchmark}
              className="text-white"
            />

            <p className="mt-4 text-sm text-white/70 text-center max-w-xs">
              {description}
            </p>

            {trendData && trendData.length > 1 && (
              <div className="mt-4 flex flex-col items-center">
                <span className="text-xs text-white/50 mb-1">6-month trend</span>
                <Sparkline
                  data={trendData}
                  width={120}
                  height={32}
                  showArea
                />
              </div>
            )}
          </div>

          <div className="flex-1 w-full lg:w-auto">
            <div className="grid grid-cols-2 gap-4">
              <PillarScoreCard
                pillar="Climate"
                score={climateScore}
                icon="🌍"
                color="emerald"
                weight={30}
              />
              <PillarScoreCard
                pillar="Water"
                score={waterScore}
                icon="💧"
                color="blue"
                weight={25}
              />
              <PillarScoreCard
                pillar="Circularity"
                score={circularityScore}
                icon="♻️"
                color="amber"
                weight={25}
              />
              <PillarScoreCard
                pillar="Nature"
                score={natureScore}
                icon="🌱"
                color="green"
                weight={20}
              />
            </div>

            <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Info className="h-3.5 w-3.5" />
                <span>
                  Score = Climate (30%) + Water (25%) + Circularity (25%) + Nature (20%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PillarScoreCardProps {
  pillar: string;
  score: number;
  icon: string;
  color: 'emerald' | 'blue' | 'amber' | 'green';
  weight: number;
}

function PillarScoreCard({ pillar, score, icon, color, weight }: PillarScoreCardProps) {
  const colorClasses = {
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
  };

  const scoreColor = score >= 70 ? 'text-green-400' :
                     score >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'p-4 rounded-xl bg-gradient-to-br border cursor-help',
            'transition-all duration-200 hover:scale-[1.02]',
            colorClasses[color]
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{icon}</span>
              <span className="text-xs text-white/40">{weight}%</span>
            </div>
            <div className="text-white/80 text-sm font-medium">{pillar}</div>
            <div className={cn('text-2xl font-bold tabular-nums', scoreColor)}>
              {score}
              <span className="text-sm text-white/40">/100</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{pillar} contributes {weight}% to overall score</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function calculateVitalityScores(data: {
  totalEmissions?: number;
  emissionsIntensity?: number;
  industryBenchmark?: number;
  waterConsumption?: number;
  waterRiskLevel?: 'high' | 'medium' | 'low';
  recyclingRate?: number;
  wasteToLandfill?: number;
  circularityRate?: number;
  landUseIntensity?: number;
  biodiversityRisk?: 'high' | 'medium' | 'low';
}): {
  overall: number;
  climate: number;
  water: number;
  circularity: number;
  nature: number;
} {
  let climateScore = 50;
  if (data.emissionsIntensity !== undefined && data.industryBenchmark !== undefined) {
    const ratio = data.emissionsIntensity / data.industryBenchmark;
    if (ratio <= 0.7) climateScore = 90;
    else if (ratio <= 0.85) climateScore = 80;
    else if (ratio <= 1.0) climateScore = 70;
    else if (ratio <= 1.15) climateScore = 55;
    else if (ratio <= 1.3) climateScore = 40;
    else climateScore = 25;
  }

  let waterScore = 50;
  if (data.waterRiskLevel === 'low') waterScore = 85;
  else if (data.waterRiskLevel === 'medium') waterScore = 60;
  else if (data.waterRiskLevel === 'high') waterScore = 35;

  let circularityScore = 50;
  if (data.circularityRate !== undefined) {
    if (data.circularityRate >= 80) circularityScore = 95;
    else if (data.circularityRate >= 60) circularityScore = 80;
    else if (data.circularityRate >= 40) circularityScore = 60;
    else if (data.circularityRate >= 20) circularityScore = 40;
    else circularityScore = 20;
  }

  let natureScore = 50;
  if (data.biodiversityRisk === 'low') natureScore = 80;
  else if (data.biodiversityRisk === 'medium') natureScore = 55;
  else if (data.biodiversityRisk === 'high') natureScore = 30;

  const overall = Math.round(
    climateScore * 0.30 +
    waterScore * 0.25 +
    circularityScore * 0.25 +
    natureScore * 0.20
  );

  return {
    overall,
    climate: Math.round(climateScore),
    water: Math.round(waterScore),
    circularity: Math.round(circularityScore),
    nature: Math.round(natureScore),
  };
}
