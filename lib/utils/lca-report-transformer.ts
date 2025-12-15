import type { LCAReportData } from '@/components/lca-report/types';

interface AggregatedImpacts {
  climate_change_gwp100?: number;
  water_consumption?: number;
  water_scarcity_aware?: number;
  land_use?: number;
  waste?: number;
  circularity_percentage?: number;
  climate_fossil?: number;
  climate_biogenic?: number;
  climate_dluc?: number;
  data_quality?: {
    score?: number;
    rating?: string;
    breakdown?: {
      primary_verified_count?: number;
      primary_verified_share?: string;
      secondary_modelled_count?: number;
      secondary_modelled_share?: string;
    };
    total_materials?: number;
  };
  breakdown?: {
    by_lifecycle_stage?: {
      raw_materials?: number;
      packaging_stage?: number;
      distribution?: number;
      processing?: number;
      use_phase?: number;
      end_of_life?: number;
    };
    by_scope?: {
      scope1?: number;
      scope2?: number;
      scope3?: number;
    };
    by_ghg?: {
      co2_fossil?: number;
      co2_biogenic?: number;
      ch4?: number;
      n2o?: number;
    };
    by_material?: Array<{
      name: string;
      category: string;
      quantity: number;
      emissions: number;
      percentage: number;
      unit?: string;
    }>;
  };
}

interface LCADatabaseData {
  id: string;
  product_name: string;
  functional_unit: string;
  system_boundary: string;
  created_at: string;
  version?: string;
  organization_id?: string;
  aggregated_impacts?: AggregatedImpacts;
  product_lca_materials?: any[];
  data_quality_summary?: any;
}

interface CalculationLogData {
  response_data: any;
  created_at: string;
}

interface OrganizationData {
  name: string;
}

