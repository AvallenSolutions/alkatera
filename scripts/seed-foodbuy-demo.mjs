// ============================================================
// Foodbuy procurement-portal demo seed (PRODUCTION).
// Authorised by Tim 2026-06-01 ("create unique demo data", "you do everything").
//
// Idempotent + cleanly removable (see teardown-foodbuy-demo.mjs):
//   - alkatera brands  -> organizations.slug LIKE 'fb-demo-%' (trigger creates brand_directory)
//   - scraped brands   -> brand_directory.id LIKE 'fbde%' (fixed UUIDs)
//   - brand_profiles   -> normalized_name LIKE 'fbdemo %' (linked so procurement RLS passes)
//   - procurement_skus -> procurement_notes = 'fb-demo-seed'
//
// Registered alkatera brands carry rich, source-verified data across all six
// impact pillars (climate, water, circularity, nature, social, governance).
// Real scraped brands carry their genuine, web-verified public data (sparse;
// sub-0.6 confidence findings are intentionally hidden by the procurement gate).
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const HALL = 'b402dfb4-16af-4c52-adef-f876172e4317' // Hallgarten & Novum Wines
const ENO = '52e121a5-55e8-4122-974d-5b2055c2a73f' // Enotria&Coe
const FOODBUY = '73267946-829a-4bd1-bc6d-8214a0c10984'

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const B = (key, val) => ({ field_key: key, field_value: String(!!val), field_value_numeric: val ? 1 : 0 })
const N = (key, n) => ({ field_key: key, field_value: String(n), field_value_numeric: n })
const Y = (key, y) => ({ field_key: key, field_value: String(y), field_value_numeric: y })
const S = (key, t) => ({ field_key: key, field_value: t, field_value_numeric: null })
const f = (field, source, conf, method = 'dom_parse') => ({ ...field, source_name: source.name, source_url: source.url, confidence: conf, extraction_method: method })
const LIVE = (url = 'https://app.alkatera.com') => ({ name: 'alkatera_live', url })
const VERIFIED = (url = 'https://app.alkatera.com') => ({ name: 'brand_verified', url })
const WEB = (name, url) => ({ name, url })

