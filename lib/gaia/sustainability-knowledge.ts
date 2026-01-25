// Rosa Curated Sustainability Knowledge
// Pre-loaded expertise on sustainability frameworks, regulations, and best practices

import { createClient } from '@/utils/supabase/server';

/**
 * Categories of curated knowledge
 */
export type KnowledgeCategory =
  | 'ghg_protocol'
  | 'sbti'
  | 'csrd'
  | 'tcfd'
  | 'iso_standards'
  | 'water_stewardship'
  | 'circular_economy'
  | 'biodiversity'
  | 'social_sustainability'
  | 'drinks_industry'
  | 'carbon_accounting'
  | 'emission_factors'
  | 'reduction_strategies'
  | 'reporting_frameworks';

/**
 * Structure for curated knowledge entries
 */
export interface CuratedKnowledgeEntry {
  topic: string;
  subtopic?: string;
  content: string;
  category: KnowledgeCategory;
  keywords: string[];
  source?: string;
  sourceUrl?: string;
  validFrom?: Date;
  validUntil?: Date;
  priority: number; // 1-10, higher = more important
}

/**
 * Pre-loaded curated sustainability knowledge
 * This is the foundational knowledge that Rosa has access to
 */
export const CURATED_KNOWLEDGE: CuratedKnowledgeEntry[] = [
  // ==========================================================================
  // GHG PROTOCOL
  // ==========================================================================
  {
    topic: 'GHG Protocol Overview',
    subtopic: 'Introduction',
    content: `The Greenhouse Gas Protocol (GHG Protocol) is the world's most widely used greenhouse gas accounting standards. Developed by the World Resources Institute (WRI) and the World Business Council for Sustainable Development (WBCSD), it provides the accounting framework for nearly every GHG standard and program in the world.

Key components:
- Corporate Standard: For company-level emissions accounting
- Scope 3 Standard: For value chain emissions
- Product Standard: For product life cycle emissions
- Mitigation Goal Standard: For tracking progress toward climate goals

The GHG Protocol categorizes emissions into three scopes:
- Scope 1: Direct emissions from owned/controlled sources
- Scope 2: Indirect emissions from purchased energy
- Scope 3: All other indirect emissions in the value chain`,
    category: 'ghg_protocol',
    keywords: ['ghg protocol', 'greenhouse gas', 'wri', 'wbcsd', 'corporate standard', 'scopes'],
    source: 'GHG Protocol',
    sourceUrl: 'https://ghgprotocol.org/',
    priority: 10,
  },
  {
    topic: 'Scope 1 Emissions',
    subtopic: 'Direct Emissions',
    content: `Scope 1 emissions are direct greenhouse gas emissions that occur from sources owned or controlled by the company. These include:

1. Stationary Combustion: Emissions from burning fuels in stationary equipment (boilers, furnaces, generators)
2. Mobile Combustion: Emissions from vehicles owned or leased by the company (fleet vehicles, forklifts)
3. Process Emissions: Emissions from chemical or physical processes (fermentation in brewing, refrigerant losses)
4. Fugitive Emissions: Unintentional releases (refrigerant leaks, natural gas leaks)

For the drinks industry, common Scope 1 sources include:
- Natural gas for heating/steam generation
- Diesel/petrol for company vehicles
- CO2 from fermentation (biogenic - often reported separately)
- Refrigerant losses from cooling systems
- Propane for forklifts`,
    category: 'ghg_protocol',
    keywords: ['scope 1', 'direct emissions', 'stationary combustion', 'mobile combustion', 'fugitive', 'process emissions'],
    source: 'GHG Protocol Corporate Standard',
    priority: 9,
  },
  {
    topic: 'Scope 2 Emissions',
    subtopic: 'Indirect Energy Emissions',
    content: `Scope 2 emissions are indirect emissions from the generation of purchased electricity, steam, heating, and cooling consumed by the company.

Two calculation methods:
1. Location-based: Uses average grid emission factors for the location where electricity is consumed
2. Market-based: Uses emission factors from contractual instruments (PPAs, RECs, supplier-specific data)

For the drinks industry, Scope 2 typically includes:
- Electricity for refrigeration and cooling
- Electricity for production equipment
- Electricity for lighting and HVAC
- Purchased steam for heating processes

Best practices:
- Report both location-based and market-based figures
- Use most recent, region-specific emission factors
- Document any Renewable Energy Certificates (RECs) or Power Purchase Agreements (PPAs)
- Track and report renewable electricity percentage`,
    category: 'ghg_protocol',
    keywords: ['scope 2', 'electricity', 'location-based', 'market-based', 'purchased energy', 'recs', 'ppa'],
    source: 'GHG Protocol Scope 2 Guidance',
    priority: 9,
  },
  {
    topic: 'Scope 3 Emissions',
    subtopic: 'Value Chain Emissions',
    content: `Scope 3 emissions are all other indirect emissions in a company's value chain. They typically represent 70-90% of total emissions for drinks companies.

The 15 Scope 3 categories:
UPSTREAM:
1. Purchased goods and services (ingredients, packaging, raw materials)
2. Capital goods (equipment, buildings)
3. Fuel and energy-related activities (not in Scope 1/2)
4. Upstream transportation and distribution
5. Waste generated in operations
6. Business travel
7. Employee commuting
8. Upstream leased assets

DOWNSTREAM:
9. Downstream transportation and distribution
10. Processing of sold products
11. Use of sold products (refrigeration by retailers/consumers)
12. End-of-life treatment of sold products (packaging waste)
13. Downstream leased assets
14. Franchises
15. Investments

For drinks companies, the most material categories are typically:
- Category 1: Purchased goods (ingredients, packaging - often 40-60% of total)
- Category 4 & 9: Transportation
- Category 11 & 12: Product use and end-of-life`,
    category: 'ghg_protocol',
    keywords: ['scope 3', 'value chain', 'upstream', 'downstream', 'purchased goods', 'transportation', 'end of life'],
    source: 'GHG Protocol Scope 3 Standard',
    priority: 10,
  },

  // ==========================================================================
  // SCIENCE BASED TARGETS (SBTi)
  // ==========================================================================
  {
    topic: 'Science Based Targets Initiative',
    subtopic: 'Overview',
    content: `The Science Based Targets initiative (SBTi) is a partnership between CDP, the United Nations Global Compact, World Resources Institute (WRI), and the World Wide Fund for Nature (WWF). It defines and promotes best practice in science-based target setting.

Key concepts:
- Science-based targets show companies how much and how quickly they need to reduce their GHG emissions to prevent the worst effects of climate change
- Targets are considered 'science-based' if they are in line with what the latest climate science deems necessary to meet the goals of the Paris Agreement

Target types:
1. Near-term targets: 5-10 year targets to reduce emissions
2. Long-term targets: Targets to reach net-zero by 2050 or earlier
3. Net-zero targets: Complete the transition to net-zero emissions

Requirements for drinks companies:
- Scope 1 & 2: Minimum 4.2% year-on-year reduction (1.5°C aligned)
- Scope 3: Required if Scope 3 is >40% of total emissions (almost always the case for drinks)
- Must cover 95% of Scope 1+2 and 67% of Scope 3`,
    category: 'sbti',
    keywords: ['sbti', 'science based targets', 'paris agreement', 'net zero', '1.5 degrees', 'near-term', 'long-term'],
    source: 'Science Based Targets initiative',
    sourceUrl: 'https://sciencebasedtargets.org/',
    priority: 10,
  },
  {
    topic: 'SBTi Target Validation',
    subtopic: 'Validation Process',
    content: `The SBTi target validation process involves several steps:

1. Commit: Submit a commitment letter to set a science-based target
2. Develop: Companies have 24 months to develop and submit targets
3. Submit: Submit targets for validation through the SBTi Target Submission Form
4. Validate: SBTi reviews targets against criteria (typically 30 business days)
5. Announce: Approved targets are published on the SBTi website

Validation criteria:
- Boundary: Targets must cover company-wide Scope 1 and 2 emissions
- Timeframe: 5-10 years from submission date
- Ambition: At minimum, 1.5°C for Scope 1+2
- Scope 3: If >40% of total, targets required covering 67% of Scope 3

Common issues in drinks industry submissions:
- Biogenic emissions from fermentation (not currently required in SBTi)
- Scope 3 category 11 (use of sold products) boundary definition
- Contract manufacturing and Scope 1/2 boundary`,
    category: 'sbti',
    keywords: ['sbti validation', 'target submission', 'commitment', 'criteria', 'boundary', 'timeframe'],
    source: 'SBTi Target Validation Protocol',
    priority: 8,
  },

  // ==========================================================================
  // CSRD (Corporate Sustainability Reporting Directive)
  // ==========================================================================
  {
    topic: 'CSRD Overview',
    subtopic: 'EU Sustainability Reporting',
    content: `The Corporate Sustainability Reporting Directive (CSRD) is an EU directive that requires companies to report on their environmental and social impacts. It significantly expands the scope of sustainability reporting requirements.

Key features:
- Applies to: Large EU companies, listed SMEs, and non-EU companies with significant EU activity
- Reporting standards: European Sustainability Reporting Standards (ESRS)
- Assurance: Limited assurance required, moving to reasonable assurance
- Digital format: Reports must be in machine-readable XHTML format

Timeline (phased implementation):
- 2024: Large public-interest entities already reporting under NFRD
- 2025: Other large companies
- 2026: Listed SMEs
- 2028: Non-EU companies meeting thresholds

ESRS topics cover:
- Climate change (E1)
- Pollution (E2)
- Water and marine resources (E3)
- Biodiversity (E4)
- Resource use and circular economy (E5)
- Own workforce (S1-S4)
- Business conduct (G1)`,
    category: 'csrd',
    keywords: ['csrd', 'esrs', 'eu reporting', 'sustainability reporting', 'double materiality', 'european union'],
    source: 'European Commission',
    sourceUrl: 'https://ec.europa.eu/info/business-economy-euro/company-reporting-and-auditing/company-reporting/corporate-sustainability-reporting_en',
    validFrom: new Date('2024-01-01'),
    priority: 9,
  },
  {
    topic: 'Double Materiality',
    subtopic: 'CSRD Assessment',
    content: `Double materiality is a core concept in CSRD reporting that requires companies to assess sustainability topics from two perspectives:

1. Impact Materiality (Inside-Out):
   - How the company's activities impact people and the environment
   - Includes both positive and negative impacts
   - Covers actual and potential impacts
   - Example: A drinks company's water usage impacting local water stress

2. Financial Materiality (Outside-In):
   - How sustainability matters create financial risks and opportunities
   - Effects on cash flows, access to finance, cost of capital
   - Short, medium, and long-term horizons
   - Example: Climate change affecting crop yields and ingredient costs

A topic is material if it is material from EITHER perspective.

For drinks companies, typically material topics include:
- Climate change (both perspectives - emissions impact and physical/transition risks)
- Water (significant operational and supply chain dependency)
- Packaging and circular economy (environmental impact and regulatory risk)
- Biodiversity (agricultural supply chain impacts)`,
    category: 'csrd',
    keywords: ['double materiality', 'impact materiality', 'financial materiality', 'esrs', 'materiality assessment'],
    source: 'ESRS 1 General Requirements',
    priority: 8,
  },

  // ==========================================================================
  // DRINKS INDUSTRY SPECIFIC
  // ==========================================================================
  {
    topic: 'Drinks Industry Carbon Footprint',
    subtopic: 'Emission Sources',
    content: `The drinks industry has specific emission sources and patterns:

Typical emissions breakdown for a beverage company:
- Packaging: 30-50% (glass, aluminum, plastic, cardboard)
- Ingredients: 15-25% (agricultural emissions, processing)
- Distribution: 10-20% (logistics, cold chain)
- Production: 10-15% (energy, refrigeration)
- End of life: 5-10% (packaging disposal/recycling)

Key carbon hotspots by beverage type:
- Beer/Cider: Glass bottles, barley/hops cultivation, refrigeration
- Spirits: Glass bottles, grain cultivation, energy for distillation
- Wine: Glass bottles, grape cultivation, transportation
- Soft drinks: Packaging, sugar production, refrigeration
- RTDs: Aluminum cans/glass, base spirits, sugar

Reduction opportunities:
1. Packaging lightweighting and format shifts
2. Renewable energy in production
3. Sustainable agriculture practices with suppliers
4. Logistics optimization and modal shift
5. Increased recycled content in packaging`,
    category: 'drinks_industry',
    keywords: ['beverages', 'drinks industry', 'packaging', 'ingredients', 'distribution', 'carbon footprint'],
    source: 'Industry analysis',
    priority: 9,
  },
  {
    topic: 'Packaging Sustainability',
    subtopic: 'Drinks Industry',
    content: `Packaging is typically the largest contributor to a drinks company's carbon footprint. Key considerations:

Glass:
- High carbon intensity due to manufacturing (melting at 1500°C)
- Highly recyclable but heavy (transport emissions)
- Average: 400-600g CO2e per 750ml bottle (virgin glass)
- Lightweighting can reduce by 10-30%
- Recycled content: Each 10% increase reduces emissions ~3%

Aluminum:
- High primary production emissions, but excellent recyclability
- Average: 150-200g CO2e per 330ml can (virgin aluminum)
- Recycled aluminum uses 95% less energy
- Infinitely recyclable without quality loss

PET Plastic:
- Lower production emissions than glass
- Average: 100-150g CO2e per 500ml bottle
- Recycled PET (rPET) reduces emissions 50-70%
- End-of-life concerns in many markets

Cardboard/Paperboard:
- Generally lowest carbon option
- Average: 50-100g CO2e per carton
- FSC certification important for sustainability claims
- Bag-in-box formats increasingly popular

Best practices:
- Set recycled content targets (e.g., 50% by 2030)
- Invest in packaging lightweighting R&D
- Support collection and recycling infrastructure
- Consider refillable/reusable formats where viable`,
    category: 'drinks_industry',
    keywords: ['packaging', 'glass', 'aluminum', 'pet', 'recycled content', 'lightweighting', 'circular economy'],
    source: 'Industry best practice',
    priority: 8,
  },
  {
    topic: 'Water Stewardship',
    subtopic: 'Drinks Industry',
    content: `Water is critical for the drinks industry both as a key ingredient and production input.

Water use in beverage production:
- Beer: 3-7 liters water per liter of beer (best practice: <3.5L)
- Spirits: 5-15 liters per liter of product
- Soft drinks: 1.5-3 liters per liter of product
- Wine: 1-2 liters per liter (production only, viticulture much higher)

Water stewardship framework (AWS):
1. Water governance: Policies and management systems
2. Water balance: Understanding inputs, outputs, consumption
3. Water quality: Discharge quality management
4. Important water areas: Protection of sensitive ecosystems
5. WASH: Safe water, sanitation, hygiene for all workers

Key metrics:
- Water use intensity (liters per liter of product)
- Wastewater quality (BOD, COD, TSS)
- Water stress assessment (WRI Aqueduct)
- Watershed health indicators

Reduction strategies:
- Process optimization and water reuse
- CIP (Clean-in-Place) optimization
- Rainwater harvesting
- Wastewater treatment and recycling
- Supply chain water engagement (agriculture)`,
    category: 'water_stewardship',
    keywords: ['water', 'water intensity', 'aws', 'water stewardship', 'wastewater', 'water stress'],
    source: 'Alliance for Water Stewardship',
    sourceUrl: 'https://a4ws.org/',
    priority: 8,
  },

  // ==========================================================================
  // CARBON ACCOUNTING
  // ==========================================================================
  {
    topic: 'Emission Factors',
    subtopic: 'Data Sources',
    content: `Emission factors are coefficients that convert activity data into greenhouse gas emissions. Selecting appropriate emission factors is crucial for accurate carbon accounting.

Emission factor hierarchy (by preference):
1. Supplier-specific data (most accurate)
2. Country/region-specific secondary data
3. Industry average data
4. Global default values (least accurate)

Key emission factor databases:
- DEFRA (UK): Comprehensive, updated annually
- EPA (US): US-specific factors
- IPCC: Global default values
- Ecoinvent: Life cycle inventory database
- GaBi: Commercial LCA database
- IEA: Electricity grid factors by country

For drinks industry:
- Electricity: Use location-specific grid factors (updated annually)
- Fuels: Use DEFRA or local equivalent
- Packaging: Use supplier-specific or ecoinvent
- Ingredients: Agricultural emission factors vary significantly by region
- Transport: Use mode-specific and fuel-specific factors

Best practices:
- Document all emission factors and sources
- Update factors annually
- Request supplier-specific data for major inputs
- Apply appropriate global warming potential (GWP) values`,
    category: 'emission_factors',
    keywords: ['emission factors', 'defra', 'epa', 'ipcc', 'ecoinvent', 'activity data', 'conversion factors'],
    source: 'GHG Protocol',
    priority: 8,
  },
  {
    topic: 'Carbon Accounting Best Practices',
    subtopic: 'Quality Assurance',
    content: `High-quality carbon accounting requires robust processes and controls:

Data quality principles:
1. Relevance: Appropriate boundaries and factors
2. Completeness: All material sources included
3. Consistency: Year-on-year comparability
4. Transparency: Clear documentation
5. Accuracy: Minimize errors and uncertainty

Common challenges and solutions:
- Data gaps: Use estimation methodologies, document assumptions
- Supplier data: Engage key suppliers, use industry averages where needed
- Scope 3 boundaries: Follow GHG Protocol guidance, be conservative
- Base year recalculation: Define policy for structural changes

Quality control checks:
- Year-on-year variance analysis (flag changes >10%)
- Intensity ratio checks (emissions per unit output)
- Benchmark against industry peers
- Cross-check with financial data (energy costs, purchases)
- Third-party verification (especially for public reporting)

Documentation requirements:
- Organizational boundaries and approach (operational/financial control)
- Emission factor sources and versions
- Calculation methodologies
- Data sources and collection processes
- Assumptions and estimations
- Exclusions and their materiality`,
    category: 'carbon_accounting',
    keywords: ['carbon accounting', 'data quality', 'verification', 'quality control', 'documentation', 'best practices'],
    source: 'GHG Protocol Corporate Standard',
    priority: 7,
  },

  // ==========================================================================
  // REDUCTION STRATEGIES
  // ==========================================================================
  {
    topic: 'Emission Reduction Hierarchy',
    subtopic: 'Decarbonization Strategy',
    content: `When developing a decarbonization strategy, follow this hierarchy:

1. AVOID: Eliminate emission sources entirely
   - Remove unnecessary activities or products
   - Example: Eliminate non-essential business travel

2. REDUCE: Improve efficiency of remaining activities
   - Energy efficiency improvements
   - Example: LED lighting, efficient motors, heat recovery

3. SUBSTITUTE: Switch to lower-carbon alternatives
   - Fuel switching, renewable energy
   - Example: Replace natural gas boilers with electric heat pumps

4. COMPENSATE: Offset remaining emissions (last resort)
   - Carbon credits, nature-based solutions
   - Should only be used for truly unavoidable emissions

For drinks companies, typical reduction pathways:
Scope 1:
- Electrification of heating (heat pumps, electric boilers)
- Fleet electrification
- Refrigerant transition (low-GWP alternatives)

Scope 2:
- On-site renewables (solar, wind)
- Power Purchase Agreements (PPAs)
- Green tariffs / RECs

Scope 3:
- Supplier engagement programs
- Packaging innovation and lightweighting
- Logistics optimization
- Agricultural practice improvements`,
    category: 'reduction_strategies',
    keywords: ['reduction', 'decarbonization', 'avoid', 'reduce', 'substitute', 'offset', 'net zero pathway'],
    source: 'Industry best practice',
    priority: 9,
  },
  {
    topic: 'Renewable Energy Procurement',
    subtopic: 'Options and Hierarchy',
    content: `Renewable energy procurement options for drinks companies (in order of preference for market-based claims):

1. On-site generation (highest impact):
   - Solar PV on rooftops and land
   - Small-scale wind where viable
   - Biogas from wastewater treatment
   - Pros: Additionality, price certainty, visibility
   - Cons: Capital intensive, space requirements

2. Power Purchase Agreements (PPAs):
   - Direct PPA: Contract with specific renewable project
   - Virtual/Financial PPA: Price hedge without physical delivery
   - Pros: Long-term price certainty, additionality if new project
   - Cons: Complexity, credit requirements, long-term commitment

3. Green Tariffs:
   - Utility-provided renewable energy products
   - Quality varies - look for new/additional projects
   - Pros: Simpler than PPA
   - Cons: May not be additional (existing hydro, etc.)

4. Renewable Energy Certificates (RECs/GOs):
   - Unbundled certificates from renewable generation
   - Pros: Flexible, lower cost
   - Cons: May not drive additional renewable capacity

Best practice:
- Prioritize options that drive additional renewable capacity
- Match certificates to country/region of consumption
- Look for robust certification (e.g., RE100 Technical Criteria)
- Combine approaches (on-site + PPA + RECs)`,
    category: 'reduction_strategies',
    keywords: ['renewable energy', 'ppa', 'solar', 'wind', 'recs', 'green tariff', 're100', 'additionality'],
    source: 'RE100 Technical Criteria',
    sourceUrl: 'https://www.there100.org/',
    priority: 8,
  },

  // ==========================================================================
  // ISO STANDARDS
  // ==========================================================================
  {
    topic: 'ISO 14064',
    subtopic: 'GHG Quantification and Verification',
    content: `ISO 14064 is the international standard for greenhouse gas accounting and verification.

ISO 14064-1: Organization-level GHG inventories
- Principles: Relevance, completeness, consistency, accuracy, transparency
- Boundary setting (organizational and operational)
- GHG inventory development
- Uncertainty assessment
- Base year and recalculation policy

ISO 14064-2: Project-level GHG reductions
- Baseline scenarios
- Additionality assessment
- Monitoring and reporting
- Used for carbon offset projects

ISO 14064-3: Verification and validation
- Competence requirements for verifiers
- Verification process
- Levels of assurance (reasonable vs limited)
- Materiality thresholds

For drinks companies:
- 14064-1 is most relevant for corporate reporting
- Aligns with GHG Protocol (can use either as basis)
- Often required for CDP, SBTi, and other frameworks
- Third-party verification improves credibility`,
    category: 'iso_standards',
    keywords: ['iso 14064', 'verification', 'validation', 'ghg inventory', 'assurance', 'iso standard'],
    source: 'International Organization for Standardization',
    priority: 7,
  },
  {
    topic: 'ISO 14067',
    subtopic: 'Product Carbon Footprint',
    content: `ISO 14067 provides requirements for the quantification of the carbon footprint of products (CFP).

Key requirements:
- Based on life cycle assessment (ISO 14040/14044)
- Includes all GHGs, expressed as CO2 equivalent
- Covers full life cycle: raw materials, production, distribution, use, end-of-life
- Functional unit definition
- System boundary requirements

Life cycle stages for beverages:
1. Raw material acquisition (ingredients, packaging materials)
2. Production (manufacturing, filling, packaging)
3. Distribution (transport, storage, retail)
4. Use phase (refrigeration, preparation)
5. End of life (packaging disposal, recycling)

Important considerations:
- Biogenic carbon: Separate reporting for biogenic CO2
- Allocation: Rules for multi-product facilities
- Cut-off criteria: Materiality thresholds for inclusion
- Data quality: Primary vs. secondary data requirements

For drinks companies:
- Useful for product-level claims and labeling
- Supports Product Environmental Footprint (PEF) in EU
- Enables product comparison and optimization
- Required for some retailer partnerships`,
    category: 'iso_standards',
    keywords: ['iso 14067', 'product carbon footprint', 'lca', 'life cycle', 'cfp', 'pef'],
    source: 'International Organization for Standardization',
    priority: 7,
  },

  // ==========================================================================
  // TCFD
  // ==========================================================================
  {
    topic: 'TCFD Framework',
    subtopic: 'Climate-Related Financial Disclosure',
    content: `The Task Force on Climate-related Financial Disclosures (TCFD) provides a framework for climate risk disclosure.

Four pillars of TCFD:
1. GOVERNANCE: Board and management oversight of climate risks/opportunities
2. STRATEGY: Climate-related risks, opportunities, and their impact on business
3. RISK MANAGEMENT: Processes for identifying, assessing, managing climate risks
4. METRICS & TARGETS: Metrics and targets used to assess climate matters

Climate risk categories:
Physical Risks:
- Acute: Extreme weather events (floods, droughts, storms)
- Chronic: Long-term shifts (rising temperatures, sea level rise)

Transition Risks:
- Policy/Legal: Carbon pricing, regulations, litigation
- Technology: Shift to lower-carbon technologies
- Market: Changing consumer preferences
- Reputation: Stakeholder expectations

For drinks companies, key risks include:
- Water stress affecting production and agriculture
- Extreme weather impacting supply chains
- Carbon pricing affecting operational costs
- Changing consumer preferences for sustainable products
- Regulatory requirements (packaging, emissions)

Scenario analysis:
- Required under TCFD
- Typically uses 1.5°C, 2°C, and 4°C scenarios
- Assess business resilience under different futures`,
    category: 'tcfd',
    keywords: ['tcfd', 'climate risk', 'physical risk', 'transition risk', 'scenario analysis', 'governance'],
    source: 'Task Force on Climate-related Financial Disclosures',
    sourceUrl: 'https://www.fsb-tcfd.org/',
    priority: 8,
  },

  // ==========================================================================
  // CIRCULAR ECONOMY
  // ==========================================================================
  {
    topic: 'Circular Economy Principles',
    subtopic: 'Drinks Industry Application',
    content: `Circular economy principles applied to the drinks industry:

Core principles:
1. Design out waste and pollution
2. Keep products and materials in use
3. Regenerate natural systems

Application areas for drinks:

Packaging Circularity:
- Design for recyclability (mono-materials, no problematic additives)
- Increase recycled content (rPET, recycled aluminum, recycled glass)
- Enable collection and recycling (deposit schemes, take-back programs)
- Explore reuse models (refillable bottles, kegs)

Production Circularity:
- Spent grain/yeast valorization (animal feed, food ingredients)
- Wastewater treatment and reuse
- Energy recovery from organic waste
- By-product streams as inputs for other industries

Ingredient Circularity:
- Regenerative agriculture practices
- Food waste reduction in supply chain
- Upcycled ingredients (fruit pulp, etc.)

Metrics for circularity:
- Material Circularity Indicator (Ellen MacArthur Foundation)
- Recycled content percentage
- Recyclability rate
- Waste to landfill
- Water recycling rate`,
    category: 'circular_economy',
    keywords: ['circular economy', 'recyclability', 'recycled content', 'reuse', 'waste', 'regenerative'],
    source: 'Ellen MacArthur Foundation',
    sourceUrl: 'https://ellenmacarthurfoundation.org/',
    priority: 7,
  },
];

