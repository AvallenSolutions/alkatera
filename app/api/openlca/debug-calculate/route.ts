import { NextRequest, NextResponse } from 'next/server';
import { createOpenLCAClientForDatabase } from '@/lib/openlca/client';

export const dynamic = 'force-dynamic';

/**
 * TEMPORARY DEBUG ENDPOINT — DELETE AFTER DIAGNOSING THE 500 ERROR
 *
 * No auth required. Tests OpenLCA calculation directly and returns
 * detailed error information so we can see what's actually failing
 * in production (Netlify).
 *
 * Usage: POST /api/openlca/debug-calculate
 * Body: { "processId": "ea9fe161-eaf8-3958-bcd1-7e5e2a7aa379", "database": "agribalyse" }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const log: string[] = [];
  const addLog = (msg: string) => {
    const elapsed = Date.now() - startTime;
    const entry = `[${elapsed}ms] ${msg}`;
    log.push(entry);
    console.log(`[DEBUG-CALC] ${entry}`);
  };

  try {
    const body = await request.json();
    const { processId, database = 'agribalyse' } = body;

    if (!processId) {
      return NextResponse.json({ error: 'Missing processId' }, { status: 400 });
    }

    addLog(`Starting calculation: processId=${processId}, database=${database}`);

    // Check env vars
    addLog(`OPENLCA_SERVER_ENABLED=${process.env.OPENLCA_SERVER_ENABLED}`);
    addLog(`OPENLCA_SERVER_URL=${process.env.OPENLCA_SERVER_URL ? 'SET' : 'NOT SET'}`);
    addLog(`OPENLCA_AGRIBALYSE_SERVER_URL=${process.env.OPENLCA_AGRIBALYSE_SERVER_URL || 'NOT SET'}`);
    addLog(`OPENLCA_AGRIBALYSE_API_KEY=${process.env.OPENLCA_AGRIBALYSE_API_KEY ? 'SET (' + process.env.OPENLCA_AGRIBALYSE_API_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);

    // Create client
    addLog('Creating OpenLCA client...');
    const client = createOpenLCAClientForDatabase(database as any);
    if (!client) {
      addLog('FAILED: Client is null');
      return NextResponse.json({ error: 'Client creation failed', log }, { status: 503 });
    }
    addLog('Client created');

    // Health check
    addLog('Running health check...');
    const isHealthy = await client.healthCheck();
    addLog(`Health check: ${isHealthy ? 'OK' : 'FAILED'}`);
    if (!isHealthy) {
      return NextResponse.json({ error: 'Server not reachable', log }, { status: 503 });
    }

    // Get process info
    addLog('Fetching process info...');
    let processInfo: any;
    try {
      processInfo = await client.getProcess(processId);
      addLog(`Process found: ${processInfo?.name || 'unknown'}`);
    } catch (err) {
      addLog(`Process fetch FAILED: ${err instanceof Error ? err.message : String(err)}`);
      return NextResponse.json({ error: 'Process not found', log }, { status: 404 });
    }

    // Calculate midpoint only (faster, proves the calculation works)
    addLog('Starting midpoint calculation (ReCiPe 2016 Midpoint (H))...');
    let midpointImpacts: any[] = [];
    try {
      midpointImpacts = await client.calculateProcess(processId, 'ReCiPe 2016 Midpoint (H)', 1);
      addLog(`Midpoint calculation complete: ${midpointImpacts.length} impact categories`);

      // Find climate change value
      const climate = midpointImpacts.find((i: any) => {
        const name = (i.impactCategory?.name || '').toLowerCase();
        return name.includes('climate change') || name.includes('global warming');
      });
      if (climate) {
        const value = (climate as any).amount ?? climate.value ?? 0;
        addLog(`Climate change impact: ${value} kg CO2-eq/kg`);
      }
    } catch (err) {
      addLog(`Midpoint calculation FAILED: ${err instanceof Error ? err.message : String(err)}`);
      addLog(`Stack: ${err instanceof Error ? err.stack : 'N/A'}`);
      return NextResponse.json({
        error: 'Midpoint calculation failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        log,
      }, { status: 500 });
    }

    const totalTime = Date.now() - startTime;
    addLog(`Total time: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      processName: processInfo?.name,
      database,
      midpointCategories: midpointImpacts.length,
      climateImpact: (() => {
        const climate = midpointImpacts.find((i: any) => {
          const name = (i.impactCategory?.name || '').toLowerCase();
          return name.includes('climate change') || name.includes('global warming');
        });
        return climate ? ((climate as any).amount ?? climate.value ?? 0) : null;
      })(),
      totalTimeMs: totalTime,
      log,
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    addLog(`UNHANDLED ERROR: ${error instanceof Error ? error.message : String(error)}`);
    addLog(`Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
    return NextResponse.json({
      error: 'Unhandled error',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      totalTimeMs: totalTime,
      log,
    }, { status: 500 });
  }
}

// Also support GET for easy browser testing
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const processId = url.searchParams.get('processId') || 'ea9fe161-eaf8-3958-bcd1-7e5e2a7aa379';
  const database = url.searchParams.get('database') || 'agribalyse';

  // Forward to POST handler
  const fakeRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ processId, database }),
    headers: { 'Content-Type': 'application/json' },
  });

  return POST(fakeRequest);
}
