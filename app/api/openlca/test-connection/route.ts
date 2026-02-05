import { NextRequest, NextResponse } from 'next/server';
import { OpenLCAClient } from '@/lib/openlca/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/openlca/test-connection
 *
 * Server-side connection test for the OpenLCA config dialog.
 * The browser cannot directly reach the cloud OpenLCA server (API key + rate limiting),
 * so this route acts as a proxy for the test connection button.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the server-configured OpenLCA URL and API key
    const serverUrl = process.env.OPENLCA_SERVER_URL;
    const apiKey = process.env.OPENLCA_API_KEY;
    const enabled = process.env.OPENLCA_SERVER_ENABLED === 'true';

    if (!serverUrl || !enabled) {
      return NextResponse.json({
        success: false,
        message: 'OpenLCA is not configured on the server. Set OPENLCA_SERVER_URL and OPENLCA_SERVER_ENABLED=true.',
      });
    }

    const client = new OpenLCAClient(serverUrl, apiKey);

    // Test connection: get version and process count
    const isHealthy = await client.healthCheck();

    if (!isHealthy) {
      return NextResponse.json({
        success: false,
        message: `Cannot reach OpenLCA server at ${serverUrl}`,
      });
    }

    const version = await client.getVersion();
    const processCount = await client.getProcessCount();

    return NextResponse.json({
      success: true,
      message: `Connected to OpenLCA server (v${version}). Found ${processCount.toLocaleString()} processes.`,
      version,
      processCount,
      serverUrl,
    });
  } catch (error) {
    console.error('[OpenLCA Test Connection] Error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
}
