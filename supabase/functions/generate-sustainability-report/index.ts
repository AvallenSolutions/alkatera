import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  createSlideSpeakClient,
  type SlideSpeakResult,
} from '../_shared/slidespeak-client.ts';
import {
  buildReportContent,
  buildCustomInstructions,
  calculateSlideCount,
  type ReportData,
  type ReportConfig,
} from '../_shared/report-content-builder.ts';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Store report_config_id in outer scope for error handling
  let report_config_id: string | undefined;

  try {
    console.log('[Sustainability Report] Starting report generation...');

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[Auth] Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[Auth] User authentication failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Auth] User authenticated:', user.id);

    // Create a service role client for DB writes (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 2. Parse request
    const body = await req.json();
    report_config_id = body.report_config_id;

    if (!report_config_id) {
      console.error('[Request] Missing report_config_id');
      return new Response(JSON.stringify({ error: 'Missing report_config_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Config] Fetching report configuration:', report_config_id);

    // 3. Fetch report configuration
    const { data: reportConfig, error: configError } = await supabaseClient
      .from('generated_reports')
      .select('*')
      .eq('id', report_config_id)
      .single();

    if (configError) {
      console.error('[Config] Error fetching report configuration:', configError);
      return new Response(JSON.stringify({
        error: 'Report configuration not found',
        details: configError.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!reportConfig) {
      console.error('[Config] Report configuration not found');
      return new Response(JSON.stringify({ error: 'Report configuration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate output format - only PPTX supported
    if (reportConfig.output_format !== 'pptx') {
      console.error('[Config] Unsupported output format:', reportConfig.output_format);
      return new Response(JSON.stringify({
        error: 'Only PowerPoint (pptx) format is currently supported',
        details: `Requested format: ${reportConfig.output_format}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Config] Report configuration loaded:', {
      org: reportConfig.organization_id,
      year: reportConfig.report_year,
      format: reportConfig.output_format,
    });

    // 4. Update status to 'aggregating_data'
    console.log('[Status] Updating status to aggregating_data...');
    await serviceClient
      .from('generated_reports')
      .update({ status: 'aggregating_data' })
      .eq('id', report_config_id);

    // 5. Aggregate data with multi-year support
    console.log('[Data] Aggregating report data...');
    const aggregatedData = await aggregateReportData(
      supabaseClient,
      reportConfig.organization_id,
      reportConfig.report_year,
      reportConfig.sections,
      reportConfig.is_multi_year,
      reportConfig.report_years
    );

    console.log('[Data] Data aggregation complete:', {
      hasOrg: !!aggregatedData.organization,
      hasEmissions: !!aggregatedData.emissions?.total,
      productCount: aggregatedData.products?.length || 0,
    });

    // 6. Update status to 'building_content'
    await serviceClient
      .from('generated_reports')
      .update({ status: 'building_content' })
      .eq('id', report_config_id);

    // 6. Build structured content (DETERMINISTIC - no LLM interpretation)
    console.log('[Content] Building structured report content...');

    const config: ReportConfig = {
      reportName: reportConfig.report_name,
      reportYear: reportConfig.report_year,
      reportingPeriodStart: reportConfig.reporting_period_start,
      reportingPeriodEnd: reportConfig.reporting_period_end,
      audience: reportConfig.audience,
      standards: reportConfig.standards || [],
      sections: reportConfig.sections || ['executive-summary'],
      isMultiYear: reportConfig.is_multi_year,
      reportYears: reportConfig.report_years,
      branding: {
        logo: reportConfig.logo_url,
        primaryColor: reportConfig.primary_color || '#2563eb',
        secondaryColor: reportConfig.secondary_color || '#10b981',
      },
    };

    const structuredContent = buildReportContent(config, aggregatedData);
    const customInstructions = buildCustomInstructions(config);
    const slideCount = calculateSlideCount(config.sections);

    console.log('[Content] Structured content built:', {
      contentLength: structuredContent.length,
      slideCount,
    });

    // 7. Update status to 'generating_document'
    await serviceClient
      .from('generated_reports')
      .update({ status: 'generating_document' })
      .eq('id', report_config_id);

    // 7. Call SlideSpeak API
    const slideSpeakClient = createSlideSpeakClient();

    if (!slideSpeakClient) {
      console.warn('[SlideSpeak] API key not configured, using mock response');

      // Return mock data for testing without SlideSpeak
      const mockDocumentUrl = 'https://example.com/mock-sustainability-report.pptx';

      await serviceClient
        .from('generated_reports')
        .update({
          status: 'completed',
          document_url: mockDocumentUrl,
          generated_at: new Date().toISOString(),
        })
        .eq('id', report_config_id);

      return new Response(
        JSON.stringify({
          success: true,
          report_id: report_config_id,
          document_url: mockDocumentUrl,
          note: 'Using mock data - SlideSpeak API key not configured. Set SLIDESPEAK_API_KEY environment variable.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[SlideSpeak] Generating presentation...');

    // Get branded template if organization has one
    let templateId = 'default';
    const { data: orgData } = await supabaseClient
      .from('organizations')
      .select('slidespeak_template_id')
      .eq('id', reportConfig.organization_id)
      .single();

    if (orgData?.slidespeak_template_id) {
      templateId = orgData.slidespeak_template_id;
      console.log('[SlideSpeak] Using branded template:', templateId);
    }

    const slideSpeakResult = await slideSpeakClient.generateAndWait({
      content: structuredContent,
      slideCount,
      template: templateId,
      customInstructions,
    });

    if (!slideSpeakResult.success) {
      console.error('[SlideSpeak] Generation failed:', slideSpeakResult.error);
      throw new Error(`SlideSpeak API error: ${slideSpeakResult.error}`);
    }

    const documentUrl = slideSpeakResult.downloadUrl;
    if (!documentUrl) {
      console.error('[SlideSpeak] No download URL received');
      throw new Error('No download URL received from SlideSpeak');
    }

    console.log('[SlideSpeak] Generation complete, download URL:', documentUrl);

    // 8. Update report with success (using service role to bypass RLS)
    const { error: updateError } = await serviceClient
      .from('generated_reports')
      .update({
        status: 'completed',
        document_url: documentUrl,
        generated_at: new Date().toISOString(),
      })
      .eq('id', report_config_id);

    if (updateError) {
      console.error('[DB] Failed to update report status to completed:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report_config_id,
        document_url: documentUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Error] Report generation error:', error);

    // Try to update report status to failed
    if (report_config_id) {
      try {
        const errorServiceClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        await errorServiceClient
          .from('generated_reports')
          .update({
            status: 'failed',
            error_message: (error as Error).message,
          })
          .eq('id', report_config_id);
      } catch (updateError) {
        console.error('[Error] Failed to update report status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'An error occurred while generating the report',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Data aggregation function with multi-year support
async function aggregateReportData(
  supabaseClient: ReturnType<typeof createClient>,
  organizationId: string,
  reportYear: number,
  sections: string[],
  isMultiYear?: boolean,
  reportYears?: number[]
): Promise<ReportData> {
  const data: ReportData = {
    organization: { name: '' },
    emissions: { scope1: 0, scope2: 0, scope3: 0, total: 0, year: reportYear },
    emissionsTrends: [],
    products: [],
    facilities: [],
    suppliers: [],
    dataAvailability: {
      hasOrganization: false,
      hasEmissions: false,
      hasProducts: false,
      hasFacilities: false,
      hasSuppliers: false,
    },
  };

  try {
    console.log('[Data] Fetching organization info...');
    // Fetch organization info
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('name, industry_sector, description')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      console.error('[Data] Error fetching organization:', orgError.message);
    } else if (org) {
      data.organization = org;
      data.dataAvailability.hasOrganization = true;
      console.log('[Data] Organization loaded:', org.name);
    }
  } catch (error) {
    console.error('[Data] Exception fetching organization:', error);
  }

  // Fetch emissions data if section is included
  if (sections.includes('scope-1-2-3')) {
    try {
      console.log('[Data] Fetching emissions data for year:', reportYear);
      // Query corporate reports for the year
      const { data: corporateReport, error: reportError } = await supabaseClient
        .from('corporate_reports')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('year', reportYear)
        .maybeSingle();

      if (reportError) {
        console.log('[Data] Corporate reports query error:', reportError.message);
      } else if (corporateReport) {
        data.emissions = {
          scope1: corporateReport.breakdown_json?.scope1 || 0,
          scope2: corporateReport.breakdown_json?.scope2 || 0,
          scope3: corporateReport.breakdown_json?.scope3 || 0,
          total: corporateReport.total_emissions || 0,
          year: reportYear,
        };
        data.dataAvailability.hasEmissions = true;
        console.log('[Data] Emissions loaded:', data.emissions.total, 'tCO2e');
      } else {
        console.log('[Data] No corporate report for year:', reportYear, '- calculating from activity data...');

        // Fallback: calculate emissions from facility_activity_entries
        const { data: activityData, error: activityError } = await supabaseClient
          .from('facility_activity_entries')
          .select('calculated_emissions_kg_co2e, activity_category')
          .eq('organization_id', organizationId);

        if (!activityError && activityData && activityData.length > 0) {
          let totalKg = 0;
          for (const entry of activityData) {
            totalKg += entry.calculated_emissions_kg_co2e || 0;
          }
          const totalTonnes = totalKg / 1000;
          data.emissions = {
            scope1: 0, // Can't split by scope without more data
            scope2: 0,
            scope3: 0,
            total: totalTonnes,
            year: reportYear,
          };
          data.dataAvailability.hasEmissions = totalTonnes > 0;
          console.log('[Data] Emissions calculated from activity entries:', totalTonnes, 'tCO2e');
        }

        // Also try to get Scope 3 from product LCAs
        const { data: productEmissions } = await supabaseClient
          .from('product_carbon_footprints')
          .select('total_ghg_emissions')
          .eq('organization_id', organizationId)
          .eq('status', 'completed');

        if (productEmissions && productEmissions.length > 0) {
          let scope3Total = 0;
          for (const p of productEmissions) {
            scope3Total += p.total_ghg_emissions || 0;
          }
          if (scope3Total > 0) {
            data.emissions.scope3 = scope3Total;
            data.emissions.total += scope3Total;
            data.dataAvailability.hasEmissions = true;
            console.log('[Data] Scope 3 from products:', scope3Total, 'kg CO2e');
          }
        }
      }

      // Fetch multi-year data if enabled
      if (isMultiYear && reportYears && reportYears.length > 1) {
        console.log('[Data] Fetching multi-year trends for years:', reportYears);
        const { data: historicalReports, error: histError } = await supabaseClient
          .from('corporate_reports')
          .select('year, total_emissions, breakdown_json')
          .eq('organization_id', organizationId)
          .in('year', reportYears)
          .order('year', { ascending: true });

        if (histError) {
          console.log('[Data] Multi-year query error:', histError.message);
        } else if (historicalReports && historicalReports.length > 0) {
          data.emissionsTrends = historicalReports.map((r: { year: number; total_emissions: number; breakdown_json?: { scope1?: number; scope2?: number; scope3?: number } }) => ({
            year: r.year,
            scope1: r.breakdown_json?.scope1 || 0,
            scope2: r.breakdown_json?.scope2 || 0,
            scope3: r.breakdown_json?.scope3 || 0,
            total: r.total_emissions || 0,
          }));

          // Calculate year-over-year changes
          if (data.emissionsTrends.length > 1) {
            for (let i = 1; i < data.emissionsTrends.length; i++) {
              const current = data.emissionsTrends[i];
              const previous = data.emissionsTrends[i - 1];
              current.yoyChange = previous.total > 0
                ? ((current.total - previous.total) / previous.total * 100).toFixed(2)
                : 'N/A';
            }
          }
          console.log('[Data] Multi-year trends loaded:', data.emissionsTrends.length, 'years');
        }
      }
    } catch (error) {
      console.error('[Data] Exception fetching emissions:', error);
    }
  }

  // Fetch product data if section is included
  if (sections.includes('product-footprints')) {
    try {
      console.log('[Data] Fetching product LCA data...');
      const { data: products, error: productsError } = await supabaseClient
        .from('product_carbon_footprints')
        .select('product_name, functional_unit, total_ghg_emissions, aggregated_impacts, reference_year')
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (productsError) {
        console.log('[Data] Product LCAs query error:', productsError.message);
      } else if (products && products.length > 0) {
        // Deduplicate: keep only the latest LCA per product name
        const seenProducts = new Map<string, typeof products[0]>();
        for (const p of products) {
          if (!seenProducts.has(p.product_name)) {
            seenProducts.set(p.product_name, p);
          }
        }
        data.products = Array.from(seenProducts.values()).map((p: any) => ({
          name: p.product_name,
          functionalUnit: p.functional_unit,
          // Use total_ghg_emissions first (direct LCA result), fall back to aggregated_impacts
          climateImpact: p.total_ghg_emissions || p.aggregated_impacts?.climate_change || 0,
          referenceYear: p.reference_year,
        }));
        data.dataAvailability.hasProducts = true;
        console.log('[Data] Products loaded (deduplicated):', data.products.length);
      } else {
        console.log('[Data] No completed product LCAs found');
      }
    } catch (error) {
      console.error('[Data] Exception fetching products:', error);
    }
  }

  // Fetch facilities data if section is included
  if (sections.includes('facilities')) {
    try {
      console.log('[Data] Fetching facilities data...');
      // Fetch facilities with their basic info
      const { data: facilities, error: facilitiesError } = await supabaseClient
        .from('facilities')
        .select('id, name, location, functions, operational_control, address_city, address_country')
        .eq('organization_id', organizationId)
        .limit(50);

      if (facilitiesError) {
        console.log('[Data] Facilities query error:', facilitiesError.message);
      } else if (facilities && facilities.length > 0) {
        // Fetch emissions for each facility from facility_activity_entries
        const facilityIds = facilities.map((f: any) => f.id);
        const { data: activityEntries, error: activityError } = await supabaseClient
          .from('facility_activity_entries')
          .select('facility_id, activity_category, calculated_emissions_kg_co2e')
          .in('facility_id', facilityIds);

        // Sum emissions per facility
        const emissionsByFacility = new Map<string, number>();
        if (!activityError && activityEntries) {
          for (const entry of activityEntries) {
            const current = emissionsByFacility.get(entry.facility_id) || 0;
            emissionsByFacility.set(entry.facility_id, current + (entry.calculated_emissions_kg_co2e || 0));
          }
        }

        data.facilities = facilities.map((f: any) => ({
          name: f.name,
          type: f.functions?.join(', ') || f.operational_control || 'Facility',
          location: f.address_city && f.address_country
            ? `${f.address_city}, ${f.address_country}`
            : f.location || 'Unknown',
          totalEmissions: (emissionsByFacility.get(f.id) || 0) / 1000, // Convert kg to tonnes
        }));
        data.dataAvailability.hasFacilities = true;
        console.log('[Data] Facilities loaded with emissions:', data.facilities.length);
      }
    } catch (error) {
      console.error('[Data] Exception fetching facilities:', error);
    }
  }

  // Fetch suppliers data if section is included
  if (sections.includes('supply-chain')) {
    try {
      console.log('[Data] Fetching suppliers data...');
      const { data: suppliers, error: suppliersError } = await supabaseClient
        .from('suppliers')
        .select('name, industry_sector, country, annual_spend, spend_currency')
        .eq('organization_id', organizationId)
        .limit(50);

      if (suppliersError) {
        console.log('[Data] Suppliers query error:', suppliersError.message);
      } else if (suppliers && suppliers.length > 0) {
        data.suppliers = suppliers.map((s: any) => ({
          name: s.name,
          category: s.industry_sector || 'Uncategorized',
          country: s.country || 'Unknown',
          annualSpend: s.annual_spend || 0,
          spendCurrency: s.spend_currency || 'GBP',
        }));
        data.dataAvailability.hasSuppliers = true;
        console.log('[Data] Suppliers loaded:', data.suppliers.length);
      }
    } catch (error) {
      console.error('[Data] Exception fetching suppliers:', error);
    }
  }

  console.log('[Data] Data availability summary:', data.dataAvailability);
  return data;
}
