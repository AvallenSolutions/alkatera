'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  AlertTriangle,
  Target,
  Box,
  Scissors,
  BarChart2,
  LineChart,
  Shield,
  FileText,
  Edit,
} from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import { WIZARD_STEPS } from '../WizardProgress';
import { cn } from '@/lib/utils';

// ============================================================================
// COMPLIANCE CHECK
// ============================================================================

interface ComplianceItem {
  field: string;
  label: string;
  required: boolean;
  completed: boolean;
  value?: string;
}

function useComplianceChecklist(): ComplianceItem[] {
  const { formData } = useWizardContext();

  return [
    {
      field: 'intendedApplication',
      label: 'Intended Application',
      required: true,
      completed: !!formData.intendedApplication.trim(),
      value: formData.intendedApplication,
    },
    {
      field: 'reasonsForStudy',
      label: 'Reasons for Study',
      required: true,
      completed: !!formData.reasonsForStudy.trim(),
      value: formData.reasonsForStudy,
    },
    {
      field: 'intendedAudience',
      label: 'Intended Audience',
      required: true,
      completed: formData.intendedAudience.length > 0,
      value: formData.intendedAudience.join(', '),
    },
    {
      field: 'functionalUnit',
      label: 'Functional Unit',
      required: true,
      completed: !!formData.functionalUnit.trim(),
      value: formData.functionalUnit,
    },
    {
      field: 'systemBoundary',
      label: 'System Boundary',
      required: true,
      completed: !!formData.systemBoundary,
      value: formData.systemBoundary,
    },
    {
      field: 'cutoffCriteria',
      label: 'Cut-off Criteria',
      required: true,
      completed: !!formData.cutoffCriteria.trim(),
      value: formData.cutoffCriteria,
    },
    {
      field: 'assumptions',
      label: 'Assumptions & Limitations',
      required: true,
      completed: formData.assumptions.length > 0,
      value: `${formData.assumptions.length} documented`,
    },
    {
      field: 'dataQuality.temporal_coverage',
      label: 'Temporal Coverage',
      required: true,
      completed: !!formData.dataQuality.temporal_coverage,
      value: formData.dataQuality.temporal_coverage,
    },
    {
      field: 'dataQuality.geographic_coverage',
      label: 'Geographic Coverage',
      required: true,
      completed: !!formData.dataQuality.geographic_coverage,
      value: formData.dataQuality.geographic_coverage,
    },
    {
      field: 'dataQuality.technological_coverage',
      label: 'Technological Coverage',
      required: true,
      completed: !!formData.dataQuality.technological_coverage,
      value: formData.dataQuality.technological_coverage,
    },
    {
      field: 'hasInterpretation',
      label: 'Interpretation Analysis',
      required: true,
      completed: formData.hasInterpretation,
      value: formData.hasInterpretation ? 'Generated' : 'Not generated',
    },
    {
      field: 'criticalReviewType',
      label: 'Critical Review',
      required: true,
      completed: !!formData.criticalReviewType,
      value: formData.criticalReviewType,
    },
  ];
}

// ============================================================================
// SECTION SUMMARY
// ============================================================================

interface SectionSummaryProps {
  icon: React.ElementType;
  title: string;
  stepNumber: number;
  items: Array<{ label: string; value: string | undefined }>;
  onEdit: () => void;
}

