import { createClient } from 'npm:@supabase/supabase-js@2';

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

// Skywork tool mapping
const SKYWORK_TOOLS = {
  pptx: 'gen_ppt',
  docx: 'gen_doc',
  xlsx: 'gen_excel',
} as const;

// Pure JavaScript MD5 implementation (no external dependencies)
function md5(string: string): string {
  function rotateLeft(value: number, shift: number): number {
    return (value << shift) | (value >>> (32 - shift));
  }

  function addUnsigned(x: number, y: number): number {
    const x8 = x & 0x80000000;
    const y8 = y & 0x80000000;
    const x4 = x & 0x40000000;
    const y4 = y & 0x40000000;
    const result = (x & 0x3fffffff) + (y & 0x3fffffff);
    if (x4 & y4) return result ^ 0x80000000 ^ x8 ^ y8;
    if (x4 | y4) {
      if (result & 0x40000000) return result ^ 0xc0000000 ^ x8 ^ y8;
      return result ^ 0x40000000 ^ x8 ^ y8;
    }
    return result ^ x8 ^ y8;
  }

  function F(x: number, y: number, z: number): number { return (x & y) | (~x & z); }
  function G(x: number, y: number, z: number): number { return (x & z) | (y & ~z); }
  function H(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function I(x: number, y: number, z: number): number { return y ^ (x | ~z); }

  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str: string): number[] {
    const wordCount = ((str.length + 8) >>> 6) + 1;
    const wordArray = new Array(wordCount * 16).fill(0);
    let bytePos = 0;
    let byteCount = 0;
    while (byteCount < str.length) {
      bytePos = (byteCount >>> 2);
      wordArray[bytePos] |= (str.charCodeAt(byteCount) & 0xff) << ((byteCount % 4) * 8);
      byteCount++;
    }
    bytePos = (byteCount >>> 2);
    wordArray[bytePos] |= 0x80 << ((byteCount % 4) * 8);
    wordArray[wordCount * 16 - 2] = str.length * 8;
    return wordArray;
  }

  function wordToHex(value: number): string {
    let hex = '';
    for (let i = 0; i <= 3; i++) {
      const byte = (value >>> (i * 8)) & 0xff;
      hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
  }

  const x = convertToWordArray(string);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;

    a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070db);
    b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);

    a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
    d = GG(d, a, b, c, x[k + 10], S22, 0x02441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);

    a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x04881d05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);

    a = II(a, b, c, d, x[k + 0], S41, 0xf4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
    c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
    b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
    d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6], S43, 0xa3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
    d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
    b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);

    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
}

interface SkyworkResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}

