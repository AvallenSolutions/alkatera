import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';

interface GenerateReportResponse {
  success: boolean;
  report_id?: string;
  document_url?: string;
  error?: string;
}

export function useReportBuilder() {
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const generateReport = async (config: ReportConfig): Promise<GenerateReportResponse> => {
    setLoading(true);

    try {
      // 1. Get current user and organization
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.active_organization_id) {
        throw new Error('No active organization found');
      }

      // 2. Create report record in database
      const { data: reportRecord, error: insertError } = await supabase
        .from('generated_reports')
        .insert({
          organization_id: profile.active_organization_id,
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
          status: 'pending',
        })
        .select()
        .single();

      if (insertError || !reportRecord) {
        console.error('Insert error:', insertError);
        throw new Error('Failed to create report record');
      }

      // 3. Call edge function to generate report
      const { data: result, error: functionError } = await supabase.functions.invoke(
        'generate-sustainability-report',
        {
          body: {
            report_config_id: reportRecord.id,
          },
        }
      );

      if (functionError) {
        console.error('Function error:', functionError);

        // Update report status to failed
        await supabase
          .from('generated_reports')
          .update({
            status: 'failed',
            error_message: functionError.message,
          })
          .eq('id', reportRecord.id);

        throw new Error(functionError.message || 'Failed to generate report');
      }

      if (!result.success) {
        throw new Error(result.error || 'Report generation failed');
      }

      return {
        success: true,
        report_id: result.report_id,
        document_url: result.document_url,
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
    loading,
  };
}