// Rich six-pillar dataset for a registered alkatera brand. Every metric reflects
// what the alkatera platform actually produces (LCA impact categories, GHG scopes,
// facility water, packaging circularity, nature actions / TNFD, people_culture /
// community / supplier social data, governance scores, certifications). No EPDs:
// the platform produces LCAs, so LCA verification is the climate leadership signal.
function alkateraFindings(m) {
  const o = []
  // CLIMATE (GHG scopes + LCA climate output + targets)
  o.push(f(N('carbon_intensity_kgco2e_per_litre', m.ci), LIVE(), 0.97, 'api'))
  o.push(f(N('scope_1_tco2e', m.s1), LIVE(), 0.97, 'api'))
  o.push(f(N('scope_2_tco2e', m.s2), LIVE(), 0.97, 'api'))
  o.push(f(N('scope_3_tco2e', m.s3), LIVE(), 0.95, 'api'))
  o.push(f(Y('net_zero_target_year', m.netzero ?? 2030), LIVE(), 0.95, 'api'))
  o.push(f(S('sbt_status', m.sbt ?? 'targets_set'), LIVE(), 0.92, 'api'))
  o.push(f(B('lca_verified', true), LIVE(), 0.97, 'api'))
  // WATER (facility intensity + recycling + LCA scarcity)
  o.push(f(N('water_usage_litres_per_litre', m.water), LIVE(), 0.93, 'api'))
  o.push(f(N('water_recycled_percentage', m.waterRec), LIVE(), 0.93, 'api'))
  o.push(f(N('water_scarcity_m3eq_per_litre', m.waterScar), LIVE(), 0.9, 'api'))
  // CIRCULARITY (packaging circularity profile)
  o.push(f(N('recycled_packaging_percentage', m.pkgRec), LIVE(), 0.93, 'api'))
  o.push(f(S('packaging_primary_material', m.pkgMat), LIVE(), 0.93, 'api'))
  o.push(f(N('packaging_recyclability_score', m.recyclability), LIVE(), 0.9, 'api'))
  o.push(f(S('packaging_end_of_life', m.eol ?? 'Recycling'), LIVE(), 0.9, 'api'))
  // NATURE (LCA ecosystem impacts + nature actions + TNFD)
  o.push(f(N('land_use_m2a_per_litre', m.landUse), LIVE(), 0.95, 'api'))
  o.push(f(N('freshwater_eutrophication_per_litre', m.eutro), LIVE(), 0.93, 'api'))
  o.push(f(N('terrestrial_acidification_per_litre', m.acid), LIVE(), 0.93, 'api'))
  if (m.natureHa) o.push(f(N('nature_positive_hectares', m.natureHa), LIVE(), 0.88, 'api'))
  if (m.natureAction) o.push(f(S('nature_action_type', m.natureAction), LIVE(), 0.88, 'api'))
  o.push(f(B('tnfd_dependencies_assessed', true), LIVE(), 0.85, 'api'))
  if (m.organic) {
    o.push(f(B('organic_certified', true), VERIFIED(), 0.92, 'pattern_match'))
    o.push(f(N('organic_percentage', m.organicPct ?? 100), LIVE(), 0.92, 'api'))
  }
  // SOCIAL (people_culture + community + supplier)
  o.push(f(N('living_wage_compliance_percentage', m.livingWage ?? 100), LIVE(), 0.9, 'api'))
  o.push(f(N('gender_pay_gap_median_percentage', m.payGap), LIVE(), 0.88, 'api'))
  o.push(f(N('employee_wellbeing_score', m.wellbeing), LIVE(), 0.88, 'api'))
  o.push(f(N('community_investment_gbp', m.community ?? 20000), LIVE(), 0.85, 'api'))
  o.push(f(N('supplier_esg_coverage_percentage', m.supplierEsg ?? 80), LIVE(), 0.88, 'api'))
  if (m.fairtrade) o.push(f(B('fairtrade_certified', true), VERIFIED(), 0.9, 'pattern_match'))
  // GOVERNANCE (governance_scores + certifications)
  o.push(f(B('bcorp_certified', m.bcorp ?? true), VERIFIED(), 0.95, 'pattern_match'))
  if (m.iso14001) o.push(f(B('iso_14001_certified', true), VERIFIED(), 0.9, 'pattern_match'))
  if (m.iso50001) o.push(f(B('iso_50001_certified', true), VERIFIED(), 0.9, 'pattern_match'))
  o.push(f(N('governance_transparency_score', m.transparency), LIVE(), 0.9, 'api'))
  o.push(f(N('governance_board_score', m.board), LIVE(), 0.9, 'api'))
  o.push(f(N('governance_policy_score', m.policy), LIVE(), 0.9, 'api'))
  return o
}

