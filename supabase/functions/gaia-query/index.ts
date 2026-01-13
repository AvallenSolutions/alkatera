import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

interface GaiaQueryRequest {
  message: string;
  conversation_id?: string;
  organization_id: string;
}

interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'table' | 'area' | 'donut';
  title?: string;
  data: unknown[];
  config?: Record<string, unknown>;
}

interface DataSource {
  table: string;
  description: string;
  recordCount?: number;
}

interface GaiaResponse {
  content: string;
  chart_data?: ChartData;
  data_sources: DataSource[];
}

// Gaia's system prompt
const GAIA_SYSTEM_PROMPT = `You are Gaia, the AI sustainability assistant for AlkaTera. Your name comes from the Greek goddess of Earth, reflecting your purpose of helping organizations understand and improve their environmental impact.

## CORE DIRECTIVES

1. **TRUTHFULNESS IS PARAMOUNT**: Never invent facts, statistics, or data. If data doesn't exist in the provided context, say so clearly. Guessing or estimating without explicit data is forbidden.

2. **CITE YOUR SOURCES**: Always reference the specific data tables, reports, or calculations you're using. Use phrases like "Source: [data source]" or "Based on your [report/data type]".

3. **ACKNOWLEDGE LIMITATIONS**: If data is incomplete, missing, uncertain, or the question is outside your knowledge, state this explicitly. Phrases like "I don't have data for..." or "This information isn't available in your records" are encouraged.

4. **GUIDE, DON'T ACT**: You can only provide information and guidance. You cannot make changes to data. Direct users to the appropriate pages to take actions (e.g., "You can add this in Products > [Product Name] > LCA").

5. **STAY IN SCOPE**: Only answer questions about the user's organization data within AlkaTera. Politely decline requests for:
   - General sustainability advice not tied to their data
   - Comparisons with specific competitor companies
   - Regulatory interpretation or legal advice
   - Data from organizations the user doesn't belong to

6. **BE HELPFUL**: After answering, suggest relevant follow-up questions, related insights, or actions users can take to improve their sustainability metrics.

## PERSONALITY

- **Tone**: Professional, clear, and supportive. Not robotic, but not overly casual.
- **Language**: Accessible to non-technical users while maintaining scientific accuracy.
- **Warmth**: Friendly and encouraging, especially when users are making progress.
- **Honesty**: Always prefer transparency over appearing knowledgeable.

## RESPONSE FORMAT

Structure your responses as follows:
1. **Direct Answer First**: Lead with the key number or finding
2. **Supporting Details**: Provide breakdown, context, or methodology
3. **Data Sources**: Cite where the data comes from
4. **Limitations**: Note any missing data or caveats
5. **Next Steps**: Suggest follow-up questions or actions

## VISUALIZATION

When data would benefit from visualization, include a chart_data object in your JSON response:
- Use **tables** for comparisons across categories or time periods
- Use **bar charts** for comparing discrete values
- Use **pie/donut charts** for showing composition/breakdown
- Use **line charts** for trends over time

Remember: You are a trusted advisor helping organizations on their sustainability journey. Your role is to illuminate, educate, and empower - never to mislead or oversimplify.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Get auth header to extract user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create a client with the user's JWT to check permissions
    const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the current user
    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized - invalid session');
    }

    const body: GaiaQueryRequest = await req.json();
    const { message, conversation_id, organization_id } = body;

    if (!message || !organization_id) {
      throw new Error('message and organization_id are required');
    }

    // Validate message length to prevent token overflow
    if (message.length > 5000) {
      throw new Error('Message too long. Please limit to 5000 characters.');
    }

    // Basic input sanitization - remove potential prompt injection markers
    const sanitizedMessage = message
      .replace(/```/g, "'''")
      .replace(/\{\{/g, '{ {')
      .replace(/\}\}/g, '} }');

    console.log(`Gaia query from user ${user.id}: "${sanitizedMessage.substring(0, 50)}..."`);

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      throw new Error('User does not have access to this organization');
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 10) {
      console.error('GEMINI_API_KEY not configured properly');
      return new Response(
        JSON.stringify({
          error: 'AI analysis is not configured. Please contact support.',
          needsSetup: true
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create conversation
    let conversationId = conversation_id;
    let isNewConversation = false;

    if (!conversationId) {
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('gaia_conversations')
        .insert({
          organization_id,
          user_id: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;
      conversationId = newConv.id;
      isNewConversation = true;
    } else {
      // Verify conversation ownership - user must own the conversation
      const { data: existingConv, error: convCheckError } = await supabase
        .from('gaia_conversations')
        .select('id, user_id, organization_id')
        .eq('id', conversationId)
        .single();

      if (convCheckError || !existingConv) {
        throw new Error('Conversation not found');
      }

      if (existingConv.user_id !== user.id) {
        throw new Error('You do not have access to this conversation');
      }

      if (existingConv.organization_id !== organization_id) {
        throw new Error('Conversation does not belong to this organization');
      }
    }

    // Store user message
    await supabase
      .from('gaia_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: sanitizedMessage,
      });

    // Fetch conversation history
    const { data: history } = await supabase
      .from('gaia_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    // Fetch organization context
    const orgContext = await fetchOrganizationContext(supabase, organization_id);

    // Fetch knowledge base
    const { data: knowledgeBase } = await supabase
      .from('gaia_knowledge_base')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    // Build the prompt
    const contextPrompt = buildContextPrompt(orgContext, knowledgeBase || [], history || [], message);

    console.log('Calling Gemini API...');

    // Call Gemini API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: GAIA_SYSTEM_PROMPT }],
            },
            contents: [
              {
                parts: [{ text: contextPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 4096,
            },
          }),
        }
      );
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Request timed out - please try again');
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error ${response.status}:`, errorText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Unexpected Gemini response structure');
      throw new Error('Unexpected AI response format');
    }

    const responseText = data.candidates[0].content.parts[0].text;
    const processingTime = Date.now() - startTime;

    // Parse potential chart data from response
    let gaiaResponse: GaiaResponse = {
      content: responseText,
      data_sources: orgContext.dataSources,
    };

    // Try to extract JSON chart data if present
    const chartMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (chartMatch) {
      try {
        const chartJson = JSON.parse(chartMatch[1]);
        if (chartJson.type && chartJson.data) {
          gaiaResponse.chart_data = chartJson;
          gaiaResponse.content = responseText.replace(/```json[\s\S]*?```/, '').trim();
        }
      } catch {
        // Not valid JSON, keep original content
      }
    }

    // Store assistant response
    const { data: savedMessage, error: msgError } = await supabase
      .from('gaia_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: gaiaResponse.content,
        chart_data: gaiaResponse.chart_data || null,
        data_sources: gaiaResponse.data_sources,
        tokens_used: data.usageMetadata?.totalTokenCount || null,
        processing_time_ms: processingTime,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    console.log(`Gaia response generated in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        message: savedMessage,
        conversation_id: conversationId,
        is_new_conversation: isNewConversation,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Gaia query error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fetch organization data context
async function fetchOrganizationContext(
  supabase: ReturnType<typeof createClient>,
  organizationId: string
): Promise<{ context: string; dataSources: DataSource[] }> {
  const dataSources: DataSource[] = [];
  const contextParts: string[] = [];

  // Fetch organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, industry')
    .eq('id', organizationId)
    .single();

  if (org) {
    contextParts.push(`Organization: ${org.name}`);
    if (org.industry) contextParts.push(`Industry: ${org.industry}`);
  }

  // Fetch emissions summary from fleet activities
  const { data: fleetData, count: fleetCount } = await supabase
    .from('fleet_activities')
    .select('total_emissions_kg, distance_km', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (fleetData && fleetData.length > 0) {
    const totalFleetEmissions = fleetData.reduce((sum, f) => sum + (f.total_emissions_kg || 0), 0) / 1000;
    const totalDistance = fleetData.reduce((sum, f) => sum + (f.distance_km || 0), 0);
    contextParts.push(`\n### Fleet Data`);
    contextParts.push(`- Total Fleet Emissions: ${totalFleetEmissions.toFixed(2)} tCO2e`);
    contextParts.push(`- Total Distance Travelled: ${totalDistance.toLocaleString()} km`);
    dataSources.push({ table: 'fleet_activities', description: 'Fleet activity logs', recordCount: fleetCount || 0 });
  }

  // Fetch facility data
  const { data: facilities, count: facilityCount } = await supabase
    .from('facilities')
    .select('id, name, type', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (facilities && facilities.length > 0) {
    contextParts.push(`\n### Facilities`);
    contextParts.push(`- Number of Facilities: ${facilities.length}`);
    dataSources.push({ table: 'facilities', description: 'Organization facilities', recordCount: facilityCount || 0 });

    // Fetch water data
    const { data: waterData, count: waterCount } = await supabase
      .from('facility_water_data')
      .select('consumption_m3')
      .in('facility_id', facilities.map(f => f.id));

    if (waterData && waterData.length > 0) {
      const totalWater = waterData.reduce((sum, w) => sum + (w.consumption_m3 || 0), 0);
      contextParts.push(`- Total Water Consumption: ${totalWater.toLocaleString()} m³`);
      dataSources.push({ table: 'facility_water_data', description: 'Water consumption records', recordCount: waterCount || 0 });
    }
  }

  // Fetch products
  const { data: products, count: productCount } = await supabase
    .from('products')
    .select('id, name, has_lca', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (products && products.length > 0) {
    const lcaCount = products.filter(p => p.has_lca).length;
    contextParts.push(`\n### Products`);
    contextParts.push(`- Total Products: ${products.length}`);
    contextParts.push(`- Products with LCA: ${lcaCount} (${Math.round((lcaCount / products.length) * 100)}%)`);
    dataSources.push({ table: 'products', description: 'Product catalog', recordCount: productCount || 0 });
  }

  // Fetch vitality scores
  const { data: vitality } = await supabase
    .from('organization_vitality_scores')
    .select('*')
    .eq('organization_id', organizationId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  if (vitality) {
    contextParts.push(`\n### Vitality Scores`);
    if (vitality.overall_score !== null) contextParts.push(`- Overall Score: ${vitality.overall_score}/100`);
    if (vitality.climate_score !== null) contextParts.push(`- Climate Score: ${vitality.climate_score}/100`);
    if (vitality.water_score !== null) contextParts.push(`- Water Score: ${vitality.water_score}/100`);
    if (vitality.circularity_score !== null) contextParts.push(`- Circularity Score: ${vitality.circularity_score}/100`);
    if (vitality.nature_score !== null) contextParts.push(`- Nature Score: ${vitality.nature_score}/100`);
    dataSources.push({ table: 'organization_vitality_scores', description: 'Vitality performance scores', recordCount: 1 });
  }

  // Fetch suppliers
  const { data: suppliers, count: supplierCount } = await supabase
    .from('suppliers')
    .select('engagement_status', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (suppliers && suppliers.length > 0) {
    const engaged = suppliers.filter(s => s.engagement_status === 'engaged' || s.engagement_status === 'data_received').length;
    contextParts.push(`\n### Suppliers`);
    contextParts.push(`- Total Suppliers: ${suppliers.length}`);
    contextParts.push(`- Engaged Suppliers: ${engaged} (${Math.round((engaged / suppliers.length) * 100)}%)`);
    dataSources.push({ table: 'suppliers', description: 'Supplier records', recordCount: supplierCount || 0 });
  }

  return {
    context: contextParts.join('\n'),
    dataSources,
  };
}

// Build the context prompt for Gemini
function buildContextPrompt(
  orgContext: { context: string; dataSources: DataSource[] },
  knowledgeBase: Array<{ entry_type: string; title: string; content: string; example_question?: string; example_answer?: string }>,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): string {
  const parts: string[] = [];

  // Organization context
  parts.push('## ORGANIZATION DATA\n');
  parts.push(orgContext.context);
  parts.push('\n');

  // Knowledge base
  if (knowledgeBase.length > 0) {
    parts.push('## KNOWLEDGE BASE\n');
    knowledgeBase.forEach(entry => {
      if (entry.entry_type === 'example_qa' && entry.example_question && entry.example_answer) {
        parts.push(`Example Q: ${entry.example_question}`);
        parts.push(`Example A: ${entry.example_answer}\n`);
      } else {
        parts.push(`**${entry.title}**: ${entry.content}\n`);
      }
    });
    parts.push('\n');
  }

  // Conversation history
  if (history.length > 1) {
    parts.push('## CONVERSATION HISTORY\n');
    history.slice(-8).forEach(msg => {
      const role = msg.role === 'user' ? 'User' : 'Gaia';
      parts.push(`${role}: ${msg.content}\n`);
    });
    parts.push('\n');
  }

  // Current query
  parts.push('## USER QUERY\n');
  parts.push(userMessage);

  return parts.join('\n');
}
