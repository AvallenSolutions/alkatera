import {
  FACILITIES,
  HISTORY_MONTHS,
  REFERENCE_YEAR,
  monthEnd,
  monthStart,
  replaceRows,
  trendFactor,
  upsert,
  type SeedCtx,
} from './shared';

/**
 * Seed the hospitality module: the winery's tasting room, cellar-door bar,
 * lodge and events field, with recipes, menus, throughput, waste and events.
 *
 * There is no `hospitality_meals`/`hospitality_rooms` table — a meal, a made
 * drink and a room night are all `products` rows discriminated by
 * `product_kind`, with the hospitality-only metadata (venue, covers, cooking,
 * dietary tags) hanging off `hospitality_meal_meta`. That is why this file
 * writes products first and everything else keys off the ids it gets back.
 *
 * Like lca.ts, footprints are written as COMPLETED PCFs directly: the calculator
 * is browser-only, and the hospitality read model looks up the latest
 * `product_carbon_footprints.aggregated_impacts` per product. Without a PCF row
 * every per-cover figure, dashboard tile and menu label renders as zero.
 */

/** Stable venue UUIDs so re-runs keep the same rows (and the same public menu URLs). */
const VENUES = {
  restaurant: 'b0a40001-0000-4000-8000-000000000001',
  bar: 'b0a40001-0000-4000-8000-000000000002',
  lodge: 'b0a40001-0000-4000-8000-000000000003',
  events: 'b0a40001-0000-4000-8000-000000000004',
} as const;

const MENUS = {
  summer: 'b0a50001-0000-4000-8000-000000000001',
  winter: 'b0a50001-0000-4000-8000-000000000002',
} as const;

const HOSPITALITY_KINDS = ['hospitality_meal', 'hospitality_drink', 'hospitality_room_night'];

// ── recipe definitions ──────────────────────────────────────────────────────

interface Ingredient {
  name: string;
  /** Grams for food, millilitres for liquids — the two units the recipe editor offers. */
  qty: number;
  unit: 'g' | 'ml';
}

interface RecipeSpec {
  key: string;
  name: string;
  kind: 'meal' | 'drink' | 'room_night';
  venue: string;
  covers: number;
  portionNote: string;
  prepWastePct: number;
  cookingMethod: string | null;
  cookingMinutes: number | null;
  dietary: string[];
  allergens: string[];
  ingredients: Ingredient[];
  /** Room nights only: the display-only per-night energy/water allocation. */
  room?: { occupancy: number; electricity_kwh: number; gas_kwh: number; water_litres: number; laundry_kwh: number };
  /** Peak-month throughput; the monthly series scales this by trend + season. */
  peakUnits: number;
}

