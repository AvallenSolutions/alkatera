'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, FileText, Calendar, Users, Award, Palette } from 'lucide-react';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';
import { format } from 'date-fns';

interface ReportPreviewProps {
  config: ReportConfig;
}

const AUDIENCE_LABELS: Record<string, string> = {
  investors: 'Investors & Shareholders',
  regulators: 'Regulatory Bodies',
  customers: 'Customers & Consumers',
  internal: 'Internal Stakeholders',
  'supply-chain': 'Supply Chain Partners',
  technical: 'Technical/Scientific Audience',
};

const FORMAT_LABELS: Record<string, string> = {
  pptx: 'PowerPoint Presentation',
  docx: 'Word Document',
  xlsx: 'Excel Workbook',
};

const STANDARDS_LABELS: Record<string, string> = {
  csrd: 'CSRD',
  'iso-14067': 'ISO 14067',
  gri: 'GRI',
  tcfd: 'TCFD',
  cdp: 'CDP',
  'iso-14064': 'ISO 14064',
  sasb: 'SASB',
  tnfd: 'TNFD',
};

const SECTION_LABELS: Record<string, string> = {
  'executive-summary': 'Executive Summary',
  'company-overview': 'Company Overview',
  'scope-1-2-3': 'Scope 1/2/3 Emissions Breakdown',
  'ghg-inventory': 'GHG Gas Inventory (ISO 14067)',
  'carbon-origin': 'Carbon Origin Breakdown',
  'product-footprints': 'Product Environmental Impacts',
  'multi-capital': 'Multi-capital Impacts',
  'supply-chain': 'Supply Chain Analysis',
  facilities: 'Facility Emissions Breakdown',
  trends: 'Year-over-Year Trends',
  targets: 'Targets & Action Plans',
  methodology: 'Methodology & Data Quality',
  regulatory: 'Regulatory Compliance',
  appendix: 'Technical Appendix',
};

export function ReportPreview({ config }: ReportPreviewProps) {
  return (
    <div className="space-y-6">
      <Alert>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription>
          Review your report configuration before generating. Once generated, you&apos;ll receive an editable {FORMAT_LABELS[config.outputFormat].toLowerCase()} file.
        </AlertDescription>
      </Alert>

      {/* Report Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold mb-2">{config.reportName}</h2>
              <p className="text-muted-foreground">
                {format(new Date(config.reportingPeriodStart), 'MMM d, yyyy')} -{' '}
                {format(new Date(config.reportingPeriodEnd), 'MMM d, yyyy')}
              </p>
            </div>

            {/* Key Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/50">
                <FileText className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Output Format</p>
                  <p className="font-semibold">{FORMAT_LABELS[config.outputFormat]}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/50">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reporting Year</p>
                  <p className="font-semibold">{config.reportYear}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/50">
                <Users className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Target Audience</p>
                  <p className="font-semibold">{AUDIENCE_LABELS[config.audience]}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/50">
                <Award className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Standards</p>
                  <p className="font-semibold">{config.standards.length} selected</p>
                </div>
              </div>
            </div>

            {/* Reporting Standards */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Award className="h-4 w-4" />
                Reporting Standards
              </h3>
              <div className="flex flex-wrap gap-2">
                {config.standards.length > 0 ? (
                  config.standards.map((standardId) => (
                    <Badge key={standardId} variant="secondary">
                      {STANDARDS_LABELS[standardId] || standardId}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No standards selected</p>
                )}
              </div>
            </div>

            {/* Sections */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Report Sections ({config.sections.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {config.sections.length > 0 ? (
                  config.sections.map((sectionId) => (
                    <div
                      key={sectionId}
                      className="flex items-center gap-2 text-sm p-2 rounded bg-accent/30"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                      <span>{SECTION_LABELS[sectionId] || sectionId}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground col-span-2">No sections selected</p>
                )}
              </div>
            </div>

            {/* Branding */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Branding
              </h3>
              <div className="flex items-center gap-4 p-4 rounded-lg border">
                {config.branding.logo ? (
                  <div className="flex items-center gap-4">
                    <img
                      src={config.branding.logo}
                      alt="Company logo"
                      className="h-12 object-contain"
                    />
                    <div className="h-8 w-px bg-border" />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No logo uploaded</div>
                )}
                <div className="flex gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="h-10 w-10 rounded border"
                      style={{ backgroundColor: config.branding.primaryColor }}
                    />
                    <span className="text-xs text-muted-foreground">Primary</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="h-10 w-10 rounded border"
                      style={{ backgroundColor: config.branding.secondaryColor }}
                    />
                    <span className="text-xs text-muted-foreground">Secondary</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Estimated Generation Time */}
            <Alert>
              <AlertDescription className="text-sm">
                <strong>Estimated generation time:</strong> 1-2 minutes for {config.sections.length} section
                {config.sections.length !== 1 ? 's' : ''}. You&apos;ll receive a download link when ready.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
