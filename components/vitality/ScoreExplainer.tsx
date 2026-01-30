"use client";

import React from 'react';
import { Info, TrendingUp, Target, Award, Calculator, ArrowUpRight, Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type ScoreType = 'overall' | 'climate' | 'water' | 'circularity' | 'nature';

export interface CalculationInputs {
  // Climate
  totalEmissions?: number;
  emissionsIntensity?: number;
  industryBenchmark?: number;
  intensityRatio?: number;
  // Water
  waterRiskLevel?: 'high' | 'medium' | 'low';
  waterConsumption?: number;
  // Circularity
  circularityRate?: number;
  // Nature
  biodiversityRisk?: 'high' | 'medium' | 'low';
  landUse?: number;
  // Overall
  pillarScores?: {
    climate: number | null;
    water: number | null;
    circularity: number | null;
    nature: number | null;
  };
}

interface ScoreExplainerProps {
  scoreType: ScoreType;
  currentScore: number | null;
  benchmark?: {
    platform_average?: number;
    category_average?: number;
    category_name?: string;
    top_performer?: number;
  };
  calculationInputs?: CalculationInputs;
  className?: string;
}

const scoreTypeConfig: Record<ScoreType, {
  title: string;
  description: string;
  methodology: string;
  bands: Array<{ min: number; label: string; color: string; description: string }>;
  weight?: string;
}> = {
  overall: {
    title: 'Company Vitality Score',
    description: 'A holistic measure of your sustainability performance across four key environmental pillars',
    methodology: 'Weighted average of Climate (30%), Water (25%), Circularity (25%), and Nature (20%) pillar scores',
    bands: [
      { min: 85, label: 'Excellent', color: 'green', description: 'Sustainability leader with best-in-class performance' },
      { min: 70, label: 'Healthy', color: 'emerald', description: 'Strong performance across all pillars' },
      { min: 50, label: 'Developing', color: 'amber', description: 'Good progress with opportunities to improve' },
      { min: 30, label: 'Emerging', color: 'orange', description: 'Early stage - focused action drives quick gains' },
      { min: 0, label: 'Needs Attention', color: 'red', description: 'Significant opportunities for improvement' },
    ],
  },
  climate: {
    title: 'Climate Score',
    description: 'Measures your greenhouse gas emissions performance relative to industry benchmarks',
    methodology: 'Based on emissions intensity (tCO2eq per product) compared to industry average. Considers Scope 1, 2, and 3 emissions.',
    weight: '30%',
    bands: [
      { min: 85, label: 'Industry Leader', color: 'green', description: '≤70% of industry benchmark - exceptional performance' },
      { min: 70, label: 'Above Average', color: 'emerald', description: '70-100% of benchmark - strong carbon management' },
      { min: 50, label: 'Average', color: 'amber', description: '100-130% of benchmark - meets standards' },
      { min: 30, label: 'Below Average', color: 'orange', description: '>130% of benchmark - improvement needed' },
      { min: 0, label: 'Action Required', color: 'red', description: 'Significantly above benchmark - urgent action' },
    ],
  },
  water: {
    title: 'Water Score',
    description: 'Evaluates water consumption and scarcity risk across your operations and supply chain',
    methodology: 'Based on water risk assessment combining consumption volume with location-based scarcity factors',
    weight: '25%',
    bands: [
      { min: 85, label: 'Low Risk', color: 'green', description: 'Operations in low water stress areas' },
      { min: 60, label: 'Medium Risk', color: 'amber', description: 'Some facilities in moderate stress areas' },
      { min: 35, label: 'High Risk', color: 'orange', description: 'Operations in high water stress regions' },
      { min: 0, label: 'Critical Risk', color: 'red', description: 'Significant exposure to water scarcity' },
    ],
  },
  circularity: {
    title: 'Circularity Score',
    description: 'Measures waste diversion from landfill and circular economy practices',
    methodology: 'Based on waste diversion rate: percentage of waste recycled, composted, or recovered vs. landfilled',
    weight: '25%',
    bands: [
      { min: 95, label: 'Circular Leader', color: 'green', description: '≥80% waste diversion - near zero waste' },
      { min: 80, label: 'Strong', color: 'emerald', description: '60-79% diversion - robust recycling programs' },
      { min: 60, label: 'Developing', color: 'amber', description: '40-59% diversion - good progress' },
      { min: 40, label: 'Basic', color: 'orange', description: '20-39% diversion - systems in place' },
      { min: 0, label: 'Linear', color: 'red', description: '<20% diversion - linear economy model' },
    ],
  },
  nature: {
    title: 'Nature Score',
    description: 'Assesses land use and biodiversity impacts from your operations and supply chain',
    methodology: 'Based on land use intensity and biodiversity risk from agricultural sourcing and site locations',
    weight: '20%',
    bands: [
      { min: 80, label: 'Low Impact', color: 'green', description: 'Minimal land use and biodiversity risk' },
      { min: 55, label: 'Moderate Impact', color: 'amber', description: 'Average land use intensity' },
      { min: 30, label: 'High Impact', color: 'orange', description: 'Significant land transformation' },
      { min: 0, label: 'Critical Impact', color: 'red', description: 'Major biodiversity concerns' },
    ],
  },
};

function getImprovementGuidance(scoreType: ScoreType, currentScore: number | null, inputs?: CalculationInputs): string | null {
  if (currentScore === null) return null;

  const config = scoreTypeConfig[scoreType];
  // Find the next band above current score
  const sortedBands = [...config.bands].sort((a, b) => a.min - b.min);
  const nextBand = sortedBands.find(band => band.min > currentScore);

  if (!nextBand) return 'You are in the highest score band. Maintain your current practices to stay at the top.';

  switch (scoreType) {
    case 'climate': {
      const ratio = inputs?.intensityRatio;
      if (ratio !== undefined) {
        if (nextBand.min >= 85) return `Reduce your emissions intensity ratio below 0.70x the industry benchmark to reach "${nextBand.label}" (currently ${ratio.toFixed(2)}x).`;
        if (nextBand.min >= 70) return `Reduce your emissions intensity ratio below 0.85x the industry benchmark to reach "${nextBand.label}" (currently ${ratio.toFixed(2)}x).`;
        if (nextBand.min >= 50) return `Reduce your emissions intensity ratio to 1.0x or below the industry benchmark to reach "${nextBand.label}" (currently ${ratio.toFixed(2)}x).`;
      }
      return `Reduce your emissions intensity to reach "${nextBand.label}" (score ${nextBand.min}+).`;
    }
    case 'water':
      if (inputs?.waterRiskLevel === 'high') return `Move operations to lower water stress areas or implement water recycling to reach "${nextBand.label}".`;
      if (inputs?.waterRiskLevel === 'medium') return `Reducing water risk from Medium to Low would increase your score from 60 to 85.`;
      return `Improve your water risk assessment to reach "${nextBand.label}" (score ${nextBand.min}+).`;
    case 'circularity':
      if (inputs?.circularityRate !== undefined) {
        const targetRate = nextBand.min >= 95 ? 80 : nextBand.min >= 80 ? 60 : nextBand.min >= 60 ? 40 : 20;
        return `Increase your waste diversion rate from ${inputs.circularityRate.toFixed(0)}% to ${targetRate}%+ to reach "${nextBand.label}".`;
      }
      return `Increase your waste diversion rate to reach "${nextBand.label}" (score ${nextBand.min}+).`;
    case 'nature':
      if (inputs?.biodiversityRisk === 'high') return `Reduce biodiversity risk through sustainable sourcing practices to reach "${nextBand.label}".`;
      if (inputs?.biodiversityRisk === 'medium') return `Reducing biodiversity risk from Medium to Low would increase your score from 55 to 80.`;
      return `Improve your land use and biodiversity impact to reach "${nextBand.label}" (score ${nextBand.min}+).`;
    case 'overall': {
      // Find the weakest pillar
      if (inputs?.pillarScores) {
        const pillars = [
          { name: 'Climate', score: inputs.pillarScores.climate, weight: 30 },
          { name: 'Water', score: inputs.pillarScores.water, weight: 25 },
          { name: 'Circularity', score: inputs.pillarScores.circularity, weight: 25 },
          { name: 'Nature', score: inputs.pillarScores.nature, weight: 20 },
        ];
        const nullPillars = pillars.filter(p => p.score === null);
        if (nullPillars.length > 0) {
          return `Add data for ${nullPillars.map(p => p.name).join(', ')} to get a more complete score. Missing pillars mean available weights are redistributed.`;
        }
        const weakest = pillars
          .filter(p => p.score !== null)
          .sort((a, b) => (a.score || 0) - (b.score || 0))[0];
        if (weakest) {
          return `Focus on improving your ${weakest.name} score (${weakest.score}) for the biggest impact on your overall score.`;
        }
      }
      return `Improve your weakest pillar to increase your overall score to ${nextBand.min}+ ("${nextBand.label}").`;
    }
    default:
      return null;
  }
}

function buildRosaPrompt(scoreType: ScoreType, currentScore: number | null, inputs?: CalculationInputs): string {
  const parts: string[] = [];

  if (scoreType === 'overall' && inputs?.pillarScores) {
    const ps = inputs.pillarScores;
    parts.push(`Explain my Company Vitality Score of ${currentScore ?? 'N/A'}.`);
    parts.push(`My pillar scores are: Climate ${ps.climate ?? 'no data'}, Water ${ps.water ?? 'no data'}, Circularity ${ps.circularity ?? 'no data'}, Nature ${ps.nature ?? 'no data'}.`);
    parts.push('The weights are Climate 30%, Water 25%, Circularity 25%, Nature 20%.');
  } else if (scoreType === 'climate') {
    parts.push(`Explain my Climate Score of ${currentScore ?? 'N/A'}.`);
    if (inputs?.totalEmissions) parts.push(`My total emissions are ${(inputs.totalEmissions / 1000).toFixed(1)} tCO2e.`);
    if (inputs?.intensityRatio !== undefined) parts.push(`My emissions intensity ratio vs industry benchmark is ${inputs.intensityRatio.toFixed(2)}x.`);
  } else if (scoreType === 'water') {
    parts.push(`Explain my Water Score of ${currentScore ?? 'N/A'}.`);
    if (inputs?.waterRiskLevel) parts.push(`My water risk level is ${inputs.waterRiskLevel}.`);
    if (inputs?.waterConsumption) parts.push(`My water consumption is ${inputs.waterConsumption.toFixed(0)} m3.`);
  } else if (scoreType === 'circularity') {
    parts.push(`Explain my Circularity Score of ${currentScore ?? 'N/A'}.`);
    if (inputs?.circularityRate !== undefined) parts.push(`My waste diversion rate is ${inputs.circularityRate.toFixed(0)}%.`);
  } else if (scoreType === 'nature') {
    parts.push(`Explain my Nature Score of ${currentScore ?? 'N/A'}.`);
    if (inputs?.biodiversityRisk) parts.push(`My biodiversity risk level is ${inputs.biodiversityRisk}.`);
    if (inputs?.landUse) parts.push(`My land use is ${inputs.landUse.toFixed(0)} m2 crop eq.`);
  }

  parts.push('What does this score mean, and what specific actions should I take to improve it?');
  return parts.join(' ');
}

function CalculationBreakdown({ scoreType, inputs }: { scoreType: ScoreType; inputs: CalculationInputs }) {
  if (scoreType === 'overall' && inputs.pillarScores) {
    const ps = inputs.pillarScores;
    const pillars = [
      { name: 'Climate', score: ps.climate, weight: 0.30 },
      { name: 'Water', score: ps.water, weight: 0.25 },
      { name: 'Circularity', score: ps.circularity, weight: 0.25 },
      { name: 'Nature', score: ps.nature, weight: 0.20 },
    ];
    const available = pillars.filter(p => p.score !== null);
    const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);

    return (
      <div className="space-y-1.5">
        {pillars.map((p) => {
          const adjustedWeight = p.score !== null ? ((p.weight / totalWeight) * 100).toFixed(0) : null;
          const contribution = p.score !== null ? ((p.score * p.weight / totalWeight)).toFixed(1) : null;
          return (
            <div key={p.name} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{p.name} ({(p.weight * 100).toFixed(0)}%)</span>
              {p.score !== null ? (
                <span className="font-medium tabular-nums">
                  {p.score} x {adjustedWeight}% = <span className="text-foreground">{contribution} pts</span>
                </span>
              ) : (
                <span className="text-muted-foreground italic">No data</span>
              )}
            </div>
          );
        })}
        {available.length < 4 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Weights redistributed across {available.length} available pillar{available.length !== 1 ? 's' : ''}.
          </p>
        )}
      </div>
    );
  }

  if (scoreType === 'climate') {
    return (
      <div className="space-y-1.5">
        {inputs.totalEmissions !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total emissions</span>
            <span className="font-medium tabular-nums">{(inputs.totalEmissions / 1000).toFixed(1)} tCO2e</span>
          </div>
        )}
        {inputs.emissionsIntensity !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Emissions intensity</span>
            <span className="font-medium tabular-nums">{inputs.emissionsIntensity.toFixed(1)} kgCO2e/product</span>
          </div>
        )}
        {inputs.industryBenchmark !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Industry benchmark</span>
            <span className="font-medium tabular-nums">{inputs.industryBenchmark.toFixed(1)} kgCO2e/product</span>
          </div>
        )}
        {inputs.intensityRatio !== undefined && (
          <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
            <span className="text-muted-foreground">Intensity ratio</span>
            <span className="font-medium tabular-nums">{inputs.intensityRatio.toFixed(2)}x benchmark</span>
          </div>
        )}
      </div>
    );
  }

  if (scoreType === 'water') {
    return (
      <div className="space-y-1.5">
        {inputs.waterRiskLevel && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Water risk level</span>
            <Badge variant="outline" className="text-[10px] h-5 capitalize">{inputs.waterRiskLevel}</Badge>
          </div>
        )}
        {inputs.waterConsumption !== undefined && inputs.waterConsumption > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Water consumption</span>
            <span className="font-medium tabular-nums">
              {inputs.waterConsumption >= 1000
                ? `${(inputs.waterConsumption / 1000).toFixed(1)}k`
                : inputs.waterConsumption.toFixed(0)} m3
            </span>
          </div>
        )}
      </div>
    );
  }

  if (scoreType === 'circularity') {
    return (
      <div className="space-y-1.5">
        {inputs.circularityRate !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Waste diversion rate</span>
            <span className="font-medium tabular-nums">{inputs.circularityRate.toFixed(0)}%</span>
          </div>
        )}
      </div>
    );
  }

  if (scoreType === 'nature') {
    return (
      <div className="space-y-1.5">
        {inputs.biodiversityRisk && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Biodiversity risk</span>
            <Badge variant="outline" className="text-[10px] h-5 capitalize">{inputs.biodiversityRisk}</Badge>
          </div>
        )}
        {inputs.landUse !== undefined && inputs.landUse > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Land use impact</span>
            <span className="font-medium tabular-nums">{inputs.landUse.toFixed(0)} m2 crop eq</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function ScoreExplainer({
  scoreType,
  currentScore,
  benchmark,
  calculationInputs,
  className,
}: ScoreExplainerProps) {
  const router = useRouter();
  const config = scoreTypeConfig[scoreType];
  const hasData = currentScore !== null;
  const currentBand = hasData
    ? config.bands.find(band => currentScore >= band.min) || config.bands[config.bands.length - 1]
    : null;

  const improvementGuidance = getImprovementGuidance(scoreType, currentScore, calculationInputs);

  const handleAskRosa = () => {
    const prompt = buildRosaPrompt(scoreType, currentScore, calculationInputs);
    router.push(`/rosa?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 w-6 p-0 hover:bg-white/10", className)}
        >
          <Info className="h-4 w-4 text-white/60 hover:text-white/90" />
          <span className="sr-only">Score information</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 max-h-[80vh] overflow-y-auto" align="start" side="bottom">
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-base">{config.title}</h3>
              {config.weight && (
                <Badge variant="outline" className="text-xs">
                  {config.weight} weight
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {config.description}
            </p>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-start gap-2 mb-2">
              <Target className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Your Score</p>
                {hasData && currentBand ? (
                  <>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-bold">{currentScore}</span>
                      <Badge variant="outline" className={cn(
                        'text-xs',
                        currentBand.color === 'green' && 'border-green-500 text-green-700 dark:text-green-400',
                        currentBand.color === 'emerald' && 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
                        currentBand.color === 'amber' && 'border-amber-500 text-amber-700 dark:text-amber-400',
                        currentBand.color === 'orange' && 'border-orange-500 text-orange-700 dark:text-orange-400',
                        currentBand.color === 'red' && 'border-red-500 text-red-700 dark:text-red-400',
                      )}>
                        {currentBand.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentBand.description}
                    </p>
                  </>
                ) : (
                  <div className="mt-1">
                    <span className="text-lg font-medium text-muted-foreground">Awaiting Data</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add relevant data to calculate this score
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {calculationInputs && hasData && (
            <div className="border-t pt-3">
              <div className="flex items-start gap-2 mb-2">
                <Calculator className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Your Calculation</p>
                  <CalculationBreakdown scoreType={scoreType} inputs={calculationInputs} />
                </div>
              </div>
            </div>
          )}

          {improvementGuidance && hasData && (
            <div className="border-t pt-3">
              <div className="flex items-start gap-2">
                <ArrowUpRight className="h-4 w-4 mt-0.5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">How to Improve</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {improvementGuidance}
                  </p>
                </div>
              </div>
            </div>
          )}

          {benchmark && (benchmark.platform_average || benchmark.category_average) && (
            <div className="border-t pt-3">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">Benchmarks</p>

                  {benchmark.platform_average && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">AlkaTera Average</span>
                      <span className="font-medium">{benchmark.platform_average}</span>
                    </div>
                  )}

                  {benchmark.category_average && benchmark.category_name && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{benchmark.category_name}</span>
                      <span className="font-medium">{benchmark.category_average}</span>
                    </div>
                  )}

                  {benchmark.top_performer && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Top Performer</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {benchmark.top_performer}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-3">
            <div className="flex items-start gap-2 mb-3">
              <Award className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <p className="text-sm font-medium">Score Bands</p>
            </div>
            <div className="space-y-2">
              {config.bands.map((band) => (
                <div
                  key={band.label}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md text-xs transition-colors',
                    hasData && currentScore !== null && currentScore >= band.min && currentScore < (config.bands.find(b => b.min > band.min)?.min || 101)
                      ? 'bg-primary/10 border border-primary/20'
                      : 'bg-muted/30'
                  )}
                >
                  <div className={cn(
                    'h-2 w-2 rounded-full flex-shrink-0',
                    band.color === 'green' && 'bg-green-500',
                    band.color === 'emerald' && 'bg-emerald-500',
                    band.color === 'amber' && 'bg-amber-500',
                    band.color === 'orange' && 'bg-orange-500',
                    band.color === 'red' && 'bg-red-500',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{band.label}</span>
                      <span className="text-muted-foreground">
                        {band.min}{config.bands.find(b => b.min > band.min) ? `-${(config.bands.find(b => b.min > band.min)?.min || 101) - 1}` : '+'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Methodology:</span> {config.methodology}
            </p>
          </div>

          <div className="border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={handleAskRosa}
            >
              <Bot className="h-3.5 w-3.5" />
              Ask Rosa to explain this score
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