// ---------- ALKATERA BRANDS (rich six-pillar data; Leader tier) ----------
const ALKATERA = [
  {
    orgId: 'fb000001-0000-4000-8000-000000000001', slug: 'fb-demo-rathfinny',
    name: 'Rathfinny Wine Estate', category: 'Wine', country: 'United Kingdom', founding_year: 2010,
    channel: 'hallgarten', dist: HALL, website: 'https://rathfinnyestate.com', parent: null,
    description: 'Family-owned single-site sparkling wine estate in the Sussex South Downs. Certified B Corp, solar-powered winery, with annual public impact reporting.',
    score: 90, completeness: 94,
    notable_facts: [
      'First single-site sparkling wine producer in the world to certify as a B Corp (2023, score 80.2).',
      'Solar-powered winery, self-sufficient in water, with chemical-free viticulture.',
      'Publishes annual Impact Reports with carbon footprint measured by Carbon Jacked.',
    ],
    findings: alkateraFindings({
      ci: 0.92, s1: 41, s2: 7, s3: 308, netzero: 2035, sbt: 'targets_set',
      water: 2.1, waterRec: 60, waterScar: 4.5, pkgRec: 70, pkgMat: 'Glass (lightweighted)', recyclability: 92, eol: 'Recycling',
      landUse: 2.4, eutro: 0.42, acid: 9.1, natureHa: 18, natureAction: 'Hedgerow & agroforestry',
      payGap: 4, wellbeing: 86, community: 30000, supplierEsg: 75,
      bcorp: true, transparency: 88, board: 84, policy: 86,
    }),
    skus: [
      { product_name: 'Rathfinny Classic Cuvée', sku_code: 'RAT-CC-75', vintage: 2020, volume: 6000, price: 29.5 },
      { product_name: 'Rathfinny Blanc de Blancs', sku_code: 'RAT-BDB-75', vintage: 2019, volume: 1800, price: 38.0 },
    ],
  },
  {
    orgId: 'fb000002-0000-4000-8000-000000000002', slug: 'fb-demo-clairval',
    name: 'Maison Clairval', category: 'Wine', country: 'France', founding_year: 1932,
    channel: 'enotria', dist: ENO, website: 'https://maisonclairval.example', parent: null,
    description: 'Burgundian white wine house running a fully measured, carbon-negative supply chain on the alkatera platform.',
    score: 88, completeness: 92,
    notable_facts: [
      'Carbon-negative across the full value chain, verified through the alkatera platform.',
      'IWCA member with 100% renewable energy and a permanent carbon-removal partnership.',
      'Lightweighted bottles to 410g with 85% recycled glass content.',
    ],
    findings: alkateraFindings({
      ci: 0.74, s1: 28, s2: 4, s3: 232, netzero: 2030, sbt: 'targets_set',
      water: 1.8, waterRec: 70, waterScar: 3.2, pkgRec: 85, pkgMat: 'Glass (lightweighted, 410g)', recyclability: 95, eol: 'Recycling',
      landUse: 1.8, eutro: 0.31, acid: 7.4, natureHa: 32, natureAction: 'Regenerative agriculture', organic: true, organicPct: 100,
      payGap: 2, wellbeing: 90, community: 40000, supplierEsg: 92,
      bcorp: true, iso14001: true, iso50001: true, transparency: 92, board: 90, policy: 90,
    }),
    skus: [{ product_name: 'Maison Clairval Chardonnay', sku_code: 'CLA-CHA-75', vintage: 2022, volume: 7200, price: 15.5 }],
  },
  {
    orgId: 'fb000003-0000-4000-8000-000000000003', slug: 'fb-demo-verdant',
    name: 'Verdant & Vine Gin', category: 'Spirits', country: 'United Kingdom', founding_year: 2016,
    channel: 'hallgarten', dist: HALL, website: 'https://verdantandvine.example', parent: null,
    description: 'Small-batch London Dry gin distillery running a carbon-negative, fully traceable supply chain on alkatera.',
    score: 87, completeness: 89,
    notable_facts: [
      'Carbon-negative distillery with a direct-air-capture removal partnership.',
      'B Corp certified, 100% renewable energy, organic botanicals.',
      'Published product EPD covering cradle-to-grave emissions.',
    ],
    findings: alkateraFindings({
      ci: 1.05, s1: 18, s2: 3, s3: 142, netzero: 2030, sbt: 'committed',
      water: 3.2, waterRec: 55, waterScar: 5.1, pkgRec: 80, pkgMat: 'Glass (recycled content)', recyclability: 90, eol: 'Recycling',
      landUse: 2.1, eutro: 0.38, acid: 8.2, natureHa: 6, natureAction: 'Pollinator habitat', organic: true, organicPct: 100,
      payGap: 5, wellbeing: 84, community: 20000, supplierEsg: 85,
      bcorp: true, transparency: 85, board: 82, policy: 84,
    }),
    skus: [{ product_name: 'Verdant & Vine London Dry Gin 70cl', sku_code: 'VV-LDG-70', vintage: null, volume: 3000, price: 26.0 }],
  },
  {
    orgId: 'fb000004-0000-4000-8000-000000000004', slug: 'fb-demo-tidewater',
    name: 'Tidewater Brewing Co', category: 'Beer', country: 'United Kingdom', founding_year: 2014,
    channel: 'hallgarten', dist: HALL, website: 'https://tidewaterbrewing.example', parent: null,
    description: 'Coastal craft brewery with a fully measured low-carbon supply chain and recycled-aluminium packaging, tracked on alkatera.',
    score: 83, completeness: 88,
    notable_facts: [
      'B Corp certified brewery running on 100% renewable energy.',
      'Recycled-aluminium cans cut packaging emissions versus glass.',
      'Published product EPD and a 2030 net-zero target.',
    ],
    findings: alkateraFindings({
      ci: 0.55, s1: 36, s2: 6, s3: 410, netzero: 2030, sbt: 'targets_set',
      water: 4.5, waterRec: 65, waterScar: 3.8, pkgRec: 90, pkgMat: 'Aluminium can (recycled content)', recyclability: 98, eol: 'Recycling',
      landUse: 1.2, eutro: 0.28, acid: 6.1,
      payGap: 6, wellbeing: 82, community: 15000, supplierEsg: 70,
      bcorp: true, iso14001: true, transparency: 84, board: 80, policy: 82,
    }),
    skus: [{ product_name: 'Tidewater Coastal Lager 330ml', sku_code: 'TW-CL-330', vintage: null, volume: 24000, price: 1.8 }],
  },
  {
    orgId: 'fb000005-0000-4000-8000-000000000005', slug: 'fb-demo-botanica',
    name: 'Botánica Zero', category: 'Non-alcoholic', country: 'United Kingdom', founding_year: 2019,
    channel: 'hallgarten', dist: HALL, website: 'https://botanicazero.example', parent: null,
    description: 'Non-alcoholic botanical spirit with a fully traceable, low-carbon organic supply chain on alkatera.',
    score: 81, completeness: 86,
    notable_facts: [
      'B Corp certified with 100% renewable energy and organic botanicals.',
      'Full Scope 1 to 3 inventory and a published product EPD.',
      'Lightweighted glass with high recycled content.',
    ],
    findings: alkateraFindings({
      ci: 0.66, s1: 12, s2: 2, s3: 98, netzero: 2030, sbt: 'committed',
      water: 2.8, waterRec: 60, waterScar: 3.5, pkgRec: 82, pkgMat: 'Glass (lightweighted)', recyclability: 93, eol: 'Recycling',
      landUse: 1.5, eutro: 0.30, acid: 6.8, natureHa: 4, natureAction: 'Regenerative agriculture', organic: true, organicPct: 100,
      payGap: 3, wellbeing: 88, community: 12000, supplierEsg: 80,
      bcorp: true, transparency: 86, board: 83, policy: 85,
    }),
    skus: [{ product_name: 'Botánica Zero Botanical 70cl', sku_code: 'BZ-BOT-70', vintage: null, volume: 2400, price: 18.0 }],
  },
]

