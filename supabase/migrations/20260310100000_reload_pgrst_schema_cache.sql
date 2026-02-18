-- Reload PostgREST schema cache
--
-- After multiple CREATE OR REPLACE FUNCTION migrations, PostgREST may be
-- serving stale function definitions from its schema cache. This sends the
-- NOTIFY signal to force a cache reload.

NOTIFY pgrst, 'reload schema';
