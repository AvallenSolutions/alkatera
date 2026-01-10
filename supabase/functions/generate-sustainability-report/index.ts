import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

// Skywork tool mapping
const SKYWORK_TOOLS = {
  pptx: 'gen_ppt',
  docx: 'gen_doc',
  xlsx: 'gen_excel',
} as const;

// Skywork Client (inlined for deployment)
async function md5(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface SkyworkResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}

async function callSkyworkAPI(tool: string, query: string, timeoutMs = 180000): Promise<SkyworkResult> {
  const secretId = Deno.env.get('SKYWORK_SECRET_ID');
  const secretKey = Deno.env.get('SKYWORK_SECRET_KEY');

  if (!secretId || !secretKey) {
    return { success: false, error: 'Credentials not configured' };
  }

  const signatureInput = `${secretId}:${secretKey}`;
  const sign = await md5(signatureInput);

  const queryParams = new URLSearchParams({
    secret_id: secretId,
    sign: sign,
    tool,
    query,
    use_network: 'false',
  });

  const sseUrl = `https://api.skywork.ai/open/sse?${queryParams.toString()}`;

  console.log('[Skywork] Establishing SSE connection...');

  try {
    const response = await fetch(sseUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `SSE connection failed: ${response.status} ${errorText}`,
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { success: false, error: 'Failed to get response reader' };
    }

    const decoder = new TextDecoder();
    let documentUrl: string | null = null;
    let isComplete = false;

    const timeoutHandle = setTimeout(() => {
      reader.cancel();
    }, timeoutMs);

    try {
      let buffer = '';

      while (!isComplete) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();

            if (data.startsWith('/open/message')) {
              const url = new URL(data, 'https://api.skywork.ai');
              const sessionId = url.searchParams.get('sessionId');
              console.log('[Skywork] Session established:', sessionId);
              continue;
            }

            try {
              const jsonData = JSON.parse(data);

              if (jsonData.method === 'ping') continue;

              if (jsonData.result?.download_url) {
                documentUrl = jsonData.result.download_url;
                console.log('[Skywork] Document ready:', documentUrl);
                isComplete = true;
                break;
              }

              if (jsonData.error) {
                clearTimeout(timeoutHandle);
                return {
                  success: false,
                  error: `Skywork API error: ${JSON.stringify(jsonData.error)}`,
                };
              }
            } catch {
              // Ignore non-JSON data
            }
          }
        }
      }

      clearTimeout(timeoutHandle);

      if (documentUrl) {
        return { success: true, downloadUrl: documentUrl };
      }

      return { success: false, error: 'No download URL received' };

    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    console.error('[Skywork] Error:', error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔵 [Sustainability Report] Starting report generation...');

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ [Auth] Missing authorization header');
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
      console.error('❌ [Auth] User authentication failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ [Auth] User authenticated:', user.id);

    // 2. Parse request
    const { report_config_id } = await req.json();

    if (!report_config_id) {
      console.error('❌ [Request] Missing report_config_id');
      return new Response(JSON.stringify({ error: 'Missing report_config_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔵 [Config] Fetching report configuration:', report_config_id);

    // 3. Fetch report configuration
    const { data: reportConfig, error: configError } = await supabaseClient
      .from('generated_reports')
      .select('*')
      .eq('id', report_config_id)
      .single();

    if (configError) {
      console.error('❌ [Config] Error fetching report configuration:', configError);
      return new Response(JSON.stringify({
        error: 'Report configuration not found',
        details: configError.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!reportConfig) {
      console.error('❌ [Config] Report configuration not found');
      return new Response(JSON.stringify({ error: 'Report configuration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ [Config] Report configuration loaded:', {
      org: reportConfig.organization_id,
      year: reportConfig.report_year,
      format: reportConfig.output_format,
    });

    // 4. Update status to 'generating'
    console.log('🔵 [Status] Updating status to generating...');
    await supabaseClient
      .from('generated_reports')
      .update({ status: 'generating' })
      .eq('id', report_config_id);

    // 5. Aggregate data with multi-year support
    console.log('🔵 [Data] Aggregating report data...');
    const aggregatedData = await aggregateReportData(
      supabaseClient,
      reportConfig.organization_id,
      reportConfig.report_year,
      reportConfig.sections,
      reportConfig.is_multi_year,
      reportConfig.report_years
    );

    console.log('✅ [Data] Data aggregation complete:', {
      hasOrg: !!aggregatedData.organization,
      hasEmissions: !!aggregatedData.emissions?.total,
      productCount: aggregatedData.products?.length || 0,
    });

    // 6. Construct Skywork query
    console.log('🔵 [Skywork] Constructing query...');
    const skyworkQuery = constructSkyworkQuery(reportConfig, aggregatedData);
    console.log('✅ [Skywork] Query constructed:', skyworkQuery.length, 'characters');

    // 7. Call Skywork API
    const tool = SKYWORK_TOOLS[reportConfig.output_format as keyof typeof SKYWORK_TOOLS] || 'gen_ppt';

    console.log('🔵 [Skywork] Calling API with tool:', tool);
    console.log('🔵 [Skywork] Query length:', skyworkQuery.length);
    console.log('🔵 [Skywork] Query preview:', skyworkQuery.substring(0, 200) + '...');

    // 8. Generate document using Skywork
    const skyworkResult = await callSkyworkAPI(tool, skyworkQuery, 180000);

    if (!skyworkResult.success) {
      if (skyworkResult.error === 'Credentials not configured') {
        console.error('❌ [Skywork] API credentials not configured');

        // Return mock data for testing without Skywork
        const mockDocumentUrl = 'https://example.com/mock-report.pptx';

        await supabaseClient
          .from('generated_reports')
          .update({
            status: 'completed',
            skywork_query: skyworkQuery,
            document_url: mockDocumentUrl,
            data_snapshot: aggregatedData,
            generated_at: new Date().toISOString(),
          })
          .eq('id', report_config_id);

        return new Response(
          JSON.stringify({
            success: true,
            report_id: report_config_id,
            document_url: mockDocumentUrl,
            note: 'Using mock data - Skywork API credentials not configured',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.error('❌ [Skywork] Generation failed:', skyworkResult.error);
      throw new Error(`Skywork API error: ${skyworkResult.error}`);
    }

    const documentUrl = skyworkResult.downloadUrl;
    if (!documentUrl) {
      console.error('❌ [Skywork] No download URL received');
      throw new Error('No download URL received from Skywork');
    }

    console.log('✅ [Skywork] Final document URL:', documentUrl);

    // 9. Update report with success
    await supabaseClient
      .from('generated_reports')
      .update({
        status: 'completed',
        skywork_query: skyworkQuery,
        document_url: documentUrl,
        data_snapshot: aggregatedData,
        generated_at: new Date().toISOString(),
      })
      .eq('id', report_config_id);

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
    console.error('❌ [Error] Report generation error:', error);

    // Try to update report status to failed
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        );

        const body = await req.json();
        const report_config_id = body.report_config_id;
        if (report_config_id) {
          await supabaseClient
            .from('generated_reports')
            .update({
              status: 'failed',
              error_message: error.message,
            })
            .eq('id', report_config_id);
        }
      }
    } catch (updateError) {
      console.error('❌ [Error] Failed to update report status:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred while generating the report',
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
  supabaseClient: any,
  organizationId: string,
  reportYear: number,
  sections: string[],
  isMultiYear?: boolean,
  reportYears?: number[]
): Promise<any> {
  const data: any = {
    organization: {},
    emissions: {},
    emissionsTrends: [],
    products: [],
    dataAvailability: {
      hasOrganization: false,
      hasEmissions: false,
      hasProducts: false,
    },
  };

  try {
    console.log('🔵 [Data] Fetching organization info...');
    // Fetch organization info
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('name, industry_sector, description')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      console.error('❌ [Data] Error fetching organization:', orgError.message);
    } else if (org) {
      data.organization = org;
      data.dataAvailability.hasOrganization = true;
      console.log('✅ [Data] Organization loaded:', org.name);
    }
  } catch (error) {
    console.error('❌ [Data] Exception fetching organization:', error);
  }

  // Fetch emissions data if section is included
  if (sections.includes('scope-1-2-3')) {
    try {
      console.log('🔵 [Data] Fetching emissions data for year:', reportYear);
      // Query corporate reports for the year
      const { data: corporateReport, error: reportError } = await supabaseClient
        .from('corporate_reports')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('year', reportYear)
        .maybeSingle();

      if (reportError) {
        console.log('⚠️ [Data] Corporate reports query error:', reportError.message);
      } else if (corporateReport) {
        data.emissions = {
          scope1: corporateReport.breakdown_json?.scope1 || 0,
          scope2: corporateReport.breakdown_json?.scope2 || 0,
          scope3: corporateReport.breakdown_json?.scope3 || 0,
          total: corporateReport.total_emissions || 0,
          year: reportYear,
        };
        data.dataAvailability.hasEmissions = true;
        console.log('✅ [Data] Emissions loaded:', data.emissions.total, 'tCO2e');
      } else {
        console.log('ℹ️ [Data] No emissions data for year:', reportYear);
      }

      // Fetch multi-year data if enabled
      if (isMultiYear && reportYears && reportYears.length > 1) {
        console.log('🔵 [Data] Fetching multi-year trends for years:', reportYears);
        const { data: historicalReports, error: histError } = await supabaseClient
          .from('corporate_reports')
          .select('year, total_emissions, breakdown_json')
          .eq('organization_id', organizationId)
          .in('year', reportYears)
          .order('year', { ascending: true });

        if (histError) {
          console.log('⚠️ [Data] Multi-year query error:', histError.message);
        } else if (historicalReports && historicalReports.length > 0) {
          data.emissionsTrends = historicalReports.map((r: any) => ({
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
          console.log('✅ [Data] Multi-year trends loaded:', data.emissionsTrends.length, 'years');
        }
      }
    } catch (error) {
      console.error('❌ [Data] Exception fetching emissions:', error);
    }
  }

  // Fetch product data if section is included
  if (sections.includes('product-footprints')) {
    try {
      console.log('🔵 [Data] Fetching product LCA data...');
      const { data: products, error: productsError } = await supabaseClient
        .from('product_lcas')
        .select('product_name, functional_unit, aggregated_impacts')
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .limit(20);

      if (productsError) {
        console.log('⚠️ [Data] Product LCAs query error:', productsError.message);
      } else if (products && products.length > 0) {
        data.products = products.map((p: any) => ({
          name: p.product_name,
          functionalUnit: p.functional_unit,
          climateImpact: p.aggregated_impacts?.climate_change || 0,
        }));
        data.dataAvailability.hasProducts = true;
        console.log('✅ [Data] Products loaded:', data.products.length);
      } else {
        console.log('ℹ️ [Data] No completed product LCAs found');
      }
    } catch (error) {
      console.error('❌ [Data] Exception fetching products:', error);
    }
  }

  console.log('📊 [Data] Data availability summary:', data.dataAvailability);
  return data;
}

// Construct Skywork query with multi-year support
function constructSkyworkQuery(config: any, data: any): string {
  const formatName = config.output_format === 'pptx' ? 'PowerPoint presentation' :
                    config.output_format === 'docx' ? 'Word document' :
                    'Excel workbook';

  const trendSection = data.emissionsTrends && data.emissionsTrends.length > 1 ? `
---
# MULTI-YEAR EMISSIONS TRENDS

${data.emissionsTrends.map((trend: any) => `
## Year ${trend.year}
- **Total Emissions:** ${trend.total.toFixed(2)} tCO2e
- **Scope 1:** ${trend.scope1.toFixed(2)} tCO2e
- **Scope 2:** ${trend.scope2.toFixed(2)} tCO2e
- **Scope 3:** ${trend.scope3.toFixed(2)} tCO2e
${trend.yoyChange ? `- **Year-over-Year Change:** ${trend.yoyChange}%` : ''}
`).join('\n')}

**Key Insights:**
- Analyze trends showing improvement or areas requiring attention
- Highlight progress toward reduction targets
- Show trajectory and momentum
` : '';

  return `
Generate a professional sustainability report ${formatName} for ${data.organization.name} for the year ${config.report_year}.

**CRITICAL INSTRUCTIONS:**
1. Use ONLY the data provided below. Do NOT generate, estimate, or create any figures.
2. If data is missing, explicitly state "Data not available for this period."
3. Format the report for: ${config.audience}
4. Ensure compliance with: ${config.standards.join(', ')}
5. Use company branding: Primary Color: ${config.primary_color}, Secondary Color: ${config.secondary_color}
${config.is_multi_year ? '6. Include multi-year trend analysis with year-over-year comparisons' : ''}

---
# ORGANIZATION INFORMATION

- **Company Name:** ${data.organization.name || 'N/A'}
- **Industry:** ${data.organization.industry_sector || 'N/A'}
- **Reporting Period:** ${config.reporting_period_start} to ${config.reporting_period_end}
${config.is_multi_year && config.report_years ? `- **Years Covered:** ${config.report_years.join(', ')}` : ''}

---
# GREENHOUSE GAS EMISSIONS SUMMARY (${config.report_year})

${data.emissions.total ? `
## Total Emissions: ${data.emissions.total.toFixed(2)} tCO2e

### Scope 1 Emissions: ${data.emissions.scope1?.toFixed(2) || '0.00'} tCO2e
Direct emissions from owned or controlled sources.

### Scope 2 Emissions: ${data.emissions.scope2?.toFixed(2) || '0.00'} tCO2e
Indirect emissions from purchased energy.

### Scope 3 Emissions: ${data.emissions.scope3?.toFixed(2) || '0.00'} tCO2e
All other indirect emissions in the value chain.
` : 'Emissions data not available for this period.'}

${trendSection}

---
# PRODUCT CARBON FOOTPRINTS

${data.products.length > 0 ? data.products.map((p: any) => `
## ${p.name}
- **Functional Unit:** ${p.functionalUnit}
- **Climate Impact:** ${p.climateImpact.toFixed(4)} kg CO2e per unit
`).join('\n') : 'Product data not available for this period.'}

---
# REPORT SECTIONS TO INCLUDE

${config.sections.map((s: string) => `- ${s}`).join('\n')}

---
# FORMATTING REQUIREMENTS

- Document Type: ${formatName}
- Audience: ${config.audience}
- Include professional charts and visualizations where appropriate
${config.is_multi_year ? '- Include trend charts showing multi-year progress' : ''}
- Use executive summary format
- Apply company branding colors

Generate the complete sustainability report now.
`.trim();
}
