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

    // 5. Aggregate data (simplified for initial implementation)
    const aggregatedData = await aggregateReportData(
      supabaseClient,
      reportConfig.organization_id,
      reportConfig.report_year,
      reportConfig.sections
    );

    // 6. Construct Skywork query
    const skyworkQuery = constructSkyworkQuery(reportConfig, aggregatedData);

    // 7. Call Skywork API
    const skyworkApiKey = Deno.env.get('SKYWORK_API_KEY');
    const skyworkUrl = Deno.env.get('SKYWORK_API_URL') || 'https://api.skywork.ai';

    if (!skyworkApiKey) {
      throw new Error('SKYWORK_API_KEY not configured');
    }

    const tool = SKYWORK_TOOLS[reportConfig.output_format as keyof typeof SKYWORK_TOOLS] || 'gen_ppt';

    console.log(`Calling Skywork API with tool: ${tool}`);

    const skyworkResponse = await fetch(`${skyworkUrl}/open/sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${skyworkApiKey}`,
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

// Data aggregation function (simplified version)
async function aggregateReportData(
  supabaseClient: any,
  organizationId: string,
  reportYear: number,
  sections: string[]
): Promise<any> {
  const data: any = {
    organization: {},
    emissions: {},
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
      };
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

// Construct Skywork query
function constructSkyworkQuery(config: any, data: any): string {
  const formatName = config.output_format === 'pptx' ? 'PowerPoint presentation' :
                    config.output_format === 'docx' ? 'Word document' :
                    'Excel workbook';

  return `
Generate a professional sustainability report ${formatName} for ${data.organization.name} for the year ${config.report_year}.

**CRITICAL INSTRUCTIONS:**
1. Use ONLY the data provided below. Do NOT generate, estimate, or create any figures.
2. If data is missing, explicitly state "Data not available for this period."
3. Format the report for: ${config.audience}
4. Ensure compliance with: ${config.standards.join(', ')}
5. Use company branding: Primary Color: ${config.primary_color}, Secondary Color: ${config.secondary_color}

---
# ORGANIZATION INFORMATION

- **Company Name:** ${data.organization.name || 'N/A'}
- **Industry:** ${data.organization.industry || 'N/A'}
- **Reporting Period:** ${config.reporting_period_start} to ${config.reporting_period_end}

---
# GREENHOUSE GAS EMISSIONS SUMMARY

${data.emissions.total ? `
## Total Emissions: ${data.emissions.total.toFixed(2)} tCO2e

### Scope 1 Emissions: ${data.emissions.scope1?.toFixed(2) || '0.00'} tCO2e
Direct emissions from owned or controlled sources.

### Scope 2 Emissions: ${data.emissions.scope2?.toFixed(2) || '0.00'} tCO2e
Indirect emissions from purchased energy.

### Scope 3 Emissions: ${data.emissions.scope3?.toFixed(2) || '0.00'} tCO2e
All other indirect emissions in the value chain.
` : 'Emissions data not available for this period.'}

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
- Use executive summary format
- Apply company branding colors

Generate the complete sustainability report now.
`.trim();
}
