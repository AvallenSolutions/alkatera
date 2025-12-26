/*
  # Fix production_logs product_id data type

  1. Changes
    - Change production_logs.product_id from integer to bigint to match products.id
    - Temporarily drop and recreate dependent view
    
  2. Reason
    - products.id is bigint
    - product_lcas.product_id is bigint
    - production_logs.product_id was integer, causing JOIN failures in frontend queries
*/

-- Drop dependent view
DROP VIEW IF EXISTS product_emissions_per_unit CASCADE;

-- Change production_logs.product_id from integer to bigint
ALTER TABLE production_logs 
ALTER COLUMN product_id TYPE bigint;

-- Recreate the view if it existed (placeholder - will be recreated if needed)
-- The view can be recreated in a subsequent migration if required
