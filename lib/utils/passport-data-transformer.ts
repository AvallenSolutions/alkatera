import type {
  LCAData,
  LCADataBreakdownItem,
  LCADataWaterFootprint,
  LCADataWasteFootprint,
  LCADataProductIdentity,
  LCADataOrigins,
  LCADataPackaging,
  OriginItem,
  PackagingComponentItem,
  WaterBreakdownItem,
  WasteBreakdownItem,
  SubscriptionTier,
} from '@/lib/types/passport';

export interface TransformInput {
  product: {
    id: string;
    name: string;
    product_description?: string | null;
    image_url?: string | null;
    product_category?: string | null;
    functional_unit?: string | null;
    unit_size_value?: number | null;
    unit_size_unit?: string | null;
    system_boundary?: string | null;
    certifications?: Array<{ name: string }> | null;
    awards?: Array<{ name: string }> | null;
    packaging_circularity_score?: number | null;
    created_at: string;
    updated_at: string;
  };
  lca: {
    id?: string;
    reference_year?: number | null;
    aggregated_impacts?: {
      climate_change_gwp100?: number;
      water_consumption?: number;
      waste?: number;
      land_use?: number;
      breakdown?: {
        by_category?: {
          materials?: number;
          packaging?: number;
          transport?: number;
          production?: number;
        };
        by_lifecycle_stage?: {
          raw_materials?: number;
          processing?: number;
          packaging?: number;
          packaging_stage?: number; // Legacy alias
          distribution?: number;
          use_phase?: number;
          end_of_life?: number;
        };
        water?: {
          agricultural?: number;
          industrial?: number;
          packaging?: number;
          cleaning?: number;
        };
        waste?: {
          organic?: number;
          packaging?: number;
          process?: number;
          hazardous?: number;
        };
      };
      water_scarcity_weighted?: number;
      recycling_rate?: number;
      circularity_score?: number;
    };
    methodology?: string;
    updated_at?: string;
  } | null;
  materials: Array<{
    name?: string;
    material_type?: string;
    quantity?: number;
    origin_country?: string | null;
    origin_country_code?: string | null;
    is_organic_certified?: boolean | null;
    packaging_category?: string | null;
    recycled_content_percentage?: number | null;
    recyclability_score?: number | null;
    end_of_life_pathway?: string | null;
    is_reusable?: boolean | null;
    is_compostable?: boolean | null;
  }>;
  organization: {
    id: string;
    name: string;
    logo_url?: string | null;
    subscription_tier?: SubscriptionTier;
    subscription_status?: string;
  } | null;
  token?: string;
  lcaCount?: number;
}

const CARBON_BREAKDOWN_COLORS: Record<string, string> = {
  'Raw Materials': '#84cc16',
  'Packaging': '#3f6212',
  'Processing': '#a3e635',
  'Distribution': '#ecfccb',
  'End of Life': '#1a2e05',
};

const WATER_BREAKDOWN_COLORS: Record<string, string> = {
  'Agricultural': '#0ea5e9',
  'Industrial': '#0284c7',
  'Packaging': '#0369a1',
  'Cleaning': '#7dd3fc',
};

const WASTE_BREAKDOWN_COLORS: Record<string, string> = {
  'Organic': '#22c55e',
  'Packaging': '#f97316',
  'Process': '#eab308',
  'Hazardous': '#ef4444',
};

const INDUSTRY_BENCHMARK = 1.2;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function generateExecutiveSummaryHeading(
  productName: string,
  reductionPct: number | null
): string {
  if (reductionPct && reductionPct > 0) {
    return `Setting new standards in environmental transparency.`;
  }
  return `Full environmental transparency for ${productName}.`;
}

