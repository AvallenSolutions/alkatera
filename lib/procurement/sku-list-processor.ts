import type { SupabaseClient } from '@supabase/supabase-js';
import { processSkuList } from '@/lib/distributor/sku-list-processor';
import { queueBrandsForScraping } from '@/lib/distributor/scraping/agent-dispatcher';
import { attemptAutoMatch } from '@/lib/distributor/integration/linker';
import { loadChannelLookup, resolveChannel, type ChannelLink } from './channel-resolver';
import type { ColumnMapping } from '@/types/distributor';
import type { ProcurementColumnMapping } from '@/types/procurement';

export interface ProcurementProcessResult {
  brand_count: number;
  sku_count: number;
  row_count: number;
  channel_summary: Record<string, number>;
  unresolved_channels: Array<{ value: string; row_count: number }>;
  scraping_queued: number;
  scraping_skipped_directory_hit: number;
  alkatera_auto_linked: number;
  alkatera_suggested: number;
  warnings: string[];
}

interface ProcessArgs {
  supabase: SupabaseClient;
  procurementOrgId: string;
  procurementSkuListId: string;
  fileName: string;
  filePath: string;
  fileType: 'csv' | 'xlsx' | 'pdf';
  rows: Record<string, string>[];
  mapping: ProcurementColumnMapping;
  uploadedBy: string;
}

/**
 * Ingest a parsed procurement SKU list. The channel column on each row
 * resolves to one of the procurement org's linked distributor tenants
 * (Hallgarten or Enotria in the Foodbuy trial). Rows are grouped by
 * resolved distributor, then each group is handed to the existing
 * `processSkuList` to upsert per-distributor brand_profiles + brand_skus
 * exactly as a distributor-side upload would. Finally we insert
 * `procurement_skus` rows that project each upload row onto the
 * resolved brand_directory entry, source distributor and source
 * brand_sku — with procurement-specific economics (vintage, volume,
 * list price).
 *
 * Channel rows that don't resolve to a known link are skipped and
 * surfaced in the summary so the user can fix the CSV value or add a
 * new procurement_distributor_link.
 *
 * Caller must pass a service-role client; the cross-tenant
 * brand_profiles / brand_skus writes need to bypass RLS.
 */
