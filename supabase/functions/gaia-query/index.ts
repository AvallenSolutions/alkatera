import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Rate limiting configuration
const RATE_LIMIT_QUERIES_PER_HOUR = 50;

// DB-backed rate limiting — survives function restarts
async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const windowMs = 60 * 60 * 1000; // 1 hour
  const oneHourAgo = new Date(Date.now() - windowMs).toISOString();

  try {
    // Count user messages in the last hour via conversation ownership
    const { data: conversations } = await supabase
      .from('gaia_conversations')
      .select('id')
      .eq('user_id', userId);

    if (!conversations || conversations.length === 0) {
      return { allowed: true, remaining: RATE_LIMIT_QUERIES_PER_HOUR, resetIn: windowMs };
    }

    const conversationIds = conversations.map((c: { id: string }) => c.id);
    const { count } = await supabase
      .from('gaia_messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .gte('created_at', oneHourAgo)
      .in('conversation_id', conversationIds);

    const used = count || 0;
    const allowed = used < RATE_LIMIT_QUERIES_PER_HOUR;
    const remaining = Math.max(0, RATE_LIMIT_QUERIES_PER_HOUR - used);

    return { allowed, remaining, resetIn: windowMs };
  } catch (err) {
    console.error('[Rosa] Rate limit check failed, allowing request:', err);
    // Fail open — don't block users if the check fails
    return { allowed: true, remaining: RATE_LIMIT_QUERIES_PER_HOUR, resetIn: windowMs };
  }
}

interface RosaQueryRequest {
  message: string;
  conversation_id?: string;
  organization_id: string;
  stream?: boolean;
}

interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'table' | 'area' | 'donut';
  title?: string;
  data: unknown[];
  config?: Record<string, unknown>;
}

interface DataSource {
  table: string;
  description: string;
  recordCount?: number;
}

interface RosaResponse {
  content: string;
  chart_data?: ChartData;
  data_sources: DataSource[];
}

// ==========================================================================
// SYSTEM PROMPT (optimised — ~1,800 tokens)
// Navigation examples and workflows are injected conditionally via intent detection.
// ==========================================================================

const ROSA_SYSTEM_PROMPT = `You are Rosa, the sustainability assistant for AlkaTera. You are named after a beloved miniature golden doodle, embodying loyalty, warmth, and a genuine desire to help organisations understand and improve their environmental impact.

## CRITICAL: YOU HAVE ACCESS TO USER DATA

**IMPORTANT**: You have FULL ACCESS to the user's organization data provided in the system context. You MUST use this data to answer questions.

When users ask about their data (products, suppliers, emissions, facilities, fleet, vitality scores):
1. **Look at the ORGANIZATION DATA section** — their data is there
2. **Report their actual data** — list names, numbers, and details
3. **Be specific** — don't say "I can't access" when the data is in the context

If data is genuinely not present, say "You haven't added any [products/suppliers/etc.] yet" and guide them to add it.

## CORE DIRECTIVES

1. **TRUTHFULNESS IS PARAMOUNT**: Never invent facts, statistics, or data. If data doesn't exist in the provided context, say so clearly.
2. **CITE YOUR SOURCES**: Reference the specific data tables or calculations you're using. Use "Source: [data source]".
3. **ACKNOWLEDGE LIMITATIONS**: If data is incomplete or missing, state this explicitly.
4. **GUIDE, DON'T ACT**: You provide information and guidance only. Direct users to the appropriate pages to take actions.
5. **STAY IN SCOPE**: Only answer questions about the user's organization data within AlkaTera. Politely decline general sustainability advice not tied to their data, competitor comparisons, regulatory/legal advice, or cross-org data requests.
6. **BE HELPFUL**: After answering, suggest relevant follow-up questions or actions.

## PLATFORM NAVIGATION

Main sidebar: Dashboard | Company (Facilities, Fleet, Production Allocation, Emissions, Vitality) | Products | Suppliers | People & Culture | Governance | Community Impact | Resources (Knowledge Bank, Reports, Greenwash Guardian) | Rosa | Certifications | Settings (Subscription, Billing, Profile, Team, Organisation)

When users ask "how do I..." questions, provide step-by-step guidance with specific navigation paths like "Go to Company > Facilities > Add New Facility".

## PERSONALIZED RECOMMENDATIONS

When users ask for recommendations, analyse their actual data, identify gaps and opportunities, prioritise by impact (biggest emission sources first), and reference their actual products/facilities/suppliers by name.

## CORPORATE EMISSIONS DATA

When reporting corporate carbon footprint, total emissions, or scope breakdowns:
- **ALWAYS use the pre-calculated figures from the "Corporate Carbon Footprint" section**
- **NEVER manually sum product LCAs or raw activity data** — this causes double-counting errors
- Scope 1: Direct emissions (facilities, vehicles). Scope 2: Purchased energy. Scope 3: Value chain (Cat 1-8).

## PERSONALITY

Professional, clear, and supportive. Accessible to non-technical users while maintaining scientific accuracy. Friendly and encouraging — like a loyal golden doodle, always happy to help!

## RESPONSE FORMAT

1. **Direct Answer First** — lead with the key number, list, or guidance
2. **Supporting Details** — breakdown, context, or methodology
3. **Data Sources** — cite where the data comes from
4. **Limitations** — note any missing data or caveats
5. **Next Steps** — suggest follow-up questions or actions

## VISUALIZATION

When data would benefit from visualization, include a chart_data object in your JSON response. Use tables for comparisons, bar charts for discrete values, pie/donut charts for composition, line charts for trends.

Remember: You are a trusted advisor helping organizations on their sustainability journey. Your role is to illuminate, educate, and empower — never to mislead or oversimplify.`;

// Easter egg content — injected only when query intent matches
const ROSA_EASTER_EGG = `
## EASTER EGG - ROSA'S PHOTO

If anyone asks "what does Rosa look like", "show me Rosa", "can I see Rosa", "who is Rosa", "why are you called Rosa", or similar questions about your appearance/name, respond warmly and ALWAYS include Rosa's photo.

Respond with something like:
"I'm named after Rosa, a wonderful miniature golden doodle! She was rescued from a cage on the streets of Yerevan, Armenia, and given a second chance at a happy life. Here she is:

https://alkatera.com/images/rosa-the-dog.jpg

Just as Rosa the dog found her purpose and brings joy to everyone she meets, I'm here to help businesses on their sustainability journey!"

IMPORTANT: Always include the full image URL on its own line so it displays as an inline image. Do not wrap it in markdown image syntax.`;

// Workflow knowledge — injected only for navigation/how-to queries
const WORKFLOW_KNOWLEDGE = `
## STEP-BY-STEP WORKFLOWS

**Adding a Product:**
1. Click **Products** in the left sidebar
2. Click the **"Add New Product"** button
3. Enter your product name (e.g., "Pale Ale 330ml")
4. Select category (Beer/Spirits/Wine/Cider/RTD) and sub-category
5. Upload a product image (optional but recommended)
6. Click **"Create Product"**
*Tip: You can add ingredients and packaging later when ready for LCA calculation*

**Adding a Facility:**
1. Click **Company** in the left sidebar
2. Select **Facilities**
3. Click **"Add New Facility"**
4. Enter the facility name and address
5. Select the facility type (Distillery, Brewery, Winery, Bottling, Office, Warehouse)
6. Add facility size in square metres if known
7. Click **"Create Facility"**
*Tip: After creating, add utility data (electricity, gas, water) in the facility's Utilities tab*

**Adding Utility Data:**
1. Go to **Company > Facilities**
2. Click on the facility you want to update
3. Go to the **"Utilities"** tab
4. Click **"Add Data"** for each utility type
5. Enter consumption amount and units (kWh for electricity, m³ for gas/water)
6. Select the billing period
7. Click **"Save"**

**Adding a Supplier:**
1. Click **Suppliers** in the left sidebar
2. Click **"Add Supplier"**
3. Enter the supplier name, select category, add contact details and location
4. Click **"Save"**

**Completing a Product LCA:**
1. Ensure product has ingredients added (Products > [Product] > Ingredients tab)
2. Ensure product has packaging added (Products > [Product] > Packaging tab)
3. Go to **Products** and click on the product
4. Go to the **"LCA"** tab
5. Click **"Calculate LCA"**

**Adding Fleet Vehicles:**
1. Click **Company** in the left sidebar, select **Fleet**
2. Click **"Add Vehicle"**, enter registration, type, and fuel type
3. After creating, add mileage data in the vehicle's Activity tab

**Generating a Report:**
1. Go to **Dashboard**, click **"Generate Report"**
2. Select report type, date range, and sections to include
3. Click **"Generate"** — download as PDF or share via link

**Example Navigation Responses:**

"How do I add a product?" →
"To add a product:
1. Click **Products** in the left sidebar
2. Click the **Add New Product** button
3. Enter your product name (e.g., 'Pale Ale 330ml')
4. Select category and sub-category
5. Upload a product image (optional)
6. Click **Create Product**

You can add ingredients and packaging details later when you're ready to calculate the carbon footprint."

"How do I navigate to the dashboard?" →
"Click **Dashboard** at the top of the left sidebar — it's the first item in the navigation menu."
`;

