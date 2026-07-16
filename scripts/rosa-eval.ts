/**
 * Offline eval harness for Rosa -- Pillar 4 step 4 "Evaluate"
 * (data-revolution-plan.md). Sibling of scripts/ingest-eval.ts.
 *
 * Runs the real, non-streaming tool-use core (lib/rosa/run-tool-loop.ts --
 * the same ROSA_TOOLS catalogue, the same shared system prompt
 * (lib/rosa/system-prompt.ts) as the live chat route, and real exemplar
 * injection (lib/rosa/exemplars.ts)) against the golden corpus
 * (rosa_eval_cases, harvested from the curation queue's "Promote to eval"
 * button at /admin/rosa-learning). Scores each case against its
 * `expectations` (deterministic) plus an optional Claude judge for answer
 * quality, then writes a scoreboard row to rosa_eval_runs.
 *
 * NEVER wired into CI: a real run spends real Gemini (and, with the judge,
 * Anthropic) tokens against real org data. Run manually:
 *
 *   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/rosa-eval.ts [--limit 20] [--dry-run] [--no-judge]
 *
 * The --conditions=react-server flag is required: lib/rosa/tools.ts pulls
 * in lib/auth/advisor-access.ts, which is marked `import 'server-only'` --
 * a Next.js marker package that throws unless the "react-server" export
 * condition is active (Next's bundler sets it automatically; a plain tsx/
 * node run doesn't, so it must be set explicitly). Without the flag the
 * script fails fast with "This module cannot be imported from a Client
 * Component module" before it does anything.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
 * GEMINI_API_KEY (source .env.local). ANTHROPIC_API_KEY is optional -- the
 * LLM judge is skipped (not failed) when it's absent. --dry-run skips the
 * model call entirely (a stub "no answer" result flows through the same
 * scoring + reporting code) so the harness plumbing itself can be proven
 * without spending tokens or needing GEMINI_API_KEY, and is never written
 * to rosa_eval_runs.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { runToolLoop, type RunToolLoopResult } from '../lib/rosa/run-tool-loop';
import { buildRosaSystemPrompt } from '../lib/rosa/system-prompt';
import { buildMemoryBlock } from '../lib/rosa/memory';
import { selectExemplars } from '../lib/rosa/exemplars';
import { checkExpectations, type Expectations } from '../lib/rosa/eval-checks';

const JUDGE_MODEL = 'claude-sonnet-4-6';

interface CliArgs {
  limit: number;
  dryRun: boolean;
  noJudge: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { limit: 50, dryRun: false, noJudge: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') args.limit = Number(argv[++i] ?? 50) || 50;
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--no-judge') args.noJudge = true;
  }
  return args;
}


interface JudgeVerdict {
  score: number;
  rationale: string;
}

async function judgeAnswer(anthropic: Anthropic, question: string, answerText: string): Promise<JudgeVerdict | null> {
  try {
    const msg = await anthropic.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Question a drinks-industry user asked a sustainability assistant: "${question}"\n\nThe assistant's answer:\n"""\n${answerText}\n"""\n\nRate the answer's quality on a 1-5 scale (5 = accurate, plain language, actionable; 1 = wrong, jargon-heavy, or unhelpful). Respond with ONLY a JSON object, no other text: {"score": <1-5>, "rationale": "<one short sentence>"}`,
        },
      ],
    });
    const block = msg.content.find((c) => c.type === 'text');
    const text = block && block.type === 'text' ? block.text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.score !== 'number') return null;
    return { score: parsed.score, rationale: String(parsed.rationale ?? '') };
  } catch (err) {
    console.warn('[rosa-eval] judge call failed, continuing without a judge score:', (err as Error)?.message);
    return null;
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const args = parseArgs(process.argv.slice(2));

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (try: set -a && source .env.local && set +a).');
    process.exit(1);
  }
  if (!args.dryRun && !geminiKey) {
    console.error('Missing GEMINI_API_KEY. Pass --dry-run to exercise the harness without a model call.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropic = anthropicKey && !args.noJudge && !args.dryRun ? new Anthropic({ apiKey: anthropicKey }) : null;

  const { data: cases, error } = await supabase
    .from('rosa_eval_cases')
    .select('id, question, org_snapshot, expectations, source_case')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(args.limit);
  if (error) throw new Error(`Could not load eval cases: ${error.message}`);
  if (!cases || cases.length === 0) {
    console.log('No eval cases found. Promote some from /admin/rosa-learning first.');
    return;
  }

  console.log(`Running ${cases.length} eval case(s)${args.dryRun ? ' [DRY RUN -- no model call]' : ''}${anthropic ? ' with LLM judge' : ''}…\n`);

  const results: Array<Record<string, unknown>> = [];
  let passed = 0;

  for (const c of cases) {
    const orgSnapshot = (c.org_snapshot ?? {}) as { organization_id?: string };
    const organizationId = orgSnapshot.organization_id;

    if (!organizationId) {
      console.log(`  ✗ SKIP  ${c.question.slice(0, 60)}  (no organisation_id in org_snapshot)`);
      results.push({ id: c.id, question: c.question, skipped: true, reason: 'no organisation_id in org_snapshot' });
      continue;
    }

    const { data: member } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .limit(1)
      .maybeSingle();
    if (!member) {
      console.log(`  ✗ SKIP  ${c.question.slice(0, 60)}  (no member found for organisation ${organizationId})`);
      results.push({ id: c.id, question: c.question, skipped: true, reason: 'no organisation member found to run as' });
      continue;
    }
    const userId = member.user_id as string;

    let toolResult: RunToolLoopResult;
    if (args.dryRun) {
      toolResult = { text: '[dry run -- no model call]', tools: [], rounds: 0, stopped_early: false };
    } else {
      const memoryBlock = await buildMemoryBlock(supabase, organizationId, userId).catch(() => '');
      const exemplarBlock = await selectExemplars(supabase, c.question).catch(() => null);
      const systemPrompt =
        buildRosaSystemPrompt(memoryBlock) + (exemplarBlock ? `\n\n---\n## Worked examples\n${exemplarBlock}\n---` : '');

      try {
        toolResult = await runToolLoop({
          apiKey: geminiKey!,
          systemPrompt,
          userMessage: c.question,
          toolContext: { supabase, organizationId, userId },
        });
      } catch (err: any) {
        console.log(`  ✗ ERR   ${c.question.slice(0, 60)}  ${err?.message?.slice(0, 120) ?? 'unknown error'}`);
        results.push({ id: c.id, question: c.question, error: err?.message ?? 'unknown error' });
        continue;
      }
    }

    const expectationResults = checkExpectations((c.expectations ?? {}) as Expectations, toolResult);
    const casePassed = expectationResults.every((r) => r.pass);
    if (casePassed) passed++;

    const judge = anthropic ? await judgeAnswer(anthropic, c.question, toolResult.text) : null;

    const mark = casePassed ? '✓' : '✗';
    const expSummary = expectationResults.length
      ? expectationResults.map((r) => `${r.pass ? 'ok' : 'FAIL'}:${r.name}`).join(' ')
      : '(no expectations set)';
    console.log(`  ${mark}  ${c.question.slice(0, 60)}  ${expSummary}${judge ? `  judge=${judge.score}/5` : ''}`);

    results.push({
      id: c.id,
      question: c.question,
      organization_id: organizationId,
      pass: casePassed,
      expectations: expectationResults,
      tools_called: toolResult.tools.map((t) => t.name),
      rounds: toolResult.rounds,
      answer_excerpt: toolResult.text.slice(0, 400),
      judge,
    });
  }

  const scored = results.filter((r) => !r.skipped && !r.error);
  console.log(`\n${passed}/${scored.length} passed (${cases.length - scored.length} skipped/errored)`);

  mkdirSync('scripts/eval-out', { recursive: true });
  const outPath = `scripts/eval-out/rosa-eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(outPath, JSON.stringify({ args, results }, null, 2));
  console.log(`Report written to ${outPath}`);

  if (args.dryRun) {
    console.log('[DRY RUN] Not written to rosa_eval_runs.');
    return;
  }

  const { error: runErr } = await supabase.from('rosa_eval_runs').insert({
    total: scored.length,
    passed,
    results,
  });
  if (runErr) console.warn('[rosa-eval] Could not write the scoreboard row:', runErr.message);
  else console.log('Scoreboard row written to rosa_eval_runs.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
