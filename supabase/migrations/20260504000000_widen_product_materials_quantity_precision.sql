-- Widen quantity precision from numeric(10,4) to numeric(12,6)
-- Allows very small packaging weights (e.g. label 0.0018g stored as 0.0000018 kg)
-- without rounding to 0.0000 and violating the positive_quantity constraint.

ALTER TABLE product_materials
  ALTER COLUMN quantity TYPE numeric(12,6);