// ==========================================================================
// QUERY INTENT CLASSIFICATION
// ==========================================================================

type QueryIntent = 'navigation' | 'emissions' | 'products' | 'suppliers'
  | 'facilities' | 'water' | 'waste' | 'vitality' | 'people'
  | 'governance' | 'community' | 'general' | 'easter_egg';

const INTENT_RULES: Array<{ intent: QueryIntent; keywords: string[] }> = [
  { intent: 'easter_egg', keywords: ['rosa', 'look like', 'photo', 'picture', 'who are you', 'your name', 'why are you called', 'show me rosa', 'can i see rosa'] },
  { intent: 'navigation', keywords: ['how do i', 'how to', 'where do i', 'where is', 'navigate', 'find the', 'walk me', 'guide me', 'help me add', 'help me create', 'step by step'] },
  { intent: 'emissions', keywords: ['emission', 'carbon', 'scope 1', 'scope 2', 'scope 3', 'co2', 'greenhouse', 'ghg', 'footprint', 'climate change'] },
  { intent: 'products', keywords: ['product', 'lca', 'ingredient', 'packaging', 'sku', 'life cycle', 'carbon footprint'] },
  { intent: 'suppliers', keywords: ['supplier', 'supply chain', 'vendor', 'procurement', 'sourcing'] },
  { intent: 'facilities', keywords: ['facility', 'facilities', 'factory', 'office', 'warehouse', 'brewery', 'distillery', 'winery', 'electricity', 'gas', 'energy', 'utility'] },
  { intent: 'water', keywords: ['water', 'consumption', 'scarcity', 'aware factor'] },
  { intent: 'waste', keywords: ['waste', 'recycl', 'circular', 'landfill', 'diversion'] },
  { intent: 'vitality', keywords: ['vitality', 'score', 'sustainability score', 'performance score'] },
  { intent: 'people', keywords: ['people', 'employee', 'team', 'hr', 'human resource', 'staff', 'diversity', 'wellbeing', 'training'] },
  { intent: 'governance', keywords: ['governance', 'policy', 'policies', 'compliance', 'certification', 'b corp', 'iso', 'target', 'board'] },
  { intent: 'community', keywords: ['community', 'social', 'volunteer', 'charitable', 'donation', 'local sourcing', 'beneficiar'] },
];

// Broad/overview queries that should fetch everything
const BROAD_KEYWORDS = ['overview', 'summary', 'everything', 'all data', 'tell me about', 'what do you know', 'dashboard', 'report', 'how am i doing', 'recommend', 'priority', 'what should'];

function classifyQueryIntent(message: string): QueryIntent[] {
  const lower = message.toLowerCase();

  // Check for broad queries first — fetch all data
  if (BROAD_KEYWORDS.some(kw => lower.includes(kw))) {
    return ['general'];
  }

  const intents: QueryIntent[] = [];
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      intents.push(rule.intent);
    }
  }

  // Default to general if no specific intent detected
  return intents.length > 0 ? intents : ['general'];
}

// ==========================================================================
// INTELLIGENT CONTEXT WINDOWING
// ==========================================================================