const RECIPES: RecipeSpec[] = [
  // ── The Vine Room (restaurant) ────────────────────────────────────────────
  {
    key: 'lamb',
    name: 'Slow-roast lamb shoulder, wild garlic',
    kind: 'meal',
    venue: VENUES.restaurant,
    covers: 4,
    portionNote: 'Served with new potatoes and estate greens',
    prepWastePct: 8,
    cookingMethod: 'oven_gas',
    cookingMinutes: 240,
    dietary: [],
    allergens: ['celery'],
    ingredients: [
      { name: 'Lamb shoulder, bone-in', qty: 1800, unit: 'g' },
      { name: 'New potatoes', qty: 900, unit: 'g' },
      { name: 'Wild garlic leaves', qty: 120, unit: 'g' },
      { name: 'Onions', qty: 300, unit: 'g' },
      { name: 'Celery', qty: 150, unit: 'g' },
      { name: 'Rapeseed oil', qty: 60, unit: 'ml' },
      { name: 'Vegetable stock', qty: 500, unit: 'ml' },
    ],
    peakUnits: 210,
  },
  {
    key: 'trout',
    name: 'Chalk-stream trout, fennel and dill',
    kind: 'meal',
    venue: VENUES.restaurant,
    covers: 4,
    portionNote: 'Whole side of trout, served warm',
    prepWastePct: 12,
    cookingMethod: 'oven_electric',
    cookingMinutes: 22,
    dietary: ['pescatarian'],
    allergens: ['fish', 'milk'],
    ingredients: [
      { name: 'Chalk-stream trout fillet', qty: 900, unit: 'g' },
      { name: 'Fennel bulb', qty: 400, unit: 'g' },
      { name: 'Dill', qty: 30, unit: 'g' },
      { name: 'Butter', qty: 80, unit: 'g' },
      { name: 'Lemon', qty: 160, unit: 'g' },
      { name: 'Rapeseed oil', qty: 40, unit: 'ml' },
    ],
    peakUnits: 175,
  },
  {
    key: 'risotto',
    name: 'Estate garden risotto, hard cheese',
    kind: 'meal',
    venue: VENUES.restaurant,
    covers: 4,
    portionNote: 'Changes with whatever the kitchen garden is cutting',
    prepWastePct: 6,
    cookingMethod: 'hob_gas',
    cookingMinutes: 28,
    dietary: ['vegetarian', 'gluten_free'],
    allergens: ['milk', 'sulphites'],
    ingredients: [
      { name: 'Risotto rice', qty: 360, unit: 'g' },
      { name: 'Garden vegetables, mixed', qty: 600, unit: 'g' },
      { name: 'Hard cheese', qty: 120, unit: 'g' },
      { name: 'Butter', qty: 60, unit: 'g' },
      { name: 'White wine', qty: 150, unit: 'ml' },
      { name: 'Vegetable stock', qty: 1200, unit: 'ml' },
      { name: 'Onions', qty: 180, unit: 'g' },
    ],
    peakUnits: 240,
  },
  {
    key: 'salad',
    name: 'Heritage tomato salad, Bacchus vinaigrette',
    kind: 'meal',
    venue: VENUES.restaurant,
    covers: 4,
    portionNote: 'Summer starter, no cooking required',
    prepWastePct: 4,
    cookingMethod: 'no_cook',
    cookingMinutes: 0,
    dietary: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    allergens: ['sulphites', 'mustard'],
    ingredients: [
      { name: 'Heritage tomatoes', qty: 800, unit: 'g' },
      { name: 'Salad leaves', qty: 160, unit: 'g' },
      { name: 'Rapeseed oil', qty: 90, unit: 'ml' },
      { name: 'White wine vinegar', qty: 45, unit: 'ml' },
      { name: 'Wholegrain mustard', qty: 20, unit: 'g' },
      { name: 'Basil', qty: 25, unit: 'g' },
    ],
    peakUnits: 300,
  },
  {
    key: 'pudding',
    name: 'Warm chocolate and Calvados pudding',
    kind: 'meal',
    venue: VENUES.restaurant,
    covers: 6,
    portionNote: 'Baked to order in individual moulds',
    prepWastePct: 5,
    cookingMethod: 'oven_electric',
    cookingMinutes: 18,
    dietary: ['vegetarian'],
    allergens: ['gluten', 'eggs', 'milk'],
    ingredients: [
      { name: 'Dark chocolate', qty: 300, unit: 'g' },
      { name: 'Butter', qty: 220, unit: 'g' },
      { name: 'Free-range eggs', qty: 300, unit: 'g' },
      { name: 'Caster sugar', qty: 240, unit: 'g' },
      { name: 'Plain flour', qty: 120, unit: 'g' },
      { name: 'Calvados', qty: 60, unit: 'ml' },
    ],
    peakUnits: 185,
  },

  // ── The Cellar Door (bar) — made drinks, one serve per batch ──────────────
  {
    key: 'spritz',
    name: 'Bacchus and elderflower spritz',
    kind: 'drink',
    venue: VENUES.bar,
    covers: 1,
    portionNote: 'Served long over ice with a lemon twist',
    prepWastePct: 2,
    cookingMethod: 'no_cook',
    cookingMinutes: 0,
    dietary: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    allergens: ['sulphites'],
    ingredients: [
      { name: 'Bacchus white wine', qty: 100, unit: 'ml' },
      { name: 'Elderflower cordial', qty: 25, unit: 'ml' },
      { name: 'Sparkling water', qty: 75, unit: 'ml' },
      { name: 'Lemon', qty: 10, unit: 'g' },
    ],
    peakUnits: 430,
  },
  {
    key: 'highball',
    name: 'Garden gin highball',
    kind: 'drink',
    venue: VENUES.bar,
    covers: 1,
    portionNote: '50ml serve, built in the glass',
    prepWastePct: 2,
    cookingMethod: 'no_cook',
    cookingMinutes: 0,
    dietary: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    allergens: [],
    ingredients: [
      { name: 'Gin', qty: 50, unit: 'ml' },
      { name: 'Tonic water', qty: 150, unit: 'ml' },
      { name: 'Cucumber', qty: 20, unit: 'g' },
    ],
    peakUnits: 265,
  },
  {
    key: 'sour',
    name: 'Orchard sour',
    kind: 'drink',
    venue: VENUES.bar,
    covers: 1,
    portionNote: 'Calvados, apple and lemon, shaken',
    prepWastePct: 3,
    cookingMethod: 'no_cook',
    cookingMinutes: 0,
    dietary: ['vegetarian', 'gluten_free', 'dairy_free'],
    allergens: ['eggs', 'sulphites'],
    ingredients: [
      { name: 'Calvados', qty: 50, unit: 'ml' },
      { name: 'Cloudy apple juice', qty: 60, unit: 'ml' },
      { name: 'Lemon juice', qty: 25, unit: 'ml' },
      { name: 'Sugar syrup', qty: 15, unit: 'ml' },
      { name: 'Free-range egg white', qty: 20, unit: 'g' },
    ],
    peakUnits: 180,
  },
  {
    key: 'zeroTonic',
    name: 'Botanical zero and tonic',
    kind: 'drink',
    venue: VENUES.bar,
    covers: 1,
    portionNote: 'The alcohol-free pour, same ritual',
    prepWastePct: 2,
    cookingMethod: 'no_cook',
    cookingMinutes: 0,
    dietary: ['vegan', 'vegetarian', 'gluten_free', 'dairy_free'],
    allergens: [],
    ingredients: [
      { name: 'Botanical non-alcoholic spirit', qty: 50, unit: 'ml' },
      { name: 'Tonic water', qty: 150, unit: 'ml' },
      { name: 'Orange peel', qty: 8, unit: 'g' },
    ],
    peakUnits: 205,
  },

  // ── Vineyard Lodge (accommodation) ────────────────────────────────────────
  // A room night's "ingredients" are the purchased consumables per night: that
  // is the Scope 3 the engine can model. The energy/water for the room lives in
  // hospitality_room_allocation and is display-only (already in facility Scope 1/2).
  {
    key: 'roomDouble',
    name: 'Vineyard View Double',
    kind: 'room_night',
    venue: VENUES.lodge,
    covers: 1,
    portionNote: 'Per night, based on two guests sharing',
    prepWastePct: 0,
    cookingMethod: null,
    cookingMinutes: null,
    dietary: [],
    allergens: [],
    ingredients: [
      { name: 'Laundered bed linen set', qty: 1400, unit: 'g' },
      { name: 'Laundered towels', qty: 900, unit: 'g' },
      { name: 'Guest amenities (soap, shampoo)', qty: 90, unit: 'g' },
      { name: 'Breakfast provisions', qty: 850, unit: 'g' },
      { name: 'Housekeeping cleaning products', qty: 60, unit: 'g' },
    ],
    room: { occupancy: 2, electricity_kwh: 7.4, gas_kwh: 11.2, water_litres: 260, laundry_kwh: 2.6 },
    peakUnits: 26,
  },
  {
    key: 'roomSuite',
    name: 'Cellar Loft Suite',
    kind: 'room_night',
    venue: VENUES.lodge,
    covers: 1,
    portionNote: 'Per night, the larger room over the cellar',
    prepWastePct: 0,
    cookingMethod: null,
    cookingMinutes: null,
    dietary: [],
    allergens: [],
    ingredients: [
      { name: 'Laundered bed linen set', qty: 1700, unit: 'g' },
      { name: 'Laundered towels', qty: 1200, unit: 'g' },
      { name: 'Guest amenities (soap, shampoo)', qty: 120, unit: 'g' },
      { name: 'Breakfast provisions', qty: 850, unit: 'g' },
      { name: 'Housekeeping cleaning products', qty: 80, unit: 'g' },
    ],
    room: { occupancy: 2, electricity_kwh: 9.8, gas_kwh: 14.6, water_litres: 320, laundry_kwh: 3.4 },
    peakUnits: 21,
  },
  {
    key: 'roomTwin',
    name: 'Garden Twin',
    kind: 'room_night',
    venue: VENUES.lodge,
    covers: 1,
    portionNote: 'Per night, twin beds onto the kitchen garden',
    prepWastePct: 0,
    cookingMethod: null,
    cookingMinutes: null,
    dietary: [],
    allergens: [],
    ingredients: [
      { name: 'Laundered bed linen set', qty: 1400, unit: 'g' },
      { name: 'Laundered towels', qty: 900, unit: 'g' },
      { name: 'Guest amenities (soap, shampoo)', qty: 90, unit: 'g' },
      { name: 'Breakfast provisions', qty: 850, unit: 'g' },
      { name: 'Housekeeping cleaning products', qty: 60, unit: 'g' },
    ],
    room: { occupancy: 2, electricity_kwh: 6.9, gas_kwh: 10.4, water_litres: 240, laundry_kwh: 2.4 },
    peakUnits: 18,
  },
];

