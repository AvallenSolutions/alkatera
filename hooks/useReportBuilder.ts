import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import type { ReportConfig, ReportDefaults } from '@/types/report-builder';

interface GenerateReportResponse {
  success: boolean;
  report_id?: string;
  document_url?: string;
  error?: string;
}

export function useReportBuilder() {
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseBrowserClient();
  const { currentOrganization } = useOrganization();

  /**
   * Load saved report defaults from org context
   */
  const loadDefaults = (org: any): Partial<ReportConfig> | null => {
    if (!org?.report_defaults) return null;
    const defaults = org.report_defaults as ReportDefaults;
    const partial: Partial<ReportConfig> = {};

    if (defaults.branding) {
      partial.branding = {
        logo: defaults.branding.logo ?? null,
        primaryColor: defaults.branding.primaryColor ?? '#2563eb',
        secondaryColor: defaults.branding.secondaryColor ?? '#10b981',
        heroImages: (defaults.branding as any).heroImages ?? undefined,
        leadership: (defaults.branding as any).leadership ?? undefined,
      };
    }
    if (defaults.audience) {
      partial.audience = defaults.audience;
    }
    if (defaults.standards && defaults.standards.length > 0) {
      partial.standards = defaults.standards;
    }
    if (defaults.template) {
      partial.template = defaults.template;
    }
    if (defaults.orientation) {
      partial.orientation = defaults.orientation;
    }

    // Fallback: if no branding logo saved but org has a logo_url, use it
    if (!partial.branding?.logo && org?.logo_url) {
      if (!partial.branding) {
        partial.branding = {
          logo: org.logo_url,
          primaryColor: '#2563eb',
          secondaryColor: '#10b981',
        };
      } else {
        partial.branding.logo = org.logo_url;
      }
    }

    return Object.keys(partial).length > 0 ? partial : null;
  };

  /**
   * Save branding, audience, standards as org defaults
   */
  const saveDefaults = async (orgId: string, config: ReportConfig): Promise<boolean> => {
    try {
      const defaults: ReportDefaults = {
        branding: config.branding,
        audience: config.audience,
        standards: config.standards,
        template: config.template,
        orientation: config.orientation,
      };

      const { error } = await supabase
        .from('organizations')
        .update({ report_defaults: defaults })
        .eq('id', orgId);

      if (error) {
        console.error('Failed to save defaults:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Save defaults error:', error);
      return false;
    }
  };

  /**
   * Generate report — creates DB record, calls edge function, returns reportId immediately
   * for progress tracking. Edge function runs async.
   */
  const generateReport = async (config: ReportConfig): Promise<GenerateReportResponse> => {
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      if (!currentOrganization) {
        throw new Error('No active organization found');
      }

      const organizationId = currentOrganization.id;

      // If impact-valuation section is selected, ensure a calculation exists
      if (config.sections.includes('impact-valuation')) {
        try {
          const { data: ivCheck } = await supabase
            .from('impact_valuation_results')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('reporting_year', config.reportYear)
            .limit(1)
            .maybeSingle();

          if (!ivCheck) {
            // No cached result — trigger a calculation first
            console.log('[ReportBuilder] Triggering impact valuation calculation before report generation');
            const calcResponse = await fetch('/api/impact-valuation/calculate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ reportingYear: config.reportYear }),
            });

            if (!calcResponse.ok) {
              console.warn('[ReportBuilder] Impact valuation calculation failed, proceeding without it');
            }
          }
        } catch (ivError) {
          console.warn('[ReportBuilder] Error checking impact valuation data:', ivError);
          // Non-blocking — proceed with report generation anyway
        }
      }

      // Create report record
      const { data: reportRecord, error: insertError } = await supabase
        .from('generated_reports')
        .insert({
          organization_id: organizationId,
          created_by: user.id,
          report_name: config.reportName,
          report_year: config.reportYear,
          reporting_period_start: config.reportingPeriodStart,
          reporting_period_end: config.reportingPeriodEnd,
          config: config,
          audience: config.audience,
          output_format: config.outputFormat,
          standards: config.standards,
          sections: config.sections,
          logo_url: config.branding.logo,
          primary_color: config.branding.primaryColor,
          secondary_color: config.branding.secondaryColor,
          is_multi_year: config.isMultiYear || false,
          report_years: config.reportYears || [config.reportYear],
          report_framing_statement: config.reportFramingStatement || null,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(`Failed to create report record: ${insertError.message}`);
      }

      if (!reportRecord) {
        throw new Error('Failed to create report record: No data returned');
      }

      if (config.outputFormat === 'pdf') {
        // PDF: call the API route directly. The route uploads the PDF to Supabase
        // Storage and updates generated_reports.document_url — the frontend progress
        // hook will pick up the completion + URL via polling, so we don't need to
        // download here.
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        fetch(`/api/reports/${reportRecord.id}/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        }).then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'PDF generation failed');
          }
          // Success — document_url is already set by the API route, the progress
          // hook will pick it up on its next poll and flip the UI to the download state.
        }).catch(async (err) => {
          console.error('PDF generation failed:', err);
          await supabase
            .from('generated_reports')
            .update({
              status: 'failed',
              error_message: err?.message || 'PDF generation failed',
            })
            .eq('id', reportRecord.id);
        });
      } else if (config.outputFormat === 'html') {
        // HTML: call the generate-html API route, open result in a new tab
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        fetch(`/api/reports/${reportRecord.id}/generate-html`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }).then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'HTML generation failed');
          }
          const htmlContent = await response.text();
          const blob = new Blob([htmlContent], { type: 'text/html' });
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          // Revoke after a short delay to allow the new tab to load
          setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        }).catch(async (err) => {
          console.error('HTML generation failed:', err);
          await supabase
            .from('generated_reports')
            .update({
              status: 'failed',
              error_message: err?.message || 'HTML generation failed',
            })
            .eq('id', reportRecord.id);
        });
      }

      // Auto-save defaults after generation
      saveDefaults(organizationId, config).catch(() => {});

      return {
        success: true,
        report_id: reportRecord.id,
      };
    } catch (error) {
      console.error('Report generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    generateReport,
    saveDefaults,
    loadDefaults,
    loading,
  };
}