function generateExecutiveSummaryContent(
  product: TransformInput['product'],
  lca: TransformInput['lca'],
  tier: SubscriptionTier
): string {
  const ghg = lca?.aggregated_impacts?.climate_change_gwp100 || 0;
  const functionalUnit = product.functional_unit
    || (product.unit_size_value && product.unit_size_unit
      ? `${product.unit_size_value} ${product.unit_size_unit}`
      : 'unit');

  if (tier === 'seed') {
    return `This product passport provides verified environmental impact data for ${product.name}. ` +
      `The total carbon footprint is ${ghg.toFixed(2)} kg CO2e per ${functionalUnit}.`;
  }

  const breakdown = lca?.aggregated_impacts?.breakdown?.by_category;
  const hasBreakdown = breakdown && (
    (breakdown.materials || 0) > 0 ||
    (breakdown.packaging || 0) > 0 ||
    (breakdown.production || 0) > 0 ||
    (breakdown.transport || 0) > 0
  );

  if (hasBreakdown) {
    const largestCategory = Object.entries(breakdown)
      .filter(([, val]) => typeof val === 'number' && val > 0)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0];

    const categoryName = largestCategory
      ? largestCategory[0].replace(/([A-Z])/g, ' $1').trim()
      : 'production';

    return `This comprehensive life cycle assessment reveals the environmental footprint of ${product.name}. ` +
      `With a total carbon footprint of ${ghg.toFixed(2)} kg CO2e per ${functionalUnit}, ` +
      `the analysis shows that ${categoryName} represents the largest contribution to overall impacts. ` +
      `This transparency enables informed decisions for continuous environmental improvement.`;
  }

  return `This life cycle assessment provides a detailed environmental footprint analysis for ${product.name}. ` +
    `The total carbon footprint is ${ghg.toFixed(2)} kg CO2e per ${functionalUnit}, ` +
    `calculated following ISO 14040 standards and verified methodologies.`;
}

function generateKeyHighlight(
  lca: TransformInput['lca'],
  reductionPct: number | null
): string {
  const ghg = lca?.aggregated_impacts?.climate_change_gwp100 || 0;

  if (reductionPct && reductionPct > 0) {
    return `${Math.round(reductionPct)}% lower carbon footprint than industry average through sustainable practices.`;
  }

  return `${ghg.toFixed(2)} kg CO2e per unit - comprehensive lifecycle impact assessment verified.`;
}

function buildCarbonBreakdown(lca: TransformInput['lca']): LCADataBreakdownItem[] {
  // Support both legacy by_category and current by_lifecycle_stage structures
  const byCategory = lca?.aggregated_impacts?.breakdown?.by_category;
  const byLifecycle = lca?.aggregated_impacts?.breakdown?.by_lifecycle_stage;

  const items: LCADataBreakdownItem[] = [];

  // Use by_lifecycle_stage (current structure) if available, fallback to by_category (legacy)
  if (byLifecycle) {
    const rawMaterials = Number(byLifecycle.raw_materials || 0);
    const packaging = Number(byLifecycle.packaging ?? byLifecycle.packaging_stage ?? 0);
    const processing = Number(byLifecycle.processing || 0);
    const distribution = Number(byLifecycle.distribution || 0);
    const endOfLife = Number(byLifecycle.end_of_life || 0);

    const total = rawMaterials + packaging + processing + distribution + endOfLife;
    if (total === 0) return [];

    if (rawMaterials > 0) {
      items.push({
        name: 'Raw Materials',
        value: Math.round((rawMaterials / total) * 100),
        color: CARBON_BREAKDOWN_COLORS['Raw Materials'],
      });
    }

    if (packaging > 0) {
      items.push({
        name: 'Packaging',
        value: Math.round((packaging / total) * 100),
        color: CARBON_BREAKDOWN_COLORS['Packaging'],
      });
    }

    if (processing > 0) {
      items.push({
        name: 'Processing',
        value: Math.round((processing / total) * 100),
        color: CARBON_BREAKDOWN_COLORS['Processing'],
      });
    }

    if (distribution > 0) {
      items.push({
        name: 'Distribution',
        value: Math.round((distribution / total) * 100),
        color: CARBON_BREAKDOWN_COLORS['Distribution'],
      });
    }

    if (endOfLife > 0) {
      items.push({
        name: 'End of Life',
        value: Math.round((endOfLife / total) * 100),
        color: CARBON_BREAKDOWN_COLORS['End of Life'],
      });
    }

    return items;
  }

  // Fallback to legacy by_category structure
  if (!byCategory) return [];

  const total =
    (byCategory.materials || 0) +
    (byCategory.packaging || 0) +
    (byCategory.production || 0) +
    (byCategory.transport || 0);

  if (total === 0) return [];

  if (byCategory.materials && byCategory.materials > 0) {
    items.push({
      name: 'Raw Materials',
      value: Math.round((byCategory.materials / total) * 100),
      color: CARBON_BREAKDOWN_COLORS['Raw Materials'],
    });
  }

  if (byCategory.packaging && byCategory.packaging > 0) {
    items.push({
      name: 'Packaging',
      value: Math.round((byCategory.packaging / total) * 100),
      color: CARBON_BREAKDOWN_COLORS['Packaging'],
    });
  }

  if (byCategory.production && byCategory.production > 0) {
    items.push({
      name: 'Processing',
      value: Math.round((byCategory.production / total) * 100),
      color: CARBON_BREAKDOWN_COLORS['Processing'],
    });
  }

  if (byCategory.transport && byCategory.transport > 0) {
    items.push({
      name: 'Distribution',
      value: Math.round((byCategory.transport / total) * 100),
      color: CARBON_BREAKDOWN_COLORS['Distribution'],
    });
  }

  return items;
}