async function getConversationHistory(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  maxTokenBudget = 3000
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  // Over-fetch to allow windowing
  const { data: history } = await supabase
    .from('gaia_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!history || history.length === 0) return [];

  // Walk backwards (most recent first), estimate tokens, stop when budget exceeded
  const selected: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let tokenCount = 0;

  for (const msg of history) {
    const estimatedTokens = Math.ceil((msg.content?.length || 0) / 4);
    if (tokenCount + estimatedTokens > maxTokenBudget && selected.length > 0) {
      break;
    }
    selected.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    tokenCount += estimatedTokens;
  }

  // Reverse to chronological order (was fetched newest-first)
  return selected.reverse();
}

// ==========================================================================
// SELECTIVE CONTEXT LOADING
// ==========================================================================

async function fetchOrganizationContext(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  intents: QueryIntent[]
): Promise<{ context: string; dataSources: DataSource[] }> {
  const dataSources: DataSource[] = [];
  const contextParts: string[] = [];
  const currentYear = new Date().getFullYear();
  const fetchAll = intents.includes('general');

  try {
    // Always fetch org basics (cheap, 1 query)
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, industry')
      .eq('id', organizationId)
      .maybeSingle();

    if (org) {
      contextParts.push(`Organization: ${org.name}`);
      if (org.industry) contextParts.push(`Industry: ${org.industry}`);
    }

    // Build parallel fetch promises based on intents
    const fetches: Array<{ key: string; promise: Promise<void> }> = [];

    // --- Fleet Data ---
    if (fetchAll || intents.includes('emissions') || intents.includes('facilities')) {
      fetches.push({
        key: 'fleet',
        promise: (async () => {
          const { data: fleetVehicles, count: vehicleCount } = await supabase
            .from('fleet_vehicles')
            .select('id, registration, vehicle_type, fuel_type', { count: 'exact' })
            .eq('organization_id', organizationId);

          const { data: fleetData, count: fleetCount } = await supabase
            .from('fleet_activities')
            .select('emissions_tco2e, distance_km', { count: 'exact' })
            .eq('organization_id', organizationId);

          if ((fleetVehicles && fleetVehicles.length > 0) || (fleetData && fleetData.length > 0)) {
            contextParts.push(`\n### Fleet Data`);
            if (fleetVehicles && fleetVehicles.length > 0) {
              contextParts.push(`- Number of Vehicles: ${fleetVehicles.length}`);
              contextParts.push(`\n**Vehicle List:**`);
              fleetVehicles.slice(0, 10).forEach((v, i) => {
                const type = v.vehicle_type ? ` - ${v.vehicle_type}` : '';
                const fuel = v.fuel_type ? ` (${v.fuel_type})` : '';
                contextParts.push(`  ${i + 1}. ${v.registration}${type}${fuel}`);
              });
              if (fleetVehicles.length > 10) contextParts.push(`  ... and ${fleetVehicles.length - 10} more vehicles`);
              dataSources.push({ table: 'fleet_vehicles', description: 'Fleet vehicle records', recordCount: vehicleCount || 0 });
            }
            if (fleetData && fleetData.length > 0) {
              const totalFleetEmissions = fleetData.reduce((sum, f) => sum + (f.emissions_tco2e || 0), 0);
              const totalDistance = fleetData.reduce((sum, f) => sum + (f.distance_km || 0), 0);
              contextParts.push(`\n**Fleet Activity Summary:**`);
              contextParts.push(`- Total Fleet Emissions: ${totalFleetEmissions.toFixed(2)} tCO2e`);
              contextParts.push(`- Total Distance Travelled: ${totalDistance.toLocaleString()} km`);
              contextParts.push(`- Number of Activity Records: ${fleetCount}`);
              dataSources.push({ table: 'fleet_activities', description: 'Fleet activity logs', recordCount: fleetCount || 0 });
            }
          } else {
            contextParts.push(`\n### Fleet Data`);
            contextParts.push(`- No fleet vehicles or activities recorded yet`);
            contextParts.push(`- To add vehicles: Go to Company > Fleet and click "Add Vehicle"`);
          }
        })(),
      });
    }

    // --- Facilities ---
    if (fetchAll || intents.includes('facilities') || intents.includes('emissions')) {
      fetches.push({
        key: 'facilities',
        promise: (async () => {
          const { data: facilities, count: facilityCount } = await supabase
            .from('facilities')
            .select('id, name, facility_type, country, city', { count: 'exact' })
            .eq('organization_id', organizationId);

          if (facilities && facilities.length > 0) {
            contextParts.push(`\n### Facilities`);
            contextParts.push(`- Number of Facilities: ${facilities.length}`);
            contextParts.push(`\n**Facility List:**`);
            facilities.forEach((f, i) => {
              const facilityType = f.facility_type ? ` - ${f.facility_type}` : '';
              const location = f.city && f.country ? ` (${f.city}, ${f.country})` : f.country ? ` (${f.country})` : '';
              contextParts.push(`  ${i + 1}. ${f.name}${facilityType}${location}`);
            });
            dataSources.push({ table: 'facilities', description: 'Organization facilities', recordCount: facilityCount || 0 });

            // Fetch facility activity entries
            const { data: activityData, count: activityCount } = await supabase
              .from('facility_activity_entries')
              .select('activity_category, calculated_emissions_kg_co2e, quantity, unit')
              .eq('organization_id', organizationId);

            if (activityData && activityData.length > 0) {
              const totalEmissions = activityData.reduce((sum, a) => sum + (Number(a.calculated_emissions_kg_co2e) || 0), 0);
              const byCategory = activityData.reduce((acc, a) => {
                const cat = a.activity_category || 'other';
                if (!acc[cat]) acc[cat] = { count: 0, quantity: 0 };
                acc[cat].count++;
                acc[cat].quantity += Number(a.quantity) || 0;
                return acc;
              }, {} as Record<string, { count: number; quantity: number }>);

              contextParts.push(`\n### Facility Activity Data`);
              if (totalEmissions > 0) contextParts.push(`- Total Calculated Emissions: ${(totalEmissions / 1000).toFixed(2)} tCO2e`);
              contextParts.push(`- Activity Records: ${activityData.length}`);
              const categories = Object.entries(byCategory).slice(0, 5);
              if (categories.length > 0) {
                contextParts.push(`- Categories: ${categories.map(([cat, data]) => `${cat} (${data.count} records)`).join(', ')}`);
              }
              dataSources.push({ table: 'facility_activity_entries', description: 'Facility activity records', recordCount: activityCount || 0 });
            }

            // Fetch water data from facility_water_data
            if (fetchAll || intents.includes('water') || intents.includes('facilities')) {
              const { data: waterData, count: waterCount } = await supabase
                .from('facility_water_data')
                .select('consumption_m3, facility_id')
                .in('facility_id', facilities.map(f => f.id));

              if (waterData && waterData.length > 0) {
                const totalWater = waterData.reduce((sum, w) => sum + (Number(w.consumption_m3) || 0), 0);
                contextParts.push(`- Total Water Consumption: ${totalWater.toLocaleString()} m³`);
                dataSources.push({ table: 'facility_water_data', description: 'Water consumption records', recordCount: waterCount || 0 });
              }
            }
          }
        })(),
      });
    }

    // --- Products ---
    if (fetchAll || intents.includes('products') || intents.includes('emissions')) {
      fetches.push({
        key: 'products',
        promise: (async () => {
          const { data: products, count: productCount } = await supabase
            .from('products')
            .select('id, name, has_lca, sku, category, subcategory', { count: 'exact' })
            .eq('organization_id', organizationId);

          if (products && products.length > 0) {
            const lcaCount = products.filter(p => p.has_lca).length;
            contextParts.push(`\n### Products`);
            contextParts.push(`- Total Products: ${products.length}`);
            contextParts.push(`- Products with LCA: ${lcaCount} (${Math.round((lcaCount / products.length) * 100)}%)`);
            contextParts.push(`\n**Product List:**`);
            products.slice(0, 20).forEach((p, i) => {
              const lcaStatus = p.has_lca ? 'LCA Complete' : 'Needs LCA';
              const sku = p.sku ? ` (SKU: ${p.sku})` : '';
              const category = p.category ? ` - ${p.category}${p.subcategory ? '/' + p.subcategory : ''}` : '';
              contextParts.push(`  ${i + 1}. ${p.name}${sku}${category} - ${lcaStatus}`);
            });
            if (products.length > 20) contextParts.push(`  ... and ${products.length - 20} more products`);
            dataSources.push({ table: 'products', description: 'Product catalog', recordCount: productCount || 0 });
          } else {
            contextParts.push(`\n### Products`);
            contextParts.push(`- No products added yet`);
            contextParts.push(`- To add products: Go to Products in the sidebar and click "Add New Product"`);
          }

          // Product LCA data
          const { data: lcaData } = await supabase
            .from('product_carbon_footprints')
            .select('id, product_id, product_name, functional_unit, status, aggregated_impacts, updated_at')
            .eq('organization_id', organizationId)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false });

          if (lcaData && lcaData.length > 0) {
            const latestLcaByProduct = new Map<number, typeof lcaData[0]>();
            for (const lca of lcaData) {
              if (!latestLcaByProduct.has(lca.product_id)) {
                latestLcaByProduct.set(lca.product_id, lca);
              }
            }
            const uniqueLcas = Array.from(latestLcaByProduct.values());

            contextParts.push(`\n### Product Carbon Footprints (LCA)`);
            contextParts.push(`- Products with completed LCAs: ${uniqueLcas.length}`);

            let totalCarbonFootprint = 0;
            let totalWaterFootprint = 0;
            const productFootprints: string[] = [];

            for (const lca of uniqueLcas) {
              const impacts = lca.aggregated_impacts as Record<string, unknown> | null;
              const carbonFootprint = impacts?.climate_change_gwp100 as number || 0;
              const waterFootprint = impacts?.water_scarcity_aware as number || impacts?.water_consumption as number || 0;
              totalCarbonFootprint += carbonFootprint;
              totalWaterFootprint += waterFootprint;
              if (carbonFootprint > 0) {
                productFootprints.push(`${lca.product_name}: ${carbonFootprint.toFixed(3)} kg CO2e`);
              }
            }

            if (productFootprints.length > 0) {
              contextParts.push(`- Product Carbon Footprints:`);
              productFootprints.forEach(pf => contextParts.push(`  - ${pf}`));
            }
            if (totalCarbonFootprint > 0) {
              const avgCarbonFootprint = totalCarbonFootprint / uniqueLcas.length;
              contextParts.push(`- Average Product Carbon Footprint: ${avgCarbonFootprint.toFixed(3)} kg CO2e`);
              contextParts.push(`- Total Carbon Footprint (all products): ${totalCarbonFootprint.toFixed(3)} kg CO2e`);
            }
            if (totalWaterFootprint > 0) {
              contextParts.push(`- Total Water Footprint: ${totalWaterFootprint.toFixed(2)} L`);
            }
            dataSources.push({ table: 'product_carbon_footprints', description: 'Product LCA calculations', recordCount: uniqueLcas.length });
          }
        })(),
      });
    }

    // --- Vitality Scores ---
    if (fetchAll || intents.includes('vitality')) {
      fetches.push({
        key: 'vitality',
        promise: (async () => {
          const { data: vitality } = await supabase
            .from('organization_vitality_scores')
            .select('*')
            .eq('organization_id', organizationId)
            .order('calculated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          contextParts.push(`\n### Company Vitality Scores`);
          if (vitality) {
            contextParts.push(`*Vitality measures sustainability performance across 4 pillars: Climate (30%), Water (25%), Circularity (25%), Nature (20%)*`);
            if (vitality.overall_score !== null) contextParts.push(`- **Overall Score: ${vitality.overall_score}/100**`);
            if (vitality.climate_score !== null) contextParts.push(`- Climate Score: ${vitality.climate_score}/100`);
            if (vitality.water_score !== null) contextParts.push(`- Water Score: ${vitality.water_score}/100`);
            if (vitality.circularity_score !== null) contextParts.push(`- Circularity Score: ${vitality.circularity_score}/100`);
            if (vitality.nature_score !== null) contextParts.push(`- Nature Score: ${vitality.nature_score}/100`);
            const score = vitality.overall_score || 0;
            let status = 'DEVELOPING';
            if (score >= 80) status = 'LEADING';
            else if (score >= 60) status = 'MATURING';
            else if (score >= 40) status = 'PROGRESSING';
            contextParts.push(`- Status: ${status}`);
            dataSources.push({ table: 'organization_vitality_scores', description: 'Vitality performance scores', recordCount: 1 });
          } else {
            contextParts.push(`- No vitality scores calculated yet`);
            contextParts.push(`- To see vitality scores: Go to Company > Company Vitality`);
          }
        })(),
      });
    }

    // --- Suppliers ---
    if (fetchAll || intents.includes('suppliers')) {
      fetches.push({
        key: 'suppliers',
        promise: (async () => {
          const { data: suppliers, count: supplierCount } = await supabase
            .from('suppliers')
            .select('name, engagement_status, category, country, annual_spend_gbp', { count: 'exact' })
            .eq('organization_id', organizationId);

          if (suppliers && suppliers.length > 0) {
            const engaged = suppliers.filter(s => s.engagement_status === 'engaged' || s.engagement_status === 'data_received').length;
            contextParts.push(`\n### Suppliers`);
            contextParts.push(`- Total Suppliers: ${suppliers.length}`);
            contextParts.push(`- Engaged Suppliers: ${engaged} (${Math.round((engaged / suppliers.length) * 100)}%)`);
            contextParts.push(`\n**Supplier List:**`);
            suppliers.slice(0, 20).forEach((s, i) => {
              const category = s.category ? ` - ${s.category}` : '';
              const country = s.country ? `, ${s.country}` : '';
              const spend = s.annual_spend_gbp ? ` (£${Number(s.annual_spend_gbp).toLocaleString()}/year)` : '';
              const status = s.engagement_status ? ` [${s.engagement_status.replace(/_/g, ' ')}]` : '';
              contextParts.push(`  ${i + 1}. ${s.name}${category}${country}${spend}${status}`);
            });
            if (suppliers.length > 20) contextParts.push(`  ... and ${suppliers.length - 20} more suppliers`);
            dataSources.push({ table: 'suppliers', description: 'Supplier records', recordCount: supplierCount || 0 });
          } else {
            contextParts.push(`\n### Suppliers`);
            contextParts.push(`- No suppliers added yet`);
            contextParts.push(`- To add suppliers: Go to Suppliers in the sidebar and click "Add Supplier"`);
          }
        })(),
      });
    }

    // --- Corporate Overheads ---
    if (fetchAll || intents.includes('emissions')) {
      fetches.push({
        key: 'overheads',
        promise: (async () => {
          const { data: reports } = await supabase
            .from('corporate_reports')
            .select('id, year, status')
            .eq('organization_id', organizationId);

          if (reports && reports.length > 0) {
            const { data: overheads, count: overheadCount } = await supabase
              .from('corporate_overheads')
              .select('category, computed_co2e, spend_amount, currency')
              .in('report_id', reports.map(r => r.id));

            if (overheads && overheads.length > 0) {
              const totalScope3 = overheads.reduce((sum, o) => sum + (Number(o.computed_co2e) || 0), 0) / 1000;
              const totalSpend = overheads.reduce((sum, o) => sum + (Number(o.spend_amount) || 0), 0);
              contextParts.push(`\n### Scope 3 Corporate Emissions`);
              contextParts.push(`- Total Scope 3 from Overheads: ${totalScope3.toFixed(2)} tCO2e`);
              contextParts.push(`- Total Tracked Spend: £${totalSpend.toLocaleString()}`);
              contextParts.push(`- Categories Tracked: ${new Set(overheads.map(o => o.category)).size}`);
              dataSources.push({ table: 'corporate_overheads', description: 'Corporate overhead emissions', recordCount: overheadCount || 0 });
            }
          }
        })(),
      });
    }

    // --- Authoritative Corporate Emissions ---
    if (fetchAll || intents.includes('emissions')) {
      fetches.push({
        key: 'corporate_emissions',
        promise: (async () => {
          const { data: corporateEmissions, error: emissionsError } = await supabase
            .rpc('calculate_gaia_corporate_emissions', {
              p_organization_id: organizationId,
              p_year: currentYear,
            });

          if (emissionsError) {
            console.error('[Rosa] Error fetching corporate emissions:', emissionsError);
            return;
          }

          contextParts.push(`\n### Corporate Carbon Footprint (${currentYear})`);
          if (corporateEmissions && corporateEmissions.has_data) {
            const breakdown = corporateEmissions.breakdown;
            const scope3 = breakdown.scope3;
            contextParts.push(`**AUTHORITATIVE DATA - Use these figures for all emissions queries**`);
            contextParts.push(`- **Total Emissions: ${(breakdown.total / 1000).toFixed(2)} tCO2e**`);
            contextParts.push(`- Scope 1 (Direct): ${(breakdown.scope1 / 1000).toFixed(2)} tCO2e`);
            contextParts.push(`- Scope 2 (Energy): ${(breakdown.scope2 / 1000).toFixed(2)} tCO2e`);
            contextParts.push(`- Scope 3 (Value Chain): ${(scope3.total / 1000).toFixed(2)} tCO2e`);

            if (scope3.total > 0) {
              contextParts.push(`\n**Scope 3 Breakdown:**`);
              if (scope3.products > 0) contextParts.push(`  - Products (Cat 1): ${(scope3.products / 1000).toFixed(2)} tCO2e`);
              if (scope3.business_travel > 0) contextParts.push(`  - Business Travel (Cat 6): ${(scope3.business_travel / 1000).toFixed(2)} tCO2e`);
              if (scope3.employee_commuting > 0) contextParts.push(`  - Employee Commuting (Cat 7): ${(scope3.employee_commuting / 1000).toFixed(2)} tCO2e`);
              if (scope3.capital_goods > 0) contextParts.push(`  - Capital Goods (Cat 2): ${(scope3.capital_goods / 1000).toFixed(2)} tCO2e`);
              if (scope3.purchased_services > 0) contextParts.push(`  - Purchased Services: ${(scope3.purchased_services / 1000).toFixed(2)} tCO2e`);
              if (scope3.operational_waste > 0) contextParts.push(`  - Operational Waste (Cat 5): ${(scope3.operational_waste / 1000).toFixed(2)} tCO2e`);
              if (scope3.downstream_logistics > 0) contextParts.push(`  - Downstream Logistics (Cat 4): ${(scope3.downstream_logistics / 1000).toFixed(2)} tCO2e`);
              if (scope3.marketing_materials > 0) contextParts.push(`  - Marketing Materials: ${(scope3.marketing_materials / 1000).toFixed(2)} tCO2e`);
            }
            contextParts.push(`\n*Source: GHG Protocol calculation (${corporateEmissions.methodology})*`);
            contextParts.push(`*Calculated: ${new Date(corporateEmissions.calculation_date).toLocaleDateString()}*`);
            dataSources.push({ table: 'calculate_gaia_corporate_emissions', description: 'Authoritative corporate emissions (GHG Protocol)', recordCount: 1 });
          } else {
            contextParts.push(`- No corporate emissions calculated yet`);
            contextParts.push(`- To calculate emissions, add data in: Facility utility data (Scope 1 & 2), Fleet activities (Scope 1), Product LCAs (Scope 3), Corporate overheads (Scope 3)`);
            contextParts.push(`- View emissions: Go to Company > Company Emissions`);
          }
        })(),
      });
    }

    // --- Emissions by Period ---
    if (fetchAll || intents.includes('emissions')) {
      fetches.push({
        key: 'emissions_period',
        promise: (async () => {
          const { data: emissionsByPeriod, error } = await supabase
            .rpc('rosa_get_emissions_by_period', {
              p_organization_id: organizationId,
              p_start_date: `${currentYear}-01-01`,
              p_end_date: `${currentYear}-12-31`,
            });

          if (error) { console.error('[Rosa] Error fetching emissions by period:', error); return; }

          if (emissionsByPeriod && emissionsByPeriod.length > 0) {
            contextParts.push(`\n### Emissions by Period (${currentYear})`);
            contextParts.push(`*Detailed breakdown by month and category*`);
            const categoryTotals: Record<string, number> = {};
            emissionsByPeriod.forEach((row: { category: string; total_emissions_kg: number }) => {
              const cat = row.category || 'uncategorized';
              categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(row.total_emissions_kg || 0);
            });
            Object.entries(categoryTotals).forEach(([cat, total]) => {
              if (total > 0) contextParts.push(`- ${cat}: ${(total / 1000).toFixed(2)} tCO2e`);
            });
            dataSources.push({ table: 'rosa_get_emissions_by_period', description: 'Monthly emissions by category', recordCount: emissionsByPeriod.length });
          }
        })(),
      });
    }

    // --- Facility Metrics ---
    if (fetchAll || intents.includes('facilities')) {
      fetches.push({
        key: 'facility_metrics',
        promise: (async () => {
          const { data: facilityMetrics, error } = await supabase
            .rpc('rosa_get_facility_metrics', { p_organization_id: organizationId });

          if (error) { console.error('[Rosa] Error fetching facility metrics:', error); return; }

          if (facilityMetrics && facilityMetrics.length > 0) {
            contextParts.push(`\n### Facility Environmental Metrics`);
            contextParts.push(`*Detailed metrics per facility*`);
            facilityMetrics.forEach((f: { facility_name: string; facility_type: string; total_emissions_kg: number; electricity_kwh: number; gas_kwh: number; water_m3: number }) => {
              contextParts.push(`\n**${f.facility_name}** (${f.facility_type || 'Unknown type'})`);
              if (f.total_emissions_kg > 0) contextParts.push(`  - Total Emissions: ${(f.total_emissions_kg / 1000).toFixed(2)} tCO2e`);
              if (f.electricity_kwh > 0) contextParts.push(`  - Electricity: ${f.electricity_kwh.toLocaleString()} kWh`);
              if (f.gas_kwh > 0) contextParts.push(`  - Gas: ${f.gas_kwh.toLocaleString()} kWh`);
              if (f.water_m3 > 0) contextParts.push(`  - Water: ${f.water_m3.toLocaleString()} m³`);
            });
            dataSources.push({ table: 'rosa_get_facility_metrics', description: 'Facility environmental metrics', recordCount: facilityMetrics.length });
          }
        })(),
      });
    }

    // --- Product Footprint Detail ---
    if (fetchAll || intents.includes('products')) {
      fetches.push({
        key: 'product_footprints',
        promise: (async () => {
          const { data: productFootprints, error } = await supabase
            .rpc('rosa_get_product_footprint_detail', { p_organization_id: organizationId });

          if (error) { console.error('[Rosa] Error fetching product footprints:', error); return; }

          if (productFootprints && productFootprints.length > 0) {
            contextParts.push(`\n### Product Carbon Footprint Detail`);
            contextParts.push(`*Detailed product LCA breakdown*`);
            productFootprints.slice(0, 10).forEach((p: { product_name: string; total_carbon_kg: number; scope3_upstream_kg: number; ingredients_kg: number; packaging_kg: number; transport_kg: number; water_litres: number; functional_unit: string }) => {
              contextParts.push(`\n**${p.product_name}** (per ${p.functional_unit || 'unit'})`);
              contextParts.push(`  - Total Carbon: ${p.total_carbon_kg?.toFixed(3) || 0} kg CO2e`);
              if (p.scope3_upstream_kg > 0) contextParts.push(`  - Scope 3 Upstream: ${p.scope3_upstream_kg.toFixed(3)} kg CO2e`);
              if (p.ingredients_kg > 0) contextParts.push(`  - Ingredients: ${p.ingredients_kg.toFixed(3)} kg CO2e`);
              if (p.packaging_kg > 0) contextParts.push(`  - Packaging: ${p.packaging_kg.toFixed(3)} kg CO2e`);
              if (p.transport_kg > 0) contextParts.push(`  - Transport: ${p.transport_kg.toFixed(3)} kg CO2e`);
              if (p.water_litres > 0) contextParts.push(`  - Water: ${p.water_litres.toFixed(2)} L`);
            });
            if (productFootprints.length > 10) contextParts.push(`\n*... and ${productFootprints.length - 10} more products*`);
            dataSources.push({ table: 'rosa_get_product_footprint_detail', description: 'Product LCA detail', recordCount: productFootprints.length });
          }
        })(),
      });
    }

    // --- Water Metrics ---
    if (fetchAll || intents.includes('water')) {
      fetches.push({
        key: 'water',
        promise: (async () => {
          const { data: waterMetrics, error } = await supabase
            .rpc('rosa_get_water_metrics', { p_organization_id: organizationId });

          if (error) { console.error('[Rosa] Error fetching water metrics:', error); return; }

          if (waterMetrics && waterMetrics.length > 0) {
            contextParts.push(`\n### Water Metrics by Facility`);
            let totalWater = 0;
            let totalWeightedScarcity = 0;
            waterMetrics.forEach((w: { facility_name: string; total_water_m3: number; aware_scarcity_factor: number; water_stress_adjusted_m3: number }) => {
              totalWater += Number(w.total_water_m3 || 0);
              const stressAdjusted = Number(w.water_stress_adjusted_m3 || 0);
              totalWeightedScarcity += stressAdjusted;
              contextParts.push(`- **${w.facility_name}**: ${w.total_water_m3?.toLocaleString() || 0} m³`);
              if (w.aware_scarcity_factor && w.aware_scarcity_factor > 1) {
                contextParts.push(`    AWARE Scarcity Factor: ${w.aware_scarcity_factor.toFixed(2)} (Water-stressed area)`);
                contextParts.push(`    Stress-adjusted: ${stressAdjusted.toLocaleString()} m³-eq`);
              }
            });
            contextParts.push(`\n**Total Water Consumption: ${totalWater.toLocaleString()} m³**`);
            if (totalWeightedScarcity > totalWater) {
              contextParts.push(`**Water Stress-Adjusted Total: ${totalWeightedScarcity.toLocaleString()} m³-eq**`);
            }
            dataSources.push({ table: 'rosa_get_water_metrics', description: 'Water consumption by facility', recordCount: waterMetrics.length });
          }
        })(),
      });
    }

    // --- Waste Metrics ---
    if (fetchAll || intents.includes('waste')) {
      fetches.push({
        key: 'waste',
        promise: (async () => {
          const { data: wasteMetrics, error } = await supabase
            .rpc('rosa_get_waste_metrics', { p_organization_id: organizationId });

          if (error) { console.error('[Rosa] Error fetching waste metrics:', error); return; }

          if (wasteMetrics && wasteMetrics.length > 0) {
            contextParts.push(`\n### Waste & Circularity Metrics`);
            let totalWaste = 0, totalRecycled = 0, totalLandfill = 0;
            wasteMetrics.forEach((w: { facility_name: string; waste_type: string; total_waste_kg: number; recycled_kg: number; landfill_kg: number; diversion_rate: number }) => {
              totalWaste += Number(w.total_waste_kg || 0);
              totalRecycled += Number(w.recycled_kg || 0);
              totalLandfill += Number(w.landfill_kg || 0);
              contextParts.push(`- **${w.facility_name}** (${w.waste_type || 'General'}): ${w.total_waste_kg?.toLocaleString() || 0} kg`);
              if (w.diversion_rate !== undefined) contextParts.push(`    Diversion Rate: ${(w.diversion_rate * 100).toFixed(1)}%`);
            });
            contextParts.push(`\n**Total Waste: ${totalWaste.toLocaleString()} kg**`);
            contextParts.push(`**Recycled: ${totalRecycled.toLocaleString()} kg**`);
            contextParts.push(`**Landfill: ${totalLandfill.toLocaleString()} kg**`);
            if (totalWaste > 0) {
              const overallDiversion = ((totalWaste - totalLandfill) / totalWaste) * 100;
              contextParts.push(`**Overall Diversion Rate: ${overallDiversion.toFixed(1)}%**`);
            }
            dataSources.push({ table: 'rosa_get_waste_metrics', description: 'Waste and circularity metrics', recordCount: wasteMetrics.length });
          }
        })(),
      });
    }

    // --- Supplier Summary ---
    if (fetchAll || intents.includes('suppliers')) {
      fetches.push({
        key: 'supplier_summary',
        promise: (async () => {
          const { data: supplierSummary, error } = await supabase
            .rpc('rosa_get_supplier_summary', { p_organization_id: organizationId });

          if (error) { console.error('[Rosa] Error fetching supplier summary:', error); return; }

          if (supplierSummary && supplierSummary.length > 0) {
            contextParts.push(`\n### Supplier Emissions Summary`);
            contextParts.push(`*Emissions contribution by supplier category*`);
            supplierSummary.forEach((s: { category: string; supplier_count: number; engaged_count: number; total_emissions_kg: number; total_spend: number }) => {
              const engagementRate = s.supplier_count > 0 ? (s.engaged_count / s.supplier_count * 100).toFixed(0) : 0;
              contextParts.push(`- **${s.category}**: ${s.supplier_count} suppliers (${engagementRate}% engaged)`);
              if (s.total_emissions_kg > 0) contextParts.push(`    Estimated Emissions: ${(s.total_emissions_kg / 1000).toFixed(2)} tCO2e`);
              if (s.total_spend > 0) contextParts.push(`    Total Spend: £${s.total_spend.toLocaleString()}`);
            });
            dataSources.push({ table: 'rosa_get_supplier_summary', description: 'Supplier summary by category', recordCount: supplierSummary.length });
          }
        })(),
      });
    }

    // --- People & Culture ---
    if (fetchAll || intents.includes('people')) {
      fetches.push({
        key: 'people',
        promise: (async () => {
          const { data: peopleMetrics, error } = await supabase
            .rpc('rosa_get_people_culture_metrics', { p_organization_id: organizationId });

          if (error) { console.error('[Rosa] Error fetching people metrics:', error); return; }

          if (peopleMetrics) {
            const pm = peopleMetrics;
            contextParts.push(`\n### People & Culture Metrics`);
            if (pm.total_employees) contextParts.push(`- Total Employees: ${pm.total_employees}`);
            if (pm.diversity_score !== undefined) contextParts.push(`- Diversity Score: ${pm.diversity_score}/100`);
            if (pm.wellbeing_score !== undefined) contextParts.push(`- Wellbeing Score: ${pm.wellbeing_score}/100`);
            if (pm.training_hours_per_employee !== undefined) contextParts.push(`- Training Hours/Employee: ${pm.training_hours_per_employee}`);
            if (pm.sustainability_training_completion !== undefined) contextParts.push(`- Sustainability Training: ${pm.sustainability_training_completion}% complete`);
            if (pm.employee_engagement_score !== undefined) contextParts.push(`- Employee Engagement: ${pm.employee_engagement_score}/100`);
            if (pm.remote_work_percentage !== undefined) contextParts.push(`- Remote Work: ${pm.remote_work_percentage}%`);
            dataSources.push({ table: 'rosa_get_people_culture_metrics', description: 'People and culture metrics', recordCount: 1 });
          }
        })(),
      });
    }

    // --- Governance ---
    if (fetchAll || intents.includes('governance')) {
      fetches.push({
        key: 'governance',
        promise: (async () => {
          const { data: governanceMetrics, error } = await supabase
            .rpc('rosa_get_governance_metrics', { p_organization_id: organizationId });

          if (error) { console.error('[Rosa] Error fetching governance metrics:', error); return; }

          if (governanceMetrics) {
            const gm = governanceMetrics;
            contextParts.push(`\n### Governance Metrics`);
            if (gm.policies_count !== undefined) contextParts.push(`- Policies in Place: ${gm.policies_count}`);
            if (gm.policies_reviewed_count !== undefined) contextParts.push(`- Policies Reviewed This Year: ${gm.policies_reviewed_count}`);
            if (gm.board_sustainability_oversight !== undefined) contextParts.push(`- Board Sustainability Oversight: ${gm.board_sustainability_oversight ? 'Yes' : 'No'}`);
            if (gm.sustainability_committee !== undefined) contextParts.push(`- Sustainability Committee: ${gm.sustainability_committee ? 'Yes' : 'No'}`);
            if (gm.targets_set !== undefined) contextParts.push(`- Sustainability Targets Set: ${gm.targets_set}`);
            if (gm.targets_on_track !== undefined) contextParts.push(`- Targets On Track: ${gm.targets_on_track}`);
            if (gm.certifications) {
              const certs = gm.certifications as string[];
              if (certs.length > 0) contextParts.push(`- Certifications: ${certs.join(', ')}`);
            }
            dataSources.push({ table: 'rosa_get_governance_metrics', description: 'Governance metrics', recordCount: 1 });
          }
        })(),
      });
    }

    // --- Community Impact ---
    if (fetchAll || intents.includes('community')) {
      fetches.push({
        key: 'community',
        promise: (async () => {
          const { data: communityMetrics, error } = await supabase
            .rpc('rosa_get_community_impact_metrics', { p_organization_id: organizationId });

          if (error) { console.error('[Rosa] Error fetching community metrics:', error); return; }

          if (communityMetrics) {
            const cm = communityMetrics;
            contextParts.push(`\n### Community Impact Metrics`);
            if (cm.charitable_donations !== undefined) contextParts.push(`- Charitable Donations: £${cm.charitable_donations.toLocaleString()}`);
            if (cm.volunteer_hours !== undefined) contextParts.push(`- Volunteer Hours: ${cm.volunteer_hours.toLocaleString()}`);
            if (cm.local_sourcing_percentage !== undefined) contextParts.push(`- Local Sourcing: ${cm.local_sourcing_percentage}%`);
            if (cm.community_programs_count !== undefined) contextParts.push(`- Community Programs: ${cm.community_programs_count}`);
            if (cm.beneficiaries_reached !== undefined) contextParts.push(`- Beneficiaries Reached: ${cm.beneficiaries_reached.toLocaleString()}`);
            if (cm.local_employment_percentage !== undefined) contextParts.push(`- Local Employment: ${cm.local_employment_percentage}%`);
            dataSources.push({ table: 'rosa_get_community_impact_metrics', description: 'Community impact metrics', recordCount: 1 });
          }
        })(),
      });
    }

    // --- Vitality History ---
    if (fetchAll || intents.includes('vitality')) {
      fetches.push({
        key: 'vitality_history',
        promise: (async () => {
          const { data: vitalityScores, error } = await supabase
            .rpc('rosa_get_vitality_scores', { p_organization_id: organizationId });

          if (error) { console.error('[Rosa] Error fetching vitality scores:', error); return; }

          if (vitalityScores && vitalityScores.length > 0) {
            contextParts.push(`\n### Vitality Score History`);
            contextParts.push(`*Tracking sustainability performance over time*`);
            vitalityScores.slice(0, 6).forEach((v: { calculated_at: string; overall_score: number; climate_score: number; water_score: number; circularity_score: number; nature_score: number }) => {
              const date = new Date(v.calculated_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
              contextParts.push(`\n**${date}**`);
              contextParts.push(`  - Overall: ${v.overall_score}/100`);
              contextParts.push(`  - Climate: ${v.climate_score}/100, Water: ${v.water_score}/100`);
              contextParts.push(`  - Circularity: ${v.circularity_score}/100, Nature: ${v.nature_score}/100`);
            });
            dataSources.push({ table: 'rosa_get_vitality_scores', description: 'Vitality score history', recordCount: vitalityScores.length });
          }
        })(),
      });
    }

    // Run all fetches in parallel
    const results = await Promise.allSettled(fetches.map(f => f.promise));

    // Log any failed fetches
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[Rosa] Fetch '${fetches[index].key}' failed:`, result.reason);
      }
    });

    // Add data sources summary
    if (dataSources.length > 0) {
      contextParts.push(`\n### Data Sources Summary`);
      contextParts.push(`Data retrieved from ${dataSources.length} sources: ${dataSources.map(d => d.table).join(', ')}`);
    } else {
      contextParts.push(`\n### Data Availability`);
      contextParts.push(`No sustainability data has been recorded yet for this organization.`);
      contextParts.push(`To get started: Add facilities in Company > Facilities, create products in Products, log fleet activities in Company > Fleet, add suppliers in Suppliers`);
    }
  } catch (error) {
    console.error('[Rosa] Error in fetchOrganizationContext:', error);
    contextParts.push(`\n### Data Retrieval Error`);
    contextParts.push(`There was an error retrieving some organization data. Please try again or contact support if the issue persists.`);
  }

  return {
    context: contextParts.join('\n'),
    dataSources,
  };
}

