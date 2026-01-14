import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

// Rate limiting configuration
const RATE_LIMIT_QUERIES_PER_HOUR = 50;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: RATE_LIMIT_QUERIES_PER_HOUR - 1, resetIn: windowMs };
  }

  if (record.count >= RATE_LIMIT_QUERIES_PER_HOUR) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_QUERIES_PER_HOUR - record.count, resetIn: record.resetTime - now };
}

interface GaiaQueryRequest {
  message: string;
  conversation_id?: string;
  organization_id: string;
  stream?: boolean;
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

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      const resetMinutes = Math.ceil(rateLimit.resetIn / 60000);
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. You can make ${RATE_LIMIT_QUERIES_PER_HOUR} queries per hour. Try again in ${resetMinutes} minutes.`,
          rateLimited: true,
          resetIn: rateLimit.resetIn,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: GaiaQueryRequest = await req.json();
    const { message, conversation_id, organization_id, stream = false } = body;

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

    // Handle streaming response
    if (stream) {
      return handleStreamingResponse(
        supabase,
        contextPrompt,
        conversationId,
        isNewConversation,
        orgContext,
        startTime
      );
    }

    // Call Gemini API (non-streaming)
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

// Handle streaming response using Server-Sent Events
async function handleStreamingResponse(
  supabase: ReturnType<typeof createClient>,
  contextPrompt: string,
  conversationId: string,
  isNewConversation: boolean,
  orgContext: { context: string; dataSources: DataSource[] },
  startTime: number
): Promise<Response> {
  const encoder = new TextEncoder();

  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to send SSE events
  const sendEvent = async (data: unknown) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  // Start processing in the background
  (async () => {
    let fullContent = '';
    let chartData: ChartData | null = null;

    try {
      // Set up timeout for streaming request (60 seconds)
      const streamController = new AbortController();
      const streamTimeout = setTimeout(() => streamController.abort(), 60000);

      // Call Gemini streaming API
      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: streamController.signal,
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
      } catch (fetchErr: unknown) {
        clearTimeout(streamTimeout);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          await sendEvent({ type: 'error', error: 'Request timed out - please try again' });
          await writer.close();
          return;
        }
        throw fetchErr;
      }

      clearTimeout(streamTimeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini streaming error ${response.status}:`, errorText);
        await sendEvent({ type: 'error', error: `AI service error: ${response.status}` });
        await writer.close();
        return;
      }

      // Send initial metadata
      await sendEvent({
        type: 'start',
        conversation_id: conversationId,
        is_new_conversation: isNewConversation,
      });

      // Parse the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        await sendEvent({ type: 'error', error: 'Failed to read response stream' });
        await writer.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const chunk = JSON.parse(jsonStr);
              const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullContent += text;
                await sendEvent({ type: 'text', content: text });
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.startsWith('data: ')) {
        const jsonStr = buffer.slice(6);
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const chunk = JSON.parse(jsonStr);
            const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullContent += text;
              await sendEvent({ type: 'text', content: text });
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // Extract chart data if present
      const chartMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (chartMatch) {
        try {
          const chartJson = JSON.parse(chartMatch[1]);
          if (chartJson.type && chartJson.data) {
            chartData = chartJson;
            fullContent = fullContent.replace(/```json[\s\S]*?```/, '').trim();
            await sendEvent({ type: 'chart', chart_data: chartData });
          }
        } catch {
          // Not valid chart JSON
        }
      }

      // Send data sources
      await sendEvent({ type: 'sources', data_sources: orgContext.dataSources });

      const processingTime = Date.now() - startTime;

      // Save the complete message to database
      const { data: savedMessage, error: msgError } = await supabase
        .from('gaia_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullContent,
          chart_data: chartData,
          data_sources: orgContext.dataSources,
          processing_time_ms: processingTime,
        })
        .select()
        .single();

      if (msgError) {
        console.error('Error saving streamed message:', msgError);
      }

      // Send completion event
      await sendEvent({
        type: 'done',
        message_id: savedMessage?.id,
        processing_time_ms: processingTime,
      });

      console.log(`Gaia streaming response completed in ${processingTime}ms`);
    } catch (err) {
      console.error('Streaming error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await sendEvent({ type: 'error', error: errorMessage });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Fetch organization data context with comprehensive data gathering
async function fetchOrganizationContext(
  supabase: ReturnType<typeof createClient>,
  organizationId: string
): Promise<{ context: string; dataSources: DataSource[] }> {
  const dataSources: DataSource[] = [];
  const contextParts: string[] = [];

  console.log(`[Gaia] Fetching context for organization: ${organizationId}`);

  try {
    // Fetch organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, industry')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError) {
      console.error('[Gaia] Error fetching organization:', orgError);
    } else {
      console.log('[Gaia] Organization fetched:', org?.name);
    }

    if (org) {
      contextParts.push(`Organization: ${org.name}`);
      if (org.industry) contextParts.push(`Industry: ${org.industry}`);
    }

    // Fetch emissions summary from fleet activities (correct column: emissions_tco2e)
    const { data: fleetData, count: fleetCount, error: fleetError } = await supabase
      .from('fleet_activities')
      .select('emissions_tco2e, distance_km', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (fleetError) {
      console.error('[Gaia] Error fetching fleet:', fleetError);
    } else {
      console.log('[Gaia] Fleet data fetched:', fleetData?.length, 'records');
    }

    if (fleetData && fleetData.length > 0) {
      const totalFleetEmissions = fleetData.reduce((sum, f) => sum + (f.emissions_tco2e || 0), 0);
      const totalDistance = fleetData.reduce((sum, f) => sum + (f.distance_km || 0), 0);
      contextParts.push(`\n### Fleet Data`);
      contextParts.push(`- Total Fleet Emissions: ${totalFleetEmissions.toFixed(2)} tCO2e`);
      contextParts.push(`- Total Distance Travelled: ${totalDistance.toLocaleString()} km`);
      contextParts.push(`- Number of Activity Records: ${fleetCount}`);
      dataSources.push({ table: 'fleet_activities', description: 'Fleet activity logs', recordCount: fleetCount || 0 });
    }

    // Fetch facility data
    const { data: facilities, count: facilityCount, error: facilityError } = await supabase
      .from('facilities')
      .select('id, name, facility_type', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (facilityError) {
      console.error('[Gaia] Error fetching facilities:', facilityError);
    } else {
      console.log('[Gaia] Facilities fetched:', facilities?.length, 'records');
    }

    if (facilities && facilities.length > 0) {
      contextParts.push(`\n### Facilities`);
      contextParts.push(`- Number of Facilities: ${facilities.length}`);

      const facilityNames = facilities.slice(0, 5).map(f => f.name).join(', ');
      contextParts.push(`- Facilities: ${facilityNames}${facilities.length > 5 ? '...' : ''}`);
      dataSources.push({ table: 'facilities', description: 'Organization facilities', recordCount: facilityCount || 0 });

      // Fetch facility activity entries (correct columns: activity_category, calculated_emissions_kg_co2e)
      const { data: activityData, count: activityCount, error: activityError } = await supabase
        .from('facility_activity_entries')
        .select('activity_category, calculated_emissions_kg_co2e, quantity, unit')
        .eq('organization_id', organizationId);

      if (activityError) {
        console.error('[Gaia] Error fetching activity data:', activityError);
      } else {
        console.log('[Gaia] Activity entries fetched:', activityData?.length, 'records');
      }

      if (activityData && activityData.length > 0) {
        const totalEmissions = activityData.reduce((sum, a) => sum + (Number(a.calculated_emissions_kg_co2e) || 0), 0);

        // Group by category
        const byCategory = activityData.reduce((acc, a) => {
          const cat = a.activity_category || 'other';
          if (!acc[cat]) acc[cat] = { count: 0, quantity: 0 };
          acc[cat].count++;
          acc[cat].quantity += Number(a.quantity) || 0;
          return acc;
        }, {} as Record<string, { count: number; quantity: number }>);

        contextParts.push(`\n### Facility Activity Data`);
        if (totalEmissions > 0) {
          contextParts.push(`- Total Calculated Emissions: ${(totalEmissions / 1000).toFixed(2)} tCO2e`);
        }
        contextParts.push(`- Activity Records: ${activityData.length}`);

        // Show breakdown by category
        const categories = Object.entries(byCategory).slice(0, 5);
        if (categories.length > 0) {
          contextParts.push(`- Categories: ${categories.map(([cat, data]) => `${cat} (${data.count} records)`).join(', ')}`);
        }

        dataSources.push({ table: 'facility_activity_entries', description: 'Facility activity records', recordCount: activityCount || 0 });
      }

      // Fetch water data from facility_water_data
      const { data: waterData, count: waterCount, error: waterError } = await supabase
        .from('facility_water_data')
        .select('consumption_m3, facility_id')
        .in('facility_id', facilities.map(f => f.id));

      if (waterError) {
        console.error('[Gaia] Error fetching water data:', waterError);
      }

      if (waterData && waterData.length > 0) {
        const totalWater = waterData.reduce((sum, w) => sum + (Number(w.consumption_m3) || 0), 0);
        contextParts.push(`- Total Water Consumption: ${totalWater.toLocaleString()} m³`);
        dataSources.push({ table: 'facility_water_data', description: 'Water consumption records', recordCount: waterCount || 0 });
      }
    }

    // Fetch products with more detail
    const { data: products, count: productCount, error: productError } = await supabase
      .from('products')
      .select('id, name, has_lca, sku', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (productError) {
      console.error('[Gaia] Error fetching products:', productError);
    } else {
      console.log('[Gaia] Products fetched:', products?.length, 'records');
    }

    if (products && products.length > 0) {
      const lcaCount = products.filter(p => p.has_lca).length;
      contextParts.push(`\n### Products`);
      contextParts.push(`- Total Products: ${products.length}`);
      contextParts.push(`- Products with LCA: ${lcaCount} (${Math.round((lcaCount / products.length) * 100)}%)`);

      const productNames = products.slice(0, 5).map(p => p.name).join(', ');
      contextParts.push(`- Products: ${productNames}${products.length > 5 ? '...' : ''}`);
      dataSources.push({ table: 'products', description: 'Product catalog', recordCount: productCount || 0 });
    }

    // Fetch product LCA data directly by organization (correct column: total_ghg_emissions)
    const { data: lcaData, count: lcaCount, error: lcaError } = await supabase
      .from('product_lcas')
      .select('id, product_name, total_ghg_emissions, functional_unit, status, aggregated_impacts', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('status', 'completed');

    if (lcaError) {
      console.error('[Gaia] Error fetching LCA data:', lcaError);
    } else {
      console.log('[Gaia] LCA data fetched:', lcaData?.length, 'records');
    }

    if (lcaData && lcaData.length > 0) {
      contextParts.push(`\n### Product Carbon Footprints (LCA)`);
      contextParts.push(`- Completed LCAs: ${lcaData.length}`);

      // Calculate totals from aggregated_impacts
      let totalCarbonFootprint = 0;
      let totalWaterFootprint = 0;
      const productFootprints: string[] = [];

      for (const lca of lcaData.slice(0, 5)) {
        const impacts = lca.aggregated_impacts as Record<string, unknown> | null;
        const carbonFootprint = impacts?.total_carbon_footprint as number || Number(lca.total_ghg_emissions) || 0;
        const waterFootprint = impacts?.total_water as number || 0;

        totalCarbonFootprint += carbonFootprint;
        totalWaterFootprint += waterFootprint;

        if (carbonFootprint > 0) {
          productFootprints.push(`${lca.product_name}: ${carbonFootprint.toFixed(3)} kg CO2e`);
        }
      }

      if (productFootprints.length > 0) {
        contextParts.push(`- Product Carbon Footprints:`);
        productFootprints.forEach(pf => contextParts.push(`  - ${pf}`));
      }

      if (totalCarbonFootprint > 0) {
        const avgCarbonFootprint = totalCarbonFootprint / lcaData.length;
        contextParts.push(`- Average Product Carbon Footprint: ${avgCarbonFootprint.toFixed(3)} kg CO2e`);
        contextParts.push(`- Total Carbon Footprint (all products): ${totalCarbonFootprint.toFixed(3)} kg CO2e`);
      }

      if (totalWaterFootprint > 0) {
        contextParts.push(`- Total Water Footprint: ${totalWaterFootprint.toFixed(2)} L`);
      }

      dataSources.push({ table: 'product_lcas', description: 'Product LCA calculations', recordCount: lcaCount || 0 });
    }

    // Fetch vitality scores
    const { data: vitality, error: vitalityError } = await supabase
      .from('organization_vitality_scores')
      .select('*')
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vitalityError) {
      console.error('[Gaia] Error fetching vitality:', vitalityError);
    }

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
    const { data: suppliers, count: supplierCount, error: supplierError } = await supabase
      .from('suppliers')
      .select('name, engagement_status, category', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (supplierError) {
      console.error('[Gaia] Error fetching suppliers:', supplierError);
    }

    if (suppliers && suppliers.length > 0) {
      const engaged = suppliers.filter(s => s.engagement_status === 'engaged' || s.engagement_status === 'data_received').length;
      contextParts.push(`\n### Suppliers`);
      contextParts.push(`- Total Suppliers: ${suppliers.length}`);
      contextParts.push(`- Engaged Suppliers: ${engaged} (${Math.round((engaged / suppliers.length) * 100)}%)`);

      const supplierNames = suppliers.slice(0, 5).map(s => s.name).join(', ');
      contextParts.push(`- Suppliers: ${supplierNames}${suppliers.length > 5 ? '...' : ''}`);
      dataSources.push({ table: 'suppliers', description: 'Supplier records', recordCount: supplierCount || 0 });
    }

    // Fetch corporate reports and overheads (correct table structure)
    const { data: reports, error: reportsError } = await supabase
      .from('corporate_reports')
      .select('id, reporting_year, status')
      .eq('organization_id', organizationId);

    if (reportsError) {
      console.error('[Gaia] Error fetching corporate reports:', reportsError);
    }

    if (reports && reports.length > 0) {
      // Fetch overheads for these reports (correct columns: computed_co2e, spend_amount)
      const { data: overheads, count: overheadCount, error: overheadError } = await supabase
        .from('corporate_overheads')
        .select('category, computed_co2e, spend_amount, currency')
        .in('report_id', reports.map(r => r.id));

      if (overheadError) {
        console.error('[Gaia] Error fetching overheads:', overheadError);
      }

      if (overheads && overheads.length > 0) {
        const totalScope3 = overheads.reduce((sum, o) => sum + (Number(o.computed_co2e) || 0), 0) / 1000;
        const totalSpend = overheads.reduce((sum, o) => sum + (Number(o.spend_amount) || 0), 0);
        contextParts.push(`\n### Scope 3 Corporate Emissions`);
        contextParts.push(`- Total Scope 3 from Overheads: ${totalScope3.toFixed(2)} tCO2e`);
        contextParts.push(`- Total Tracked Spend: £${totalSpend.toLocaleString()}`);
        contextParts.push(`- Categories Tracked: ${new Set(overheads.map(o => o.category)).size}`);
        dataSources.push({ table: 'corporate_overheads', description: 'Corporate overhead emissions', recordCount: overheadCount || 0 });
      }
    }

    // Calculate and add total carbon footprint summary
    if (dataSources.length > 0) {
      contextParts.push(`\n### Summary`);
      contextParts.push(`Data retrieved from ${dataSources.length} sources: ${dataSources.map(d => d.table).join(', ')}`);

      // Try to calculate a total carbon footprint estimate
      let totalEstimate = 0;
      const sources: string[] = [];

      if (fleetData && fleetData.length > 0) {
        const fleetTotal = fleetData.reduce((sum, f) => sum + (f.emissions_tco2e || 0), 0);
        totalEstimate += fleetTotal;
        if (fleetTotal > 0) sources.push(`Fleet: ${fleetTotal.toFixed(2)} tCO2e`);
      }

      if (lcaData && lcaData.length > 0) {
        const lcaTotal = lcaData.reduce((sum, l) => {
          const impacts = l.aggregated_impacts as Record<string, unknown> | null;
          return sum + (impacts?.total_carbon_footprint as number || Number(l.total_ghg_emissions) || 0);
        }, 0) / 1000; // Convert to tonnes
        totalEstimate += lcaTotal;
        if (lcaTotal > 0) sources.push(`Products: ${lcaTotal.toFixed(4)} tCO2e`);
      }

      if (totalEstimate > 0) {
        contextParts.push(`\n### Estimated Total Carbon Footprint`);
        contextParts.push(`- Total: ${totalEstimate.toFixed(2)} tCO2e`);
        contextParts.push(`- Breakdown: ${sources.join(', ')}`);
        contextParts.push(`- Note: This is a partial estimate based on available data`);
      }
    } else {
      contextParts.push(`\n### Data Availability`);
      contextParts.push(`No sustainability data has been recorded yet for this organization.`);
      contextParts.push(`To get started, users can:`);
      contextParts.push(`- Add facilities in Company > Facilities`);
      contextParts.push(`- Create products in Products`);
      contextParts.push(`- Log fleet activities in Company > Fleet`);
      contextParts.push(`- Add suppliers in Suppliers`);
    }

    console.log(`[Gaia] Context built with ${dataSources.length} data sources, context length: ${contextParts.join('\n').length} chars`);

  } catch (error) {
    console.error('[Gaia] Error in fetchOrganizationContext:', error);
    contextParts.push(`\n### Data Retrieval Error`);
    contextParts.push(`There was an error retrieving some organization data. Please try again or contact support if the issue persists.`);
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