/**
 * Seed the curated knowledge to the database
 */
export async function seedCuratedKnowledge(): Promise<{
  success: boolean;
  insertedCount: number;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    // Check for existing entries
    const { count: existingCount } = await supabase
      .from('rosa_curated_knowledge')
      .select('*', { count: 'exact', head: true });

    if (existingCount && existingCount > 0) {
      return {
        success: true,
        insertedCount: 0,
        error: 'Curated knowledge already seeded',
      };
    }

    // Prepare entries for insertion (without embeddings - those will be added by indexing)
    const entries = CURATED_KNOWLEDGE.map((entry) => ({
      topic: entry.topic,
      subtopic: entry.subtopic,
      content: entry.content,
      category: entry.category,
      keywords: entry.keywords,
      source: entry.source,
      source_url: entry.sourceUrl,
      valid_from: entry.validFrom?.toISOString().split('T')[0],
      valid_until: entry.validUntil?.toISOString().split('T')[0],
      is_active: true,
      priority: entry.priority,
    }));

    // Insert in batches
    const batchSize = 10;
    let insertedCount = 0;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const { error } = await supabase.from('rosa_curated_knowledge').insert(batch);

      if (error) {
        throw error;
      }

      insertedCount += batch.length;
    }

    return {
      success: true,
      insertedCount,
    };
  } catch (error) {
    console.error('Error seeding curated knowledge:', error);
    return {
      success: false,
      insertedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get curated knowledge by category
 */
export async function getCuratedKnowledgeByCategory(
  category: KnowledgeCategory
): Promise<CuratedKnowledgeEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('rosa_curated_knowledge')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('Error fetching curated knowledge:', error);
    return [];
  }

  return data.map((row) => ({
    topic: row.topic,
    subtopic: row.subtopic,
    content: row.content,
    category: row.category as KnowledgeCategory,
    keywords: row.keywords || [],
    source: row.source,
    sourceUrl: row.source_url,
    validFrom: row.valid_from ? new Date(row.valid_from) : undefined,
    validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
    priority: row.priority,
  }));
}

/**
 * Search curated knowledge by keywords
 */
export async function searchCuratedKnowledge(
  searchTerms: string[]
): Promise<CuratedKnowledgeEntry[]> {
  const supabase = await createClient();

  // Build query to search in keywords array
  const { data, error } = await supabase
    .from('rosa_curated_knowledge')
    .select('*')
    .eq('is_active', true)
    .overlaps('keywords', searchTerms)
    .order('priority', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error searching curated knowledge:', error);
    return [];
  }

  return data.map((row) => ({
    topic: row.topic,
    subtopic: row.subtopic,
    content: row.content,
    category: row.category as KnowledgeCategory,
    keywords: row.keywords || [],
    source: row.source,
    sourceUrl: row.source_url,
    validFrom: row.valid_from ? new Date(row.valid_from) : undefined,
    validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
    priority: row.priority,
  }));
}