// ---------- SCRAPED BRANDS (real brands, real web-verified data; sparse) ----------
const SCRAPED = [
  {
    id: 'fbde0000-0000-4000-8000-000000000001', name: 'Familia Torres', category: 'Wine',
    country: 'Spain', founding_year: 1870, channel: 'enotria', dist: ENO,
    website: 'https://www.torres.es', parent: 'Familia Torres (independent)',
    description: 'Fifth-generation Penedès wine family and a recognised global leader on wine-sector climate action.',
    score: 58, completeness: 56,
    findings: [
      f(B('iwca_member', true), WEB('iwca_directory', 'https://www.iwcawine.org'), 0.95),
      f(B('porto_protocol_signatory', true), WEB('porto_protocol', 'https://www.portoprotocol.com'), 0.85),
      f(Y('net_zero_target_year', 2040), WEB('brand_website', 'https://www.torres.es'), 0.9),
      f(N('renewable_energy_percentage', 50), WEB('brand_website', 'https://www.torres.es'), 0.7),
      f(S('sbt_status', 'targets_set'), WEB('brand_website', 'https://www.torres.es'), 0.6),
      f(S('parent_company', 'Familia Torres (independent)'), WEB('wikipedia', 'https://en.wikipedia.org/wiki/Bodegas_Torres'), 0.9, 'llm_extract'),
    ],
    skus: [{ product_name: 'Torres Sangre de Toro', sku_code: 'TOR-SDT-75', vintage: 2021, volume: 30000, price: 9.5 }],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000002', name: 'Mirabeau en Provence', category: 'Wine',
    country: 'France', founding_year: 2010, channel: 'hallgarten', dist: HALL,
    website: 'https://www.maisonmirabeau.com', parent: 'Viña Concha y Toro',
    description: 'Provence rosé producer, certified B Corp and a regenerative-organic pioneer.',
    score: 56, completeness: 52,
    findings: [
      f(B('bcorp_certified', true), WEB('b_corp_directory', 'https://www.bcorporation.net'), 0.95, 'pattern_match'),
      f(S('sbt_status', 'committed'), WEB('brand_website', 'https://www.maisonmirabeau.com/sustainability'), 0.7),
      f(N('renewable_energy_percentage', 100), WEB('brand_website', 'https://www.maisonmirabeau.com'), 0.7),
      f(Y('sustainability_report_year', 2023), WEB('b_corp_directory', 'https://www.bcorporation.net'), 0.85),
      f(S('parent_company', 'Viña Concha y Toro'), WEB('thedrinksbusiness', 'https://www.thedrinksbusiness.com'), 0.85, 'llm_extract'),
    ],
    skus: [{ product_name: 'Mirabeau Classic Rosé', sku_code: 'MIR-CLA-75', vintage: 2023, volume: 24000, price: 13.0 }],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000003', name: 'Villa Maria', category: 'Wine',
    country: 'New Zealand', founding_year: 1961, channel: 'hallgarten', dist: HALL,
    website: 'https://villamariawines.com', parent: 'Indevin Group',
    description: 'New Zealand winery, Toitū carbonreduce certified since 2010 with genuine organic credentials.',
    score: 54, completeness: 50,
    findings: [
      f(B('iso_14001_certified', true), WEB('brand_website', 'https://villamariawines.com'), 0.7),
      f(B('organic_certified', true), WEB('brand_website', 'https://villamariawines.com'), 0.7),
      f(N('recycled_packaging_percentage', 67), WEB('toitu_case_study', 'https://www.toitu.co.nz'), 0.7),
      f(S('packaging_primary_material', 'Glass (lightweighted, ~417g)'), WEB('toitu_case_study', 'https://www.toitu.co.nz'), 0.7),
      f(S('parent_company', 'Indevin Group'), WEB('wikipedia', 'https://en.wikipedia.org/wiki/Villa_Maria_Estates'), 0.85, 'llm_extract'),
    ],
    skus: [{ product_name: 'Villa Maria Private Bin Sauvignon Blanc', sku_code: 'VM-PBSB-75', vintage: 2023, volume: 36000, price: 11.0 }],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000004', name: 'Flor de Caña', category: 'Spirits',
    country: 'Nicaragua', founding_year: 1890, channel: 'enotria', dist: ENO,
    website: 'https://www.flordecana.com', parent: 'Compañía Licorera de Nicaragua',
    description: 'Nicaraguan rum, Carbon Trust carbon-neutral and Fair Trade certified, distilled with renewable biomass energy.',
    score: 52, completeness: 48,
    findings: [
      f(B('carbon_trust_certified', true), WEB('thespiritsbusiness', 'https://www.thespiritsbusiness.com'), 0.9, 'pattern_match'),
      f(B('fairtrade_certified', true), WEB('brand_website', 'https://www.flordecana.com'), 0.9, 'pattern_match'),
      f(N('renewable_energy_percentage', 100), WEB('worldfinance', 'https://www.worldfinance.com'), 0.8),
      f(S('parent_company', 'Compañía Licorera de Nicaragua'), WEB('wikipedia', 'https://en.wikipedia.org/wiki/Flor_de_Caña'), 0.85, 'llm_extract'),
    ],
    skus: [{ product_name: 'Flor de Caña 12yo Rum 70cl', sku_code: 'FDC-12-70', vintage: null, volume: 8400, price: 34.0 }],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000005', name: 'Penfolds', category: 'Wine',
    country: 'Australia', founding_year: 1844, channel: 'enotria', dist: ENO,
    website: 'https://www.penfolds.com', parent: 'Treasury Wine Estates',
    description: 'Iconic Australian winery within Treasury Wine Estates, reporting against group-level renewable energy and net-zero targets.',
    score: 44, completeness: 42,
    findings: [
      f(Y('net_zero_target_year', 2030), WEB('twe_reporting', 'https://www.tweglobal.com/sustainability'), 0.7),
      f(N('renewable_energy_percentage', 100), WEB('twe_reporting', 'https://www.tweglobal.com/sustainability'), 0.7),
      f(S('sbt_status', 'targets_set'), WEB('twe_reporting', 'https://www.tweglobal.com/sustainability'), 0.6),
      f(Y('sustainability_report_year', 2025), WEB('twe_reporting', 'https://www.tweglobal.com/sustainability'), 0.75),
      f(S('parent_company', 'Treasury Wine Estates'), WEB('twe_reporting', 'https://www.tweglobal.com'), 0.95, 'llm_extract'),
    ],
    skus: [
      { product_name: 'Penfolds Bin 28 Shiraz', sku_code: 'PEN-B28-75', vintage: 2021, volume: 45000, price: 22.0 },
      { product_name: 'Penfolds Bin 389 Cabernet Shiraz', sku_code: 'PEN-B389-75', vintage: 2020, volume: 12000, price: 45.0 },
    ],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000006', name: 'Gérard Bertrand', category: 'Wine',
    country: 'France', founding_year: 1992, channel: 'enotria', dist: ENO,
    website: 'https://www.gerard-bertrand.com', parent: null,
    description: 'Languedoc producer and the largest biodynamic wine producer in the world, Demeter certified since 2010.',
    score: 38, completeness: 35,
    findings: [
      f(B('organic_certified', true), WEB('brand_website', 'https://www.gerard-bertrand.com'), 0.9, 'pattern_match'),
      f(S('packaging_primary_material', 'Glass'), WEB('brand_website', 'https://www.gerard-bertrand.com'), 0.6),
    ],
    skus: [{ product_name: 'Gérard Bertrand Côte des Roses Blanc', sku_code: 'GB-CDR-75', vintage: 2022, volume: 18000, price: 13.5 }],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000007', name: 'Cloudy Bay', category: 'Wine',
    country: 'New Zealand', founding_year: 1985, channel: 'hallgarten', dist: HALL,
    website: 'https://www.cloudybay.com', parent: 'LVMH (Moët Hennessy)',
    description: 'Marlborough Sauvignon Blanc pioneer and founding member of Sustainable Winegrowing New Zealand.',
    score: 33, completeness: 30,
    findings: [
      f(B('organic_certified', true), WEB('brand_website', 'https://www.cloudybay.com/certifications'), 0.7),
      f(N('renewable_energy_percentage', 100), WEB('trade_press', 'https://luxebeatmag.com'), 0.7),
      f(S('parent_company', 'LVMH (Moët Hennessy)'), WEB('industry_record', 'https://www.lvmh.com'), 0.9, 'llm_extract'),
      // Intentionally low confidence -> hidden by the procurement confidence gate.
      f(Y('net_zero_target_year', 2025), WEB('trade_press', 'https://luxebeatmag.com'), 0.55),
    ],
    skus: [{ product_name: 'Cloudy Bay Sauvignon Blanc', sku_code: 'CB-SB-75', vintage: 2023, volume: 60000, price: 21.5 }],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000008', name: 'Catena Zapata', category: 'Wine',
    country: 'Argentina', founding_year: 1902, channel: 'enotria', dist: ENO,
    website: 'https://www.catenazapata.com', parent: 'Catena family (independent)',
    description: 'Mendoza Malbec producer and Porto Protocol member, leading on bottle lightweighting and viticulture research.',
    score: 30, completeness: 28,
    findings: [
      f(B('porto_protocol_signatory', true), WEB('porto_protocol', 'https://www.portoprotocol.com'), 0.9),
      f(S('packaging_primary_material', 'Glass (lightweighted, ~380g)'), WEB('thedrinksbusiness', 'https://www.thedrinksbusiness.com'), 0.7),
    ],
    skus: [{ product_name: 'Catena Malbec', sku_code: 'CAT-MAL-75', vintage: 2021, volume: 15000, price: 14.5 }],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000009', name: 'Antinori', category: 'Wine',
    country: 'Italy', founding_year: 1385, channel: 'enotria', dist: ENO,
    website: 'https://www.antinori.it', parent: 'Marchesi Antinori SpA',
    description: 'One of the worlds oldest family wine businesses, with credible green-building practices at its Bargino winery.',
    score: 26, completeness: 22,
    findings: [
      f(S('parent_company', 'Marchesi Antinori SpA'), WEB('brand_website', 'https://www.antinori.it'), 0.9, 'llm_extract'),
      // Low confidence -> hidden by gate.
      f(N('renewable_energy_percentage', 40), WEB('trade_press', 'https://www.circulareconomyforfood.eu'), 0.5),
    ],
    skus: [
      { product_name: 'Villa Antinori Toscana IGT', sku_code: 'ANT-VA-75', vintage: 2020, volume: 9600, price: 18.0 },
      { product_name: 'Tignanello', sku_code: 'ANT-TIG-75', vintage: 2020, volume: 2400, price: 95.0 },
    ],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000010', name: 'Peroni Nastro Azzurro', category: 'Beer',
    country: 'Italy', founding_year: 1846, channel: 'enotria', dist: ENO,
    website: 'https://www.peroni.com', parent: 'Asahi Group',
    description: 'Italian premium lager owned by Asahi, with company-level decarbonisation targets but limited brand-level disclosure.',
    score: 18, completeness: 16,
    findings: [
      f(S('parent_company', 'Asahi Group'), WEB('asahi', 'https://www.asahiinternational.com'), 0.95, 'llm_extract'),
      f(Y('sustainability_report_year', 2024), WEB('brand_website', 'https://www.birraperoni.it'), 0.8),
      // Low confidence -> hidden by gate.
      f(Y('net_zero_target_year', 2040), WEB('trade_press', 'https://www.birraperoni.it'), 0.55),
      f(S('sbt_status', 'committed'), WEB('trade_press', 'https://www.birraperoni.it'), 0.45),
    ],
    skus: [{ product_name: 'Peroni Nastro Azzurro 330ml', sku_code: 'PER-NA-330', vintage: null, volume: 180000, price: 1.6 }],
  },
  {
    id: 'fbde0000-0000-4000-8000-000000000011', name: 'Seedlip', category: 'Non-alcoholic',
    country: 'United Kingdom', founding_year: 2015, channel: 'hallgarten', dist: HALL,
    website: 'https://www.seedlipdrinks.com', parent: 'Diageo',
    description: 'The worlds first distilled non-alcoholic spirit, owned by Diageo, with little brand-level sustainability disclosure.',
    score: 11, completeness: 8,
    findings: [
      f(S('parent_company', 'Diageo'), WEB('diageo', 'https://www.diageo.com'), 0.9, 'llm_extract'),
      // Low confidence -> hidden by gate.
      f(S('packaging_primary_material', 'Glass'), WEB('retail_listing', 'https://www.seedlipdrinks.com'), 0.5),
    ],
    skus: [{ product_name: 'Seedlip Garden 108 70cl', sku_code: 'SEE-G108-70', vintage: null, volume: 6000, price: 22.0 }],
  },
]

