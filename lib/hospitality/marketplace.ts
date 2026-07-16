/**
 * Producer-venue marketplace directory (foundation).
 *
 * Producers OPT IN to be discoverable (organizations.report_defaults.marketplace_listed).
 * A hospitality venue can then browse the directory to find producers whose
 * drinks LCAs it can pull. Because the directory is cross-tenant, the listing
 * query runs with a service-role client (like the public menu) and only returns
 * opt-in producers and non-sensitive summary fields — never another org's raw data.
 *
 * The two-way connection/consent request flow is a follow-on; this is the
 * discovery layer plus the opt-in toggle.
 */

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

/** Set (or clear) the caller org's marketplace listing. Authed client. */
export async function setMarketplaceListing(db: Db, organizationId: string, listed: boolean): Promise<ServiceResult<{ listed: boolean }>> {
  const { data: org } = await db.from('organizations').select('report_defaults').eq('id', organizationId).maybeSingle()
  const merged = { ...((org?.report_defaults as any) ?? {}), marketplace_listed: listed }
  const { error } = await db.from('organizations').update({ report_defaults: merged }).eq('id', organizationId)
  if (error) return fail(500, error.message)
  return ok({ listed })
}

export async function getMarketplaceListing(db: Db, organizationId: string): Promise<boolean> {
  const { data } = await db.from('organizations').select('report_defaults').eq('id', organizationId).maybeSingle()
  return (data?.report_defaults as any)?.marketplace_listed === true
}

export interface ProducerListing {
  organization_id: string
  name: string
  country: string | null
  product_count: number
  categories: string[]
  /** Products with a completed LCA — the "verified data" signal. */
  verified_count: number
  /** Mean per-product carbon across completed LCAs, kg CO2e (null if none). */
  avg_carbon: number | null
}

/**
 * Directory of opt-in producers. Requires a SERVICE-ROLE client (cross-tenant);
 * only listed orgs and summary fields are returned.
 */
export async function listMarketplaceProducers(serviceDb: Db, opts?: { excludeOrgId?: string }): Promise<ServiceResult<ProducerListing[]>> {
  const { data: orgs, error } = await serviceDb
    .from('organizations')
    .select('id, name, country, report_defaults')
    .filter('report_defaults->>marketplace_listed', 'eq', 'true')
  if (error) return fail(500, error.message)
  const listed = (orgs ?? []).filter((o: any) => o.id !== opts?.excludeOrgId)
  if (listed.length === 0) return ok([])

  const orgIds = listed.map((o: any) => o.id)

  // Drinks products only (product_kind='product'), with category.
  const { data: products } = await serviceDb
    .from('products')
    .select('id, organization_id, product_category')
    .in('organization_id', orgIds)
    .eq('product_kind', 'product')

  // Completed PCFs for those products → verified count + carbon.
  const { data: pcfs } = await serviceDb
    .from('product_carbon_footprints')
    .select('product_id, organization_id, aggregated_impacts, status')
    .in('organization_id', orgIds)
    .eq('status', 'completed')

  const byOrg = new Map<string, { count: number; categories: Set<string>; verified: Set<number>; carbon: number[] }>()
  for (const o of listed) byOrg.set(o.id, { count: 0, categories: new Set(), verified: new Set(), carbon: [] })
  for (const p of products ?? []) {
    const agg = byOrg.get(p.organization_id)
    if (!agg) continue
    agg.count += 1
    if (p.product_category) agg.categories.add(String(p.product_category))
  }
  for (const pcf of pcfs ?? []) {
    const agg = byOrg.get(pcf.organization_id)
    if (!agg || pcf.product_id == null) continue
    if (!agg.verified.has(pcf.product_id)) {
      agg.verified.add(pcf.product_id)
      const c = Number((pcf.aggregated_impacts as any)?.climate_change_gwp100)
      if (Number.isFinite(c)) agg.carbon.push(c)
    }
  }

  const result: ProducerListing[] = listed.map((o: any) => {
    const agg = byOrg.get(o.id)!
    return {
      organization_id: o.id,
      name: o.name,
      country: o.country ?? null,
      product_count: agg.count,
      categories: Array.from(agg.categories).sort(),
      verified_count: agg.verified.size,
      avg_carbon: agg.carbon.length > 0 ? agg.carbon.reduce((s, n) => s + n, 0) / agg.carbon.length : null,
    }
  })
  // Most verified first — the strongest producers surface at the top.
  result.sort((a, b) => b.verified_count - a.verified_count || a.name.localeCompare(b.name))
  return ok(result)
}
