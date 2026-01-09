'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';

interface DataSelectionPanelProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}

const AVAILABLE_SECTIONS = [
  {
    id: 'executive-summary',
    label: 'Executive Summary',
    description: 'High-level overview of key findings and recommendations',
    required: true,
    category: 'Overview',
  },
  {
    id: 'company-overview',
    label: 'Company Overview',
    description: 'Organization details, industry context, and scope of operations',
    required: false,
    category: 'Overview',
  },
  {
    id: 'scope-1-2-3',
    label: 'Scope 1/2/3 Emissions Breakdown',
    description: 'Comprehensive GHG emissions across all scopes with category breakdown',
    required: false,
    category: 'Emissions',
  },
  {
    id: 'ghg-inventory',
    label: 'GHG Gas Inventory (ISO 14067)',
    description: 'Detailed breakdown by gas type (CO₂, CH₄, N₂O, HFCs/PFCs) with GWP factors',
    required: false,
    category: 'Emissions',
  },
  {
    id: 'carbon-origin',
    label: 'Carbon Origin Breakdown',
    description: 'Fossil carbon vs. biogenic carbon vs. land use change emissions',
    required: false,
    category: 'Emissions',
  },
  {
    id: 'product-footprints',
    label: 'Product Carbon Footprints',
    description: 'Individual product LCA results with functional units',
    required: false,
    category: 'Products',
  },
  {
    id: 'multi-capital',
    label: 'Multi-capital Impacts',
    description: 'Water depletion, land use, waste generation, and other impact categories',
    required: false,
    category: 'Environmental Impacts',
  },
  {
    id: 'supply-chain',
    label: 'Supply Chain Analysis',
    description: 'Supplier emissions, hotspot analysis, and value chain mapping',
    required: false,
    category: 'Value Chain',
  },
  {
    id: 'facilities',
    label: 'Facility Emissions Breakdown',
    description: 'Site-level emissions intensity and production allocation',
    required: false,
    category: 'Operations',
  },
  {
    id: 'trends',
    label: 'Year-over-Year Trends',
    description: 'Historical emissions data and trajectory analysis',
    required: false,
    category: 'Performance',
  },
  {
    id: 'targets',
    label: 'Targets & Action Plans',
    description: 'Emission reduction goals, timelines, and strategic initiatives',
    required: false,
    category: 'Strategy',
  },
  {
    id: 'methodology',
    label: 'Methodology & Data Quality',
    description: 'Calculation approaches, data sources, and quality assessment',
    required: false,
    category: 'Technical',
  },
  {
    id: 'regulatory',
    label: 'Regulatory Compliance',
    description: 'Alignment with CSRD, ISO 14067, and other standards',
    required: false,
    category: 'Compliance',
  },
  {
    id: 'appendix',
    label: 'Technical Appendix',
    description: 'Detailed assumptions, emission factors, and supplementary data',
    required: false,
    category: 'Technical',
  },
];

const CATEGORIES = [
  'Overview',
  'Emissions',
  'Products',
  'Environmental Impacts',
  'Value Chain',
  'Operations',
  'Performance',
  'Strategy',
  'Compliance',
  'Technical',
];

export function DataSelectionPanel({ config, onChange }: DataSelectionPanelProps) {
  const handleToggleSection = (sectionId: string, required: boolean) => {
    if (required) return; // Can't toggle required sections

    const updatedSections = config.sections.includes(sectionId)
      ? config.sections.filter((id) => id !== sectionId)
      : [...config.sections, sectionId];

    onChange({ sections: updatedSections });
  };

  const handleSelectAll = () => {
    const allSectionIds = AVAILABLE_SECTIONS.map((s) => s.id);
    onChange({ sections: allSectionIds });
  };

  const handleSelectNone = () => {
    const requiredSectionIds = AVAILABLE_SECTIONS.filter((s) => s.required).map((s) => s.id);
    onChange({ sections: requiredSectionIds });
  };

  const selectedCount = config.sections.length;
  const totalCount = AVAILABLE_SECTIONS.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Select Report Sections</Label>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedCount} of {totalCount} sections selected
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-sm text-primary hover:underline"
          >
            Select All
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={handleSelectNone}
            className="text-sm text-primary hover:underline"
          >
            Select None
          </button>
        </div>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          The report will only include data that is available in your platform for the selected period.
          Missing data will be clearly marked in the final report.
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {CATEGORIES.map((category) => {
          const sectionsInCategory = AVAILABLE_SECTIONS.filter((s) => s.category === category);
          if (sectionsInCategory.length === 0) return null;

          return (
            <div key={category} className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground">{category}</h3>
              <div className="space-y-3 ml-2">
                {sectionsInCategory.map((section) => {
                  const isSelected = config.sections.includes(section.id);
                  return (
                    <div
                      key={section.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={section.id}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSection(section.id, section.required)}
                        disabled={section.required}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={section.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {section.label}
                          {section.required && (
                            <span className="ml-2 text-xs text-red-500">(Required)</span>
                          )}
                        </label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
