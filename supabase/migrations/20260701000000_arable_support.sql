-- =============================================================================
-- Arable Crop LCA Support
-- =============================================================================
-- Adds tables for arable field management and growing profile tracking,
-- mirroring the existing orchard schema. Supports FLAG v1.2 compliant LCA
-- calculations for barley, wheat, oats, rye, maize, and other grain crops.
--
-- Tables:
--   1. arable_fields              - Master field records
--   2. arable_growing_profiles    - Annual harvest-specific agronomic data
--   3. arable_soil_carbon_evidence - Lab report uploads for soil carbon
--
-- Also extends product_materials with arable_field_id FK for self-grown grain.

-- ---------------------------------------------------------------------------
-- 1. arable_fields
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.arable_fields (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,

  name text NOT NULL,
  hectares numeric(10,4) NOT NULL CHECK (hectares > 0),
  crop_type text NOT NULL DEFAULT 'barley'
    CHECK (crop_type IN ('barley','wheat','oats','rye','maize','other')),
  crop_varieties text[] DEFAULT '{}',
  annual_yield_tonnes numeric(10,2),
  yield_tonnes_per_ha numeric(10,4),
  certification text NOT NULL DEFAULT 'conventional'
    CHECK (certification IN ('conventional','organic','other')),
  climate_zone text NOT NULL DEFAULT 'temperate'
    CHECK (climate_zone IN ('wet','dry','temperate')),

  -- Arable-specific
  sowing_method text CHECK (sowing_method IS NULL OR sowing_method IN (
    'drilled','broadcast','direct_drill','other'
  )),
  seed_rate_kg_per_ha numeric(10,2) CHECK (seed_rate_kg_per_ha IS NULL OR seed_rate_kg_per_ha > 0),

  -- Location
  address_line1 text,
  address_city text,
  address_country text,
  address_postcode text,
  address_lat numeric(10,7),
  address_lng numeric(10,7),
  location_country_code text,

  -- LUC (FLAG-C3)
  previous_land_use_type text
    CHECK (previous_land_use_type IS NULL OR previous_land_use_type IN (
      'permanent_arable','grassland','forest','wetland','settlement','other_land'
    )),
  land_conversion_year integer
    CHECK (land_conversion_year IS NULL OR (land_conversion_year >= 1900 AND land_conversion_year <= 2100)),

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arable_fields_org ON public.arable_fields(organization_id);
CREATE INDEX IF NOT EXISTS idx_arable_fields_facility ON public.arable_fields(facility_id);
CREATE INDEX IF NOT EXISTS idx_arable_fields_active ON public.arable_fields(organization_id, is_active);

-- RLS
ALTER TABLE public.arable_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organisation arable fields"
  ON public.arable_fields FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert arable fields for their organisation"
  ON public.arable_fields FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organisation arable fields"
  ON public.arable_fields FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organisation arable fields"
  ON public.arable_fields FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER set_arable_fields_updated_at
  BEFORE UPDATE ON public.arable_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. arable_growing_profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.arable_growing_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  arable_field_id uuid NOT NULL REFERENCES public.arable_fields(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  harvest_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),

  -- Step 1: Soil & Land
  area_ha numeric(10,4) NOT NULL CHECK (area_ha > 0),
  soil_management text NOT NULL DEFAULT 'conventional_tillage'
    CHECK (soil_management IN (
      'conventional_tillage','minimum_tillage','no_till',
      'cover_cropping','composting','biochar_compost','regenerative_integrated'
    )),

  -- Step 1: Straw / crop residue
  straw_management text NOT NULL DEFAULT 'incorporated'
    CHECK (straw_management IN ('incorporated','baled_removed','burned','mulched')),
  straw_yield_tonnes_per_ha numeric(10,2) NOT NULL DEFAULT 0,

  -- Step 1: Lime
  lime_applied_kg_per_ha numeric(10,2) NOT NULL DEFAULT 0,
  lime_type text NOT NULL DEFAULT 'none'
    CHECK (lime_type IN ('ite','dolomite','none')),

  -- Step 2: Inputs - Fertiliser
  fertiliser_type text NOT NULL DEFAULT 'none'
    CHECK (fertiliser_type IN ('none','synthetic_n','organic_manure','organic_compost','mixed')),
  fertiliser_quantity_kg numeric(10,2) NOT NULL DEFAULT 0,
  fertiliser_n_content_percent numeric(5,2) NOT NULL DEFAULT 0,

  -- Step 2: Inputs - Pesticide/Herbicide
  uses_pesticides boolean NOT NULL DEFAULT false,
  pesticide_applications_per_year integer NOT NULL DEFAULT 0,
  pesticide_type text DEFAULT 'generic'
    CHECK (pesticide_type IS NULL OR pesticide_type IN (
      'generic','sulfur','synthetic_fungicide','herbicide_glyphosate','growth_regulator'
    )),
  uses_herbicides boolean NOT NULL DEFAULT false,
  herbicide_applications_per_year integer NOT NULL DEFAULT 0,
  herbicide_type text DEFAULT 'generic'
    CHECK (herbicide_type IS NULL OR herbicide_type IN (
      'generic','sulfur','synthetic_fungicide','herbicide_glyphosate','growth_regulator'
    )),

  -- Step 2: Inputs - Growth regulators
  uses_growth_regulators boolean NOT NULL DEFAULT false,
  growth_regulator_applications integer NOT NULL DEFAULT 0,

  -- Step 2: Inputs - Seed
  seed_rate_kg_per_ha numeric(10,2) NOT NULL DEFAULT 0,

  -- Step 3: Machinery & Fuel
  diesel_litres_per_year numeric(10,2) NOT NULL DEFAULT 0,
  petrol_litres_per_year numeric(10,2) NOT NULL DEFAULT 0,

  -- Step 3: Grain drying
  grain_drying_fuel text NOT NULL DEFAULT 'none'
    CHECK (grain_drying_fuel IN ('natural_gas','lpg','diesel','biomass','grid_electricity','none')),
  grain_drying_energy_kwh_per_tonne numeric(10,2) NOT NULL DEFAULT 0,

  -- Step 4: Irrigation
  is_irrigated boolean NOT NULL DEFAULT false,
  water_m3_per_ha numeric(10,2) NOT NULL DEFAULT 0,
  irrigation_energy_source text NOT NULL DEFAULT 'none'
    CHECK (irrigation_energy_source IN ('grid_electricity','diesel_pump','solar_pump','gravity_fed','none')),

  -- Yield (allocation denominator)
  grain_yield_tonnes numeric(10,2) NOT NULL DEFAULT 0 CHECK (grain_yield_tonnes >= 0),
  grain_moisture_percent numeric(5,2) NOT NULL DEFAULT 14.5,

  -- Transport from field to facility
  transport_distance_km numeric(10,2),
  transport_mode text DEFAULT 'road'
    CHECK (transport_mode IS NULL OR transport_mode IN ('road','rail')),

  -- Soil carbon
  soil_carbon_override_kg_co2e_per_ha numeric,
  soil_carbon_measurement_date date,
  soil_carbon_methodology text,
  soil_carbon_lab_name text,
  soil_carbon_sampling_points integer,

  -- Removal verification (FLAG compliance)
  removal_verification_status text DEFAULT 'unverified'
    CHECK (removal_verification_status IS NULL OR removal_verification_status IN (
      'unverified','pending','verified','rejected','expired'
    )),
  removal_verifier_body text,
  removal_verifier_standard text,
  removal_verification_date date,
  removal_verification_expiry date,

  -- TNFD location sensitivity
  ecosystem_type text,
  in_biodiversity_sensitive_area boolean DEFAULT false,
  sensitive_area_details text,
  water_stress_index text,

  -- Land ownership boundary
  land_ownership_type text,
  lease_expiry_date date,
  is_boundary_controlled boolean DEFAULT true,

  -- Draft support
  is_draft boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(arable_field_id, harvest_year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arable_profiles_field ON public.arable_growing_profiles(arable_field_id);
CREATE INDEX IF NOT EXISTS idx_arable_profiles_org ON public.arable_growing_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_arable_profiles_year ON public.arable_growing_profiles(arable_field_id, harvest_year);

-- RLS
ALTER TABLE public.arable_growing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organisation arable profiles"
  ON public.arable_growing_profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert arable profiles for their organisation"
  ON public.arable_growing_profiles FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organisation arable profiles"
  ON public.arable_growing_profiles FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organisation arable profiles"
  ON public.arable_growing_profiles FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER set_arable_growing_profiles_updated_at
  BEFORE UPDATE ON public.arable_growing_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. arable_soil_carbon_evidence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.arable_soil_carbon_evidence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  growing_profile_id uuid NOT NULL REFERENCES public.arable_growing_profiles(id) ON DELETE CASCADE,
  arable_field_id uuid NOT NULL REFERENCES public.arable_fields(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  storage_object_path text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arable_soil_evidence_profile
  ON public.arable_soil_carbon_evidence(growing_profile_id);

-- RLS
ALTER TABLE public.arable_soil_carbon_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organisation arable soil evidence"
  ON public.arable_soil_carbon_evidence FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert arable soil evidence for their organisation"
  ON public.arable_soil_carbon_evidence FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organisation arable soil evidence"
  ON public.arable_soil_carbon_evidence FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Extend product_materials with arable_field_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS arable_field_id uuid REFERENCES public.arable_fields(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 5. Storage bucket for soil carbon evidence
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'arable-soil-carbon-evidence',
  'arable-soil-carbon-evidence',
  false,
  20971520, -- 20 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Org members can upload arable soil evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'arable-soil-carbon-evidence'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Org members can read arable soil evidence"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'arable-soil-carbon-evidence'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Org members can delete arable soil evidence"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'arable-soil-carbon-evidence'
    AND auth.uid() IS NOT NULL
  );
