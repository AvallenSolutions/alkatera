-- Audit: non-conforming units in product_materials
--
-- Read-only. Paste into the Supabase SQL editor and run.
--
-- Lists every unit string in product_materials that is NOT in the canonical
-- unit vocabulary (lib/constants/material-units.ts, values + aliases).
-- These rows are treated as kilograms by the LCA calculator, which can
-- inflate or deflate a footprint by 10-1000x (e.g. a "pint" row counted
-- as 1 kg). Run this BEFORE considering the unit CHECK constraint
-- migration (20262704100000) — apply that only when query 1 returns
-- zero rows.

-- Query 1: distinct offending units with blast radius
WITH vocab(unit) AS (
  VALUES
    -- canonical values
    ('kg'), ('g'), ('mg'), ('t'), ('lb'), ('oz'), ('l'), ('ml'), ('unit'),
    -- kg aliases
    ('kilogram'), ('kilograms'), ('kgs'),
    -- g aliases
    ('gram'), ('grams'),
    -- mg aliases
    ('milligram'), ('milligrams'),
    -- t aliases
    ('tonne'), ('tonnes'), ('metric_ton'), ('metric_tons'), ('metric ton'), ('metric tons'),
    -- lb aliases
    ('lbs'), ('pound'), ('pounds'),
    -- oz aliases
    ('ounce'), ('ounces'),
    -- l aliases
    ('litre'), ('litres'), ('liter'), ('liters'),
    -- ml aliases
    ('millilitre'), ('millilitres'), ('milliliter'), ('milliliters'),
    -- unit aliases
    ('units'), ('item'), ('items'), ('piece'), ('pieces'), ('each'), ('ea'), ('pcs')
)
SELECT
  lower(trim(coalesce(pm.unit, ''))) AS offending_unit,
  count(*)                           AS row_count,
  count(DISTINCT pm.product_id)      AS product_count
FROM public.product_materials pm
WHERE lower(trim(coalesce(pm.unit, ''))) NOT IN (SELECT unit FROM vocab)
GROUP BY 1
ORDER BY 2 DESC;

-- Query 2: sample rows for the offending units (first 100)
WITH vocab(unit) AS (
  VALUES
    ('kg'), ('g'), ('mg'), ('t'), ('lb'), ('oz'), ('l'), ('ml'), ('unit'),
    ('kilogram'), ('kilograms'), ('kgs'),
    ('gram'), ('grams'),
    ('milligram'), ('milligrams'),
    ('tonne'), ('tonnes'), ('metric_ton'), ('metric_tons'), ('metric ton'), ('metric tons'),
    ('lbs'), ('pound'), ('pounds'),
    ('ounce'), ('ounces'),
    ('litre'), ('litres'), ('liter'), ('liters'),
    ('millilitre'), ('millilitres'), ('milliliter'), ('milliliters'),
    ('units'), ('item'), ('items'), ('piece'), ('pieces'), ('each'), ('ea'), ('pcs')
)
SELECT
  pm.id,
  pm.product_id,
  pm.material_name,
  pm.unit,
  pm.quantity,
  pm.material_type
FROM public.product_materials pm
WHERE lower(trim(coalesce(pm.unit, ''))) NOT IN (SELECT unit FROM vocab)
ORDER BY pm.product_id, pm.material_name
LIMIT 100;
