/**
 * Generate LCA Report HTML preview for a specific PCF record.
 *
 * Usage: node --env-file=.env.local -r tsx/cjs scripts/generate-lca-html.ts
 *    or: npx tsx scripts/generate-lca-html.ts  (with env vars pre-loaded)
 */

import { createClient } from '@supabase/supabase-js';
import { transformLCADataForReport } from '@/lib/utils/lca-report-transformer';
import { renderLcaReportHtml } from '@/lib/pdf/render-lca-html';
import * as fs from 'fs';
import * as path from 'path';

// Manually parse .env.local if env vars not yet loaded
function loadEnvFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore if file doesn't exist
  }
}

// Load from project root
const projectRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(projectRoot, '.env.local'));

const PCF_ID = '7a36e065-7fb0-4a9e-93ae-0103ba9d87cb';
const OUTPUT_PATH = '/tmp/lca-report-preview.html';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  console.log('Connecting to Supabase:', supabaseUrl);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1. Fetch the PCF record
  console.log(`Fetching PCF record: ${PCF_ID}`);
  const { data: pcf, error: pcfError } = await supabase
    .from('product_carbon_footprints')
    .select('*')
    .eq('id', PCF_ID)
    .single();

  if (pcfError || !pcf) {
    console.error('Failed to fetch PCF:', pcfError?.message || 'Not found');
    process.exit(1);
  }

  console.log(`Found PCF: "${pcf.product_name}"`);

  // 2. Fetch materials
  const { data: materials, error: matError } = await supabase
    .from('product_carbon_footprint_materials')
    .select('*')
    .eq('product_carbon_footprint_id', PCF_ID);

  if (matError) {
    console.warn('Warning: Failed to fetch materials:', matError.message);
  } else {
    console.log(`Found ${materials?.length || 0} materials`);
    (pcf as any).product_lca_materials = materials;
  }

  // 3. Fetch organization
  let organization: { name: string } | null = null;
  if (pcf.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', pcf.organization_id)
      .maybeSingle();
    organization = org;
    console.log(`Organization: ${organization?.name || '(unknown)'}`);
  }

  // 4. Fetch product image fallback
  if (!pcf.product_image_url && pcf.product_id) {
    const { data: product } = await supabase
      .from('products')
      .select('product_image_url, image_url')
      .eq('id', pcf.product_id)
      .maybeSingle();

    if (product) {
      (pcf as any).product_image_url = product.product_image_url || product.image_url;
      console.log(`Product image URL: ${pcf.product_image_url || '(none)'}`);
    }
  }

  // 5. Transform the data
  console.log('Transforming data...');
  const reportData = transformLCADataForReport(pcf as any, null, organization);

  // 6. Render HTML
  console.log('Rendering HTML...');
  const html = renderLcaReportHtml(reportData);

  // 7. Save to file
  fs.writeFileSync(OUTPUT_PATH, html, 'utf-8');
  console.log(`\nHTML report saved to: ${OUTPUT_PATH}`);
  console.log(`File size: ${(html.length / 1024).toFixed(1)} KB`);
  console.log(`\nOpen it with: open ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
