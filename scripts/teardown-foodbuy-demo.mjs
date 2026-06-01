// Remove ALL Foodbuy demo seed data created by seed-foodbuy-demo.mjs.
// Deletes in FK-safe order. Idempotent.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  // alkatera demo brand_directory ids (linked to fb-demo-* orgs)
  const { data: orgs } = await db.from('organizations').select('id').like('slug', 'fb-demo-%')
  const orgIds = (orgs ?? []).map((o) => o.id)
  let alkateraBdIds = []
  if (orgIds.length) {
    const { data: bds } = await db.from('brand_directory').select('id').in('alkatera_org_id', orgIds)
    alkateraBdIds = (bds ?? []).map((b) => b.id)
  }
  // scraped demo brand_directory ids
  const { data: scraped } = await db.from('brand_directory').select('id').like('id', 'fbde%')
  const scrapedBdIds = (scraped ?? []).map((b) => b.id)
  const allBdIds = [...alkateraBdIds, ...scrapedBdIds]

  // 1. procurement_skus (RESTRICT on brand_directory -> must go first)
  const { error: e1, count: c1 } = await db
    .from('procurement_skus')
    .delete({ count: 'exact' })
    .eq('procurement_notes', 'fb-demo-seed')
  if (e1) throw new Error(`procurement_skus: ${e1.message}`)

  // 2. scraped_brand_data
  if (allBdIds.length) {
    const { error: e2 } = await db.from('scraped_brand_data').delete().in('brand_directory_id', allBdIds)
    if (e2) throw new Error(`scraped_brand_data: ${e2.message}`)
  }

  // 3. brand_profiles (RESTRICT on brand_directory -> before brand_directory)
  let profileCount = 0
  if (allBdIds.length) {
    const { error: ep, count: cp } = await db
      .from('brand_profiles')
      .delete({ count: 'exact' })
      .in('brand_directory_id', allBdIds)
    if (ep) throw new Error(`brand_profiles: ${ep.message}`)
    profileCount = cp ?? 0
  }

  // 4. brand_directory
  if (allBdIds.length) {
    const { error: e3 } = await db.from('brand_directory').delete().in('id', allBdIds)
    if (e3) throw new Error(`brand_directory: ${e3.message}`)
  }

  // 5. organizations
  if (orgIds.length) {
    const { error: e4 } = await db.from('organizations').delete().in('id', orgIds)
    if (e4) throw new Error(`organizations: ${e4.message}`)
  }

  console.log(`Removed: ${c1 ?? '?'} procurement_skus, ${profileCount} brand_profiles, ${allBdIds.length} brand_directory rows, ${orgIds.length} demo orgs.`)
}

main().catch((e) => {
  console.error('TEARDOWN FAILED:', e.message)
  process.exit(1)
})
