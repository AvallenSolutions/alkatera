-- Data revolution Phase D / Pillar 3: the Ask Queue.
--
-- lib/asks/generate.ts's sweepAsks() regenerates `agent_exceptions` rows
-- with kind='ask' on every footprint-agent run (app/api/agents/footprint/run/route.ts).
-- Idempotency needs a real unique constraint, same pattern as
-- 20260716120000_agent_exceptions_source_ref_indexes.sql: a partial unique
-- index on the stable dedupe_key each ask candidate carries in its payload
-- (lib/asks/types.ts AskPayload.dedupe_key), scoped per organisation and to
-- kind='ask' so it never collides with the unrelated source_ref-keyed
-- indexes the other kinds already use.
--
-- Scoped to status='open' as well as kind='ask': once an ask is answered,
-- rejected or deferred its dedupe_key must be free to reuse. Without this,
-- an approved ask would permanently occupy its dedupe_key — if the
-- underlying gap later recurs (a corrected material reverts to a proxy
-- factor on re-import, a confirmed utility entry gets edited back to an
-- estimate), sweepAsks' insert would hit a unique-violation against the
-- long-since-resolved row and silently fail to raise the new ask, forever.
-- sweepAsks' own dedupe check (existingOpen, in generate.ts) already only
-- looks at status='open' rows, so this matches the app-level idempotency
-- contract exactly rather than being stricter than it.

CREATE UNIQUE INDEX IF NOT EXISTS agent_exceptions_ask_dedupe_key_idx
  ON public.agent_exceptions (organization_id, (payload ->> 'dedupe_key'))
  WHERE kind = 'ask' AND status = 'open' AND payload ->> 'dedupe_key' IS NOT NULL;
