/**
 * One-shot probe: call generateInsight directly with the first org that
 * has snapshots and print the raw Claude response + the parse outcome.
 * Strictly for diagnosing why /api/cron/generate-insights returns
 * generation_failed for every org.
 *
 * Run: npx tsx scripts/probe-insight.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
console.log('cwd:', process.cwd());
console.log('env file exists:', fs.existsSync(path.resolve(process.cwd(), '.env.local')));
console.log('ANTHROPIC before load:', process.env.ANTHROPIC_API_KEY ? `set len=${process.env.ANTHROPIC_API_KEY.length}` : 'unset');
loadEnvFile(path.resolve(process.cwd(), '.env.local'));
console.log('ANTHROPIC after load:', process.env.ANTHROPIC_API_KEY ? `set len=${process.env.ANTHROPIC_API_KEY.length}` : 'unset');

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('ANTHROPIC_API_KEY set:', Boolean(apiKey), apiKey ? `(prefix ${apiKey.slice(0, 8)}…)` : '');
  if (!apiKey) process.exit(1);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { gatherInsightContext } = await import('../lib/pulse/insights');
  const { data: orgs } = await supabase
    .from('metric_snapshots')
    .select('organization_id')
    .order('snapshot_date', { ascending: false })
    .limit(50);
  const orgId = orgs?.[0]?.organization_id;
  if (!orgId) { console.log('no orgs with snapshots'); process.exit(1); }
  console.log('Probing org:', orgId);

  const ctx = await gatherInsightContext(supabase as any, orgId);
  console.log(`Context: ${ctx.snapshots.length} snapshots, ${ctx.anomalies.length} anomalies, ${ctx.targets.length} targets`);

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });

  const SYSTEM_PROMPT = `You are the alkatera Pulse insight writer. You read a snapshot of an organisation's sustainability data and write a concise, evidence-backed brief explaining what changed and what to do about it.\n\nOutput strict JSON matching this shape:\n{\n  "headline": "string",\n  "narrative_md": "string (markdown allowed)",\n  "confidence": number between 0 and 1\n}`;

  const prompt = `Snapshots:\n${ctx.snapshots.map(s => `- ${s.metric_key}: ${s.current} ${s.unit} (Δ ${s.delta_pct}%)`).join('\n')}\n\nWrite the JSON only.`;

  console.log('\n--- Trying claude-sonnet-4-6 ---');
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });
    console.log('OK. content[]:', resp.content.length, 'types:', resp.content.map(b => b.type).join(','));
    const text = resp.content.find(b => b.type === 'text');
    if (text && text.type === 'text') {
      console.log('TEXT (first 600 chars):');
      console.log(text.text.slice(0, 600));
    }
  } catch (err: any) {
    console.error('FAILED:', err?.status, err?.name, err?.message);
    if (err?.error) console.error('error body:', JSON.stringify(err.error).slice(0, 500));
  }
}

main().catch(e => { console.error('CRASH', e); process.exit(1); });
