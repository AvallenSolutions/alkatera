#!/usr/bin/env npx tsx
/**
 * Agribalyse v3.2 Factor Extraction Script
 *
 * Connects to the Agribalyse gdt-server instance, searches for
 * drinks-relevant processes, calculates impacts using ReCiPe 2016
 * Midpoint (H), and outputs a SQL migration file for inserting
 * into staging_emission_factors.
 *
 * Architecture: Uses the dual-server approach — the Agribalyse
 * gdt-server runs as a separate instance from the ecoinvent server.
 * No database switching is needed.
 *
 * Prerequisites:
 *   1. Agribalyse gdt-server running (local or cloud)
 *   2. Agribalyse v3.2 database loaded in that server
 *   3. ReCiPe 2016 v1.03 Midpoint (H) impact method available
 *
 * Usage:
 *   npx tsx scripts/extract-agribalyse-factors.ts
 *
 * Environment overrides:
 *   OPENLCA_AGRIBALYSE_URL  (default: http://localhost:8081)
 *   OPENLCA_AGRIBALYSE_API_KEY  (optional: API key for cloud server)
 *   OUTPUT_SQL              (default: supabase/migrations/20260215000000_agribalyse_factor_integration.sql)
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration ─────────────────────────────────────────────────
// Connects directly to the Agribalyse gdt-server (no database switching)
const AGRIBALYSE_SERVER_URL = process.env.OPENLCA_AGRIBALYSE_URL
  || process.env.OPENLCA_AGRIBALYSE_SERVER_URL
  || 'http://localhost:8081';
const AGRIBALYSE_API_KEY = process.env.OPENLCA_AGRIBALYSE_API_KEY || '';
const OUTPUT_SQL = process.env.OUTPUT_SQL || path.join(
  __dirname, '..', 'supabase', 'migrations',
  '20260215000000_agribalyse_factor_integration.sql'
);

const RECIPE_MIDPOINT_NAME = 'ReCiPe 2016';
const CALC_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

// ─── Target ingredients to search in Agribalyse ───────────────────
// Each entry defines what to search for and how to map the result
// into staging_emission_factors.
interface TargetIngredient {
  /** Display name for the staging_emission_factors row */
  name: string;
  /** Search queries to try (in order) against Agribalyse process names */
  searchQueries: string[];
  /** Material category in staging table */
  category: 'Ingredient' | 'Packaging';
  /** Expected geographic scope */
  geographicScope: string;
  /** Current confidence grade (what we're upgrading FROM) */
  currentGrade: 'LOW' | 'MEDIUM';
  /** Target confidence grade after Agribalyse data */
  targetGrade: 'HIGH' | 'MEDIUM';
  /** System boundary description */
  systemBoundary: string;
  /** Reference unit */
  unit: string;
  /** Pedigree matrix overrides (1=best, 5=worst) */
  pedigree: {
    reliability: number;
    completeness: number;
    temporal: number;
    geographical: number;
    technological: number;
  };
}

