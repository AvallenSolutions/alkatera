// Use Deno std crypto which supports MD5 (unlike Web Crypto API)
import { crypto as stdCrypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function md5(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  // Use Deno std crypto which supports MD5
  const hashBuffer = await stdCrypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Support both credential naming conventions for flexibility
    const skyworkSecretId = Deno.env.get('SKYWORK_SECRET_ID') || Deno.env.get('SKYWORK_API_KEY');
    const skyworkSecretKey = Deno.env.get('SKYWORK_SECRET_KEY') || Deno.env.get('SKYWORK_API_SECRET');

    console.log('[Skywork Test] Checking credentials:', {
      hasSecretId: !!skyworkSecretId,
      hasSecretKey: !!skyworkSecretKey,
      secretIdSource: Deno.env.get('SKYWORK_SECRET_ID') ? 'SKYWORK_SECRET_ID' : (Deno.env.get('SKYWORK_API_KEY') ? 'SKYWORK_API_KEY' : 'NONE'),
      secretKeySource: Deno.env.get('SKYWORK_SECRET_KEY') ? 'SKYWORK_SECRET_KEY' : (Deno.env.get('SKYWORK_API_SECRET') ? 'SKYWORK_API_SECRET' : 'NONE'),
    });

    if (!skyworkSecretId || !skyworkSecretKey) {
      return new Response(
        JSON.stringify({
          error: 'Skywork credentials not configured in Supabase secrets',
          hasSecretId: !!skyworkSecretId,
          hasSecretKey: !!skyworkSecretKey,
          hint: 'Please set either SKYWORK_SECRET_ID + SKYWORK_SECRET_KEY or SKYWORK_API_KEY + SKYWORK_API_SECRET',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const signatureInput = `${skyworkSecretId}:${skyworkSecretKey}`;
    const sign = await md5(signatureInput);

    const testPayload = {
      tool: 'gen_doc',
      query: 'Write a brief test document with the title "Skywork API Test" and a paragraph saying this is a successful connection test.',
      use_network: false,
    };

    const queryParams = new URLSearchParams({
      secret_id: skyworkSecretId,
      sign: sign,
      tool: testPayload.tool,
      query: testPayload.query,
      use_network: testPayload.use_network.toString(),
    });

    const testUrl = `https://api.skywork.ai/open/sse?${queryParams.toString()}`;

    console.log('Testing Skywork SSE API...');
    console.log('Secret ID:', skyworkSecretId.substring(0, 8) + '...');
    console.log('Signature:', sign);
    console.log('URL:', testUrl.substring(0, 100) + '...');

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          success: false,
          status: response.status,
          statusText: response.statusText,
          secretId: skyworkSecretId,
          signature: sign,
          error: errorText,
          note: 'SSE endpoint requires GET request with query parameters',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let sseData = '';
    let eventCount = 0;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      const timeout = setTimeout(() => {
        reader.cancel();
      }, 30000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          sseData += chunk;
          eventCount++;

          console.log('Received chunk:', chunk.substring(0, 200));

          if (sseData.length > 5000 || eventCount > 50) {
            break;
          }
        }
      } finally {
        clearTimeout(timeout);
        reader.releaseLock();
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: response.status,
        secretId: skyworkSecretId,
        signature: sign,
        eventCount: eventCount,
        sseDataPreview: sseData.substring(0, 1000),
        fullSSEData: sseData,
        note: 'SSE connection successful! Data is streaming.',
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