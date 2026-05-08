# Environment variables on Netlify

## The 4 KB ceiling

AWS Lambda rejects function creation when the total size of environment
variables passed in exceeds **4096 bytes** (key + value + per-entry overhead,
all summed across every variable). Netlify forwards user-set env vars to the
Lambda functions it creates from the Next.js handler and from
`netlify/functions/`, so once the cumulative size crosses that line every
deploy fails with:

```
Failed to create function: invalid parameter for function creation:
Your environment variables exceed the 4KB limit imposed by AWS Lambda
```

To catch this before it ships, `npm run build` runs
`scripts/check-function-env-budget.mjs` as a `prebuild` step. The guard fails
if the total user-managed env footprint exceeds **3500 bytes** (leaves
~600 B headroom for AWS internal padding). On failure it prints the largest
vars, so the offender is obvious.

Run it on demand with:

```sh
npm run check:env-budget
```

## Where each variable belongs

| Where it lives | What goes there |
|---|---|
| `netlify.toml` `[build.environment]` | Build-only switches that are not secret. Already covers `NODE_VERSION`, `NEXT_TELEMETRY_DISABLED`, `NODE_OPTIONS`. These are *not* forwarded to functions. |
| Netlify dashboard, scope = **Builds** | Build-time-only secrets, e.g. anything used only by `next build` itself. Toggle off the "Functions" scope in *Edit > Scopes* to keep them out of the Lambda env. |
| Netlify dashboard, scope = **Functions** | Runtime secrets read by `app/api/**/route.ts` or `netlify/functions/*.ts`. These count against the 4 KB budget. |
| Supabase Vault / secrets table | Anything large, rarely used, or that would push the budget over. Functions read it on cold start using `SUPABASE_SERVICE_ROLE_KEY`. |

`NEXT_PUBLIC_*` vars are inlined into the client bundle at build, but Next.js
server code still reads them via `process.env` at runtime, so they need to
stay on the Functions scope.

## When the guard fails

Three escape hatches, in order of preference:

1. **Drop unused vars.** Look at the failure output for top offenders and
   check whether anything is left over from a retired integration. Remove it
   from Netlify entirely.
2. **Move build-time switches off the Functions scope.** In the Netlify UI,
   open the variable, click *Edit > Scopes*, uncheck *Functions*. The
   variable still appears during `npm run build` but no longer rides along to
   Lambda.
3. **Move long secrets to Supabase Vault.** For values that are unavoidably
   large (signed JSON blobs, multi-key configs, long PEMs), keep a single
   pointer or short ID in env and fetch the body at runtime.

## When you add a new env var

- Set its scope explicitly. If it is only used at build time, uncheck
  *Functions*.
- Run `npm run check:env-budget` locally with the same env loaded to confirm
  you have headroom.
- The Netlify build will run the same check. If it fails, the build log
  names the worst-cost vars, which is usually enough to decide what to cut.