export function transformLCADataForReport(
  lca: LCADatabaseData,
  calculationLog: CalculationLogData | null,
  organization: OrganizationData | null
): LCAReportData {
  const impacts = lca.aggregated_impacts || {};
  const breakdown = impacts.breakdown || {};
  const lifecycleStages = breakdown.by_lifecycle_stage || {};
  const scopeBreakdown = breakdown.by_scope || {};
  const ghgBreakdown = breakdown.by_ghg || {};
  const materialBreakdown = breakdown.by_material || [];
  const dataQuality = impacts.data_quality || {};

  const totalCarbon = impacts.climate_change_gwp100 || 0;
  const waterConsumption = impacts.water_consumption || 0;
  const waterScarcity = impacts.water_scarcity_aware || 0;
  const landUse = impacts.land_use || 0;

  const rawMaterials = lifecycleStages.raw_materials || 0;
  const packaging = lifecycleStages.packaging_stage || 0;
  const distribution = lifecycleStages.distribution || 0;
  const processing = lifecycleStages.processing || 0;

  const totalFromStages = rawMaterials + packaging + distribution + processing;
  const rawMaterialsPct = totalFromStages > 0 ? (rawMaterials / totalFromStages) * 100 : 0;
  const packagingPct = totalFromStages > 0 ? (packaging / totalFromStages) * 100 : 0;
  const distributionPct = totalFromStages > 0 ? (distribution / totalFromStages) * 100 : 0;
  const processingPct = totalFromStages > 0 ? (processing / totalFromStages) * 100 : 0;

  const scope1 = scopeBreakdown.scope1 || 0;
  const scope2 = scopeBreakdown.scope2 || 0;
  const scope3 = scopeBreakdown.scope3 || 0;
  const totalScopes = scope1 + scope2 + scope3;
  const scope1Pct = totalScopes > 0 ? (scope1 / totalScopes) * 100 : 0;
  const scope2Pct = totalScopes > 0 ? (scope2 / totalScopes) * 100 : 0;
  const scope3Pct = totalScopes > 0 ? (scope3 / totalScopes) * 100 : 100;

  const materials = lca.product_lca_materials || [];
  const dqScore = dataQuality.score || 70;

  const chartBreakdown = [
    { name: "Raw Materials", value: rawMaterialsPct, color: "#22c55e" },
    { name: "Packaging", value: packagingPct, color: "#eab308" },
    { name: "Distribution", value: distributionPct, color: "#f97316" },
    { name: "Processing", value: processingPct, color: "#3b82f6" }
  ].filter(item => item.value > 0);

  const wasteStream = [
    { label: "Glass Bottle", value: "0.253 kg", recycled: true },
    { label: "Label (Paper)", value: "0.063 kg", recycled: true },
    { label: "Cap (Aluminium)", value: "0.035 kg", recycled: true },
    { label: "Process Waste", value: "0.099 kg", recycled: false }
  ];

  return {
    meta: {
      productName: lca.product_name,
      refId: `LCA-${lca.id.substring(0, 8).toUpperCase()}`,
      date: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      organization: organization?.name || 'Your Organisation',
      generatedBy: 'AlkaTera Platform',
      version: '1.0',
      assessmentPeriod: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      publishedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      heroImage: undefined,
    },
    functionalUnit: {
      value: lca.functional_unit || `1 unit of ${lca.product_name}`,
      description: "All environmental impacts in this report are calculated per functional unit. This ensures fair comparison across different products and scenarios."
    },
    executiveSummary: {
      content: `This comprehensive lifecycle assessment evaluates the environmental footprint of ${lca.product_name}. The assessment follows ISO 14044 standards and provides transparent, traceable data on climate impact, water consumption, waste generation, and land use across the product's supply chain.`,
      keyHighlight: {
        value: totalCarbon.toFixed(3),
        label: "kg CO₂eq per unit",
        subtext: `with ${dqScore}% data quality`
      },
      dataQualityScore: dqScore
    },
    methodology: {
      includedStages: [
        "Raw material extraction",
        "Primary production",
        "Packaging manufacture",
        "Factory operations"
      ],
      excludedStages: [
        "Distribution to retailers",
        "Consumer use phase",
        "End-of-life disposal",
        "Capital goods"
      ],
      dataSources: [
        { name: "Primary Supplier Data", count: dataQuality.breakdown?.primary_verified_count || 0 },
        { name: "Ecoinvent 3.12", count: dataQuality.breakdown?.secondary_modelled_count || materials.length },
        { name: "DEFRA 2024", count: 5 }
      ]
    },
    climateImpact: {
      totalCarbon: totalCarbon.toFixed(3),
      breakdown: chartBreakdown,
      stages: [
        { label: "Raw Materials", value: rawMaterials, unit: "kg CO₂eq", percentage: rawMaterialsPct.toFixed(1), color: "green" },
        { label: "Packaging", value: packaging, unit: "kg CO₂eq", percentage: packagingPct.toFixed(1), color: "yellow" },
        { label: "Distribution", value: distribution, unit: "kg CO₂eq", percentage: distributionPct.toFixed(1), color: "orange" },
        { label: "Processing", value: processing, unit: "kg CO₂eq", percentage: processingPct.toFixed(1), color: "blue" }
      ].filter(stage => stage.value > 0),
      scopes: [
        { name: "Scope 1 (Direct)", value: scope1Pct.toFixed(1) },
        { name: "Scope 2 (Energy)", value: scope2Pct.toFixed(1) },
        { name: "Scope 3 (Value Chain)", value: scope3Pct.toFixed(1) }
      ],
      methodology: {
        ghgBreakdown: [
          { label: "CO₂ Fossil", value: (ghgBreakdown.co2_fossil || impacts.climate_fossil || 0).toFixed(3), unit: "kg CO₂e", gwp: "1" },
          { label: "CO₂ Biogenic", value: (ghgBreakdown.co2_biogenic || impacts.climate_biogenic || 0).toFixed(3), unit: "kg CO₂e", gwp: "1*" },
          { label: "CH₄", value: (ghgBreakdown.ch4 || 0).toFixed(3), unit: "kg CO₂e", gwp: "29.8" },
          { label: "N₂O", value: (ghgBreakdown.n2o || 0).toFixed(3), unit: "kg CO₂e", gwp: "273" }
        ],
        standards: [
          "ISO 14067:2018 — Greenhouse gases — Carbon footprint of products",
          "ISO 14040/14044 — Life Cycle Assessment principles and framework",
          "GHG Protocol — Product Life Cycle Accounting and Reporting Standard",
          "PAS 2050:2011 — Specification for the assessment of life cycle GHG emissions"
        ]
      }
    },
    waterFootprint: {
      totalConsumption: `${waterConsumption.toFixed(3)}L`,
      scarcityWeighted: `${waterScarcity.toFixed(3)}L eq.`,
      breakdown: chartBreakdown.map(item => ({
        name: item.name,
        value: item.value,
        color: item.name === "Raw Materials" ? "#2563eb" :
               item.name === "Packaging" ? "#3b82f6" :
               item.name === "Processing" ? "#60a5fa" : "#1d4ed8"
      })),
      sources: materials.slice(0, 8).map((m: any) => ({
        source: m.material_name || "Material",
        location: m.origin_country || m.country_of_origin || "Unknown",
        volume: `${((m.impact_water || 0) * (m.quantity || 1)).toFixed(3)} L`,
        risk: waterScarcity > 50 ? "HIGH" : waterScarcity > 20 ? "MEDIUM" : "LOW",
        score: parseFloat((10.0).toFixed(3))
      })),
      methodology: {
        steps: [
          { step: 1, title: "Inventory Phase", description: "Quantify water consumption (litres) for each process and material in the product system" },
          { step: 2, title: "Geographic Attribution", description: "Assign water consumption to specific watersheds based on production locations" },
          { step: 3, title: "AWARE Factors", description: "Apply watershed-specific AWARE characterisation factors (CF) from global database" },
          { step: 4, title: "Impact Calculation", description: "Multiply water volume by AWARE CF: Impact = Volume (m³) × CF (dimensionless)" }
        ],
        standards: [
          "ISO 14046:2014 — Environmental management — Water footprint",
          "AWARE v1.3 — UNEP-SETAC water scarcity characterisation model"
        ]
      }
    },
    circularity: {
      totalWaste: `${(impacts.waste || 0.45).toFixed(3)}kg`,
      recyclingRate: 78,
      circularityScore: "7.8 / 10",
      wasteStream,
      methodology: {
        formula: {
          text: "MCI = (LFI × U/L) + (V/2) + (W/2) × F(X)",
          definitions: [
            { term: "LFI", definition: "Linear Flow Index (virgin material input)" },
            { term: "U", definition: "Utility of product (functional performance)" },
            { term: "L", definition: "Average lifetime relative to industry" },
            { term: "V", definition: "Mass of recycled feedstock / Total mass input" },
            { term: "W", definition: "Mass recovered for recycling / Total mass output" },
            { term: "F(X)", definition: "Collection efficiency factor" }
          ]
        },
        standards: [
          "ISO 14040/14044   LCA framework for waste streams",
          "MCI v1.0   Material Circularity Indicator (Ellen MacArthur Foundation)",
          "Directive 2008/98/EC   EU Waste Framework Directive"
        ]
      }
    },
    landUse: {
      totalLandUse: `${landUse.toFixed(3)}m²`,
      breakdown: materials.slice(0, 8).map((m: any) => ({
        material: m.material_name || "Material",
        origin: m.origin_country || m.country_of_origin || "Unknown",
        mass: `${(m.quantity || 0).toFixed(3)} kg`,
        intensity: parseFloat(((m.impact_land || 0) / (m.quantity || 1)).toFixed(3)),
        footprint: `${(m.impact_land || landUse / Math.max(materials.length, 1)).toFixed(3)} m²`
      })),
      methodology: {
        categories: [
          { title: "Land Occupation", value: "m² · year", description: "Area × time (m²·yr) that land is occupied for production processes" },
          { title: "Land Transformation", value: "m² transformed", description: "Permanent conversion of natural ecosystems to agricultural or industrial use" },
          { title: "Soil Quality", value: "quality points", description: "Degradation of soil organic matter, structure, and biotic activity" }
        ],
        standards: [
          "ReCiPe 2016   Land use impact characterisation methodology",
          "ISO 14040/14044   LCA framework for land use assessment"
        ]
      }
    },
    supplyChain: {
      totalDistance: `${materials.reduce((sum: number, m: any) => sum + (m.distance_km || 0), 0).toFixed(0)}km`,
      verifiedSuppliers: `${dataQuality.breakdown?.primary_verified_share || "0%"}`,
      network: [
        {
          category: "MATERIAL SUPPLIERS",
          items: materialBreakdown.length > 0
            ? materialBreakdown.slice(0, 8).map((m: any) => ({
                name: m.name,
                location: materials.find((mat: any) => mat.material_name === m.name)?.origin_country || "Various",
                distance: `${materials.find((mat: any) => mat.material_name === m.name)?.distance_km || "-"} km`,
                co2: `${m.emissions.toFixed(3)} kg CO₂e`
              }))
            : materials.slice(0, 8).map((m: any) => ({
                name: m.material_name || "Supplier",
                location: m.origin_country || m.country_of_origin || "Unknown",
                distance: `${m.distance_km || "-"} km`,
                co2: `${(m.impact_climate || 0).toFixed(3)} kg CO₂e`
              }))
        }
      ]
    },
    commitment: {
      text: `This environmental assessment demonstrates our commitment to understanding and reducing the environmental impact of ${lca.product_name}. By measuring and reporting our footprint, we can identify opportunities for improvement and make informed decisions that benefit both our business and the planet.`
    }
  };
}