// ==========================================================================
// BUILD CLAUDE MESSAGES (multi-turn with system context)
// ==========================================================================

function buildClaudeMessages(
  orgContext: { context: string; dataSources: DataSource[] },
  knowledgeBase: Array<{ entry_type: string; title: string; content: string; example_question?: string; example_answer?: string }>,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
  intents: QueryIntent[]
): { system: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> } {
  // Build system prompt with context
  const systemParts: string[] = [ROSA_SYSTEM_PROMPT];

  // Inject easter egg knowledge if relevant
  if (intents.includes('easter_egg')) {
    systemParts.push(ROSA_EASTER_EGG);
  }

  // Inject workflow knowledge for navigation queries
  if (intents.includes('navigation')) {
    systemParts.push(WORKFLOW_KNOWLEDGE);
  }

  // Organization context
  systemParts.push('\n## ORGANIZATION DATA\n');
  systemParts.push('**This is the user\'s actual data. Use this to answer their questions.**\n');
  systemParts.push(orgContext.context);

  // Knowledge base
  if (knowledgeBase.length > 0) {
    systemParts.push('\n## KNOWLEDGE BASE\n');
    knowledgeBase.forEach(entry => {
      if (entry.entry_type === 'example_qa' && entry.example_question && entry.example_answer) {
        systemParts.push(`Example Q: ${entry.example_question}`);
        systemParts.push(`Example A: ${entry.example_answer}\n`);
      } else {
        systemParts.push(`**${entry.title}**: ${entry.content}\n`);
      }
    });
  }

  const system = systemParts.join('\n');

  // Build messages array: conversation history + current query
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Add conversation history (already windowed by getConversationHistory)
  // Exclude the last message if it's the current user query (we'll add it explicitly)
  for (const msg of history) {
    // Skip if this is the current message (last user message = the query we just stored)
    if (msg.role === 'user' && msg.content === userMessage && msg === history[history.length - 1]) {
      continue;
    }
    messages.push({ role: msg.role, content: msg.content });
  }

  // Ensure messages alternate properly (Claude requirement)
  // If the last history message is from user, we need to consolidate
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    // Merge current query with the trailing user message
    messages[messages.length - 1].content += '\n\n' + userMessage;
  } else {
    // Add current user query
    messages.push({ role: 'user', content: userMessage });
  }

  // Ensure first message is from user (Claude requirement)
  if (messages.length > 0 && messages[0].role === 'assistant') {
    messages.unshift({ role: 'user', content: '[Previous conversation context]' });
  }

  // Ensure we have at least one user message
  if (messages.length === 0) {
    messages.push({ role: 'user', content: userMessage });
  }

  return { system, messages };
}