// ── impact factors ──────────────────────────────────────────────────────────

/**
 * Cradle-to-gate factors per kg of ingredient: climate (kg CO2e), water (m³),
 * land (m²·yr). Rough but directionally right, so the hot-spot ordering a chef
 * would expect (meat, then dairy, then everything else) actually shows up.
 *
 * Water is BLUE/CONSUMPTIVE water, matching what the engine's water_consumption
 * means — not the green-water-inclusive total footprint, which is an order of
 * magnitude larger and would make every recipe look absurd on the water tile.
 */
const FOOD_FACTORS: Array<[RegExp, { climate: number; water: number; land: number }]> = [
  [/lamb/, { climate: 24.5, water: 0.55, land: 185 }],
  [/beef/, { climate: 30.0, water: 0.65, land: 240 }],
  [/trout|salmon|fish/, { climate: 5.4, water: 0.25, land: 8 }],
  [/chocolate/, { climate: 18.7, water: 1.5, land: 68 }],
  [/cheese/, { climate: 12.1, water: 0.5, land: 42 }],
  [/butter/, { climate: 9.3, water: 0.45, land: 33 }],
  [/egg/, { climate: 4.6, water: 0.25, land: 12 }],
  [/rice/, { climate: 4.1, water: 1.6, land: 6 }], // paddy irrigation is the thirstiest thing in the kitchen
  [/oil|vinegar|syrup/, { climate: 3.1, water: 0.35, land: 14 }],
  [/calvados|gin|spirit/, { climate: 2.6, water: 0.12, land: 5 }],
  [/wine/, { climate: 1.6, water: 0.12, land: 4 }],
  [/cordial|juice|tonic/, { climate: 0.9, water: 0.06, land: 2 }],
  [/flour|sugar/, { climate: 0.9, water: 0.2, land: 3 }],
  [/stock/, { climate: 0.7, water: 0.03, land: 1.2 }],
  // Hotel linen is washed and reused, so a room night carries the wash cycle
  // plus an amortised share of replacement — not the manufacture of new cotton.
  // Costing it as new textile put a room night above a lamb dinner.
  [/linen|towel/, { climate: 0.45, water: 0.02, land: 1.2 }],
  [/amenit|cleaning|soap|shampoo/, { climate: 2.2, water: 0.03, land: 3 }],
  [/breakfast/, { climate: 3.8, water: 0.3, land: 14 }],
  [/mustard|basil|dill|garlic|peel|herb/, { climate: 1.3, water: 0.08, land: 3 }],
  [/potato|onion|celery|fennel|tomato|cucumber|leaves|vegetable|salad|apple|lemon|orange/, { climate: 0.5, water: 0.05, land: 1.4 }],
  [/water/, { climate: 0.0004, water: 0.001, land: 0 }],
];

const DEFAULT_FACTOR = { climate: 1.0, water: 0.15, land: 2.5 };

