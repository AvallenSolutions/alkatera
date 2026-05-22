/**
 * ENCORE-aligned ecosystem-service dependency catalogue and scoring.
 *
 * Sources:
 *   - ENCORE (Exploring Natural Capital Opportunities, Risks and Exposure):
 *     https://www.encorenature.org/en
 *   - TNFD LEAP framework, dependency disclosure expectations
 *
 * For the drinks industry, ENCORE flags a curated subset of services as
 * material. Producers with crops in the supply chain depend heavily on
 * freshwater, soil, climate regulation, pollination, and pest control.
 * Operations also depend on water flow regulation (for cooling/process
 * water) and biomass provisioning (raw materials).
 *
 * Score integration: declared materiality on these dependencies feeds a
 * dependencies sub-score. The score rewards COVERAGE of sector-material
 * dependencies (rather than total declarations) so producers can't game
 * it by ticking irrelevant boxes.
 */

export type NatureDependencyType =
  | 'freshwater_supply'
  | 'biomass_provisioning'
  | 'genetic_materials'
  | 'pollination'
  | 'soil_quality_regulation'
  | 'water_flow_regulation'
  | 'water_quality_regulation'
  | 'climate_regulation'
  | 'pest_disease_control'
  | 'flood_storm_protection'
  | 'mass_stabilisation_erosion_control'
  | 'air_filtration'
  | 'noise_attenuation'
  | 'cultural_heritage'
  | 'recreation_tourism'
  | 'spiritual_artistic_inspiration'

export type Materiality = 'low' | 'medium' | 'high' | 'critical'

export interface DependencyMeta {
  value: NatureDependencyType
  label: string
  description: string
  category: 'provisioning' | 'regulating_maintenance' | 'cultural'
  emoji: string
  /** True when ENCORE flags this as material for the drinks industry. */
  drinks_material: boolean
}

export const NATURE_DEPENDENCIES: DependencyMeta[] = [
  // Provisioning
  {
    value: 'freshwater_supply',
    label: 'Freshwater supply',
    description: 'Water for production, ingredients, and cleaning. Without it, no drinks.',
    category: 'provisioning',
    emoji: '💧',
    drinks_material: true,
  },
  {
    value: 'biomass_provisioning',
    label: 'Biomass provisioning',
    description: 'Grains, grapes, agave, fruit, hops, sugar — the raw plant matter behind every drink.',
    category: 'provisioning',
    emoji: '🌾',
    drinks_material: true,
  },
  {
    value: 'genetic_materials',
    label: 'Genetic materials',
    description: 'Crop varieties, yeast strains, breeds — biodiversity underpinning your inputs.',
    category: 'provisioning',
    emoji: '🧬',
    drinks_material: false,
  },
  // Regulating & Maintenance
  {
    value: 'pollination',
    label: 'Pollination',
    description: 'Insects pollinating fruit, agave, coffee, cocoa. Critical for many ingredient supply chains.',
    category: 'regulating_maintenance',
    emoji: '🐝',
    drinks_material: true,
  },
  {
    value: 'soil_quality_regulation',
    label: 'Soil quality regulation',
    description: 'Healthy soil produces healthy crops. Microbiome, organic matter, structure.',
    category: 'regulating_maintenance',
    emoji: '🌱',
    drinks_material: true,
  },
  {
    value: 'water_flow_regulation',
    label: 'Water flow regulation',
    description: 'Catchments delivering predictable water flow throughout the year.',
    category: 'regulating_maintenance',
    emoji: '🏞️',
    drinks_material: true,
  },
  {
    value: 'water_quality_regulation',
    label: 'Water quality regulation',
    description: 'Wetlands, riparian zones filtering pollutants from incoming water.',
    category: 'regulating_maintenance',
    emoji: '🪷',
    drinks_material: true,
  },
  {
    value: 'climate_regulation',
    label: 'Climate regulation',
    description: 'Stable temperature and rainfall patterns — agriculture is climate-sensitive.',
    category: 'regulating_maintenance',
    emoji: '☁️',
    drinks_material: true,
  },
  {
    value: 'pest_disease_control',
    label: 'Pest & disease control',
    description: 'Predator/parasite biodiversity controlling crop pests. Less needed pesticide.',
    category: 'regulating_maintenance',
    emoji: '🐞',
    drinks_material: true,
  },
  {
    value: 'flood_storm_protection',
    label: 'Flood & storm protection',
    description: 'Wetlands, mangroves, dune systems buffering operations from extreme weather.',
    category: 'regulating_maintenance',
    emoji: '🌊',
    drinks_material: false,
  },
  {
    value: 'mass_stabilisation_erosion_control',
    label: 'Soil erosion control',
    description: 'Vegetation holding soil in place — losing topsoil is expensive and irreversible.',
    category: 'regulating_maintenance',
    emoji: '🪨',
    drinks_material: true,
  },
  {
    value: 'air_filtration',
    label: 'Air filtration',
    description: 'Vegetation filtering particulates and pollutants near your operations.',
    category: 'regulating_maintenance',
    emoji: '🍃',
    drinks_material: false,
  },
  {
    value: 'noise_attenuation',
    label: 'Noise attenuation',
    description: 'Vegetation buffering noise from operations to neighbouring communities.',
    category: 'regulating_maintenance',
    emoji: '🎧',
    drinks_material: false,
  },
  // Cultural
  {
    value: 'cultural_heritage',
    label: 'Cultural heritage',
    description: 'Terroir, regional identity, place-based reputation. Champagne, Tequila, Scotch — geography is the brand.',
    category: 'cultural',
    emoji: '🏛️',
    drinks_material: true,
  },
  {
    value: 'recreation_tourism',
    label: 'Recreation & tourism',
    description: 'Visitor centres, vineyard tours, distillery experiences depend on landscape value.',
    category: 'cultural',
    emoji: '🚶',
    drinks_material: false,
  },
  {
    value: 'spiritual_artistic_inspiration',
    label: 'Spiritual & artistic inspiration',
    description: 'Brand stories rooted in nature — packaging, marketing, place-based narrative.',
    category: 'cultural',
    emoji: '✨',
    drinks_material: false,
  },
]