function SectionSummary({
  icon: Icon,
  title,
  stepNumber,
  items,
  onEdit,
}: SectionSummaryProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="mr-1 h-3 w-3" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="max-w-[60%] truncate font-medium">
              {item.value || '-'}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SummaryStep() {
  const { formData, progress, goToStep } = useWizardContext();
  const checklist = useComplianceChecklist();

  const completedCount = checklist.filter((item) => item.completed).length;
  const requiredCount = checklist.filter((item) => item.required).length;
  const allComplete = completedCount === requiredCount;

  const completedStepsCount = progress.completedSteps.length;
  const totalSteps = WIZARD_STEPS.length - 1; // Exclude summary step

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold">Summary & Completion</h3>
        <p className="text-sm text-muted-foreground">
          Review your ISO 14044 compliance information before completing the
          wizard. You can return to any step to make changes.
        </p>
      </div>

      {/* Completion Status */}
      <Card className={cn(allComplete ? 'border-green-200' : 'border-yellow-200')}>
        <CardContent className="flex items-center gap-4 p-4">
          {allComplete ? (
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          ) : (
            <AlertTriangle className="h-10 w-10 text-yellow-600" />
          )}
          <div>
            <p className="text-lg font-semibold">
              {completedCount} of {requiredCount} required fields completed
            </p>
            <p className="text-sm text-muted-foreground">
              {allComplete
                ? 'All required ISO 14044 compliance fields are complete.'
                : 'Some required fields are missing. Please review and complete them.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Missing Fields Alert */}
      {!allComplete && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Required Information</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc">
              {checklist
                .filter((item) => item.required && !item.completed)
                .map((item) => (
                  <li key={item.field}>{item.label}</li>
                ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      {/* Section Summaries */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Goal & Purpose */}
        <SectionSummary
          icon={Target}
          title="Goal & Purpose"
          stepNumber={1}
          onEdit={() => goToStep(1)}
          items={[
            { label: 'Application', value: formData.intendedApplication.slice(0, 50) + (formData.intendedApplication.length > 50 ? '...' : '') },
            { label: 'Audience', value: `${formData.intendedAudience.length} selected` },
            { label: 'Comparative', value: formData.isComparativeAssertion ? 'Yes' : 'No' },
          ]}
        />

        {/* System Boundary */}
        <SectionSummary
          icon={Box}
          title="System Boundary"
          stepNumber={2}
          onEdit={() => goToStep(2)}
          items={[
            { label: 'Functional Unit', value: formData.functionalUnit.slice(0, 50) + (formData.functionalUnit.length > 50 ? '...' : '') },
            { label: 'Boundary', value: formData.systemBoundary },
            { label: 'Reference Year', value: formData.referenceYear.toString() },
          ]}
        />

        {/* Cut-off Criteria */}
        <SectionSummary
          icon={Scissors}
          title="Cut-off Criteria"
          stepNumber={3}
          onEdit={() => goToStep(3)}
          items={[
            { label: 'Criteria', value: formData.cutoffCriteria ? 'Defined' : 'Not defined' },
            { label: 'Assumptions', value: `${formData.assumptions.length} documented` },
          ]}
        />

        {/* Data Quality */}
        <SectionSummary
          icon={BarChart2}
          title="Data Quality"
          stepNumber={4}
          onEdit={() => goToStep(4)}
          items={[
            { label: 'DQI Score', value: formData.dqiScore ? `${formData.dqiScore}%` : 'N/A' },
            { label: 'Temporal', value: formData.dataQuality.temporal_coverage },
            { label: 'Geographic', value: formData.dataQuality.geographic_coverage },
            { label: 'Precision', value: formData.dataQuality.precision },
          ]}
        />

        {/* Interpretation */}
        <SectionSummary
          icon={LineChart}
          title="Interpretation"
          stepNumber={5}
          onEdit={() => goToStep(5)}
          items={[
            { label: 'Status', value: formData.hasInterpretation ? 'Generated' : 'Pending' },
          ]}
        />

        {/* Critical Review */}
        <SectionSummary
          icon={Shield}
          title="Critical Review"
          stepNumber={6}
          onEdit={() => goToStep(6)}
          items={[
            { label: 'Review Type', value: formData.criticalReviewType },
            { label: 'Justification', value: formData.criticalReviewJustification ? 'Provided' : 'None' },
          ]}
        />
      </div>

      <Separator />

      {/* Compliance Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            ISO 14044 Compliance Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <div
                key={item.field}
                className="flex items-center gap-2 text-sm"
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
                <span
                  className={cn(
                    item.completed
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </span>
                {item.required && !item.completed && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ready to complete */}
      {allComplete && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-200">Ready to Complete</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            All required fields are complete. Click &quot;Complete Wizard&quot;
            to save your ISO 14044 compliance documentation and continue to the
            LCA Report Generator where you can preview and download your PDF.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