function factorFor(name: string) {
  const n = name.toLowerCase();
  for (const [re, f] of FOOD_FACTORS) if (re.test(n)) return f;
  return DEFAULT_FACTOR;
}

/** g and ml both convert at ~1 kg/l, which is close enough for demo recipes. */
function massKg(i: Ingredient): number {
  return i.qty / 1000;
}

function round(n: number, dp = 4): number {
  return +n.toFixed(dp);
}

// ── seasonality ─────────────────────────────────────────────────────────────

/**
 * A cellar-door venue is far busier in summer than in February, and
 * trendFactor's own sine wave is phased on the history index rather than the
 * calendar. So the decline comes from trendFactor and the swing is applied here
 * off the real month, which is what makes the sales chart look like a winery.
 */
function seasonalFactor(isoDate: string): number {
  const month = Number(isoDate.slice(5, 7)); // 1-12
  return 1 + 0.42 * Math.sin(((month - 4) / 12) * 2 * Math.PI);
}

// ── main ────────────────────────────────────────────────────────────────────

export async function seedHospitality(ctx: SeedCtx): Promise<void> {
  const createdBy = await resolveCreator(ctx);

  await enableHospitality(ctx);
  await seedVenues(ctx, createdBy);
  // Recipes must land first: every menu item, volume row and room allocation
  // keys off the bigint products.id they return.
  const productIds = await seedRecipes(ctx, createdBy);
  await seedMenus(ctx, productIds, createdBy);
  await seedThroughput(ctx, productIds, createdBy);
  await seedWaste(ctx, createdBy);
  await seedEvents(ctx, createdBy);
}

/**
 * Every created_by here is a nullable FK to auth.users, purely for provenance.
 * A missing owner (rebuilt local stack, deleted account) must not abort the
 * whole demo seed over an optional column, so confirm the account first and
 * fall back to NULL. The probe cannot tell "absent" from "auth API unhappy",
 * hence the cautious wording — either way the rows still land.
 */
async function resolveCreator(ctx: SeedCtx): Promise<string | null> {
  const { data, error } = await ctx.svc.auth.admin.getUserById(ctx.ownerUserId);
  if (error || !data?.user) {
    ctx.warnings.push('hospitality: could not confirm the owner account, so rows were seeded without created_by');
    return null;
  }
  return ctx.ownerUserId;
}

/**
 * The whole /hospitality route tree sits behind the `hospitality_beta` feature
 * flag, so seeded rows are invisible without it. The flag is a JSON boolean in
 * organizations.feature_flags — a string "true" does not match the usage RPC.
 */
async function enableHospitality(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  const { data: org } = await svc.from('organizations').select('feature_flags').eq('id', orgId).maybeSingle();
  const flags = ((org as any)?.feature_flags ?? {}) as Record<string, unknown>;
  if (flags.hospitality_beta !== true) {
    const { error } = await svc
      .from('organizations')
      .update({ feature_flags: { ...flags, hospitality_beta: true } })
      .eq('id', orgId);
    if (error) ctx.warnings.push(`hospitality_beta flag: ${error.message}`);
  }

  // `configured` must be true or /hospitality shows the first-run function
  // chooser instead of the dashboard.
  await upsert(
    ctx,
    'hospitality_settings',
    [{ organization_id: orgId, meals: true, drinks: true, rooms: true, configured: true }],
    'organization_id',
  );
  ctx.report.hospitalitySettings = 'meals + drinks + rooms enabled, hospitality_beta on';
}

async function seedVenues(ctx: SeedCtx, createdBy: string | null): Promise<void> {
  const { orgId } = ctx;
  const rows = [
    {
      id: VENUES.restaurant,
      organization_id: orgId,
      facility_id: FACILITIES.winery,
      name: 'The Vine Room',
      venue_type: 'restaurant',
      description: 'Forty-cover restaurant above the winery, open Wednesday to Sunday.',
      status: 'active',
      created_by: createdBy,
    },
    {
      id: VENUES.bar,
      organization_id: orgId,
      facility_id: FACILITIES.winery,
      name: 'The Cellar Door',
      venue_type: 'bar',
      description: 'Tasting bar at the winery entrance, serving flights and house cocktails.',
      status: 'active',
      created_by: createdBy,
    },
    {
      id: VENUES.lodge,
      organization_id: orgId,
      facility_id: FACILITIES.winery,
      name: 'Vineyard Lodge',
      venue_type: 'accommodation',
      description: 'Three guest rooms in the converted barn, let with the tasting experience.',
      status: 'active',
      created_by: createdBy,
    },
    {
      id: VENUES.events,
      organization_id: orgId,
      facility_id: FACILITIES.winery,
      name: 'Harvest Field',
      venue_type: 'events',
      description: 'The top field, used for the harvest festival and private hire.',
      status: 'active',
      created_by: createdBy,
    },
  ];
  await upsert(ctx, 'hospitality_venues', rows, 'id');
  ctx.report.hospitalityVenues = `${rows.length} venues at the winery (restaurant, bar, lodge, events)`;
}

/**
 * Create/refresh the recipe products and everything hanging off them, returning
 * key -> products.id so the menu, volume and room writers can reference them.
 * products.id is a bigint identity, so the ids must be read back rather than
 * generated; the natural key we converge on is (org, product_kind, name).
 */
