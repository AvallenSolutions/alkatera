/**
 * A headless harness for `aggregateProductImpacts`.
 *
 * WHY THIS EXISTS
 * The cutover from `main` (Netlify) to `redesign` (Vercel) changes the app, the
 * host AND the schema at once. The one thing that must NOT change is the
 * number a customer sees on their LCA report. This harness makes that provable
 * instead of hopeful: the same fixtures and the same expected values run on
 * both branches, so any drift in the calculation surface fails a test rather
 * than shipping silently.
 *
 * The handoff recorded the obstacle as "the calculator is browser-only". That
 * is not so. `lib/product-lca-calculator.ts` contains no window/document/
 * localStorage reference at all — its only browser coupling is a single
 * `getSupabaseBrowserClient()` call — and `aggregateProductImpacts`, which is
 * what actually produces `aggregated_impacts`, already takes its Supabase
 * client as an argument. It needs a client, not a browser. So we give it one.
 *
 * PORTABILITY CONTRACT
 * This file, `../fixtures/lca-golden-cases`, and the golden test that uses them
 * are meant to be byte-identical on `main` and `redesign`. Copy all three
 * across together. If a change here is needed to make redesign pass, that
 * change IS the finding — record it rather than quietly forking the harness.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** The three tables `aggregateProductImpacts` reads. Nothing else is touched. */
export interface AggregatorFixtureData {
  /** Rows of `product_carbon_footprint_materials` for the PCF under test. */
  materials: Array<Record<string, any>>;
  /** The `product_carbon_footprints` row. */
  pcf: {
    product_id: string;
    organization_id?: string;
    system_boundary?: string | null;
    reference_year?: number | null;
  };
  /** The `products` row, for unit size and functional unit. */
  product: {
    unit_size_value: number | null;
    unit_size_unit: string | null;
    functional_unit?: string | null;
  };
}

/** A write the aggregator attempted, captured instead of performed. */
export interface CapturedWrite {
  table: string;
  payload: Record<string, any>;
}

export interface AggregatorStub {
  client: SupabaseClient;
  /** Every `.update()` the aggregator issued, in order. */
  writes: CapturedWrite[];
  /** The payload of the write that persists `aggregated_impacts`. */
  persistedImpacts(): Record<string, any> | undefined;
}

/**
 * A minimal chainable Supabase test double.
 *
 * Deliberately NOT a general-purpose mock. It models exactly the call shapes
 * `aggregateProductImpacts` uses and nothing more, so that if the aggregator
 * starts reading a fourth table the harness fails loudly (`unexpected table`)
 * rather than silently feeding it `null` and producing a wrong-but-green
 * golden number.
 */
export function createAggregatorStub(fixture: AggregatorFixtureData): AggregatorStub {
  const writes: CapturedWrite[] = [];

  const from = (table: string) => {
    let operation: 'select' | 'update' = 'select';

    const resolve = () => {
      if (operation === 'update') {
        // Writes are captured, never applied. The aggregator only checks
        // `error`, so a clean result keeps it on its normal path.
        return { data: null, error: null };
      }

      switch (table) {
        case 'product_carbon_footprint_materials':
          return { data: fixture.materials, error: null };
        case 'product_carbon_footprints':
          return { data: fixture.pcf, error: null };
        case 'products':
          return { data: fixture.product, error: null };
        default:
          throw new Error(
            `[aggregator-harness] Unexpected table "${table}". The aggregator has ` +
              `started reading something the golden fixtures do not model, so any ` +
              `number it produces here is untrustworthy. Extend AggregatorFixtureData.`,
          );
      }
    };

    const builder: any = {
      select: () => builder,
      update: (payload: Record<string, any>) => {
        operation = 'update';
        writes.push({ table, payload });
        return builder;
      },
      eq: () => builder,
      neq: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      single: async () => resolve(),
      maybeSingle: async () => resolve(),
      // Thenable so `await supabase.from(...).select(...).eq(...)` resolves,
      // which is how the materials read and both update chains terminate.
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve().then(resolve).then(onFulfilled, onRejected),
    };

    return builder;
  };

  return {
    client: { from } as unknown as SupabaseClient,
    writes,
    persistedImpacts: () =>
      writes.find((w) => w.table === 'product_carbon_footprints' && 'aggregated_impacts' in w.payload)
        ?.payload.aggregated_impacts,
  };
}

/**
 * DEFRA freight factors (kg CO2e per tonne-km), fixtured.
 *
 * Distribution is the one downstream stage the aggregator cannot reach through
 * its injected client: `calculateTransportEmissions` builds its OWN client via
 * the `getSupabaseBrowserClient()` singleton, so there is no argument to pass.
 * Rather than stub the whole transport calculator — which would delete its
 * tonne-km maths and 6dp rounding from the test, the very arithmetic most worth
 * locking — we stub only the factor ROW it looks up. Everything downstream of
 * the lookup stays real code.
 *
 * NOTE for the cutover: because that lookup throws when the factor is missing
 * and `calculateDistributionEmissions` catches per leg, a failed factor lookup
 * in production yields distribution = 0 with only a `console.warn`. Worth
 * knowing when reading a suspiciously low staging number.
 */
export const FIXTURED_FREIGHT_FACTORS: Record<string, number> = {
  'Freight - Road (HGV, Average laden)': 0.10749,
  'Freight - Rail (Freight train, UK average)': 0.02782,
  'Freight - Sea (Container ship, Average)': 0.01614,
  'Freight - Air (Dedicated freight service, Average)': 1.13002,
};

/**
 * A stand-in for the `getSupabaseBrowserClient()` singleton, serving only
 * `staging_emission_factors`. Use with `vi.mock('@/lib/supabase/browser-client')`.
 */
export function createEmissionFactorStub() {
  const from = (table: string) => {
    if (table !== 'staging_emission_factors') {
      throw new Error(
        `[aggregator-harness] The browser-client stub only serves ` +
          `staging_emission_factors, but "${table}" was requested. Something in ` +
          `the calculation path has grown a new un-injected DB dependency.`,
      );
    }

    let factorName = '';
    const builder: any = {
      select: () => builder,
      eq: (column: string, value: any) => {
        if (column === 'name') factorName = value;
        return builder;
      },
      maybeSingle: async () => {
        const co2Factor = FIXTURED_FREIGHT_FACTORS[factorName];
        if (co2Factor === undefined) return { data: null, error: null };
        return {
          data: {
            co2_factor: co2Factor,
            source: 'DEFRA 2025 (fixtured)',
            metadata: { methodology: 'DEFRA 2025 Freight Factors' },
          },
          error: null,
        };
      },
    };
    return builder;
  };

  return { from } as unknown as SupabaseClient;
}
