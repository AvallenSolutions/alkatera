/**
 * Integration tests against a LIVE local Supabase (real schema, real SQL, the
 * two new columns). Seeds a throwaway org, exercises the actual service
 * functions end-to-end, asserts, then cascades cleanup. Skipped unless the local
 * service-role creds are provided, so a bare `vitest run` never hits a DB.
 *
 * Run with:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<local key> \
 *   npx vitest run lib/hospitality/__tests__/hospitality-integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  createRecipe,
  updateRecipe,
  getRecipe,
  listRecipes,
  listUnconfirmedRecipes,
  setRecipeQuantities,
} from '@/lib/hospitality/recipe-service'
import { createMenu, addMenuItem, publishMenu, getPublicMenu } from '@/lib/hospitality/menu-service'
import { createVolume } from '@/lib/hospitality/volume-service'
import { calculateHospitality } from '@/lib/calculations/hospitality-emissions'
import { deriveRoomAllocation } from '@/lib/hospitality/room-allocation-derive'
import { createOperatingPeriod, computeIntensity } from '@/lib/hospitality/operating-service'
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds'
import { HOSPITALITY_KINDS } from '@/lib/hospitality/constants'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LIVE = Boolean(URL && KEY)

const ORG = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const FAC = 'dddddddd-dddd-dddd-dddd-ddddddddd0fa'
const VENUE = 'dddddddd-dddd-dddd-dddd-ddddddddd0e0'
const YEAR_START = '2026-01-01'
const YEAR_END = '2026-12-31'

let db: SupabaseClient
let mealId: number
let roomId: number

async function cleanup(admin: SupabaseClient) {
  const { data: products } = await admin.from('products').select('id').eq('organization_id', ORG)
  const ids = (products ?? []).map((p: any) => p.id)
  if (ids.length > 0) {
    await admin.from('product_materials').delete().in('product_id', ids)
    await admin.from('hospitality_room_allocation').delete().in('product_id', ids)
  }
  await admin.from('product_carbon_footprints').delete().eq('organization_id', ORG)
  await admin.from('hospitality_operating_periods').delete().eq('organization_id', ORG)
  await admin.from('hospitality_service_volumes').delete().eq('organization_id', ORG)
  await admin.from('hospitality_waste').delete().eq('organization_id', ORG)
  await admin.from('hospitality_menu_items').delete().eq('organization_id', ORG)
  await admin.from('hospitality_menus').delete().eq('organization_id', ORG)
  await admin.from('hospitality_meal_meta').delete().eq('organization_id', ORG)
  await admin.from('products').delete().eq('organization_id', ORG)
  await admin.from('hospitality_venues').delete().eq('organization_id', ORG)
  await admin.from('facility_activity_entries').delete().eq('organization_id', ORG)
  await admin.from('utility_data_entries').delete().eq('facility_id', FAC)
  await admin.from('facilities').delete().eq('organization_id', ORG)
  await admin.from('organizations').delete().eq('id', ORG)
}

describe.skipIf(!LIVE)('hospitality integration (live local Supabase)', () => {
  beforeAll(async () => {
    db = createClient(URL!, KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    await cleanup(db)

    await db.from('organizations').insert({ id: ORG, name: 'Integration Test Co', slug: `int-test-${ORG.slice(0, 8)}` })
    await db.from('facilities').insert({ id: FAC, organization_id: ORG, name: 'Test Kitchen' })
    await db.from('hospitality_venues').insert({
      id: VENUE, organization_id: ORG, name: 'Test Restaurant', venue_type: 'restaurant', facility_id: FAC, status: 'active',
    })

    // Meal: 4 covers, prep waste 10%, gas hob 30 min.
    const meal = await createRecipe(db, ORG, null as any, RECIPE_KINDS.meal, { name: 'Beef ragù', covers: 4, venue_id: VENUE })
    if (!meal.ok) throw new Error(`createRecipe failed: ${(meal as any).error}`)
    mealId = meal.data.id
    const upd = await updateRecipe(db, ORG, RECIPE_KINDS.meal, String(mealId), {
      prep_waste_pct: 10, cooking_method: 'hob_gas', cooking_minutes: 30,
      dietary_tags: ['vegetarian'], allergens: ['milk', 'gluten'],
    })
    if (!upd.ok) throw new Error(`updateRecipe failed: ${(upd as any).error}`)

    await db.from('product_materials').insert({ product_id: mealId, material_name: 'Beef mince', quantity: 600, unit: 'g', material_type: 'ingredient' })
    await db.from('product_carbon_footprints').insert({
      organization_id: ORG, product_id: mealId, product_name: 'Beef ragù', functional_unit: '1 recipe', reference_year: 2026,
      status: 'completed', aggregated_impacts: { climate_change_gwp100: 40, water_consumption: 8, land_use: 20, breakdown: { by_scope: { scope3: 40 } } },
    })
    const vol = await createVolume(db, ORG, { product_id: mealId, units_sold: 100, period_start: YEAR_START, period_end: YEAR_END })
    if (!vol.ok) throw new Error(`createVolume failed: ${(vol as any).error}`)

    // Covers + revenue for the intensity KPIs.
    const op = await createOperatingPeriod(db, ORG, { period_start: YEAR_START, period_end: YEAR_END, covers: 5000, fnb_revenue: 100000, currency: 'GBP' })
    if (!op.ok) throw new Error(`createOperatingPeriod failed: ${(op as any).error}`)

    // Room-night product + facility utilities + 1000 room-nights for the derive test.
    const room = await createRecipe(db, ORG, null as any, RECIPE_KINDS.room_night, { name: 'Standard room', covers: 1, venue_id: VENUE })
    if (!room.ok) throw new Error(`createRecipe (room) failed: ${(room as any).error}`)
    roomId = room.data.id
    await db.from('product_carbon_footprints').insert({
      organization_id: ORG, product_id: roomId, product_name: 'Standard room', functional_unit: '1 room night', reference_year: 2026,
      status: 'completed', aggregated_impacts: { climate_change_gwp100: 3, breakdown: { by_scope: { scope3: 3 } } },
    })
    await db.from('utility_data_entries').insert([
      { facility_id: FAC, utility_type: 'electricity_grid', quantity: 12000, unit: 'kWh', reporting_period_start: YEAR_START, reporting_period_end: YEAR_END, calculated_scope: 'Scope 2' },
      { facility_id: FAC, utility_type: 'natural_gas', quantity: 6000, unit: 'kWh', reporting_period_start: YEAR_START, reporting_period_end: YEAR_END, calculated_scope: 'Scope 1' },
    ])
    await db.from('facility_activity_entries').insert({
      facility_id: FAC, organization_id: ORG, activity_category: 'water_intake', activity_date: YEAR_START,
      reporting_period_start: YEAR_START, reporting_period_end: YEAR_END, quantity: 500, unit: 'm3',
    })
    await db.from('hospitality_service_volumes').insert({ organization_id: ORG, product_id: roomId, period_start: YEAR_START, period_end: YEAR_END, units_sold: 1000 })
  }, 30000)

  afterAll(async () => {
    if (db) await cleanup(db)
  })

  it('rolls hospitality into Scope 3 with the prep-waste uplift, excluding cooking', async () => {
    const r = await calculateHospitality(db, ORG, YEAR_START, YEAR_END)
    // meal: scope3 40 * prep 1.1 / covers 4 * units 100 = 1100. Cooking is display-only.
    expect(r.food).toBeCloseTo(1100, 4)
    // room: scope3 3 / covers 1 * units 1000 = 3000 → supplies.
    expect(r.supplies).toBeCloseTo(3000, 4)
    expect(r.waste).toBe(0)
    expect(r.total).toBeCloseTo(4100, 4)
  })

  it('computes throughput-weighted embodied water and land', async () => {
    const r = await calculateHospitality(db, ORG, YEAR_START, YEAR_END)
    // meal water 8 * prep 1.1 / 4 covers * 100 units = 220 m³ (room PCF has no water)
    expect(r.water_m3).toBeCloseTo(220, 4)
    expect(r.land_m2).toBeCloseTo(550, 4)
  })

  it('computes carbon-intensity KPIs from covers, revenue and room-nights', async () => {
    const totals = await calculateHospitality(db, ORG, YEAR_START, YEAR_END)
    const i = await computeIntensity(db, ORG, YEAR_START, YEAR_END, { total: totals.total, supplies: totals.supplies })
    expect(i.covers).toBe(5000)
    expect(i.fnb_revenue).toBe(100000)
    expect(i.room_nights).toBeCloseTo(1000, 4)
    expect(i.per_cover).toBeCloseTo(4100 / 5000, 6)      // 0.82 kg/cover
    expect(i.per_revenue).toBeCloseTo(4100 / 100000, 6)  // 0.041 kg/£
    expect(i.per_room_night).toBeCloseTo(3000 / 1000, 6) // room supplies ÷ nights = 3
  })

  it('surfaces cooking energy in the per-cover DISPLAY figure only', async () => {
    const recipes = await listRecipes(db, ORG, RECIPE_KINDS.meal)
    if (!recipes.ok) throw new Error((recipes as any).error)
    const meal = (recipes.data as any[]).find((x) => x.id === mealId)
    expect(meal).toBeTruthy()
    // ingredients per cover = 40 * 1.1 / 4 = 11
    expect(meal.impact.per_cover_co2e).toBeCloseTo(11, 4)
    // hob_gas 3kW * 0.5h = 1.5 kWh * 0.18293 = 0.274395 kg total / 4 covers
    expect(meal.impact.per_cover_cooking_co2e).toBeCloseTo((3 * 0.5 * 0.18293) / 4, 5)
    expect(meal.impact.per_cover_display_co2e).toBeCloseTo(11 + (3 * 0.5 * 0.18293) / 4, 5)
    expect(meal.quantities_status).toBe('confirmed')
  })

  it('persists and reads back the cooking + prep-waste fields', async () => {
    const r = await getRecipe(db, ORG, RECIPE_KINDS.meal, String(mealId))
    if (!r.ok) throw new Error((r as any).error)
    const d = r.data as any
    expect(d.cooking_method).toBe('hob_gas')
    expect(Number(d.cooking_minutes)).toBe(30)
    expect(Number(d.prep_waste_pct)).toBe(10)
  })

  it('rejects invalid cooking method and out-of-range prep waste', async () => {
    const bad1 = await updateRecipe(db, ORG, RECIPE_KINDS.meal, String(mealId), { cooking_method: 'nope' })
    expect(bad1.ok).toBe(false)
    const bad2 = await updateRecipe(db, ORG, RECIPE_KINDS.meal, String(mealId), { prep_waste_pct: 150 })
    expect(bad2.ok).toBe(false)
  })

  it('keeps hospitality products out of the drinks product list but in the hospitality set', async () => {
    const { data: drinks } = await db.from('products').select('id').eq('organization_id', ORG).eq('product_kind', 'product')
    expect((drinks ?? []).some((p: any) => p.id === mealId)).toBe(false)
    const { data: hosp } = await db.from('products').select('id').eq('organization_id', ORG).in('product_kind', HOSPITALITY_KINDS as unknown as string[])
    expect((hosp ?? []).some((p: any) => p.id === mealId)).toBe(true)
  })

  it('serves a public menu with server-resolved bands that honour org thresholds', async () => {
    const menu = await createMenu(db, ORG, null as any, { name: 'Dinner', venue_id: VENUE })
    if (!menu.ok) throw new Error((menu as any).error)
    const add = await addMenuItem(db, ORG, menu.data.id, { item_kind: 'meal', product_id: mealId })
    expect(add.ok).toBe(true)
    const pub = await publishMenu(db, ORG, menu.data.id, true)
    if (!pub.ok) throw new Error((pub as any).error)
    const slug = pub.data.public_slug!

    const def = await getPublicMenu(db, slug)
    if (!def.ok) throw new Error((def as any).error)
    const defData = def.data as any
    expect(defData.legend).toHaveLength(3)
    const item = defData.items.find((i: any) => i.name === 'Beef ragù')
    // ~11.07 kg display → 'high' under default thresholds (medium ≤ 3)
    expect(item.co2e).toBeCloseTo(11 + (3 * 0.5 * 0.18293) / 4, 4)
    expect(item.band).toBe('high')
    // Dietary + allergen chips flow through to the public payload.
    expect(item.dietary_tags).toContain('vegetarian')
    expect(item.allergens).toEqual(expect.arrayContaining(['milk', 'gluten']))

    // Widen the org thresholds; the same dish should now read 'low'.
    await db.from('organizations').update({ report_defaults: { hospitality_band_thresholds: { low: 20, medium: 40 } } }).eq('id', ORG)
    const wide = await getPublicMenu(db, slug)
    if (!wide.ok) throw new Error((wide as any).error)
    const wideItem = (wide.data as any).items.find((i: any) => i.name === 'Beef ragù')
    expect(wideItem.band).toBe('low')
    await db.from('organizations').update({ report_defaults: {} }).eq('id', ORG)
  })

  it('flows a recipe through the unconfirmed → confirmed quantities lifecycle', async () => {
    await updateRecipe(db, ORG, RECIPE_KINDS.meal, String(mealId), { quantities_status: 'unconfirmed' })
    const unconfirmed = await listUnconfirmedRecipes(db, ORG)
    if (!unconfirmed.ok) throw new Error((unconfirmed as any).error)
    expect((unconfirmed.data as any[]).some((r) => r.id === mealId)).toBe(true)

    const set = await setRecipeQuantities(db, ORG, mealId, [{ material_name: 'Beef mince', quantity: 650, unit: 'g' }], 'confirmed')
    expect(set.ok).toBe(true)
    const after = await getRecipe(db, ORG, RECIPE_KINDS.meal, String(mealId))
    if (!after.ok) throw new Error((after as any).error)
    const d = after.data as any
    expect(d.quantities_status).toBe('confirmed')
    expect(d.ingredients[0].quantity).toBe(650)
  })

  it('derives a per-room-night allocation from facility utilities ÷ room-nights sold', async () => {
    const r = await deriveRoomAllocation(db, ORG, roomId, YEAR_START, YEAR_END)
    if (!r.ok) throw new Error((r as any).error)
    const d = r.data
    expect(d.occupied_nights).toBeCloseTo(1000, 4)
    expect(d.electricity_kwh).toBeCloseTo(12, 4)   // 12000 kWh / 1000 nights
    expect(d.gas_kwh).toBeCloseTo(6, 4)            // 6000 kWh / 1000 nights
    expect(d.water_litres).toBeCloseTo(500, 4)     // 500 m³ → 500000 L / 1000 nights
    expect(d.water_metered).toBe(false)
  })
})
