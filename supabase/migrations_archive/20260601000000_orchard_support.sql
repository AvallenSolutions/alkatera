-- =============================================================================
-- Fruit Orchard LCA Support
-- =============================================================================
-- Adds tables for fruit orchard management and growing profile tracking,
-- mirroring the existing viticulture (vineyard) schema. Supports FLAG v1.2
-- compliant LCA calculations for apple, pear, cherry, and other orchards.
--
-- Tables:
--   1. orchards              - Master orchard records
--   2. orchard_growing_profiles  - Annual harvest-specific agronomic data
--   3. orchard_soil_carbon_evidence - Lab report uploads for soil carbon
--
-- Also extends product_materials with orchard_id FK for self-grown fruit.

-- ---------------------------------------------------------------------------
-- 1. orchards
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orchards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,

  name text NOT NULL,
  hectares numeric(10,4) NOT NULL CHECK (hectares > 0),
  orchard_type text NOT NULL DEFAULT 'apple'
    CHECK (orchard_type IN ('apple','pear','cherry','plum','citrus','stone_fruit','mixed','other')),
  fruit_varieties text[] DEFAULT '{}',
  annual_yield_tonnes numeric(10,2),
  yield_tonnes_per_ha numeric(10,4),
  certification text NOT NULL DEFAULT 'conventional'
    CHECK (certification IN ('conventional','organic','biodynamic','other')),
  climate_zone text NOT NULL DEFAULT 'temperate'
    CHECK (climate_zone IN ('wet','dry','temperate')),

  -- Orchard-specific
  planting_year integer CHECK (planting_year IS NULL OR (planting_year >= 1800 AND planting_year <= 2100)),
  tree_density_per_ha integer CHECK (tree_density_per_ha IS NULL OR tree_density_per_ha > 0),
  rootstock_type text,
  training_system text CHECK (training_system IS NULL OR training_system IN (
    'bush','spindle','espalier','trellis','central_leader','open_vase','other'
  )),

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
      'permanent_orchard','grassland','forest','arable','wetland','settlement','other_land'
    )),
  land_conversion_year integer
    CHECK (land_conversion_year IS NULL OR (land_conversion_year >= 1900 AND land_conversion_year <= 2100)),

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orchards_org ON public.orchards(organization_id);
CREATE INDEX IF NOT EXISTS idx_orchards_facility ON public.orchards(facility_id);
CREATE INDEX IF NOT EXISTS idx_orchards_active ON public.orchards(organization_id, is_active);

-- RLS
ALTER TABLE public.orchards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organisation orchards"
  ON public.orchards FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert orchards for their organisation"
  ON public.orchards FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organisation orchards"
  ON public.orchards FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organisation orchards"
  ON public.orchards FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER set_orchards_updated_at
  BEFORE UPDATE ON public.orchards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. orchard_growing_profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orchard_growing_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orchard_id uuid NOT NULL REFERENCES public.orchards(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  harvest_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),

  -- Step 1: Soil & Land
  area_ha numeric(10,4) NOT NULL CHECK (area_ha > 0),
  soil_management text NOT NULL DEFAULT 'conventional_tillage'
    CHECK (soil_management IN (
      'conventional_tillage','minimum_tillage','no_till',
      'cover_cropping','composting','biochar_compost','regenerative_integrated'
    )),
  pruning_residue_returned boolean DEFAULT true,

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
      'generic','sulfur','mancozeb','synthetic_fungicide',
      'insecticide_codling_moth','insecticide_aphid','herbicide_glyphosate'
    )),
  uses_herbicides boolean NOT NULL DEFAULT false,
  herbicide_applications_per_year integer NOT NULL DEFAULT 0,
  herbicide_type text DEFAULT 'generic'
    CHECK (herbicide_type IS NULL OR herbicide_type IN (
      'generic','sulfur','mancozeb','synthetic_fungicide',
      'insecticide_codling_moth','insecticide_aphid','herbicide_glyphosate'
    )),

  -- Step 3: Machinery & Fuel
  diesel_litres_per_year numeric(10,2) NOT NULL DEFAULT 0,
  petrol_litres_per_year numeric(10,2) NOT NULL DEFAULT 0,

  -- Step 4: Irrigation
  is_irrigated boolean NOT NULL DEFAULT false,
  water_m3_per_ha numeric(10,2) NOT NULL DEFAULT 0,
  irrigation_energy_source text NOT NULL DEFAULT 'none'
    CHECK (irrigation_energy_source IN ('grid_electricity','diesel_pump','solar_pump','gravity_fed','none')),

  -- Yield (allocation denominator)
  fruit_yield_tonnes numeric(10,2) NOT NULL DEFAULT 0 CHECK (fruit_yield_tonnes >= 0),

  -- Transport from orchard to facility
  transport_distance_km numeric(10,2),
  transport_mode text DEFAULT 'road'
    CHECK (transport_mode IS NULL OR transport_mode IN ('road','rail')),

  -- Soil carbon
  soil_carbon_override_kg_co2e_per_ha numeric,
  soil_carbon_measurement_date date,
  soil_carbon_methodology text,
  soil_carbon_lab_name text,
  soil_carbon_sampling_points integer,

  -- Draft support
  is_draft boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(orchard_id, harvest_year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orchard_profiles_orchard ON public.orchard_growing_profiles(orchard_id);
CREATE INDEX IF NOT EXISTS idx_orchard_profiles_org ON public.orchard_growing_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_orchard_profiles_year ON public.orchard_growing_profiles(orchard_id, harvest_year);

-- RLS
ALTER TABLE public.orchard_growing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organisation orchard profiles"
  ON public.orchard_growing_profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert orchard profiles for their organisation"
  ON public.orchard_growing_profiles FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organisation orchard profiles"
  ON public.orchard_growing_profiles FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organisation orchard profiles"
  ON public.orchard_growing_profiles FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER set_orchard_growing_profiles_updated_at
  BEFORE UPDATE ON public.orchard_growing_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. orchard_soil_carbon_evidence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orchard_soil_carbon_evidence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  growing_profile_id uuid NOT NULL REFERENCES public.orchard_growing_profiles(id) ON DELETE CASCADE,
  orchard_id uuid NOT NULL REFERENCES public.orchards(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  storage_object_path text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orchard_soil_evidence_profile
  ON public.orchard_soil_carbon_evidence(growing_profile_id);

-- RLS
ALTER TABLE public.orchard_soil_carbon_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organisation orchard soil evidence"
  ON public.orchard_soil_carbon_evidence FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert orchard soil evidence for their organisation"
  ON public.orchard_soil_carbon_evidence FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organisation orchard soil evidence"
  ON public.orchard_soil_carbon_evidence FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Extend product_materials with orchard_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS orchard_id uuid REFERENCES public.orchards(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 5. Storage bucket for soil carbon evidence
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'orchard-soil-carbon-evidence',
  'orchard-soil-carbon-evidence',
  false,
  20971520, -- 20 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Org members can upload orchard soil evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'orchard-soil-carbon-evidence'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Org members can read orchard soil evidence"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'orchard-soil-carbon-evidence'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Org members can delete orchard soil evidence"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'orchard-soil-carbon-evidence'
    AND auth.uid() IS NOT NULL
  );
