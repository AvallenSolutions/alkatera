'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, TrendingUp, Info, ChevronDown, Settings2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ReportConfig } from '@/types/report-builder';
import { AUDIENCE_TYPES, REPORTING_STANDARDS } from '@/types/report-builder';

interface ConfigureStepProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}

export function ConfigureStep({ config, onChange }: ConfigureStepProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  const handleToggleStandard = (standardId: string) => {
    const updatedStandards = config.standards.includes(standardId)
      ? config.standards.filter((id) => id !== standardId)
      : [...config.standards, standardId];
    onChange({ standards: updatedStandards });
  };

  const getPlatformSupportBadge = (support: string) => {
    switch (support) {
      case 'full':
        return <Badge variant="default" className="bg-green-600 text-xs">Full</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="text-xs">Partial</Badge>;
      case 'emerging':
        return <Badge variant="outline" className="text-xs">Emerging</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Report Name */}
      <div className="space-y-2">
        <Label htmlFor="report-name">Report Name</Label>
        <Input
          id="report-name"
          placeholder="e.g., Annual Sustainability Report 2026"
          value={config.reportName}
          onChange={(e) => onChange({ reportName: e.target.value })}
        />
      </div>

      {/* Year & Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <Label>Period Start</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(new Date(config.reportingPeriodStart), 'PP')}
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
          <Label>Period End</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(new Date(config.reportingPeriodEnd), 'PP')}
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

      {/* Audience */}
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
          <p className="text-sm text-muted-foreground">{selectedAudience.description}</p>
        )}
      </div>

      {/* Advanced Options */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-4 py-3 h-auto border rounded-lg">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="font-medium">Advanced Options</span>
              {config.standards.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {config.standards.length} standard{config.standards.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn('h-4 w-4 transition-transform', advancedOpen && 'rotate-180')} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-6">
          {/* Multi-Year Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <Label htmlFor="multi-year" className="text-base font-semibold cursor-pointer">
                  Multi-Year Trend Analysis
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Compare data across multiple years to show progress
              </p>
            </div>
            <Switch
              id="multi-year"
              checked={config.isMultiYear || false}
              onCheckedChange={(checked) => {
                onChange({
                  isMultiYear: checked,
                  reportYears: checked ? [config.reportYear, config.reportYear - 1] : [config.reportYear],
                });
              }}
            />
          </div>

          {config.isMultiYear && (
            <div className="space-y-2 ml-4">
              <Label>Select Years for Comparison</Label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  const isSelected = (config.reportYears || []).includes(year);
                  return (
                    <Button
                      key={year}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const currentYears = config.reportYears || [];
                        const newYears = isSelected
                          ? currentYears.filter((y) => y !== year)
                          : [...currentYears, year].sort((a, b) => b - a);
                        onChange({ reportYears: newYears });
                      }}
                    >
                      {year}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standards Selection */}
          <div className="space-y-3">
            <Label className="text-base">Reporting Standards</Label>
            <p className="text-sm text-muted-foreground">
              Select standards to align your report with
            </p>
            <div className="space-y-2">
              {REPORTING_STANDARDS.map((standard) => {
                const isSelected = config.standards.includes(standard.id);
                return (
                  <div
                    key={standard.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent/50',
                      standard.recommended && !isSelected && 'border-green-200 bg-green-50/30'
                    )}
                    onClick={() => handleToggleStandard(standard.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleStandard(standard.id)}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{standard.label}</span>
                          <span className="text-xs text-muted-foreground">{standard.fullName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{standard.scope}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {standard.recommended && (
                        <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Recommended
                        </Badge>
                      )}
                      {getPlatformSupportBadge(standard.platformSupport)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
