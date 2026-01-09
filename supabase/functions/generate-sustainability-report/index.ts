import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

// Skywork tool mapping
const SKYWORK_TOOLS = {
  pptx: 'gen_ppt',
  docx: 'gen_doc',
  xlsx: 'gen_excel',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse request
    const { report_config_id } = await req.json();

    if (!report_config_id) {
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

    if (configError || !reportConfig) {
      return new Response(JSON.stringify({ error: 'Report configuration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Update status to 'generating'
    await supabaseClient
      .from('generated_reports')
      .update({ status: 'generating' })
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

    // 6. Construct Skywork query
    const skyworkQuery = constructSkyworkQuery(reportConfig, aggregatedData);

    // 7. Call Skywork API
    const skyworkSecretId = Deno.env.get('SKYWORK_SECRET_ID');
    const skyworkSecretKey = Deno.env.get('SKYWORK_SECRET_KEY');
    const skyworkUrl = Deno.env.get('SKYWORK_API_URL') || 'https://api.skywork.ai';

    if (!skyworkSecretId || !skyworkSecretKey) {
      throw new Error('SKYWORK_SECRET_ID or SKYWORK_SECRET_KEY not configured');
    }

    // Generate MD5 sign: md5(secretId:secretKey)
    const encoder = new TextEncoder();
    const data = encoder.encode(`${skyworkSecretId}:${skyworkSecretKey}`);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sign = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const tool = SKYWORK_TOOLS[reportConfig.output_format as keyof typeof SKYWORK_TOOLS] || 'gen_ppt';

    console.log(`Calling Skywork API with tool: ${tool}`);

    const skyworkResponse = await fetch(`${skyworkUrl}/open/sse?secret_id=${skyworkSecretId}&sign=${sign}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool,
        query: skyworkQuery,
        use_network: false, // CRITICAL: Prevent hallucination
      }),
    });

    if (!skyworkResponse.ok) {
      throw new Error(`Skywork API error: ${skyworkResponse.status} ${skyworkResponse.statusText}`);
    }

    // 8. Parse SSE response for download URL
    const reader = skyworkResponse.body?.getReader();
    const decoder = new TextDecoder();
    let documentUrl = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.download_url) {
                documentUrl = data.download_url;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    }

    if (!documentUrl) {
      throw new Error('No download URL received from Skywork');
    }

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
    console.error('Report generation error:', error);

    // Try to update report status to failed
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        );

        const { report_config_id } = await req.json();
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
      console.error('Failed to update report status:', updateError);
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
  };

  // Fetch organization info
  const { data: org } = await supabaseClient
    .from('organizations')
    .select('name, industry, website')
    .eq('id', organizationId)
    .single();

  data.organization = org || {};

  // Fetch emissions data if section is included
  if (sections.includes('scope-1-2-3')) {
    // Query corporate reports for the year
    const { data: corporateReport } = await supabaseClient
      .from('corporate_reports')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('year', reportYear)
      .single();

    if (corporateReport) {
      data.emissions = {
        scope1: corporateReport.breakdown_json?.scope1 || 0,
        scope2: corporateReport.breakdown_json?.scope2 || 0,
        scope3: corporateReport.breakdown_json?.scope3 || 0,
        total: corporateReport.total_emissions || 0,
        year: reportYear,
      };
    }

    // Fetch multi-year data if enabled
    if (isMultiYear && reportYears && reportYears.length > 1) {
      const { data: historicalReports } = await supabaseClient
        .from('corporate_reports')
        .select('year, total_emissions, breakdown_json')
        .eq('organization_id', organizationId)
        .in('year', reportYears)
        .order('year', { ascending: true });

      data.emissionsTrends = historicalReports?.map((r: any) => ({
        year: r.year,
        scope1: r.breakdown_json?.scope1 || 0,
        scope2: r.breakdown_json?.scope2 || 0,
        scope3: r.breakdown_json?.scope3 || 0,
        total: r.total_emissions || 0,
      })) || [];

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
    }
  }

  // Fetch product data if section is included
  if (sections.includes('product-footprints')) {
    const { data: products } = await supabaseClient
      .from('product_lcas')
      .select('product_name, functional_unit, aggregated_impacts')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .limit(20);

    data.products = products?.map((p: any) => ({
      name: p.product_name,
      functionalUnit: p.functional_unit,
      climateImpact: p.aggregated_impacts?.climate_change || 0,
    })) || [];
  }

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
- **Industry:** ${data.organization.industry || 'N/A'}
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