function buildWaterFootprint(lca: TransformInput['lca']): LCADataWaterFootprint | null {
  const totalWater = lca?.aggregated_impacts?.water_consumption;
  if (!totalWater || totalWater <= 0) return null;

  const waterBreakdown = lca?.aggregated_impacts?.breakdown?.water;
  const breakdown: WaterBreakdownItem[] = [];

  if (waterBreakdown) {
    const total =
      (waterBreakdown.agricultural || 0) +
      (waterBreakdown.industrial || 0) +
      (waterBreakdown.packaging || 0) +
      (waterBreakdown.cleaning || 0);

    if (total > 0) {
      if (waterBreakdown.agricultural && waterBreakdown.agricultural > 0) {
        breakdown.push({
          name: 'Agricultural',
          value: waterBreakdown.agricultural,
          unit: 'L',
          color: WATER_BREAKDOWN_COLORS['Agricultural'],
          description: 'Water used in growing and harvesting raw ingredients',
        });
      }
      if (waterBreakdown.industrial && waterBreakdown.industrial > 0) {
        breakdown.push({
          name: 'Industrial',
          value: waterBreakdown.industrial,
          unit: 'L',
          color: WATER_BREAKDOWN_COLORS['Industrial'],
          description: 'Water consumed in manufacturing processes',
        });
      }
      if (waterBreakdown.packaging && waterBreakdown.packaging > 0) {
        breakdown.push({
          name: 'Packaging',
          value: waterBreakdown.packaging,
          unit: 'L',
          color: WATER_BREAKDOWN_COLORS['Packaging'],
          description: 'Water used in packaging material production',
        });
      }
      if (waterBreakdown.cleaning && waterBreakdown.cleaning > 0) {
        breakdown.push({
          name: 'Cleaning',
          value: waterBreakdown.cleaning,
          unit: 'L',
          color: WATER_BREAKDOWN_COLORS['Cleaning'],
          description: 'Water used for equipment and facility cleaning',
        });
      }
    }
  }

  if (breakdown.length === 0) {
    const estimatedAgricultural = totalWater * 0.65;
    const estimatedIndustrial = totalWater * 0.20;
    const estimatedPackaging = totalWater * 0.10;
    const estimatedCleaning = totalWater * 0.05;

    breakdown.push(
      {
        name: 'Agricultural',
        value: Math.round(estimatedAgricultural * 100) / 100,
        unit: 'L',
        color: WATER_BREAKDOWN_COLORS['Agricultural'],
        description: 'Water used in growing and harvesting raw ingredients',
      },
      {
        name: 'Industrial',
        value: Math.round(estimatedIndustrial * 100) / 100,
        unit: 'L',
        color: WATER_BREAKDOWN_COLORS['Industrial'],
        description: 'Water consumed in manufacturing processes',
      },
      {
        name: 'Packaging',
        value: Math.round(estimatedPackaging * 100) / 100,
        unit: 'L',
        color: WATER_BREAKDOWN_COLORS['Packaging'],
        description: 'Water used in packaging material production',
      },
      {
        name: 'Cleaning',
        value: Math.round(estimatedCleaning * 100) / 100,
        unit: 'L',
        color: WATER_BREAKDOWN_COLORS['Cleaning'],
        description: 'Water used for equipment and facility cleaning',
      }
    );
  }

  return {
    total: totalWater,
    unit: 'L',
    breakdown,
    scarcityWeighted: lca?.aggregated_impacts?.water_scarcity_weighted || null,
  };
}

