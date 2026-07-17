#!/usr/bin/env bash
#
# Vercel staging setup for the alkatera redesign.
#
# Run this on your own machine. It links the repo to a Vercel project, sets the
# production branch to `redesign`, and adds the environment variables. Every
# secret is typed in by you at the interactive prompt, so nothing sensitive is
# stored in this file or passed through Claude.
#
# Prerequisites:
#   npm i -g vercel        # or: pnpm add -g vercel
#   vercel login
#
# The MCP-reachable Vercel connector cannot connect git or set env vars, which
# is why this is a local script rather than something Claude runs.
#
# Usage:
#   chmod +x deploy/vercel-staging-setup.sh
#   ./deploy/vercel-staging-setup.sh
#
set -euo pipefail

TEAM="avallen-solutions"
PROJECT="alkatera-staging"
ENVIRONMENT="production"   # the staging project's own production env (branch = redesign)

# Staging Supabase = the repurposed "HHRubbish Runners" project
# (ref jfzsrahzbeoffvywholp). These two values are public, so they are
# pre-filled; the service-role key is a secret and is prompted for below.
STAGING_SUPABASE_URL="https://jfzsrahzbeoffvywholp.supabase.co"
STAGING_SUPABASE_ANON_KEY="sb_publishable_QqRPx2VZyhvsGjqtaxXzdA_5EW6JS9w"

echo "==> Linking the repo to Vercel project '${PROJECT}' on team '${TEAM}'"
vercel link --yes --project "${PROJECT}" --scope "${TEAM}"

echo
echo "==> Connect the git repo, then set the production branch to 'redesign'"
echo "    in the Vercel dashboard: Project > Settings > Git > Production Branch."
echo "    (The CLI has no stable 'set production branch' command; this one step"
echo "     is a single dropdown in the dashboard.)"
echo

# Helper: add an env var interactively (value typed by you, never echoed here).
addenv() {
  local name="$1"
  echo "  - ${name}"
  vercel env add "${name}" "${ENVIRONMENT}" --scope "${TEAM}" || true
}

echo "==> CORE env vars (required for the app to build and run)"
# --- Supabase (STAGING project = HHRubbish Runners, ref jfzsrahzbeoffvywholp) ---
printf '%s' "${STAGING_SUPABASE_URL}" | vercel env add NEXT_PUBLIC_SUPABASE_URL "${ENVIRONMENT}" --scope "${TEAM}" || true
printf '%s' "${STAGING_SUPABASE_ANON_KEY}" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "${ENVIRONMENT}" --scope "${TEAM}" || true
# The service-role key is a secret: get it from Supabase > Project Settings >
# API > service_role, and type it at the prompt.
addenv SUPABASE_SERVICE_ROLE_KEY
# --- The app's own URL (the staging domain) ---
addenv NEXT_PUBLIC_SITE_URL
addenv NEXT_PUBLIC_APP_URL
# --- AI providers ---
addenv ANTHROPIC_API_KEY
addenv GEMINI_API_KEY
# --- Inngest (staging keys; register this deployment as an Inngest app after) ---
addenv INNGEST_EVENT_KEY
addenv INNGEST_SIGNING_KEY
# --- Scheduling / internal auth ---
addenv CRON_SECRET
addenv INTERNAL_JOB_HMAC_SECRET
addenv ADMIN_EMAIL

echo
echo "==> LCA engine (needed to verify factor matching on staging)"
addenv OPENLCA_SERVER_ENABLED
addenv OPENLCA_SERVER_URL
addenv OPENLCA_API_KEY
addenv OPENLCA_AGRIBALYSE_SERVER_URL
addenv OPENLCA_AGRIBALYSE_URL
addenv OPENLCA_AGRIBALYSE_API_KEY

echo
echo "==> Integrations used by core flows (add the ones you want live on staging)"
addenv RESEND_API_KEY                 # transactional email
addenv PDFSHIFT_API_KEY               # report/LCA PDF rendering
addenv GOOGLE_MAPS_API_KEY            # facility geocoding (served via /api/config/maps)
addenv UPSTASH_REDIS_REST_URL         # rate limiting
addenv UPSTASH_REDIS_REST_TOKEN
# --- Analytics (optional on staging) ---
# addenv NEXT_PUBLIC_POSTHOG_KEY
# addenv NEXT_PUBLIC_POSTHOG_HOST
# --- Stripe (TEST mode keys on staging) ---
# addenv STRIPE_SECRET_KEY
# addenv STRIPE_WEBHOOK_SECRET
# --- SlideSpeak deck export (optional) ---
# addenv SLIDESPEAK_API_KEY
# addenv SLIDESPEAK_WEBHOOK_SECRET
# --- Sender.net marketing (optional) ---
# addenv SENDER_API_TOKEN
# addenv SENDER_ALKATERA_CUSTOMERS_GROUP_ID

echo
echo "==> Email-in (leave unset to keep the feature dormant on staging)"
# addenv EMAIL_INTAKE_ADDRESS
# addenv EMAIL_INTAKE_HOST
# addenv EMAIL_INTAKE_USER
# addenv EMAIL_INTAKE_PASSWORD
# addenv EMAIL_INTAKE_PORT
# addenv EMAIL_INTAKE_SECURE

echo
echo "==> Host-specific OAuth integrations"
echo "    Leave these UNSET on staging unless you register the staging redirect"
echo "    URIs in the Xero / Breww / Square consoles first. If you set them,"
echo "    the redirect URI must match the staging domain exactly."
# addenv XERO_CLIENT_ID
# addenv XERO_CLIENT_SECRET
# addenv XERO_REDIRECT_URI            # must be https://<staging-domain>/api/xero/callback
# addenv XERO_COOKIE_SECRET
# addenv XERO_TOKEN_ENCRYPTION_KEY
# addenv BREWW_API_BASE
# addenv BREWW_CLIENT_ID
# addenv BREWW_CLIENT_SECRET
# addenv BREWW_OAUTH_BASE
# addenv BREWW_OAUTH_REDIRECT_URI     # must match the staging domain
# addenv HOSPITALITY_SQUARE_CLIENT_ID
# addenv HOSPITALITY_SQUARE_CLIENT_SECRET
# addenv UNLEASHED_API_BASE

echo
echo "==> Done. Trigger the first deploy:"
echo "    vercel deploy --prod --scope ${TEAM}"
echo
echo "    Then tell Claude the deployment is live, and it will read the build"
echo "    logs through the Vercel MCP and fix any Vercel-specific failures."
