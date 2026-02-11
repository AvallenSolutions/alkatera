/**
 * OpenLCA Impact Factor Resolver
 *
 * Queries OpenLCA for impact factors and converts results to WaterfallResult format.
 * Includes caching to avoid repeated calculations for the same process.
 *
 * Flow:
 * 1. Check cache first (openlca_impact_cache table)
 * 2. If miss: Call OpenLCA server
 *    - Get process descriptor
 *    - Run calculation with ReCiPe 2016 / IPCC 2021
 *    - Extract impacts from result
 *    - Dispose result (prevents memory leak)
 * 3. Cache results with 7-day TTL
 * 4. Return WaterfallResult format
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { OpenLCAClient } from './client';
import type { WaterfallResult, MaterialCategoryType } from '../impact-waterfall-resolver';
import type { ImpactResult, Ref } from './schema';

export interface OpenLCAResolverConfig {
  systemModel?: 'cutoff' | 'apos' | 'consequential';
  impactMethod?: string;
  cacheEnabled?: boolean;
  cacheTTLDays?: number;
}

export interface OpenLCAImpactData {
  processId: string;
  processName: string;
  geography: string;
  unit: string;
  quantity: number;

  // Core impacts (per unit)
  impactClimate: number;
  impactClimateFossil: number;
  impactClimateBiogenic: number;
  impactClimateDluc: number;
  impactWater: number;
  impactLand: number;
  impactWaste: number;

  // Extended ReCiPe impacts
  impactOzoneDepletion: number;
  impactTerrestrialEcotoxicity: number;
  impactFreshwaterEcotoxicity: number;
  impactFreshwaterEutrophication: number;
  impactTerrestrialAcidification: number;
  impactFossilResourceScarcity: number;

  // Metadata
  impactMethod: string;
  ecoinventVersion: string;
  systemModel: string;
  calculatedAt: Date;
}

/**
 * Map ReCiPe 2016 impact category names to our internal field names
 */
const IMPACT_CATEGORY_MAPPING: Record<string, keyof OpenLCAImpactData> = {
  // Climate change variants
  'climate change': 'impactClimate',
  'global warming': 'impactClimate',
  'gwp100': 'impactClimate',
  'climate change, fossil': 'impactClimateFossil',
  'climate change, biogenic': 'impactClimateBiogenic',
  'climate change, land use': 'impactClimateDluc',

  // Water
  'water consumption': 'impactWater',
  'water use': 'impactWater',
  'water scarcity': 'impactWater',

  // Land
  'land use': 'impactLand',
  'agricultural land occupation': 'impactLand',

  // Ozone
  'ozone depletion': 'impactOzoneDepletion',
  'stratospheric ozone depletion': 'impactOzoneDepletion',

  // Ecotoxicity
  'terrestrial ecotoxicity': 'impactTerrestrialEcotoxicity',
  'freshwater ecotoxicity': 'impactFreshwaterEcotoxicity',

  // Eutrophication
  'freshwater eutrophication': 'impactFreshwaterEutrophication',

  // Acidification
  'terrestrial acidification': 'impactTerrestrialAcidification',

  // Resource scarcity
  'fossil resource scarcity': 'impactFossilResourceScarcity',
  'fossil depletion': 'impactFossilResourceScarcity',
};

/**
 * Parse impact results from OpenLCA and map to our data structure
 */
