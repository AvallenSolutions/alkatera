#!/usr/bin/env node
// Validates that env vars forwarded to the Netlify function bundle stay under
// AWS Lambda's 4 KB hard limit. Runs as prebuild so a deploy that would crash
// at function-creation time fails locally / in CI instead, with the offenders
// named.
//
// Caveat: at build time, all env vars are visible in process.env regardless of
// scope. We can't ask Netlify which vars are scoped to "Functions" without
// hitting their API. So we assume `NEXT_PUBLIC_*` vars are NOT on Functions
// scope - that is the contract documented in docs/env-vars.md and is also the
// recommended Next.js pattern (those values are inlined into the bundle at
// build time, so the Lambda never reads them from env).

const HARD_LIMIT = 4096;
const SAFETY_BUDGET = 3500;

const PLATFORM_VARS = new Set([
  'NETLIFY', 'NETLIFY_DEV', 'NETLIFY_LOCAL', 'NETLIFY_BUILD_BASE', 'NETLIFY_IMAGES_CDN_DOMAIN',
  'BUILD_ID', 'COMMIT_REF', 'CACHED_COMMIT_REF', 'BRANCH', 'HEAD',
  'CONTEXT', 'DEPLOY_ID', 'DEPLOY_PRIME_URL', 'DEPLOY_URL',
  'INCOMING_HOOK_BODY', 'INCOMING_HOOK_TITLE', 'INCOMING_HOOK_URL',
  'PULL_REQUEST', 'REPOSITORY_URL', 'REVIEW_ID', 'SITE_ID', 'SITE_NAME', 'URL',
  'LAMBDA_TASK_ROOT', 'LAMBDA_RUNTIME_DIR', 'AWS_REGION',
]);

const BUILD_ONLY = new Set([
  'NODE_VERSION', 'NEXT_TELEMETRY_DISABLED', 'NODE_OPTIONS',
  // FEATURE_FLAGS is injected by Netlify's own build system (its internal
  // per-site feature flags, as a JSON blob — can be ~9 KB). It is NOT a
  // user/config env var (absent from `netlify env:list` / `env:get`) and
  // is NOT forwarded to the Lambda function runtime — it exists only at
  // build time for build plugins. Counting it here was a false positive
  // that masked the real offenders.
  'FEATURE_FLAGS',
]);

const SHELL_VARS = new Set([
  'HOME', 'PATH', 'PWD', 'OLDPWD', 'USER', 'LOGNAME', 'SHELL', 'TERM', 'TERM_PROGRAM',
  'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'TMPDIR', 'TMP', 'TEMP',
  'SHLVL', 'HOSTNAME', '_', 'PS1', 'PS2', 'IFS', 'OPTERR',
]);

const CI_VARS = new Set([
  'CI', 'GITHUB_ACTIONS', 'GITHUB_WORKFLOW', 'GITHUB_RUN_ID', 'GITHUB_TOKEN',
  'GITHUB_REF', 'GITHUB_SHA', 'GITHUB_REPOSITORY', 'GITHUB_ACTOR',
]);

function isPlatformOrShell(key) {
  if (PLATFORM_VARS.has(key)) return true;
  if (BUILD_ONLY.has(key)) return true;
  if (SHELL_VARS.has(key)) return true;
  if (CI_VARS.has(key)) return true;
  if (key.startsWith('npm_')) return true;
  // Note: do NOT prefix-match NETLIFY_*. User-set vars like NETLIFY_EMAILS_*
  // start with that prefix and DO count against the Lambda quota - they need
  // to be in the explicit PLATFORM_VARS set above if they are platform-internal.
  if (key.startsWith('NF_')) return true;
  if (key.startsWith('AWS_')) return true;
  if (key.startsWith('GITHUB_')) return true;
  if (key.startsWith('NODE_')) return true;
  if (key.startsWith('NEXT_RUNTIME')) return true;
  if (key === 'NODE_ENV') return true;
  return false;
}

// Vars that the contract (docs/env-vars.md) says should NOT be Functions-scoped.
// Next.js inlines NEXT_PUBLIC_* references at build time, so the Lambda never
// reads them from env. If you have one of these still on Functions scope in
// Netlify, scope it to "Builds" + "Runtime" + "Post processing" only.
function presumedOffFunctions(key) {
  return key.startsWith('NEXT_PUBLIC_');
}

function bytesFor(key, value) {
  return Buffer.byteLength(`${key}=${value ?? ''}\0`, 'utf8');
}

const all = Object.entries(process.env)
  .filter(([k]) => !isPlatformOrShell(k))
  .map(([k, v]) => ({
    key: k,
    size: bytesFor(k, v),
    presumedOffFunctions: presumedOffFunctions(k),
  }))
  .sort((a, b) => b.size - a.size);

const functionScoped = all.filter(v => !v.presumedOffFunctions);
const presumedSkipped = all.filter(v => v.presumedOffFunctions);

const total = functionScoped.reduce((s, v) => s + v.size, 0);
const skippedTotal = presumedSkipped.reduce((s, v) => s + v.size, 0);

const STRICT = process.env.STRICT_ENV_BUDGET === '1';

if (total > SAFETY_BUDGET) {
  const stream = STRICT ? process.stderr : process.stdout;
  const icon = STRICT ? '❌' : '⚠️ ';
  stream.write(
    `\n${icon} Estimated function-bundle env footprint: ${total} bytes ` +
    `(safety budget ${SAFETY_BUDGET}, AWS hard limit ${HARD_LIMIT}).\n\n` +
    `AWS Lambda rejects function creation when env vars exceed 4 KB. ` +
    `If the real payload is over budget the deploy will fail at the ` +
    `function-creation step.\n\n` +
    `Top function-scoped vars by size:\n`,
  );
  for (const { key, size } of functionScoped.slice(0, 15)) {
    stream.write(`  ${String(size).padStart(5)}  ${key}\n`);
  }
  if (presumedSkipped.length > 0) {
    stream.write(
      `\n${presumedSkipped.length} vars excluded from count ` +
      `(${skippedTotal} bytes, presumed not Functions-scoped per contract):\n`,
    );
    for (const { key, size } of presumedSkipped) {
      stream.write(`  ${String(size).padStart(5)}  ${key}\n`);
    }
    stream.write(
      `If any of these is still on Functions scope in Netlify, the real payload ` +
      `is larger than this estimate.\n`,
    );
  }
  stream.write(
    `\nFix:\n` +
    `  1. Drop unused vars in Netlify (Site config > Environment variables).\n` +
    `  2. Or scope a build-only var off Functions (uncheck "Functions" in Scopes).\n` +
    `  3. Or move a long secret to Supabase Vault and read it at runtime.\n` +
    `\nSee docs/env-vars.md for the contract.\n`,
  );
  if (STRICT) {
    stream.write(`\n`);
    process.exit(1);
  }
  stream.write(
    `\nProceeding with build (set STRICT_ENV_BUDGET=1 to fail builds on this).\n\n`,
  );
} else {
  process.stdout.write(
    `✅ Estimated function-bundle env footprint: ${total} bytes ` +
    `(${functionScoped.length} vars, under ${SAFETY_BUDGET} budget` +
    `${presumedSkipped.length > 0 ? `, ${presumedSkipped.length} NEXT_PUBLIC_* presumed off Functions` : ''}` +
    `).\n`,
  );
}
