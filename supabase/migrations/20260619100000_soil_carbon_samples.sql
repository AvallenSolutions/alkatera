-- Measured soil carbon: stock-change tracking
--
-- Shifts soil carbon from a single annual flux (soil_carbon_override_kg_co2e_per_ha
-- on the annual growing profile) to repeated field measurements of soil organic
-- carbon (SOC) STOCK over time. The annual change between two consistent-depth
-- samples becomes the measured removal flux ("measure the place, track the
-- trajectory"). Soil carbon is a property of the LAND, sampled every few years,
-- so it lives in a field-level time-series table keyed to the land unit rather
-- than the annual growing profile.

-- 1. Sampling depth + measured stock-change cache on the growing profiles -----
--    sampling_depth_cm: lets a one-off measured value record the depth it was
--    taken to, so it is comparable and auditable (consistency is where MRV
--    credibility lives).
--    soil_carbon_annual_change_* : a denormalised cache of the measured annual
--    SOC stock-change flux derived from soil_carbon_samples (see section 2),
--    written by the samples API route. The LCA calculators read it with priority
--    over the manual override and practice-based defaults.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['arable_growing_profiles','vineyard_growing_profiles','orchard_growing_profiles'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS sampling_depth_cm integer', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS soil_carbon_annual_change_kg_co2e_per_ha numeric', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS soil_carbon_change_methodology text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS soil_carbon_change_confidence text', t);
  END LOOP;
END $$;

-- 2. Time-series of SOC stock measurements per land unit ---------------------
CREATE TABLE IF NOT EXISTS public.soil_carbon_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  -- Land unit this measurement belongs to (no single FK; resolved by type).
  land_unit_type text NOT NULL,
  land_unit_id uuid NOT NULL,
  sample_date date NOT NULL,
  depth_cm integer NOT NULL,
  -- Either a measured SOC stock is supplied directly, or the raw lab values
  -- (concentration + bulk density) from which the stock is derived.
  soc_input_method text NOT NULL DEFAULT 'stock',
  soc_stock_tc_ha numeric,
  soc_concentration_pct numeric,
  bulk_density_g_cm3 numeric,
  sampling_points integer,
  lab_name text,
  methodology text,
  -- Verification (mirrors the removal-verification columns on growing profiles).
  verification_status text NOT NULL DEFAULT 'unverified',
  verifier_body text,
  verifier_standard text,
  verification_date date,
  verification_expiry date,
  evidence_object_path text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT soil_carbon_samples_land_unit_type_check
    CHECK (land_unit_type = ANY (ARRAY['arable_field'::text, 'vineyard'::text, 'orchard'::text])),
  CONSTRAINT soil_carbon_samples_input_method_check
    CHECK (soc_input_method = ANY (ARRAY['stock'::text, 'concentration'::text])),
  CONSTRAINT soil_carbon_samples_depth_check
    CHECK (depth_cm > 0 AND depth_cm <= 200),
  CONSTRAINT soil_carbon_samples_verification_status_check
    CHECK (verification_status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text, 'rejected'::text, 'expired'::text])),
  -- The chosen input method must carry the values it needs.
  CONSTRAINT soil_carbon_samples_values_present_check
    CHECK (
      (soc_input_method = 'stock' AND soc_stock_tc_ha IS NOT NULL)
      OR (soc_input_method = 'concentration' AND soc_concentration_pct IS NOT NULL AND bulk_density_g_cm3 IS NOT NULL)
    )
);

ALTER TABLE public.soil_carbon_samples OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_soil_carbon_samples_land_unit
  ON public.soil_carbon_samples USING btree (land_unit_type, land_unit_id, sample_date);
CREATE INDEX IF NOT EXISTS idx_soil_carbon_samples_org
  ON public.soil_carbon_samples USING btree (organization_id);

-- updated_at maintenance (reuse the shared trigger function)
DROP TRIGGER IF EXISTS soil_carbon_samples_set_updated_at ON public.soil_carbon_samples;
CREATE TRIGGER soil_carbon_samples_set_updated_at
  BEFORE UPDATE ON public.soil_carbon_samples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RLS: org-scoped access (matches the soil-carbon-evidence pattern) --------
ALTER TABLE public.soil_carbon_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organisation soil carbon samples" ON public.soil_carbon_samples;
CREATE POLICY "Users can view their organisation soil carbon samples"
  ON public.soil_carbon_samples FOR SELECT
  USING (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert soil carbon samples for their organisation" ON public.soil_carbon_samples;
CREATE POLICY "Users can insert soil carbon samples for their organisation"
  ON public.soil_carbon_samples FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update their organisation soil carbon samples" ON public.soil_carbon_samples;
CREATE POLICY "Users can update their organisation soil carbon samples"
  ON public.soil_carbon_samples FOR UPDATE
  USING (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete their organisation soil carbon samples" ON public.soil_carbon_samples;
CREATE POLICY "Users can delete their organisation soil carbon samples"
  ON public.soil_carbon_samples FOR DELETE
  USING (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  ));

-- 4. Restrictive read-only-advisor write block (defence in depth) ------------
--    AND'd with the permissive policies above; blocks writes by read-only
--    advisors, consistent with the 17 org data tables in
--    20260618130000_advisor_access_levels.sql.
DROP POLICY IF EXISTS advisor_ro_no_insert ON public.soil_carbon_samples;
CREATE POLICY advisor_ro_no_insert ON public.soil_carbon_samples
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_readonly_advisor(organization_id));

DROP POLICY IF EXISTS advisor_ro_no_update ON public.soil_carbon_samples;
CREATE POLICY advisor_ro_no_update ON public.soil_carbon_samples
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_readonly_advisor(organization_id));

DROP POLICY IF EXISTS advisor_ro_no_delete ON public.soil_carbon_samples;
CREATE POLICY advisor_ro_no_delete ON public.soil_carbon_samples
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_readonly_advisor(organization_id));

GRANT ALL ON TABLE public.soil_carbon_samples TO anon;
GRANT ALL ON TABLE public.soil_carbon_samples TO authenticated;
GRANT ALL ON TABLE public.soil_carbon_samples TO service_role;

COMMENT ON TABLE public.soil_carbon_samples IS
  'Field-level time series of measured soil organic carbon (SOC) stock per land unit. The annual change between consistent-depth samples is the measured removal flux (GHG Protocol LSR v1.0 / SBTi FLAG).';
