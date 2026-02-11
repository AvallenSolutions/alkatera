import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenLCAClient, resolveDatabaseName } from '@/lib/openlca/client';

export const dynamic = 'force-dynamic';

const OPENLCA_SERVER_URL = process.env.OPENLCA_SERVER_URL;
const OPENLCA_SERVER_ENABLED = process.env.OPENLCA_SERVER_ENABLED === 'true';

// ReCiPe 2016 MIDPOINT impact category mapping (problem-oriented: kg CO2-eq, m³, etc.)
const MIDPOINT_CATEGORY_MAPPING: Record<string, string> = {
  'climate change': 'impact_climate',
  'global warming': 'impact_climate',
  'water consumption': 'impact_water',
  'water use': 'impact_water',
  'land use': 'impact_land',  // m²*year from midpoint
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
// Used for biodiversity/ecosystem damage metrics
const ENDPOINT_CATEGORY_MAPPING: Record<string, string> = {
  'ecosystem quality': 'impact_ecosystem_damage',  // Total ecosystem damage in species.yr
  'ecosystems': 'impact_ecosystem_damage',
  'land use': 'impact_land_biodiversity',  // Land-related biodiversity damage in species.yr
  'terrestrial ecotoxicity': 'impact_terrestrial_ecotoxicity_endpoint',
  'freshwater ecotoxicity': 'impact_freshwater_ecotoxicity_endpoint',
  'marine ecotoxicity': 'impact_marine_ecotoxicity_endpoint',
  'ecotoxicity: freshwater': 'impact_freshwater_ecotoxicity_endpoint',
  'ecotoxicity: marine': 'impact_marine_ecotoxicity_endpoint',
  'ecotoxicity: terrestrial': 'impact_terrestrial_ecotoxicity_endpoint',
};

// Legacy mapping for backward compatibility
const IMPACT_CATEGORY_MAPPING: Record<string, string> = {
  ...MIDPOINT_CATEGORY_MAPPING,
  'terrestrial ecotoxicity': 'impact_terrestrial_ecotoxicity',
  'freshwater ecotoxicity': 'impact_freshwater_ecotoxicity',
  'marine ecotoxicity': 'impact_marine_ecotoxicity',
  'ecotoxicity: freshwater': 'impact_freshwater_ecotoxicity',
  'ecotoxicity: marine': 'impact_marine_ecotoxicity',
  'ecotoxicity: terrestrial': 'impact_terrestrial_ecotoxicity',
};

interface CalculateRequest {
  processId: string;
  quantity: number;
  organizationId: string;
  /** Which OpenLCA database to calculate against (default: 'ecoinvent') */
  database?: 'ecoinvent' | 'agribalyse';
}

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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: CalculateRequest = await request.json();
    const { processId, quantity, organizationId, database = 'ecoinvent' } = body;

    if (!processId || !quantity || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if OpenLCA is enabled
    if (!OPENLCA_SERVER_URL || !OPENLCA_SERVER_ENABLED) {
      return NextResponse.json({
        error: 'OpenLCA not configured',
        message: 'Set OPENLCA_SERVER_URL and OPENLCA_SERVER_ENABLED=true',
      }, { status: 503 });
    }
    // Check cache first (gracefully handle missing table)
    let cached = null;
    try {
      const { data, error } = await supabase
        .from('openlca_impact_cache')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('process_id', processId)
        .eq('source_database', database)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!error) {
        cached = data;
      } else if (!error.message?.includes('does not exist')) {
        console.warn('[OpenLCA API] Cache query error:', error.message);
      }
    } catch (cacheError) {
      console.warn('[OpenLCA API] Cache unavailable, proceeding without cache');
    }

    if (cached) {
      // Return cached data scaled by quantity
      return NextResponse.json({
        success: true,
        cached: true,
        database: cached.source_database || database,
        impacts: {
          impact_climate: (cached.impact_climate || 0) * quantity,
          impact_climate_fossil: (cached.impact_climate_fossil || 0) * quantity,
          impact_climate_biogenic: (cached.impact_climate_biogenic || 0) * quantity,
          impact_climate_dluc: (cached.impact_climate_dluc || 0) * quantity,
          impact_water: (cached.impact_water || 0) * quantity,
          impact_land: (cached.impact_land || 0) * quantity,
          impact_waste: (cached.impact_waste || 0) * quantity,
          impact_ozone_depletion: (cached.impact_ozone_depletion || 0) * quantity,
          impact_terrestrial_ecotoxicity: (cached.impact_terrestrial_ecotoxicity || 0) * quantity,
          impact_freshwater_ecotoxicity: (cached.impact_freshwater_ecotoxicity || 0) * quantity,
          impact_marine_ecotoxicity: (cached.impact_marine_ecotoxicity || 0) * quantity,
          impact_freshwater_eutrophication: (cached.impact_freshwater_eutrophication || 0) * quantity,
          impact_marine_eutrophication: (cached.impact_marine_eutrophication || 0) * quantity,
          impact_terrestrial_acidification: (cached.impact_terrestrial_acidification || 0) * quantity,
          impact_mineral_resource_scarcity: (cached.impact_mineral_resource_scarcity || 0) * quantity,
          impact_fossil_resource_scarcity: (cached.impact_fossil_resource_scarcity || 0) * quantity,
        },
        processName: cached.process_name,
        geography: cached.geography,
        source: `OpenLCA Cache: ${cached.process_name}`,
      });
    }
    // Create OpenLCA client with API key for authenticated access
    const OPENLCA_API_KEY = process.env.OPENLCA_API_KEY;
    const client = new OpenLCAClient(OPENLCA_SERVER_URL, OPENLCA_API_KEY);

    // Health check
    const isHealthy = await client.healthCheck();
    if (!isHealthy) {
      return NextResponse.json({
        error: 'OpenLCA server not reachable',
        serverUrl: OPENLCA_SERVER_URL,
      }, { status: 503 });
    }

    // Resolve the target and default database names
    const targetDbName = resolveDatabaseName(database);
    const defaultDbName = resolveDatabaseName('ecoinvent');

    // Switch to the requested database if not ecoinvent (the default)
    // The withDatabase helper switches, executes, and switches back
    const { processInfo, midpointImpacts, endpointImpacts } = await client.withDatabase(
      targetDbName,
      defaultDbName,
      async () => {
        // Get process info
        const processInfo = await client.getProcess(processId);
        // Calculate impacts using DUAL methods (per 1 kg)
        // Run both calculations in parallel for performance
        const [midpointImpacts, endpointImpacts] = await Promise.all([
          client.calculateProcess(processId, 'ReCiPe 2016 v1.03, midpoint (H)', 1),
          client.calculateProcess(processId, 'ReCiPe 2016 v1.03, endpoint (I) no LT', 1),
        ]);
        return { processInfo, midpointImpacts, endpointImpacts };
      }
    );

    // Parse impacts into our format - combining midpoint and endpoint values
    const parsedImpacts: Record<string, number> = {
      // Midpoint values (problem-oriented)
      impact_climate: 0,
      impact_climate_fossil: 0,
      impact_climate_biogenic: 0,
      impact_climate_dluc: 0,
      impact_water: 0,
      impact_land: 0,  // m²*year from midpoint
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
      // Endpoint values (damage-oriented) - for biodiversity metrics
      impact_ecosystem_damage: 0,  // Total ecosystem damage in species.yr
      impact_land_biodiversity: 0,  // Land-related biodiversity damage in species.yr
      impact_terrestrial_ecotoxicity_endpoint: 0,
      impact_freshwater_ecotoxicity_endpoint: 0,
      impact_marine_ecotoxicity_endpoint: 0,
    };

    // Parse MIDPOINT impacts (kg CO2-eq, m³, etc.)
    for (const impact of midpointImpacts) {
      const categoryName = impact.impactCategory?.name?.toLowerCase() || '';
      const value = (impact as any).amount ?? impact.value ?? 0;

      for (const [pattern, field] of Object.entries(MIDPOINT_CATEGORY_MAPPING)) {
        if (categoryName.includes(pattern)) {
          parsedImpacts[field] = value;
          break;
        }
      }

      // Also map ecotoxicity from midpoint to standard fields
      if (categoryName.includes('terrestrial ecotoxicity')) {
        parsedImpacts.impact_terrestrial_ecotoxicity = value;
      } else if (categoryName.includes('freshwater ecotoxicity') || categoryName.includes('ecotoxicity: freshwater')) {
        parsedImpacts.impact_freshwater_ecotoxicity = value;
      } else if (categoryName.includes('marine ecotoxicity') || categoryName.includes('ecotoxicity: marine')) {
        parsedImpacts.impact_marine_ecotoxicity = value;
      }
    }

    // Parse ENDPOINT impacts (species.yr, DALY)
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

    // Estimate GHG breakdown if not available
    if (parsedImpacts.impact_climate > 0 && !parsedImpacts.impact_climate_fossil) {
      parsedImpacts.impact_climate_fossil = parsedImpacts.impact_climate * 0.85;
      parsedImpacts.impact_climate_biogenic = parsedImpacts.impact_climate * 0.15;
    }

    // Try to cache the results (per 1 kg) - gracefully handle missing table
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: cacheError } = await supabase.from('openlca_impact_cache').upsert({
        organization_id: organizationId,
        process_id: processId,
        source_database: database,
        process_name: processInfo.name || 'Unknown',
        geography: (processInfo.location as any)?.code || 'GLO',
        quantity: 1,
        unit: 'kg',
        impact_climate: parsedImpacts.impact_climate,
        impact_climate_fossil: parsedImpacts.impact_climate_fossil,
        impact_climate_biogenic: parsedImpacts.impact_climate_biogenic,
        impact_climate_dluc: parsedImpacts.impact_climate_dluc,
        impact_water: parsedImpacts.impact_water,
        impact_land: parsedImpacts.impact_land,
        impact_waste: parsedImpacts.impact_waste,
        impact_ozone_depletion: parsedImpacts.impact_ozone_depletion,
        impact_terrestrial_ecotoxicity: parsedImpacts.impact_terrestrial_ecotoxicity,
        impact_freshwater_ecotoxicity: parsedImpacts.impact_freshwater_ecotoxicity,
        impact_marine_ecotoxicity: parsedImpacts.impact_marine_ecotoxicity,
        impact_freshwater_eutrophication: parsedImpacts.impact_freshwater_eutrophication,
        impact_marine_eutrophication: parsedImpacts.impact_marine_eutrophication,
        impact_terrestrial_acidification: parsedImpacts.impact_terrestrial_acidification,
        impact_mineral_resource_scarcity: parsedImpacts.impact_mineral_resource_scarcity,
        impact_fossil_resource_scarcity: parsedImpacts.impact_fossil_resource_scarcity,
        impact_method: 'ReCiPe 2016 Midpoint (H) + Endpoint (I)',
        ecoinvent_version: database === 'agribalyse' ? 'agribalyse_3.2' : '3.12',
        system_model: database === 'agribalyse' ? 'attributional' : 'cutoff',
        calculated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'organization_id,process_id,source_database',
      });

      if (cacheError) {
        console.warn(`[OpenLCA API] Cache write failed (table may not exist): ${cacheError.message}`);
      } else {
      }
    } catch (cacheError) {
      console.warn('[OpenLCA API] Cache write error:', cacheError);
    }

    // Return impacts scaled by quantity
    const scaledImpacts: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsedImpacts)) {
      scaledImpacts[key] = value * quantity;
    }

    const dbLabel = database === 'agribalyse' ? 'Agribalyse 3.2' : 'ecoinvent 3.12';
    return NextResponse.json({
      success: true,
      cached: false,
      database,
      impacts: scaledImpacts,
      processName: processInfo.name,
      geography: (processInfo.location as any)?.code || 'GLO',
      source: `OpenLCA Live: ${processInfo.name} via ${dbLabel}`,
      methods: {
        midpoint: 'ReCiPe 2016 v1.03, midpoint (H)',
        endpoint: 'ReCiPe 2016 v1.03, endpoint (I) no LT',
      },
    });

  } catch (error) {
    console.error('[OpenLCA API] Error:', error);
    console.error('[OpenLCA API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Calculation failed',
      details: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