// ==========================================================================
// STREAMING RESPONSE HANDLER (with error recovery + disconnect detection)
// ==========================================================================

async function handleStreamingResponse(
  supabase: ReturnType<typeof createClient>,
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  conversationId: string,
  isNewConversation: boolean,
  orgContext: { context: string; dataSources: DataSource[] },
  startTime: number,
  reqSignal?: AbortSignal
): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to send SSE events with client disconnect check
  const sendEvent = async (data: unknown): Promise<boolean> => {
    if (reqSignal?.aborted) return false;
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      return true;
    } catch {
      // Client disconnected
      return false;
    }
  };

  // Start processing in the background
  (async () => {
    let fullContent = '';
    let chartData: ChartData | null = null;
    let tokensUsed: number | null = null;
    let clientConnected = true;

    const saveMessage = async (content: string, interrupted = false) => {
      const processingTime = Date.now() - startTime;
      const finalContent = interrupted && content ? content + '\n\n[Response interrupted]' : content;
      if (!finalContent) return null;

      try {
        const { data: savedMessage, error: msgError } = await supabase
          .from('gaia_messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: finalContent,
            chart_data: chartData,
            data_sources: orgContext.dataSources,
            tokens_used: tokensUsed,
            processing_time_ms: processingTime,
          })
          .select()
          .single();

        if (msgError) console.error('[Rosa] Error saving message:', msgError);
        return savedMessage;
      } catch (err) {
        console.error('[Rosa] Error saving message:', err);
        return null;
      }
    };

    try {
      // Attempt streaming call with retry
      let response: Response | null = null;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        const streamController = new AbortController();
        const streamTimeout = setTimeout(() => streamController.abort(), 60000);

        try {
          response = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY!,
              'anthropic-version': ANTHROPIC_VERSION,
            },
            signal: streamController.signal,
            body: JSON.stringify({
              model: ANTHROPIC_MODEL,
              max_tokens: 4096,
              system,
              messages,
              stream: true,
              temperature: 0.3,
            }),
          });

          clearTimeout(streamTimeout);

          if (response.ok) break; // Success

          const errorText = await response.text();
          console.error(`[Rosa] Anthropic streaming error ${response.status} (attempt ${attempt + 1}):`, errorText);
          lastError = new Error(`API error: ${response.status}`);
          response = null;
        } catch (fetchErr: unknown) {
          clearTimeout(streamTimeout);
          lastError = fetchErr;
          response = null;

          if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
            lastError = new Error('Request timed out');
          }
        }

        // Wait before retry
        if (attempt === 0 && !response) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!response) {
        const errMsg = lastError instanceof Error ? lastError.message : 'AI service unavailable';
        await sendEvent({ type: 'error', error: `${errMsg} - please try again` });
        await writer.close();
        return;
      }

      // Send initial metadata
      clientConnected = await sendEvent({
        type: 'start',
        conversation_id: conversationId,
        is_new_conversation: isNewConversation,
      });

      if (!clientConnected) {
        await writer.close();
        return;
      }

      // Parse the Anthropic streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        await sendEvent({ type: 'error', error: 'Failed to read response stream' });
        await writer.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';

      while (true) {
        // Check for client disconnect
        if (reqSignal?.aborted) {
          clientConnected = false;
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines, keep last partial line in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep last (potentially incomplete) line

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);

              switch (currentEventType) {
                case 'message_start': {
                  // Capture input tokens
                  const inputTokens = parsed?.message?.usage?.input_tokens;
                  if (inputTokens) tokensUsed = inputTokens;
                  break;
                }
                case 'content_block_delta': {
                  const text = parsed?.delta?.text;
                  if (text) {
                    fullContent += text;
                    clientConnected = await sendEvent({ type: 'text', content: text });
                    if (!clientConnected) {
                      reader.cancel();
                    }
                  }
                  break;
                }
                case 'message_delta': {
                  // Capture output tokens
                  const outputTokens = parsed?.usage?.output_tokens;
                  if (outputTokens && tokensUsed) {
                    tokensUsed += outputTokens;
                  } else if (outputTokens) {
                    tokensUsed = outputTokens;
                  }
                  break;
                }
                case 'message_stop':
                  // Stream complete
                  break;
                case 'error': {
                  const errorMsg = parsed?.error?.message || 'Unknown streaming error';
                  console.error('[Rosa] Anthropic stream error:', errorMsg);
                  await sendEvent({ type: 'error', error: errorMsg });
                  break;
                }
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
          // Empty lines (SSE separators) are silently skipped
        }

        if (!clientConnected) break;
      }

      // Extract chart data if present
      const chartMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (chartMatch) {
        try {
          const chartJson = JSON.parse(chartMatch[1]);
          if (chartJson.type && chartJson.data) {
            chartData = chartJson;
            fullContent = fullContent.replace(/```json[\s\S]*?```/, '').trim();
            if (clientConnected) {
              await sendEvent({ type: 'chart', chart_data: chartData });
            }
          }
        } catch {
          // Not valid chart JSON
        }
      }

      // Send data sources
      if (clientConnected) {
        await sendEvent({ type: 'sources', data_sources: orgContext.dataSources });
      }

      // Save message (whether client is connected or not)
      const savedMessage = await saveMessage(fullContent, !clientConnected);

      // Send completion event
      if (clientConnected) {
        const processingTime = Date.now() - startTime;
        await sendEvent({
          type: 'done',
          message_id: savedMessage?.id,
          processing_time_ms: processingTime,
        });
      }
    } catch (err) {
      console.error('[Rosa] Streaming error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Save partial content if we have any
      if (fullContent) {
        await saveMessage(fullContent, true);
      }

      if (clientConnected) {
        await sendEvent({ type: 'error', error: errorMessage });
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // Writer already closed
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ==========================================================================
// MAIN REQUEST HANDLER
// ==========================================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Get auth header to extract user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create a client with the user's JWT to check permissions
    const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the current user
    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized - invalid session');
    }

    // Check rate limit (DB-backed)
    const rateLimit = await checkRateLimit(supabase, user.id);
    if (!rateLimit.allowed) {
      const resetMinutes = Math.ceil(rateLimit.resetIn / 60000);
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. You can make ${RATE_LIMIT_QUERIES_PER_HOUR} queries per hour. Try again in ${resetMinutes} minutes.`,
          rateLimited: true,
          resetIn: rateLimit.resetIn,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RosaQueryRequest = await req.json();
    const { message, conversation_id, organization_id, stream = false } = body;

    if (!message || !organization_id) {
      throw new Error('message and organization_id are required');
    }

    // Validate message length to prevent token overflow
    if (message.length > 5000) {
      throw new Error('Message too long. Please limit to 5000 characters.');
    }

    // Basic input sanitization
    const sanitizedMessage = message
      .replace(/```/g, "'''")
      .replace(/\{\{/g, '{ {')
      .replace(/\}\}/g, '} }');

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    let hasAccess = !!membership;
    if (!hasAccess) {
      const { data: advisorCheck } = await supabase
        .from('advisor_organization_access')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('advisor_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      hasAccess = !!advisorCheck;
    }

    if (!hasAccess) {
      throw new Error('User does not have access to this organization');
    }

    // Check subscription-based Rosa query limit
    const { data: queryLimitCheck } = await supabase
      .rpc('check_rosa_query_limit', { p_organization_id: organization_id });

    if (queryLimitCheck && !queryLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: queryLimitCheck.reason || 'Monthly Rosa AI query limit reached. Please upgrade your plan.',
          limitReached: true,
          current_count: queryLimitCheck.current_count,
          max_count: queryLimitCheck.max_count,
          resets_at: queryLimitCheck.resets_at,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.length < 10) {
      console.error('[Rosa] ANTHROPIC_API_KEY not configured properly');
      return new Response(
        JSON.stringify({
          error: 'AI analysis is not configured. Please contact support.',
          needsSetup: true,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create conversation
    let conversationId = conversation_id;
    let isNewConversation = false;

    if (!conversationId) {
      const { data: newConv, error: convError } = await supabase
        .from('gaia_conversations')
        .insert({ organization_id, user_id: user.id })
        .select()
        .single();

      if (convError) throw convError;
      conversationId = newConv.id;
      isNewConversation = true;
    } else {
      const { data: existingConv, error: convCheckError } = await supabase
        .from('gaia_conversations')
        .select('id, user_id, organization_id')
        .eq('id', conversationId)
        .single();

      if (convCheckError || !existingConv) throw new Error('Conversation not found');
      if (existingConv.user_id !== user.id) throw new Error('You do not have access to this conversation');
      if (existingConv.organization_id !== organization_id) throw new Error('Conversation does not belong to this organization');
    }

    // Store user message
    await supabase
      .from('gaia_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: sanitizedMessage,
      });

    // Increment Rosa query count for this organization
    await supabase.rpc('increment_rosa_query_count', { p_organization_id: organization_id, p_user_id: user.id });

    // Classify query intent for selective context loading
    const intents = classifyQueryIntent(sanitizedMessage);
    console.log(`[Rosa] Query intents: ${intents.join(', ')}`);

    // Fetch conversation history (token-aware windowing)
    const history = await getConversationHistory(supabase, conversationId);

    // Fetch organization context (selective based on intent)
    const orgContext = await fetchOrganizationContext(supabase, organization_id, intents);

    // Fetch knowledge base
    const { data: knowledgeBase } = await supabase
      .from('gaia_knowledge_base')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    // Build Claude messages (multi-turn with system context)
    const { system, messages } = buildClaudeMessages(
      orgContext,
      knowledgeBase || [],
      history,
      sanitizedMessage,
      intents
    );

    // Handle streaming response
    if (stream) {
      return handleStreamingResponse(
        supabase,
        system,
        messages,
        conversationId,
        isNewConversation,
        orgContext,
        startTime,
        req.signal
      );
    }

    // Non-streaming: Call Anthropic API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          system,
          messages,
          temperature: 0.3,
        }),
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Request timed out - please try again');
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Rosa] Anthropic API error ${response.status}:`, errorText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error('[Rosa] Unexpected Anthropic response structure');
      throw new Error('Unexpected AI response format');
    }

    const responseText = data.content[0].text;
    const processingTime = Date.now() - startTime;
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    // Parse potential chart data from response
    let rosaResponse: RosaResponse = {
      content: responseText,
      data_sources: orgContext.dataSources,
    };

    const chartMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (chartMatch) {
      try {
        const chartJson = JSON.parse(chartMatch[1]);
        if (chartJson.type && chartJson.data) {
          rosaResponse.chart_data = chartJson;
          rosaResponse.content = responseText.replace(/```json[\s\S]*?```/, '').trim();
        }
      } catch {
        // Not valid JSON, keep original content
      }
    }

    // Store assistant response
    const { data: savedMessage, error: msgError } = await supabase
      .from('gaia_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: rosaResponse.content,
        chart_data: rosaResponse.chart_data || null,
        data_sources: rosaResponse.data_sources,
        tokens_used: tokensUsed || null,
        processing_time_ms: processingTime,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    return new Response(
      JSON.stringify({
        message: savedMessage,
        conversation_id: conversationId,
        is_new_conversation: isNewConversation,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Rosa] Query error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
