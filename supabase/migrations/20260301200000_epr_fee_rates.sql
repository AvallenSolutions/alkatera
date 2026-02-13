-- =============================================================================
-- EPR: Fee rates reference table + seed data
-- =============================================================================
-- Stores EPR waste management fee rates per material per year.
-- Rates are updateable without code changes when Defra publishes new rates.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.epr_fee_rates (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  fee_year text NOT NULL,                -- '2025-26', '2026-27'
  material_code text NOT NULL,           -- AL, FC, GL, PC, PL, ST, WD, OT
  material_name text NOT NULL,           -- Human-readable name

  -- Year 1 structure: flat rate
  flat_rate_per_tonne numeric,

  -- Year 2+ structure: modulated by RAM rating
  green_rate_per_tonne numeric,
  amber_rate_per_tonne numeric,
  red_rate_per_tonne numeric,

  -- Whether this year uses modulated rates
  is_modulated boolean DEFAULT false NOT NULL,

  created_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT unique_fee_rate UNIQUE (fee_year, material_code)
);

-- RLS: everyone can read fee rates, only platform admins can modify
ALTER TABLE public.epr_fee_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view fee rates"
  ON public.epr_fee_rates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform admins can manage fee rates"
  ON public.epr_fee_rates FOR ALL TO authenticated
  USING (public.is_platform_admin());

-- Comments
COMMENT ON TABLE public.epr_fee_rates IS
  'EPR waste management fee rates per material per fee year. Published by Defra/PackUK.';
COMMENT ON COLUMN public.epr_fee_rates.fee_year IS
  'Fee year in format YYYY-YY, e.g. 2025-26 (April to March).';
COMMENT ON COLUMN public.epr_fee_rates.material_code IS
  'RPD material code: AL (Aluminium), FC (Fibre-based Composite), GL (Glass), PC (Paper/Card), PL (Plastic), ST (Steel), WD (Wood), OT (Other).';
COMMENT ON COLUMN public.epr_fee_rates.is_modulated IS
  'Year 1 (2025-26) uses flat rates only. Year 2+ (2026-27) uses RAM-modulated green/amber/red rates.';

-- =============================================================================
-- Seed: 2025-26 fee rates (Year 1 — flat, confirmed by Defra June 2025)
-- =============================================================================
INSERT INTO public.epr_fee_rates (fee_year, material_code, material_name, flat_rate_per_tonne, is_modulated) VALUES
  ('2025-26', 'AL', 'Aluminium',             266, false),
  ('2025-26', 'FC', 'Fibre-based Composite',  461, false),
  ('2025-26', 'GL', 'Glass',                  192, false),
  ('2025-26', 'PC', 'Paper/Card',             196, false),
  ('2025-26', 'PL', 'Plastic',                423, false),
  ('2025-26', 'ST', 'Steel',                  259, false),
  ('2025-26', 'WD', 'Wood',                   280, false),
  ('2025-26', 'OT', 'Other',                  259, false);

-- =============================================================================
-- Seed: 2026-27 fee rates (Year 2 — modulated, illustrative as of Feb 2026)
-- =============================================================================
INSERT INTO public.epr_fee_rates (fee_year, material_code, material_name, flat_rate_per_tonne, green_rate_per_tonne, amber_rate_per_tonne, red_rate_per_tonne, is_modulated) VALUES
  ('2026-27', 'AL', 'Aluminium',             270, 245, 270, 325, true),
  ('2026-27', 'FC', 'Fibre-based Composite',  525, 475, 525, 630, true),
  ('2026-27', 'GL', 'Glass',                  205, 185, 205, 245, true),
  ('2026-27', 'PC', 'Paper/Card',             210, 190, 210, 250, true),
  ('2026-27', 'PL', 'Plastic',                455, 415, 455, 545, true),
  ('2026-27', 'ST', 'Steel',                  290, 260, 290, 345, true),
  ('2026-27', 'WD', 'Wood',                   450, 410, 450, 540, true),
  ('2026-27', 'OT', 'Other',                  225, 205, 225, 270, true);
