'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface EF31Impacts {
  raw_impacts: {
    climate_change_total: number;
    ozone_depletion: number;
    ionising_radiation: number;
    photochemical_ozone_formation: number;
    particulate_matter: number;
    human_toxicity_cancer: number;
    human_toxicity_non_cancer: number;
    acidification: number;
    eutrophication_freshwater: number;
    eutrophication_marine: number;
    eutrophication_terrestrial: number;
    ecotoxicity_freshwater: number;
    land_use: number;
    water_use: number;
    resource_use_fossils: number;
    resource_use_minerals_metals: number;
  };
  normalised_impacts: Record<string, number>;
  weighted_impacts: Record<string, number>;
  single_score: number;
  methodology_version: string;
  calculated_at: string;
  units: Record<string, string>;
}

interface EF31SingleScoreCardProps {
  ef31Impacts: EF31Impacts | null;
  previousScore?: number;
  industryAverage?: number;
}

const CATEGORY_LABELS: Record<string, { name: string; shortName: string; description: string }> = {
  CC: { name: 'Climate Change', shortName: 'Climate', description: 'Global warming potential over 100 years' },
  OD: { name: 'Ozone Depletion', shortName: 'Ozone', description: 'Stratospheric ozone layer destruction' },
  IR: { name: 'Ionising Radiation', shortName: 'Radiation', description: 'Human health effects from radioactive emissions' },
  POF: { name: 'Photochemical Ozone', shortName: 'Smog', description: 'Ground-level ozone formation' },
  PM: { name: 'Particulate Matter', shortName: 'PM', description: 'Respiratory effects from fine particles' },
  HTC: { name: 'Human Toxicity (Cancer)', shortName: 'Tox Cancer', description: 'Carcinogenic effects on humans' },
  HTNC: { name: 'Human Toxicity (Non-Cancer)', shortName: 'Tox Non-C', description: 'Non-carcinogenic effects' },
  AC: { name: 'Acidification', shortName: 'Acid', description: 'Terrestrial and aquatic acidification' },
  EUF: { name: 'Eutrophication (Freshwater)', shortName: 'Eutro FW', description: 'Freshwater nutrient enrichment' },
  EUM: { name: 'Eutrophication (Marine)', shortName: 'Eutro Mar', description: 'Marine nutrient enrichment' },
  EUT: { name: 'Eutrophication (Terrestrial)', shortName: 'Eutro Terr', description: 'Terrestrial nutrient enrichment' },
  ETF: { name: 'Ecotoxicity (Freshwater)', shortName: 'Ecotox', description: 'Toxic effects on freshwater ecosystems' },
  LU: { name: 'Land Use', shortName: 'Land', description: 'Soil quality degradation' },
  WU: { name: 'Water Use', shortName: 'Water', description: 'Water scarcity weighted consumption' },
  RUF: { name: 'Resource Use (Fossils)', shortName: 'Res Fossil', description: 'Fossil energy carrier depletion' },
  RUM: { name: 'Resource Use (Minerals)', shortName: 'Res Mineral', description: 'Mineral and metal resource depletion' },
};

export function EF31SingleScoreCard({
  ef31Impacts,
  previousScore,
  industryAverage,
}: EF31SingleScoreCardProps) {
  if (!ef31Impacts) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            EF 3.1 Single Score
            <Badge variant="outline">Not Calculated</Badge>
          </CardTitle>
          <CardDescription>
            Recalculate the LCA to generate EF 3.1 impacts
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const singleScore = ef31Impacts.single_score;
  const formattedScore = singleScore < 0.001
    ? singleScore.toExponential(2)
    : singleScore.toFixed(4);

  const scoreTrend = previousScore
    ? ((singleScore - previousScore) / previousScore) * 100
    : null;

  const sortedCategories = Object.entries(ef31Impacts.weighted_impacts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxWeight = Math.max(...Object.values(ef31Impacts.weighted_impacts));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              EF 3.1 Single Score
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Normalised and weighted aggregation of all 16 EF 3.1 impact categories using EU27 2010 reference values.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Environmental Footprint 3.1 methodology
            </CardDescription>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            PEF Compliant
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end gap-4">
          <div className="text-4xl font-bold tracking-tight">
            {formattedScore}
          </div>
          <div className="text-sm text-muted-foreground pb-1">
            person-year equivalents
          </div>
          {scoreTrend !== null && (
            <div className={`flex items-center gap-1 text-sm pb-1 ${
              scoreTrend < 0 ? 'text-emerald-600' : scoreTrend > 0 ? 'text-red-600' : 'text-muted-foreground'
            }`}>
              {scoreTrend < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : scoreTrend > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              {Math.abs(scoreTrend).toFixed(1)}%
            </div>
          )}
        </div>

        {industryAverage && (
          <div className="text-sm text-muted-foreground">
            Industry average: {industryAverage.toFixed(4)} person-year eq.
            {singleScore < industryAverage && (
              <span className="text-emerald-600 ml-2">
                ({((industryAverage - singleScore) / industryAverage * 100).toFixed(0)}% below average)
              </span>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="text-sm font-medium">Top Contributing Categories</div>
          {sortedCategories.map(([code, weight]) => {
            const label = CATEGORY_LABELS[code];
            const percentage = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
            return (
              <TooltipProvider key={code}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{label?.shortName || code}</span>
                        <span className="font-mono text-xs">
                          {weight < 0.0001 ? weight.toExponential(2) : weight.toFixed(4)}
                        </span>
                      </div>
                      <Progress value={percentage} className="h-1.5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{label?.name || code}</p>
                    <p className="text-xs text-muted-foreground">{label?.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Calculated: {new Date(ef31Impacts.calculated_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