async function seedRecipes(ctx: SeedCtx, createdBy: string | null): Promise<Map<string, number>> {
  const { svc, orgId } = ctx;

  const { data: existing, error: exErr } = await svc
    .from('products')
    .select('id, name, product_kind')
    .eq('organization_id', orgId)
    .in('product_kind', HOSPITALITY_KINDS);
  if (exErr) throw new Error(`hospitality products (read): ${exErr.message}`);

  const byKey = new Map<string, number>();
  const existingByName = new Map<string, number>();
  for (const p of existing ?? []) existingByName.set(`${(p as any).product_kind}::${(p as any).name}`, (p as any).id);

  const wanted = new Set(RECIPES.map((r) => `${kindToProductKind(r.kind)}::${r.name}`));
  const stale = (existing ?? []).filter((p: any) => !wanted.has(`${p.product_kind}::${p.name}`)).map((p: any) => p.id);
  if (stale.length > 0) {
    await clearPcfs(ctx, stale);
    const { error } = await svc.from('products').delete().in('id', stale);
    if (error) ctx.warnings.push(`stale hospitality products: ${error.message}`);
  }

  for (const spec of RECIPES) {
    const productKind = kindToProductKind(spec.kind);
    const portionWord = spec.kind === 'meal' ? 'cover' : spec.kind === 'drink' ? 'serve' : 'night';
    const batchWord = spec.kind === 'meal' ? 'recipe' : spec.kind === 'drink' ? 'batch' : 'room night';
    const functional_unit = `1 ${batchWord} of ${spec.name} (${spec.covers} ${spec.covers === 1 ? portionWord : portionWord + 's'})`;
    const payload = {
      organization_id: orgId,
      name: spec.name,
      product_kind: productKind,
      product_category: spec.kind === 'meal' ? 'Food' : spec.kind === 'drink' ? 'Beverage' : 'Accommodation',
      functional_unit,
      is_draft: false,
      created_by: createdBy,
    };

    let id = existingByName.get(`${productKind}::${spec.name}`);
    if (id) {
      const { error } = await svc.from('products').update(payload).eq('id', id);
      if (error) throw new Error(`hospitality product ${spec.name}: ${error.message}`);
    } else {
      const { data, error } = await svc.from('products').insert(payload).select('id').single();
      if (error) throw new Error(`hospitality product ${spec.name}: ${error.message}`);
      id = (data as any).id as number;
    }
    byKey.set(spec.key, id);

    await replaceRows(
      ctx,
      'product_materials',
      { product_id: id },
      spec.ingredients.map((i) => ({
        product_id: id,
        material_name: i.name,
        material_type: 'ingredient',
        quantity: i.qty,
        unit: i.unit,
      })),
    );

    await writePcf(ctx, id, spec, functional_unit);
  }

  // Metadata is one row per product (unique on product_id), so a plain upsert
  // converges without a delete pass.
  await upsert(
    ctx,
    'hospitality_meal_meta',
    RECIPES.map((spec) => ({
      organization_id: orgId,
      product_id: byKey.get(spec.key),
      venue_id: spec.venue,
      covers: spec.covers,
      portion_note: spec.portionNote,
      prep_waste_pct: spec.prepWastePct,
      quantities_status: 'confirmed',
      cooking_method: spec.cookingMethod,
      cooking_minutes: spec.cookingMinutes,
      dietary_tags: spec.dietary,
      allergens: spec.allergens,
      created_by: createdBy,
    })),
    'product_id',
  );

  const rooms = RECIPES.filter((r) => r.room);
  await upsert(
    ctx,
    'hospitality_room_allocation',
    rooms.map((spec) => ({
      organization_id: orgId,
      product_id: byKey.get(spec.key),
      occupancy: spec.room!.occupancy,
      electricity_kwh: spec.room!.electricity_kwh,
      gas_kwh: spec.room!.gas_kwh,
      water_litres: spec.room!.water_litres,
      laundry_kwh: spec.room!.laundry_kwh,
      country: 'GB',
    })),
    'product_id',
  );

  const meals = RECIPES.filter((r) => r.kind === 'meal').length;
  const drinks = RECIPES.filter((r) => r.kind === 'drink').length;
  ctx.report.hospitalityRecipes = `${meals} meals, ${drinks} made drinks, ${rooms.length} room types (all costed)`;
  return byKey;
}

function kindToProductKind(kind: RecipeSpec['kind']): string {
  return kind === 'meal' ? 'hospitality_meal' : kind === 'drink' ? 'hospitality_drink' : 'hospitality_room_night';
}

/**
 * PCF children do not cascade from the parent, and products.latest_lca_id FKs
 * the PCF, so both have to be unwound before a PCF (or its product) can go.
 */
async function clearPcfs(ctx: SeedCtx, productIds: number[]): Promise<void> {
  const { svc, orgId } = ctx;
  if (productIds.length === 0) return;
  const { data: pcfs } = await svc
    .from('product_carbon_footprints')
    .select('id')
    .eq('organization_id', orgId)
    .in('product_id', productIds);
  const ids = (pcfs ?? []).map((r: any) => r.id);
  await svc.from('products').update({ latest_lca_id: null, has_active_lca: false }).in('id', productIds);
  if (ids.length === 0) return;
  await svc.from('product_carbon_footprint_materials').delete().in('product_carbon_footprint_id', ids);
  await svc.from('product_carbon_footprint_production_sites').delete().in('product_carbon_footprint_id', ids);
  const { error } = await svc.from('product_carbon_footprints').delete().in('id', ids);
  if (error) ctx.warnings.push(`clear hospitality PCFs: ${error.message}`);
}

/**
 * One completed PCF per recipe, in the `aggregated_impacts` shape the
 * hospitality read model consumes: climate_change_gwp100 for the headline,
 * breakdown.by_scope.scope3 for every dashboard contribution figure, and
 * water/land for the pillar scores.
 */
