'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, InfoIcon } from 'lucide-react';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';

interface StandardsSelectorProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}

const REPORTING_STANDARDS = [
  {
    id: 'csrd',
    label: 'CSRD',
    fullName: 'Corporate Sustainability Reporting Directive',
    scope: 'EU Mandatory Reporting',
    description: 'Comprehensive ESG reporting framework required for large EU companies and listed SMEs',
    recommended: true,
    platformSupport: 'full',
  },
  {
    id: 'iso-14067',
    label: 'ISO 14067',
    fullName: 'Product Carbon Footprint',
    scope: 'International Standard',
    description: 'Requirements and guidelines for quantification and communication of product carbon footprints',
    recommended: true,
    platformSupport: 'full',
  },
  {
    id: 'gri',
    label: 'GRI',
    fullName: 'Global Reporting Initiative',
    scope: 'Universal Sustainability Reporting',
    description: 'World\'s most widely used sustainability reporting standards',
    recommended: false,
    platformSupport: 'partial',
  },
  {
    id: 'tcfd',
    label: 'TCFD',
    fullName: 'Task Force on Climate-related Financial Disclosures',
    scope: 'Climate Risk Reporting',
    description: 'Framework for climate-related financial risk disclosures',
    recommended: false,
    platformSupport: 'partial',
  },
  {
    id: 'cdp',
    label: 'CDP',
    fullName: 'Carbon Disclosure Project',
    scope: 'Environmental Disclosure',
    description: 'Global disclosure system for environmental impact management',
    recommended: false,
    platformSupport: 'partial',
  },
  {
    id: 'iso-14064',
    label: 'ISO 14064',
    fullName: 'GHG Accounting & Verification',
    scope: 'International Standard',
    description: 'Specification for quantification and reporting of GHG emissions and removals',
    recommended: false,
    platformSupport: 'full',
  },
  {
    id: 'sasb',
    label: 'SASB',
    fullName: 'Sustainability Accounting Standards Board',
    scope: 'Industry-Specific Standards',
    description: 'Industry-specific sustainability accounting standards',
    recommended: false,
    platformSupport: 'partial',
  },
  {
    id: 'tnfd',
    label: 'TNFD',
    fullName: 'Taskforce on Nature-related Financial Disclosures',
    scope: 'Nature & Biodiversity',
    description: 'Framework for nature-related risk disclosure',
    recommended: false,
    platformSupport: 'emerging',
  },
];

export function StandardsSelector({ config, onChange }: StandardsSelectorProps) {
  const handleToggleStandard = (standardId: string) => {
    const updatedStandards = config.standards.includes(standardId)
      ? config.standards.filter((id) => id !== standardId)
      : [...config.standards, standardId];

    onChange({ standards: updatedStandards });
  };

  const recommendedStandards = REPORTING_STANDARDS.filter((s) => s.recommended);
  const otherStandards = REPORTING_STANDARDS.filter((s) => !s.recommended);

  const getPlatformSupportBadge = (support: string) => {
    switch (support) {
      case 'full':
        return <Badge variant="default" className="bg-green-600">Full Support</Badge>;
      case 'partial':
        return <Badge variant="secondary">Partial Support</Badge>;
      case 'emerging':
        return <Badge variant="outline">Emerging</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base">Reporting Standards Compliance</Label>
        <p className="text-sm text-muted-foreground mt-1">
          {config.standards.length} standard{config.standards.length !== 1 ? 's' : ''} selected
        </p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          Your report will be structured to align with the selected standards. The platform automatically formats data to meet each standard&apos;s requirements.
        </AlertDescription>
      </Alert>

      {/* Recommended Standards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <h3 className="font-medium text-sm">Recommended for Your Organization</h3>
        </div>
        <div className="space-y-3 ml-2">
          {recommendedStandards.map((standard) => {
            const isSelected = config.standards.includes(standard.id);
            return (
              <div
                key={standard.id}
                className="flex items-start space-x-3 p-4 rounded-lg border-2 border-green-100 bg-green-50/50 hover:bg-green-100/50 transition-colors"
              >
                <Checkbox
                  id={standard.id}
                  checked={isSelected}
                  onCheckedChange={() => handleToggleStandard(standard.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label
                      htmlFor={standard.id}
                      className="text-sm font-semibold leading-none cursor-pointer"
                    >
                      {standard.label}
                    </label>
                    {getPlatformSupportBadge(standard.platformSupport)}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {standard.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {standard.scope}
                  </p>
                  <p className="text-sm text-foreground">
                    {standard.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Other Standards */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground">Other Standards</h3>
        <div className="space-y-3 ml-2">
          {otherStandards.map((standard) => {
            const isSelected = config.standards.includes(standard.id);
            return (
              <div
                key={standard.id}
                className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  id={standard.id}
                  checked={isSelected}
                  onCheckedChange={() => handleToggleStandard(standard.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label
                      htmlFor={standard.id}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {standard.label}
                    </label>
                    {getPlatformSupportBadge(standard.platformSupport)}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {standard.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {standard.scope}
                  </p>
                  <p className="text-sm text-foreground">
                    {standard.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
