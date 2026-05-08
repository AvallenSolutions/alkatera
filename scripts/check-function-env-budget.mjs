#!/usr/bin/env node
// Validates that env vars forwarded to the Netlify function bundle stay under
// AWS Lambda's 4 KB hard limit. Runs as prebuild so a deploy that would crash
// at function-creation time fails locally / in CI instead, with the offenders
// named.

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

function isExcluded(key) {
  if (PLATFORM_VARS.has(key)) return true;
  if (BUILD_ONLY.has(key)) return true;
  if (SHELL_VARS.has(key)) return true;
  if (CI_VARS.has(key)) return true;
  if (key.startsWith('npm_')) return true;
  if (key.startsWith('NETLIFY_')) return true;
  if (key.startsWith('NF_')) return true;
  if (key.startsWith('AWS_')) return true;
  if (key.startsWith('GITHUB_')) return true;
  if (key.startsWith('NODE_')) return true;
  if (key.startsWith('NEXT_RUNTIME')) return true;
  if (key === 'NODE_ENV') return true;
  return false;
}

function bytesFor(key, value) {
  return Buffer.byteLength(`${key}=${value ?? ''}\0`, 'utf8');
}

const sized = Object.entries(process.env)
  .filter(([k]) => !isExcluded(k))
  .map(([k, v]) => ({ key: k, size: bytesFor(k, v) }))
  .sort((a, b) => b.size - a.size);

const total = sized.reduce((s, v) => s + v.size, 0);

if (total > SAFETY_BUDGET) {
  process.stderr.write(
    `\n❌ Env var function-bundle footprint: ${total} bytes ` +
    `(safety budget ${SAFETY_BUDGET}, AWS hard limit ${HARD_LIMIT}).\n\n` +
    `AWS Lambda rejects function creation when env vars exceed 4 KB. ` +
    `Adding more without trimming will fail the deploy.\n\n` +
    `Top vars by size:\n`,
  );
  for (const { key, size } of sized.slice(0, 15)) {
    process.stderr.write(`  ${String(size).padStart(5)}  ${key}\n`);
  }
  process.stderr.write(
    `\nFix:\n` +
    `  1. Drop unused vars in Netlify (Site config > Environment variables).\n` +
    `  2. Or scope a build-only var to "Builds" and uncheck "Functions".\n` +
    `  3. Or move a long secret to Supabase Vault and read it at runtime.\n` +
    `\nSee docs/env-vars.md for the contract.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `✅ Env var function-bundle footprint: ${total} bytes ` +
  `(${sized.length} vars, under ${SAFETY_BUDGET} budget).\n`,
);
