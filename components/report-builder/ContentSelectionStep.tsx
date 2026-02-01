'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { DataSelectionPanel } from './DataSelectionPanel';
import { StandardsSelector } from './StandardsSelector';
import { SectionRecommendations } from './SectionRecommendations';
import { DataGapAlerts } from './DataGapAlerts';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';

interface ContentSelectionStepProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ContentSelectionStep({ config, onChange, onNext, onBack }: ContentSelectionStepProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Recommendations</CardTitle>
          <CardDescription>
            Smart suggestions based on your data and selected audience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SectionRecommendations config={config} onChange={onChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Sections</CardTitle>
          <CardDescription>
            Select the sections to include in your report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataSelectionPanel config={config} onChange={onChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reporting Standards</CardTitle>
          <CardDescription>
            Choose which standards and frameworks to align with
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StandardsSelector config={config} onChange={onChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Gap Analysis</CardTitle>
          <CardDescription>
            Review any missing data that could affect report completeness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataGapAlerts config={config} />
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} size="lg">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} size="lg">
          Next: Review & Generate
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
