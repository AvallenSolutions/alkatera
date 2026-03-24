-- Add columns for storing low-confidence AI suggestions for manual review
-- These are populated during sync when AI confidence is between 0.3 and 0.7

ALTER TABLE xero_transactions
  ADD COLUMN IF NOT EXISTS ai_suggested_category text,
  ADD COLUMN IF NOT EXISTS ai_suggested_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_suggested_reasoning text;

-- Add 'needs_review' to the upgrade_status check if it uses an enum or check constraint
-- (If upgrade_status is just text, this is a no-op but good for documentation)
COMMENT ON COLUMN xero_transactions.ai_suggested_category IS 'AI-suggested emission category stored for manual review (confidence < 0.7)';
COMMENT ON COLUMN xero_transactions.ai_suggested_confidence IS 'Confidence score of the AI suggestion (0.0-1.0)';
COMMENT ON COLUMN xero_transactions.ai_suggested_reasoning IS 'AI reasoning for the suggestion, shown to user during review';
