-- Add positive_total and negative_total columns to support net impact calculation.
-- grand_total semantics change from "sum of all capitals" to "net impact (benefits - costs)".
-- Existing rows will have NULL for new columns; the API route handles backward compatibility.

ALTER TABLE impact_valuation_results
  ADD COLUMN IF NOT EXISTS positive_total numeric(14,2),
  ADD COLUMN IF NOT EXISTS negative_total numeric(14,2);

COMMENT ON COLUMN impact_valuation_results.positive_total IS 'Sum of benefit values (human benefits + social + governance)';
COMMENT ON COLUMN impact_valuation_results.negative_total IS 'Sum of cost values (natural capital + living wage gap)';
COMMENT ON COLUMN impact_valuation_results.grand_total IS 'Net impact = positive_total - negative_total';