function parseImpactResults(impacts: ImpactResult[]): Partial<OpenLCAImpactData> {
  const data: Partial<OpenLCAImpactData> = {
    impactClimate: 0,
    impactClimateFossil: 0,
    impactClimateBiogenic: 0,
    impactClimateDluc: 0,
    impactWater: 0,
    impactLand: 0,
    impactWaste: 0,
    impactOzoneDepletion: 0,
    impactTerrestrialEcotoxicity: 0,
    impactFreshwaterEcotoxicity: 0,
    impactFreshwaterEutrophication: 0,
    impactTerrestrialAcidification: 0,
    impactFossilResourceScarcity: 0,
  };

  for (const impact of impacts) {
    const categoryName = impact.impactCategory?.name?.toLowerCase() || '';
    // OpenLCA 2.x returns 'amount' not 'value'
    const impactValue = (impact as any).amount ?? impact.value ?? 0;

    // Find matching field
    for (const [pattern, field] of Object.entries(IMPACT_CATEGORY_MAPPING)) {
      if (categoryName.includes(pattern)) {
        (data as any)[field] = impactValue;
        break;
      }
    }
  }

  // If we have total climate but no breakdown, estimate split
  if (data.impactClimate && data.impactClimate > 0) {
    if (!data.impactClimateFossil && !data.impactClimateBiogenic) {
      // Default to 85% fossil, 15% biogenic if no breakdown available
      data.impactClimateFossil = data.impactClimate * 0.85;
      data.impactClimateBiogenic = data.impactClimate * 0.15;
    }
  }

  return data;
}

/**
 * Check cache for existing impact data
 */
async function getCachedImpacts(
  supabase: SupabaseClient,
  organizationId: string,
  processId: string
): Promise<OpenLCAImpactData | null> {
  const { data, error } = await supabase
    .from('openlca_impact_cache')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('process_id', processId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    processId: data.process_id,
    processName: data.process_name || '',
    geography: data.geography || 'GLO',
    unit: data.unit || 'kg',
    quantity: data.quantity || 1,
    impactClimate: data.impact_climate || 0,
    impactClimateFossil: data.impact_climate_fossil || 0,
    impactClimateBiogenic: data.impact_climate_biogenic || 0,
    impactClimateDluc: data.impact_climate_dluc || 0,
    impactWater: data.impact_water || 0,
    impactLand: data.impact_land || 0,
    impactWaste: data.impact_waste || 0,
    impactOzoneDepletion: data.impact_ozone_depletion || 0,
    impactTerrestrialEcotoxicity: data.impact_terrestrial_ecotoxicity || 0,
    impactFreshwaterEcotoxicity: data.impact_freshwater_ecotoxicity || 0,
    impactFreshwaterEutrophication: data.impact_freshwater_eutrophication || 0,
    impactTerrestrialAcidification: data.impact_terrestrial_acidification || 0,
    impactFossilResourceScarcity: data.impact_fossil_resource_scarcity || 0,
    impactMethod: data.impact_method || 'ReCiPe 2016 Midpoint (H)',
    ecoinventVersion: data.ecoinvent_version || '3.12',
    systemModel: data.system_model || 'cutoff',
    calculatedAt: new Date(data.calculated_at),
  };
}

/**
 * Save impact data to cache
 */
async function cacheImpacts(
  supabase: SupabaseClient,
  organizationId: string,
  data: OpenLCAImpactData,
  ttlDays: number = 7
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);

  await supabase.from('openlca_impact_cache').upsert(
    {
      organization_id: organizationId,
      process_id: data.processId,
      process_name: data.processName,
      geography: data.geography,
      quantity: data.quantity,
      unit: data.unit,
      impact_climate: data.impactClimate,
      impact_climate_fossil: data.impactClimateFossil,
      impact_climate_biogenic: data.impactClimateBiogenic,
      impact_climate_dluc: data.impactClimateDluc,
      impact_water: data.impactWater,
      impact_water_scarcity: data.impactWater, // Same as water for now
      impact_land: data.impactLand,
      impact_waste: data.impactWaste,
      impact_ozone_depletion: data.impactOzoneDepletion,
      impact_terrestrial_ecotoxicity: data.impactTerrestrialEcotoxicity,
      impact_freshwater_ecotoxicity: data.impactFreshwaterEcotoxicity,
      impact_freshwater_eutrophication: data.impactFreshwaterEutrophication,
      impact_terrestrial_acidification: data.impactTerrestrialAcidification,
      impact_fossil_resource_scarcity: data.impactFossilResourceScarcity,
      impact_method: data.impactMethod,
      ecoinvent_version: data.ecoinventVersion,
      system_model: data.systemModel,
      calculated_at: data.calculatedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    {
      onConflict: 'organization_id,process_id',
    }
  );
}