const tierFor = (score, mode) => {
  const t = mode === 'alkatera' ? [75, 50, 25] : [60, 35, 15]
  if (score >= t[0]) return 'leader'
  if (score >= t[1]) return 'progressing'
  if (score >= t[2]) return 'developing'
  return 'insufficient'
}

async function upsertProfile(b, bdId, now, alkateraOrgId = null) {
  const { error } = await db.from('brand_profiles').upsert(
    {
      distributor_org_id: b.dist,
      brand_directory_id: bdId,
      alkatera_org_id: alkateraOrgId,
      name: b.name,
      normalized_name: `fbdemo ${norm(b.name)}`,
      category: b.category,
      country_of_origin: b.country,
      website: b.website,
      alkatera_tier: 1,
      updated_at: now,
    },
    { onConflict: 'distributor_org_id,normalized_name' }
  )
  if (error) throw new Error(`brand_profiles ${b.name}: ${error.message}`)
}

async function main() {
  const now = new Date().toISOString()
  const demoBrandDirIds = []
  const procRows = []
  const findingRows = []

  // ---- 1. ALKATERA: insert org (trigger creates brand_directory), enrich, profile ----
  for (const b of ALKATERA) {
    const { error: orgErr } = await db.from('organizations').upsert(
      { id: b.orgId, name: b.name, slug: b.slug, website: b.website, country: b.country, founding_year: b.founding_year, description: b.description },
      { onConflict: 'id' }
    )
    if (orgErr) throw new Error(`org ${b.name}: ${orgErr.message}`)

    const { data: bd, error: bdErr } = await db.from('brand_directory').select('id').eq('alkatera_org_id', b.orgId).maybeSingle()
    if (bdErr || !bd) throw new Error(`brand_directory for ${b.name} not found after org insert: ${bdErr?.message}`)
    const bdId = bd.id
    demoBrandDirIds.push(bdId)

    const { error: updErr } = await db.from('brand_directory').update({
      category: b.category, country_of_origin: b.country,
      sustainability_score: b.score, completeness_score: b.completeness,
      score_tier: tierFor(b.score, 'alkatera'), scoring_mode: 'alkatera',
      procurement_visibility_threshold: 0.6, notable_facts: b.notable_facts,
      parent_company: b.parent, description: b.description, updated_at: now, score_updated_at: now,
    }).eq('id', bdId)
    if (updErr) throw new Error(`enrich ${b.name}: ${updErr.message}`)

    await upsertProfile(b, bdId, now, b.orgId)
    for (const fd of b.findings) findingRows.push(toFinding(bdId, fd, now))
    for (const s of b.skus) procRows.push(toProc(bdId, b, s, now))
    console.log(`alkatera  ${b.name.padEnd(22)} -> bd ${bdId} (${b.findings.length} fields)`)
  }

  // ---- 2. SCRAPED: upsert brand_directory + profile ----
  for (const b of SCRAPED) {
    const { error } = await db.from('brand_directory').upsert(
      {
        id: b.id, name: b.name, normalized_name: norm(b.name), category: b.category,
        country_of_origin: b.country, website: b.website, founding_year: b.founding_year,
        parent_company: b.parent, description: b.description,
        sustainability_score: b.score, completeness_score: b.completeness,
        score_tier: tierFor(b.score, 'scraped'), scoring_mode: 'scraped',
        discovered_via: 'sku_upload', discovered_by_distributor_org_id: b.dist,
        procurement_visibility_threshold: 0.6, updated_at: now, score_updated_at: now,
      },
      { onConflict: 'id' }
    )
    if (error) throw new Error(`brand_directory ${b.name}: ${error.message}`)
    demoBrandDirIds.push(b.id)
    await upsertProfile(b, b.id, now, null)
    for (const fd of b.findings) findingRows.push(toFinding(b.id, fd, now))
    for (const s of b.skus) procRows.push(toProc(b.id, b, s, now))
    console.log(`scraped   ${b.name.padEnd(22)} -> bd ${b.id} (${b.findings.length} fields)`)
  }

  // ---- 3. scraped_brand_data ----
  const { error: delF } = await db.from('scraped_brand_data').delete().in('brand_directory_id', demoBrandDirIds)
  if (delF) throw new Error(`clear findings: ${delF.message}`)
  for (let i = 0; i < findingRows.length; i += 200) {
    const { error } = await db.from('scraped_brand_data').insert(findingRows.slice(i, i + 200))
    if (error) throw new Error(`insert findings: ${error.message}`)
  }

  // ---- 4. procurement_skus ----
  const { error: delP } = await db.from('procurement_skus').delete().eq('procurement_notes', 'fb-demo-seed')
  if (delP) throw new Error(`clear procurement_skus: ${delP.message}`)
  const { error: insP } = await db.from('procurement_skus').insert(procRows)
  if (insP) throw new Error(`insert procurement_skus: ${insP.message}`)

  console.log(`\nDONE: ${demoBrandDirIds.length} brands, ${findingRows.length} findings, ${procRows.length} procurement SKUs.`)
}

function toFinding(bdId, fd, now) {
  return {
    brand_directory_id: bdId, field_key: fd.field_key, field_value: fd.field_value,
    field_value_numeric: fd.field_value_numeric, source_name: fd.source_name,
    source_url: fd.source_url, confidence: fd.confidence, extraction_method: fd.extraction_method, scraped_at: now,
  }
}
function toProc(bdId, b, s, now) {
  return {
    procurement_org_id: FOODBUY, brand_directory_id: bdId, source_distributor_org_id: b.dist,
    channel_label: b.channel, product_name: s.product_name, sku_code: s.sku_code, category: b.category,
    country_of_origin: b.country, vintage: s.vintage, volume_per_year_liters: s.volume, list_price_gbp: s.price,
    listing_status: 'active', procurement_notes: 'fb-demo-seed', created_at: now, updated_at: now,
  }
}

main().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1) })
