'use client';

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Info,
  Calendar,
  Globe,
  Cpu,
  Target,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Lightbulb,
} from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import { cn } from '@/lib/utils';
import type { MaterialWithValidation, LinkedFacility, FacilityAllocation } from '../types';

// ============================================================================
// TECH COVERAGE TEMPLATES (by product type)
// ============================================================================

const TECH_COVERAGE_TEMPLATES: Record<string, string> = {
  'Beer & Cider':
    'Modern commercial brewing and packaging operations, including mashing, lautering, boiling, fermentation, conditioning, and filling.',
  'Wine':
    'Commercial winemaking operations, including grape processing, fermentation, ageing, and bottling.',
  'Spirits':
    'Commercial distillery operations, including mashing, fermentation, distillation, maturation, and bottling.',
  'Ready-to-Drink & Cocktails':
    'Commercial blending and packaging operations, including ingredient mixing, carbonation (if applicable), and filling.',
  'Non-Alcoholic':
    'Commercial beverage production and packaging operations, including ingredient processing, blending, and filling.',
};

// ============================================================================
// PRECISION OPTIONS
// ============================================================================

const PRECISION_OPTIONS = [
  {
    value: 'high',
    label: 'High',
    description: 'Primary data from your own operations',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Industry averages or supplier-specific data',
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Estimates, proxies, or outdated data',
  },
];

// ============================================================================
// AUTOFILL HELPER FUNCTIONS
// ============================================================================

function computeTemporalCoverage(
  referenceYear: number,
  allocations: FacilityAllocation[]
): string {
  const reportingYears = allocations
    .filter((a) => a.reportingPeriodStart && a.reportingPeriodEnd)
    .flatMap((a) => {
      const startYear = new Date(a.reportingPeriodStart).getFullYear();
      const endYear = new Date(a.reportingPeriodEnd).getFullYear();
      return [startYear, endYear];
    })
    .filter((y) => !isNaN(y));

  if (reportingYears.length > 0) {
    const minYear = Math.min(...reportingYears);
    const maxYear = Math.max(...reportingYears);
    if (minYear === maxYear) return String(minYear);
    return `${minYear}\u2013${maxYear}`;
  }

  return String(referenceYear);
}

function computeGeographicCoverage(
  materials: MaterialWithValidation[],
  facilities: LinkedFacility[]
): string {
  const countries = new Set<string>();

  for (const m of materials) {
    if (m.origin_country) {
      countries.add(m.origin_country);
    }
  }

  for (const f of facilities) {
    if (f.facility.address_country) {
      countries.add(f.facility.address_country);
    }
  }

  if (countries.size === 0) return '';

  const list = Array.from(countries);
  if (list.length === 1) return list[0];
  if (list.length <= 4) return list.join(', ');
  return `${list.slice(0, 3).join(', ')} and ${list.length - 3} other countries`;
}

function computeTechnologicalCoverage(
  productType: string | undefined,
  facilities: LinkedFacility[]
): string {
  const template = productType
    ? TECH_COVERAGE_TEMPLATES[productType]
    : undefined;

  if (!template) return '';

  if (facilities.length > 0) {
    const names = facilities.map((f) => f.facility.name).join(', ');
    return `${template} Production at: ${names}.`;
  }

  return template;
}

interface MaterialBreakdown {
  highCount: number;
  mediumCount: number;
  lowCount: number;
  total: number;
}

function classifyMaterials(materials: MaterialWithValidation[]): MaterialBreakdown {
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const m of materials) {
    if (!m.hasData) {
      lowCount++;
      continue;
    }

    const tag = (m.dataQuality || '').toLowerCase();
    if (tag.includes('primary') || tag.includes('verified')) {
      highCount++;
    } else if (
      tag.includes('secondary_modelled') ||
      tag.includes('regional') ||
      tag.includes('hybrid')
    ) {
      mediumCount++;
    } else {
      lowCount++;
    }
  }

  return { highCount, mediumCount, lowCount, total: materials.length };
}

