import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function md5(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const skyworkSecretId = Deno.env.get('SKYWORK_SECRET_ID');
    const skyworkSecretKey = Deno.env.get('SKYWORK_SECRET_KEY');

    if (!skyworkSecretId || !skyworkSecretKey) {
      return new Response(
        JSON.stringify({
          error: 'Skywork credentials not configured in Supabase secrets',
          hasSecretId: !!skyworkSecretId,
          hasSecretKey: !!skyworkSecretKey,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const signatureInput = `${skyworkSecretId}:${skyworkSecretKey}`;
    const sign = await md5(signatureInput);

    const testUrl = `https://api.skywork.ai/open/sse?secret_id=${skyworkSecretId}&sign=${sign}`;

    const testPayload = {
      tool: 'gen_ppt',
      query: 'Generate a simple test PowerPoint with one slide saying "Hello World"',
      use_network: false,
    };

    console.log('Testing Skywork API...');
    console.log('Secret ID:', skyworkSecretId.substring(0, 8) + '...');
    console.log('Signature:', sign);
    console.log('URL:', testUrl);

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        secretId: skyworkSecretId,
        signature: sign,
        testUrl: testUrl,
        responseBody: responseText.substring(0, 500),
        fullResponse: responseText,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