const META_BY_VALUE: Record<NatureDependencyType, DependencyMeta> = (() => {
  const map = {} as Record<NatureDependencyType, DependencyMeta>
  for (const m of NATURE_DEPENDENCIES) map[m.value] = m
  return map
})()

export function getDependencyMeta(
  value: string | null | undefined,
): DependencyMeta | null {
  if (!value) return null
  return META_BY_VALUE[value as NatureDependencyType] ?? null
}

/** Drinks-material dependencies (per ENCORE sector profile). 10 of 16. */
export const DRINKS_MATERIAL_DEPENDENCIES: NatureDependencyType[] =
  NATURE_DEPENDENCIES.filter(d => d.drinks_material).map(d => d.value)

const MATERIALITY_TO_NUMERIC: Record<Materiality, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

export interface DependencyDeclaration {
  dependency_type: string
  materiality: Materiality
  has_notes: boolean
}

/**
 * Compute the dependencies sub-score from declarations.
 *
 * Calibration:
 *   - Coverage: % of drinks-material dependencies declared (whatever materiality).
 *     This is the dominant signal — TNFD wants to see thinking, not gaming.
 *   - Materiality bonus: small bonus for declared materiality being non-trivial
 *     ('high' / 'critical' on material dependencies — captures depth of analysis).
 *   - Notes bonus: small bonus for explanatory notes on high/critical ones.
 *
 * Scoring:
 *   coverage_pct = declared_drinks_material_count / DRINKS_MATERIAL_DEPENDENCIES.length × 100
 *   bonus = up to +10 for high/critical declarations with notes on material deps
 *   final = min(100, coverage_pct × 0.9 + bonus)
 *
 * Return null when there are no declarations at all (axis is absent, not zero).
 */
export function computeDependenciesSubScore(
  declarations: DependencyDeclaration[],
): number | null {
  if (declarations.length === 0) return null

  const declaredTypes = new Set<string>()
  let depthBonus = 0
  for (const d of declarations) {
    declaredTypes.add(d.dependency_type)
    if (!DRINKS_MATERIAL_DEPENDENCIES.includes(d.dependency_type as NatureDependencyType)) {
      continue
    }
    const numericMat = MATERIALITY_TO_NUMERIC[d.materiality] ?? 0
    if (numericMat >= 3 && d.has_notes) depthBonus += 1.5 // high/critical with notes
    else if (numericMat >= 3) depthBonus += 0.8 // high/critical without notes
  }
  const coveredMaterial = DRINKS_MATERIAL_DEPENDENCIES.filter(t =>
    declaredTypes.has(t),
  ).length
  const coveragePct =
    (coveredMaterial / DRINKS_MATERIAL_DEPENDENCIES.length) * 100
  const cappedBonus = Math.min(10, depthBonus)
  return Math.min(100, Math.round(coveragePct * 0.9 + cappedBonus))
}
