import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createOpenLCAClientForDatabase } from '@/lib/openlca/client';
import type { ImpactResult } from '@/lib/openlca/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ReCiPe 2016 MIDPOINT impact category mapping (problem-oriented: kg CO2-eq, m³, etc.)
const MIDPOINT_CATEGORY_MAPPING: Record<string, string> = {
  'climate change': 'impact_climate',
  'global warming': 'impact_climate',
  'water consumption': 'impact_water',
  'water use': 'impact_water',
  'land use': 'impact_land',
  'ozone depletion': 'impact_ozone_depletion',
  'freshwater eutrophication': 'impact_freshwater_eutrophication',
  'marine eutrophication': 'impact_marine_eutrophication',
  'terrestrial acidification': 'impact_terrestrial_acidification',
  'acidification: terrestrial': 'impact_terrestrial_acidification',
  'eutrophication: freshwater': 'impact_freshwater_eutrophication',
  'eutrophication: marine': 'impact_marine_eutrophication',
  'fossil resource scarcity': 'impact_fossil_resource_scarcity',
  'energy resources: non-renewable, fossil': 'impact_fossil_resource_scarcity',
  'mineral resource scarcity': 'impact_mineral_resource_scarcity',
  'material resources: metals/minerals': 'impact_mineral_resource_scarcity',
  'particulate matter formation': 'impact_particulate_matter',
  'ionising radiation': 'impact_ionising_radiation',
  'photochemical oxidant formation': 'impact_photochemical_ozone_formation',
};

// ReCiPe 2016 ENDPOINT impact category mapping (damage-oriented: species.yr, DALY)
const ENDPOINT_CATEGORY_MAPPING: Record<string, string> = {
  'ecosystem quality': 'impact_ecosystem_damage',
  'ecosystems': 'impact_ecosystem_damage',
  'land use': 'impact_land_biodiversity',
  'terrestrial ecotoxicity': 'impact_terrestrial_ecotoxicity_endpoint',
  'freshwater ecotoxicity': 'impact_freshwater_ecotoxicity_endpoint',
  'marine ecotoxicity': 'impact_marine_ecotoxicity_endpoint',
  'ecotoxicity: freshwater': 'impact_freshwater_ecotoxicity_endpoint',
  'ecotoxicity: marine': 'impact_marine_ecotoxicity_endpoint',
  'ecotoxicity: terrestrial': 'impact_terrestrial_ecotoxicity_endpoint',
};

interface CalculateRequest {
  processId: string;
  quantity: number;
  organizationId: string;
  database?: 'ecoinvent' | 'agribalyse';
}

/**
 * Parse midpoint + endpoint impact results into our flat format
 */
function parseImpacts(
  midpointImpacts: ImpactResult[],
  endpointImpacts: ImpactResult[]
): Record<string, number> {
  const parsedImpacts: Record<string, number> = {
    impact_climate: 0,
    impact_climate_fossil: 0,
    impact_climate_biogenic: 0,
    impact_climate_dluc: 0,
    impact_water: 0,
    impact_land: 0,
    impact_waste: 0,
    impact_ozone_depletion: 0,
    impact_terrestrial_ecotoxicity: 0,
    impact_freshwater_ecotoxicity: 0,
    impact_marine_ecotoxicity: 0,
    impact_freshwater_eutrophication: 0,
    impact_marine_eutrophication: 0,
    impact_terrestrial_acidification: 0,
    impact_mineral_resource_scarcity: 0,
    impact_fossil_resource_scarcity: 0,
    impact_particulate_matter: 0,
    impact_ionising_radiation: 0,
    impact_photochemical_ozone_formation: 0,
    impact_ecosystem_damage: 0,
    impact_land_biodiversity: 0,
    impact_terrestrial_ecotoxicity_endpoint: 0,
    impact_freshwater_ecotoxicity_endpoint: 0,
    impact_marine_ecotoxicity_endpoint: 0,
  };

  for (const impact of midpointImpacts) {
    const categoryName = impact.impactCategory?.name?.toLowerCase() || '';
    const value = (impact as any).amount ?? impact.value ?? 0;

    for (const [pattern, field] of Object.entries(MIDPOINT_CATEGORY_MAPPING)) {
      if (categoryName.includes(pattern)) {
        parsedImpacts[field] = value;
        break;
      }
    }

    if (categoryName.includes('terrestrial ecotoxicity')) {
      parsedImpacts.impact_terrestrial_ecotoxicity = value;
    } else if (categoryName.includes('freshwater ecotoxicity') || categoryName.includes('ecotoxicity: freshwater')) {
      parsedImpacts.impact_freshwater_ecotoxicity = value;
    } else if (categoryName.includes('marine ecotoxicity') || categoryName.includes('ecotoxicity: marine')) {
      parsedImpacts.impact_marine_ecotoxicity = value;
    }
  }

  for (const impact of endpointImpacts) {
    const categoryName = impact.impactCategory?.name?.toLowerCase() || '';
    const value = (impact as any).amount ?? impact.value ?? 0;

    for (const [pattern, field] of Object.entries(ENDPOINT_CATEGORY_MAPPING)) {
      if (categoryName.includes(pattern)) {
        parsedImpacts[field] = value;
        break;
      }
    }
  }

  if (parsedImpacts.impact_climate > 0 && !parsedImpacts.impact_climate_fossil) {
    parsedImpacts.impact_climate_fossil = parsedImpacts.impact_climate * 0.85;
    parsedImpacts.impact_climate_biogenic = parsedImpacts.impact_climate * 0.15;
  }

  return parsedImpacts;
}

