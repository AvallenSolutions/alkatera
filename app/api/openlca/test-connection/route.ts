import { NextRequest, NextResponse } from 'next/server';
import { createOpenLCAClientForDatabase, isAgribalyseConfigured } from '@/lib/openlca/client';

export const dynamic = 'force-dynamic';

interface ServerStatus {
  connected: boolean;
  message: string;
  version?: string;
  processCount?: number;
  serverUrl?: string;
}

/**
 * POST /api/openlca/test-connection
 *
 * Server-side connection test for the OpenLCA config dialog.
 * Tests both ecoinvent and Agribalyse gdt-server instances.
 * The browser cannot directly reach the cloud OpenLCA servers (API key + rate limiting),
 * so this route acts as a proxy for the test connection button.
 *
 * Response format (backward-compatible):
 * - Top-level success/message reflects ecoinvent status
 * - ecoinvent: { connected, message, version, processCount }
 * - agribalyse: { connected, message, version, processCount } (if configured)
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

    const enabled = process.env.OPENLCA_SERVER_ENABLED === 'true';
    if (!enabled) {
      return NextResponse.json({
        success: false,
        message: 'OpenLCA is not configured on the server. Set OPENLCA_SERVER_URL and OPENLCA_SERVER_ENABLED=true.',
      });
    }

    // Test ecoinvent server
    const ecoinventStatus = await testServer('ecoinvent');

    // Test Agribalyse server (only if configured)
    let agribalyseStatus: ServerStatus | null = null;
    if (isAgribalyseConfigured()) {
      agribalyseStatus = await testServer('agribalyse');
    }

    // Build response (backward-compatible: top-level = ecoinvent status)
    return NextResponse.json({
      success: ecoinventStatus.connected,
      message: ecoinventStatus.message,
      version: ecoinventStatus.version,
      processCount: ecoinventStatus.processCount,
      serverUrl: ecoinventStatus.serverUrl,
      // Dual-server status details
      ecoinvent: ecoinventStatus,
      agribalyse: agribalyseStatus || {
        connected: false,
        message: 'Agribalyse server not configured. Set OPENLCA_AGRIBALYSE_SERVER_URL to enable.',
      },
    });
  } catch (error) {
    console.error('[OpenLCA Test Connection] Error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
}

async function testServer(source: 'ecoinvent' | 'agribalyse'): Promise<ServerStatus> {
  const label = source === 'agribalyse' ? 'Agribalyse' : 'ecoinvent';

  const client = createOpenLCAClientForDatabase(source);
  if (!client) {
    return {
      connected: false,
      message: `${label} server URL not configured.`,
    };
  }

  try {
    const isHealthy = await client.healthCheck();
    if (!isHealthy) {
      return {
        connected: false,
        message: `Cannot reach ${label} OpenLCA server.`,
      };
    }

    const version = await client.getVersion();
    const processCount = await client.getProcessCount();

    return {
      connected: true,
      message: `Connected to ${label} OpenLCA server (v${version}). Found ${processCount.toLocaleString()} processes.`,
      version,
      processCount,
    };
  } catch (error) {
    return {
      connected: false,
      message: `${label} server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