/**
 * Query OpenLCA for impact factors for a specific process
 */
async function queryOpenLCAImpacts(
  client: OpenLCAClient,
  processId: string,
  impactMethodName: string = 'ReCiPe 2016'
): Promise<OpenLCAImpactData> {
  console.log(`[OpenLCA] Calculating impacts for process: ${processId}`);

  // Get process details
  const process = await client.getProcess(processId);

  // Calculate impacts using convenience method
  const impacts = await client.calculateProcess(processId, impactMethodName, 1);

  // Parse results
  const parsedImpacts = parseImpactResults(impacts);

  return {
    processId,
    processName: process.name || 'Unknown',
    geography: (process.location as any)?.code || 'GLO',
    unit: 'kg', // Default reference unit
    quantity: 1,
    impactClimate: parsedImpacts.impactClimate || 0,
    impactClimateFossil: parsedImpacts.impactClimateFossil || 0,
    impactClimateBiogenic: parsedImpacts.impactClimateBiogenic || 0,
    impactClimateDluc: parsedImpacts.impactClimateDluc || 0,
    impactWater: parsedImpacts.impactWater || 0,
    impactLand: parsedImpacts.impactLand || 0,
    impactWaste: parsedImpacts.impactWaste || 0,
    impactOzoneDepletion: parsedImpacts.impactOzoneDepletion || 0,
    impactTerrestrialEcotoxicity: parsedImpacts.impactTerrestrialEcotoxicity || 0,
    impactFreshwaterEcotoxicity: parsedImpacts.impactFreshwaterEcotoxicity || 0,
    impactFreshwaterEutrophication: parsedImpacts.impactFreshwaterEutrophication || 0,
    impactTerrestrialAcidification: parsedImpacts.impactTerrestrialAcidification || 0,
    impactFossilResourceScarcity: parsedImpacts.impactFossilResourceScarcity || 0,
    impactMethod: impactMethodName,
    ecoinventVersion: '3.12',
    systemModel: 'cutoff',
    calculatedAt: new Date(),
  };
}

/**
 * Main resolver function: Get impact factors from OpenLCA for a material
 *
 * This is the entry point for the waterfall resolver. It:
 * 1. Checks cache first
 * 2. Falls back to live OpenLCA calculation if cache miss
 * 3. Caches the result
 * 4. Returns WaterfallResult format
 */
