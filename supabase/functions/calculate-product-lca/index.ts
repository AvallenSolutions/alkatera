import { createClient } from 'jsr:@supabase/supabase-js@2';

interface CalculationRequest {
  product_id: string;
  organization_id: string;
  impact_methods?: string[];
  calculation_type?: 'simple' | 'contribution' | 'monte_carlo';
  monte_carlo_runs?: number;
}

interface RecipeMaterial {
  name: string;
  quantity: number;
  unit: string;
  material_type: 'ingredient' | 'packaging';
  data_source?: string;
  data_source_id?: string;
  origin_country?: string;
  is_organic_certified?: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: requestData, error: parseError } = await req.json().catch(() => ({
      data: null,
      error: 'Invalid JSON',
    }));

    if (parseError || !requestData) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      product_id,
      organization_id,
      impact_methods = ['IPCC 2021'],
      calculation_type = 'contribution',
      monte_carlo_runs,
    } = requestData as CalculationRequest;

    if (!product_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'product_id and organization_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: config, error: configError } = await supabase
      .from('openlca_configurations')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('enabled', true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({
          error: 'OpenLCA not configured for this organization',
          message: 'Please configure OpenLCA server settings in the admin panel',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('organization_id', organization_id)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: materials, error: materialsError } = await supabase
      .from('product_materials')
      .select('*')
      .eq('product_id', product_id)
      .order('created_at');

    if (materialsError || !materials || materials.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No materials found for product',
          message: 'Add ingredients and packaging to the product recipe first',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processId = crypto.randomUUID();

    const recipe = {
      productName: product.name,
      functionalUnit: product.unit_size_unit || 'unit',
      functionalUnitAmount: product.unit_size_value || 1,
      description: product.product_description,
      ingredients: materials
        .filter((m: RecipeMaterial) => m.material_type === 'ingredient')
        .map((m: RecipeMaterial) => ({
          name: m.name,
          amount: m.quantity,
          unit: m.unit,
          openlcaProcessId:
            m.data_source === 'openlca' ? m.data_source_id : undefined,
          location: m.origin_country,
          isOrganic: m.is_organic_certified,
        })),
      packaging: materials
        .filter((m: RecipeMaterial) => m.material_type === 'packaging')
        .map((m: RecipeMaterial) => ({
          name: m.name,
          amount: m.quantity,
          unit: m.unit,
          openlcaProcessId:
            m.data_source === 'openlca' ? m.data_source_id : undefined,
          location: m.origin_country,
        })),
    };

    const calculationPayload = {
      processId,
      recipe,
      config: {
        serverUrl: config.server_url,
        databaseName: config.database_name,
        impactMethods: impact_methods,
        calculationType: calculation_type,
        preferUnitProcesses: config.prefer_unit_processes,
        withRegionalization: config.with_regionalization,
        allocationMethod: config.default_allocation_method,
        numberOfRuns: monte_carlo_runs || 1000,
      },
    };

    const openLcaResponse = await fetch(`${config.server_url}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'health',
        params: {},
      }),
    });

    if (!openLcaResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'OpenLCA server unreachable',
          message: `Cannot connect to ${config.server_url}. Ensure the server is running.`,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const calculationStartTime = Date.now();

    const result = {
      success: true,
      product_id,
      process_id: processId,
      recipe_summary: {
        ingredients_count: recipe.ingredients.length,
        packaging_count: recipe.packaging.length,
      },
      calculation: {
        started_at: new Date().toISOString(),
        status: 'queued',
        message:
          'Calculation queued. Full OpenLCA calculation will be implemented in production.',
      },
      metadata: {
        server_url: config.server_url,
        database: config.database_name,
        impact_methods,
        calculation_type,
      },
    };

    const { error: logError } = await supabase.from('calculation_logs').insert({
      organization_id,
      calculation_type: 'product_lca',
      input_data: calculationPayload,
      status: 'queued',
      environment: 'development',
      created_at: new Date().toISOString(),
    });

    if (logError) {
      console.error('Failed to log calculation:', logError);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in calculate-product-lca:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
