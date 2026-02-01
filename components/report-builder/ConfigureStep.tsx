'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { BasicConfigForm } from './BasicConfigForm';
import { TemplateLibrary } from './TemplateLibrary';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';

interface ConfigureStepProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
  onNext: () => void;
}

export function ConfigureStep({ config, onChange, onNext }: ConfigureStepProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Basics</CardTitle>
          <CardDescription>
            Set up your report name, reporting period, audience, and format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BasicConfigForm config={config} onChange={onChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Start from a Template</CardTitle>
          <CardDescription>
            Optionally choose a pre-configured template to get started quickly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateLibrary config={config} onChange={onChange} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} size="lg">
          Next: Select Content
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