async function writePcf(ctx: SeedCtx, productId: number, spec: RecipeSpec, functionalUnit: string): Promise<void> {
  const { svc, orgId } = ctx;

  const computed = spec.ingredients.map((i) => {
    const f = factorFor(i.name);
    const kg = massKg(i);
    return {
      name: i.name,
      unit: i.unit,
      quantity: i.qty,
      massKg: kg,
      climate: kg * f.climate,
      water: kg * f.water,
      land: kg * f.land,
    };
  });

  const total = round(computed.reduce((a, c) => a + c.climate, 0));
  const water = round(computed.reduce((a, c) => a + c.water, 0));
  const land = round(computed.reduce((a, c) => a + c.land, 0));

  const byMaterial = computed
    .map((c) => ({ name: c.name, unit: c.unit, source: 'secondary_modelled', climate: round(c.climate, 6), quantity: c.quantity }))
    .sort((a, b) => b.climate - a.climate);
  const hotspots = byMaterial.slice(0, 3).map((m) => ({
    name: m.name,
    category: 'ingredient',
    impact_kg_co2e: m.climate,
    contribution_pct: total > 0 ? round((m.climate / total) * 100, 1) : 0,
  }));

  // A recipe's footprint is entirely purchased ingredients: Scope 3 upstream.
  // The kitchen's own gas and electricity sit in the venue facility's Scope 1/2
  // and must not be re-added here, or the company total double-counts.
  const aggregated_impacts = {
    total_climate: total,
    climate_change_gwp100: total,
    total_carbon_footprint: total,
    total_climate_fossil: round(total * 0.86),
    total_climate_biogenic: round(total * 0.14),
    total_climate_dluc: 0,
    total_land: land,
    land_use: land,
    total_water: water,
    water_consumption: water,
    total_water_scarcity: water,
    materials_count: computed.length,
    calculation_version: '2.3.0',
    calculated_at: `${REFERENCE_YEAR}-12-31T12:00:00.000Z`,
    report_metadata: { version: '2.0', generated_at: `${REFERENCE_YEAR}-12-31T12:00:00.000Z`, calculation_engine: 'alkatera-demo-seed' },
    breakdown: {
      by_scope: { scope1: 0, scope2: 0, scope3: total },
      by_material: byMaterial,
      by_lifecycle_stage: { raw_materials: total, packaging: 0, processing: 0, distribution: 0, use_phase: 0, end_of_life: 0 },
      by_resource: { land_occupation: land, water_consumption: water, fossil_fuel_usage: round(total * 0.22) },
    },
    data_quality: { score: 68, rating: 'Good', overall_confidence: 'MEDIUM' },
    interpretation: {
      significant_issues: {
        hotspots,
        summary: `The largest contributors are ${byMaterial.slice(0, 2).map((m) => m.name).join(' and ')}.`,
        dominant_lifecycle_stage: 'raw_materials',
        dominant_scope: 'Scope 3 (Value Chain)',
      },
      conclusions: {
        key_findings: [`Ingredients account for the whole cradle-to-gate footprint of ${total.toFixed(3)} kg CO₂e per ${functionalUnit}.`],
        recommendations: ['Swap or reduce the top contributor before looking anywhere else on this recipe.'],
        limitations: ['Demo dataset: secondary factors, not a verified primary-data study.'],
      },
    },
  };

  await clearPcfs(ctx, [productId]);
  const { data: pcf, error } = await svc
    .from('product_carbon_footprints')
    .insert({
      organization_id: orgId,
      product_id: productId,
      product_name: spec.name,
      functional_unit: functionalUnit,
      reference_year: REFERENCE_YEAR,
      status: 'completed',
      is_draft: false,
      system_boundary: 'cradle-to-gate',
      lca_scope_type: 'cradle-to-gate',
      total_ghg_emissions: total,
      total_ghg_raw_materials: total,
      total_ghg_packaging: 0,
      total_ghg_processing: 0,
      total_ghg_transport: 0,
      total_ghg_use: 0,
      total_ghg_end_of_life: 0,
      aggregated_impacts,
      ingredients_complete: true,
      packaging_complete: true,
      production_complete: true,
    })
    .select('id')
    .single();
  if (error) throw new Error(`hospitality PCF ${spec.name}: ${error.message}`);
  const pcfId = (pcf as any).id;

  const { error: matErr } = await svc.from('product_carbon_footprint_materials').insert(
    computed.map((c) => ({
      product_carbon_footprint_id: pcfId,
      material_name: c.name,
      name: c.name,
      material_type: 'ingredient',
      quantity: c.quantity,
      unit: c.unit,
      unit_name: c.unit,
      impact_climate: round(c.climate, 6),
      impact_land: round(c.land, 6),
      impact_water: round(c.water, 6),
      data_priority: 3,
      data_quality_tag: 'Secondary_Modelled',
    })),
  );
  if (matErr) ctx.warnings.push(`hospitality PCF materials ${spec.name}: ${matErr.message}`);

  await svc.from('products').update({ has_active_lca: true, latest_lca_id: pcfId }).eq('id', productId);
}

/**
 * Two menus, one of them published as the public QR carbon label. Own-wine
 * pours are resolved from whatever real products the org actually has rather
 * than hardcoded ids, so the menu still builds if the product seed changes; they
 * are tagged internal_consumption because that wine is already counted in
 * production figures.
 */