export async function processProcurementSkuList(
  args: ProcessArgs,
): Promise<ProcurementProcessResult> {
  const {
    supabase,
    procurementOrgId,
    procurementSkuListId,
    fileName,
    filePath,
    fileType,
    rows,
    mapping,
    uploadedBy,
  } = args;

  const warnings: string[] = [];

  // 1. Resolve channels and group rows by distributor.
  const { lookup } = await loadChannelLookup(supabase, procurementOrgId);
  const byDistributor = new Map<
    string,
    { link: ChannelLink; rows: Array<{ raw: Record<string, string>; index: number }> }
  >();
  const unresolvedCounts = new Map<string, number>();

  rows.forEach((row, index) => {
    const rawValue = (row[mapping.distributor_channel] ?? '').trim();
    const resolved = resolveChannel(rawValue, lookup);
    if (!resolved) {
      const key = rawValue || '<empty>';
      unresolvedCounts.set(key, (unresolvedCounts.get(key) ?? 0) + 1);
      return;
    }
    const bucket =
      byDistributor.get(resolved.link.distributorOrgId) ??
      { link: resolved.link, rows: [] };
    bucket.rows.push({ raw: row, index });
    byDistributor.set(resolved.link.distributorOrgId, bucket);
  });

  const channelSummary: Record<string, number> = {};
  for (const [, bucket] of Array.from(byDistributor.entries())) {
    channelSummary[bucket.link.channelLabel] = bucket.rows.length;
  }
  const unresolvedChannels = Array.from(unresolvedCounts.entries())
    .map(([value, count]) => ({ value, row_count: count }))
    .sort((a, b) => b.row_count - a.row_count);

  // 2. For each distributor group, create a synthetic distributor_sku_lists
  //    row in their tenant so the Hallgarten / Enotria owner sees the
  //    procurement-sourced upload in their portal, then run the existing
  //    distributor processor against it.
  let totalBrandCount = 0;
  let totalSkuCount = 0;
  let totalScrapingQueued = 0;
  let totalScrapingSkippedDirectoryHit = 0;
  let totalAlkateraLinked = 0;
  let totalAlkateraSuggested = 0;

  const distributorMapping: ColumnMapping = {
    brand_name: mapping.brand_name,
    product_name: mapping.product_name,
    ...(mapping.sku_code ? { sku_code: mapping.sku_code } : {}),
    ...(mapping.gtin ? { gtin: mapping.gtin } : {}),
    ...(mapping.category ? { category: mapping.category } : {}),
    ...(mapping.country_of_origin ? { country_of_origin: mapping.country_of_origin } : {}),
    ...(mapping.listing_status ? { listing_status: mapping.listing_status } : {}),
    ...(mapping.website ? { website: mapping.website } : {}),
  };

  for (const [distributorOrgId, bucket] of Array.from(byDistributor.entries())) {
    const syntheticFileName = `${fileName} (via procurement upload)`;
    const { data: syntheticListRow, error: createListErr } = await supabase
      .from('distributor_sku_lists')
      .insert({
        distributor_org_id: distributorOrgId,
        uploaded_by: uploadedBy,
        file_name: syntheticFileName,
        file_path: filePath,
        file_type: fileType,
        status: 'processing',
      })
      .select('id')
      .single();

    if (createListErr || !syntheticListRow) {
      warnings.push(
        `[${bucket.link.channelLabel}] Could not create distributor SKU list: ${createListErr?.message ?? 'no row returned'}`,
      );
      continue;
    }
    const syntheticListId = (syntheticListRow as { id: string }).id;

    const distributorRows = bucket.rows.map((r) => r.raw);
    const processed = await processSkuList({
      supabase,
      distributorOrgId,
      skuListId: syntheticListId,
      rows: distributorRows,
      mapping: distributorMapping,
    });

    totalBrandCount += processed.brand_count;
    totalSkuCount += processed.sku_count;
    for (const err of processed.errors) {
      warnings.push(`[${bucket.link.channelLabel}] ${err}`);
    }

    await supabase
      .from('distributor_sku_lists')
      .update({
        status: 'complete',
        row_count: distributorRows.length,
        brand_count: processed.brand_count,
        error_message:
          processed.errors.length > 0 ? processed.errors.slice(0, 5).join('\n') : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', syntheticListId);

    // 3. Build procurement_skus rows. Look up the inserted brand_skus by
    // sku_list_id (the synthetic distributor list we just created) and
    // join them back to procurement-CSV rows by (brand_profile_id,
    // product_name, sku_code).
    const { data: insertedSkus } = await supabase
      .from('brand_skus')
      .select('id, brand_profile_id, product_name, sku_code')
      .eq('sku_list_id', syntheticListId);

    const skuIndex = new Map<string, string>();
    for (const sku of (insertedSkus ?? []) as Array<{
      id: string;
      brand_profile_id: string;
      product_name: string;
      sku_code: string | null;
    }>) {
      const key = brandSkuLookupKey(sku.brand_profile_id, sku.product_name, sku.sku_code);
      skuIndex.set(key, sku.id);
    }

    // Look up the procurement-side brand_directory_id for each brand_profile.
    const distinctProfileIds = Array.from(
      new Set(((insertedSkus ?? []) as Array<{ brand_profile_id: string }>).map((s) => s.brand_profile_id)),
    );
    const profileToDirectory = new Map<string, string>();
    if (distinctProfileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('brand_profiles')
        .select('id, brand_directory_id')
        .in('id', distinctProfileIds);
      for (const p of (profileRows ?? []) as Array<{
        id: string;
        brand_directory_id: string;
      }>) {
        profileToDirectory.set(p.id, p.brand_directory_id);
      }
    }

    const procurementInserts: Array<{
      procurement_org_id: string;
      procurement_sku_list_id: string;
      brand_directory_id: string;
      source_distributor_org_id: string;
      source_brand_sku_id: string | null;
      channel_label: string;
      product_name: string;
      sku_code: string | null;
      category: string | null;
      country_of_origin: string | null;
      vintage: number | null;
      volume_per_year_liters: number | null;
      list_price_gbp: number | null;
      listing_status: 'active' | 'delisted';
    }> = [];

    for (const { raw: row } of bucket.rows) {
      const productName = (row[mapping.product_name] ?? '').trim();
      const skuCode = mapping.sku_code ? (row[mapping.sku_code] ?? '').trim() || null : null;
      if (!productName) continue;

      // Find the matching brand_sku via the synthetic list — we need to
      // resolve the brand_profile_id first by re-doing the normalisation
      // lookup (cheap; the processor already created the row).
      const brandDisplayName = (row[mapping.brand_name] ?? '').trim();
      if (!brandDisplayName) continue;

      // Lookup brand_profile_id in the distributor tenant. We need it
      // to form the SKU lookup key. The processor already inserted it,
      // so a single query per upload is fine here even at 400 SKUs.
      const { data: profileLookup } = await supabase
        .from('brand_profiles')
        .select('id, brand_directory_id')
        .eq('distributor_org_id', distributorOrgId)
        .ilike('name', brandDisplayName)
        .limit(1);
      const profile = (profileLookup as Array<{ id: string; brand_directory_id: string }> | null)?.[0];
      if (!profile) {
        warnings.push(
          `[${bucket.link.channelLabel}] Row "${brandDisplayName} / ${productName}": no brand profile found post-upsert`,
        );
        continue;
      }

      const brandSkuId =
        skuIndex.get(brandSkuLookupKey(profile.id, productName, skuCode)) ?? null;

      procurementInserts.push({
        procurement_org_id: procurementOrgId,
        procurement_sku_list_id: procurementSkuListId,
        brand_directory_id: profile.brand_directory_id,
        source_distributor_org_id: distributorOrgId,
        source_brand_sku_id: brandSkuId,
        channel_label: bucket.link.channelLabel,
        product_name: productName,
        sku_code: skuCode,
        category: mapping.category ? (row[mapping.category] ?? '').trim() || null : null,
        country_of_origin: mapping.country_of_origin
          ? (row[mapping.country_of_origin] ?? '').trim() || null
          : null,
        vintage: mapping.vintage ? parseIntOrNull(row[mapping.vintage]) : null,
        volume_per_year_liters: mapping.volume_per_year_liters
          ? parseNumericOrNull(row[mapping.volume_per_year_liters])
          : null,
        list_price_gbp: mapping.list_price_gbp
          ? parseNumericOrNull(row[mapping.list_price_gbp])
          : null,
        listing_status: parseListingStatus(
          mapping.listing_status ? row[mapping.listing_status] : null,
        ),
      });
    }

    if (procurementInserts.length > 0) {
      const { error: procInsErr } = await supabase
        .from('procurement_skus')
        .upsert(procurementInserts, {
          onConflict:
            'procurement_org_id,source_distributor_org_id,brand_directory_id,sku_code,vintage',
        });
      if (procInsErr) {
        warnings.push(
          `[${bucket.link.channelLabel}] Inserting procurement_skus: ${procInsErr.message}`,
        );
      }
    }

    // Mirror the distributor confirm route: kick off scraping for every
    // brand profile this import touched, and run alka**tera** auto-matching.
    // Best-effort — failures don't break the import. Scraping is what
    // turns "we know the SKU exists" into "we have data on the brand".
    if (processed.brand_profile_ids.length > 0) {
      try {
        const q = await queueBrandsForScraping({
          supabase,
          distributorOrgId,
          brandProfileIds: processed.brand_profile_ids,
          triggeredBy: 'sku_import',
        });
        totalScrapingQueued += q.queued;
        totalScrapingSkippedDirectoryHit += q.skipped_directory_hit;
      } catch (err) {
        warnings.push(
          `[${bucket.link.channelLabel}] queueBrandsForScraping: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      try {
        const { data: brandRows } = await supabase
          .from('brand_profiles')
          .select('id, name, normalized_name, website')
          .in('id', processed.brand_profile_ids);
        for (const b of (brandRows ?? []) as Array<{
          id: string;
          name: string;
          normalized_name: string;
          website: string | null;
        }>) {
          const outcome = await attemptAutoMatch(supabase, {
            id: b.id,
            name: b.name,
            normalized_name: b.normalized_name,
            website: b.website,
          });
          if (outcome.action === 'linked') totalAlkateraLinked += 1;
          else if (outcome.action === 'suggested') totalAlkateraSuggested += 1;
        }
      } catch (err) {
        warnings.push(
          `[${bucket.link.channelLabel}] attemptAutoMatch: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return {
    brand_count: totalBrandCount,
    sku_count: totalSkuCount,
    row_count: rows.length,
    channel_summary: channelSummary,
    unresolved_channels: unresolvedChannels,
    scraping_queued: totalScrapingQueued,
    scraping_skipped_directory_hit: totalScrapingSkippedDirectoryHit,
    alkatera_auto_linked: totalAlkateraLinked,
    alkatera_suggested: totalAlkateraSuggested,
    warnings,
  };
}

function brandSkuLookupKey(profileId: string, productName: string, skuCode: string | null): string {
  return `${profileId}::${productName.trim().toLowerCase()}::${(skuCode ?? '').trim().toLowerCase()}`;
}

function parseIntOrNull(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function parseNumericOrNull(value: string | undefined | null): number | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/[£$,\s]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseListingStatus(value: string | undefined | null): 'active' | 'delisted' {
  if (!value) return 'active';
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'delisted' || trimmed === 'inactive' || trimmed === 'discontinued') {
    return 'delisted';
  }
  return 'active';
}
