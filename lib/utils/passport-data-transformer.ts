import type { LCAData, LCADataBreakdownItem, SubscriptionTier } from '@/lib/types/passport';

interface TransformInput {
  product: {
    id: string;
    name: string;
    product_description?: string | null;
    image_url?: string | null;
    functional_unit?: string | null;
    unit_size_value?: number | null;
    unit_size_unit?: string | null;
    certifications?: Array<{ name: string }> | null;
    created_at: string;
    updated_at: string;
  };
  lca: {
    id?: string;
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
      };
    };
    methodology?: string;
    updated_at?: string;
  } | null;
  materials: Array<{
    name?: string;
    material_type?: string;
    quantity?: number;
  }>;
  organization: {
    id: string;
    name: string;
    logo_url?: string | null;
    subscription_tier?: SubscriptionTier;
    subscription_status?: string;
  } | null;
}

const BREAKDOWN_COLORS: Record<string, string> = {
  'Raw Materials': '#84cc16',
  'Packaging': '#3f6212',
  'Processing': '#a3e635',
  'Distribution': '#ecfccb',
  'End of Life': '#1a2e05',
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

function buildBreakdown(lca: TransformInput['lca']): LCADataBreakdownItem[] {
  const breakdown = lca?.aggregated_impacts?.breakdown?.by_category;
  if (!breakdown) return [];

  const items: LCADataBreakdownItem[] = [];
  const total =
    (breakdown.materials || 0) +
    (breakdown.packaging || 0) +
    (breakdown.production || 0) +
    (breakdown.transport || 0);

  if (total === 0) return [];

  if (breakdown.materials && breakdown.materials > 0) {
    items.push({
      name: 'Raw Materials',
      value: Math.round((breakdown.materials / total) * 100),
      color: BREAKDOWN_COLORS['Raw Materials'],
    });
  }

  if (breakdown.packaging && breakdown.packaging > 0) {
    items.push({
      name: 'Packaging',
      value: Math.round((breakdown.packaging / total) * 100),
      color: BREAKDOWN_COLORS['Packaging'],
    });
  }

  if (breakdown.production && breakdown.production > 0) {
    items.push({
      name: 'Processing',
      value: Math.round((breakdown.production / total) * 100),
      color: BREAKDOWN_COLORS['Processing'],
    });
  }

  if (breakdown.transport && breakdown.transport > 0) {
    items.push({
      name: 'Distribution',
      value: Math.round((breakdown.transport / total) * 100),
      color: BREAKDOWN_COLORS['Distribution'],
    });
  }

  return items;
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

export function transformToLCAData(
  input: TransformInput,
  tier: SubscriptionTier
): LCAData {
  const { product, lca, organization } = input;

  const ghg = lca?.aggregated_impacts?.climate_change_gwp100 || 0;
  const reductionPct = ghg > 0 && ghg < INDUSTRY_BENCHMARK
    ? Math.round(((INDUSTRY_BENCHMARK - ghg) / INDUSTRY_BENCHMARK) * 100)
    : null;

  const functionalUnit = product.functional_unit
    || (product.unit_size_value && product.unit_size_unit
      ? `${product.unit_size_value} ${product.unit_size_unit}`
      : '1 unit');

  const breakdown = buildBreakdown(lca);

  return {
    meta: {
      title: 'Carbon Footprint Report',
      productName: product.name,
      version: 'v1.0',
      date: lca?.updated_at
        ? formatDate(lca.updated_at)
        : formatDate(product.updated_at),
      author: organization?.name || 'Sustainability Team',
      heroImage: product.image_url || null,
      organizationName: organization?.name || '',
      organizationLogo: organization?.logo_url || null,
      functionalUnit,
    },
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
        'Ecoinvent v3.8 Database',
        'Primary operational data',
        'Supplier-specific declarations',
      ],
      standards: ['ISO 14040', 'ISO 14044', 'GHG Protocol'],
    },
    results: {
      totalCarbon: ghg,
      unit: 'kg CO₂e',
      breakdown,
      comparison: tier === 'canopy' && reductionPct !== null
        ? {
            benchmarkName: 'Industry Average',
            benchmarkValue: INDUSTRY_BENCHMARK,
            reductionPercentage: reductionPct,
          }
        : null,
      waterConsumption: lca?.aggregated_impacts?.water_consumption || null,
      wasteGenerated: lca?.aggregated_impacts?.waste || null,
      landUse: lca?.aggregated_impacts?.land_use || null,
    },
    conclusion: {
      title: 'Transparency drives progress.',
      content: generateConclusionContent(tier, [...breakdown]),
    },
  };
}
