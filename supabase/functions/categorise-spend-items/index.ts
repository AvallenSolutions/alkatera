import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6-20250219';

interface SpendItem {
  id: string;
  batch_id: string;
  row_number: number;
  raw_description: string;
  raw_amount: number;
  raw_currency: string;
  raw_vendor: string | null;
}

interface CategoryResult {
  category: string;
  confidence: number;
  reasoning: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let batchId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    batchId = body.batch_id;
    if (!batchId) {
      throw new Error('batch_id is required');
    }

    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.length < 10) {
      console.error('ANTHROPIC_API_KEY not configured properly');

      await supabase
        .from('spend_import_batches')
        .update({
          status: 'failed',
          error_message: 'AI categorization not configured - contact support',
          ai_processing_completed_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      return new Response(
        JSON.stringify({
          error: 'AI categorization is not configured. Please contact support.',
          needsSetup: true
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    await supabase
      .from('spend_import_batches')
      .update({
        status: 'processing',
        ai_processing_started_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    const { data: items, error: itemsError } = await supabase
      .from('spend_import_items')
      .select('id, batch_id, row_number, raw_description, raw_amount, raw_currency, raw_vendor')
      .eq('batch_id', batchId)
      .is('ai_processed_at', null)
      .order('row_number', { ascending: true })
      .limit(100);
    if (itemsError) {
      console.error('Error querying items:', itemsError);
      throw itemsError;
    }

    if (!items || items.length === 0) {
      const { count } = await supabase
        .from('spend_import_items')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', batchId);

      await supabase
        .from('spend_import_batches')
        .update({
          status: 'ready_for_review',
          ai_processing_completed_at: new Date().toISOString(),
          processed_rows: count || 0,
        })
        .eq('id', batchId);

      return new Response(
        JSON.stringify({ success: true, message: 'All items processed', needsMoreProcessing: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchSize = 20;
    const itemsToProcess = items;
    let processedCount = 0;
    let hasAIError = false;
    let aiErrorMessage = '';
    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const batch = itemsToProcess.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(itemsToProcess.length / batchSize);

      try {
        const results = await categoriseBatch(batch);
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const result = results[j];

          await supabase
            .from('spend_import_items')
            .update({
              suggested_category: result.category,
              ai_confidence_score: result.confidence / 100,
              ai_reasoning: result.reasoning,
              ai_processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          processedCount++;
        }
      } catch (aiError: any) {
        console.error(`AI categorization error for batch ${batchNum}:`, aiError.message);
        hasAIError = true;
        aiErrorMessage = aiError.message;

        for (const item of batch) {
          await supabase
            .from('spend_import_items')
            .update({
              suggested_category: 'other',
              ai_confidence_score: 0,
              ai_reasoning: `AI categorization failed: ${aiError.message}`,
              ai_processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          processedCount++;
        }
      }
    }

    const { count: remainingCount } = await supabase
      .from('spend_import_items')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .is('ai_processed_at', null);

    const needsMoreProcessing = (remainingCount || 0) > 0;

    const { count: totalProcessedCount } = await supabase
      .from('spend_import_items')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .not('ai_processed_at', 'is', null);
    await supabase
      .from('spend_import_batches')
      .update({
        status: needsMoreProcessing ? 'partial' : 'ready_for_review',
        ai_processing_completed_at: needsMoreProcessing ? null : new Date().toISOString(),
        processed_rows: totalProcessedCount || 0,
      })
      .eq('id', batchId);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        totalProcessed: totalProcessedCount,
        remaining: remainingCount,
        needsMoreProcessing,
        hasAIError,
        aiErrorMessage: hasAIError ? aiErrorMessage : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error categorising spend items:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    let userFriendlyMessage = 'Upload processing failed. ';

    if (errorMessage.includes('batch_id is required')) {
      userFriendlyMessage = 'Invalid request - batch ID missing.';
    } else if (errorMessage.includes('Anthropic API error') || errorMessage.includes('timeout')) {
      const apiKeyStatus = ANTHROPIC_API_KEY ? 'configured' : 'not configured';
      console.error(`Anthropic API error - API key is ${apiKeyStatus}:`, errorMessage);
      userFriendlyMessage = 'AI categorization failed. The data has been uploaded - manual categorization required.';
    } else {
      userFriendlyMessage += errorMessage;
    }

    if (batchId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('spend_import_batches')
          .update({
            status: 'failed',
            error_message: userFriendlyMessage,
          })
          .eq('id', batchId);
      } catch (cleanupError) {
        console.error('Failed to update batch status:', cleanupError);
      }
    }

    return new Response(
      JSON.stringify({
        error: userFriendlyMessage,
        technicalError: errorMessage,
        needsSetup: !ANTHROPIC_API_KEY
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function categoriseBatch(items: SpendItem[]): Promise<CategoryResult[]> {
  const prompt = buildPrompt(items);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let response: Response;

  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        temperature: 0.1,
        system: 'You are an expense categorization expert specializing in GHG Protocol Scope 3 categories. You return ONLY valid JSON arrays, with no additional text or markdown.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
  } catch (fetchError: any) {
    clearTimeout(timeoutId);
    if (fetchError.name === 'AbortError') {
      console.error('Anthropic API call timed out after 25 seconds');
      throw new Error('Anthropic API timeout - request took too long');
    }
    console.error('Fetch error:', fetchError);
    throw fetchError;
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Anthropic API error ${response.status}:`, errorText);
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }
  const data = await response.json();

  if (!data.content || !data.content[0] || !data.content[0].text) {
    console.error('Unexpected Anthropic response structure:', JSON.stringify(data).substring(0, 500));
    return items.map(() => ({
      category: 'other',
      confidence: 50,
      reasoning: 'Failed to categorise automatically - unexpected API response',
    }));
  }

  const content = data.content[0].text;

  try {
    // Extract JSON array from the response (in case Claude wraps it in markdown)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON array found in response:', content?.substring(0, 500));
      return items.map(() => ({
        category: 'other',
        confidence: 50,
        reasoning: 'Failed to categorise automatically - no JSON array in response',
      }));
    }

    const results = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(results)) {
      console.error('Results is not an array:', typeof results);
      return items.map(() => ({
        category: 'other',
        confidence: 50,
        reasoning: 'Failed to categorise automatically - invalid response format',
      }));
    }

    if (results.length !== items.length) {
      console.warn(`Results length mismatch: got ${results.length}, expected ${items.length}`);
    }

    const normalizedResults = items.map((_, idx) => {
      const result = results[idx];
      if (!result) {
        return { category: 'other', confidence: 50, reasoning: 'No result returned' };
      }
      return {
        category: result.category || 'other',
        confidence: typeof result.confidence === 'number' ? result.confidence : 50,
        reasoning: result.reasoning || 'No reasoning provided',
      };
    });
    return normalizedResults;
  } catch (parseError) {
    console.error('Failed to parse Anthropic response:', content?.substring(0, 500), parseError);
    return items.map(() => ({
      category: 'other',
      confidence: 50,
      reasoning: 'Failed to categorise automatically - JSON parse error',
    }));
  }
}

function buildPrompt(items: SpendItem[]): string {
  const itemsList = items
    .map(
      (item, idx) =>
        `${idx + 1}. "${item.raw_description}" - ${item.raw_amount} ${item.raw_vendor ? `(${item.raw_vendor})` : ''}`
    )
    .join('\n');

  return `Categorise these expense items into GHG Protocol Scope 3 categories.

Categories:
- business_travel: Flights, hotels, taxis, rail, business trips
- purchased_services: IT, consulting, legal, software, cloud
- capital_goods: Machinery, IT hardware, furniture, vehicles
- downstream_logistics: Freight, courier, shipping
- operational_waste: Waste disposal, recycling
- marketing_materials: Printing, promotional items
- employee_commuting: Parking, bike schemes, commute support
- other: Items that don't fit above

Items:
${itemsList}

Return a JSON array with ${items.length} objects:
[{"category": "...", "confidence": 85, "reasoning": "brief reason"}, ...]

Rules:
- Use confidence 90-100 for clear matches
- Use confidence 70-89 for reasonable matches
- Use confidence 50-69 for uncertain items
- Return ONLY the JSON array, nothing else`;
}
