// READ-ONLY verification: replicate loadProcurementDashboard aggregations + the
// brand-detail confidence gate against the seeded Foodbuy data. Proves the portal
// will render correctly without needing an authenticated browser session.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const FOODBUY = '73267946-829a-4bd1-bc6d-8214a0c10984'

const { data: skus } = await db.from('procurement_skus')
  .select('brand_directory_id, source_distributor_org_id, category, country_of_origin, volume_per_year_liters, channel_label')
  .eq('procurement_org_id', FOODBUY).eq('listing_status', 'active')

const brandIds = [...new Set(skus.map((s) => s.brand_directory_id))]
const { data: dirs } = await db.from('brand_directory')
  .select('id,name,country_of_origin,category,sustainability_score,completeness_score,score_tier,alkatera_org_id')
  .in('id', brandIds)
const dById = new Map(dirs.map((d) => [d.id, d]))
const { data: distros } = await db.from('distributor_organizations').select('id,name').in('id', [...new Set(skus.map(s=>s.source_distributor_org_id))])
const distName = new Map(distros.map((d) => [d.id, d.name]))

// tiers
const tiers = {}
for (const s of skus) { const t = dById.get(s.brand_directory_id)?.score_tier ?? 'unknown'; tiers[t] = (tiers[t]||new Set()); tiers[t].add(s.brand_directory_id) }
// channels
const ch = {}
for (const s of skus) { const k = distName.get(s.source_distributor_org_id) ?? s.channel_label; ch[k] = ch[k]||{sku:0,vol:0,br:new Set()}; ch[k].sku++; ch[k].vol+=s.volume_per_year_liters||0; ch[k].br.add(s.brand_directory_id) }
// per-brand agg
const agg = new Map()
for (const s of skus) { const e = agg.get(s.brand_directory_id)||{sku:0,vol:0}; e.sku++; e.vol+=s.volume_per_year_liters||0; agg.set(s.brand_directory_id,e) }
const summaries = [...agg.entries()].map(([id,v])=>{const d=dById.get(id);return{name:d.name,alk:!!d.alkatera_org_id,score:d.sustainability_score,compl:d.completeness_score,tier:d.score_tier,...v}})
const wins = summaries.filter(b=>(b.score??0)>0).sort((a,b)=>b.score-a.score).slice(0,5)
const gaps = summaries.map(b=>({...b,gap:b.vol*(100-(b.compl??0))})).filter(b=>(b.compl??100)<75).sort((a,b)=>b.gap-a.gap).slice(0,5)
const coverage = Math.round(summaries.reduce((a,b)=>a+(b.compl??0),0)/summaries.length*10)/10

console.log('=== TOTALS ===')
console.log(`SKUs ${skus.length} | Brands ${brandIds.length} | Channels ${Object.keys(ch).length} | Coverage ${coverage}% | Leaders ${tiers.leader?.size??0}`)
console.log('\n=== TIER DISTRIBUTION (brands) ===')
for (const [t,set] of Object.entries(tiers)) console.log(`  ${t}: ${set.size}`)
console.log('\n=== CHANNELS ===')
for (const [k,v] of Object.entries(ch)) console.log(`  ${k}: ${v.sku} SKUs, ${v.vol.toLocaleString()} L, ${v.br.size} brands`)
console.log('\n=== TOP WINS ===')
for (const w of wins) console.log(`  ${w.name.padEnd(22)} score ${w.score} ${w.alk?'[alkatera]':''}`)
console.log('\n=== TOP GAPS (volume-weighted) ===')
for (const g of gaps) console.log(`  ${g.name.padEnd(22)} coverage ${g.compl}% vol ${g.vol.toLocaleString()} L`)
console.log('\n=== CATEGORIES ===')
const cat = {}; for (const s of skus) cat[s.category||'?']=(cat[s.category||'?']||0)+1
console.log('  '+Object.entries(cat).map(([k,v])=>`${k}:${v}`).join('  '))

// RLS access check: procurement_has_access_to_brand must be TRUE for every brand,
// else the logged-in procurement user sees no findings (needs brand_profiles).
console.log('\n=== RLS ACCESS (procurement_has_access_to_brand) ===')
let blocked = 0
for (const d of dirs) {
  const { data: ok } = await db.rpc('procurement_has_access_to_brand', { p_procurement_org_id: FOODBUY, p_brand_directory_id: d.id })
  if (ok !== true) { blocked++; console.log(`  BLOCKED: ${d.name}`) }
}
console.log(blocked === 0 ? `  All ${dirs.length} brands accessible to the procurement user.` : `  ${blocked} BLOCKED (would show empty!)`)

// Pillar coverage for a contrasting alkatera vs scraped brand
const PILLAR = {
  carbon_intensity_kgco2e_per_litre:'Climate',scope_1_tco2e:'Climate',scope_2_tco2e:'Climate',scope_3_tco2e:'Climate',net_zero_target_year:'Climate',sbt_status:'Climate',lca_verified:'Climate',renewable_energy_percentage:'Climate',carbon_trust_certified:'Climate',iwca_member:'Climate',porto_protocol_signatory:'Climate',epd_published:'Climate',carbon_negative_claim:'Climate',
  water_usage_litres_per_litre:'Water',water_recycled_percentage:'Water',water_scarcity_m3eq_per_litre:'Water',water_stress_region:'Water',
  recycled_packaging_percentage:'Circularity',packaging_primary_material:'Circularity',packaging_recyclability_score:'Circularity',packaging_end_of_life:'Circularity',
  land_use_m2a_per_litre:'Nature',freshwater_eutrophication_per_litre:'Nature',terrestrial_acidification_per_litre:'Nature',nature_positive_hectares:'Nature',nature_action_type:'Nature',tnfd_dependencies_assessed:'Nature',organic_certified:'Nature',organic_percentage:'Nature',rainforest_alliance_certified:'Nature',
  living_wage_compliance_percentage:'Social',gender_pay_gap_median_percentage:'Social',employee_wellbeing_score:'Social',community_investment_gbp:'Social',supplier_esg_coverage_percentage:'Social',fairtrade_certified:'Social',
  bcorp_certified:'Governance',iso_14001_certified:'Governance',iso_50001_certified:'Governance',governance_transparency_score:'Governance',governance_board_score:'Governance',governance_policy_score:'Governance',sustainability_report_year:'Governance',sustainability_report_url:'Governance',parent_company:'Governance',
}
for (const name of ['Maison Clairval','Peroni Nastro Azzurro']) {
  const d = dirs.find((x)=>x.name===name); if(!d) continue
  const { data: F } = await db.from('scraped_brand_data').select('field_key,confidence,source_name').eq('brand_directory_id', d.id)
  const visible = F.filter(f=>f.source_name==='brand_verified'||f.source_name==='alkatera_live'||(f.confidence??0)>=0.6)
  const byP = {}; for (const f of visible){ const p=PILLAR[f.field_key]||'Other'; byP[p]=(byP[p]||0)+1 }
  console.log(`\n=== ${name}: ${F.length} findings, ${visible.length} visible (${F.length-visible.length} hidden) ===`)
  console.log('  pillars: '+Object.entries(byP).map(([k,v])=>`${k}:${v}`).join('  '))
}
