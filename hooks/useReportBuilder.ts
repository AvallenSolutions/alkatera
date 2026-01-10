import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
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
  const { currentOrganization } = useOrganization();

  const generateReport = async (config: ReportConfig): Promise<GenerateReportResponse> => {
    setLoading(true);

    try {
      // 1. Get current user and organization
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Use organization from context instead of querying profiles
      if (!currentOrganization) {
        throw new Error('No active organization found');
      }

      const organizationId = currentOrganization.id;

      // 2. Create report record in database
      console.log('🔵 Creating report record with:', {
        organization_id: organizationId,
        created_by: user.id,
        report_name: config.reportName,
        report_year: config.reportYear,
      });

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
        console.error('❌ Insert error details:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        });
        throw new Error(`Failed to create report record: ${insertError.message}`);
      }

      if (!reportRecord) {
        console.error('❌ No report record returned after insert');
        throw new Error('Failed to create report record: No data returned');
      }

      console.log('✅ Report record created:', reportRecord.id);

      // 3. Get session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // 4. Call edge function using direct fetch (bypass supabase.functions.invoke)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/generate-sustainability-report`;

      console.log('🔵 Calling edge function at:', functionUrl);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          report_config_id: reportRecord.id,
        }),
      });

      console.log('📡 Edge function response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Edge function error response:', errorText);

        // Update report status to failed
        await supabase
          .from('generated_reports')
          .update({
            status: 'failed',
            error_message: `HTTP ${response.status}: ${errorText}`,
          })
          .eq('id', reportRecord.id);

        throw new Error(`Edge function failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Edge function result:', result);

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
