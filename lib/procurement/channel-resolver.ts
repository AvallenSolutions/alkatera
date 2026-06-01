import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Procurement CSVs include a `distributor_channel` column whose value
 * has to resolve to one of the procurement org's active distributor
 * links. The CSV value almost never matches the link's stored
 * `channel_label` exactly — distributors get spelled in lots of ways —
 * so the resolver runs a normalised match plus a small alias table for
 * the two trial distributors. Per-procurement custom aliases can be
 * added by extending `EXTRA_ALIASES` below.
 */

const EXTRA_ALIASES: Record<string, string[]> = {
  hallgarten: [
    'hallgarten',
    'hallgarten & novum',
    'hallgarten and novum',
    'hallgarten novum',
    'hallgarten & novum wines',
    'h & n',
    'h&n',
    'hng',
    'hallgarten druitt',
  ],
  enotria: [
    'enotria',
    'enotria & coe',
    'enotria and coe',
    'enotria coe',
    'enotria&coe',
    'enotria + coe',
  ],
};

export interface ChannelLink {
  procurementOrgId: string;
  distributorOrgId: string;
  channelLabel: string;
  distributorName: string;
}

export interface ResolvedChannel {
  link: ChannelLink;
  matchedAlias: string;
}

function normaliseChannel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Load all active procurement_distributor_links for a procurement org
 * and build a lookup map keyed by every normalised alias each link
 * accepts. The map value is the link itself.
 */
export async function loadChannelLookup(
  supabase: SupabaseClient,
  procurementOrgId: string,
): Promise<{
  links: ChannelLink[];
  lookup: Map<string, ChannelLink>;
}> {
  const { data, error } = await supabase
    .from('procurement_distributor_links')
    .select(
      `id, procurement_org_id, distributor_org_id, channel_label, status,
       distributor_organizations:distributor_org_id ( id, name, slug )`,
    )
    .eq('procurement_org_id', procurementOrgId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Could not load channel links: ${error.message}`);
  }

  const links: ChannelLink[] = ((data ?? []) as Array<{
    procurement_org_id: string;
    distributor_org_id: string;
    channel_label: string;
    distributor_organizations: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
  }>).map((row) => {
    const distRaw = Array.isArray(row.distributor_organizations)
      ? row.distributor_organizations[0]
      : row.distributor_organizations;
    return {
      procurementOrgId: row.procurement_org_id,
      distributorOrgId: row.distributor_org_id,
      channelLabel: row.channel_label,
      distributorName: distRaw?.name ?? row.channel_label,
    };
  });

  const lookup = new Map<string, ChannelLink>();
  for (const link of links) {
    const aliases = new Set<string>();
    aliases.add(normaliseChannel(link.channelLabel));
    aliases.add(normaliseChannel(link.distributorName));
    const extra = EXTRA_ALIASES[normaliseChannel(link.channelLabel)] ?? [];
    for (const a of extra) aliases.add(normaliseChannel(a));
    for (const alias of Array.from(aliases)) {
      lookup.set(alias, link);
    }
  }

  return { links, lookup };
}

/**
 * Resolve a single CSV channel value against the lookup. Returns null
 * when nothing matches; the caller surfaces the row as a "needs
 * routing" error in the import summary.
 */
export function resolveChannel(
  value: string | null | undefined,
  lookup: Map<string, ChannelLink>,
): ResolvedChannel | null {
  if (!value) return null;
  const normalised = normaliseChannel(value);
  if (!normalised) return null;
  const link = lookup.get(normalised);
  if (!link) return null;
  return { link, matchedAlias: normalised };
}