async function seedMenus(ctx: SeedCtx, productIds: Map<string, number>, createdBy: string | null): Promise<void> {
  const { svc, orgId } = ctx;

  await upsert(
    ctx,
    'hospitality_menus',
    [
      {
        id: MENUS.summer,
        organization_id: orgId,
        venue_id: VENUES.restaurant,
        name: 'Summer at the Winery',
        description: 'The main season menu, served in The Vine Room and at the Cellar Door.',
        status: 'active',
        is_public: true,
        public_slug: 'alkatera-drinks-co-summer',
        created_by: createdBy,
      },
      {
        id: MENUS.winter,
        organization_id: orgId,
        venue_id: VENUES.restaurant,
        name: 'Winter Cellar Menu',
        description: 'The shorter cold-weather list, heavier on the roasts.',
        status: 'active',
        is_public: false,
        public_slug: null,
        created_by: createdBy,
      },
    ],
    'id',
  );

  // Own-product pours: take a couple of the org's real wine/spirit products and
  // record how many serves come out of a container, which is what the live
  // per-serve impact is divided by.
  const { data: ownProducts } = await svc
    .from('products')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('product_kind', 'product')
    .order('id', { ascending: true })
    .limit(2);
  const own = (ownProducts ?? []) as Array<{ id: number; name: string }>;
  if (own.length === 0) {
    ctx.warnings.push('hospitality menus: no own products on the org, so no own-wine pours were added');
  }
  for (const p of own) {
    await svc.from('products').update({ serves_per_container: 6 }).eq('id', p.id);
  }

  const items: Record<string, unknown>[] = [];
  let sort = 0;
  const add = (menuId: string, productId: number | undefined, itemKind: string, serves: number | null, internal = false) => {
    if (!productId) return;
    items.push({
      organization_id: orgId,
      menu_id: menuId,
      product_id: productId,
      item_kind: itemKind,
      serves_per_container: serves,
      sort_order: sort++,
      internal_consumption: internal,
    });
  };

  for (const key of ['salad', 'trout', 'risotto', 'lamb', 'pudding']) add(MENUS.summer, productIds.get(key), 'meal', null);
  for (const key of ['spritz', 'highball', 'sour', 'zeroTonic']) add(MENUS.summer, productIds.get(key), 'made_drink', null);
  for (const p of own) add(MENUS.summer, p.id, 'own_product_drink', 6, true);

  for (const key of ['lamb', 'risotto', 'pudding']) add(MENUS.winter, productIds.get(key), 'meal', null);
  for (const key of ['sour', 'highball']) add(MENUS.winter, productIds.get(key), 'made_drink', null);

  await replaceRows(ctx, 'hospitality_menu_items', { organization_id: orgId }, items);
  ctx.report.hospitalityMenus = `2 menus (1 public QR label) with ${items.length} items, incl. ${own.length} own-wine pours`;
}

/**
 * Monthly service volumes and the covers/revenue that go with them, over the
 * same history window as the rest of the demo so the dashboard has a prior year
 * to compare against. Throughput declines gently (trendFactor) while swinging
 * hard with the season.
 */
async function seedThroughput(ctx: SeedCtx, productIds: Map<string, number>, createdBy: string | null): Promise<void> {
  const { orgId } = ctx;

  const volumes: Record<string, unknown>[] = [];
  const periods: Record<string, unknown>[] = [];

  for (let i = 0; i < HISTORY_MONTHS; i++) {
    const monthsAgo = HISTORY_MONTHS - 1 - i; // index 0 is the oldest month
    const period_start = monthStart(monthsAgo);
    const period_end = monthEnd(monthsAgo);
    // Volumes trend down as the venue tightens portions and waste; no extra
    // sine here, the calendar swing is applied separately.
    const trend = trendFactor(i, HISTORY_MONTHS, 0.84, 0);
    const season = seasonalFactor(period_start);

    let restaurantCovers = 0;
    let barServes = 0;

    for (const spec of RECIPES) {
      const productId = productIds.get(spec.key);
      if (!productId) continue;
      // Rooms fill up in summer but never empty out; food and drink swing more.
      const swing = spec.kind === 'room_night' ? 1 + (season - 1) * 0.55 : season;
      const units = Math.max(0, Math.round(spec.peakUnits * trend * swing));
      volumes.push({
        organization_id: orgId,
        product_id: productId,
        venue_id: spec.venue,
        period_start,
        period_end,
        units_sold: units,
        created_by: createdBy,
      });
      if (spec.kind === 'meal') restaurantCovers += units;
      if (spec.kind === 'drink') barServes += units;
    }

    // Intensity KPIs (gCO2e per cover and per £) need footfall and revenue.
    periods.push({
      organization_id: orgId,
      venue_id: VENUES.restaurant,
      period_start,
      period_end,
      covers: restaurantCovers,
      fnb_revenue: Math.round(restaurantCovers * 41.5),
      currency: 'GBP',
      created_by: createdBy,
    });
    periods.push({
      organization_id: orgId,
      venue_id: VENUES.bar,
      period_start,
      period_end,
      covers: barServes,
      fnb_revenue: Math.round(barServes * 9.2),
      currency: 'GBP',
      created_by: createdBy,
    });
  }

  await replaceRows(ctx, 'hospitality_service_volumes', { organization_id: orgId }, volumes);
  await replaceRows(ctx, 'hospitality_operating_periods', { organization_id: orgId }, periods);
  ctx.report.hospitalityVolumes = `${volumes.length} monthly volume rows over ${HISTORY_MONTHS} months`;
  ctx.report.hospitalityOperating = `${periods.length} operating periods (covers + F&B revenue)`;
}

