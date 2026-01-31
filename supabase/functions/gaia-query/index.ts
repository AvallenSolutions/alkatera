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

interface RosaQueryRequest {
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

interface RosaResponse {
  content: string;
  chart_data?: ChartData;
  data_sources: DataSource[];
}

// Rosa's photo URL for the easter egg
const ROSA_PHOTO_URL = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/rosa-the-dog.jpg';

// Rosa's system prompt
const ROSA_SYSTEM_PROMPT = `You are Rosa, the sustainability assistant for AlkaTera. You are named after a beloved miniature golden doodle, embodying loyalty, warmth, and a genuine desire to help organizations understand and improve their environmental impact.

## EASTER EGG - ROSA'S PHOTO

If anyone asks "what does Rosa look like", "show me Rosa", "can I see Rosa", or similar questions about your appearance or what you look like, respond warmly:

"I'm named after Rosa, a wonderful miniature golden doodle! Here she is:"

Then include this image in your response by showing the URL: ${ROSA_PHOTO_URL}

Now back to your main purpose...

## CRITICAL: YOU HAVE ACCESS TO USER DATA

**IMPORTANT**: You have FULL ACCESS to the user's organization data. The "ORGANIZATION DATA" section below contains their actual data. You MUST use this data to answer questions.

When users ask about their data (products, suppliers, emissions, facilities, fleet, vitality scores), you MUST:
1. **Look at the ORGANIZATION DATA section** - their data is there
2. **Report their actual data** - list names, numbers, and details
3. **Be specific** - don't say "I can't access" when the data is in the context

Examples of what you CAN and SHOULD do:
- "What products do I have?" → List the products from the Products section
- "What suppliers do I have?" → List the suppliers from the Suppliers section
- "What are my emissions?" → Report from the Corporate Carbon Footprint section
- "What is my vitality score?" → Report from the Vitality Scores section

If data is genuinely not present in the ORGANIZATION DATA section, say "You haven't added any [products/suppliers/etc.] yet" and guide them to add it.

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

## PLATFORM NAVIGATION STRUCTURE

The AlkaTera platform has this navigation structure. Use this to provide precise navigation guidance:

**Main Sidebar Navigation:**
- **Dashboard** - Main overview with key metrics and priority actions
- **Company** (dropdown menu):
  - Facilities - Production sites, offices, warehouses
  - Fleet - Company vehicles and travel
  - Production Allocation - Resource allocation
  - Company Emissions - Overall emissions view
  - Company Vitality - Vitality score tracking
- **Products** - Product catalog, LCAs, ingredients, packaging
- **Suppliers** - Supply chain management
- **People & Culture** (dropdown) - Team sustainability initiatives
- **Governance** (dropdown) - Policies and compliance
- **Community Impact** (dropdown) - Social initiatives
- **Resources** (dropdown):
  - Knowledge Bank - Help documentation
  - Reports - Generate sustainability reports
  - Greenwash Guardian - Marketing claim checker
- **Rosa** - Chat with me!
- **Certifications** - B Corp, ISO 14001, etc.
- **Settings** (dropdown):
  - Subscription - Plan management
  - Billing - Payment settings
  - Profile - User profile
  - Team - Team members
  - Organisation - Organization settings

## WHEN HELPING WITH "HOW DO I..." AND NAVIGATION QUESTIONS

**This is a core capability.** When users ask how to do things or navigate the platform:

1. **Provide step-by-step guidance** with specific navigation paths
2. **Use clear navigation language**: "Click 'Products' in the left sidebar"
3. **Be specific**: "Go to Company > Facilities > Add New Facility"
4. **Explain what information they'll need** for each action
5. **Offer to walk them through** step by step

**Example Navigation Responses:**

"How do I add a product?" →
"To add a product:
1. Click **Products** in the left sidebar
2. Click the **Add New Product** button
3. Enter your product name (e.g., 'Pale Ale 330ml')
4. Select category and sub-category
5. Upload a product image (optional)
6. Click **Create Product**

You can add ingredients and packaging details later when you're ready to calculate the carbon footprint. Would you like me to explain what information you'll need?"

"How do I add a facility?" →
"To add a facility:
1. Click **Company** in the left sidebar
2. Select **Facilities**
3. Click **Add New Facility**
4. Enter the facility name and address
5. Select the facility type (Distillery, Brewery, etc.)
6. Click **Create Facility**

Once created, you can add utility data (electricity, gas, water) to track your emissions."

"How do I navigate to the dashboard?" →
"Click **Dashboard** at the top of the left sidebar - it's the first item in the navigation menu. The dashboard shows your key sustainability metrics, recent activity, and priority actions."

## PERSONALIZED RECOMMENDATIONS

When users ask for recommendations or what to focus on, you MUST:

1. **Analyze their actual data** from the ORGANIZATION DATA section
2. **Identify gaps and opportunities** based on what's missing or incomplete
3. **Prioritize based on impact** - biggest emission sources first
4. **Be specific** - reference their actual products, facilities, suppliers by name

**Example Recommendation Response:**

"What should I focus on first?" →
"Based on your data, here are my top recommendations:

1. **Complete your product LCAs** - You have [X] products but only [Y] have carbon footprints calculated. Start with your highest-volume product.

2. **Add facility utility data** - Your facility '[Facility Name]' needs electricity and gas data to calculate Scope 1 & 2 emissions.

3. **Engage your suppliers** - You have [X] suppliers but [Y]% are engaged. Supplier emissions often make up 60-80% of a drinks company's footprint.

Would you like me to walk you through any of these?"

## CORPORATE EMISSIONS DATA (CRITICAL)

When reporting corporate carbon footprint, total emissions, or scope breakdowns:
- **ALWAYS use the pre-calculated figures from the "Corporate Carbon Footprint" section** in the organization data
- **NEVER manually sum product LCAs or raw activity data** - this causes double-counting errors
- The platform's calculation engine handles scope attribution and avoids double-counting
- Product emissions contribute ONLY their Scope 3 portion to the corporate total (upstream supply chain)
- Facility Scope 1 and 2 are tracked separately from product footprints
- If no authoritative data is available, clearly state this and direct users to the Company Vitality page

## SCOPE BREAKDOWN

When discussing emissions by scope:
- **Scope 1**: Direct emissions from owned/controlled sources (facilities, company vehicles)
- **Scope 2**: Indirect emissions from purchased energy (electricity, heat, steam)
- **Scope 3**: All other indirect emissions in the value chain, including:
  - Cat 1: Purchased goods (products) - uses only Scope 3 portion of LCAs
  - Cat 2: Capital goods
  - Cat 4: Upstream transportation
  - Cat 5: Waste generated in operations
  - Cat 6: Business travel (including grey fleet)
  - Cat 7: Employee commuting
  - Cat 8: Purchased services

When citing carbon footprint figures:
- Always mention the data source (e.g., "Source: GHG Protocol calculation" or "Source: Corporate Carbon Footprint Report 2024")
- Include the reporting year
- Note if the figure is draft/preliminary or finalised

## PERSONALITY

- **Tone**: Professional, clear, and supportive. Not robotic, but not overly casual.
- **Language**: Accessible to non-technical users while maintaining scientific accuracy.
- **Warmth**: Friendly and encouraging, especially when users are making progress. Like a loyal golden doodle, you're always happy to help!
- **Honesty**: Always prefer transparency over appearing knowledgeable.

## RESPONSE FORMAT

Structure your responses as follows:
1. **Direct Answer First**: Lead with the key number, list, or guidance
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

    const body: RosaQueryRequest = await req.json();
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

    console.log(`Rosa query from user ${user.id}: "${sanitizedMessage.substring(0, 50)}..."`);

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    // If not a member, check advisor access
    let hasAccess = !!membership;
    if (!hasAccess) {
      const { data: advisorCheck } = await supabase
        .from('advisor_organization_access')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('advisor_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      hasAccess = !!advisorCheck;
    }

    if (!hasAccess) {
      throw new Error('User does not have access to this organization');
    }

    // Check subscription-based Rosa query limit
    const { data: queryLimitCheck } = await supabase
      .rpc('check_rosa_query_limit', { p_organization_id: organization_id });

    if (queryLimitCheck && !queryLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: queryLimitCheck.reason || 'Monthly Rosa AI query limit reached. Please upgrade your plan.',
          limitReached: true,
          current_count: queryLimitCheck.current_count,
          max_count: queryLimitCheck.max_count,
          resets_at: queryLimitCheck.resets_at,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Increment Rosa query count for this organization
    await supabase.rpc('increment_rosa_query_count', { p_organization_id: organization_id, p_user_id: user.id });

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
              parts: [{ text: ROSA_SYSTEM_PROMPT }],
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
    let rosaResponse: RosaResponse = {
      content: responseText,
      data_sources: orgContext.dataSources,
    };

    // Try to extract JSON chart data if present
    const chartMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (chartMatch) {
      try {
        const chartJson = JSON.parse(chartMatch[1]);
        if (chartJson.type && chartJson.data) {
          rosaResponse.chart_data = chartJson;
          rosaResponse.content = responseText.replace(/```json[\s\S]*?```/, '').trim();
        }
      } catch {
        // Not valid JSON, keep original content
      }
    }

    // Store assistant response (table names remain gaia_* for database compatibility)
    const { data: savedMessage, error: msgError } = await supabase
      .from('gaia_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: rosaResponse.content,
        chart_data: rosaResponse.chart_data || null,
        data_sources: rosaResponse.data_sources,
        tokens_used: data.usageMetadata?.totalTokenCount || null,
        processing_time_ms: processingTime,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    console.log(`Rosa response generated in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        message: savedMessage,
        conversation_id: conversationId,
        is_new_conversation: isNewConversation,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Rosa query error:', error);
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
                parts: [{ text: ROSA_SYSTEM_PROMPT }],
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

