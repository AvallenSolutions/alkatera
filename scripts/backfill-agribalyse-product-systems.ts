#!/usr/bin/env npx tsx
/**
 * Backfill Agribalyse Product Systems
 *
 * Pre-builds product systems for every Agribalyse process referenced in
 * staging_emission_factors and caches the (process_id -> product_system_id)
 * mapping in agribalyse_product_systems.
 *
 * Run this once after deploying the product-system fix so the first user
 * never pays the ~5-10s first-time build cost.
 *
 * Why this is needed:
 *   Agribalyse unit processes often have inputs with ambiguous or missing
 *   default providers. OpenLCA's "calculate directly from Process" shortcut
 *   silently returns zero impacts when the auto-linker can't resolve the
 *   graph. Building an explicit product system via data/create-system runs
 *   the full linker with explicit rules and produces a calculable system.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-agribalyse-product-systems.ts
 *
 * Environment:
 *   OPENLCA_AGRIBALYSE_SERVER_URL  (required)
 *   OPENLCA_AGRIBALYSE_API_KEY     (optional)
 *   NEXT_PUBLIC_SUPABASE_URL       (required)
 *   SUPABASE_SERVICE_ROLE_KEY      (required)
 */

import { createClient } from '@supabase/supabase-js';
import { OpenLCAClient } from '../lib/openlca/client';
import { ProviderLinking } from '../lib/openlca/schema';

const AGRIBALYSE_URL =
  process.env.OPENLCA_AGRIBALYSE_SERVER_URL ||
  process.env.OPENLCA_AGRIBALYSE_URL ||
  'http://localhost:8081';
const AGRIBALYSE_API_KEY =
  process.env.OPENLCA_AGRIBALYSE_API_KEY || process.env.OPENLCA_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const olca = new OpenLCAClient(AGRIBALYSE_URL, AGRIBALYSE_API_KEY);

interface FactorRow {
  id: string;
  name: string;
  openlca_process_id: string | null;
  ecoinvent_process_id: string | null;
  source_database: string | null;
}

async function main() {
  console.log(`[backfill] Agribalyse server: ${AGRIBALYSE_URL}`);

  // 1. Pull every staging factor tagged as agribalyse
  const { data: factors, error } = await supabase
    .from('staging_emission_factors')
    .select('id,name,openlca_process_id,ecoinvent_process_id,source_database')
    .eq('source_database', 'agribalyse');

  if (error) throw new Error(`Failed to fetch agribalyse factors: ${error.message}`);

  const processIds = Array.from(
    new Set(
      (factors || [])
        .map((f: FactorRow) => f.openlca_process_id || f.ecoinvent_process_id)
        .filter((id): id is string => !!id),
    ),
  );
  console.log(`[backfill] ${processIds.length} unique Agribalyse processes to check`);

  // 2. Skip any already cached
  const { data: existing } = await supabase
    .from('agribalyse_product_systems')
    .select('process_id');
  const alreadyCached = new Set((existing || []).map((r: { process_id: string }) => r.process_id));
  const todo = processIds.filter((id) => !alreadyCached.has(id));
  console.log(`[backfill] ${alreadyCached.size} already cached, ${todo.length} to build`);

  let success = 0;
  let failed = 0;
  const failures: Array<{ processId: string; reason: string }> = [];

  for (const [idx, processId] of Array.from(todo.entries())) {
    const progress = `[${idx + 1}/${todo.length}]`;
    try {
      const processInfo = await olca.getProcess(processId).catch(() => null);
      const processName = processInfo?.name || 'unknown';
      console.log(`${progress} Building product system for ${processName} (${processId})`);

      const start = Date.now();
      const systemRef = await olca.createProductSystem(processId, {
        preferUnitProcesses: false,
        providerLinking: ProviderLinking.PREFER_DEFAULTS,
        cutoff: 1e-5,
      });
      const buildMs = Date.now() - start;

      const productSystemId = systemRef['@id'];
      if (!productSystemId) throw new Error('createProductSystem returned no @id');

      // Verify the system actually calculates with non-zero impacts
      const impacts = await olca.calculateProductSystem(
        productSystemId,
        'EF 3.1 Method (adapted)',
        1,
      ).catch(() => [] as Array<{ value?: number; amount?: number }>);

      const hasNonZero = impacts.some(
        (i) => Math.abs((i as any).amount ?? i.value ?? 0) > 0,
      );

      if (!hasNonZero) {
        throw new Error(
          `Product system built but returned zero impacts (${impacts.length} categories)`,
        );
      }

      const { error: upsertError } = await supabase
        .from('agribalyse_product_systems')
        .upsert(
          {
            process_id: processId,
            product_system_id: productSystemId,
            process_name: processName,
            linking_config: {
              preferUnitProcesses: false,
              providerLinking: ProviderLinking.PREFER_DEFAULTS,
              cutoff: 1e-5,
            },
            build_duration_ms: buildMs,
            last_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'process_id' },
        );
      if (upsertError) throw new Error(`DB upsert failed: ${upsertError.message}`);

      console.log(`${progress} ✓ ${processName} (${buildMs}ms, ${impacts.length} impacts)`);
      success++;
    } catch (err: any) {
      console.error(`${progress} ✗ ${processId}: ${err.message}`);
      failures.push({ processId, reason: err.message });
      failed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Success: ${success}`);
  console.log(`Failed:  ${failed}`);
  if (failures.length) {
    console.log('\nFailures (seed a manual alternative or remove from staging):');
    for (const f of failures) console.log(`  - ${f.processId}: ${f.reason}`);
  }
}

main().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
