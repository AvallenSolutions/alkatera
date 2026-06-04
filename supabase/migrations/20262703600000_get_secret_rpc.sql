-- ============================================================
-- get_secret RPC — read runtime secrets from Supabase Vault
-- ============================================================
-- AWS Lambda caps a function's env at 4 KB. Long secrets (the ~1 KB
-- Sender.net API token) are moving out of the Netlify Functions env and
-- into Vault; routes read them at runtime with the service-role key via
-- this function. See docs/env-vars.md (option 3) + lib/secrets/vault.ts.
--
-- Security: SECURITY DEFINER so it can read vault.decrypted_secrets, but
-- execute is granted ONLY to service_role. anon / authenticated cannot
-- call it, so a public client can never read a secret.
-- ============================================================

begin;

-- Vault is normally already enabled on Supabase projects; harmless if so.
create extension if not exists supabase_vault;

create or replace function public.get_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
  limit 1;
$$;

revoke all on function public.get_secret(text) from public;
revoke all on function public.get_secret(text) from anon;
revoke all on function public.get_secret(text) from authenticated;
grant execute on function public.get_secret(text) to service_role;

commit;
