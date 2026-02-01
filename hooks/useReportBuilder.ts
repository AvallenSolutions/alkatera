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
      };
    }
    if (defaults.audience) {
      partial.audience = defaults.audience;
    }
    if (defaults.standards && defaults.standards.length > 0) {
      partial.standards = defaults.standards;
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

      // Return reportId immediately for progress tracking
      // Edge function runs async — progress updates via Realtime
      supabase.functions.invoke('generate-sustainability-report', {
        body: { report_config_id: reportRecord.id },
      }).then(async ({ data, error: functionError }) => {
        if (functionError) {
          console.error('Edge function error:', functionError);
          await supabase
            .from('generated_reports')
            .update({
              status: 'failed',
              error_message: functionError.message || 'Unknown error',
            })
            .eq('id', reportRecord.id);
        }
      }).catch(async (err) => {
        console.error('Edge function call failed:', err);
        await supabase
          .from('generated_reports')
          .update({
            status: 'failed',
            error_message: err?.message || 'Edge function invocation failed',
          })
          .eq('id', reportRecord.id);
      });

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
