#!/usr/bin/env node
/**
 * ============================================================================
 *  LOCKED SCORING FILE — the objective measuring stick.
 * ============================================================================
 *
 *  This file defines what "better" means. The Auto Research Engineer (the AI)
 *  may READ and RUN this file to score a variation, but must NEVER edit it.
 *  Changing the definition of the score = moving the goalposts = cheating.
 *  Only the human (Tim) may change this file.
 *
 *  WHAT IS BEING OPTIMISED
 *    The load weight of alkatera's main authenticated pages. We measure the
 *    JavaScript a browser must download + execute before each page is
 *    interactive ("First Load JS"), across the app's primary navigation set.
 *
 *  THE SINGLE NUMBER
 *    score = the AVERAGE First Load JS across the MAIN_ROUTES below, in KB.
 *    LOWER IS BETTER. First Load JS is Next.js's own deterministic measure:
 *    same code in => same number out, zero machine-noise, so every round's
 *    win/loss is trustworthy. Averaging across the set means the biggest lever
 *    — the JS chunk shared by every route — counts on every page at once.
 *
 *  THE CORRECTNESS GATE (anti-cheat)
 *    A variation only gets a score if ALL of these hold:
 *      1. `next build` exits 0. Next type-checks during build, so breaking or
 *         deleting code to shed weight fails the build => no score.
 *      2. EVERY route in MAIN_ROUTES is present in the build output. Deleting
 *         or redirecting a heavy page to drag the average down fails the gate.
 *    If the gate fails, the score is Infinity (a guaranteed loss => auto-revert).
 *
 *  USAGE
 *    node auto-research/score.mjs            # build + score, prints JSON + table
 *    node auto-research/score.mjs --json     # JSON only (machine-readable)
 *
 *  Builds into an isolated dist dir (.next-research) so it never collides with
 *  a running dev server and every measurement is clean and repeatable.
 * ============================================================================
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// The app's main authenticated pages. Every one of these must emit a route in
// `next build`, or the gate fails by design (no deleting pages to win).
const MAIN_ROUTES = [
  '/dashboard',
  '/products',
  '/suppliers',
  '/reports',
  '/performance',
  '/pulse',
  '/certifications',
  '/data/sources',
  '/company/facilities',
  '/hospitality',
  '/governance',
  '/people-culture',
  '/community-impact',
  '/nature-assessment',
  '/epr',
  '/evidence-library',
  '/knowledge-bank',
  '/settings',
];

const DIST_DIR = '.next-research';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const jsonOnly = process.argv.includes('--json');
const log = (...a) => { if (!jsonOnly) console.error(...a); };

// --- 1. Build -------------------------------------------------------------
const nextBin = resolve(repoRoot, 'node_modules/.bin/next');
if (!existsSync(nextBin)) {
  emit({ ok: false, reason: 'next binary not found - run pnpm install', score: Infinity });
}

log(`[score] building ${MAIN_ROUTES.length} main routes into ${DIST_DIR} ...`);
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

// --- 2. Parse the route table --------------------------------------------
// Read each route's "First Load JS" (the last size column). Next prints e.g.:
//   "├ ƒ /dashboard   12.3 kB   456 kB"
function toKB(value, unit) {
  const n = parseFloat(value);
  if (unit === 'MB') return n * 1024;
  if (unit === 'kB' || unit === 'KB') return n;
  if (unit === 'B') return n / 1024;
  return NaN;
}

const found = {};
for (const rawLine of out.split('\n')) {
  const line = rawLine.replace(/[│├└┌─]/g, ' ');
  const m = line.match(/^\s*[○●ƒλ◐]\s+(\/\S*)\s+([\d.]+)\s*(B|kB|KB|MB)\s+([\d.]+)\s*(B|kB|KB|MB)\s*$/);
  if (!m) continue;
  found[m[1]] = toKB(m[4], m[5]);
}

// --- 3. Gate: every main route must be present ---------------------------
const perRoute = {};
const missing = [];
for (const r of MAIN_ROUTES) {
  if (found[r] === undefined || Number.isNaN(found[r])) missing.push(r);
  else perRoute[r] = found[r];
}

if (missing.length) {
  log(`[score] routes missing from build output — gate failed: ${missing.join(', ')}`);
  emit({ ok: false, reason: `routes not present: ${missing.join(', ')}`, score: Infinity, missing });
}

// --- 4. Score = average First Load JS ------------------------------------
const values = MAIN_ROUTES.map((r) => perRoute[r]);
const score = values.reduce((a, b) => a + b, 0) / values.length;

if (!jsonOnly) {
  log('\n[score] First Load JS per main route (KB):');
  for (const r of MAIN_ROUTES) log(`  ${perRoute[r].toFixed(1).padStart(7)}  ${r}`);
  log(`[score] AVERAGE = ${score.toFixed(2)} KB across ${MAIN_ROUTES.length} routes (lower is better)\n`);
}

emit({ ok: true, metric: 'avg_first_load_js_kb', routes: MAIN_ROUTES.length, perRoute, score: Number(score.toFixed(3)) });

// --- helper ---------------------------------------------------------------
function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
  process.exit(obj.ok ? 0 : 1);
}