async function callSkyworkAPI(tool: string, query: string, timeoutMs = 180000): Promise<SkyworkResult> {
  // Support both credential naming conventions for flexibility
  const secretId = Deno.env.get('SKYWORK_SECRET_ID') || Deno.env.get('SKYWORK_API_KEY');
  const secretKey = Deno.env.get('SKYWORK_SECRET_KEY') || Deno.env.get('SKYWORK_API_SECRET');

  console.log('[Skywork] Checking credentials:', {
    hasSecretId: !!secretId,
    hasSecretKey: !!secretKey,
    secretIdVar: Deno.env.get('SKYWORK_SECRET_ID') ? 'SKYWORK_SECRET_ID' : (Deno.env.get('SKYWORK_API_KEY') ? 'SKYWORK_API_KEY' : 'NONE'),
    secretKeyVar: Deno.env.get('SKYWORK_SECRET_KEY') ? 'SKYWORK_SECRET_KEY' : (Deno.env.get('SKYWORK_API_SECRET') ? 'SKYWORK_API_SECRET' : 'NONE'),
  });

  if (!secretId || !secretKey) {
    console.error('[Skywork] ❌ API credentials not configured. Please set either:');
    console.error('  - SKYWORK_SECRET_ID and SKYWORK_SECRET_KEY, or');
    console.error('  - SKYWORK_API_KEY and SKYWORK_API_SECRET');
    return { success: false, error: 'Credentials not configured' };
  }

  const signatureInput = `${secretId}:${secretKey}`;
  const sign = md5(signatureInput);

  const queryParams = new URLSearchParams({
    secret_id: secretId,
    sign: sign,
    tool,
    query,
    use_network: 'false',
  });

  const sseUrl = `https://api.skywork.ai/open/sse?${queryParams.toString()}`;

  console.log('[Skywork] Establishing SSE connection...');

  try {
    const response = await fetch(sseUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `SSE connection failed: ${response.status} ${errorText}`,
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { success: false, error: 'Failed to get response reader' };
    }

    const decoder = new TextDecoder();
    let documentUrl: string | null = null;
    let isComplete = false;

    const timeoutHandle = setTimeout(() => {
      reader.cancel();
    }, timeoutMs);

    try {
      let buffer = '';
      let eventCount = 0;
      let lastEventTime = Date.now();

      while (!isComplete) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[Skywork] SSE stream ended. Total events:', eventCount);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            eventCount++;
            lastEventTime = Date.now();

            // Log raw data for debugging (first 200 chars)
            if (eventCount <= 10 || eventCount % 50 === 0) {
              console.log(`[Skywork] Event ${eventCount}:`, data.substring(0, 200));
            }

            if (data.startsWith('/open/message')) {
              const url = new URL(data, 'https://api.skywork.ai');
              const sessionId = url.searchParams.get('sessionId');
              console.log('[Skywork] Session established:', sessionId);
              continue;
            }

            try {
              const jsonData = JSON.parse(data);

              // Skip ping events silently
              if (jsonData.method === 'ping') continue;

              // Log any other method/event type
              if (jsonData.method) {
                console.log('[Skywork] Method:', jsonData.method);
              }

              // Check for download URL in various possible locations
              const downloadUrl = jsonData.result?.download_url ||
                                  jsonData.download_url ||
                                  jsonData.data?.download_url ||
                                  jsonData.result?.data?.download_url;

              if (downloadUrl) {
                documentUrl = downloadUrl;
                console.log('[Skywork] Document ready:', documentUrl);
                isComplete = true;
                break;
              }

              // Check for completion status
              if (jsonData.result?.status === 'completed' || jsonData.status === 'completed') {
                console.log('[Skywork] Generation completed, checking for URL in result:', JSON.stringify(jsonData.result || jsonData).substring(0, 500));
              }

              // Check for errors
              if (jsonData.error) {
                console.error('[Skywork] API error:', JSON.stringify(jsonData.error));
                clearTimeout(timeoutHandle);
                return {
                  success: false,
                  error: `Skywork API error: ${JSON.stringify(jsonData.error)}`,
                };
              }

              // Log any result that isn't ping/session
              if (jsonData.result && !jsonData.method) {
                console.log('[Skywork] Result received:', JSON.stringify(jsonData.result).substring(0, 300));
              }

            } catch {
              // Log non-JSON data if it's not empty
              if (data.trim() && data !== '[DONE]') {
                console.log('[Skywork] Non-JSON data:', data.substring(0, 100));
              }
            }
          }
        }
      }

      clearTimeout(timeoutHandle);
      console.log('[Skywork] Processing complete. Events received:', eventCount, 'Document URL:', documentUrl ? 'yes' : 'no');

      if (documentUrl) {
        return { success: true, downloadUrl: documentUrl };
      }

      return { success: false, error: `No download URL received after ${eventCount} events` };

    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    console.error('[Skywork] Error:', error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Store report_config_id in outer scope for error handling
  let report_config_id: string | undefined;

  try {
    console.log('🔵 [Sustainability Report] Starting report generation...');

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ [Auth] Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('❌ [Auth] User authentication failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ [Auth] User authenticated:', user.id);

    // 2. Parse request (only read body once!)
    const body = await req.json();
    report_config_id = body.report_config_id;

    if (!report_config_id) {
      console.error('❌ [Request] Missing report_config_id');
      return new Response(JSON.stringify({ error: 'Missing report_config_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔵 [Config] Fetching report configuration:', report_config_id);

    // 3. Fetch report configuration
    const { data: reportConfig, error: configError } = await supabaseClient
      .from('generated_reports')
      .select('*')
      .eq('id', report_config_id)
      .single();

    if (configError) {
      console.error('❌ [Config] Error fetching report configuration:', configError);
      return new Response(JSON.stringify({
        error: 'Report configuration not found',
        details: configError.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!reportConfig) {
      console.error('❌ [Config] Report configuration not found');
      return new Response(JSON.stringify({ error: 'Report configuration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ [Config] Report configuration loaded:', {
      org: reportConfig.organization_id,
      year: reportConfig.report_year,
      format: reportConfig.output_format,
    });

    // 4. Update status to 'generating'
    console.log('🔵 [Status] Updating status to generating...');
    await supabaseClient
      .from('generated_reports')
      .update({ status: 'generating' })
      .eq('id', report_config_id);

    // 5. Aggregate data with multi-year support
    console.log('🔵 [Data] Aggregating report data...');
    const aggregatedData = await aggregateReportData(
      supabaseClient,
      reportConfig.organization_id,
      reportConfig.report_year,
      reportConfig.sections,
      reportConfig.is_multi_year,
      reportConfig.report_years
    );

    console.log('✅ [Data] Data aggregation complete:', {
      hasOrg: !!aggregatedData.organization,
      hasEmissions: !!aggregatedData.emissions?.total,
      productCount: aggregatedData.products?.length || 0,
    });

    // 6. Construct Skywork query
    console.log('🔵 [Skywork] Constructing query...');
    const skyworkQuery = constructSkyworkQuery(reportConfig, aggregatedData);
    console.log('✅ [Skywork] Query constructed:', skyworkQuery.length, 'characters');

    // 7. Call Skywork API
    const tool = SKYWORK_TOOLS[reportConfig.output_format as keyof typeof SKYWORK_TOOLS] || 'gen_ppt';

    console.log('🔵 [Skywork] Calling API with tool:', tool);
    console.log('🔵 [Skywork] Query length:', skyworkQuery.length);
    console.log('🔵 [Skywork] Query preview:', skyworkQuery.substring(0, 200) + '...');

    // 8. Generate document using Skywork
    const skyworkResult = await callSkyworkAPI(tool, skyworkQuery, 180000);

    if (!skyworkResult.success) {
      if (skyworkResult.error === 'Credentials not configured') {
        console.error('❌ [Skywork] API credentials not configured');

        // Return mock data for testing without Skywork
        const mockDocumentUrl = 'https://example.com/mock-report.pptx';

        await supabaseClient
          .from('generated_reports')
          .update({
            status: 'completed',
            skywork_query: skyworkQuery,
            document_url: mockDocumentUrl,
            data_snapshot: aggregatedData,
            generated_at: new Date().toISOString(),
          })
          .eq('id', report_config_id);

        return new Response(
          JSON.stringify({
            success: true,
            report_id: report_config_id,
            document_url: mockDocumentUrl,
            note: 'Using mock data - Skywork API credentials not configured',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.error('❌ [Skywork] Generation failed:', skyworkResult.error);
      throw new Error(`Skywork API error: ${skyworkResult.error}`);
    }

    const documentUrl = skyworkResult.downloadUrl;
    if (!documentUrl) {
      console.error('❌ [Skywork] No download URL received');
      throw new Error('No download URL received from Skywork');
    }

    console.log('✅ [Skywork] Final document URL:', documentUrl);

    // 9. Update report with success
    await supabaseClient
      .from('generated_reports')
      .update({
        status: 'completed',
        skywork_query: skyworkQuery,
        document_url: documentUrl,
        data_snapshot: aggregatedData,
        generated_at: new Date().toISOString(),
      })
      .eq('id', report_config_id);

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report_config_id,
        document_url: documentUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ [Error] Report generation error:', error);

    // Try to update report status to failed (without re-reading body)
    if (report_config_id) {
      try {
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
          );

          await supabaseClient
            .from('generated_reports')
            .update({
              status: 'failed',
              error_message: error.message,
            })
            .eq('id', report_config_id);
        }
      } catch (updateError) {
        console.error('❌ [Error] Failed to update report status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred while generating the report',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Data aggregation function with multi-year support
async function aggregateReportData(
  supabaseClient: any,
  organizationId: string,
  reportYear: number,
  sections: string[],
  isMultiYear?: boolean,
  reportYears?: number[]
): Promise<any> {
  const data: any = {
    organization: {},
    emissions: {},
    emissionsTrends: [],
    products: [],
    dataAvailability: {
      hasOrganization: false,
      hasEmissions: false,
      hasProducts: false,
    },
  };

  try {
    console.log('🔵 [Data] Fetching organization info...');
    // Fetch organization info
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('name, industry_sector, description')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      console.error('❌ [Data] Error fetching organization:', orgError.message);
    } else if (org) {
      data.organization = org;
      data.dataAvailability.hasOrganization = true;
      console.log('✅ [Data] Organization loaded:', org.name);
    }
  } catch (error) {
    console.error('❌ [Data] Exception fetching organization:', error);
  }

  // Fetch emissions data if section is included
  if (sections.includes('scope-1-2-3')) {
    try {
      console.log('🔵 [Data] Fetching emissions data for year:', reportYear);
      // Query corporate reports for the year
      const { data: corporateReport, error: reportError } = await supabaseClient
        .from('corporate_reports')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('year', reportYear)
        .maybeSingle();

      if (reportError) {
        console.log('⚠️ [Data] Corporate reports query error:', reportError.message);
      } else if (corporateReport) {
        data.emissions = {
          scope1: corporateReport.breakdown_json?.scope1 || 0,
          scope2: corporateReport.breakdown_json?.scope2 || 0,
          scope3: corporateReport.breakdown_json?.scope3 || 0,
          total: corporateReport.total_emissions || 0,
          year: reportYear,
        };
        data.dataAvailability.hasEmissions = true;
        console.log('✅ [Data] Emissions loaded:', data.emissions.total, 'tCO2e');
      } else {
        console.log('ℹ️ [Data] No emissions data for year:', reportYear);
      }

      // Fetch multi-year data if enabled
      if (isMultiYear && reportYears && reportYears.length > 1) {
        console.log('🔵 [Data] Fetching multi-year trends for years:', reportYears);
        const { data: historicalReports, error: histError } = await supabaseClient
          .from('corporate_reports')
          .select('year, total_emissions, breakdown_json')
          .eq('organization_id', organizationId)
          .in('year', reportYears)
          .order('year', { ascending: true });

        if (histError) {
          console.log('⚠️ [Data] Multi-year query error:', histError.message);
        } else if (historicalReports && historicalReports.length > 0) {
          data.emissionsTrends = historicalReports.map((r: any) => ({
            year: r.year,
            scope1: r.breakdown_json?.scope1 || 0,
            scope2: r.breakdown_json?.scope2 || 0,
            scope3: r.breakdown_json?.scope3 || 0,
            total: r.total_emissions || 0,
          }));

          // Calculate year-over-year changes
          if (data.emissionsTrends.length > 1) {
            for (let i = 1; i < data.emissionsTrends.length; i++) {
              const current = data.emissionsTrends[i];
              const previous = data.emissionsTrends[i - 1];
              current.yoyChange = previous.total > 0
                ? ((current.total - previous.total) / previous.total * 100).toFixed(2)
                : 'N/A';
            }
          }
          console.log('✅ [Data] Multi-year trends loaded:', data.emissionsTrends.length, 'years');
        }
      }
    } catch (error) {
      console.error('❌ [Data] Exception fetching emissions:', error);
    }
  }

  // Fetch product data if section is included
  if (sections.includes('product-footprints')) {
    try {
      console.log('🔵 [Data] Fetching product LCA data...');
      const { data: products, error: productsError } = await supabaseClient
        .from('product_lcas')
        .select('product_name, functional_unit, aggregated_impacts')
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .limit(20);

      if (productsError) {
        console.log('⚠️ [Data] Product LCAs query error:', productsError.message);
      } else if (products && products.length > 0) {
        data.products = products.map((p: any) => ({
          name: p.product_name,
          functionalUnit: p.functional_unit,
          climateImpact: p.aggregated_impacts?.climate_change || 0,
        }));
        data.dataAvailability.hasProducts = true;
        console.log('✅ [Data] Products loaded:', data.products.length);
      } else {
        console.log('ℹ️ [Data] No completed product LCAs found');
      }
    } catch (error) {
      console.error('❌ [Data] Exception fetching products:', error);
    }
  }

  console.log('📊 [Data] Data availability summary:', data.dataAvailability);
  return data;
}

// Construct Skywork query with multi-year support
function constructSkyworkQuery(config: any, data: any): string {
  const formatName = config.output_format === 'pptx' ? 'PowerPoint presentation' :
                    config.output_format === 'docx' ? 'Word document' :
                    'Excel workbook';

  const trendSection = data.emissionsTrends && data.emissionsTrends.length > 1 ? `
---
# MULTI-YEAR EMISSIONS TRENDS

${data.emissionsTrends.map((trend: any) => `
## Year ${trend.year}
- **Total Emissions:** ${trend.total.toFixed(2)} tCO2e
- **Scope 1:** ${trend.scope1.toFixed(2)} tCO2e
- **Scope 2:** ${trend.scope2.toFixed(2)} tCO2e
- **Scope 3:** ${trend.scope3.toFixed(2)} tCO2e
${trend.yoyChange ? `- **Year-over-Year Change:** ${trend.yoyChange}%` : ''}
`).join('\n')}

**Key Insights:**
- Analyze trends showing improvement or areas requiring attention
- Highlight progress toward reduction targets
- Show trajectory and momentum
` : '';

  return `
Generate a professional sustainability report ${formatName} for ${data.organization.name} for the year ${config.report_year}.

**CRITICAL INSTRUCTIONS:**
1. Use ONLY the data provided below. Do NOT generate, estimate, or create any figures.
2. If data is missing, explicitly state "Data not available for this period."
3. Format the report for: ${config.audience}
4. Ensure compliance with: ${config.standards.join(', ')}
5. Use company branding: Primary Color: ${config.primary_color}, Secondary Color: ${config.secondary_color}
${config.is_multi_year ? '6. Include multi-year trend analysis with year-over-year comparisons' : ''}

---
# ORGANIZATION INFORMATION

- **Company Name:** ${data.organization.name || 'N/A'}
- **Industry:** ${data.organization.industry_sector || 'N/A'}
- **Reporting Period:** ${config.reporting_period_start} to ${config.reporting_period_end}
${config.is_multi_year && config.report_years ? `- **Years Covered:** ${config.report_years.join(', ')}` : ''}

---
# GREENHOUSE GAS EMISSIONS SUMMARY (${config.report_year})

${data.emissions.total ? `
## Total Emissions: ${data.emissions.total.toFixed(2)} tCO2e

### Scope 1 Emissions: ${data.emissions.scope1?.toFixed(2) || '0.00'} tCO2e
Direct emissions from owned or controlled sources.

### Scope 2 Emissions: ${data.emissions.scope2?.toFixed(2) || '0.00'} tCO2e
Indirect emissions from purchased energy.

### Scope 3 Emissions: ${data.emissions.scope3?.toFixed(2) || '0.00'} tCO2e
All other indirect emissions in the value chain.
` : 'Emissions data not available for this period.'}

${trendSection}

---
# PRODUCT CARBON FOOTPRINTS

${data.products.length > 0 ? data.products.map((p: any) => `
## ${p.name}
- **Functional Unit:** ${p.functionalUnit}
- **Climate Impact:** ${p.climateImpact.toFixed(4)} kg CO2e per unit
`).join('\n') : 'Product data not available for this period.'}

---
# REPORT SECTIONS TO INCLUDE

${config.sections.map((s: string) => `- ${s}`).join('\n')}

---
# FORMATTING REQUIREMENTS

- Document Type: ${formatName}
- Audience: ${config.audience}
- Include professional charts and visualizations where appropriate
${config.is_multi_year ? '- Include trend charts showing multi-year progress' : ''}
- Use executive summary format
- Apply company branding colors

Generate the complete sustainability report now.
`.trim();
}