const TARGET_INGREDIENTS: TargetIngredient[] = [
  // ─── Wine & Viticulture ──────────────────────────────────────
  {
    name: 'Wine Grapes (France, Agribalyse)',
    searchQueries: ['grape', 'raisin', 'wine grape', 'viticulture'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: cultivation, harvesting, field emissions',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Wine Grapes (France, conventional)',
    searchQueries: ['grape conventional', 'raisin conventionnel'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: conventional cultivation',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Wine Grapes (France, organic)',
    searchQueries: ['grape organic', 'raisin biologique', 'grape bio'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: organic cultivation',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },

  // ─── Cider & Fruit ──────────────────────────────────────────
  {
    name: 'Cider Apples (Agribalyse)',
    searchQueries: ['apple cider', 'pomme cidre', 'apple', 'pomme'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: orchard cultivation and harvesting',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Orange Juice Concentrate (Agribalyse)',
    searchQueries: ['orange juice', 'jus orange', 'orange concentrate'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: cultivation through juice concentration',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 2, technological: 2 },
  },
  {
    name: 'Lemon (Agribalyse)',
    searchQueries: ['lemon', 'citron'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-farm-gate: cultivation and harvesting',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 2, technological: 3 },
  },
  {
    name: 'Lime (Agribalyse)',
    searchQueries: ['lime', 'citron vert'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-farm-gate: cultivation and harvesting',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },
  {
    name: 'Pineapple (Agribalyse)',
    searchQueries: ['pineapple', 'ananas'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-farm-gate: tropical cultivation and harvesting',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },
  {
    name: 'Mango (Agribalyse)',
    searchQueries: ['mango', 'mangue'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-farm-gate: tropical cultivation',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },
  {
    name: 'Passion Fruit (Agribalyse)',
    searchQueries: ['passion fruit', 'fruit de la passion'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-farm-gate: tropical cultivation',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },
  {
    name: 'Cranberry (Agribalyse)',
    searchQueries: ['cranberry', 'canneberge'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-farm-gate: cultivation and harvesting',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },

  // ─── Grains & Brewing ───────────────────────────────────────
  {
    name: 'Barley Grain (Agribalyse)',
    searchQueries: ['barley', 'orge'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: cultivation, harvesting, drying',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Wheat Grain (Agribalyse)',
    searchQueries: ['wheat', 'ble', 'blé'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: cultivation, harvesting, drying',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Maize/Corn Grain (Agribalyse)',
    searchQueries: ['maize', 'corn', 'mais', 'maïs'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: cultivation and harvesting',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Rice Grain (Agribalyse)',
    searchQueries: ['rice', 'riz'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: paddy cultivation and drying',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2 },
  },

  // ─── Sweeteners ─────────────────────────────────────────────
  {
    name: 'Beet Sugar (Agribalyse, France)',
    searchQueries: ['sugar beet', 'sucre betterave', 'betterave'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-factory-gate: beet cultivation through refining',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Cane Sugar (Agribalyse)',
    searchQueries: ['cane sugar', 'sucre canne', 'sugarcane'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-factory-gate: cane cultivation through refining',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 3, technological: 2 },
  },
  {
    name: 'Honey (Agribalyse)',
    searchQueries: ['honey', 'miel'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: apiculture, harvesting, processing',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Maple Syrup (Agribalyse)',
    searchQueries: ['maple syrup', 'sirop erable', 'sirop érable'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-gate: sap collection and concentration',
    unit: 'kg',
    pedigree: { reliability: 3, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },

  // ─── Dairy & Plant Milks ────────────────────────────────────
  {
    name: 'Cow Milk, whole (Agribalyse)',
    searchQueries: ['whole milk', 'lait entier', 'cow milk'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-dairy-gate: farming through pasteurisation',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Cream, dairy (Agribalyse)',
    searchQueries: ['cream', 'creme', 'crème'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-dairy-gate: farming through cream separation',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Oat Milk (Agribalyse)',
    searchQueries: ['oat milk', 'lait avoine', 'boisson avoine'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: oat cultivation through drink production',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Soy Milk (Agribalyse)',
    searchQueries: ['soy milk', 'lait soja', 'boisson soja'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: soy cultivation through drink production',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Almond Milk (Agribalyse)',
    searchQueries: ['almond milk', 'lait amande', 'boisson amande'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: almond cultivation through drink production',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 1, technological: 2 },
  },
  {
    name: 'Coconut Milk (Agribalyse)',
    searchQueries: ['coconut milk', 'lait coco', 'boisson coco'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: coconut cultivation through drink production',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 3, technological: 2 },
  },

  // ─── Botanicals & Spices ────────────────────────────────────
  {
    name: 'Ginger, dried (Agribalyse)',
    searchQueries: ['ginger', 'gingembre'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-gate: cultivation through drying',
    unit: 'kg',
    pedigree: { reliability: 3, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },
  {
    name: 'Cinnamon (Agribalyse)',
    searchQueries: ['cinnamon', 'cannelle'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-gate: bark harvesting through drying and milling',
    unit: 'kg',
    pedigree: { reliability: 3, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },
  {
    name: 'Vanilla, extract (Agribalyse)',
    searchQueries: ['vanilla', 'vanille'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-gate: pod cultivation through extraction',
    unit: 'kg',
    pedigree: { reliability: 3, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },
  {
    name: 'Mint, dried (Agribalyse)',
    searchQueries: ['mint', 'menthe'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-gate: cultivation through drying',
    unit: 'kg',
    pedigree: { reliability: 3, completeness: 3, temporal: 2, geographical: 2, technological: 3 },
  },
  {
    name: 'Cardamom (Agribalyse)',
    searchQueries: ['cardamom', 'cardamome'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-gate: cultivation through drying',
    unit: 'kg',
    pedigree: { reliability: 3, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },

  // ─── Coffee & Tea ───────────────────────────────────────────
  {
    name: 'Coffee, roasted (Agribalyse)',
    searchQueries: ['coffee roasted', 'cafe torrefie', 'café torréfié', 'coffee'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: cultivation through roasting',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2 },
  },
  {
    name: 'Green Tea (Agribalyse)',
    searchQueries: ['green tea', 'the vert', 'thé vert'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: cultivation through processing',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2 },
  },
  {
    name: 'Black Tea (Agribalyse)',
    searchQueries: ['black tea', 'the noir', 'thé noir'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: cultivation through fermentation and drying',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2 },
  },
  {
    name: 'Cocoa Powder (Agribalyse)',
    searchQueries: ['cocoa powder', 'poudre cacao', 'cocoa'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: bean cultivation through pressing and milling',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2 },
  },

  // ─── Acids (from food processing) ──────────────────────────
  {
    name: 'Citric Acid (Agribalyse)',
    searchQueries: ['citric acid', 'acide citrique'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-gate: fermentation production',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 2, technological: 2 },
  },

  // ─── Nuts ───────────────────────────────────────────────────
  {
    name: 'Almonds (Agribalyse)',
    searchQueries: ['almond', 'amande'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: orchard cultivation and harvesting',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2 },
  },
  {
    name: 'Hazelnuts (Agribalyse)',
    searchQueries: ['hazelnut', 'noisette'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'HIGH',
    systemBoundary: 'Cradle-to-farm-gate: orchard cultivation and harvesting',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2 },
  },
  {
    name: 'Coconut, dried (Agribalyse)',
    searchQueries: ['coconut', 'noix de coco'],
    category: 'Ingredient',
    geographicScope: 'FR',
    currentGrade: 'MEDIUM',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-gate: cultivation through drying',
    unit: 'kg',
    pedigree: { reliability: 2, completeness: 3, temporal: 2, geographical: 3, technological: 3 },
  },

  // ─── Wood / Cooperage ──────────────────────────────────────
  {
    name: 'Oak Barrel, French (Agribalyse)',
    searchQueries: ['oak', 'chene', 'chêne', 'barrel', 'wood plank'],
    category: 'Packaging',
    geographicScope: 'FR',
    currentGrade: 'LOW',
    targetGrade: 'MEDIUM',
    systemBoundary: 'Cradle-to-gate: forestry through cooperage',
    unit: 'kg',
    pedigree: { reliability: 3, completeness: 3, temporal: 2, geographical: 1, technological: 3 },
  },
];


// ─── gdt-server REST API helpers ──────────────────────────────────
async function gdtFetch<T>(endpointPath: string, options?: RequestInit): Promise<T> {
  const baseUrl = AGRIBALYSE_SERVER_URL.endsWith('/')
    ? AGRIBALYSE_SERVER_URL.slice(0, -1)
    : AGRIBALYSE_SERVER_URL;
  const url = `${baseUrl}/${endpointPath}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (AGRIBALYSE_API_KEY) {
    headers['X-API-Key'] = AGRIBALYSE_API_KEY;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`gdt-server ${response.status}: ${errorText} (${endpointPath})`);
  }

  const text = await response.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

interface Ref {
  '@type'?: string;
  '@id': string;
  name?: string;
  category?: string;
  description?: string;
}

interface ImpactResult {
  impactCategory: Ref;
  amount: number;
}

async function getAllProcesses(): Promise<Ref[]> {
  return gdtFetch<Ref[]>('data/processes');
}

async function getAllImpactMethods(): Promise<Ref[]> {
  return gdtFetch<Ref[]>('data/impact-methods');
}

async function calculateProcess(
  processId: string,
  impactMethodId: string,
): Promise<ImpactResult[]> {
  const setup = {
    target: { '@type': 'Process', '@id': processId },
    impactMethod: { '@type': 'ImpactMethod', '@id': impactMethodId },
    amount: 1,
  };

  const resultRef = await gdtFetch<Ref>('result/calculate', {
    method: 'POST',
    body: JSON.stringify(setup),
  });

  const resultId = resultRef['@id'];

  // Poll until ready
  const start = Date.now();
  while (Date.now() - start < CALC_TIMEOUT_MS) {
    const state = await gdtFetch<{ isReady?: boolean; error?: string }>(
      `result/${resultId}/state`
    );
    if (state.error) throw new Error(`Calculation failed: ${state.error}`);
    if (state.isReady) break;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  const impacts = await gdtFetch<ImpactResult[]>(`result/${resultId}/total-impacts`);

  // Dispose to free memory
  await gdtFetch<void>(`result/${resultId}/dispose`, { method: 'POST' }).catch(() => {});

  return impacts;
}


// ─── Impact category mapping (same as calculate/route.ts) ─────────
function mapImpacts(results: ImpactResult[]): Record<string, number> {
  const mapped: Record<string, number> = {
    impact_climate: 0,
    impact_climate_fossil: 0,
    impact_climate_biogenic: 0,
    impact_water: 0,
    impact_land: 0,
    impact_waste: 0,
    impact_ozone_depletion: 0,
    impact_freshwater_eutrophication: 0,
    impact_marine_eutrophication: 0,
    impact_terrestrial_acidification: 0,
    impact_freshwater_ecotoxicity: 0,
    impact_marine_ecotoxicity: 0,
    impact_terrestrial_ecotoxicity: 0,
    impact_fossil_resource_scarcity: 0,
    impact_mineral_resource_scarcity: 0,
    impact_particulate_matter: 0,
    impact_ionising_radiation: 0,
    impact_photochemical_ozone_formation: 0,
  };

  for (const r of results) {
    const cat = (r.impactCategory.name || '').toLowerCase();
    const v = r.amount;

    if (cat.includes('climate change') || cat.includes('global warming')) {
      mapped.impact_climate = v;
      if (cat.includes('fossil')) mapped.impact_climate_fossil = v;
      else if (cat.includes('biogenic')) mapped.impact_climate_biogenic = v;
      else {
        // Total GWP — estimate split
        mapped.impact_climate = v;
        mapped.impact_climate_fossil = v * 0.85;
        mapped.impact_climate_biogenic = v * 0.15;
      }
    }
    else if (cat.includes('water consumption') || cat.includes('water use')) mapped.impact_water = v;
    else if (cat.includes('land use')) mapped.impact_land = v;
    else if (cat.includes('ozone depletion')) mapped.impact_ozone_depletion = v;
    else if (cat.includes('freshwater eutrophication') || cat.includes('eutrophication: freshwater')) mapped.impact_freshwater_eutrophication = v;
    else if (cat.includes('marine eutrophication') || cat.includes('eutrophication: marine')) mapped.impact_marine_eutrophication = v;
    else if (cat.includes('terrestrial acidification') || cat.includes('acidification')) mapped.impact_terrestrial_acidification = v;
    else if (cat.includes('freshwater ecotoxicity') || cat.includes('ecotoxicity: freshwater')) mapped.impact_freshwater_ecotoxicity = v;
    else if (cat.includes('marine ecotoxicity') || cat.includes('ecotoxicity: marine')) mapped.impact_marine_ecotoxicity = v;
    else if (cat.includes('terrestrial ecotoxicity') || cat.includes('ecotoxicity: terrestrial')) mapped.impact_terrestrial_ecotoxicity = v;
    else if (cat.includes('fossil resource') || cat.includes('energy resources')) mapped.impact_fossil_resource_scarcity = v;
    else if (cat.includes('mineral resource') || cat.includes('material resources')) mapped.impact_mineral_resource_scarcity = v;
    else if (cat.includes('particulate matter')) mapped.impact_particulate_matter = v;
    else if (cat.includes('ionising radiation')) mapped.impact_ionising_radiation = v;
    else if (cat.includes('photochemical') || cat.includes('ozone formation')) mapped.impact_photochemical_ozone_formation = v;
  }

  return mapped;
}


// ─── Process matching ─────────────────────────────────────────────
function findBestProcess(
  allProcesses: Ref[],
  searchQueries: string[],
): Ref | null {
  for (const query of searchQueries) {
    const lowerQuery = query.toLowerCase();
    const matches = allProcesses.filter(p => {
      const name = (p.name || '').toLowerCase();
      return name.includes(lowerQuery);
    });

    if (matches.length === 0) continue;

    // Prefer "market for" processes (representative supply mixes)
    const marketMatch = matches.find(p =>
      (p.name || '').toLowerCase().includes('market')
    );
    if (marketMatch) return marketMatch;

    // Prefer shorter names (more generic, less niche)
    matches.sort((a, b) => (a.name || '').length - (b.name || '').length);
    return matches[0];
  }

  return null;
}


// ─── SQL generation ───────────────────────────────────────────────
function escapeSQL(val: string): string {
  return val.replace(/'/g, "''");
}

interface ExtractedFactor {
  ingredient: TargetIngredient;
  process: Ref;
  impacts: Record<string, number>;
}

function generateSQL(factors: ExtractedFactor[]): string {
  const lines: string[] = [];

  lines.push('-- ============================================================');
  lines.push('-- Agribalyse v3.2 Factor Integration');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- Source: Agribalyse v3.2 (ADEME/INRAE) via OpenLCA gdt-server');
  lines.push('-- Impact Method: ReCiPe 2016 v1.03, Midpoint (H)');
  lines.push('-- ============================================================');
  lines.push('');
  lines.push('-- This migration inserts Agribalyse-sourced emission factors into');
  lines.push('-- staging_emission_factors. Factors are global (organization_id IS NULL)');
  lines.push('-- and visible to all platform users.');
  lines.push('');

  for (const f of factors) {
    const { ingredient: ing, process: proc, impacts: imp } = f;

    // Build metadata JSON
    const metadata = {
      agribalyse_version: '3.2',
      agribalyse_process_id: proc['@id'],
      agribalyse_process_name: proc.name,
      agribalyse_category: proc.category || null,
      impact_method: 'ReCiPe 2016 v1.03, Midpoint (H)',
      system_boundary: ing.systemBoundary,
      extraction_date: new Date().toISOString().split('T')[0],
      source_note: 'Calculated from Agribalyse v3.2 database (ADEME/INRAE) using OpenLCA. Per 1 kg of product at farm/factory gate.',
    };

    // Compute DQI score from pedigree (0–100 scale, 100=best)
    const ped = ing.pedigree;
    const avgPedigree = (ped.reliability + ped.completeness + ped.temporal + ped.geographical + ped.technological) / 5;
    const dqiScore = Math.round((1 - (avgPedigree - 1) / 4) * 100);

    // Uncertainty from grade
    const uncertaintyPct = ing.targetGrade === 'HIGH' ? 15 : 25;

    lines.push(`-- ${ing.name}`);
    lines.push(`-- Agribalyse process: ${proc.name} (${proc['@id']})`);
    lines.push(`INSERT INTO staging_emission_factors (`);
    lines.push(`  organization_id, name, category, reference_unit,`);
    lines.push(`  co2_factor, co2_fossil_factor, co2_biogenic_factor,`);
    lines.push(`  water_factor, land_factor, waste_factor,`);
    lines.push(`  terrestrial_ecotoxicity_factor, freshwater_ecotoxicity_factor, marine_ecotoxicity_factor,`);
    lines.push(`  freshwater_eutrophication_factor, marine_eutrophication_factor, terrestrial_acidification_factor,`);
    lines.push(`  source, geographic_scope, data_quality_grade, confidence_score,`);
    lines.push(`  pedigree_reliability, pedigree_completeness, pedigree_temporal,`);
    lines.push(`  pedigree_geographical, pedigree_technological, pedigree_dqi_score,`);
    lines.push(`  uncertainty_percent, data_collection_year, metadata`);
    lines.push(`) VALUES (`);
    lines.push(`  NULL,`); // organization_id — global
    lines.push(`  '${escapeSQL(ing.name)}',`);
    lines.push(`  '${ing.category}',`);
    lines.push(`  '${ing.unit}',`);
    lines.push(`  ${imp.impact_climate.toFixed(6)},`);
    lines.push(`  ${imp.impact_climate_fossil.toFixed(6)},`);
    lines.push(`  ${imp.impact_climate_biogenic.toFixed(6)},`);
    lines.push(`  ${imp.impact_water.toFixed(6)},`);
    lines.push(`  ${imp.impact_land.toFixed(6)},`);
    lines.push(`  ${imp.impact_waste.toFixed(6)},`);
    lines.push(`  ${imp.impact_terrestrial_ecotoxicity.toFixed(6)},`);
    lines.push(`  ${imp.impact_freshwater_ecotoxicity.toFixed(6)},`);
    lines.push(`  ${imp.impact_marine_ecotoxicity.toFixed(6)},`);
    lines.push(`  ${imp.impact_freshwater_eutrophication.toFixed(6)},`);
    lines.push(`  ${imp.impact_marine_eutrophication.toFixed(6)},`);
    lines.push(`  ${imp.impact_terrestrial_acidification.toFixed(6)},`);
    lines.push(`  'Agribalyse v3.2 (ADEME/INRAE)',`);
    lines.push(`  '${ing.geographicScope}',`);
    lines.push(`  '${ing.targetGrade}',`);
    lines.push(`  ${ing.targetGrade === 'HIGH' ? 90 : 75},`);
    lines.push(`  ${ped.reliability}, ${ped.completeness}, ${ped.temporal},`);
    lines.push(`  ${ped.geographical}, ${ped.technological}, ${dqiScore},`);
    lines.push(`  ${uncertaintyPct}, 2023,`);
    lines.push(`  '${escapeSQL(JSON.stringify(metadata))}'::jsonb`);
    lines.push(`) ON CONFLICT DO NOTHING;`);
    lines.push('');
  }

  // Summary comment
  lines.push(`-- ============================================================`);
  lines.push(`-- Summary: ${factors.length} Agribalyse factors extracted`);
  lines.push(`-- HIGH confidence: ${factors.filter(f => f.ingredient.targetGrade === 'HIGH').length}`);
  lines.push(`-- MEDIUM confidence: ${factors.filter(f => f.ingredient.targetGrade === 'MEDIUM').length}`);
  lines.push(`-- ============================================================`);

  return lines.join('\n');
}


// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Agribalyse v3.2 Factor Extraction for Alkatera        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Connect to Agribalyse server and verify
  console.log(`1. Connecting to Agribalyse gdt-server at ${AGRIBALYSE_SERVER_URL}...`);
  try {
    // Simple health check — fetch processes list
    const testResponse = await gdtFetch<any[]>('data/processes');
    console.log(`   Connected. Server has ${testResponse?.length || 0} processes.`);
  } catch (err: any) {
    console.error(`   ERROR: Cannot connect to Agribalyse server at ${AGRIBALYSE_SERVER_URL}`);
    console.error(`   Make sure the Agribalyse gdt-server is running.`);
    console.error(`   ${err.message}`);
    process.exit(1);
  }

  // Step 2: Load processes and find impact method
  console.log('\n2. Loading Agribalyse processes...');
  const allProcesses = await getAllProcesses();
  console.log(`   Found ${allProcesses.length} processes in Agribalyse.`);

  console.log('\n3. Finding ReCiPe 2016 impact method...');
  const allMethods = await getAllImpactMethods();
  const recipeMethod = allMethods.find(m => {
    const name = (m.name || '').toLowerCase();
    return name.includes('recipe') && name.includes('midpoint');
  });

  if (!recipeMethod) {
    console.error('   ERROR: ReCiPe 2016 Midpoint impact method not found in Agribalyse database.');
    console.error('   Available methods:', allMethods.map(m => m.name).join('; '));
    console.error('   You may need to import the ReCiPe 2016 method pack into the Agribalyse database.');
    process.exit(1);
  }
  console.log(`   Using: ${recipeMethod.name} (${recipeMethod['@id']})`);

  // Step 4: Extract factors
  console.log(`\n4. Extracting factors for ${TARGET_INGREDIENTS.length} target ingredients...\n`);

  const extracted: ExtractedFactor[] = [];
  const notFound: string[] = [];

  for (let i = 0; i < TARGET_INGREDIENTS.length; i++) {
    const ing = TARGET_INGREDIENTS[i];
    const label = `   [${i + 1}/${TARGET_INGREDIENTS.length}]`;

    console.log(`${label} Searching for: ${ing.name}`);
    const process = findBestProcess(allProcesses, ing.searchQueries);

    if (!process) {
      console.log(`${label}   ✗ NOT FOUND — skipping`);
      notFound.push(ing.name);
      continue;
    }

    console.log(`${label}   Found: ${process.name} (${process['@id'].slice(0, 8)}...)`);
    console.log(`${label}   Calculating impacts...`);

    try {
      const rawImpacts = await calculateProcess(process['@id'], recipeMethod['@id']);
      const impacts = mapImpacts(rawImpacts);

      console.log(`${label}   ✓ Climate: ${impacts.impact_climate.toFixed(4)} kg CO₂e/kg`);
      console.log(`${label}     Water: ${impacts.impact_water.toFixed(4)} m³/kg`);

      extracted.push({ ingredient: ing, process, impacts });
    } catch (err: any) {
      console.error(`${label}   ✗ Calculation failed: ${err.message}`);
      notFound.push(ing.name);
    }
  }

  // Step 5: Generate SQL
  console.log(`\n5. Generating SQL migration...`);
  const sql = generateSQL(extracted);

  const outputDir = path.dirname(OUTPUT_SQL);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_SQL, sql, 'utf-8');
  console.log(`   Written to: ${OUTPUT_SQL}`);

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Extraction Complete                                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Extracted:  ${extracted.length} factors`);
  console.log(`  Not found:  ${notFound.length} ingredients`);
  if (notFound.length > 0) {
    console.log(`  Missing:    ${notFound.join(', ')}`);
  }
  console.log(`\n  Next steps:`);
  console.log(`  1. Review the generated SQL: ${OUTPUT_SQL}`);
  console.log(`  2. Apply: npx supabase db push (or run migration manually)`);
  console.log(`  3. Verify factors appear in the Global Drinks Factor Library`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