function buildWasteFootprint(lca: TransformInput['lca']): LCADataWasteFootprint | null {
  const totalWaste = lca?.aggregated_impacts?.waste;
  if (!totalWaste || totalWaste <= 0) return null;

  const wasteBreakdown = lca?.aggregated_impacts?.breakdown?.waste;
  const breakdown: WasteBreakdownItem[] = [];

  if (wasteBreakdown) {
    const total =
      (wasteBreakdown.organic || 0) +
      (wasteBreakdown.packaging || 0) +
      (wasteBreakdown.process || 0) +
      (wasteBreakdown.hazardous || 0);

    if (total > 0) {
      if (wasteBreakdown.organic && wasteBreakdown.organic > 0) {
        breakdown.push({
          name: 'Organic',
          value: wasteBreakdown.organic,
          unit: 'kg',
          color: WASTE_BREAKDOWN_COLORS['Organic'],
          recyclable: true,
          description: 'Biodegradable waste from raw materials and processing',
        });
      }
      if (wasteBreakdown.packaging && wasteBreakdown.packaging > 0) {
        breakdown.push({
          name: 'Packaging',
          value: wasteBreakdown.packaging,
          unit: 'kg',
          color: WASTE_BREAKDOWN_COLORS['Packaging'],
          recyclable: true,
          description: 'Packaging materials from production and distribution',
        });
      }
      if (wasteBreakdown.process && wasteBreakdown.process > 0) {
        breakdown.push({
          name: 'Process',
          value: wasteBreakdown.process,
          unit: 'kg',
          color: WASTE_BREAKDOWN_COLORS['Process'],
          recyclable: false,
          description: 'Industrial waste from manufacturing operations',
        });
      }
      if (wasteBreakdown.hazardous && wasteBreakdown.hazardous > 0) {
        breakdown.push({
          name: 'Hazardous',
          value: wasteBreakdown.hazardous,
          unit: 'kg',
          color: WASTE_BREAKDOWN_COLORS['Hazardous'],
          recyclable: false,
          description: 'Waste requiring special handling and disposal',
        });
      }
    }
  }

  if (breakdown.length === 0) {
    const estimatedOrganic = totalWaste * 0.45;
    const estimatedPackaging = totalWaste * 0.35;
    const estimatedProcess = totalWaste * 0.18;
    const estimatedHazardous = totalWaste * 0.02;

    breakdown.push(
      {
        name: 'Organic',
        value: Math.round(estimatedOrganic * 1000) / 1000,
        unit: 'kg',
        color: WASTE_BREAKDOWN_COLORS['Organic'],
        recyclable: true,
        description: 'Biodegradable waste from raw materials and processing',
      },
      {
        name: 'Packaging',
        value: Math.round(estimatedPackaging * 1000) / 1000,
        unit: 'kg',
        color: WASTE_BREAKDOWN_COLORS['Packaging'],
        recyclable: true,
        description: 'Packaging materials from production and distribution',
      },
      {
        name: 'Process',
        value: Math.round(estimatedProcess * 1000) / 1000,
        unit: 'kg',
        color: WASTE_BREAKDOWN_COLORS['Process'],
        recyclable: false,
        description: 'Industrial waste from manufacturing operations',
      },
      {
        name: 'Hazardous',
        value: Math.round(estimatedHazardous * 1000) / 1000,
        unit: 'kg',
        color: WASTE_BREAKDOWN_COLORS['Hazardous'],
        recyclable: false,
        description: 'Waste requiring special handling and disposal',
      }
    );
  }

  return {
    total: totalWaste,
    unit: 'kg',
    breakdown,
    recyclingRate: lca?.aggregated_impacts?.recycling_rate || null,
    circularityScore: lca?.aggregated_impacts?.circularity_score || null,
  };
}

