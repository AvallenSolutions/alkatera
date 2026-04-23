/**
 * Rosa — memory helpers.
 *
 * Rosa writes stable facts and preferences into `rosa_memory` so she can carry
 * them across conversations. On every turn the chat route loads the most
 * recent entries for this user + org and injects them into the system prompt.
 *
 * Scopes:
 *   - 'user': specific to this user-in-this-org (e.g. "prefers brief answers")
 *   - 'org':  shared across every member of the org (e.g. "we report to VSME")
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type MemoryScope = 'user' | 'org';

export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  key: string;
  value: string;
  updated_at: string;
}

const MAX_ENTRIES = 30;
const MAX_VALUE_LEN = 1000;

export async function listMemories(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<MemoryEntry[]> {
  const { data, error } = await supabase
    .from('rosa_memory')
    .select('id, scope, key, value, updated_at, user_id')
    .eq('organization_id', organizationId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('updated_at', { ascending: false })
    .limit(MAX_ENTRIES);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id,
    scope: r.scope,
    key: r.key,
    value: r.value,
    updated_at: r.updated_at,
  }));
}

export async function saveMemory(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  scope: MemoryScope,
  key: string,
  value: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const k = (key ?? '').trim().toLowerCase().replace(/\s+/g, '_').slice(0, 100);
  const v = (value ?? '').trim().slice(0, MAX_VALUE_LEN);
  if (!k || !v) return { ok: false, error: 'key and value are required' };

  const row = {
    organization_id: organizationId,
    user_id: scope === 'user' ? userId : null,
    scope,
    key: k,
    value: v,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('rosa_memory')
    .upsert(row, { onConflict: 'organization_id,user_id,scope,key' })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as any).id };
}

export async function deleteMemory(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  memoryId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('rosa_memory')
    .delete()
    .eq('id', memoryId)
    .eq('organization_id', organizationId)
    .or(`user_id.eq.${userId},user_id.is.null`);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Formats the top-N memories as a short plain-text block Rosa can read at the
 * top of her system prompt. Empty string when no memories exist.
 */
export function formatMemoryBlock(entries: MemoryEntry[]): string {
  if (!entries || entries.length === 0) return '';
  const userEntries = entries.filter(e => e.scope === 'user');
  const orgEntries = entries.filter(e => e.scope === 'org');
  const lines: string[] = ['Previously noted:'];
  if (userEntries.length > 0) {
    lines.push('About this user:');
    for (const e of userEntries.slice(0, 10)) {
      lines.push(`- ${e.key}: ${e.value}`);
    }
  }
  if (orgEntries.length > 0) {
    lines.push('About this organisation:');
    for (const e of orgEntries.slice(0, 10)) {
      lines.push(`- ${e.key}: ${e.value}`);
    }
  }
  return lines.join('\n');
}

export async function buildMemoryBlock(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<string> {
  const entries = await listMemories(supabase, organizationId, userId);
  return formatMemoryBlock(entries);
}