/**
 * Monthly waste by stream and treatment route. The mix improves over the window
 * as well as the mass: landfill shrinks fastest, which is what makes the
 * diversion rate on the dashboard climb.
 */
async function seedWaste(ctx: SeedCtx, createdBy: string | null): Promise<void> {
  const { orgId } = ctx;

  const streams: Array<{
    venue: string;
    waste_stream: 'food' | 'dry';
    treatment_method: string;
    peakKg: number;
    /** Routes we are actively moving away from decline faster. */
    floor: number;
    note: string;
  }> = [
    { venue: VENUES.restaurant, waste_stream: 'food', treatment_method: 'composting', peakKg: 340, floor: 0.86, note: 'Kitchen prep trimmings to the on-site compost heap' },
    { venue: VENUES.restaurant, waste_stream: 'food', treatment_method: 'anaerobic_digestion', peakKg: 195, floor: 0.88, note: 'Plate waste collected weekly for AD' },
    { venue: VENUES.restaurant, waste_stream: 'dry', treatment_method: 'recycling', peakKg: 265, floor: 0.9, note: 'Glass, card and cans' },
    { venue: VENUES.restaurant, waste_stream: 'dry', treatment_method: 'landfill', peakKg: 88, floor: 0.42, note: 'General waste, with a target of reaching zero' },
    { venue: VENUES.lodge, waste_stream: 'dry', treatment_method: 'recycling', peakKg: 72, floor: 0.9, note: 'Guest room recycling' },
    { venue: VENUES.lodge, waste_stream: 'dry', treatment_method: 'landfill', peakKg: 26, floor: 0.45, note: 'Guest room general waste' },
    { venue: VENUES.bar, waste_stream: 'dry', treatment_method: 'reuse', peakKg: 140, floor: 0.95, note: 'Returnable kegs and crates back to the winery' },
  ];

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < HISTORY_MONTHS; i++) {
    const monthsAgo = HISTORY_MONTHS - 1 - i;
    const period_start = monthStart(monthsAgo);
    const period_end = monthEnd(monthsAgo);
    const season = seasonalFactor(period_start);
    for (const s of streams) {
      const mass = s.peakKg * trendFactor(i, HISTORY_MONTHS, s.floor, 0) * season;
      rows.push({
        organization_id: orgId,
        venue_id: s.venue,
        period_start,
        period_end,
        waste_stream: s.waste_stream,
        treatment_method: s.treatment_method,
        mass_kg: round(Math.max(0, mass), 1),
        note: s.note,
        created_by: createdBy,
      });
    }
  }

  await replaceRows(ctx, 'hospitality_waste', { organization_id: orgId }, rows);
  ctx.report.hospitalityWaste = `${rows.length} waste rows across ${streams.length} stream/route combinations`;
}

/**
 * Two completed events and one on the books. Attendee travel usually dwarfs
 * everything else at an event, which is the point the seeded splits make.
 */
async function seedEvents(ctx: SeedCtx, createdBy: string | null): Promise<void> {
  const { orgId } = ctx;
  const now = new Date();
  const year = now.getUTCFullYear();
  // Anchor the completed events to dates that have definitely passed, whenever
  // the demo is rebuilt.
  const harvestYear = now.getUTCMonth() >= 8 ? year : year - 1; // month 8 = September
  const fairYear = now.getUTCMonth() >= 11 ? year : year - 1;
  const planned = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 14));
  const plannedDate = planned.toISOString().slice(0, 10);

  const rows = [
    {
      organization_id: orgId,
      venue_id: VENUES.events,
      name: `Harvest Festival ${harvestYear}`,
      event_type: 'festival',
      event_date_start: `${harvestYear}-09-13`,
      event_date_end: `${harvestYear}-09-14`,
      attendee_count: 850,
      avg_distance_km: 42,
      travel_split: { car: 58, train: 18, coach: 12, cycle: 7, walk: 5 },
      generator_litres: 310,
      temp_electricity_kwh: 1750,
      catering_co2e: 2100,
      country: 'GB',
      status: 'completed',
      note: 'Two-day open weekend. Shuttle bus from the station cut car share by nine points on last year.',
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      venue_id: VENUES.events,
      name: `Cellar Door Winter Fair ${fairYear}`,
      event_type: 'corporate',
      event_date_start: `${fairYear}-12-06`,
      event_date_end: `${fairYear}-12-06`,
      attendee_count: 320,
      avg_distance_km: 26,
      travel_split: { car: 66, train: 14, bus: 10, walk: 10 },
      generator_litres: 55,
      temp_electricity_kwh: 420,
      catering_co2e: 640,
      country: 'GB',
      status: 'completed',
      note: 'Trade and press tasting, run off the mains rather than generators where possible.',
      created_by: createdBy,
    },
    {
      organization_id: orgId,
      venue_id: VENUES.events,
      name: 'Vineyard Wedding Showcase',
      event_type: 'wedding',
      event_date_start: plannedDate,
      event_date_end: plannedDate,
      attendee_count: 180,
      avg_distance_km: 68,
      travel_split: { car: 72, train: 16, coach: 8, walk: 4 },
      generator_litres: 40,
      temp_electricity_kwh: 300,
      catering_co2e: 520,
      country: 'GB',
      status: 'planned',
      note: 'Showcase for wedding bookings. Travel estimate assumes no coach hire yet.',
      created_by: createdBy,
    },
  ];

  await replaceRows(ctx, 'hospitality_events', { organization_id: orgId }, rows);
  ctx.report.hospitalityEvents = `${rows.length} events (2 completed, 1 planned)`;
}
