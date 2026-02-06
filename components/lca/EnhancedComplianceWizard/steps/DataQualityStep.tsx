'use client';

import React from 'react';
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
import {
  Info,
  Calendar,
  Globe,
  Cpu,
  Target,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import { cn } from '@/lib/utils';

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
// QUALITY INDICATOR
// ============================================================================

interface QualityIndicatorProps {
  score: number; // 0-100
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

function DqiSummary() {
  const { formData } = useWizardContext();
  const dqi = formData.dqiScore || 0;

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
          Based on Pedigree Matrix scoring from your material data sources.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DataQualityStep() {
  const { formData, updateField } = useWizardContext();

  const updateDataQuality = (
    field: keyof typeof formData.dataQuality,
    value: string | number
  ) => {
    updateField('dataQuality', {
      ...formData.dataQuality,
      [field]: value,
    });
  };

  // Calculate quality scores for display
  const temporalScore = formData.dataQuality.temporal_coverage
    ? Math.min(
        100,
        Math.max(
          0,
          100 -
            (new Date().getFullYear() -
              parseInt(formData.dataQuality.temporal_coverage)) *
              10
        )
      )
    : 0;

  const geoScore = formData.dataQuality.geographic_coverage ? 70 : 0;
  const techScore = formData.dataQuality.technological_coverage ? 70 : 0;
  const precisionScore =
    formData.dataQuality.precision === 'high'
      ? 100
      : formData.dataQuality.precision === 'medium'
        ? 60
        : 30;
  const completenessScore = formData.dataQuality.completeness || 0;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold">Data Quality</h3>
        <p className="text-sm text-muted-foreground">
          Assess the quality of data used in your LCA. ISO 14044 requires you to
          document the temporal, geographical, and technological
          representativeness of your data.
        </p>
      </div>

      {/* DQI Summary */}
      <DqiSummary />

      {/* Temporal Coverage */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="temporal_coverage">
            Temporal Coverage <span className="text-destructive">*</span>
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          The year(s) to which your data refers. More recent data is generally
          preferred.
        </p>
        <Input
          id="temporal_coverage"
          placeholder="e.g., 2024 or 2022-2024"
          value={formData.dataQuality.temporal_coverage}
          onChange={(e) => updateDataQuality('temporal_coverage', e.target.value)}
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
          The geographic region(s) your data represents. Data should be
          representative of where your product is manufactured.
        </p>
        <Input
          id="geographic_coverage"
          placeholder="e.g., United Kingdom, European Union, Global average"
          value={formData.dataQuality.geographic_coverage}
          onChange={(e) =>
            updateDataQuality('geographic_coverage', e.target.value)
          }
        />
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
          Describe the technology or process type your data represents. Data
          should match your actual production technology.
        </p>
        <Input
          id="technological_coverage"
          placeholder="e.g., Modern brewing with heat recovery, Traditional fermentation"
          value={formData.dataQuality.technological_coverage}
          onChange={(e) =>
            updateDataQuality('technological_coverage', e.target.value)
          }
        />
        <QualityIndicator score={techScore} label="Technology score" />
      </div>

      {/* Precision */}
      <div className="space-y-3">
        <Label>
          Data Precision <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Overall assessment of data precision across your inventory.
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
          Percentage of mass and energy flows for which you have data. Higher is
          better.
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
        <QualityIndicator score={completenessScore} label="Completeness score" />
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
