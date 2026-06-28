#!/usr/bin/env node
/**
 * ============================================================================
 *  LOCKED SCORING FILE (Rosa hub) — the objective measuring stick for /rosa.
 * ============================================================================
 *
 *  The Auto Research Engineer (the AI) may READ and RUN this file to score a
 *  variation, but must NEVER edit it. Only the human (Tim) may change it.
 *  Same methodology and rules as auto-research/score.mjs and instructions.md.
 *
 *  WHAT IS BEING OPTIMISED
 *    The load weight of the /rosa hub — the first page a user lands on.
 *
 *  THE SINGLE NUMBER
 *    score = First Load JS of /rosa, in KB (from `next build`). LOWER IS BETTER.
 *    Deterministic, zero machine-noise.
 *
 *  THE CORRECTNESS GATE (anti-cheat)
 *    A variation only scores if BOTH hold:
 *      1. `next build` exits 0 (Next type-checks, so breaking/deleting code fails).
 *      2. The /rosa route is present in the build output.
 *    Otherwise score = Infinity (a guaranteed loss => auto-revert).
 *
 *  USAGE
 *    node auto-research/score-rosa.mjs            # build + score, prints JSON
 *    node auto-research/score-rosa.mjs --json     # JSON only
 *
 *  Builds into an isolated dist dir (.next-research) so it never collides with a
 *  running dev server and every measurement is clean and repeatable.
 * ============================================================================
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const TARGET_ROUTE = '/rosa';
const DIST_DIR = '.next-research';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const jsonOnly = process.argv.includes('--json');
const log = (...a) => { if (!jsonOnly) console.error(...a); };

const nextBin = resolve(repoRoot, 'node_modules/.bin/next');
if (!existsSync(nextBin)) {
  emit({ ok: false, reason: 'next binary not found - run pnpm install', score: Infinity });
}

log(`[score] building ${TARGET_ROUTE} into ${DIST_DIR} ...`);
const build = spawnSync(nextBin, ['build'], {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_DIST_DIR: DIST_DIR },
});

const out = `${build.stdout || ''}${build.stderr || ''}`;

if (build.status !== 0) {
  log('[score] BUILD FAILED — correctness gate not satisfied.');
  emit({ ok: false, reason: `build exited ${build.status}`, score: Infinity, buildExit: build.status });
}

function toKB(value, unit) {
  const n = parseFloat(value);
  if (unit === 'MB') return n * 1024;
  if (unit === 'kB' || unit === 'KB') return n;
  if (unit === 'B') return n / 1024;
  return NaN;
}

let score = null;
for (const rawLine of out.split('\n')) {
  const line = rawLine.replace(/[│├└┌─]/g, ' ');
  const m = line.match(/^\s*[○●ƒλ◐]\s+(\/\S*)\s+([\d.]+)\s*(B|kB|KB|MB)\s+([\d.]+)\s*(B|kB|KB|MB)\s*$/);
  if (!m) continue;
  if (m[1] === TARGET_ROUTE) { score = toKB(m[4], m[5]); break; }
}

if (score === null || Number.isNaN(score)) {
  log(`[score] route ${TARGET_ROUTE} not found in build output — gate failed.`);
  emit({ ok: false, reason: `route ${TARGET_ROUTE} not present`, score: Infinity });
}

log(`[score] ${TARGET_ROUTE} First Load JS = ${score} KB  (lower is better)`);
emit({ ok: true, target: TARGET_ROUTE, metric: 'first_load_js_kb', score });

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
  process.exit(obj.ok ? 0 : 1);
}
