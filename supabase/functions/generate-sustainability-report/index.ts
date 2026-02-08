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
    // 4. Update status to 'aggregating_data'
    await serviceClient
      .from('generated_reports')
      .update({ status: 'aggregating_data' })
      .eq('id', report_config_id);

    // 5. Aggregate data with multi-year support
    const aggregatedData = await aggregateReportData(
      supabaseClient,
      reportConfig.organization_id,
      reportConfig.report_year,
      reportConfig.sections,
      reportConfig.is_multi_year,
      reportConfig.report_years
    );
    // 6. Update status to 'building_content'
    await serviceClient
      .from('generated_reports')
      .update({ status: 'building_content' })
      .eq('id', report_config_id);

    // 6. Build structured content (DETERMINISTIC - no LLM interpretation)
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
    // Get branded template if organization has one
    let templateId = 'default';
    const { data: orgData } = await supabaseClient
      .from('organizations')
      .select('slidespeak_template_id')
      .eq('id', reportConfig.organization_id)
      .single();

    if (orgData?.slidespeak_template_id) {
      templateId = orgData.slidespeak_template_id;
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
    standards: [],
    dataAvailability: {
      hasOrganization: false,
      hasEmissions: false,
      hasProducts: false,
      hasFacilities: false,
      hasSuppliers: false,
    },
  };

  try {
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
    }
  } catch (error) {
    console.error('[Data] Exception fetching organization:', error);
  }

  // Fetch emissions data if section is included
  if (sections.includes('scope-1-2-3')) {
    try {
      const yearStart = `${reportYear}-01-01`;
      const yearEnd = `${reportYear}-12-31`;

      // First try corporate_reports table
      const { data: corporateReport } = await supabaseClient
        .from('corporate_reports')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('year', reportYear)
        .maybeSingle();

      if (corporateReport && corporateReport.total_emissions > 0) {
        data.emissions = {
          scope1: corporateReport.breakdown_json?.scope1 || 0,
          scope2: corporateReport.breakdown_json?.scope2 || 0,
          scope3: corporateReport.breakdown_json?.scope3 || 0,
          total: corporateReport.total_emissions || 0,
          year: reportYear,
        };
        data.dataAvailability.hasEmissions = true;
      } else {
        // Fallback: Calculate from utility_data_entries + fleet + overheads (same as dashboard)
        // Emission factors matching corporate-emissions.ts
        const UTILITY_FACTORS: Record<string, { factor: number; scope: string }> = {
          diesel_stationary: { factor: 2.68787, scope: 'Scope 1' },
          diesel_mobile: { factor: 2.68787, scope: 'Scope 1' },
          petrol_mobile: { factor: 2.31, scope: 'Scope 1' },
          natural_gas: { factor: 0.18293, scope: 'Scope 1' },
          lpg: { factor: 1.55537, scope: 'Scope 1' },
          heavy_fuel_oil: { factor: 3.17740, scope: 'Scope 1' },
          biomass_solid: { factor: 0.01551, scope: 'Scope 1' },
          refrigerant_leakage: { factor: 1430, scope: 'Scope 1' },
          electricity_grid: { factor: 0.207, scope: 'Scope 2' },
          heat_steam_purchased: { factor: 0.1662, scope: 'Scope 2' },
        };

        // Get all facilities
        const { data: facilities } = await supabaseClient
          .from('facilities')
          .select('id, name')
          .eq('organization_id', organizationId);

        const facilityIds = facilities?.map((f: any) => f.id) || [];

        let scope1 = 0;
        let scope2 = 0;
        let scope3 = 0;

        // Scope 1 & 2 from utility data
        if (facilityIds.length > 0) {
          const { data: utilityData } = await supabaseClient
            .from('utility_data_entries')
            .select('quantity, unit, utility_type, facility_id')
            .in('facility_id', facilityIds)
            .gte('reporting_period_start', yearStart)
            .lte('reporting_period_end', yearEnd);

          if (utilityData) {
            for (const entry of utilityData) {
              const e = entry as any;
              const emConfig = UTILITY_FACTORS[e.utility_type];
              if (!emConfig) continue;

              let co2e = e.quantity * emConfig.factor;
              if (e.utility_type === 'natural_gas' && e.unit === 'm³') {
                co2e = e.quantity * 10.55 * emConfig.factor;
              }

              if (emConfig.scope === 'Scope 1') scope1 += co2e;
              else scope2 += co2e;
            }
          }
        }

        // Fleet emissions
        const { data: fleetS1 } = await supabaseClient
          .from('fleet_activities')
          .select('emissions_tco2e')
          .eq('organization_id', organizationId)
          .eq('scope', 'Scope 1')
          .gte('reporting_period_start', yearStart)
          .lte('reporting_period_end', yearEnd);
        if (fleetS1) fleetS1.forEach((f: any) => { scope1 += (f.emissions_tco2e || 0) * 1000; });

        const { data: fleetS2 } = await supabaseClient
          .from('fleet_activities')
          .select('emissions_tco2e')
          .eq('organization_id', organizationId)
          .eq('scope', 'Scope 2')
          .gte('reporting_period_start', yearStart)
          .lte('reporting_period_end', yearEnd);
        if (fleetS2) fleetS2.forEach((f: any) => { scope2 += (f.emissions_tco2e || 0) * 1000; });

        // Scope 3 from corporate overheads
        const { data: corpReport } = await supabaseClient
          .from('corporate_reports')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('year', reportYear)
          .maybeSingle();

        if (corpReport?.id) {
          const { data: overheads } = await supabaseClient
            .from('corporate_overheads')
            .select('computed_co2e')
            .eq('report_id', corpReport.id);
          if (overheads) overheads.forEach((o: any) => { scope3 += (o.computed_co2e || 0); });
        }

        // Scope 3 from product LCAs via production logs
        const { data: prodLogs } = await supabaseClient
          .from('production_logs')
          .select('product_id, quantity_produced')
          .eq('organization_id', organizationId)
          .gte('production_date', yearStart)
          .lte('production_date', yearEnd);

        if (prodLogs && prodLogs.length > 0) {
          const productIds = [...new Set(prodLogs.map((p: any) => p.product_id))];
          const { data: pcfs } = await supabaseClient
            .from('product_carbon_footprints')
            .select('product_id, aggregated_impacts')
            .in('product_id', productIds)
            .eq('status', 'completed');

          if (pcfs) {
            const pcfMap = new Map();
            pcfs.forEach((p: any) => pcfMap.set(p.product_id, p));

            for (const log of prodLogs) {
              const l = log as any;
              const pcf = pcfMap.get(l.product_id);
              if (pcf?.aggregated_impacts?.breakdown?.by_scope?.scope3) {
                scope3 += pcf.aggregated_impacts.breakdown.by_scope.scope3 * (l.quantity_produced || 0);
              }
            }
          }
        }

        // Convert from kg to tonnes
        const scope1T = scope1 / 1000;
        const scope2T = scope2 / 1000;
        const scope3T = scope3 / 1000;
        const totalT = scope1T + scope2T + scope3T;

        if (totalT > 0) {
          data.emissions = { scope1: scope1T, scope2: scope2T, scope3: scope3T, total: totalT, year: reportYear };
          data.dataAvailability.hasEmissions = true;
        }
      }

      // Fetch multi-year data if enabled
      if (isMultiYear && reportYears && reportYears.length > 1) {
        const { data: historicalReports, error: histError } = await supabaseClient
          .from('corporate_reports')
          .select('year, total_emissions, breakdown_json')
          .eq('organization_id', organizationId)
          .in('year', reportYears)
          .order('year', { ascending: true });

        if (histError) {
        } else if (historicalReports && historicalReports.length > 0) {
          data.emissionsTrends = historicalReports.map((r: { year: number; total_emissions: number; breakdown_json?: { scope1?: number; scope2?: number; scope3?: number } }) => ({
            year: r.year,
            scope1: r.breakdown_json?.scope1 || 0,
            scope2: r.breakdown_json?.scope2 || 0,
            scope3: r.breakdown_json?.scope3 || 0,
            total: r.total_emissions || 0,
          }));

          if (data.emissionsTrends.length > 1) {
            for (let i = 1; i < data.emissionsTrends.length; i++) {
              const current = data.emissionsTrends[i];
              const previous = data.emissionsTrends[i - 1];
              current.yoyChange = previous.total > 0
                ? ((current.total - previous.total) / previous.total * 100).toFixed(2)
                : 'N/A';
            }
          }
        }
      }
    } catch (error) {
      console.error('[Data] Exception fetching emissions:', error);
    }
  }

  // Fetch facility data
  try {
    const yearStart = `${reportYear}-01-01`;
    const yearEnd = `${reportYear}-12-31`;

    const { data: facilities } = await supabaseClient
      .from('facilities')
      .select('id, name, facility_type, city, country')
      .eq('organization_id', organizationId);

    if (facilities && facilities.length > 0) {
      const facilityIds = facilities.map((f: any) => f.id);

      // Get aggregated emissions per facility
      const { data: facilityEmissions } = await supabaseClient
        .from('facility_emissions_aggregated')
        .select('facility_id, total_co2e, units_produced')
        .in('facility_id', facilityIds)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      // Get utility data per facility for breakdown
      const { data: utilityData } = await supabaseClient
        .from('utility_data_entries')
        .select('facility_id, quantity, utility_type')
        .in('facility_id', facilityIds)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      const emissionsMap = new Map<string, number>();
      const unitsMap = new Map<string, number>();
      const utilityCountMap = new Map<string, number>();

      facilityEmissions?.forEach((fe: any) => {
        emissionsMap.set(fe.facility_id, (emissionsMap.get(fe.facility_id) || 0) + (fe.total_co2e || 0));
        unitsMap.set(fe.facility_id, (unitsMap.get(fe.facility_id) || 0) + (fe.units_produced || 0));
      });

      utilityData?.forEach((ud: any) => {
        utilityCountMap.set(ud.facility_id, (utilityCountMap.get(ud.facility_id) || 0) + 1);
      });

      data.facilities = facilities.map((f: any) => ({
        name: f.name,
        type: f.facility_type || 'Production',
        location: [f.city, f.country].filter(Boolean).join(', ') || 'Not specified',
        totalEmissions: emissionsMap.get(f.id) || 0,
        unitsProduced: unitsMap.get(f.id) || 0,
        hasData: (emissionsMap.get(f.id) || 0) > 0 || (utilityCountMap.get(f.id) || 0) > 0,
      }));
      data.dataAvailability.hasFacilities = facilities.length > 0;
    }
  } catch (error) {
    console.error('[Data] Exception fetching facilities:', error);
  }

  // Fetch product data if section is included
  if (sections.includes('product-footprints')) {
    try {
      const { data: products, error: productsError } = await supabaseClient
        .from('product_carbon_footprints')
        .select('product_name, functional_unit, aggregated_impacts, reference_year')
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (productsError) {
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
          // Single source of truth: aggregated_impacts.climate_change_gwp100
          climateImpact: p.aggregated_impacts?.climate_change_gwp100 || 0,
          referenceYear: p.reference_year,
        }));
        data.dataAvailability.hasProducts = true;
      } else {
      }
    } catch (error) {
      console.error('[Data] Exception fetching products:', error);
    }
  }

  // Fetch suppliers data if section is included
  if (sections.includes('supply-chain')) {
    try {
      const { data: suppliers, error: suppliersError } = await supabaseClient
        .from('suppliers')
        .select('name, industry_sector, country, annual_spend, spend_currency')
        .eq('organization_id', organizationId)
        .limit(50);

      if (suppliersError) {
      } else if (suppliers && suppliers.length > 0) {
        data.suppliers = suppliers.map((s: any) => ({
          name: s.name,
          category: s.industry_sector || 'Uncategorized',
          country: s.country || 'Unknown',
          annualSpend: s.annual_spend || 0,
          spendCurrency: s.spend_currency || 'GBP',
        }));
        data.dataAvailability.hasSuppliers = true;
      }
    } catch (error) {
      console.error('[Data] Exception fetching suppliers:', error);
    }
  }

  // Populate standards compliance status
  if (sections.includes('methodology') || true) {
    data.standards = [];

    // Check if we have emissions data (needed for GHG Protocol, CSRD)
    const hasScope123 = data.dataAvailability.hasEmissions;
    const hasProducts = data.dataAvailability.hasProducts;
    const hasFacilities = data.dataAvailability.hasFacilities;

    // Evaluate each standard based on available data
    if (hasScope123) {
      data.standards.push({ code: 'ghg-protocol', name: 'GHG Protocol Corporate Standard', status: 'Aligned', detail: 'Scope 1, 2 & 3 emissions reported' });
      data.standards.push({ code: 'csrd', name: 'CSRD (ESRS E1)', status: 'Partial', detail: hasProducts ? 'GHG emissions and product footprints reported' : 'GHG emissions reported; product footprints pending' });
    } else {
      data.standards.push({ code: 'ghg-protocol', name: 'GHG Protocol Corporate Standard', status: 'In Progress', detail: 'Emissions data collection underway' });
      data.standards.push({ code: 'csrd', name: 'CSRD (ESRS E1)', status: 'In Progress', detail: 'Data collection in progress' });
    }

    if (hasProducts) {
      data.standards.push({ code: 'iso-14067', name: 'ISO 14067 Carbon Footprint of Products', status: 'Aligned', detail: `${data.products.length} product LCAs completed` });
      data.standards.push({ code: 'iso-14044', name: 'ISO 14044 Life Cycle Assessment', status: 'Aligned', detail: 'LCA methodology applied to product assessments' });
    }

    if (hasFacilities) {
      data.standards.push({ code: 'iso-14064', name: 'ISO 14064-1 GHG Inventories', status: hasScope123 ? 'Aligned' : 'Partial', detail: `${data.facilities.length} facilities reporting` });
    }
  }
  return data;
}