function buildProductIdentity(
  product: TransformInput['product'],
  organization: TransformInput['organization']
): LCADataProductIdentity {
  const volumeDisplay = product.unit_size_value && product.unit_size_unit
    ? `${product.unit_size_value}${product.unit_size_unit}`
    : null;

  return {
    productImage: product.image_url || null,
    productCategory: product.product_category || null,
    volumeDisplay,
    productDescription: product.product_description || null,
    organizationName: organization?.name || '',
    organizationLogo: organization?.logo_url || null,
    certifications: product.certifications || [],
    awards: product.awards || [],
  };
}

function buildOrigins(materials: TransformInput['materials']): LCADataOrigins | null {
  const ingredients: OriginItem[] = [];
  const packaging: OriginItem[] = [];
  const countriesSet = new Set<string>();

  for (const mat of materials) {
    if (!mat.origin_country || !mat.name) continue;

    countriesSet.add(mat.origin_country);

    const item: OriginItem = {
      name: mat.name,
      originCountry: mat.origin_country,
      originCountryCode: mat.origin_country_code || null,
      isOrganic: mat.is_organic_certified === true,
      type: mat.material_type === 'packaging' ? 'packaging' : 'ingredient',
      packagingCategory: mat.packaging_category || undefined,
    };

    if (item.type === 'packaging') {
      packaging.push(item);
    } else {
      ingredients.push(item);
    }
  }

  if (ingredients.length === 0 && packaging.length === 0) return null;

  return {
    ingredients,
    packaging,
    totalIngredients: ingredients.length + packaging.length,
    totalCountries: countriesSet.size,
  };
}

function buildPackaging(
  materials: TransformInput['materials'],
  product: TransformInput['product']
): LCADataPackaging | null {
  const packagingMaterials = materials.filter(m => m.material_type === 'packaging');
  if (packagingMaterials.length === 0) return null;

  const components: PackagingComponentItem[] = packagingMaterials.map(m => ({
    name: m.name || 'Unknown',
    packagingCategory: m.packaging_category || 'other',
    recycledContentPercentage: m.recycled_content_percentage ?? null,
    recyclabilityScore: m.recyclability_score ?? null,
    endOfLifePathway: m.end_of_life_pathway || null,
    isReusable: m.is_reusable === true,
    isCompostable: m.is_compostable === true,
  }));

  // Calculate avg recycled content across ALL packaging components (including 0%)
  const withRecycled = components.filter(c => c.recycledContentPercentage != null);
  const averageRecycledContent = withRecycled.length > 0
    ? Math.round(withRecycled.reduce((sum, c) => sum + (c.recycledContentPercentage ?? 0), 0) / components.length)
    : null;

  // Count components with circular end-of-life pathways (avoid "recyclable" terminology)
  const circularCount = components.filter(c =>
    c.endOfLifePathway === 'recycling' || c.endOfLifePathway === 'reuse' || c.endOfLifePathway === 'composting'
  ).length;
  const circularEndOfLifePercentage = components.length > 0
    ? Math.round((circularCount / components.length) * 100)
    : null;

  return {
    components,
    averageRecycledContent,
    circularityScore: product.packaging_circularity_score ?? null,
    circularEndOfLifePercentage,
  };
}

function generateConclusionContent(
  tier: SubscriptionTier,
  breakdown: LCADataBreakdownItem[]
): string {
  if (tier === 'seed') {
    return `This passport represents our commitment to environmental transparency. ` +
      `By sharing verified carbon footprint data, we aim to help consumers make informed choices.`;
  }

  const largestContributor = breakdown.length > 0
    ? breakdown.sort((a, b) => b.value - a.value)[0]?.name.toLowerCase()
    : 'production';

  if (tier === 'canopy') {
    return `This comprehensive LCA confirms that ${largestContributor} remains the largest contributor to our environmental footprint. ` +
      `Our sustainability roadmap prioritises innovation in this area, alongside expanded regenerative practices ` +
      `to increase carbon sequestration and reduce overall impact across all categories.`;
  }

  return `This assessment highlights ${largestContributor} as the primary contributor to our carbon footprint. ` +
    `We continue to work on reducing impacts across all lifecycle stages through sustainable innovation.`;
}

