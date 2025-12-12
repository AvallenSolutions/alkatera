'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface EF31Impacts {
  raw_impacts: Record<string, number>;
  normalised_impacts: Record<string, number>;
  weighted_impacts: Record<string, number>;
  single_score: number;
  units: Record<string, string>;
}

interface EF31ImpactCategoriesTableProps {
  ef31Impacts: EF31Impacts | null;
  showNormalised?: boolean;
  showWeighted?: boolean;
}

const CATEGORY_INFO: Record<string, {
  code: string;
  name: string;
  rawKey: string;
  description: string;
  model: string;
}> = {
  CC: {
    code: 'CC',
    name: 'Climate Change',
    rawKey: 'climate_change_total',
    description: 'Total global warming potential including fossil, biogenic, and LULUC',
    model: 'IPCC AR5 GWP100',
  },
  OD: {
    code: 'OD',
    name: 'Ozone Depletion',
    rawKey: 'ozone_depletion',
    description: 'Stratospheric ozone layer destruction potential',
    model: 'WMO 2014',
  },
  IR: {
    code: 'IR',
    name: 'Ionising Radiation',
    rawKey: 'ionising_radiation',
    description: 'Human health effects from radioactive substance emissions',
    model: 'Frischknecht et al. 2000',
  },
  POF: {
    code: 'POF',
    name: 'Photochemical Ozone Formation',
    rawKey: 'photochemical_ozone_formation',
    description: 'Ground-level ozone formation affecting human health',
    model: 'Van Zelm et al. 2008',
  },
  PM: {
    code: 'PM',
    name: 'Particulate Matter',
    rawKey: 'particulate_matter',
    description: 'Respiratory effects from fine particulate emissions',
    model: 'UNEP 2016',
  },
  HTC: {
    code: 'HTC',
    name: 'Human Toxicity (Cancer)',
    rawKey: 'human_toxicity_cancer',
    description: 'Carcinogenic effects on human health',
    model: 'USEtox 2.12',
  },
  HTNC: {
    code: 'HTNC',
    name: 'Human Toxicity (Non-Cancer)',
    rawKey: 'human_toxicity_non_cancer',
    description: 'Non-carcinogenic effects on human health',
    model: 'USEtox 2.12',
  },
  AC: {
    code: 'AC',
    name: 'Acidification',
    rawKey: 'acidification',
    description: 'Terrestrial and aquatic acidification potential',
    model: 'Accumulated Exceedance',
  },
  EUF: {
    code: 'EUF',
    name: 'Eutrophication (Freshwater)',
    rawKey: 'eutrophication_freshwater',
    description: 'Freshwater nutrient enrichment from phosphorus',
    model: 'ReCiPe 2008',
  },
  EUM: {
    code: 'EUM',
    name: 'Eutrophication (Marine)',
    rawKey: 'eutrophication_marine',
    description: 'Marine nutrient enrichment from nitrogen',
    model: 'ReCiPe 2008',
  },
  EUT: {
    code: 'EUT',
    name: 'Eutrophication (Terrestrial)',
    rawKey: 'eutrophication_terrestrial',
    description: 'Terrestrial nutrient enrichment',
    model: 'Accumulated Exceedance',
  },
  ETF: {
    code: 'ETF',
    name: 'Ecotoxicity (Freshwater)',
    rawKey: 'ecotoxicity_freshwater',
    description: 'Toxic effects on freshwater ecosystems',
    model: 'USEtox 2.12',
  },
  LU: {
    code: 'LU',
    name: 'Land Use',
    rawKey: 'land_use',
    description: 'Soil quality degradation from land occupation and transformation',
    model: 'LANCA v2.5',
  },
  WU: {
    code: 'WU',
    name: 'Water Use',
    rawKey: 'water_use',
    description: 'Water scarcity weighted consumption',
    model: 'AWARE 1.2',
  },
  RUF: {
    code: 'RUF',
    name: 'Resource Use (Fossils)',
    rawKey: 'resource_use_fossils',
    description: 'Abiotic depletion of fossil energy carriers',
    model: 'CML 2002',
  },
  RUM: {
    code: 'RUM',
    name: 'Resource Use (Minerals)',
    rawKey: 'resource_use_minerals_metals',
    description: 'Abiotic depletion of mineral and metal resources',
    model: 'CML 2002',
  },
};

const CATEGORY_ORDER = ['CC', 'OD', 'IR', 'POF', 'PM', 'HTC', 'HTNC', 'AC', 'EUF', 'EUM', 'EUT', 'ETF', 'LU', 'WU', 'RUF', 'RUM'];

function formatValue(value: number, decimals: number = 4): string {
  if (value === 0) return '0';
  if (Math.abs(value) < 0.0001) return value.toExponential(2);
  if (Math.abs(value) < 1) return value.toFixed(decimals);
  if (Math.abs(value) < 1000) return value.toFixed(2);
  return value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
}

export function EF31ImpactCategoriesTable({
  ef31Impacts,
  showNormalised = true,
  showWeighted = true,
}: EF31ImpactCategoriesTableProps) {
  if (!ef31Impacts) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">EF 3.1 Impact Categories</CardTitle>
          <CardDescription>
            No EF 3.1 calculation available. Recalculate to view all 16 impact categories.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">EF 3.1 Impact Categories</CardTitle>
            <CardDescription>
              All 16 mandatory Environmental Footprint 3.1 impact categories
            </CardDescription>
          </div>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            16 Categories
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px]">Code</TableHead>
                <TableHead>Impact Category</TableHead>
                <TableHead className="text-right">Raw Value</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                {showNormalised && (
                  <TableHead className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-end">
                          Normalised
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Person-year equivalents (EU27 2010 reference)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                )}
                {showWeighted && (
                  <TableHead className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-end">
                          Weighted
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Contribution to single score</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {CATEGORY_ORDER.map((code) => {
                const info = CATEGORY_INFO[code];
                const rawValue = ef31Impacts.raw_impacts[info.rawKey] || 0;
                const unit = ef31Impacts.units[code] || '-';
                const normValue = ef31Impacts.normalised_impacts[code] || 0;
                const weightedValue = ef31Impacts.weighted_impacts[code] || 0;

                return (
                  <TableRow key={code}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {code}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="text-left">
                            <div className="font-medium text-sm">{info.name}</div>
                            <div className="text-xs text-muted-foreground">{info.model}</div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{info.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatValue(rawValue)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {unit}
                    </TableCell>
                    {showNormalised && (
                      <TableCell className="text-right font-mono text-sm">
                        {formatValue(normValue, 6)}
                      </TableCell>
                    )}
                    {showWeighted && (
                      <TableCell className="text-right font-mono text-sm">
                        {formatValue(weightedValue, 6)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Reference: EU27 2010 per-capita annual impacts
          </div>
          <div>
            Total weighted score: <span className="font-mono font-medium text-foreground">{formatValue(ef31Impacts.single_score, 6)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
