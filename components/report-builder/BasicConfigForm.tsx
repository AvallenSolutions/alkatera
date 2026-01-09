'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';

interface BasicConfigFormProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}

const AUDIENCE_TYPES = [
  {
    value: 'investors',
    label: 'Investors & Shareholders',
    description: 'Financial focus, ROI, risk assessment',
  },
  {
    value: 'regulators',
    label: 'Regulatory Bodies',
    description: 'Compliance-focused, technical detail',
  },
  {
    value: 'customers',
    label: 'Customers & Consumers',
    description: 'Accessible language, product focus',
  },
  {
    value: 'internal',
    label: 'Internal Stakeholders',
    description: 'Operational focus, actionable insights',
  },
  {
    value: 'supply-chain',
    label: 'Supply Chain Partners',
    description: 'Collaborative tone, mutual goals',
  },
  {
    value: 'technical',
    label: 'Technical/Scientific Audience',
    description: 'Detailed methodology, peer review',
  },
];

export function BasicConfigForm({ config, onChange }: BasicConfigFormProps) {
  const handleDateChange = (date: Date | undefined, field: 'start' | 'end') => {
    if (!date) return;

    const dateString = format(date, 'yyyy-MM-dd');
    if (field === 'start') {
      onChange({ reportingPeriodStart: dateString });
    } else {
      onChange({ reportingPeriodEnd: dateString });
    }
  };

  const selectedAudience = AUDIENCE_TYPES.find(a => a.value === config.audience);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="report-name">Report Name</Label>
        <Input
          id="report-name"
          placeholder="e.g., Annual Sustainability Report 2024"
          value={config.reportName}
          onChange={(e) => onChange({ reportName: e.target.value })}
        />
        <p className="text-sm text-muted-foreground">
          This will be used as the title of your report
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="report-year">Reporting Year</Label>
          <Select
            value={config.reportYear.toString()}
            onValueChange={(value) => onChange({ reportYear: parseInt(value) })}
          >
            <SelectTrigger id="report-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="output-format">Output Format</Label>
          <Select
            value={config.outputFormat}
            onValueChange={(value: 'pptx' | 'docx' | 'xlsx') => onChange({ outputFormat: value })}
          >
            <SelectTrigger id="output-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pptx">PowerPoint (.pptx) - Recommended</SelectItem>
              <SelectItem value="docx">Word Document (.docx)</SelectItem>
              <SelectItem value="xlsx">Excel Workbook (.xlsx)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Reporting Period Start</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(new Date(config.reportingPeriodStart), 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(config.reportingPeriodStart)}
                onSelect={(date) => handleDateChange(date, 'start')}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Reporting Period End</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(new Date(config.reportingPeriodEnd), 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(config.reportingPeriodEnd)}
                onSelect={(date) => handleDateChange(date, 'end')}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="audience">Target Audience</Label>
        <Select
          value={config.audience}
          onValueChange={(value: any) => onChange({ audience: value })}
        >
          <SelectTrigger id="audience">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_TYPES.map((audience) => (
              <SelectItem key={audience.value} value={audience.value}>
                {audience.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAudience && (
          <p className="text-sm text-muted-foreground">
            {selectedAudience.description}
          </p>
        )}
      </div>
    </div>
  );
}