export async function resolveOpenLCAImpacts(
  supabase: SupabaseClient,
  client: OpenLCAClient,
  processId: string,
  quantityKg: number,
  organizationId: string,
  config: OpenLCAResolverConfig = {}
): Promise<WaterfallResult> {
  const {
    impactMethod = 'ReCiPe 2016',
    cacheEnabled = true,
    cacheTTLDays = 7,
  } = config;

  let impactData: OpenLCAImpactData | null = null;

  // Step 1: Check cache
  if (cacheEnabled) {
    impactData = await getCachedImpacts(supabase, organizationId, processId);
    if (impactData) {
      console.log(`[OpenLCA] Cache HIT for process: ${processId}`);
    }
  }

  // Step 2: Query OpenLCA if cache miss
  if (!impactData) {
    console.log(`[OpenLCA] Cache MISS for process: ${processId}, querying OpenLCA...`);
    impactData = await queryOpenLCAImpacts(client, processId, impactMethod);

    // Step 3: Cache the result
    if (cacheEnabled) {
      await cacheImpacts(supabase, organizationId, impactData, cacheTTLDays);
      console.log(`[OpenLCA] Cached impacts for process: ${processId}`);
    }
  }

  // Step 4: Convert to WaterfallResult format
  // All impact values are per kg, multiply by quantity
  const result: WaterfallResult = {
    // Core 4 impacts
    impact_climate: impactData.impactClimate * quantityKg,
    impact_climate_fossil: impactData.impactClimateFossil * quantityKg,
    impact_climate_biogenic: impactData.impactClimateBiogenic * quantityKg,
    impact_climate_dluc: impactData.impactClimateDluc * quantityKg,
    impact_water: impactData.impactWater * quantityKg,
    impact_water_scarcity: impactData.impactWater * quantityKg, // Will be multiplied by AWARE factor later
    impact_land: impactData.impactLand * quantityKg,
    impact_waste: impactData.impactWaste * quantityKg,

    // Extended ReCiPe 2016 impacts
    impact_ozone_depletion: impactData.impactOzoneDepletion * quantityKg,
    impact_photochemical_ozone_formation: 0, // Not commonly in ReCiPe default
    impact_ionising_radiation: 0,
    impact_particulate_matter: 0,
    impact_human_toxicity_carcinogenic: 0,
    impact_human_toxicity_non_carcinogenic: 0,
    impact_terrestrial_ecotoxicity: impactData.impactTerrestrialEcotoxicity * quantityKg,
    impact_freshwater_ecotoxicity: impactData.impactFreshwaterEcotoxicity * quantityKg,
    impact_marine_ecotoxicity: 0,
    impact_freshwater_eutrophication: impactData.impactFreshwaterEutrophication * quantityKg,
    impact_marine_eutrophication: 0,
    impact_terrestrial_acidification: impactData.impactTerrestrialAcidification * quantityKg,
    impact_mineral_resource_scarcity: 0,
    impact_fossil_resource_scarcity: impactData.impactFossilResourceScarcity * quantityKg,

    // Provenance tracking
    data_priority: 2, // Between supplier (1) and staging (3)
    data_quality_tag: 'Secondary_Modelled',
    data_quality_grade: 'HIGH',
    source_reference: `OpenLCA: ${impactData.processName} (${impactData.geography}) via ecoInvent ${impactData.ecoinventVersion}`,
    confidence_score: 85,
    methodology: `${impactData.impactMethod} / ecoInvent ${impactData.ecoinventVersion} ${impactData.systemModel}`,

    // Source tracking
    gwp_data_source: 'OpenLCA/ecoInvent',
    non_gwp_data_source: 'OpenLCA/ecoInvent',
    gwp_reference_id: processId,
    non_gwp_reference_id: processId,
    is_hybrid_source: false,

    // Category
    category_type: 'MANUFACTURING_MATERIAL' as MaterialCategoryType,
  };

  return result;
}

/**
 * Check if OpenLCA is available and configured for an organization
 */
export async function isOpenLCAEnabled(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('openlca_configurations')
    .select('enabled, server_url')
    .eq('organization_id', organizationId)
    .eq('enabled', true)
    .maybeSingle();

  return !!data?.server_url;
}

/**
 * Get OpenLCA configuration for an organization
 * Falls back to environment variables if no database configuration exists
 */
export async function getOpenLCAConfig(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{
  serverUrl: string;
  databaseName: string;
  preferredSystemModel: string;
  defaultAllocationMethod: string;
} | null> {
  // First try database configuration
  const { data } = await supabase
    .from('openlca_configurations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('enabled', true)
    .maybeSingle();

  if (data?.server_url) {
    return {
      serverUrl: data.server_url,
      databaseName: data.database_name,
      preferredSystemModel: data.preferred_system_model || 'cutoff',
      defaultAllocationMethod: data.default_allocation_method || 'economic',
    };
  }

  // Fall back to environment variables
  const envServerUrl = process.env.OPENLCA_SERVER_URL;
  const envEnabled = process.env.OPENLCA_SERVER_ENABLED === 'true';

  if (envServerUrl && envEnabled) {
    console.log('[OpenLCA] Using environment variable configuration');
    return {
      serverUrl: envServerUrl,
      databaseName: 'ecoinvent_312_cutoff',
      preferredSystemModel: 'cutoff',
      defaultAllocationMethod: 'economic',
    };
  }

  return null;
}
