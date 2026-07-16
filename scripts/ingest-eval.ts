/**
 * Offline eval harness for the Smart Upload classifier.
 *
 * Runs classifyDocument against the golden corpus (ingest_eval_cases +
 * ingest-eval-corpus bucket, promoted from real uploads via
 * /admin/ingest-learning) and reports accuracy, per-type precision/recall
 * and a confusion matrix. Use it to prove a prompt or tool-description
 * change actually improves accuracy before shipping it.
 *
 * NEVER wired into CI: it spends real Anthropic tokens on real customer
 * files. Run manually:
 *
 *   pnpm tsx scripts/ingest-eval.ts [--type bom] [--limit 20] [--with-context]
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
 * ANTHROPIC_API_KEY in the environment (source .env.local). Org context is
 * OFF by default so results measure the base classifier, not one org's
 * learned hints; pass --with-context to include each source org's context.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { classifyDocument } from '../lib/ingest/classify-document';
import { buildIngestOrgContext } from '../lib/ingest/org-context';
import { scoreEvalResults, formatEvalReport, type EvalCaseResult } from '../lib/ingest/eval/score';

interface CliArgs {
  type: string | null;
  limit: number;
  withContext: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { type: null, limit: 100, withContext: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--type') args.type = argv[++i] ?? null;
    else if (argv[i] === '--limit') args.limit = Number(argv[++i] ?? 100) || 100;
    else if (argv[i] === '--with-context') args.withContext = true;
  }
  return args;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !process.env.ANTHROPIC_API_KEY) {
    console.error(
      'Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY (try: set -a && source .env.local && set +a).',
    );
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(supabaseUrl, serviceKey);

  let query = supabase
    .from('ingest_eval_cases')
    .select('id, storage_path, file_name, file_mime, expected_type, source_org_id')
    .order('created_at', { ascending: false })
    .limit(args.limit);
  if (args.type) query = query.eq('expected_type', args.type);
  const { data: cases, error } = await query;
  if (error) throw new Error(`Could not load eval cases: ${error.message}`);
  if (!cases || cases.length === 0) {
    console.log('No eval cases found. Promote some from /admin/ingest-learning first.');
    return;
  }

  console.log(`Running ${cases.length} eval case(s)${args.withContext ? ' with org context' : ''}…\n`);
  const results: EvalCaseResult[] = [];

  for (const c of cases) {
    const base: EvalCaseResult = {
      id: c.id,
      fileName: c.file_name,
      expectedType: c.expected_type,
      actualType: 'unsupported',
    };
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('ingest-eval-corpus')
        .download(c.storage_path);
      if (dlErr || !blob) throw new Error(dlErr?.message || 'download failed');

      const orgContext =
        args.withContext && c.source_org_id
          ? await buildIngestOrgContext(supabase, c.source_org_id).catch(() => null)
          : null;

      const result = await classifyDocument({
        fileBytes: new Uint8Array(await blob.arrayBuffer()),
        fileName: c.file_name,
        fileMime: c.file_mime || '',
        orgContext: orgContext ?? undefined,
      });
      base.actualType = result.type;
      base.confidence = result.meta?.confidence;
    } catch (err: any) {
      base.error = err?.message?.slice(0, 200) || 'unknown error';
    }
    const mark = base.error ? '✗ ERR' : base.actualType === base.expectedType ? '✓' : '✗';
    console.log(`  ${mark}  ${base.fileName}  expected=${base.expectedType} actual=${base.actualType}`);
    results.push(base);
  }

  const report = scoreEvalResults(results);
  console.log(`\n${formatEvalReport(report)}`);

  mkdirSync('scripts/eval-out', { recursive: true });
  const outPath = `scripts/eval-out/ingest-eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(outPath, JSON.stringify({ args, results, report }, null, 2));
  console.log(`\nReport written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
