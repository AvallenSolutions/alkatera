import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

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

    console.log(`Starting categorisation for batch: ${batchId}`);
    console.log(`GEMINI_API_KEY is ${GEMINI_API_KEY ? 'SET (length: ' + GEMINI_API_KEY.length + ')' : 'NOT SET'}`);

    if (!batchId) {
      throw new Error('batch_id is required');
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 10) {
      console.error('GEMINI_API_KEY not configured properly');

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

    console.log('GEMINI_API_KEY is configured, proceeding with AI categorisation');

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

    console.log(`Query returned ${items?.length || 0} unprocessed items`);

    if (itemsError) {
      console.error('Error querying items:', itemsError);
      throw itemsError;
    }

    if (!items || items.length === 0) {
      console.log('No items to process, marking as ready_for_review');

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

    console.log(`Processing ${itemsToProcess.length} items in batches of ${batchSize}`);

    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const batch = itemsToProcess.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(itemsToProcess.length / batchSize);

      try {
        console.log(`Processing AI batch ${batchNum}/${totalBatches} (${batch.length} items)`);
        const results = await categoriseBatch(batch);
        console.log(`AI batch ${batchNum} completed successfully`);

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

        console.log(`Saved ${processedCount} items so far`);
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

    console.log(`Batch update: processed=${totalProcessedCount}, remaining=${remainingCount}, needsMore=${needsMoreProcessing}`);

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
    } else if (errorMessage.includes('Gemini API error') || errorMessage.includes('timeout')) {
      const apiKeyStatus = GEMINI_API_KEY ? 'configured' : 'not configured';
      console.error(`Gemini API error - API key is ${apiKeyStatus}:`, errorMessage);
      userFriendlyMessage = 'AI categorization failed. The data has been uploaded - manual categorization required.';
    } else {
      userFriendlyMessage += errorMessage;
    }

    if (batchId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log(`Marking batch as failed: ${batchId}`);

        await supabase
          .from('spend_import_batches')
          .update({
            status: 'failed',
            error_message: userFriendlyMessage,
          })
          .eq('id', batchId);

        console.log(`Successfully marked batch as failed: ${batchId}`);
      } catch (cleanupError) {
        console.error('Failed to update batch status:', cleanupError);
      }
    }

    return new Response(
      JSON.stringify({
        error: userFriendlyMessage,
        technicalError: errorMessage,
        needsSetup: !GEMINI_API_KEY
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function categoriseBatch(items: SpendItem[]): Promise<CategoryResult[]> {
  const prompt = buildPrompt(items);

  console.log(`Calling Gemini API for ${items.length} items...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

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
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 20,
            topP: 0.9,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      }
    );
  } catch (fetchError: any) {
    clearTimeout(timeoutId);
    if (fetchError.name === 'AbortError') {
      console.error('Gemini API call timed out after 25 seconds');
      throw new Error('Gemini API timeout - request took too long');
    }
    console.error('Fetch error:', fetchError);
    throw fetchError;
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error ${response.status}:`, errorText);
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  console.log('Gemini API call successful, parsing response...');

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    console.error('Unexpected Gemini response structure:', JSON.stringify(data).substring(0, 500));
    return items.map(() => ({
      category: 'other',
      confidence: 50,
      reasoning: 'Failed to categorise automatically - unexpected API response',
    }));
  }

  const content = data.candidates[0].content.parts[0].text;

  try {
    const results = JSON.parse(content);

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

    console.log(`Parsed ${normalizedResults.length} results successfully`);
    return normalizedResults;
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', content?.substring(0, 500), parseError);
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
