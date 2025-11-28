/*
  # Fix Production Sites Trigger Infinite Recursion

  The trigger_recalculate_production_shares was causing infinite recursion because:
  1. After INSERT/UPDATE/DELETE, it would UPDATE all records
  2. This UPDATE would trigger the BEFORE UPDATE trigger
  3. Which would cause another AFTER UPDATE
  4. Creating an infinite loop

  ## Solution
  Remove the problematic AFTER trigger. The BEFORE trigger already handles all the calculations
  we need when a record is inserted or updated. We don't need to recalculate shares for
  all records every time one changes.

  ## Changes
  - Drop the trigger_recalculate_production_shares trigger and function
  - Keep only the trigger_calculate_production_site_metrics BEFORE trigger
  - This single trigger is sufficient for all calculations
*/

-- Drop the problematic AFTER trigger that causes infinite recursion
DROP TRIGGER IF EXISTS trigger_recalculate_production_shares ON public.product_lca_production_sites;

-- Drop the function that's no longer needed
DROP FUNCTION IF EXISTS recalculate_all_production_shares();

-- The remaining BEFORE trigger (trigger_calculate_production_site_metrics) is sufficient
-- It calculates share_of_production correctly for each insert/update
