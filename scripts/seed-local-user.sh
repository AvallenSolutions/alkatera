#!/usr/bin/env bash
# Create a local-dev login user against the LOCAL Supabase Auth admin API and
# attach it to the synthetic "Local Dev Co" org (seeded by supabase/seed.sql) as owner.
#
# Safe by construction: it only ever talks to 127.0.0.1 and uses the well-known local
# service-role key from `supabase status`. It will refuse to run against anything else.
#
# Usage:  ./scripts/seed-local-user.sh            (defaults below)
#         EMAIL=me@local.test PASSWORD=secret123 ./scripts/seed-local-user.sh
set -euo pipefail

EMAIL="${EMAIL:-dev@local.test}"
PASSWORD="${PASSWORD:-localdev123}"
ORG_ID="11111111-1111-1111-1111-111111111111"
OWNER_ROLE_ID="8b90b4ff-366c-4bdd-a349-b65f737fe5ef"

API_URL="$(supabase status -o env | sed -n 's/^API_URL="\(.*\)"/\1/p')"
SERVICE_KEY="$(supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"/\1/p')"

case "$API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "REFUSING: API_URL is not local ($API_URL). This script is local-only." >&2; exit 1 ;;
esac

echo "Creating user $EMAIL on $API_URL ..."
RESP="$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Local Dev\",\"organization_id\":\"$ORG_ID\",\"role_id\":\"$OWNER_ROLE_ID\"}}")"

USER_ID="$(printf '%s' "$RESP" | sed -n 's/.*"id":"\([0-9a-f-]\{36\}\)".*/\1/p' | head -1)"
if [ -z "$USER_ID" ]; then
  echo "User may already exist or creation failed. Response:" >&2
  printf '%s\n' "$RESP" >&2
fi

# Ensure membership exists (handle_new_user wires it from metadata, but make it idempotent),
# and set the user's current org in server-only app_metadata so RLS resolves it.
DB="$(docker ps --format '{{.Names}}' | grep -E 'supabase_db' | head -1)"
docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
INSERT INTO public.organization_members (organization_id, user_id, role_id, joined_at)
SELECT '$ORG_ID', u.id, '$OWNER_ROLE_ID', now()
FROM auth.users u WHERE u.email = '$EMAIL'
ON CONFLICT (organization_id, user_id) DO NOTHING;

UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb)
    || jsonb_build_object('current_organization_id','$ORG_ID')
WHERE email = '$EMAIL';
SQL

echo "Done. Log in locally with: $EMAIL / $PASSWORD"
