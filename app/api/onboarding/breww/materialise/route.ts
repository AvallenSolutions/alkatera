import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import {
  importBrewwRecipe,
  importBrewwPackaging,
  importBrewwSecondaryPackaging,
} from '@/lib/integrations/breww/import-helpers'

/**
 * POST /api/onboarding/breww/materialise
 *
 * Make Breww the source of truth for products in this org. Specifically:
 *   1. For every Breww SKU in `breww_products_skus` not already linked,
 *      create a real `products` row and insert a `breww_product_links`
 *      row joining them. Best-effort import of recipe + packaging.
 *   2. Delete any `products` row that is (a) a draft, (b) created in the
 *      last hour (the onboarding window), (c) NOT linked to any Breww SKU.
 *      Rationale: if the user did a website import earlier in onboarding,
 *      those products are stand-ins; Breww's catalogue is authoritative
 *      when the org is using Breww. The user explicitly told us they want
 *      Breww to override.
 *
 * The 1-hour cutoff for delete is the safety net — only nukes drafts that
 * were almost certainly created by the website import step a moment ago.
 * Drafts older than that survive (they're from an earlier session).
 *
 * Step 3 (new): for every Breww `site` in `breww_sites`, ensure there's a
 * matching `facilities` row (matched by name). Creates a facility for any
 * site that doesn't already exist locally so a multi-site brewery doesn't
 * have to hand-add each one — they appear automatically once Breww is
 * connected.
 *
 * Body: { organizationId }
 * Returns: { created, alreadyLinked, droppedWebsiteDrafts, facilitiesCreated, errors }
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId } = await request.json().catch(() => ({}))
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: membership } = await service
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // ── 1. Materialise every Breww SKU into a product + link ──────────────
    const { data: skus, error: skuErr } = await service
      .from('breww_products_skus')
      .select('external_id, name, sku, liquid_volume_ml, primary_drink_name, obsolete')
      .eq('organization_id', organizationId)
    if (skuErr) {
      return NextResponse.json({ error: skuErr.message }, { status: 500 })
    }

    const { data: existingLinks } = await service
      .from('breww_product_links')
      .select('breww_sku_external_id')
      .eq('organization_id', organizationId)
    const alreadyLinkedSet = new Set(
      (existingLinks ?? []).map((l: any) => l.breww_sku_external_id as string),
    )

    let created = 0
    let alreadyLinked = 0
    const errors: string[] = []

    for (const sku of skus ?? []) {
      if (sku.obsolete) continue
      const externalId = String(sku.external_id)
      if (alreadyLinkedSet.has(externalId)) {
        alreadyLinked += 1
        continue
      }

      const unitSizeValue = sku.liquid_volume_ml ? Number(sku.liquid_volume_ml) : null
      const { data: newProduct, error: insertErr } = await service
        .from('products')
        .insert({
          organization_id: organizationId,
          name: sku.name,
          sku: sku.sku || null,
          unit_size_value: unitSizeValue,
          unit_size_unit: unitSizeValue != null ? 'ml' : null,
          product_category: 'beer',
          functional_unit: unitSizeValue != null ? `${unitSizeValue}ml unit` : null,
          is_draft: true,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (insertErr || !newProduct) {
        errors.push(`Insert failed for SKU ${externalId}: ${insertErr?.message ?? 'unknown'}`)
        continue
      }

      const { error: linkErr } = await service
        .from('breww_product_links')
        .insert({
          organization_id: organizationId,
          breww_sku_external_id: externalId,
          alkatera_product_id: newProduct.id,
          linked_by: user.id,
        })
      if (linkErr) {
        errors.push(`Link failed for SKU ${externalId}: ${linkErr.message}`)
        // Best-effort cleanup: drop the orphaned product so we don't leave a
        // dangling row the user has to garbage-collect manually.
        await service.from('products').delete().eq('id', newProduct.id)
        continue
      }

      // Recipe / packaging import is best-effort — a failure here doesn't
      // unwind the product creation. The user can re-run from settings.
      try { await importBrewwRecipe(service, { organizationId, productId: newProduct.id }) } catch { /* ignore */ }
      try { await importBrewwPackaging(service, { organizationId, productId: newProduct.id }) } catch { /* ignore */ }
      try { await importBrewwSecondaryPackaging(service, { organizationId, productId: newProduct.id }) } catch { /* ignore */ }

      created += 1
    }

    // ── 2. Drop website-import drafts that didn't end up linked to Breww ──
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: linkedProductIds } = await service
      .from('breww_product_links')
      .select('alkatera_product_id')
      .eq('organization_id', organizationId)
    const linkedIds = new Set(
      (linkedProductIds ?? []).map((l: any) => l.alkatera_product_id as string),
    )

    const { data: recentDrafts } = await service
      .from('products')
      .select('id, name, created_at')
      .eq('organization_id', organizationId)
      .eq('is_draft', true)
      .gte('created_at', cutoff)

    const toDrop = (recentDrafts ?? []).filter((p: any) => !linkedIds.has(p.id))
    let droppedWebsiteDrafts = 0
    if (toDrop.length > 0) {
      const { error: delErr, count } = await service
        .from('products')
        .delete({ count: 'exact' })
        .in('id', toDrop.map((p: any) => p.id))
      if (delErr) {
        errors.push(`Drop drafts failed: ${delErr.message}`)
      } else {
        droppedWebsiteDrafts = count ?? toDrop.length
      }
    }

    // ── 3. Materialise Breww sites into facilities ─────────────────────────
    // Match by name (case-insensitive). If a facility with the same name
    // exists, leave it alone. Otherwise insert a new facility with the site
    // name. Multi-site breweries pick up each site as a separate facility
    // without manual entry.
    let facilitiesCreated = 0
    try {
      const { data: brewwSites } = await service
        .from('breww_sites')
        .select('external_id, name')
        .eq('organization_id', organizationId)
      const sites = (brewwSites ?? []) as Array<{ external_id: string; name: string }>

      if (sites.length > 0) {
        const { data: existingFacilities } = await service
          .from('facilities')
          .select('id, name')
          .eq('organization_id', organizationId)
        const existingNames = new Set(
          ((existingFacilities ?? []) as Array<{ name: string | null }>)
            .map(f => (f.name || '').trim().toLowerCase())
            .filter(Boolean),
        )

        const toInsert = sites
          .filter(s => s.name && !existingNames.has(s.name.trim().toLowerCase()))
          .map(s => ({
            organization_id: organizationId,
            name: s.name.trim(),
            operational_control: 'owned',
            functions: ['manufacturing', 'packaging'],
          }))
        if (toInsert.length > 0) {
          const { error: facErr, count } = await service
            .from('facilities')
            .insert(toInsert, { count: 'exact' })
          if (facErr) {
            errors.push(`Facility insert from Breww sites failed: ${facErr.message}`)
          } else {
            facilitiesCreated = count ?? toInsert.length
          }
        }
      }
    } catch (err: any) {
      errors.push(`Materialise sites failed: ${err?.message ?? 'unknown'}`)
    }

    return NextResponse.json({
      created,
      alreadyLinked,
      droppedWebsiteDrafts,
      facilitiesCreated,
      errors,
    })
  } catch (err: any) {
    console.error('[onboarding/breww/materialise] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
