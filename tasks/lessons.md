# Lessons Learned

## Supabase PostgREST Schema Cache (2026-04-06)

**Problem:** After adding new columns via migration, Supabase queries (both `select('*')` and named column selects) silently return `null` for the new columns. Data written to those columns via PATCH is also silently dropped. No errors are thrown.

**Root Cause:** Supabase's API layer (PostgREST) caches the database schema. When migrations add columns or tables, PostgREST doesn't know about them until the cache is reloaded.

**Fix:**
1. Always add `NOTIFY pgrst, 'reload schema';` at the end of every migration that adds columns or tables
2. If you've already run a migration without this, run `NOTIFY pgrst, 'reload schema';` manually in the SQL Editor
3. This is a one-time action per migration - once the cache is reloaded, it stays current

**Pattern:** All future migrations MUST end with `NOTIFY pgrst, 'reload schema';`

## Type Definitions Must Match Database Schema (2026-04-06)

**Problem:** TypeScript interfaces (`VineyardGrowingProfile`, `OrchardGrowingProfile`) didn't include fields added in recent migrations (TNFD, removal verification, land ownership). This forced `as any` casts and made it easy to miss fields in API route handlers.

**Fix:** When adding new database columns, always update the corresponding TypeScript interface in `lib/types/`. This ensures type safety across the entire data flow (API route -> component -> form -> save).

## API Route POST Handlers Use Explicit Field Lists (2026-04-06)

**Problem:** The POST handlers for vineyard/orchard growing profiles use explicit field lists in the `.insert()` call. When new columns are added via migration, the POST handler silently drops them. PATCH works fine because it uses spread (`...updateFields`).

**Fix:** When adding new database columns, always update the POST handler's explicit field list in the corresponding API route. Check both `app/api/vineyards/[id]/growing-profile/route.ts` and `app/api/orchards/[id]/growing-profile/route.ts`.
