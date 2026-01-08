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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { batch_id } = await req.json();

    if (!batch_id) {
      throw new Error('batch_id is required');
    }

    // Update batch status to processing
    await supabase
      .from('spend_import_batches')
      .update({
        status: 'processing',
        ai_processing_started_at: new Date().toISOString(),
      })
      .eq('id', batch_id);

    // Fetch uncategorised items
    const { data: items, error: itemsError } = await supabase
      .from('spend_import_items')
      .select('*')
      .eq('batch_id', batch_id)
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
        .eq('id', batch_id);

      return new Response(
        JSON.stringify({ success: true, message: 'No items to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process items in batches of 20 for efficiency
    const batchSize = 20;
    let processedCount = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const results = await categoriseBatch(batch);

      // Update items with AI suggestions
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
    }

    // Update batch status
    await supabase
      .from('spend_import_batches')
      .update({
        status: 'ready_for_review',
        ai_processing_completed_at: new Date().toISOString(),
      })
      .eq('id', batch_id);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        total: items.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error categorising spend items:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
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
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
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

  // Parse JSON response
  try {
    const results = JSON.parse(content);

    // Validate that we have an array with the correct structure
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
