/**
 * Standalone renderer for a realistic sample LCA report.
 *
 * Builds an Avallen (calvados / apple brandy) sample product, feeds it through
 * the studio-redesigned `renderLcaReportHtml`, and writes the resulting HTML to
 * `public/sample-lca.html` so the dev server serves it at /sample-lca.html.
 *
 * Presentation/data only — does not modify the renderer or any studio component.
 *
 * Run with:  npx tsx scripts/render-sample-lca.mts
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderLcaReportHtml } from '../lib/pdf/render-lca-html.ts';
import type { LCAReportData } from '../components/lca-report/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// SAMPLE PRODUCT: Avallen Calvados — 70cl bottle, cradle-to-grave, 2025
// ============================================================================

const data: LCAReportData = {
  meta: {
    productName: 'Avallen Calvados',
    refId: 'ALK-LCA-2025-AVL-0001',
    date: '2025-11-14',
    organization: 'Avallen Spirits Ltd',
    generatedBy: 'alkatera LCA Engine',
    version: '1.2',
    assessmentPeriod: 'Calendar year 2025',
    publishedDate: '14 November 2025',
    productDescription:
      'A single-estate calvados distilled from whole pressed apples grown in the orchards of Normandy, France. Bottled at 40% ABV in a 70cl flint glass bottle with a natural cork closure.',
    referenceYear: 2025,
    lcaScopeType: 'Cradle-to-Grave',
  },
  functionalUnit: {
    value: '1 x 700ml bottle',
    description:
      'One 700ml bottle of Avallen Calvados at 40% ABV, packaged, distributed to a UK retailer, and disposed of at end of life.',
  },
  goalAndScope: {
    intendedApplication:
      'To quantify the cradle-to-grave carbon and environmental footprint of a single bottle of Avallen Calvados, informing product-level reduction targets and supporting credible on-pack and marketing sustainability communication.',
    reasonsForStudy:
      'Avallen Spirits is pursuing science-based reduction targets across its portfolio and needs a robust, ISO-compliant product footprint to identify hotspots, prioritise interventions, and substantiate environmental claims to trade and consumer audiences.',
    intendedAudience: [
      'Internal sustainability team',
      'Trade buyers & distributors',
      'B Corp assessment',
      'Consumers (via summary claims)',
    ],
    isComparativeAssertion: false,
    systemBoundary: 'Cradle-to-Grave',
    systemBoundaryDescription:
      'The study covers apple cultivation and harvest, transport to the distillery, pressing, fermentation, double distillation, cask maturation, blending and bottling, primary and secondary packaging production, distribution to a UK regional distribution centre, and end-of-life treatment of all packaging. The use phase (consumer chilling/serving) is excluded as negligible and highly variable.',
    cutOffCriteria:
      'Mass and energy flows contributing less than 1% of the total mass or cumulative energy of the system are excluded, provided the aggregate of all excluded flows remains below 5% of total mass, energy and climate impact, in line with ISO 14044 §4.2.3.3.',
    allocationProcedure:
      'Co-products of distillation (pomace and lees) are handled by economic allocation. Where an ingredient or process serves multiple products, physical allocation by mass is applied. Recycling is modelled using the avoided-burden (substitution) method.',
    assumptionsAndLimitations: [
      { type: 'Assumption', text: 'Apple yield and orchard inputs are averaged over the 2023 to 2025 harvests to smooth vintage variation.' },
      { type: 'Assumption', text: 'Grid electricity at the distillery uses the 2025 French residual-mix emission factor; on-site solar is deducted where metered.' },
      { type: 'Assumption', text: 'Outbound distribution assumes a single 320km road leg from the French distillery to a UK regional distribution centre, including the cross-Channel ferry.' },
      { type: 'Limitation', text: 'Cask maturation losses (the angels share) are modelled as an evaporative volume loss and do not carry a direct emission burden beyond the amortised cask.' },
      { type: 'Limitation', text: 'Consumer use-phase impacts (refrigeration, mixers, glassware washing) are outside the system boundary owing to high variability.' },
      { type: 'Assumption', text: 'End-of-life packaging follows UK 2025 municipal recovery rates for the relevant material streams.' },
    ],
    referenceStandards: [
      'ISO 14040:2006 — Principles and framework',
      'ISO 14044:2006 — Requirements and guidelines',
      'ISO 14067:2018 — Carbon footprint of products',
      'GHG Protocol Product Life Cycle Accounting and Reporting Standard',
      'PAS 2050:2011',
    ],
  },
  executiveSummary: {
    content:
      'The cradle-to-grave carbon footprint of one 700ml bottle of Avallen Calvados is 0.94 kg CO2e. The single largest contributor is the flint glass bottle, which accounts for just under half of the total footprint through the energy intensity of container glass manufacture. Apple cultivation and distillation together form the second cluster of impact, while distribution and end-of-life are comparatively minor. The most effective near-term reduction lever is lightweighting the glass bottle and increasing its recycled cullet content; a secondary lever is switching remaining distillery heat to a renewable source. Data quality is strong overall, anchored by primary orchard and distillery data.',
    keyHighlight: {
      value: '0.94',
      label: 'kg CO2e per bottle',
      subtext: 'Cradle-to-grave, per 1 x 700ml bottle at 40% ABV',
    },
    dataQualityScore: 84,
  },
  methodology: {
    includedStages: [
      'Apple cultivation & harvest',
      'Inbound transport to distillery',
      'Pressing & fermentation',
      'Double distillation',
      'Cask maturation',
      'Blending & bottling',
      'Packaging production',
      'Outbound distribution',
      'End-of-life treatment',
    ],
    excludedStages: [
      'Consumer use phase (serving, chilling)',
      'Retail refrigeration & display',
      'Capital goods (buildings, machinery manufacture)',
    ],
    dataSources: [
      { name: 'ecoinvent', version: '3.10', description: 'Background processes: glass, electricity, transport', count: 41 },
      { name: 'AGRIBALYSE', version: '3.1.1', description: 'Apple cultivation & agricultural inputs', count: 12 },
      { name: 'DEFRA GHG Conversion Factors', version: '2025', description: 'Fuel combustion & UK freight', count: 18 },
      { name: 'Supplier primary data', description: 'Orchard, distillery & glass supplier records', count: 9 },
    ],
    lciaMethod: 'IPCC 2021 GWP-100 (AR6) + EF 3.1',
    lciaMethodDescription:
      'Climate impact is characterised using IPCC AR6 GWP-100 factors. Other impact categories follow the European Commission Environmental Footprint (EF) 3.1 reference package, using the recommended characterisation model for each category. Results are expressed per functional unit and are not normalised or weighted in the headline figures.',
    characterizationModels: [
      { category: 'Climate change', model: 'IPCC 2021 GWP-100 (AR6)', reference: 'IPCC Sixth Assessment Report, 2021' },
      { category: 'Acidification', model: 'Accumulated Exceedance', reference: 'Seppälä et al. 2006; Posch et al. 2008' },
      { category: 'Freshwater eutrophication', model: 'EUTREND (ReCiPe)', reference: 'Struijs et al. 2009' },
      { category: 'Water scarcity', model: 'AWARE', reference: 'Boulay et al. 2018 (UNEP-SETAC)' },
      { category: 'Fossil resource use', model: 'CML — abiotic depletion (fossil)', reference: 'van Oers et al. 2002' },
      { category: 'Land use', model: 'Soil quality index (LANCA)', reference: 'De Laurentiis et al. 2019' },
    ],
    softwareAndDatabases: [
      { name: 'alkatera', version: '2025.11', purpose: 'LCA modelling & report generation engine' },
      { name: 'ecoinvent', version: '3.10', purpose: 'Background life-cycle inventory database' },
      { name: 'AGRIBALYSE', version: '3.1.1', purpose: 'Agricultural foreground datasets' },
    ],
  },
  dataQuality: {
    overallScore: 84,
    overallRating: 'Good',
    pedigreeMatrix: {
      reliability: 2,
      completeness: 2,
      temporalRepresentativeness: 2,
      geographicRepresentativeness: 2,
      technologicalRepresentativeness: 3,
    },
    coverageSummary: {
      primaryDataShare: 58,
      secondaryDataShare: 34,
      proxyDataShare: 8,
      primaryCount: 7,
      secondaryCount: 4,
      proxyCount: 1,
      totalMaterials: 12,
    },
    materialQuality: [
      { name: 'Apples (Normandy)', source: 'Primary (grower records)', grade: 'A', confidence: 92, temporalCoverage: '2023–2025', geographicCoverage: 'FR — Normandy' },
      { name: 'Flint glass bottle', source: 'Primary (supplier EPD)', grade: 'A', confidence: 90, temporalCoverage: '2024', geographicCoverage: 'FR / EU' },
      { name: 'Natural cork closure', source: 'Secondary (ecoinvent)', grade: 'B', confidence: 78, temporalCoverage: '2022', geographicCoverage: 'PT / EU' },
      { name: 'Paper label', source: 'Secondary (ecoinvent)', grade: 'B', confidence: 74, temporalCoverage: '2022', geographicCoverage: 'EU' },
      { name: 'Distillery natural gas', source: 'Primary (metered)', grade: 'A', confidence: 88, temporalCoverage: '2025', geographicCoverage: 'FR' },
      { name: 'Distillery electricity', source: 'Primary (metered)', grade: 'A', confidence: 86, temporalCoverage: '2025', geographicCoverage: 'FR' },
      { name: 'Oak cask (amortised)', source: 'Secondary (ecoinvent)', grade: 'B', confidence: 70, temporalCoverage: '2021', geographicCoverage: 'FR / EU' },
      { name: 'Aluminium/tin capsule', source: 'Proxy (ecoinvent generic)', grade: 'C', confidence: 55, temporalCoverage: '2020', geographicCoverage: 'EU (proxy)' },
      { name: 'Corrugated shipper', source: 'Secondary (ecoinvent)', grade: 'B', confidence: 80, temporalCoverage: '2023', geographicCoverage: 'EU' },
      { name: 'Inbound apple transport', source: 'Primary (logistics)', grade: 'A', confidence: 85, temporalCoverage: '2025', geographicCoverage: 'FR' },
      { name: 'Outbound distribution', source: 'Primary (logistics)', grade: 'A', confidence: 82, temporalCoverage: '2025', geographicCoverage: 'FR → UK' },
      { name: 'End-of-life (packaging)', source: 'Secondary (DEFRA)', grade: 'B', confidence: 76, temporalCoverage: '2025', geographicCoverage: 'UK' },
    ],
    missingDataTreatment:
      'Where a directly matching dataset was unavailable (the metal capsule), the closest technological proxy from ecoinvent was substituted and flagged. No lifecycle stage within the system boundary was omitted; all foreground flows are populated with either primary or secondary data.',
    uncertaintyNote:
      'Uncertainty is dominated by the glass container emission factor and the orchard nitrous-oxide term. A pedigree-matrix-based lognormal uncertainty was assigned to each flow and propagated by Monte Carlo simulation (10,000 runs), giving a 95% confidence interval of ±11% on the headline result.',
  },
  climateImpact: {
    totalCarbon: '0.940',
    breakdown: [
      { name: 'Glass bottle', value: 0.44, color: '#205E40' },
      { name: 'Apples & cultivation', value: 0.16, color: '#8FBF9F' },
      { name: 'Distillation & maturation', value: 0.15, color: '#B45309' },
      { name: 'Other packaging', value: 0.09, color: '#D9B382' },
      { name: 'Distribution', value: 0.07, color: '#2B46C0' },
      { name: 'End-of-life', value: 0.03, color: '#6F6F68' },
    ],
    stages: [
      { label: 'Raw materials', value: 0.1600, unit: 'kg CO2e', percentage: '16.5', color: '#8FBF9F' },
      { label: 'Packaging', value: 0.5300, unit: 'kg CO2e', percentage: '54.6', color: '#205E40' },
      { label: 'Processing', value: 0.1500, unit: 'kg CO2e', percentage: '15.5', color: '#B45309' },
      { label: 'Distribution', value: 0.0700, unit: 'kg CO2e', percentage: '7.2', color: '#2B46C0' },
      { label: 'End-of-life', value: 0.0300, unit: 'kg CO2e', percentage: '3.1', color: '#6F6F68' },
      { label: 'Use phase', value: 0.0300, unit: 'kg CO2e', percentage: '3.1', color: '#D9D6CB' },
    ],
    scopes: [
      { name: 'Scope 1 (direct)', value: '9' },
      { name: 'Scope 2 (energy)', value: '7' },
      { name: 'Scope 3 (value chain)', value: '84' },
    ],
    methodology: {
      ghgBreakdown: [
        { label: 'Carbon dioxide', value: '0.870', unit: 'kg', gwp: '1' },
        { label: 'Methane', value: '0.0011', unit: 'kg', gwp: '29.8' },
        { label: 'Nitrous oxide', value: '0.00016', unit: 'kg', gwp: '273' },
      ],
      standards: ['ISO 14067:2018', 'IPCC AR6 GWP-100'],
    },
  },
  ghgDetailed: {
    totalGwp100: '0.9720',
    fossilOnlyTotal: '0.9400',
    fossilCo2: '0.8700',
    biogenicCo2: '0.0320',
    dlucCo2: '0.0000',
    ch4Fossil: '0.00090',
    ch4FossilKgCo2e: '0.0268',
    ch4Biogenic: '0.00040',
    ch4BiogenicKgCo2e: '0.0108',
    n2o: '0.00016',
    n2oKgCo2e: '0.0437',
    hfcPfc: '0.0000',
    gwpMethod: 'IPCC AR6 GWP-100',
    gwpFactors: [
      { gas: 'CO2', gwp100: '1', source: 'IPCC AR6 (2021)' },
      { gas: 'CH4 (fossil)', gwp100: '29.8', source: 'IPCC AR6 (2021)' },
      { gas: 'CH4 (biogenic)', gwp100: '27.0', source: 'IPCC AR6 (2021)' },
      { gas: 'N2O', gwp100: '273', source: 'IPCC AR6 (2021)' },
    ],
    biogenicNote:
      'Biogenic CO2 uptake in the apple orchard and its subsequent release at fermentation and end-of-life are inventoried separately and characterised at GWP=1. Per ISO 14067:2018 §6.4.9.3, the net biogenic balance is reported apart from the headline fossil carbon footprint and does not alter the 0.94 kg CO2e fossil figure.',
  },
  environmentalImpacts: {
    referenceMethod: 'EF 3.1 (Environmental Footprint)',
    normalisationNote:
      'Values are characterised results per functional unit. No normalisation or weighting is applied, so categories should not be summed or directly compared against one another.',
    categories: [
      {
        name: 'Acidification',
        indicator: 'Accumulated Exceedance',
        unit: 'mol H+ eq',
        totalValue: '0.0071',
        description: 'Driven mainly by nitrogen and sulphur emissions from orchard fertiliser and distillery fuel combustion.',
        topContributors: [
          { name: 'Glass bottle', value: '0.0031', percentage: '44%' },
          { name: 'Apple cultivation', value: '0.0020', percentage: '28%' },
          { name: 'Distillation', value: '0.0013', percentage: '18%' },
        ],
      },
      {
        name: 'Freshwater eutrophication',
        indicator: 'Fraction of P to freshwater',
        unit: 'kg P eq',
        totalValue: '0.00028',
        description: 'Phosphorus losses associated with orchard nutrient management dominate this category.',
        topContributors: [
          { name: 'Apple cultivation', value: '0.00019', percentage: '68%' },
          { name: 'Glass bottle', value: '0.00005', percentage: '18%' },
        ],
      },
      {
        name: 'Photochemical ozone formation',
        indicator: 'Tropospheric ozone (human health)',
        unit: 'kg NMVOC eq',
        totalValue: '0.0043',
        description: 'NOx from combustion and freight transport is the principal driver of ground-level ozone formation.',
        topContributors: [
          { name: 'Distribution', value: '0.0016', percentage: '37%' },
          { name: 'Glass bottle', value: '0.0015', percentage: '35%' },
          { name: 'Distillation', value: '0.0009', percentage: '21%' },
        ],
      },
      {
        name: 'Fossil resource use',
        indicator: 'Abiotic depletion (fossil)',
        unit: 'MJ',
        totalValue: '13.6',
        description: 'Reflects the natural gas and grid electricity used in glass manufacture and distillation.',
        topContributors: [
          { name: 'Glass bottle', value: '6.9', percentage: '51%' },
          { name: 'Distillation', value: '3.1', percentage: '23%' },
          { name: 'Distribution', value: '1.9', percentage: '14%' },
        ],
      },
      {
        name: 'Particulate matter',
        indicator: 'Disease incidence',
        unit: 'disease inc.',
        totalValue: '6.2e-8',
        description: 'Combustion particulates from freight and distillery heat are the main sources.',
        topContributors: [
          { name: 'Distribution', value: '2.4e-8', percentage: '39%' },
          { name: 'Glass bottle', value: '2.1e-8', percentage: '34%' },
        ],
      },
      {
        name: 'Ozone depletion',
        indicator: 'ODP',
        unit: 'kg CFC-11 eq',
        totalValue: '4.1e-8',
        description: 'Trace refrigerant and combustion emissions; negligible in absolute terms.',
        topContributors: [
          { name: 'Distillation', value: '1.9e-8', percentage: '46%' },
          { name: 'Distribution', value: '1.2e-8', percentage: '29%' },
        ],
      },
    ],
  },
  ingredientBreakdown: {
    totalClimateImpact: '0.940',
    hasProxies: true,
    totalInboundTransportCO2e: '0.021',
    hasTransportWarnings: false,
    ingredients: [
      {
        name: 'Flint glass bottle (530g)',
        calculationFactor: 'Glass, container, flint, at plant',
        isProxy: false,
        factorDatabase: 'ecoinvent 3.10 (supplier EPD adjusted)',
        category: 'Primary packaging',
        quantity: '0.530',
        unit: 'kg',
        origin: 'France',
        climateImpact: '0.4400',
        climatePercentage: '46.8%',
        waterImpact: '3.1 L',
        landUseImpact: '0.02 m2a',
        acidification: '0.0031',
        eutrophication: '0.00005',
        dataSource: 'Primary',
        dataQualityGrade: 'High',
        confidenceScore: 90,
        transportCO2: '0.006',
        transportMode: 'Road',
        transportDistance: '210',
      },
      {
        name: 'Apples, Normandy cider varieties',
        calculationFactor: 'Apple, at orchard {FR}',
        isProxy: false,
        factorDatabase: 'AGRIBALYSE 3.1.1',
        category: 'Raw material',
        quantity: '4.20',
        unit: 'kg',
        origin: 'Normandy, France',
        climateImpact: '0.1600',
        climatePercentage: '17.0%',
        waterImpact: '6.4 L',
        landUseImpact: '0.61 m2a',
        acidification: '0.0020',
        eutrophication: '0.00019',
        dataSource: 'Primary',
        dataQualityGrade: 'High',
        confidenceScore: 92,
        transportCO2: '0.004',
        transportMode: 'Road',
        transportDistance: '35',
      },
      {
        name: 'Natural gas (distillation heat)',
        calculationFactor: 'Heat, natural gas, industrial furnace',
        isProxy: false,
        factorDatabase: 'ecoinvent 3.10',
        category: 'Processing energy',
        quantity: '0.62',
        unit: 'kWh',
        origin: 'France',
        climateImpact: '0.1100',
        climatePercentage: '11.7%',
        waterImpact: '0.4 L',
        landUseImpact: '0.00 m2a',
        acidification: '0.0009',
        eutrophication: '0.00002',
        dataSource: 'Primary',
        dataQualityGrade: 'High',
        confidenceScore: 88,
      },
      {
        name: 'Oak cask (amortised per bottle)',
        calculationFactor: 'Oak wood, cask, amortised',
        isProxy: false,
        factorDatabase: 'ecoinvent 3.10',
        category: 'Processing',
        quantity: '0.045',
        unit: 'kg',
        origin: 'France',
        climateImpact: '0.0400',
        climatePercentage: '4.3%',
        waterImpact: '0.3 L',
        landUseImpact: '0.03 m2a',
        acidification: '0.0003',
        eutrophication: '0.00001',
        dataSource: 'Secondary',
        dataQualityGrade: 'Medium',
        confidenceScore: 70,
      },
      {
        name: 'Corrugated shipper (per bottle)',
        calculationFactor: 'Corrugated board box',
        isProxy: false,
        factorDatabase: 'ecoinvent 3.10',
        category: 'Secondary packaging',
        quantity: '0.070',
        unit: 'kg',
        origin: 'EU',
        climateImpact: '0.0500',
        climatePercentage: '5.3%',
        waterImpact: '0.9 L',
        landUseImpact: '0.05 m2a',
        acidification: '0.0004',
        eutrophication: '0.00003',
        dataSource: 'Secondary',
        dataQualityGrade: 'Medium',
        confidenceScore: 80,
      },
      {
        name: 'Natural cork closure',
        calculationFactor: 'Cork stopper, at plant',
        isProxy: false,
        factorDatabase: 'ecoinvent 3.10',
        category: 'Primary packaging',
        quantity: '0.005',
        unit: 'kg',
        origin: 'Portugal',
        climateImpact: '0.0060',
        climatePercentage: '0.6%',
        waterImpact: '0.1 L',
        landUseImpact: '0.02 m2a',
        acidification: '0.00004',
        eutrophication: '0.000004',
        dataSource: 'Secondary',
        dataQualityGrade: 'Medium',
        confidenceScore: 78,
        transportCO2: '0.003',
        transportMode: 'Road',
        transportDistance: '1450',
      },
      {
        name: 'Paper label',
        calculationFactor: 'Label paper, coated',
        isProxy: false,
        factorDatabase: 'ecoinvent 3.10',
        category: 'Primary packaging',
        quantity: '0.003',
        unit: 'kg',
        origin: 'EU',
        climateImpact: '0.0040',
        climatePercentage: '0.4%',
        waterImpact: '0.1 L',
        landUseImpact: '0.01 m2a',
        acidification: '0.00003',
        eutrophication: '0.000003',
        dataSource: 'Secondary',
        dataQualityGrade: 'Medium',
        confidenceScore: 74,
      },
      {
        name: 'Metal capsule (tin/aluminium)',
        calculationFactor: 'Aluminium foil, generic (proxy)',
        isProxy: true,
        factorDatabase: 'ecoinvent 3.10 (proxy)',
        category: 'Primary packaging',
        quantity: '0.002',
        unit: 'kg',
        origin: 'EU',
        climateImpact: '0.0090',
        climatePercentage: '1.0%',
        waterImpact: '0.2 L',
        landUseImpact: '0.00 m2a',
        acidification: '0.00006',
        eutrophication: '0.000004',
        dataSource: 'Proxy',
        dataQualityGrade: 'Low',
        confidenceScore: 55,
      },
    ],
  },
  waterFootprint: {
    totalConsumption: '12.4',
    scarcityWeighted: '86',
    breakdown: [
      { name: 'Apple cultivation', value: 6.4, color: '#8FBF9F' },
      { name: 'Glass manufacture', value: 3.1, color: '#205E40' },
      { name: 'Distillation', value: 1.8, color: '#B45309' },
      { name: 'Other packaging', value: 1.1, color: '#2B46C0' },
    ],
    sources: [
      { source: 'Rain-fed orchard (green water)', location: 'Normandy, France', volume: '5.9 L', risk: 'Low', score: 22 },
      { source: 'Irrigation (blue water)', location: 'Normandy, France', volume: '0.5 L', risk: 'Low', score: 18 },
      { source: 'Process water — distillery', location: 'Normandy, France', volume: '1.8 L', risk: 'Low', score: 20 },
      { source: 'Glass supplier process water', location: 'France / EU', volume: '3.1 L', risk: 'Medium', score: 48 },
    ],
    methodology: {
      steps: [
        { step: 1, title: 'Inventory', description: 'Compile direct and embedded water flows across the system boundary.' },
        { step: 2, title: 'Characterise', description: 'Apply AWARE scarcity factors by watershed to derive scarcity-weighted litres.' },
        { step: 3, title: 'Interpret', description: 'Identify water hotspots and screen for local scarcity risk.' },
      ],
      standards: ['ISO 14046:2014', 'AWARE (Boulay et al. 2018)'],
    },
  },
  circularity: {
    totalWaste: '0.610 kg',
    recyclingRate: 71,
    recycledContentRate: 42,
    eolRecyclingRate: 71,
    circularityScore: 'B+',
    wasteStream: [
      { label: 'Glass bottle', value: '0.530 kg', recycled: true },
      { label: 'Corrugated shipper', value: '0.070 kg', recycled: true },
      { label: 'Cork closure', value: '0.005 kg', recycled: false },
      { label: 'Paper label', value: '0.003 kg', recycled: true },
      { label: 'Metal capsule', value: '0.002 kg', recycled: true },
    ],
    eolBreakdown: [
      {
        material: 'Flint glass', massKg: 0.530, factorKey: 'glass_container', region: 'UK',
        recyclingPct: 76, landfillPct: 22, incinerationPct: 2, compostingPct: 0, adPct: 0,
        grossEmissions: 0.0180, avoidedEmissions: -0.0120, netEmissions: 0.0060,
      },
      {
        material: 'Corrugated board', massKg: 0.070, factorKey: 'paper_corrugated', region: 'UK',
        recyclingPct: 82, landfillPct: 12, incinerationPct: 6, compostingPct: 0, adPct: 0,
        grossEmissions: 0.0050, avoidedEmissions: -0.0032, netEmissions: 0.0018,
      },
      {
        material: 'Paper label', massKg: 0.003, factorKey: 'paper_mixed', region: 'UK',
        recyclingPct: 68, landfillPct: 20, incinerationPct: 12, compostingPct: 0, adPct: 0,
        grossEmissions: 0.0003, avoidedEmissions: -0.0001, netEmissions: 0.0002,
      },
      {
        material: 'Cork', massKg: 0.005, factorKey: 'cork', region: 'UK',
        recyclingPct: 0, landfillPct: 60, incinerationPct: 20, compostingPct: 20, adPct: 0,
        grossEmissions: 0.0004, avoidedEmissions: 0.0000, netEmissions: 0.0004,
      },
      {
        material: 'Metal capsule', massKg: 0.002, factorKey: 'aluminium', region: 'UK',
        recyclingPct: 60, landfillPct: 34, incinerationPct: 6, compostingPct: 0, adPct: 0,
        grossEmissions: 0.0002, avoidedEmissions: -0.0004, netEmissions: -0.0002,
      },
    ],
    methodology: {
      formula: {
        text: 'Circularity = (recycled content input + recyclable output) / 2, weighted by mass across all packaging materials.',
        definitions: [
          { term: 'Recycled content', definition: 'Share of packaging mass sourced from post-consumer or post-industrial recycled material.' },
          { term: 'EoL recycling rate', definition: 'Share of packaging mass expected to be recycled at end of life, using regional recovery rates.' },
          { term: 'Avoided burden', definition: 'Emission credit for recovered material displacing virgin production.' },
        ],
      },
      standards: ['ISO 14044 §4.4.5', 'BS 8905:2011'],
    },
  },
  landUse: {
    totalLandUse: '0.68',
    breakdown: [
      { material: 'Apples (orchard)', origin: 'Normandy, France', mass: '4.20 kg', intensity: 0.61, footprint: '0.61 m2a' },
      { material: 'Oak cask (amortised)', origin: 'France', mass: '0.045 kg', intensity: 0.67, footprint: '0.03 m2a' },
      { material: 'Cork closure', origin: 'Portugal', mass: '0.005 kg', intensity: 4.00, footprint: '0.02 m2a' },
      { material: 'Corrugated & paper', origin: 'EU', mass: '0.073 kg', intensity: 0.82, footprint: '0.06 m2a' },
    ],
    methodology: {
      categories: [
        { title: 'Arable & orchard', value: '0.61 m2a', description: 'Land occupied by cider-apple orchards, amortised per bottle.' },
        { title: 'Forest', value: '0.05 m2a', description: 'Cork oak and oak cask forestry.' },
        { title: 'Other', value: '0.02 m2a', description: 'Land use embedded in packaging materials.' },
      ],
      standards: ['LANCA (De Laurentiis et al. 2019)', 'EF 3.1'],
    },
  },
  supplyChain: {
    totalDistance: '1,995 km',
    verifiedSuppliers: '7 of 9',
    network: [
      {
        category: 'Raw materials',
        items: [
          { name: 'Normandy apple growers', location: 'Normandy, France', distance: '35 km', co2: '0.004 kg CO2e', mode: 'Road' },
          { name: 'Cork supplier', location: 'Alentejo, Portugal', distance: '1,450 km', co2: '0.003 kg CO2e', mode: 'Road' },
        ],
      },
      {
        category: 'Packaging',
        items: [
          { name: 'Glass manufacturer', location: 'Cognac region, France', distance: '210 km', co2: '0.006 kg CO2e', mode: 'Road' },
          { name: 'Carton & label converter', location: 'Northern France', distance: '90 km', co2: '0.002 kg CO2e', mode: 'Road' },
        ],
      },
      {
        category: 'Distribution',
        items: [
          { name: 'UK regional distribution centre', location: 'South East England', distance: '320 km', co2: '0.052 kg CO2e', mode: 'Multi-modal' },
        ],
      },
    ],
  },
  commitment: {
    text:
      'Avallen exists to put nature back into the glass. We are working to lightweight our bottle, move to a fully renewable distillery, and hold our orchards to regenerative standards that give back more than they take. This assessment is our baseline; every future bottle is measured against it.',
  },

  interpretation: {
    significant_issues: {
      hotspots: [
        { name: 'Flint glass bottle', impact_kg_co2e: 0.4400, contribution_pct: 46.8, category: 'Packaging' },
        { name: 'Apples, Normandy', impact_kg_co2e: 0.1600, contribution_pct: 17.0, category: 'Raw material' },
        { name: 'Natural gas (distillation)', impact_kg_co2e: 0.1100, contribution_pct: 11.7, category: 'Processing' },
      ],
      dominant_lifecycle_stage: 'Packaging',
      dominant_stage_pct: 55,
      dominant_scope: 'Scope 3',
      dominant_scope_pct: 84,
      summary:
        'The bottle glass is the single dominant hotspot, followed by apple cultivation and distillation heat. Together these three flows account for roughly three-quarters of the cradle-to-grave footprint, so reduction effort concentrated on glass and distillery energy will deliver the great majority of the achievable saving.',
    },
    evaluation: {
      completeness: { is_complete: true, coverage_pct: 97, missing_stages: [], notes: ['All in-boundary stages populated with primary or secondary data.'] },
      sensitivity: { has_analysis: true, highly_sensitive_count: 1, max_sensitivity_ratio: 0.47, conclusion: 'The result is most sensitive to the glass emission factor; a ±20% swing there moves the total by roughly ±9%.' },
      consistency: { is_consistent: true, issues: [], notes: ['Consistent GWP-100 basis and functional unit applied throughout.'] },
    },
    conclusions: {
      key_findings: [
        'The cradle-to-grave footprint is 0.94 kg CO2e per 700ml bottle.',
        'Packaging (chiefly glass) is the dominant stage at around 55% of the total.',
        'Scope 3 value-chain emissions account for 84% of the footprint.',
        'Data quality is good, anchored by primary orchard and distillery data.',
      ],
      limitations: [
        'The metal capsule uses a proxy emission factor pending a supplier-specific dataset.',
        'The consumer use phase is excluded owing to high variability.',
      ],
      recommendations: [
        'Lightweight the bottle and raise recycled cullet content toward 60%.',
        'Transition remaining distillery heat to a renewable or biomethane source.',
        'Obtain a supplier-specific dataset for the metal capsule to remove the proxy.',
      ],
      improvement_opportunities: [
        'A move to a 410g lightweighted bottle could cut the total footprint by an estimated 12–15%.',
        'On-site solar expansion would further reduce Scope 2 distillery emissions.',
      ],
    },
  },

  uncertaintySensitivity: {
    propagatedUncertaintyPct: 11,
    confidenceInterval95: { lower: '0.836', upper: '1.044' },
    sensitivityAnalysis: {
      method:
        'One-at-a-time ±20% variation applied to the emission factors of the three largest contributors, with the resulting change in the total footprint recorded as a sensitivity ratio.',
      parameters: [
        { materialName: 'Flint glass bottle', baselineContributionPct: 46.8, variationPct: 20, resultRange: { lower: '0.852', upper: '1.028' }, sensitivityRatio: 0.47, isHighlySensitive: true },
        { materialName: 'Apple cultivation', baselineContributionPct: 17.0, variationPct: 20, resultRange: { lower: '0.908', upper: '0.972' }, sensitivityRatio: 0.17, isHighlySensitive: false },
        { materialName: 'Distillation heat', baselineContributionPct: 11.7, variationPct: 20, resultRange: { lower: '0.918', upper: '0.962' }, sensitivityRatio: 0.12, isHighlySensitive: false },
      ],
      conclusion:
        'The headline result is robust. Only the glass emission factor is highly sensitive, which reinforces glass lightweighting and higher cullet content as the priority reduction lever.',
    },
  },

  criticalReview: {
    status: 'internal_review_completed',
    disclosure:
      'This study has undergone internal review by the alkatera LCA team and an AI-assisted structured review. It has not yet been subject to an independent third-party critical review. A comparative assertion disclosed to the public would require a panel review per ISO 14044 §6.3; no such assertion is made in this report.',
    recommendation:
      'Commission an independent third-party critical review before using this footprint to support any comparative public claim.',
    aiReview: {
      verdict:
        'The study conforms to the ISO 14044 and 14067 framework with good data quality. One minor gap remains around the proxy metal-capsule factor. No blocking issues were identified for internal use.',
      rating: 'qualified_pass',
      reviewDate: '14 November 2025',
      reviewerNote:
        'This review was generated with AI assistance by the alkatera engine as a structured internal check. It is not a substitute for an independent third-party critical review under ISO 14044 §6.',
      findings: [
        { clause: 'ISO 14044 §4.2 — Goal & scope', status: 'conforms', summary: 'Goal, functional unit and system boundary are clearly defined and internally consistent.' },
        { clause: 'ISO 14044 §4.2.3.6 — Data quality', status: 'minor_gap', summary: 'One flow (metal capsule) relies on a proxy factor.', detail: 'Impact is under 1% of the total, so the effect on the conclusion is negligible, but a supplier-specific dataset would close the gap.' },
        { clause: 'ISO 14067 §6.4.9 — Biogenic carbon', status: 'conforms', summary: 'Biogenic and fossil carbon are inventoried and reported separately as required.' },
        { clause: 'ISO 14044 §4.5 — Interpretation', status: 'conforms', summary: 'Hotspots, sensitivity and conclusions reconcile with the inventory results.' },
        { clause: 'ISO 14044 §6 — Critical review', status: 'minor_gap', summary: 'No independent third-party review has been performed.', detail: 'Required only for public comparative assertions, which this report does not make.' },
      ],
    },
  },

  lulucNote:
    'No direct land-use change (dLUC) is attributed to this product: the Normandy orchards have been under continuous perennial cultivation for more than 20 years, so no recent conversion emissions apply per PAS 2050 and the GHG Protocol Land Sector guidance.',

  zeroImpactCategories: [
    { category: 'Ionising radiation', reason: 'No nuclear-fuel-cycle flows exceed the cut-off threshold within the system boundary.' },
    { category: 'Direct land-use change (dLUC)', reason: 'Orchards under continuous cultivation for over 20 years; no conversion emissions apply.' },
    { category: 'HFC/PFC refrigerants', reason: 'No refrigerant losses are attributable to the product footprint above the cut-off threshold.' },
  ],

  scopeMethodology: {
    standard: 'GHG Protocol Product Standard',
    attributionMethod: 'Physical allocation by production volume for shared facilities.',
    note:
      'Scope 1 covers direct distillery combustion, Scope 2 purchased electricity, and Scope 3 all upstream and downstream value-chain emissions including packaging, agriculture, distribution and end-of-life.',
  },

  contractManufacturingNote: {
    isContractManufactured: false,
    facilityNames: [],
    explanation:
      'Avallen Calvados is produced at the brand-operated Normandy distillery, so distillery combustion and electricity sit in Scope 1 and Scope 2 respectively rather than in Scope 3 Category 1.',
  },

  transportNote: {
    method:
      'Inbound transport emissions are embedded within each ingredient line using distance x mode-specific DEFRA 2025 freight factors. Outbound distribution to the UK is reported as a discrete stage and is included in the product total.',
    totalTransportKgCo2e: 0.073,
    isEmbeddedInMaterials: true,
    outboundIncluded: true,
  },

  eolMethodology: {
    region: 'UK',
    regionLabel: 'United Kingdom (municipal, 2025)',
    avoidedBurdenMethod: 'Substitution (avoided virgin production)',
    dataSource: 'DEFRA 2025 waste recovery statistics; ecoinvent 3.10 disposal datasets',
    dataYear: 2025,
    totalGrossEmissions: 0.0239,
    totalAvoidedEmissions: -0.0157,
    totalNetEmissions: 0.0082,
    materialPathways: [
      { material: 'Flint glass', factorKey: 'glass_container', recyclingPct: 76, landfillPct: 22, incinerationPct: 2, compostingPct: 0, adPct: 0, isUserOverride: false },
      { material: 'Corrugated board', factorKey: 'paper_corrugated', recyclingPct: 82, landfillPct: 12, incinerationPct: 6, compostingPct: 0, adPct: 0, isUserOverride: false },
      { material: 'Paper label', factorKey: 'paper_mixed', recyclingPct: 68, landfillPct: 20, incinerationPct: 12, compostingPct: 0, adPct: 0, isUserOverride: false },
      { material: 'Cork', factorKey: 'cork', recyclingPct: 0, landfillPct: 60, incinerationPct: 20, compostingPct: 20, adPct: 0, isUserOverride: false },
      { material: 'Metal capsule', factorKey: 'aluminium', recyclingPct: 60, landfillPct: 34, incinerationPct: 6, compostingPct: 0, adPct: 0, isUserOverride: false },
    ],
  },

  circularityMethodology: {
    isProprietaryMetric: true,
    methodName: 'alkatera Circularity Index',
    description:
      'The circularity grade blends recycled-content input with expected end-of-life recovery, mass-weighted across all packaging. It is a proprietary indicator intended for directional comparison within a portfolio, not an ISO-standardised impact category.',
    reference: 'Aligned in spirit with ISO 14044 §4.4.5 and the Ellen MacArthur Foundation Material Circularity Indicator.',
  },
};

const html = renderLcaReportHtml(data);
const outPath = join(__dirname, '..', 'public', 'sample-lca.html');
writeFileSync(outPath, html, 'utf8');

console.log(`Wrote ${Buffer.byteLength(html, 'utf8')} bytes to ${outPath}`);
console.log('--- first 400 chars ---');
console.log(html.slice(0, 400));