function formatSystemBoundary(boundary: string | null | undefined): string | null {
  if (!boundary) return null;
  return boundary
    .replace(/_/g, '-')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-to-')
    .replace(/-to-to-/g, '-to-');
}

export function transformToLCAData(
  input: TransformInput,
  tier: SubscriptionTier
): LCAData {
  const { product, lca, materials, organization } = input;

  const ghg = lca?.aggregated_impacts?.climate_change_gwp100 || 0;
  const reductionPct = ghg > 0 && ghg < INDUSTRY_BENCHMARK
    ? Math.round(((INDUSTRY_BENCHMARK - ghg) / INDUSTRY_BENCHMARK) * 100)
    : null;

  const functionalUnit = product.functional_unit
    || (product.unit_size_value && product.unit_size_unit
      ? `${product.unit_size_value} ${product.unit_size_unit}`
      : '1 unit');

  const breakdown = buildCarbonBreakdown(lca);
  const waterFootprint = buildWaterFootprint(lca);
  const wasteFootprint = buildWasteFootprint(lca);

  const methodologyPageUrl = tier !== 'seed'
    ? `/passport/methodology/${tier}`
    : null;

  return {
    meta: {
      title: 'Carbon Footprint Report',
      productName: product.name,
      version: `v${input.lcaCount || 1}.0`,
      date: lca?.updated_at
        ? formatDate(lca.updated_at)
        : formatDate(product.updated_at),
      author: organization?.name || 'Sustainability Team',
      heroImage: product.image_url || null,
      organizationName: organization?.name || '',
      organizationLogo: organization?.logo_url || null,
      functionalUnit,
      methodologyPageUrl,
      referenceYear: lca?.reference_year ?? null,
      systemBoundary: formatSystemBoundary(product.system_boundary),
      totalCarbon: ghg,
      carbonUnit: 'kg CO\u2082e',
    },
    productIdentity: buildProductIdentity(product, organization),
    executiveSummary: {
      heading: generateExecutiveSummaryHeading(product.name, reductionPct),
      content: generateExecutiveSummaryContent(product, lca, tier),
      keyHighlight: generateKeyHighlight(lca, reductionPct),
    },
    methodology: {
      functionalUnit: {
        title: `One ${functionalUnit}`,
        description: `Packed for distribution, including all upstream impacts from raw materials through to final packaging.`,
        value: functionalUnit,
      },
      systemBoundaries: {
        title: 'Cradle-to-Gate',
        stages: [
          {
            name: 'Raw Materials',
            icon: 'material',
            description: 'Agricultural inputs, ingredient sourcing, material extraction',
          },
          {
            name: 'Production',
            icon: 'production',
            description: 'Manufacturing, processing, assembly operations',
          },
          {
            name: 'Packaging',
            icon: 'material',
            description: 'Primary, secondary, and tertiary packaging production',
          },
          {
            name: 'Distribution',
            icon: 'distribution',
            description: 'Transport to distribution centres and retail',
          },
        ],
      },
      dataSources: [
        'Ecoinvent v3.12 Database',
        'Primary operational data',
        'Supplier-specific declarations',
      ],
      standards: ['ISO 14040', 'ISO 14044', 'ISO 14067', 'GHG Protocol'],
    },
    origins: buildOrigins(materials),
    packaging: buildPackaging(materials, product),
    results: {
      totalCarbon: ghg,
      unit: 'kg CO\u2082e',
      breakdown,
      comparison: tier === 'canopy' && reductionPct !== null
        ? {
            benchmarkName: 'Industry Average',
            benchmarkValue: INDUSTRY_BENCHMARK,
            reductionPercentage: reductionPct,
          }
        : null,
      waterFootprint,
      wasteFootprint,
      landUse: lca?.aggregated_impacts?.land_use || null,
    },
    conclusion: {
      title: 'Transparency drives progress.',
      content: generateConclusionContent(tier, [...breakdown]),
    },
  };
}
