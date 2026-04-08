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
  type SectionNarrative,
  type ExecutiveSummaryNarrative,
  type ReportNarratives,
} from '../_shared/report-content-builder.ts';

// ============================================================================
// Narrative generation via Anthropic API (native fetch, Deno-compatible)
// ============================================================================

const SECTION_NARRATIVE_SYSTEM = `You are a senior sustainability analyst writing interpretive narrative for a corporate sustainability report.

Rules:
- Write in clear, factual British English
- Never use em dashes
- Never invent data — use only the figures and context provided
- Produce insight, not description. Do not repeat numbers already in the data tables.
- Be specific to this organisation and this data
- Write for the specified audience
- If data is absent, say so clearly and explain what data would be needed
- The headline insight is one sentence only
- The context paragraph is 2-3 sentences
- The next step prompt is one sentence

Return valid JSON only. No markdown, no explanation. Return an object with exactly:
{"headlineInsight":"<one sentence>","contextParagraph":"<2-3 sentences>","nextStepPrompt":"<one sentence>"}`;

const EXEC_SUMMARY_SYSTEM = `You are a senior sustainability communicator writing the Executive Summary for a corporate sustainability report.

This summary must work as a standalone page: a reader who only reads it should understand the company's full sustainability position.

Rules:
- Write in plain English, accessible to a non-specialist
- Never use em dashes
- Never invent data — use only the figures and context provided
- Lead with the most material finding
- Include one sentence on direction of travel (improving/worsening and by how much)
- Include one sentence on the most significant action taken in the reporting year
- Include one sentence on the primary challenge or data gap
- Do not use bullet points in the summary text

Return valid JSON only. No markdown, no explanation. Return an object with exactly:
{"primaryMessage":"<one sentence>","summaryText":"<4-6 sentences>"}`;

const AUDIENCE_FOCUS: Record<string, string> = {
  investors: 'financial materiality, ESG risk management, long-term value creation, and progress against targets',
  regulators: 'regulatory compliance, disclosure completeness, data quality, and verifiability',
  customers: 'product impact, brand values, tangible sustainability actions, and community commitment',
  internal: 'operational efficiency, cost implications, team performance, and actionable next steps',
  'supply-chain': 'supply chain transparency, upstream impacts, shared commitments, and procurement criteria',
  technical: 'methodology robustness, data quality, uncertainty ranges, and scientific rigour',
};

async function callAnthropicApi(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 512,
): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.type === 'text' ? data.content[0].text : '{}';
}

function buildFallbackSectionNarrative(sectionLabel: string, reportingYear: number): SectionNarrative {
  return {
    headlineInsight: `${sectionLabel} data is available for the ${reportingYear} reporting period.`,
    contextParagraph: `The ${sectionLabel} section presents performance data for ${reportingYear}. Review the figures below for individual metrics and their contribution to the overall sustainability position.`,
    nextStepPrompt: `Consider how these findings connect to stated targets and commitments.`,
    dataConfidenceStatement: null,
    methodologyFootnote: null,
    aiGenerated: true,
  };
}

async function generateSingleSectionNarrative(params: {
  sectionId: string;
  sectionLabel: string;
  organisationName: string;
  sector?: string;
  reportingYear: number;
  standards: string[];
  audience: string;
  sectionData: Record<string, unknown>;
  materialityHint?: string;
}): Promise<SectionNarrative> {
  const { sectionId, sectionLabel, organisationName, sector, reportingYear, standards, audience, sectionData, materialityHint } = params;
  const audienceFocus = AUDIENCE_FOCUS[audience] || 'strategic context and actionable insight';

  const userPrompt = `Write a section narrative for the "${sectionLabel}" section of the ${reportingYear} sustainability report for ${organisationName}.

Organisation: ${organisationName}
Sector: ${sector || 'Not specified'}
Reporting year: ${reportingYear}
Applicable standards: ${standards.length > 0 ? standards.join(', ') : 'None specified'}
Primary audience: ${audience} — they care about: ${audienceFocus}${materialityHint || ''}

Section data:
${JSON.stringify(sectionData, null, 2)}

IMPORTANT: Do not describe the data. Interpret it. Answer: what does this mean for ${organisationName}, why does it matter to the specified audience, and what should they take away from it?

Return JSON only.`;

  try {
    const rawText = await callAnthropicApi(SECTION_NARRATIVE_SYSTEM, userPrompt, 512);
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      headlineInsight: parsed.headlineInsight || `${sectionLabel} analysis for ${reportingYear}.`,
      contextParagraph: parsed.contextParagraph || '',
      nextStepPrompt: parsed.nextStepPrompt || '',
      dataConfidenceStatement: null,
      methodologyFootnote: null,
      aiGenerated: true,
    };
  } catch {
    return buildFallbackSectionNarrative(sectionLabel, reportingYear);
  }
}

interface MaterialityAssessmentCtx {
  priorityTopics: string[];
  topicDetails: Record<string, { name: string; rationale?: string }>;
}

