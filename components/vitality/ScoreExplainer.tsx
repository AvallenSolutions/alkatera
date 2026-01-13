"use client";

import React from 'react';
import { Info, TrendingUp, Target, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type ScoreType = 'overall' | 'climate' | 'water' | 'circularity' | 'nature';

interface ScoreExplainerProps {
  scoreType: ScoreType;
  currentScore: number;
  benchmark?: {
    platform_average?: number;
    category_average?: number;
    category_name?: string;
    top_performer?: number;
  };
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

export function ScoreExplainer({
  scoreType,
  currentScore,
  benchmark,
  className,
}: ScoreExplainerProps) {
  const config = scoreTypeConfig[scoreType];
  const currentBand = config.bands.find(band => currentScore >= band.min) || config.bands[config.bands.length - 1];

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
      <PopoverContent className="w-96 p-0" align="start" side="bottom">
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
              </div>
            </div>
          </div>

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
                    currentScore >= band.min && currentScore < (config.bands.find(b => b.min > band.min)?.min || 101)
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
