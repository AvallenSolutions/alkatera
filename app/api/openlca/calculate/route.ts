import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createOpenLCAClientForDatabase } from '@/lib/openlca/client';
import { ProviderLinking, type ImpactResult } from '@/lib/openlca/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // OpenLCA calculations can take 60-90s

// ReCiPe 2016 MIDPOINT impact category mapping (problem-oriented: kg CO2-eq, m³, etc.)
const MIDPOINT_CATEGORY_MAPPING: Record<string, string> = {
  'climate change': 'impact_climate',
  'global warming': 'impact_climate',
  'water consumption': 'impact_water',
  'water use': 'impact_water',
  'land use': 'impact_land',  // m²*year from midpoint
  'ozone depletion': 'impact_ozone_depletion',             // ReCiPe: "Stratospheric ozone depletion"
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
  'particulate matter formation': 'impact_particulate_matter',  // ReCiPe: "Fine particulate matter formation"
  'ionising radiation': 'impact_ionising_radiation',
  'photochemical oxidant formation': 'impact_photochemical_ozone_formation',
  // ReCiPe 2016 uses "Ozone formation" instead of "Photochemical oxidant formation"
  'ozone formation, human health': 'impact_photochemical_ozone_formation',
  'ozone formation, terrestrial': 'impact_photochemical_ozone_formation',
  'ozone formation': 'impact_photochemical_ozone_formation',
  // ReCiPe 2016 human toxicity categories
  'human carcinogenic toxicity': 'impact_human_toxicity_carcinogenic',
  'human non-carcinogenic toxicity': 'impact_human_toxicity_non_carcinogenic',
  // EF 3.1 human toxicity names
  'human toxicity, cancer': 'impact_human_toxicity_carcinogenic',
  'human toxicity, non-cancer': 'impact_human_toxicity_non_carcinogenic',
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
    if (process.env.OPENLCA_SERVER_ENABLED !== 'true') {
      return NextResponse.json({
        error: 'OpenLCA not configured',
        message: 'Set OPENLCA_SERVER_URL and OPENLCA_SERVER_ENABLED=true',
      }, { status: 503 });
    }

    // Create OpenLCA client for the requested database (dual-server architecture)
    // Each database source (ecoinvent / agribalyse) has its own gdt-server instance
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
    // Skip health check — it wastes 3-5 seconds of our tight 30s budget.
    // If the server is down, the calculation call will fail with a clear error.

    // Get process info and calculate impacts (per 1 kg)
    // No database switching needed — client is already pointed at the correct server
    const processInfo = await client.getProcess(processId);

    // Agribalyse 3.2 ships with EF 3.1 (Environmental Footprint), not ReCiPe.
    // Use the correct impact method for each database. EF 3.1 is midpoint-only
    // so we skip the endpoint call for Agribalyse.
    let midpointImpacts: ImpactResult[] = [];
    let endpointImpacts: ImpactResult[] = [];

    // Netlify has a hard 60-second function timeout. Some complex processes
    // (e.g. Ascorbic Acid on Agribalyse) take 60-70s for the endpoint method.
    // Strategy: run both midpoint and endpoint simultaneously, but impose a
    // total time budget of 50s. Return whatever completes within that window.
    // Midpoint (~20-30s) always finishes; endpoint finishes if it can.
    // Results are cached, so on retry all time goes to the slower method.
    const TOTAL_BUDGET_MS = 50000; // 50s total, leaving 10s headroom for overhead

    // Helper: run a calculation and capture its result into a mutable ref
    const runWithCapture = async (
      method: string,
      ref: { impacts: ImpactResult[] },
    ): Promise<void> => {
      ref.impacts = await client.calculateProcess(processId, method, 1);
    };

    const midpointRef = { impacts: [] as ImpactResult[] };
    const endpointRef = { impacts: [] as ImpactResult[] };

    if (database === 'agribalyse') {
      // AGRIBALYSE FIX: The "calculate directly from Process" shortcut fails
      // for many Agribalyse unit processes because their inputs lack default
      // providers — OpenLCA's auto-linker silently returns empty impacts.
      // Build an explicit product system via data/create-system, which runs
      // the full linker and produces a calculable graph.
      //
      // Product systems are stable per process, so we cache the mapping in
      // agribalyse_product_systems to pay the ~5-10s build cost only once
      // per ingredient across the whole platform.

      // 1. Look up cached product system
      let productSystemId: string | null = null;
      try {
        const { data: cachedSystem } = await supabase
          .from('agribalyse_product_systems')
          .select('product_system_id')
          .eq('process_id', processId)
          .maybeSingle();
        if (cachedSystem?.product_system_id) {
          productSystemId = cachedSystem.product_system_id;
          console.log(`[OpenLCA API] Agribalyse: using cached product system ${productSystemId} for ${processId}`);
        }
      } catch (psCacheErr) {
        console.warn('[OpenLCA API] Product system cache lookup failed, will rebuild:', psCacheErr);
      }

      // 2. If not cached, build one and persist it
      if (!productSystemId) {
        try {
          console.log(`[OpenLCA API] Agribalyse: building product system for ${processId} (first-time cost ~5-10s)`);
          const buildStart = Date.now();
          const systemRef = await client.createProductSystem(processId, {
            preferUnitProcesses: false,
            providerLinking: ProviderLinking.PREFER_DEFAULTS,
            cutoff: 1e-5,
          });
          productSystemId = systemRef['@id'] || null;
          const buildMs = Date.now() - buildStart;

          if (productSystemId) {
            void supabase.from('agribalyse_product_systems').upsert({
              process_id: processId,
              product_system_id: productSystemId,
              process_name: processInfo.name || null,
              linking_config: {
                preferUnitProcesses: false,
                providerLinking: ProviderLinking.PREFER_DEFAULTS,
                cutoff: 1e-5,
              },
              build_duration_ms: buildMs,
              last_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'process_id' }).then(({ error }) => {
              if (error && !error.message?.includes('does not exist')) {
                console.warn('[OpenLCA API] Failed to cache product system:', error.message);
              }
            });
            console.log(`[OpenLCA API] Agribalyse: built product system ${productSystemId} in ${buildMs}ms`);
          }
        } catch (buildErr) {
          console.warn(`[OpenLCA API] Agribalyse: product system build failed for ${processId}:`, buildErr instanceof Error ? buildErr.message : buildErr);
        }
      }

      // 3. Helper to run a calc against the product system (or fall back to
      //    the raw process target if we failed to build a system)
      const runAgribalyse = async (
        method: string,
        ref: { impacts: ImpactResult[] },
      ): Promise<void> => {
        if (productSystemId) {
          ref.impacts = await client.calculateProductSystem(productSystemId, method, 1);
        } else {
          ref.impacts = await client.calculateProcess(processId, method, 1);
        }
      };

      // 4. Try ReCiPe first (consistent with ecoinvent output)
      try {
        const midpointPromise = runAgribalyse('ReCiPe 2016 Midpoint (H)', midpointRef);
        const endpointPromise = runAgribalyse('ReCiPe 2016 Endpoint (I)', endpointRef);

        await Promise.race([
          Promise.allSettled([midpointPromise, endpointPromise]),
          new Promise(resolve => setTimeout(resolve, TOTAL_BUDGET_MS)),
        ]);

        midpointImpacts = midpointRef.impacts;
        endpointImpacts = endpointRef.impacts;

        if (midpointImpacts.length > 0) {
          console.log(`[OpenLCA API] Agribalyse ReCiPe: Midpoint: ${midpointImpacts.length}, Endpoint: ${endpointImpacts.length} for ${processId}`);
        }
      } catch (recipeErr) {
        console.warn(`[OpenLCA API] ReCiPe calculation threw for ${processId}:`, recipeErr instanceof Error ? recipeErr.message : recipeErr);
      }

      // 5. EF 3.1 fallback — Agribalyse's native method
      if (midpointImpacts.length === 0) {
        try {
          console.log(`[OpenLCA API] ReCiPe returned no results for ${processId}, trying EF 3.1 fallback...`);
          if (productSystemId) {
            midpointImpacts = await client.calculateProductSystem(productSystemId, 'EF 3.1 Method (adapted)', 1);
          } else {
            midpointImpacts = await client.calculateProcess(processId, 'EF 3.1 Method (adapted)', 1);
          }
          console.log(`[OpenLCA API] EF 3.1 fallback: ${midpointImpacts.length} categories for ${processId}`);
        } catch (efErr) {
          console.warn(`[OpenLCA API] EF 3.1 fallback also failed for ${processId}:`, efErr instanceof Error ? efErr.message : efErr);
        }
      }

      // 6. LAST-RESORT fallback — if a cached product system produced zero
      //    results (e.g. the server was reloaded and the system id is stale),
      //    rebuild and retry once with EF 3.1.
      if (midpointImpacts.length === 0 && productSystemId) {
        console.warn(`[OpenLCA API] Cached product system ${productSystemId} yielded no impacts; rebuilding once for ${processId}`);
        try {
          const rebuilt = await client.createProductSystem(processId, {
            preferUnitProcesses: false,
            providerLinking: ProviderLinking.PREFER_DEFAULTS,
            cutoff: 1e-5,
          });
          const newId = rebuilt['@id'];
          if (newId) {
            midpointImpacts = await client.calculateProductSystem(newId, 'EF 3.1 Method (adapted)', 1);
            if (midpointImpacts.length > 0) {
              void supabase.from('agribalyse_product_systems').upsert({
                process_id: processId,
                product_system_id: newId,
                process_name: processInfo.name || null,
                last_verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'process_id' });
              console.log(`[OpenLCA API] Rebuild succeeded: new product system ${newId}`);
            }
          }
        } catch (rebuildErr) {
          console.warn(`[OpenLCA API] Rebuild attempt also failed for ${processId}:`, rebuildErr instanceof Error ? rebuildErr.message : rebuildErr);
        }
      }
    } else {
      // ecoinvent: same parallel strategy
      const midpointPromise = runWithCapture('ReCiPe 2016 v1.03, midpoint (H)', midpointRef);
      const endpointPromise = runWithCapture('ReCiPe 2016 v1.03, endpoint (I) no LT', endpointRef);

      await Promise.race([
        Promise.allSettled([midpointPromise, endpointPromise]),
        new Promise(resolve => setTimeout(resolve, TOTAL_BUDGET_MS)),
      ]);

      midpointImpacts = midpointRef.impacts;
      endpointImpacts = endpointRef.impacts;
      console.log(`[OpenLCA API] Midpoint: ${midpointImpacts.length} categories, Endpoint: ${endpointImpacts.length} categories for ${processId}`);
    }

    // If no impact data was produced by any method, fail with a clear error
    if (midpointImpacts.length === 0 && endpointImpacts.length === 0) {
      throw new Error(`No impact results for process ${processId} (${database}). Tried ReCiPe 2016${database === 'agribalyse' ? ' and EF 3.1' : ''}. The process may not support direct calculation.`);
    }

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
      impact_human_toxicity_carcinogenic: 0,
      impact_human_toxicity_non_carcinogenic: 0,
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
      // Ecoinvent/Agribalyse process factors are stable between database versions,
      // so a 30-day TTL reduces repeated API calls without risking stale data.
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

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
        impact_method: database === 'agribalyse' ? 'EF 3.1' : 'ReCiPe 2016 Midpoint (H) + Endpoint (I)',
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
