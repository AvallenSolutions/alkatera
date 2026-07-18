import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import type { BrandImage, BrandKit, ReportConfig, ReportDefaults } from '@/types/report-builder';

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
      const heroImages: string[] | undefined = (defaults.branding as any).heroImages ?? undefined;
      // Map legacy positional heroImages onto the named slots once at load,
      // so the funnel only ever thinks in slots. The stored defaults are not
      // rewritten; new saves write `images` and never touch `heroImages`.
      const images = defaults.branding.images ?? (heroImages?.length
        ? {
            ...(heroImages[0] ? { cover: heroImages[0] } : {}),
            ...(heroImages[1] ? { divider1: heroImages[1] } : {}),
            ...(heroImages[2] ? { divider2: heroImages[2] } : {}),
          }
        : undefined);
      partial.branding = {
        logo: defaults.branding.logo ?? null,
        primaryColor: defaults.branding.primaryColor ?? '#2563eb',
        secondaryColor: defaults.branding.secondaryColor ?? '#10b981',
        images: images && Object.keys(images).length > 0 ? images : undefined,
        leadership: (defaults.branding as any).leadership ?? undefined,
      };
    }
    if (defaults.audience) {
      partial.audience = defaults.audience;
    }
    if (defaults.style) {
      partial.style = defaults.style;
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
      // The leadership MESSAGE is per-report (drafted and accepted in the
      // funnel); only the author's name/title/photo persist as defaults.
      const { message: _dropMessage, ...leadershipDefaults } = config.branding.leadership ?? {};
      const defaults: ReportDefaults = {
        branding: {
          ...config.branding,
          leadership: Object.keys(leadershipDefaults).length > 0 ? leadershipDefaults : undefined,
        },
        audience: config.audience,
        standards: config.standards,
        style: config.style,
        template: config.template,
        orientation: config.orientation,
      };

      // report_defaults is a shared jsonb column (hospitality also keeps
      // band thresholds and marketplace flags on it), so merge rather than
      // overwrite.
      const { data: existingRow } = await supabase
        .from('organizations')
        .select('report_defaults')
        .eq('id', orgId)
        .maybeSingle();
      const existing = (existingRow?.report_defaults as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('organizations')
        .update({ report_defaults: { ...existing, ...defaults } })
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

  /** Bearer token for the report API routes. */
  const getAccessToken = async (): Promise<string> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Not authenticated');
    return token;
  };

  /** The org's reusable image library (report_defaults.imageLibrary). */
  const loadImageLibrary = (org: any): BrandImage[] => {
    const library = org?.report_defaults?.imageLibrary;
    if (!Array.isArray(library)) return [];
    return library.filter((i: any): i is BrandImage => typeof i?.url === 'string' && i.url);
  };

  /**
   * Save the brand kit: merge-write touching ONLY the branding and
   * imageLibrary keys (report_defaults is shared with hospitality and
   * reporting-period settings). Branding itself is key-merged over the
   * existing branding.
   */
  const saveBrandKit = async (orgId: string, kit: BrandKit): Promise<boolean> => {
    try {
      const { data: existingRow } = await supabase
        .from('organizations')
        .select('report_defaults')
        .eq('id', orgId)
        .maybeSingle();
      const existing = (existingRow?.report_defaults as Record<string, any>) || {};

      const merged: Record<string, any> = { ...existing };
      if (kit.branding) merged.branding = { ...(existing.branding ?? {}), ...kit.branding };
      if (kit.imageLibrary) merged.imageLibrary = kit.imageLibrary;

      const { error } = await supabase
        .from('organizations')
        .update({ report_defaults: merged })
        .eq('id', orgId);
      if (error) {
        console.error('Failed to save brand kit:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Save brand kit error:', error);
      return false;
    }
  };

  /** Append one image to the org library (read-merge-append). */
  const addToImageLibrary = async (orgId: string, image: BrandImage): Promise<boolean> => {
    try {
      const { data: existingRow } = await supabase
        .from('organizations')
        .select('report_defaults')
        .eq('id', orgId)
        .maybeSingle();
      const existing = (existingRow?.report_defaults as Record<string, any>) || {};
      const library: BrandImage[] = Array.isArray(existing.imageLibrary) ? existing.imageLibrary : [];
      if (library.some(i => i?.url === image.url)) return true;

      const { error } = await supabase
        .from('organizations')
        .update({ report_defaults: { ...existing, imageLibrary: [...library, image] } })
        .eq('id', orgId);
      if (error) {
        console.error('Failed to add to image library:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Add to image library error:', error);
      return false;
    }
  };

  /**
   * Phase C step 1: create the report row as a DRAFT. No generation is
   * dispatched; the narratives draft next and the user reviews them before
   * shipping.
   */
  const createDraftReport = async (config: ReportConfig): Promise<GenerateReportResponse> => {
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

      // Create report record as a draft
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
          status: 'draft',
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

      // Save defaults so the next report starts here
      saveDefaults(organizationId, config).catch(() => {});

      return { success: true, report_id: reportRecord.id };
    } catch (error) {
      console.error('Report draft error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    } finally {
      setLoading(false);
    }
  };

  /** Phase C step 2: draft every narrative block into the report's snapshot. */
  const draftNarratives = async (
    reportId: string,
    opts: { toneOverride?: string | null; force?: boolean } = {}
  ): Promise<any> => {
    const token = await getAccessToken();
    const response = await fetch(`/api/reports/${reportId}/narratives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(opts),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to draft the narratives');
    }
    const { snapshot } = await response.json();
    return snapshot;
  };

  /** Persist review edits; the server flips the aiGenerated flags. */
  const patchNarratives = async (reportId: string, patch: Record<string, any>): Promise<any> => {
    const token = await getAccessToken();
    const response = await fetch(`/api/reports/${reportId}/narratives`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save the edits');
    }
    const { snapshot } = await response.json();
    return snapshot;
  };

  /** Regenerate one block, optionally steered by a free-text tone hint. */
  const regenerateBlock = async (
    reportId: string,
    blockId: string,
    toneHint?: string
  ): Promise<any> => {
    const token = await getAccessToken();
    const response = await fetch(`/api/reports/${reportId}/narratives/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ blockId, toneHint }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to regenerate the block');
    }
    const { snapshot } = await response.json();
    return snapshot;
  };

  /**
   * Phase C step 3: ship the reviewed report. Dispatches the existing PDF
   * (Inngest) or HTML (sync) pipeline; both consume the stored narratives.
   */
  const shipReport = async (reportId: string, config: ReportConfig): Promise<void> => {
    const accessToken = await getAccessToken();

    if (config.outputFormat === 'pdf') {
      // PDF: the route uploads to Storage and updates document_url — the
      // progress hook picks up completion via polling.
      fetch(`/api/reports/${reportId}/generate-pdf`, {
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
      }).catch(async (err) => {
        console.error('PDF generation failed:', err);
        await supabase
          .from('generated_reports')
          .update({
            status: 'failed',
            error_message: err?.message || 'PDF generation failed',
          })
          .eq('id', reportId);
      });
    } else if (config.outputFormat === 'html') {
      // HTML: call the generate-html API route, open result in a new tab
      fetch(`/api/reports/${reportId}/generate-html`, {
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
          .eq('id', reportId);
      });
    }
  };

  return {
    createDraftReport,
    draftNarratives,
    patchNarratives,
    regenerateBlock,
    shipReport,
    saveDefaults,
    loadDefaults,
    loadImageLibrary,
    saveBrandKit,
    addToImageLibrary,
    getAccessToken,
    loading,
  };
}