function computePrecision(materials: MaterialWithValidation[]): 'high' | 'medium' | 'low' {
  if (materials.length === 0) return 'medium';

  const { highCount, lowCount, total } = classifyMaterials(materials);

  if (highCount / total > 0.6) return 'high';
  if (lowCount / total > 0.5) return 'low';
  return 'medium';
}

function computeCompleteness(materials: MaterialWithValidation[]): number {
  if (materials.length === 0) return 0;

  const validCount = materials.filter((m) => m.hasData).length;
  const raw = Math.round((validCount / materials.length) * 100);
  return Math.round(raw / 5) * 5; // Round to nearest 5 (matches slider step)
}

// ============================================================================
// CONTENT-QUALITY SCORING FUNCTIONS
// ============================================================================

/**
 * Score geographic coverage text based on specificity and quality.
 * Returns 0–100 where higher = better documented geographic representativeness.
 */
function scoreGeographicCoverage(text: string): number {
  if (!text || !text.trim()) return 0;

  const trimmed = text.trim();
  let score = 0;

  // BASE: Any non-empty text = 30 (user has documented something)
  score = 30;

  // SPECIFICITY: Count distinct comma/semicolon-separated entries
  const entries = trimmed
    .split(/[,;]|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (entries.length >= 1) score += 15;
  if (entries.length >= 2) score += 10;
  if (entries.length >= 3) score += 5;

  // LENGTH: Longer descriptions suggest more detail
  if (trimmed.length >= 20) score += 10;
  if (trimmed.length >= 50) score += 10;

  // SPECIFICITY KEYWORDS: Named countries/regions score higher
  const specificTerms =
    /\b(united kingdom|uk|great britain|france|germany|spain|italy|eu|european union|china|usa|united states|india|australia|new zealand|brazil|south africa|japan|canada|netherlands|belgium|ireland|portugal|austria|switzerland|sweden|norway|denmark|finland|scotland|england|wales|mexico|argentina|chile|peru|colombia|thailand|vietnam|indonesia|malaysia|philippines|south korea|taiwan|singapore|hong kong|egypt|nigeria|kenya|morocco|turkey|poland|czech|romania|hungary|greece|croatia)\b/i;

  if (specificTerms.test(trimmed)) {
    score += 20;
  }

  // VAGUE PENALTY: Overly generic terms reduce score
  const vagueTerms = /\b(global|worldwide|international|various|mixed|unknown|n\/a|tbc|tbd)\b/i;
  if (vagueTerms.test(trimmed)) {
    score -= 10;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Score technological coverage text based on process detail and specificity.
 * Returns 0–100 where higher = better documented technological representativeness.
 */
function scoreTechnologicalCoverage(text: string): number {
  if (!text || !text.trim()) return 0;

  const trimmed = text.trim();
  let score = 0;

  // BASE: Any non-empty text = 30
  score = 30;

  // LENGTH: Longer descriptions suggest more detail
  if (trimmed.length >= 30) score += 10;
  if (trimmed.length >= 80) score += 10;
  if (trimmed.length >= 150) score += 5;

  // PROCESS KEYWORDS: Evidence of process-specific description
  const processKeywords =
    /\b(brew|distill|ferment|bottl|packaging|filling|pasteuris|filtration|mashing|boiling|blending|carbonat|ageing|maturation|conditioning|vinifi|crush|press|roast|extraction|lautering|hopping|malting|casking|kegging|canning|labelling|wrapping|palletis)\b/i;
  if (processKeywords.test(trimmed)) score += 15;

  // FACILITY REFERENCE: Mentions specific facilities/sites
  const facilityKeywords =
    /\b(production at|facility|site|plant|factory|brewery|distillery|winery|bottling line|warehouse|cellar)\b/i;
  if (facilityKeywords.test(trimmed)) score += 10;

  // TECHNOLOGY LEVEL: Modern, commercial, industrial descriptors
  const technologyLevel =
    /\b(modern|commercial|industrial|automated|semi-automated|artisan|craft|small-scale|large-scale|traditional|mechanised|mechanized|continuous|batch)\b/i;
  if (technologyLevel.test(trimmed)) score += 10;

  // VAGUE PENALTY
  const vagueTerms = /\b(general|standard|typical|average|normal|unknown|n\/a|tbc|tbd)\b/i;
  if (vagueTerms.test(trimmed)) score -= 10;

  return Math.min(100, Math.max(0, score));
}

// ============================================================================
// QUALITY INDICATOR
// ============================================================================

interface QualityIndicatorProps {
  score: number;
  label: string;
}

function QualityIndicator({ score, label }: QualityIndicatorProps) {
  const getColorClass = (s: number) => {
    if (s >= 70) return 'text-green-600';
    if (s >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getIcon = (s: number) => {
    if (s >= 70) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (s >= 40) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {getIcon(score)}
        <span className={cn('text-sm font-medium', getColorClass(score))}>
          {score}%
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// DQI SUMMARY
// ============================================================================

function DqiSummary({ overrideDqi }: { overrideDqi?: number }) {
  const { formData } = useWizardContext();
  const dqi = overrideDqi ?? formData.dqiScore ?? 0;

  const getOverallRating = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-green-600' };
    if (score >= 60) return { label: 'Good', color: 'text-green-500' };
    if (score >= 40) return { label: 'Acceptable', color: 'text-yellow-600' };
    if (score >= 20) return { label: 'Poor', color: 'text-orange-600' };
    return { label: 'Very Poor', color: 'text-red-600' };
  };

  const rating = getOverallRating(dqi);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4" />
          Data Quality Index (DQI)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className={cn('text-3xl font-bold', rating.color)}>
            {dqi}%
          </span>
          <span className={cn('text-sm font-medium', rating.color)}>
            {rating.label}
          </span>
        </div>
        <Progress value={dqi} className="h-2" />
        <p className="text-xs text-muted-foreground">
          Blended score from your material data quality (60%) and documentation coverage (40%).
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DataQualityStep() {
  const { formData, updateField, preCalcState } = useWizardContext();
  const seededFields = useRef<Set<string>>(new Set());
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);

  const updateDataQuality = (
    field: keyof typeof formData.dataQuality,
    value: string | number
  ) => {
    updateField('dataQuality', {
      ...formData.dataQuality,
      [field]: value,
    });
  };

  // ============================================================================
  // AUTO-FILL CONTEXT
  // ============================================================================

  const autoFillContext = useMemo(
    () => ({
      referenceYear: formData.referenceYear,
      materials: preCalcState.materials,
      facilities: preCalcState.linkedFacilities,
      allocations: preCalcState.facilityAllocations,
      productType: preCalcState.product?.product_type as string | undefined,
    }),
    [
      formData.referenceYear,
      preCalcState.materials,
      preCalcState.linkedFacilities,
      preCalcState.facilityAllocations,
      preCalcState.product,
    ]
  );

  // Memoised computed suggestions (used for guidance alerts + regenerate)
  const computedGeo = useMemo(
    () =>
      computeGeographicCoverage(
        autoFillContext.materials,
        autoFillContext.facilities
      ),
    [autoFillContext.materials, autoFillContext.facilities]
  );

  const computedTech = useMemo(
    () =>
      computeTechnologicalCoverage(
        autoFillContext.productType,
        autoFillContext.facilities
      ),
    [autoFillContext.productType, autoFillContext.facilities]
  );

  // ============================================================================
  // AUTO-SEED ON FIRST LOAD (per-field, following CutoffStep pattern)
  // ============================================================================

  useEffect(() => {
    const dq = formData.dataQuality;
    const updates: Partial<typeof dq> = {};
    const filled: string[] = [];

    // Temporal: seed if empty
    if (!seededFields.current.has('temporal')) {
      seededFields.current.add('temporal');
      if (!dq.temporal_coverage) {
        const v = computeTemporalCoverage(
          autoFillContext.referenceYear,
          autoFillContext.allocations
        );
        if (v) {
          updates.temporal_coverage = v;
          filled.push('Temporal coverage');
        }
      }
    }

    // Geographic: seed if empty
    if (!seededFields.current.has('geographic')) {
      seededFields.current.add('geographic');
      if (!dq.geographic_coverage) {
        const v = computeGeographicCoverage(
          autoFillContext.materials,
          autoFillContext.facilities
        );
        if (v) {
          updates.geographic_coverage = v;
          filled.push('Geographic coverage');
        }
      }
    }

    // Technological: seed if empty
    if (!seededFields.current.has('technological')) {
      seededFields.current.add('technological');
      if (!dq.technological_coverage) {
        const v = computeTechnologicalCoverage(
          autoFillContext.productType,
          autoFillContext.facilities
        );
        if (v) {
          updates.technological_coverage = v;
          filled.push('Technological coverage');
        }
      }
    }

    // Precision: seed only if still at default 'medium' and we have materials
    if (!seededFields.current.has('precision')) {
      seededFields.current.add('precision');
      if (dq.precision === 'medium' && autoFillContext.materials.length > 0) {
        const v = computePrecision(autoFillContext.materials);
        if (v !== 'medium') {
          updates.precision = v;
          filled.push('Data precision');
        }
      }
    }

    // Completeness: seed only if still at 0 and we have materials
    if (!seededFields.current.has('completeness')) {
      seededFields.current.add('completeness');
      if (dq.completeness === 0 && autoFillContext.materials.length > 0) {
        const v = computeCompleteness(autoFillContext.materials);
        if (v > 0) {
          updates.completeness = v;
          filled.push('Completeness');
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updateField('dataQuality', { ...dq, ...updates });
    }
    if (filled.length > 0) {
      setAutoFilledFields(filled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFillContext]); // Depend ONLY on context, not formData (avoids infinite loop)

  // ============================================================================
  // REGENERATE ALL (preserves user text when compute returns empty)
  // ============================================================================

  const handleRegenerateAll = () => {
    const dq = formData.dataQuality;
    const temporal = computeTemporalCoverage(
      autoFillContext.referenceYear,
      autoFillContext.allocations
    );
    const geographic = computeGeographicCoverage(
      autoFillContext.materials,
      autoFillContext.facilities
    );
    const technological = computeTechnologicalCoverage(
      autoFillContext.productType,
      autoFillContext.facilities
    );
    const precision = computePrecision(autoFillContext.materials);
    const completeness = computeCompleteness(autoFillContext.materials);

    updateField('dataQuality', {
      temporal_coverage: temporal || dq.temporal_coverage,
      geographic_coverage: geographic || dq.geographic_coverage,
      technological_coverage: technological || dq.technological_coverage,
      precision,
      completeness: completeness || dq.completeness,
    });
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const materialBreakdown = useMemo(
    () => classifyMaterials(preCalcState.materials),
    [preCalcState.materials]
  );

  const validMaterialCount = useMemo(
    () => preCalcState.materials.filter((m) => m.hasData).length,
    [preCalcState.materials]
  );

  // Quality scores for display — using content-quality scoring
  const temporalScore = (() => {
    const raw = formData.dataQuality.temporal_coverage;
    if (!raw) return 0;
    // Extract the most recent year from strings like "2025" or "2024–2025"
    const matches = raw.match(/\d{4}/g);
    if (!matches || matches.length === 0) return 0;
    const latestYear = Math.max(...matches.map(Number));
    if (isNaN(latestYear)) return 0;
    return Math.min(100, Math.max(0, 100 - (new Date().getFullYear() - latestYear) * 10));
  })();

  const geoScore = scoreGeographicCoverage(formData.dataQuality.geographic_coverage);
  const techScore = scoreTechnologicalCoverage(formData.dataQuality.technological_coverage);
  const precisionScore =
    formData.dataQuality.precision === 'high'
      ? 100
      : formData.dataQuality.precision === 'medium'
        ? 60
        : 30;
  const completenessScore = formData.dataQuality.completeness || 0;

  // Live blended DQI: 60% material quality + 40% coverage scores
  const liveComputedDqi = useMemo(() => {
    const materialDqi = formData.dqiScore || 0;
    const coverageDqi = Math.round(
      temporalScore * 0.2 +
        geoScore * 0.2 +
        techScore * 0.15 +
        precisionScore * 0.2 +
        completenessScore * 0.25
    );
    return Math.round(materialDqi * 0.6 + coverageDqi * 0.4);
  }, [
    formData.dqiScore,
    temporalScore,
    geoScore,
    techScore,
    precisionScore,
    completenessScore,
  ]);

  // Tech template for collapsible guidance
  const techTemplate = autoFillContext.productType
    ? TECH_COVERAGE_TEMPLATES[autoFillContext.productType]
    : undefined;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Data Quality</h3>
          <p className="text-sm text-muted-foreground">
            Assess the quality of data used in your LCA. ISO 14044 requires you
            to document the temporal, geographical, and technological
            representativeness of your data.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerateAll}
          className="h-7 text-xs gap-1.5 flex-shrink-0 ml-4"
        >
          <RotateCcw className="h-3 w-3" />
          Regenerate from data
        </Button>
      </div>

      {/* Auto-fill indicator — only shown when fields were actually auto-filled */}
      {autoFilledFields.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span>
            Auto-filled{' '}
            <strong>{autoFilledFields.length} field{autoFilledFields.length !== 1 ? 's' : ''}</strong>{' '}
            from your product data. You can edit any value.
          </span>
        </div>
      )}

      {/* DQI Summary */}
      <DqiSummary overrideDqi={liveComputedDqi} />

      {/* Temporal Coverage */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="temporal_coverage">
            Temporal Coverage <span className="text-destructive">*</span>
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          The year(s) your data refers to, derived from your reference year and
          facility reporting periods. More recent data scores higher.
        </p>
        <Input
          id="temporal_coverage"
          placeholder="e.g., 2025 or 2024–2025"
          value={formData.dataQuality.temporal_coverage}
          onChange={(e) =>
            updateDataQuality('temporal_coverage', e.target.value)
          }
          className="w-[200px]"
        />
        <QualityIndicator score={temporalScore} label="Temporal score" />
      </div>

      {/* Geographic Coverage */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="geographic_coverage">
            Geographic Coverage <span className="text-destructive">*</span>
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          The region(s) your data represents. List specific countries or regions
          for a higher score. Vague terms like &quot;global&quot; score lower.
        </p>
        <Input
          id="geographic_coverage"
          placeholder="e.g., United Kingdom, France, European Union"
          value={formData.dataQuality.geographic_coverage}
          onChange={(e) =>
            updateDataQuality('geographic_coverage', e.target.value)
          }
        />

        {/* Guidance: show when field is empty */}
        {!formData.dataQuality.geographic_coverage && (
          <Alert className="py-2">
            <Lightbulb className="h-3.5 w-3.5" />
            <AlertDescription className="text-xs">
              {computedGeo ? (
                <>
                  We found countries in your data:{' '}
                  <strong>{computedGeo}</strong>.{' '}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() =>
                      updateDataQuality('geographic_coverage', computedGeo)
                    }
                  >
                    Use this
                  </Button>
                </>
              ) : (
                'Add origin countries to your ingredients and facility locations for automatic geographic coverage.'
              )}
            </AlertDescription>
          </Alert>
        )}

        <QualityIndicator score={geoScore} label="Geographic score" />
      </div>

      {/* Technological Coverage */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="technological_coverage">
            Technological Coverage <span className="text-destructive">*</span>
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Describe the production processes your data represents. Include
          specific process names (e.g., fermentation, distillation) and facility
          references for a higher score.
        </p>
        <Input
          id="technological_coverage"
          placeholder="e.g., Modern brewing with heat recovery, Traditional fermentation"
          value={formData.dataQuality.technological_coverage}
          onChange={(e) =>
            updateDataQuality('technological_coverage', e.target.value)
          }
        />

        {/* Guidance: show when field is empty */}
        {!formData.dataQuality.technological_coverage && (
          <Alert className="py-2">
            <Lightbulb className="h-3.5 w-3.5" />
            <AlertDescription className="text-xs">
              {computedTech ? (
                <>
                  Suggested description based on your product type:{' '}
                  <strong className="font-normal italic">
                    {computedTech.length > 80
                      ? `${computedTech.slice(0, 80)}...`
                      : computedTech}
                  </strong>{' '}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() =>
                      updateDataQuality('technological_coverage', computedTech)
                    }
                  >
                    Use this
                  </Button>
                </>
              ) : (
                'Set your product type on the product page for a suggested description, or describe your production processes manually.'
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Template guidance — shown when field has content (for reference) */}
        {formData.dataQuality.technological_coverage && techTemplate && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Lightbulb className="h-3 w-3" />
              <span>
                See example for{' '}
                {autoFillContext.productType || 'your product type'}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs space-y-2">
                <p className="text-muted-foreground">{techTemplate}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => {
                    updateDataQuality(
                      'technological_coverage',
                      computedTech || techTemplate
                    );
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  Use this description
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <QualityIndicator score={techScore} label="Technology score" />
      </div>

      {/* Precision */}
      <div className="space-y-3">
        <Label>
          Data Precision <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Overall assessment of data precision across your inventory, based on
          the quality of your emission factor sources.
        </p>
        <Select
          value={formData.dataQuality.precision}
          onValueChange={(value) =>
            updateDataQuality('precision', value as 'high' | 'medium' | 'low')
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select precision level" />
          </SelectTrigger>
          <SelectContent>
            {PRECISION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Material breakdown badges */}
        {materialBreakdown.total > 0 && (
          <div className="flex flex-wrap gap-2">
            {materialBreakdown.highCount > 0 && (
              <Badge
                variant="outline"
                className="text-xs text-green-600 border-green-500/30"
              >
                {materialBreakdown.highCount} primary
              </Badge>
            )}
            {materialBreakdown.mediumCount > 0 && (
              <Badge
                variant="outline"
                className="text-xs text-yellow-600 border-yellow-500/30"
              >
                {materialBreakdown.mediumCount} secondary
              </Badge>
            )}
            {materialBreakdown.lowCount > 0 && (
              <Badge
                variant="outline"
                className="text-xs text-red-600 border-red-500/30"
              >
                {materialBreakdown.lowCount} estimated
              </Badge>
            )}
          </div>
        )}

        <QualityIndicator score={precisionScore} label="Precision score" />
      </div>

      {/* Completeness */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            Completeness <span className="text-destructive">*</span>
          </Label>
          <span className="text-sm font-medium">
            {formData.dataQuality.completeness}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Percentage of your product&apos;s mass and energy flows for which you
          have emission factor data. Estimated from your material coverage.
        </p>
        <Slider
          value={[formData.dataQuality.completeness || 0]}
          onValueChange={([value]) => updateDataQuality('completeness', value)}
          max={100}
          step={5}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0% (Incomplete)</span>
          <span>100% (Complete)</span>
        </div>

        {/* Material coverage summary */}
        {preCalcState.materials.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {validMaterialCount} of {preCalcState.materials.length} materials
            have verified emission factor data.
          </p>
        )}

        <QualityIndicator
          score={completenessScore}
          label="Completeness score"
        />
      </div>

      {/* ISO Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Pedigree Matrix:</strong> The Data Quality Index is calculated
          using the Pedigree Matrix approach, which scores data across 5
          dimensions: reliability, completeness, temporal correlation,
          geographical correlation, and technological correlation.
        </AlertDescription>
      </Alert>
    </div>
  );
}
