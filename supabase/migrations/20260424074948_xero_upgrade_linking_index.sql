-- Index to efficiently look up Xero transactions by the activity entry
-- that upgraded them. Used when an activity entry is edited or deleted
-- and we need to flip the linked xero_transactions back to pending.
CREATE INDEX IF NOT EXISTS "idx_xero_transactions_upgraded_entry"
  ON "public"."xero_transactions" ("upgraded_entry_table", "upgraded_entry_id")
  WHERE "upgraded_entry_id" IS NOT NULL;