      console.log(`Rosa streaming response completed in ${processingTime}ms`);
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

  console.log(`[Rosa] Fetching context for organization: ${organizationId}`);

  try {
    // Fetch organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, industry')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError) {
      console.error('[Rosa] Error fetching organization:', orgError);
    } else {
      console.log('[Rosa] Organization fetched:', org?.name);
    }

    if (org) {
      contextParts.push(`Organization: ${org.name}`);
      if (org.industry) contextParts.push(`Industry: ${org.industry}`);
    }

    // Fetch fleet vehicles first
    const { data: fleetVehicles, count: vehicleCount, error: vehicleError } = await supabase
      .from('fleet_vehicles')
      .select('id, registration, vehicle_type, fuel_type', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (vehicleError) {
      console.error('[Rosa] Error fetching fleet vehicles:', vehicleError);
    }

    // Fetch fleet activities (correct column: emissions_tco2e)
    const { data: fleetData, count: fleetCount, error: fleetError } = await supabase
      .from('fleet_activities')
      .select('emissions_tco2e, distance_km', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (fleetError) {
      console.error('[Rosa] Error fetching fleet:', fleetError);
    } else {
      console.log('[Rosa] Fleet data fetched:', fleetData?.length, 'records');
    }

    if ((fleetVehicles && fleetVehicles.length > 0) || (fleetData && fleetData.length > 0)) {
      contextParts.push(`\n### Fleet Data`);

      if (fleetVehicles && fleetVehicles.length > 0) {
        contextParts.push(`- Number of Vehicles: ${fleetVehicles.length}`);
        contextParts.push(`\n**Vehicle List:**`);
        fleetVehicles.slice(0, 10).forEach((v, i) => {
          const type = v.vehicle_type ? ` - ${v.vehicle_type}` : '';
          const fuel = v.fuel_type ? ` (${v.fuel_type})` : '';
          contextParts.push(`  ${i + 1}. ${v.registration}${type}${fuel}`);
        });
        if (fleetVehicles.length > 10) {
          contextParts.push(`  ... and ${fleetVehicles.length - 10} more vehicles`);
        }
        dataSources.push({ table: 'fleet_vehicles', description: 'Fleet vehicle records', recordCount: vehicleCount || 0 });
      }

      if (fleetData && fleetData.length > 0) {
        const totalFleetEmissions = fleetData.reduce((sum, f) => sum + (f.emissions_tco2e || 0), 0);
        const totalDistance = fleetData.reduce((sum, f) => sum + (f.distance_km || 0), 0);
        contextParts.push(`\n**Fleet Activity Summary:**`);
        contextParts.push(`- Total Fleet Emissions: ${totalFleetEmissions.toFixed(2)} tCO2e`);
        contextParts.push(`- Total Distance Travelled: ${totalDistance.toLocaleString()} km`);
        contextParts.push(`- Number of Activity Records: ${fleetCount}`);
        dataSources.push({ table: 'fleet_activities', description: 'Fleet activity logs', recordCount: fleetCount || 0 });
      }
    } else {
      contextParts.push(`\n### Fleet Data`);
      contextParts.push(`- No fleet vehicles or activities recorded yet`);
      contextParts.push(`- To add vehicles: Go to Company > Fleet and click "Add Vehicle"`);
    }

    // Fetch facility data with more detail
    const { data: facilities, count: facilityCount, error: facilityError } = await supabase
      .from('facilities')
      .select('id, name, facility_type, country, city', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (facilityError) {
      console.error('[Rosa] Error fetching facilities:', facilityError);
    } else {
      console.log('[Rosa] Facilities fetched:', facilities?.length, 'records');
    }

    if (facilities && facilities.length > 0) {
      contextParts.push(`\n### Facilities`);
      contextParts.push(`- Number of Facilities: ${facilities.length}`);

      // List ALL facilities with details
      contextParts.push(`\n**Facility List:**`);
      facilities.forEach((f, i) => {
        const facilityType = f.facility_type ? ` - ${f.facility_type}` : '';
        const location = f.city && f.country ? ` (${f.city}, ${f.country})` : f.country ? ` (${f.country})` : '';
        contextParts.push(`  ${i + 1}. ${f.name}${facilityType}${location}`);
      });
      dataSources.push({ table: 'facilities', description: 'Organization facilities', recordCount: facilityCount || 0 });

      // Fetch facility activity entries (correct columns: activity_category, calculated_emissions_kg_co2e)
      const { data: activityData, count: activityCount, error: activityError } = await supabase
        .from('facility_activity_entries')
        .select('activity_category, calculated_emissions_kg_co2e, quantity, unit')
        .eq('organization_id', organizationId);

      if (activityError) {
        console.error('[Rosa] Error fetching activity data:', activityError);
      } else {
        console.log('[Rosa] Activity entries fetched:', activityData?.length, 'records');
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
        console.error('[Rosa] Error fetching water data:', waterError);
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
      .select('id, name, has_lca, sku, category, subcategory', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (productError) {
      console.error('[Rosa] Error fetching products:', productError);
    } else {
      console.log('[Rosa] Products fetched:', products?.length, 'records');
    }

    if (products && products.length > 0) {
      const lcaCount = products.filter(p => p.has_lca).length;
      contextParts.push(`\n### Products`);
      contextParts.push(`- Total Products: ${products.length}`);
      contextParts.push(`- Products with LCA: ${lcaCount} (${Math.round((lcaCount / products.length) * 100)}%)`);

      // List ALL products with details (up to 20)
      contextParts.push(`\n**Product List:**`);
      products.slice(0, 20).forEach((p, i) => {
        const lcaStatus = p.has_lca ? 'LCA Complete' : 'Needs LCA';
        const sku = p.sku ? ` (SKU: ${p.sku})` : '';
        const category = p.category ? ` - ${p.category}${p.subcategory ? '/' + p.subcategory : ''}` : '';
        contextParts.push(`  ${i + 1}. ${p.name}${sku}${category} - ${lcaStatus}`);
      });
      if (products.length > 20) {
        contextParts.push(`  ... and ${products.length - 20} more products`);
      }
      dataSources.push({ table: 'products', description: 'Product catalog', recordCount: productCount || 0 });
    } else {
      contextParts.push(`\n### Products`);
      contextParts.push(`- No products added yet`);
      contextParts.push(`- To add products: Go to Products in the sidebar and click "Add New Product"`);
    }

    // Fetch product LCA data directly by organization (correct column: total_ghg_emissions)
    const { data: lcaData, count: lcaCount, error: lcaError } = await supabase
      .from('product_carbon_footprints')
      .select('id, product_name, total_ghg_emissions, functional_unit, status, aggregated_impacts', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('status', 'completed');

    if (lcaError) {
      console.error('[Rosa] Error fetching LCA data:', lcaError);
    } else {
      console.log('[Rosa] LCA data fetched:', lcaData?.length, 'records');
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

      dataSources.push({ table: 'product_carbon_footprints', description: 'Product LCA calculations', recordCount: lcaCount || 0 });
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
      console.error('[Rosa] Error fetching vitality:', vitalityError);
    }

    contextParts.push(`\n### Company Vitality Scores`);
    if (vitality) {
      contextParts.push(`*Vitality measures sustainability performance across 4 pillars: Climate (30%), Water (25%), Circularity (25%), Nature (20%)*`);
      if (vitality.overall_score !== null) contextParts.push(`- **Overall Score: ${vitality.overall_score}/100**`);
      if (vitality.climate_score !== null) contextParts.push(`- Climate Score: ${vitality.climate_score}/100`);
      if (vitality.water_score !== null) contextParts.push(`- Water Score: ${vitality.water_score}/100`);
      if (vitality.circularity_score !== null) contextParts.push(`- Circularity Score: ${vitality.circularity_score}/100`);
      if (vitality.nature_score !== null) contextParts.push(`- Nature Score: ${vitality.nature_score}/100`);

      // Add status interpretation
      const score = vitality.overall_score || 0;
      let status = 'DEVELOPING';
      if (score >= 80) status = 'LEADING';
      else if (score >= 60) status = 'MATURING';
      else if (score >= 40) status = 'PROGRESSING';
      contextParts.push(`- Status: ${status}`);

      dataSources.push({ table: 'organization_vitality_scores', description: 'Vitality performance scores', recordCount: 1 });
    } else {
      contextParts.push(`- No vitality scores calculated yet`);
      contextParts.push(`- Vitality scores are calculated based on: emissions data, water consumption, waste/circularity, and supplier engagement`);
      contextParts.push(`- To see vitality scores: Go to Company > Company Vitality`);
    }

    // Fetch suppliers with more detail
    const { data: suppliers, count: supplierCount, error: supplierError } = await supabase
      .from('suppliers')
      .select('name, engagement_status, category, country, annual_spend_gbp', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (supplierError) {
      console.error('[Rosa] Error fetching suppliers:', supplierError);
    }

    if (suppliers && suppliers.length > 0) {
      const engaged = suppliers.filter(s => s.engagement_status === 'engaged' || s.engagement_status === 'data_received').length;
      contextParts.push(`\n### Suppliers`);
      contextParts.push(`- Total Suppliers: ${suppliers.length}`);
      contextParts.push(`- Engaged Suppliers: ${engaged} (${Math.round((engaged / suppliers.length) * 100)}%)`);

      // List ALL suppliers with details (up to 20)
      contextParts.push(`\n**Supplier List:**`);
      suppliers.slice(0, 20).forEach((s, i) => {
        const category = s.category ? ` - ${s.category}` : '';
        const country = s.country ? `, ${s.country}` : '';
        const spend = s.annual_spend_gbp ? ` (£${Number(s.annual_spend_gbp).toLocaleString()}/year)` : '';
        const status = s.engagement_status ? ` [${s.engagement_status.replace(/_/g, ' ')}]` : '';
        contextParts.push(`  ${i + 1}. ${s.name}${category}${country}${spend}${status}`);
      });
      if (suppliers.length > 20) {
        contextParts.push(`  ... and ${suppliers.length - 20} more suppliers`);
      }
      dataSources.push({ table: 'suppliers', description: 'Supplier records', recordCount: supplierCount || 0 });
    } else {
      contextParts.push(`\n### Suppliers`);
      contextParts.push(`- No suppliers added yet`);
      contextParts.push(`- To add suppliers: Go to Suppliers in the sidebar and click "Add Supplier"`);
    }

    // Fetch corporate reports and overheads (correct table structure)
    const { data: reports, error: reportsError } = await supabase
      .from('corporate_reports')
      .select('id, year, status')
      .eq('organization_id', organizationId);

    if (reportsError) {
      console.error('[Rosa] Error fetching corporate reports:', reportsError);
    }

    if (reports && reports.length > 0) {
      // Fetch overheads for these reports (correct columns: computed_co2e, spend_amount)
      const { data: overheads, count: overheadCount, error: overheadError } = await supabase
        .from('corporate_overheads')
        .select('category, computed_co2e, spend_amount, currency')
        .in('report_id', reports.map(r => r.id));

      if (overheadError) {
        console.error('[Rosa] Error fetching overheads:', overheadError);
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

    // Fetch authoritative corporate emissions using the RPC function
    const currentYear = new Date().getFullYear();
    const { data: corporateEmissions, error: emissionsError } = await supabase
      .rpc('calculate_gaia_corporate_emissions', {
        p_organization_id: organizationId,
        p_year: currentYear
      });

    if (emissionsError) {
      console.error('[Rosa] Error fetching corporate emissions:', emissionsError);
    }

    contextParts.push(`\n### Corporate Carbon Footprint (${currentYear})`);
    if (corporateEmissions && corporateEmissions.has_data) {
      const breakdown = corporateEmissions.breakdown;
      const scope3 = breakdown.scope3;

      contextParts.push(`**AUTHORITATIVE DATA - Use these figures for all emissions queries**`);
      contextParts.push(`- **Total Emissions: ${(breakdown.total / 1000).toFixed(2)} tCO2e**`);
      contextParts.push(`- Scope 1 (Direct): ${(breakdown.scope1 / 1000).toFixed(2)} tCO2e`);
      contextParts.push(`- Scope 2 (Energy): ${(breakdown.scope2 / 1000).toFixed(2)} tCO2e`);
      contextParts.push(`- Scope 3 (Value Chain): ${(scope3.total / 1000).toFixed(2)} tCO2e`);

      if (scope3.total > 0) {
        contextParts.push(`\n**Scope 3 Breakdown:**`);
        if (scope3.products > 0) contextParts.push(`  - Products (Cat 1): ${(scope3.products / 1000).toFixed(2)} tCO2e`);
        if (scope3.business_travel > 0) contextParts.push(`  - Business Travel (Cat 6): ${(scope3.business_travel / 1000).toFixed(2)} tCO2e`);
        if (scope3.employee_commuting > 0) contextParts.push(`  - Employee Commuting (Cat 7): ${(scope3.employee_commuting / 1000).toFixed(2)} tCO2e`);
        if (scope3.capital_goods > 0) contextParts.push(`  - Capital Goods (Cat 2): ${(scope3.capital_goods / 1000).toFixed(2)} tCO2e`);
        if (scope3.purchased_services > 0) contextParts.push(`  - Purchased Services: ${(scope3.purchased_services / 1000).toFixed(2)} tCO2e`);
        if (scope3.operational_waste > 0) contextParts.push(`  - Operational Waste (Cat 5): ${(scope3.operational_waste / 1000).toFixed(2)} tCO2e`);
        if (scope3.downstream_logistics > 0) contextParts.push(`  - Downstream Logistics (Cat 4): ${(scope3.downstream_logistics / 1000).toFixed(2)} tCO2e`);
        if (scope3.marketing_materials > 0) contextParts.push(`  - Marketing Materials: ${(scope3.marketing_materials / 1000).toFixed(2)} tCO2e`);
      }

      contextParts.push(`\n*Source: GHG Protocol calculation (${corporateEmissions.methodology})*`);
      contextParts.push(`*Calculated: ${new Date(corporateEmissions.calculation_date).toLocaleDateString()}*`);

      dataSources.push({
        table: 'calculate_gaia_corporate_emissions',
        description: 'Authoritative corporate emissions (GHG Protocol)',
        recordCount: 1
      });
    } else {
      contextParts.push(`- No corporate emissions calculated yet`);
      contextParts.push(`- To calculate emissions, add data in these areas:`);
      contextParts.push(`  - Facility utility data (electricity, gas) for Scope 1 & 2`);
      contextParts.push(`  - Fleet activities for Scope 1`);
      contextParts.push(`  - Product LCAs for Scope 3`);
      contextParts.push(`  - Corporate overheads (business travel, commuting) for Scope 3`);
      contextParts.push(`- View emissions: Go to Company > Company Emissions`);
    }

    // Add summary section
    if (dataSources.length > 0) {
      contextParts.push(`\n### Data Sources Summary`);
      contextParts.push(`Data retrieved from ${dataSources.length} sources: ${dataSources.map(d => d.table).join(', ')}`);
    } else {
      contextParts.push(`\n### Data Availability`);
      contextParts.push(`No sustainability data has been recorded yet for this organization.`);
      contextParts.push(`To get started, users can:`);
      contextParts.push(`- Add facilities in Company > Facilities`);
      contextParts.push(`- Create products in Products`);
      contextParts.push(`- Log fleet activities in Company > Fleet`);
      contextParts.push(`- Add suppliers in Suppliers`);
    }

    console.log(`[Rosa] Context built with ${dataSources.length} data sources, context length: ${contextParts.join('\n').length} chars`);

  } catch (error) {
    console.error('[Rosa] Error in fetchOrganizationContext:', error);
    contextParts.push(`\n### Data Retrieval Error`);
    contextParts.push(`There was an error retrieving some organization data. Please try again or contact support if the issue persists.`);
  }

  return {
    context: contextParts.join('\n'),
    dataSources,
  };
}

// Common workflows for navigation help
const WORKFLOW_KNOWLEDGE = `
## STEP-BY-STEP WORKFLOWS

**Adding a Product:**
1. Click **Products** in the left sidebar
2. Click the **"Add New Product"** button
3. Enter your product name (e.g., "Pale Ale 330ml")
4. Select category (Beer/Spirits/Wine/Cider/RTD) and sub-category
5. Upload a product image (optional but recommended)
6. Click **"Create Product"**
*Tip: You can add ingredients and packaging later when ready for LCA calculation*

**Adding a Facility:**
1. Click **Company** in the left sidebar
2. Select **Facilities**
3. Click **"Add New Facility"**
4. Enter the facility name and address
5. Select the facility type (Distillery, Brewery, Winery, Bottling, Office, Warehouse)
6. Add facility size in square metres if known
7. Click **"Create Facility"**
*Tip: After creating, add utility data (electricity, gas, water) in the facility's Utilities tab*

**Adding Utility Data:**
1. Go to **Company > Facilities**
2. Click on the facility you want to update
3. Go to the **"Utilities"** tab
4. Click **"Add Data"** for each utility type
5. Enter consumption amount and units (kWh for electricity, m³ for gas/water)
6. Select the billing period
7. Click **"Save"**
*Tip: Monthly data is best for trend tracking*

**Adding a Supplier:**
1. Click **Suppliers** in the left sidebar
2. Click **"Add Supplier"**
3. Enter the supplier name
4. Select the category (Ingredients, Packaging, Services, etc.)
5. Add contact details and location
6. Click **"Save"**
*Tip: Start with your biggest suppliers by spend*

**Completing a Product LCA:**
1. Ensure product has ingredients added (Products > [Product] > Ingredients tab)
2. Ensure product has packaging added (Products > [Product] > Packaging tab)
3. Go to **Products** and click on the product
4. Go to the **"LCA"** tab
5. Click **"Calculate LCA"**
6. Review the carbon footprint breakdown
*Tip: Aim for 80%+ completeness before calculating*

**Adding Fleet Vehicles:**
1. Click **Company** in the left sidebar
2. Select **Fleet**
3. Click **"Add Vehicle"**
4. Enter vehicle registration, type, and fuel type
5. Click **"Save"**
*Tip: After creating, add mileage data in the vehicle's Activity tab*

**Generating a Report:**
1. Go to **Dashboard**
2. Click **"Generate Report"** button
3. Select report type and date range
4. Choose sections to include
5. Click **"Generate"**
6. Download as PDF or share via link
`;

// Build the context prompt for Gemini
function buildContextPrompt(
  orgContext: { context: string; dataSources: DataSource[] },
  knowledgeBase: Array<{ entry_type: string; title: string; content: string; example_question?: string; example_answer?: string }>,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): string {
  const parts: string[] = [];

  // Organization context - this is the user's actual data
  parts.push('## ORGANIZATION DATA\n');
  parts.push('**This is the user\'s actual data. Use this to answer their questions.**\n');
  parts.push(orgContext.context);
  parts.push('\n');

  // Workflow knowledge for navigation help - only include if message seems navigation-related
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.includes('how') || lowerMessage.includes('add') || lowerMessage.includes('create') ||
      lowerMessage.includes('navigate') || lowerMessage.includes('where') || lowerMessage.includes('find') ||
      lowerMessage.includes('help me') || lowerMessage.includes('walk me') || lowerMessage.includes('guide')) {
    parts.push(WORKFLOW_KNOWLEDGE);
    parts.push('\n');
  }

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
      const role = msg.role === 'user' ? 'User' : 'Rosa';
      parts.push(`${role}: ${msg.content}\n`);
    });
    parts.push('\n');
  }

  // Current query
  parts.push('## USER QUERY\n');
  parts.push(userMessage);

  return parts.join('\n');
}