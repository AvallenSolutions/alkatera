'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import type { ReportConfig } from '@/types/report-builder';
import { AVAILABLE_SECTIONS, SECTION_LABELS, AUDIENCE_LABELS } from '@/types/report-builder';

interface QuickGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ReportConfig;
  onGenerate: (config: ReportConfig) => void;
  generating: boolean;
  organizationId: string | null;
}

export function QuickGenerateDialog({ open, onOpenChange, config, onGenerate, generating, organizationId }: QuickGenerateDialogProps) {
  const [loading, setLoading] = useState(true);
  const [autoConfig, setAutoConfig] = useState<ReportConfig>(config);
  const [autoSections, setAutoSections] = useState<string[]>([]);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (open) {
      runAutoDetection();
    }
  }, [open]);

  async function runAutoDetection() {
    setLoading(true);
    try {
      if (!organizationId) {
        throw new Error('No organization');
      }

      const orgId = organizationId;
      const year = config.reportYear;

      const [corporateData, productData, facilitiesData, suppliersData] = await Promise.all([
        supabase.from('corporate_reports').select('id, total_emissions, breakdown_json').eq('organization_id', orgId).eq('year', year).single(),
        supabase.from('product_carbon_footprints').select('id').eq('organization_id', orgId).eq('status', 'completed'),
        supabase.from('facilities').select('id').eq('organization_id', orgId),
        supabase.from('suppliers').select('id').eq('organization_id', orgId),
      ]);

      const sections: string[] = ['executive-summary', 'company-overview'];

      if (corporateData.data) {
        sections.push('scope-1-2-3');
        if (corporateData.data.breakdown_json?.scope3 > 0) sections.push('ghg-inventory');
      }
      if ((productData.data?.length || 0) > 0) sections.push('product-footprints');
      if ((suppliersData.data?.length || 0) > 0) sections.push('supply-chain');
      if ((facilitiesData.data?.length || 0) > 0) sections.push('facilities');
      sections.push('targets', 'methodology');
      if (config.standards.includes('csrd')) sections.push('regulatory');

      // Filter out comingSoon sections
      const validSections = sections.filter(id => {
        const section = AVAILABLE_SECTIONS.find(s => s.id === id);
        return section && !section.comingSoon;
      });

      setAutoSections(validSections);
      setAutoConfig({ ...config, sections: validSections });
    } catch (error) {
      console.error('Quick generate detection error:', error);
      setAutoSections(['executive-summary', 'company-overview', 'targets', 'methodology']);
      setAutoConfig({ ...config, sections: ['executive-summary', 'company-overview', 'targets', 'methodology'] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Generate
          </DialogTitle>
          <DialogDescription>
            Auto-configured report based on your available data
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Report Name</span>
                <span className="font-medium">{autoConfig.reportName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Year</span>
                <span className="font-medium">{autoConfig.reportYear}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Audience</span>
                <span className="font-medium">{AUDIENCE_LABELS[autoConfig.audience]}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Auto-selected sections ({autoSections.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {autoSections.map((id) => (
                  <Badge key={id} variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                    {SECTION_LABELS[id] || id}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Branding preview */}
            <div
              className="rounded-lg p-3 border"
              style={{
                background: `linear-gradient(135deg, ${autoConfig.branding.primaryColor}15 0%, ${autoConfig.branding.secondaryColor}15 100%)`,
              }}
            >
              <div className="flex items-center gap-2">
                {autoConfig.branding.logo && (
                  <img src={autoConfig.branding.logo} alt="Logo" className="h-8 object-contain" />
                )}
                <div className="text-sm font-semibold" style={{ color: autoConfig.branding.primaryColor }}>
                  {autoConfig.reportName}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={() => onGenerate(autoConfig)} disabled={loading || generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Generate Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
