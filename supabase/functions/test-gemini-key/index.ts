const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  // Keep checking for GEMINI_API_KEY too for backwards compatibility / migration status
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

  const response = {
    anthropic: {
      hasKey: !!ANTHROPIC_API_KEY,
      keyLength: ANTHROPIC_API_KEY?.length || 0,
      keyPrefix: ANTHROPIC_API_KEY?.substring(0, 10) || 'NOT SET',
    },
    gemini: {
      hasKey: !!GEMINI_API_KEY,
      keyLength: GEMINI_API_KEY?.length || 0,
      keyPrefix: GEMINI_API_KEY?.substring(0, 10) || 'NOT SET',
      note: 'Gemini key only used for embeddings (text-embedding-004). All LLM calls now use Anthropic Claude.',
    },
    allEnvVars: Object.keys(Deno.env.toObject()).filter(k => !k.includes('SUPABASE')),
  };

  return new Response(
    JSON.stringify(response, null, 2),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
});