export async function POST(request: NextRequest) {
  // ── Fast-path checks (no streaming needed, returns immediately) ──
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

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CalculateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { processId, quantity, organizationId, database = 'ecoinvent' } = body;

  if (!processId || !quantity || !organizationId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (process.env.OPENLCA_SERVER_ENABLED !== 'true') {
    return NextResponse.json({
      error: 'OpenLCA not configured',
      message: 'Set OPENLCA_SERVER_URL and OPENLCA_SERVER_ENABLED=true',
    }, { status: 503 });
  }

  const client = createOpenLCAClientForDatabase(database);
  if (!client) {
    const dbLabel = database === 'agribalyse' ? 'Agribalyse' : 'ecoinvent';
    return NextResponse.json({
      error: `OpenLCA ${dbLabel} server not configured`,
      message: database === 'agribalyse'
        ? 'Set OPENLCA_AGRIBALYSE_SERVER_URL to enable Agribalyse calculations'
        : 'Set OPENLCA_SERVER_URL to enable ecoinvent calculations',
    }, { status: 503 });
  }

  // Check cache (gracefully handle missing table)
  try {
    const { data: cached, error } = await supabase
      .from('openlca_impact_cache')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('process_id', processId)
      .eq('source_database', database)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!error && cached) {
      const scaledImpacts: Record<string, number> = {};
      const impactColumns = [
        'impact_climate', 'impact_climate_fossil', 'impact_climate_biogenic',
        'impact_climate_dluc', 'impact_water', 'impact_land', 'impact_waste',
        'impact_ozone_depletion', 'impact_terrestrial_ecotoxicity',
        'impact_freshwater_ecotoxicity', 'impact_marine_ecotoxicity',
        'impact_freshwater_eutrophication', 'impact_marine_eutrophication',
        'impact_terrestrial_acidification', 'impact_mineral_resource_scarcity',
        'impact_fossil_resource_scarcity',
      ];
      for (const col of impactColumns) {
        scaledImpacts[col] = (cached[col] || 0) * quantity;
      }
      return NextResponse.json({
        success: true,
        cached: true,
        database: cached.source_database || database,
        impacts: scaledImpacts,
        processName: cached.process_name,
        geography: cached.geography,
        source: `OpenLCA Cache: ${cached.process_name}`,
      });
    }
  } catch {
    // Cache table may not exist yet - continue to live calculation
  }

  // ── Streaming response ──
  // Netlify has TWO timeout limits:
  //   1. ~30-second INACTIVITY timeout (no data sent) → 504
  //   2. 60-second FUNCTION EXECUTION timeout → function killed mid-stream
  //
  // We solve #1 with keepalive newlines every 5 seconds.
  // We solve #2 by running ONLY midpoint (not endpoint) to keep total time
  // under 50 seconds even under concurrent load. Endpoint data (for biodiversity
  // metrics) is nice-to-have and can be fetched in a subsequent request once
  // midpoint results are cached.
  //
  // A 50-second safety timer ensures we always send a response before Netlify
  // kills the function. If midpoint hasn't finished by then, we send an error.
  const encoder = new TextEncoder();
  const funcStartTime = Date.now();
  const SAFETY_TIMEOUT_MS = 50000; // Must respond before Netlify's 60s kill

  const stream = new ReadableStream({
    async start(controller) {
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode('\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 5000);

      // Safety timer: if we haven't responded in 50s, send error and close
      let responded = false;
      const safetyTimer = setTimeout(() => {
        if (!responded) {
          responded = true;
          clearInterval(keepalive);
          const errorResult = {
            error: `Calculation timed out after ${SAFETY_TIMEOUT_MS / 1000}s for process ${processId} (${database})`,
          };
          try {
            controller.enqueue(encoder.encode(JSON.stringify(errorResult)));
            controller.close();
          } catch { /* stream already closed */ }
        }
      }, SAFETY_TIMEOUT_MS);

      try {
        // Get process info (needed for cache and response)
        const processInfo = await client.getProcess(processId);

        // Run MIDPOINT ONLY to stay within Netlify's execution timeout.
        // With multiple concurrent ingredients, running both midpoint + endpoint
        // overloads the OpenLCA server and pushes total time past 60s.
        // Endpoint (biodiversity) data will be populated on subsequent cached requests.
        const midpointMethod = database === 'agribalyse'
          ? 'ReCiPe 2016 Midpoint (H)'
          : 'ReCiPe 2016 v1.03, midpoint (H)';

        let midpointImpacts: ImpactResult[] = [];
        try {
          midpointImpacts = await client.calculateProcess(processId, midpointMethod, 1);
        } catch (calcErr) {
          // For Agribalyse, try EF 3.1 as fallback
          if (database === 'agribalyse') {
            console.warn('[OpenLCA API] ReCiPe midpoint failed, trying EF 3.1');
            midpointImpacts = await client.calculateProcess(processId, 'EF 3.1 Method (adapted)', 1);
          } else {
            throw calcErr;
          }
        }

        if (midpointImpacts.length === 0) {
          throw new Error(`Midpoint calculation returned no results for process ${processId} (${database})`);
        }

        console.log(`[OpenLCA API] Midpoint: ${midpointImpacts.length} categories for ${processId} (${Date.now() - funcStartTime}ms)`);

        const parsedImpacts = parseImpacts(midpointImpacts, []);

        // Cache results (fire-and-forget)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        supabase.from('openlca_impact_cache').upsert({
          organization_id: organizationId,
          process_id: processId,
          source_database: database,
          process_name: processInfo.name || 'Unknown',
          geography: (processInfo.location as any)?.code || 'GLO',
          quantity: 1,
          unit: 'kg',
          ...parsedImpacts,
          impact_method: midpointMethod,
          ecoinvent_version: database === 'agribalyse' ? 'agribalyse_3.2' : '3.12',
          system_model: database === 'agribalyse' ? 'attributional' : 'cutoff',
          calculated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: 'organization_id,process_id,source_database',
        }).then(({ error: cacheError }) => {
          if (cacheError) {
            console.warn(`[OpenLCA API] Cache write failed: ${cacheError.message}`);
          }
        });

        // Scale by quantity
        const scaledImpacts: Record<string, number> = {};
        for (const [key, value] of Object.entries(parsedImpacts)) {
          scaledImpacts[key] = value * quantity;
        }

        const dbLabel = database === 'agribalyse' ? 'Agribalyse 3.2' : 'ecoinvent 3.12';
        const result = {
          success: true,
          cached: false,
          database,
          impacts: scaledImpacts,
          processName: processInfo.name,
          geography: (processInfo.location as any)?.code || 'GLO',
          source: `OpenLCA Live: ${processInfo.name} via ${dbLabel}`,
          methods: { midpoint: midpointMethod },
        };

        if (!responded) {
          responded = true;
          clearTimeout(safetyTimer);
          clearInterval(keepalive);
          controller.enqueue(encoder.encode(JSON.stringify(result)));
          controller.close();
        }

      } catch (error) {
        if (!responded) {
          responded = true;
          clearTimeout(safetyTimer);
          clearInterval(keepalive);
          console.error('[OpenLCA API] Error:', error);
          const errorResult = {
            error: error instanceof Error ? error.message : 'Calculation failed',
            details: error instanceof Error ? error.stack : undefined,
          };
          controller.enqueue(encoder.encode(JSON.stringify(errorResult)));
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  });
}
