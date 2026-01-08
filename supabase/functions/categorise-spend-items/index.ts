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

    if (!batchId) {
      throw new Error('batch_id is required');
    }

    if (!GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured - skipping AI categorization');

      await supabase
        .from('spend_import_batches')
        .update({
          status: 'ready_for_review',
          ai_processing_completed_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'AI categorization skipped - manual review required',
          ai_disabled: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      .select('*')
      .eq('batch_id', batchId)
      .is('ai_processed_at', null)
      .order('row_number', { ascending: true });

    if (itemsError) throw itemsError;

    if (!items || items.length === 0) {
      await supabase
        .from('spend_import_batches')
        .update({
          status: 'ready_for_review',
          ai_processing_completed_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      return new Response(
        JSON.stringify({ success: true, message: 'No items to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchSize = 20;
    let processedCount = 0;
    let hasAIError = false;
    let aiErrorMessage = '';

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      try {
        const results = await categoriseBatch(batch);

        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const result = results[j];

          await supabase
            .from('spend_import_items')
            .update({
              suggested_category: result.category,
              ai_confidence_score: result.confidence,
              ai_reasoning: result.reasoning,
              ai_processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          processedCount++;
        }
      } catch (aiError: any) {
        console.error('AI categorization error for batch:', aiError);
        hasAIError = true;
        aiErrorMessage = aiError.message;

        for (const item of batch) {
          await supabase
            .from('spend_import_items')
            .update({
              suggested_category: 'other',
              ai_confidence_score: 0,
              ai_reasoning: 'AI categorization unavailable - manual review required',
              ai_processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          processedCount++;
        }
      }
    }

    await supabase
      .from('spend_import_batches')
      .update({
        status: 'ready_for_review',
        ai_processing_completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        total: items.length,
        hasAIError,
        aiErrorMessage: hasAIError ? 'AI categorization failed - all items require manual review' : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error categorising spend items:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    let userFriendlyMessage = 'Upload processing failed. ';

    if (errorMessage.includes('batch_id is required')) {
      userFriendlyMessage = 'Invalid request - batch ID missing.';
    } else if (errorMessage.includes('Gemini API error')) {
      const apiKeyStatus = GEMINI_API_KEY ? 'configured but may be invalid' : 'not configured';
      console.error(`Gemini API error - API key is ${apiKeyStatus}:`, errorMessage);
      userFriendlyMessage = 'The data has been uploaded but automatic categorization is unavailable. You can proceed with manual categorization.';
    } else {
      userFriendlyMessage += 'An unexpected error occurred. Please try again.';
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    console.error('Unexpected Gemini response:', data);
    return items.map(() => ({
      category: 'other',
      confidence: 50,
      reasoning: 'Failed to categorise automatically',
    }));
  }

  const content = data.candidates[0].content.parts[0].text;

  try {
    const results = JSON.parse(content);

    if (!Array.isArray(results) || results.length !== items.length) {
      console.error('Invalid results structure:', results);
      return items.map(() => ({
        category: 'other',
        confidence: 50,
        reasoning: 'Failed to categorise automatically',
      }));
    }

    return results;
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', content, parseError);
    return items.map(() => ({
      category: 'other',
      confidence: 50,
      reasoning: 'Failed to categorise automatically',
    }));
  }
}

function buildPrompt(items: SpendItem[]): string {
  const itemsList = items
    .map(
      (item, idx) =>
        `${idx + 1}. "${item.raw_description}" - £${item.raw_amount} ${item.raw_vendor ? `(${item.raw_vendor})` : ''}`
    )
    .join('\n');

  return `You are an expert in GHG Protocol corporate carbon accounting. Categorise the following expense items into Scope 3 GHG Protocol categories.

Available categories:
- business_travel: Flights, hotels, taxis, rail travel, business trips
- purchased_services: IT services, consulting, legal, accounting, marketing agencies, software subscriptions, cloud services
- capital_goods: Machinery, equipment, IT hardware, furniture, vehicles, buildings
- downstream_logistics: Freight, distribution, courier services, shipping
- operational_waste: Waste disposal, recycling services, waste management
- marketing_materials: Printing, promotional items, merchandise, branded materials
- employee_commuting: Commute support, parking, bike schemes, transport allowances
- other: Items that don't clearly fit the above categories

Expense items:
${itemsList}

For each item, return a JSON array with objects containing:
- category: the matched category from the list above
- confidence: confidence score (0-100)
- reasoning: brief explanation of why this category was chosen

Rules:
- Be conservative: if unsure, use confidence score 50-70 and mark as 'other'
- High confidence (90-100): Clear, unambiguous match
- Medium confidence (70-89): Reasonable match with minor uncertainty
- Low confidence (50-69): Unclear, needs human review

Return ONLY a JSON array, no other text:
[{"category": "...", "confidence": 95, "reasoning": "..."}, ...]`;
}