// Maps section IDs to materiality topic IDs
const SECTION_TO_TOPIC: Record<string, string> = {
  'scope-1-2-3': 'climate-mitigation',
  'ghg-inventory': 'climate-mitigation',
  'carbon-origin': 'climate-mitigation',
  'flag-removals': 'land-use',
  'tnfd-nature': 'biodiversity',
  'product-footprints': 'product-footprints',
  'people-culture': 'employee-wellbeing',
  'governance': 'governance-accountability',
  'community-impact': 'community-engagement',
  'supply-chain': 'supply-chain-standards',
  'targets': 'climate-mitigation',
};

async function generateNarrativesForReport(
  config: ReportConfig,
  data: ReportData,
  materiality?: MaterialityAssessmentCtx,
): Promise<ReportNarratives> {
  const SECTION_LABELS: Record<string, string> = {
    'scope-1-2-3': 'Scope 1, 2 & 3 Emissions Breakdown',
    'ghg-inventory': 'GHG Gas Inventory',
    'carbon-origin': 'Carbon Origin Breakdown',
    'flag-removals': 'FLAG Land-Based Removals',
    'tnfd-nature': 'TNFD Nature & Biodiversity',
    'product-footprints': 'Product Environmental Impacts',
    'multi-capital': 'Multi-capital Impacts',
    'impact-valuation': 'Impact Valuation',
    'people-culture': 'People & Culture',
    'governance': 'Governance',
    'community-impact': 'Community Impact',
    'supply-chain': 'Supply Chain Analysis',
    'facilities': 'Facility Emissions Breakdown',
    'key-findings': 'Key Findings & Change Drivers',
    'trends': 'Year-over-Year Trends',
    'targets': 'Targets & Action Plans',
  };

  const SKIP = new Set(['executive-summary', 'methodology', 'regulatory', 'appendix']);

  const DATA_EXTRACTORS: Record<string, (d: ReportData) => Record<string, unknown>> = {
    'scope-1-2-3': d => ({ emissions: d.emissions }),
    'ghg-inventory': d => ({ emissions: d.emissions }),
    'carbon-origin': d => ({ emissions: d.emissions }),
    'flag-removals': d => ({ flagRemovals: (d as any).flagRemovals }),
    'tnfd-nature': d => ({ tnfd: (d as any).tnfd }),
    'product-footprints': d => ({ products: d.products }),
    'multi-capital': d => ({ products: d.products }),
    'impact-valuation': d => ({ impactValuation: d.impactValuation }),
    'people-culture': d => ({ peopleCulture: d.peopleCulture }),
    'governance': d => ({ governance: d.governance }),
    'community-impact': d => ({ communityImpact: d.communityImpact }),
    'supply-chain': d => ({ suppliers: d.suppliers }),
    'facilities': d => ({ facilities: d.facilities }),
    'key-findings': d => ({ emissions: d.emissions, emissionsTrends: d.emissionsTrends }),
    'trends': d => ({ emissionsTrends: d.emissionsTrends }),
    'targets': d => ({ governance: d.governance, emissions: d.emissions }),
  };

  const sectionsToProcess = config.sections.filter(id => !SKIP.has(id) && SECTION_LABELS[id]);

  // Build per-section materiality context
  function buildMaterialityHint(sectionId: string): string {
    if (!materiality) return '';
    const topicId = SECTION_TO_TOPIC[sectionId];
    if (!topicId) return '';
    const topicDetail = materiality.topicDetails[topicId];
    if (!topicDetail) return '';
    const isPriority = materiality.priorityTopics.includes(topicId);
    const status = isPriority ? 'a priority material topic' : 'a material topic';
    const rationale = topicDetail.rationale ? ` Stakeholder rationale: "${topicDetail.rationale}".` : '';
    return `\n\nMateriality context: "${topicDetail.name}" is ${status} for this organisation.${rationale} Ensure the narrative reflects this materiality significance.`;
  }

  // Generate all section narratives in parallel
  const sectionResults = await Promise.allSettled(
    sectionsToProcess.map(sectionId => {
      const extractor = DATA_EXTRACTORS[sectionId];
      return generateSingleSectionNarrative({
        sectionId,
        sectionLabel: SECTION_LABELS[sectionId],
        organisationName: data.organization.name,
        sector: data.organization.industry_sector,
        reportingYear: config.reportYear,
        standards: config.standards,
        audience: config.audience,
        sectionData: extractor ? extractor(data) : {},
        materialityHint: buildMaterialityHint(sectionId),
      });
    })
  );

  const sectionNarratives: Partial<Record<string, SectionNarrative>> = {};
  sectionsToProcess.forEach((sectionId, i) => {
    const result = sectionResults[i];
    if (result.status === 'fulfilled') {
      sectionNarratives[sectionId] = result.value;
    }
  });

  // Generate executive summary last, after all section narratives
  const totalEmissions = data.emissions.total;
  const scope3Pct = totalEmissions > 0 ? ((data.emissions.scope3 / totalEmissions) * 100).toFixed(1) : '0';
  let yoyChangePct = '';
  if (data.emissionsTrends && data.emissionsTrends.length >= 2) {
    const latest = data.emissionsTrends[data.emissionsTrends.length - 1];
    if (latest.yoyChange) yoyChangePct = `${latest.yoyChange}%`;
  }

  const sectionInsights = Object.entries(sectionNarratives)
    .filter(([, n]) => n)
    .map(([id, n]) => `${id}: ${n!.headlineInsight}`)
    .join('\n');

  const execUserPrompt = `Write the Executive Summary for ${data.organization.name}'s ${config.reportYear} sustainability report.

Organisation: ${data.organization.name}
Sector: ${data.organization.industry_sector || 'Not specified'}
Reporting year: ${config.reportYear}
Primary audience: ${config.audience}
Applicable standards: ${config.standards.length > 0 ? config.standards.join(', ') : 'None specified'}

Emissions summary:
- Total GHG emissions: ${totalEmissions.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e
- Scope 1: ${data.emissions.scope1.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e
- Scope 2: ${data.emissions.scope2.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e
- Scope 3: ${data.emissions.scope3.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e (${scope3Pct}% of total)
${yoyChangePct ? `- Year-on-year change: ${yoyChangePct}` : ''}

Key section insights (synthesise the 3-5 most important):
${sectionInsights}

Return JSON only.`;

  let execNarrative: ExecutiveSummaryNarrative;
  try {
    const rawExec = await callAnthropicApi(EXEC_SUMMARY_SYSTEM, execUserPrompt, 768);
    const cleanedExec = rawExec.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsedExec = JSON.parse(cleanedExec);
    execNarrative = {
      primaryMessage: parsedExec.primaryMessage || `${data.organization.name} recorded ${totalEmissions.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e in ${config.reportYear}.`,
      summaryText: parsedExec.summaryText || '',
      aiGenerated: true,
    };
  } catch {
    execNarrative = {
      primaryMessage: `${data.organization.name} recorded total GHG emissions of ${totalEmissions.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO2e in ${config.reportYear}.`,
      summaryText: `This sustainability report covers emissions across Scopes 1, 2, and 3 for the ${config.reportYear} reporting period. Review the full report for section-level detail, targets, and methodology.`,
      aiGenerated: true,
    };
  }

  return {
    executiveSummary: execNarrative,
    sections: sectionNarratives,
  };
}

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

    // Fetch materiality assessment for narrative context (non-fatal)
    let materialityCtx: MaterialityAssessmentCtx | undefined;
    try {
      const { data: matData } = await supabaseClient
        .from('materiality_assessments')
        .select('topics, priority_topics, completed_at')
        .eq('organization_id', reportConfig.organization_id)
        .eq('assessment_year', reportConfig.report_year)
        .maybeSingle();
      if (matData?.completed_at && matData.priority_topics && matData.topics) {
        materialityCtx = {
          priorityTopics: matData.priority_topics,
          topicDetails: Object.fromEntries(
            (matData.topics as Array<{ id: string; name: string; rationale?: string }>).map(t => [
              t.id,
              { name: t.name, rationale: t.rationale },
            ])
          ),
        };
      }
    } catch {
      // Non-fatal — narratives still generated without materiality context
    }

    // Generate AI narrative blocks for all sections (non-fatal if it fails)
    let reportNarratives: ReportNarratives | undefined;
    try {
      reportNarratives = await generateNarrativesForReport(config, aggregatedData, materialityCtx);
    } catch (narrativeErr) {
      console.warn('[Narratives] Generation failed (non-fatal), continuing without narratives:', narrativeErr);
    }

    // Build structured content — data is DETERMINISTIC, narratives are additive
    const structuredContent = buildReportContent(config, aggregatedData, undefined, reportNarratives);
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
    // Get branded template if organization has one (non-fatal — column may not exist yet)
    let templateId = 'default';
    try {
      const { data: orgData } = await supabaseClient
        .from('organizations')
        .select('slidespeak_template_id')
        .eq('id', reportConfig.organization_id)
        .maybeSingle();

      if (orgData?.slidespeak_template_id) {
        templateId = orgData.slidespeak_template_id;
      }
    } catch {
      // Column not yet in schema — proceed with default template
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

      // Always calculate emissions live from raw data tables.
      // breakdown_json can be stale if persistEmissions ran before async product data loaded
      // (e.g. scope3.products is 0 because product LCAs hadn't resolved yet).
      {
        // Live calculation from utility_data_entries + fleet + overheads + production_logs × PCFs
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
            .lte('reporting_period_start', yearEnd);

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
          .lte('reporting_period_start', yearEnd);
        if (fleetS1) fleetS1.forEach((f: any) => { scope1 += (f.emissions_tco2e || 0) * 1000; });

        const { data: fleetS2 } = await supabaseClient
          .from('fleet_activities')
          .select('emissions_tco2e')
          .eq('organization_id', organizationId)
          .eq('scope', 'Scope 2')
          .gte('reporting_period_start', yearStart)
          .lte('reporting_period_start', yearEnd);
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
          .select('product_id, units_produced')
          .eq('organization_id', organizationId)
          .gte('date', yearStart)
          .lte('date', yearEnd);

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
                scope3 += pcf.aggregated_impacts.breakdown.by_scope.scope3 * (l.units_produced || 0);
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
        .lte('reporting_period_start', yearEnd);

      // Get utility data per facility for breakdown
      const { data: utilityData } = await supabaseClient
        .from('utility_data_entries')
        .select('facility_id, quantity, utility_type')
        .in('facility_id', facilityIds)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_start', yearEnd);

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

        // Extract carbon origin data from aggregated_impacts (for carbon-origin section)
        if (sections.includes('carbon-origin')) {
          let totalFossil = 0, totalBiogenic = 0, totalLandUseChange = 0;
          for (const p of Array.from(seenProducts.values())) {
            const ai = (p as any).aggregated_impacts;
            if (ai?.carbon_origin) {
              totalFossil += ai.carbon_origin.fossil || 0;
              totalBiogenic += ai.carbon_origin.biogenic || 0;
              totalLandUseChange += ai.carbon_origin.land_use_change || 0;
            }
          }
          if (totalFossil > 0 || totalBiogenic !== 0 || totalLandUseChange > 0) {
            (data as any).carbonOrigin = {
              fossil: totalFossil,
              biogenic: totalBiogenic,
              landUseChange: totalLandUseChange,
            };
          }
        }

        // Extract FLAG removals data (for flag-removals section)
        if (sections.includes('flag-removals')) {
          let totalRemovals = 0;
          let profileCount = 0;
          let allVerified = true;
          let allMeetLsr = true;
          for (const p of Array.from(seenProducts.values())) {
            const ai = (p as any).aggregated_impacts;
            if (ai?.flag_removals) {
              const removals = ai.flag_removals.soil_carbon_co2e || 0;
              if (removals > 0) {
                totalRemovals += removals;
                profileCount++;
                if (ai.flag_removals.removal_verification_status !== 'verified') {
                  allVerified = false;
                }
                if (!ai.flag_removals.removals_meet_lsr_standard) {
                  allMeetLsr = false;
                }
              }
            }
          }
          (data as any).flagRemovals = {
            totalRemovals,
            profileCount,
            allVerified,
            allMeetLsr,
          };
        }

        // Extract TNFD nature data (for tnfd-nature section)
        if (sections.includes('tnfd-nature')) {
          // LCA impact aggregation
          let totalLandUse = 0, totalTerrestrialEcotox = 0, totalFwEutrophication = 0;
          let totalTerrestrialAcid = 0, totalWaterConsumption = 0, totalWaterScarcity = 0;
          for (const p of Array.from(seenProducts.values())) {
            const ai = (p as any).aggregated_impacts;
            if (ai) {
              totalLandUse += ai.land_use || 0;
              totalTerrestrialEcotox += ai.terrestrial_ecotoxicity || 0;
              totalFwEutrophication += ai.freshwater_eutrophication || 0;
              totalTerrestrialAcid += ai.terrestrial_acidification || 0;
              totalWaterConsumption += ai.water_consumption || 0;
              totalWaterScarcity += ai.water_scarcity_aware || 0;
            }
          }

          // Site data from vineyards and orchards
          const sites: any[] = [];
          let sitesWithGaps = 0;

          // Fetch vineyard data
          const { data: vineyards } = await supabase
            .from('vineyards')
            .select('id, name, address_country, location_country_code')
            .eq('organization_id', orgId)
            .eq('is_active', true);

          if (vineyards) {
            for (const v of vineyards) {
              // Get latest growing profile for TNFD fields
              const { data: profile } = await supabase
                .from('vineyard_growing_profiles')
                .select('ecosystem_type, in_biodiversity_sensitive_area, sensitive_area_details, water_stress_index')
                .eq('vineyard_id', v.id)
                .order('vintage_year', { ascending: false })
                .limit(1)
                .maybeSingle();

              const hasGap = !profile?.ecosystem_type && !profile?.water_stress_index;
              if (hasGap) sitesWithGaps++;

              sites.push({
                name: v.name,
                country: v.address_country || v.location_country_code || 'N/A',
                ecosystemType: profile?.ecosystem_type?.replace(/_/g, ' ') || null,
                inSensitiveArea: profile?.in_biodiversity_sensitive_area || false,
                sensitiveAreaDetails: profile?.sensitive_area_details || null,
                waterStress: profile?.water_stress_index?.replace(/_/g, ' ') || null,
              });
            }
          }

          // Fetch orchard data
          const { data: orchards } = await supabase
            .from('orchards')
            .select('id, name, address_country, location_country_code')
            .eq('organization_id', orgId)
            .eq('is_active', true);

          if (orchards) {
            for (const o of orchards) {
              const { data: profile } = await supabase
                .from('orchard_growing_profiles')
                .select('ecosystem_type, in_biodiversity_sensitive_area, sensitive_area_details, water_stress_index')
                .eq('orchard_id', o.id)
                .order('harvest_year', { ascending: false })
                .limit(1)
                .maybeSingle();

              const hasGap = !profile?.ecosystem_type && !profile?.water_stress_index;
              if (hasGap) sitesWithGaps++;

              sites.push({
                name: o.name,
                country: o.address_country || o.location_country_code || 'N/A',
                ecosystemType: profile?.ecosystem_type?.replace(/_/g, ' ') || null,
                inSensitiveArea: profile?.in_biodiversity_sensitive_area || false,
                sensitiveAreaDetails: profile?.sensitive_area_details || null,
                waterStress: profile?.water_stress_index?.replace(/_/g, ' ') || null,
              });
            }
          }

          // Fetch nature impact assessment
          const { data: assessment } = await supabase
            .from('nature_impact_assessments')
            .select('*')
            .eq('organization_id', orgId)
            .eq('assessment_year', config.reportYear)
            .maybeSingle();

          (data as any).tnfdNature = {
            sites,
            sitesWithGaps,
            lcaImpacts: {
              landUse: totalLandUse,
              terrestrialEcotoxicity: totalTerrestrialEcotox,
              freshwaterEutrophication: totalFwEutrophication,
              terrestrialAcidification: totalTerrestrialAcid,
              waterConsumption: totalWaterConsumption,
              waterScarcity: totalWaterScarcity,
            },
            assessment: assessment ? {
              waterDependency: assessment.water_dependency_level,
              waterDependencyNotes: assessment.water_dependency_notes,
              pollinationDependency: assessment.pollination_dependency_level,
              pollinationDependencyNotes: assessment.pollination_dependency_notes,
              soilHealthDependency: assessment.soil_health_dependency_level,
              soilHealthDependencyNotes: assessment.soil_health_dependency_notes,
              landUseHa: assessment.land_use_ha,
              pollutionN: assessment.pollution_outputs_kg_n,
              pollutionP: assessment.pollution_outputs_kg_p,
              pesticideKg: assessment.pesticide_kg_active,
              materiality: assessment.nature_risk_materiality,
              materialityRationale: assessment.materiality_rationale,
              physicalRiskNotes: assessment.physical_risk_notes,
              transitionRiskNotes: assessment.transition_risk_notes,
              hasNaturePositiveTarget: assessment.has_nature_positive_target,
              targetYear: assessment.nature_positive_target_year,
              baselineYear: assessment.nature_positive_baseline_year,
              targetDescription: assessment.nature_positive_target_description,
            } : null,
            leapStatus: [
              { phase: 'Locate', status: sites.length > 0 ? 'Implemented' : 'Not started', implemented: 'Site ecosystem type, biodiversity sensitivity, water stress', gaps: sitesWithGaps > 0 ? `${sitesWithGaps} site(s) missing data` : 'None' },
              { phase: 'Evaluate', status: assessment ? 'Implemented' : 'Not started', implemented: 'ReCiPe 2016 impact metrics, dependency assessment', gaps: !assessment ? 'Complete nature assessment questionnaire' : 'None' },
              { phase: 'Assess', status: assessment?.nature_risk_materiality ? 'Implemented' : 'Not started', implemented: assessment?.nature_risk_materiality ? 'Materiality determination' : '-', gaps: !assessment?.nature_risk_materiality ? 'Materiality assessment required' : 'None' },
              { phase: 'Prepare', status: assessment?.has_nature_positive_target ? 'Implemented' : 'Partial', implemented: 'Metrics reporting', gaps: !assessment?.has_nature_positive_target ? 'Nature-positive target not set' : 'None' },
            ],
          };
        }

        // Extract multi-capital impact data (for multi-capital section)
        if (sections.includes('multi-capital')) {
          let totalWater = 0, totalLand = 0, totalEutrophication = 0, totalAcidification = 0, totalWaterScarcity = 0;
          for (const p of Array.from(seenProducts.values())) {
            const ai = (p as any).aggregated_impacts;
            if (ai) {
              totalWater += ai.water_consumption || 0;
              totalLand += ai.land_use || 0;
              totalEutrophication += ai.freshwater_eutrophication || 0;
              totalAcidification += ai.terrestrial_acidification || 0;
              totalWaterScarcity += ai.water_scarcity_aware || 0;
            }
          }
          if (totalWater > 0 || totalLand > 0 || totalEutrophication > 0 || totalAcidification > 0) {
            (data as any).multiCapitalImpacts = {
              waterConsumption: totalWater,
              landUse: totalLand,
              freshwaterEutrophication: totalEutrophication,
              terrestrialAcidification: totalAcidification,
              waterScarcity: totalWaterScarcity,
            };
          }
        }
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

  // Fetch impact valuation data if section is included
  if (sections.includes('impact-valuation')) {
    try {
      const { data: ivResult, error: ivError } = await supabaseClient
        .from('impact_valuation_results')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('reporting_year', reportYear)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ivError) {
        console.error('[Data] Error fetching impact valuation:', ivError.message);
      } else if (ivResult && ivResult.grand_total > 0) {
        // Reconstruct item arrays from stored column values
        // data_coverage is stored as percentage (0–100), convert to 0–1 for display
        const dataCoverage = (ivResult.data_coverage || 0) / 100;
        const snapshot = ivResult.input_snapshot as any;

        data.impactValuation = {
          natural: {
            total: ivResult.natural_total || 0,
            items: [
              { key: 'carbon_tonne', label: 'Carbon (GHG)', value: ivResult.natural_carbon_value || 0, raw_input: snapshot?.natural?.total_emissions_tco2e ?? null, unit: 'per tCO2e', has_data: (ivResult.natural_carbon_value || 0) > 0 },
              { key: 'water_m3', label: 'Water Use', value: ivResult.natural_water_value || 0, raw_input: snapshot?.natural?.water_consumption_m3 ?? null, unit: 'per m³', has_data: (ivResult.natural_water_value || 0) > 0 },
              { key: 'land_ha', label: 'Land Use', value: ivResult.natural_land_value || 0, raw_input: snapshot?.natural?.land_use_ha ?? null, unit: 'per ha/yr', has_data: (ivResult.natural_land_value || 0) > 0 },
              { key: 'waste_tonne', label: 'Waste to Landfill', value: ivResult.natural_waste_value || 0, raw_input: snapshot?.natural?.waste_to_landfill_tonnes ?? null, unit: 'per tonne', has_data: snapshot?.natural?.waste_to_landfill_tonnes !== null && snapshot?.natural?.waste_to_landfill_tonnes !== undefined },
            ],
          },
          human: {
            total: ivResult.human_total || 0,
            items: [
              { key: 'living_wage_gap_gbp', label: 'Living Wage Uplift', value: ivResult.human_living_wage_value || 0, raw_input: snapshot?.human?.living_wage_gap_annual_gbp ?? null, unit: 'per £1 gap/yr', has_data: (ivResult.human_living_wage_value || 0) > 0 },
              { key: 'training_hour', label: 'Employee Training', value: ivResult.human_training_value || 0, raw_input: snapshot?.human?.total_training_hours ?? null, unit: 'per hour', has_data: (ivResult.human_training_value || 0) > 0 },
              { key: 'wellbeing_score_point', label: 'Employee Wellbeing', value: ivResult.human_wellbeing_value || 0, raw_input: snapshot?.human?.wellbeing_score ?? null, unit: 'per 1pt score improvement', has_data: (ivResult.human_wellbeing_value || 0) > 0 },
            ],
          },
          social: {
            total: ivResult.social_total || 0,
            items: [
              { key: 'volunteering_hour', label: 'Volunteering Hours', value: ivResult.social_volunteering_value || 0, raw_input: snapshot?.social?.volunteering_hours_total ?? null, unit: 'per hour', has_data: (ivResult.social_volunteering_value || 0) > 0 },
              { key: 'charitable_giving_gbp', label: 'Charitable Giving', value: ivResult.social_giving_value || 0, raw_input: snapshot?.social?.charitable_giving_total_gbp ?? null, unit: 'per £1 donated', has_data: (ivResult.social_giving_value || 0) > 0 },
              { key: 'local_multiplier', label: 'Local Supply Chain Spend', value: ivResult.social_local_multiplier_value || 0, raw_input: snapshot?.social?.local_supply_spend_gbp ?? null, unit: 'per £1 local spend', has_data: (ivResult.social_local_multiplier_value || 0) > 0 },
            ],
          },
          governance: {
            total: ivResult.governance_total || 0,
            items: [
              { key: 'governance_score_point', label: 'Governance Quality', value: ivResult.governance_total || 0, raw_input: snapshot?.governance?.governance_score ?? null, unit: 'per 1pt score (0–100)', has_data: (ivResult.governance_total || 0) > 0 },
            ],
          },
          grand_total: ivResult.grand_total,
          data_coverage: dataCoverage,
          confidence_level: ivResult.confidence_level || 'low',
          reporting_year: ivResult.reporting_year,
        };
        data.dataAvailability.hasImpactValuation = true;
      }
    } catch (error) {
      console.error('[Data] Exception fetching impact valuation:', error);
    }
  }

  // ── People & Culture data ──
  if (sections.includes('people-culture')) {
    try {
      // Latest score
      const { data: scoreRow } = await supabaseClient
        .from('people_culture_scores')
        .select('*')
        .eq('organization_id', organizationId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Demographics
      const { data: demographics } = await supabaseClient
        .from('people_workforce_demographics')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // DEI actions
      const { data: deiActions } = await supabaseClient
        .from('people_dei_actions')
        .select('id, status')
        .eq('organization_id', organizationId);

      // Training records for the year
      const { data: training } = await supabaseClient
        .from('people_training_records')
        .select('training_hours, participants')
        .eq('organization_id', organizationId)
        .gte('training_date', `${reportYear}-01-01`)
        .lte('training_date', `${reportYear}-12-31`);

      // Latest survey
      const { data: survey } = await supabaseClient
        .from('people_employee_surveys')
        .select('engagement_score, response_rate')
        .eq('organization_id', organizationId)
        .order('survey_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Benefits
      const { data: benefits } = await supabaseClient
        .from('people_benefits')
        .select('benefit_name')
        .eq('organization_id', organizationId)
        .eq('is_offered', true);

      // Compensation count (for employee total if demographics missing)
      const { count: compCount } = await supabaseClient
        .from('people_employee_compensation')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      const totalEmployees = demographics?.total_headcount || compCount || 0;
      const totalDei = deiActions?.length || 0;
      const completedDei = deiActions?.filter((a: any) => a.status === 'completed').length || 0;

      // Calculate training hours per employee
      let trainingHoursPerEmployee: number | null = null;
      if (training && training.length > 0 && totalEmployees > 0) {
        const totalHours = training.reduce((sum: number, t: any) => sum + (t.training_hours || 0), 0);
        trainingHoursPerEmployee = totalHours / totalEmployees;
      }

      const genderData = demographics?.gender_data as any;
      let femalePercentage: number | null = null;
      if (genderData && totalEmployees > 0) {
        const female = genderData.female || genderData.Female || 0;
        femalePercentage = (female / totalEmployees) * 100;
      }

      const turnoverRate = totalEmployees > 0 && demographics?.departures
        ? (demographics.departures / totalEmployees) * 100
        : null;

      data.peopleCulture = {
        overallScore: scoreRow?.overall_score || 0,
        fairWorkScore: scoreRow?.fair_work_score || 0,
        diversityScore: scoreRow?.diversity_score || 0,
        wellbeingScore: scoreRow?.wellbeing_score || 0,
        trainingScore: scoreRow?.training_score || 0,
        dataCompleteness: scoreRow?.data_completeness || 0,
        livingWageCompliance: scoreRow?.living_wage_compliance ?? null,
        genderPayGapMean: scoreRow?.gender_pay_gap_mean ?? null,
        ceoWorkerPayRatio: scoreRow?.ceo_worker_pay_ratio ?? null,
        trainingHoursPerEmployee,
        engagementScore: survey?.engagement_score ?? null,
        totalEmployees,
        femalePercentage,
        newHires: demographics?.new_hires || 0,
        departures: demographics?.departures || 0,
        turnoverRate,
        deiActionsTotal: totalDei,
        deiActionsCompleted: completedDei,
        benefits: (benefits || []).map((b: any) => b.benefit_name),
      };
      data.dataAvailability.hasPeopleCulture = true;
    } catch (error) {
      console.error('[Data] Exception fetching people & culture:', error);
    }
  }

  // ── Governance data ──
  if (sections.includes('governance')) {
    try {
      // Mission
      const { data: mission } = await supabaseClient
        .from('governance_mission')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      // Board members
      const { data: boardMembers } = await supabaseClient
        .from('governance_board_members')
        .select('full_name, role_title, gender, is_independent, attendance_rate')
        .eq('organization_id', organizationId)
        .eq('is_current', true);

      // Policies
      const { data: policies } = await supabaseClient
        .from('governance_policies')
        .select('policy_name, policy_type, status, is_public')
        .eq('organization_id', organizationId);

      // Ethics records for the year
      const { data: ethicsRecords } = await supabaseClient
        .from('governance_ethics_records')
        .select('record_type, completion_rate')
        .eq('organization_id', organizationId)
        .gte('record_date', `${reportYear}-01-01`)
        .lte('record_date', `${reportYear}-12-31`);

      // Lobbying count
      const { count: lobbyingCount } = await supabaseClient
        .from('governance_lobbying')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('activity_date', `${reportYear}-01-01`)
        .lte('activity_date', `${reportYear}-12-31`);

      const members = boardMembers || [];
      const totalMembers = members.length;
      const femaleCount = members.filter((m: any) => m.gender?.toLowerCase() === 'female').length;
      const independentCount = members.filter((m: any) => m.is_independent === true).length;
      const avgAttendance = totalMembers > 0
        ? members.reduce((sum: number, m: any) => sum + (m.attendance_rate || 0), 0) / totalMembers
        : 0;

      // Ethics training rate
      const trainingRecords = (ethicsRecords || []).filter((r: any) => r.record_type === 'ethics_training');
      const ethicsTrainingRate = trainingRecords.length > 0
        ? trainingRecords.reduce((sum: number, r: any) => sum + (r.completion_rate || 0), 0) / trainingRecords.length
        : null;
      const ethicsIncidents = (ethicsRecords || []).filter((r: any) =>
        ['whistleblowing_case', 'incident'].includes(r.record_type)
      ).length;

      // Expected ESG policies for completeness
      const expectedPolicies = ['Environmental', 'Health & Safety', 'Anti-Corruption', 'Human Rights', 'DEI', 'Data Privacy'];
      const coveredTypes = new Set((policies || []).map((p: any) => p.policy_type));
      const policyCompleteness = (coveredTypes.size / expectedPolicies.length) * 100;

      data.governance = {
        missionStatement: mission?.mission_statement || null,
        visionStatement: mission?.vision_statement || null,
        purposeStatement: mission?.purpose_statement || null,
        isBenefitCorp: mission?.is_benefit_corporation || false,
        sdgCommitments: mission?.sdg_commitments || [],
        climateCommitments: mission?.climate_commitments || [],
        boardMembers: members.map((m: any) => ({
          name: m.full_name,
          role: m.role_title || 'Member',
          gender: m.gender,
          isIndependent: m.is_independent,
          attendanceRate: m.attendance_rate,
        })),
        boardDiversityMetrics: {
          totalMembers,
          femalePercentage: totalMembers > 0 ? (femaleCount / totalMembers) * 100 : 0,
          independentPercentage: totalMembers > 0 ? (independentCount / totalMembers) * 100 : 0,
          averageAttendance: avgAttendance,
        },
        policies: (policies || []).map((p: any) => ({
          name: p.policy_name,
          type: p.policy_type || 'General',
          status: p.status || 'Draft',
          isPublic: p.is_public || false,
        })),
        policyCompleteness: Math.min(100, policyCompleteness),
        ethicsTrainingRate,
        ethicsIncidents,
        lobbyingActivities: lobbyingCount || 0,
      };
      data.dataAvailability.hasGovernance = true;
    } catch (error) {
      console.error('[Data] Exception fetching governance:', error);
    }
  }

  // ── Community Impact data ──
  if (sections.includes('community-impact')) {
    try {
      // Latest score
      const { data: scoreRow } = await supabaseClient
        .from('community_impact_scores')
        .select('*')
        .eq('organization_id', organizationId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Donations for the year
      const { data: donations } = await supabaseClient
        .from('community_donations')
        .select('amount, currency')
        .eq('organization_id', organizationId)
        .gte('donation_date', `${reportYear}-01-01`)
        .lte('donation_date', `${reportYear}-12-31`);

      // Volunteer activities
      const { data: volunteering } = await supabaseClient
        .from('community_volunteer_activities')
        .select('total_volunteer_hours, duration_hours, participant_count')
        .eq('organization_id', organizationId)
        .gte('activity_date', `${reportYear}-01-01`)
        .lte('activity_date', `${reportYear}-12-31`);

      // Impact stories (published, limit 5)
      const { data: stories } = await supabaseClient
        .from('community_impact_stories')
        .select('title, impact_category, summary')
        .eq('organization_id', organizationId)
        .eq('is_published', true)
        .order('published_date', { ascending: false })
        .limit(5);

      // Local impact
      const { data: localImpact } = await supabaseClient
        .from('community_local_impact')
        .select('total_employees, local_employees, total_procurement_spend, local_procurement_spend')
        .eq('organization_id', organizationId)
        .eq('reporting_year', reportYear)
        .limit(1)
        .maybeSingle();

      const totalDonations = (donations || []).reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
      const totalVolunteerHours = (volunteering || []).reduce((sum: number, v: any) => {
        return sum + (v.total_volunteer_hours || (v.duration_hours || 0) * (v.participant_count || 1));
      }, 0);

      const localEmploymentRate = localImpact?.total_employees && localImpact?.local_employees
        ? (localImpact.local_employees / localImpact.total_employees) * 100
        : null;
      const localSourcingRate = localImpact?.total_procurement_spend && localImpact?.local_procurement_spend
        ? (localImpact.local_procurement_spend / localImpact.total_procurement_spend) * 100
        : null;

      data.communityImpact = {
        overallScore: scoreRow?.overall_score || 0,
        givingScore: scoreRow?.giving_score || 0,
        localImpactScore: scoreRow?.local_impact_score || 0,
        volunteeringScore: scoreRow?.volunteering_score || 0,
        engagementScore: scoreRow?.engagement_score || 0,
        dataCompleteness: scoreRow?.data_completeness || 0,
        totalDonations,
        donationCount: donations?.length || 0,
        totalVolunteerHours,
        volunteerActivities: volunteering?.length || 0,
        impactStories: (stories || []).map((s: any) => ({
          title: s.title,
          category: s.impact_category || 'General',
          summary: s.summary || '',
        })),
        localEmploymentRate,
        localSourcingRate,
      };
      data.dataAvailability.hasCommunityImpact = true;
    } catch (error) {
      console.error('[Data] Exception fetching community impact:', error);
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

    // FLAG threshold status from product LCA aggregated impacts
    if (hasProducts && data.products?.length > 0) {
      let anyFlagExceeded = false;
      let maxFlagPct = 0;
      for (const p of data.products) {
        const ai = (p as any).aggregated_impacts;
        const ft = ai?.breakdown?.flag_threshold;
        if (ft) {
          if (ft.flag_threshold_exceeded) anyFlagExceeded = true;
          if (ft.flag_emissions_pct > maxFlagPct) maxFlagPct = ft.flag_emissions_pct;
        }
      }
      if (maxFlagPct > 0) {
        data.standards.push({
          code: 'sbti-flag',
          name: 'SBTi FLAG Guidance v1.2',
          status: anyFlagExceeded ? 'Action Required' : 'Compliant',
          detail: anyFlagExceeded
            ? `FLAG emissions at ${maxFlagPct.toFixed(1)}% of total (threshold: 20%). FLAG reduction targets required.`
            : `FLAG emissions at ${maxFlagPct.toFixed(1)}% of total (below 20% threshold)`,
        });
      }
    }
  }
  return data;
}
