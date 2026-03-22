-- Viticulture / Vineyard LCA Support
--
-- Adds tables and columns for producers who grow their own agricultural inputs,
-- starting with vineyards (grape growing for wine production).
--
-- FLAG Alignment (SBTi Forest, Land and Agriculture):
--   Emissions and removals are stored and reported SEPARATELY.
--   The impact_removals_co2e column on product_carbon_footprint_materials
--   holds soil carbon removals independently of impact_climate.
--
-- Methodology: IPCC 2019 Refinement Tier 1, OIV, WineGB/Carbon Trust

-- ══════════════════════════════════════════════════════════════════════════
-- 1. vineyards table
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.vineyards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,

  name text NOT NULL,
  hectares numeric(10,4) NOT NULL CHECK (hectares > 0),
  grape_varieties text[] DEFAULT '{}',
  annual_yield_tonnes numeric(10,2),
  yield_tonnes_per_ha numeric(10,4),
  certification text NOT NULL DEFAULT 'conventional'
    CHECK (certification IN ('conventional', 'organic', 'biodynamic', 'leaf')),
  climate_zone text NOT NULL DEFAULT 'temperate'
    CHECK (climate_zone IN ('wet', 'dry', 'temperate')),

  -- Location
  address_line1 text,
  address_city text,
  address_country text,
  address_postcode text,
  address_lat numeric(10,7),
  address_lng numeric(10,7),
  location_country_code text,

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_vineyards_organization_id ON public.vineyards(organization_id);
CREATE INDEX idx_vineyards_facility_id ON public.vineyards(facility_id);

-- RLS (mirrors facilities pattern using user_has_organization_access)
ALTER TABLE public.vineyards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view vineyards"
  ON public.vineyards FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can create vineyards"
  ON public.vineyards FOR INSERT TO authenticated
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can update vineyards"
  ON public.vineyards FOR UPDATE TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can delete vineyards"
  ON public.vineyards FOR DELETE TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role bypass for vineyards"
  ON public.vineyards FOR SELECT TO service_role
  USING (true);

-- ══════════════════════════════════════════════════════════════════════════
-- 2. vineyard_growing_profiles table
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.vineyard_growing_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vineyard_id uuid NOT NULL REFERENCES public.vineyards(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),

  -- Step 1: Soil & Land
  area_ha numeric(10,4) NOT NULL CHECK (area_ha > 0),
  soil_management text NOT NULL DEFAULT 'conventional_tillage'
    CHECK (soil_management IN (
      'conventional_tillage', 'minimum_tillage', 'no_till',
      'cover_cropping', 'composting'
    )),

  -- Step 2: Inputs - Fertiliser
  fertiliser_type text NOT NULL DEFAULT 'none'
    CHECK (fertiliser_type IN (
      'none', 'synthetic_n', 'organic_manure', 'organic_compost', 'mixed'
    )),
  fertiliser_quantity_kg numeric(10,2) NOT NULL DEFAULT 0
    CHECK (fertiliser_quantity_kg >= 0),
  fertiliser_n_content_percent numeric(5,2) NOT NULL DEFAULT 0
    CHECK (fertiliser_n_content_percent >= 0 AND fertiliser_n_content_percent <= 100),

  -- Step 2: Inputs - Pesticide/Herbicide
  uses_pesticides boolean NOT NULL DEFAULT false,
  pesticide_applications_per_year integer NOT NULL DEFAULT 0
    CHECK (pesticide_applications_per_year >= 0),
  uses_herbicides boolean NOT NULL DEFAULT false,
  herbicide_applications_per_year integer NOT NULL DEFAULT 0
    CHECK (herbicide_applications_per_year >= 0),

  -- Step 3: Machinery & Fuel
  diesel_litres_per_year numeric(10,2) NOT NULL DEFAULT 0
    CHECK (diesel_litres_per_year >= 0),
  petrol_litres_per_year numeric(10,2) NOT NULL DEFAULT 0
    CHECK (petrol_litres_per_year >= 0),

  -- Step 4: Irrigation
  is_irrigated boolean NOT NULL DEFAULT false,
  water_m3_per_ha numeric(10,2) NOT NULL DEFAULT 0
    CHECK (water_m3_per_ha >= 0),
  irrigation_energy_source text NOT NULL DEFAULT 'none'
    CHECK (irrigation_energy_source IN (
      'grid_electricity', 'diesel_pump', 'solar_pump', 'gravity_fed', 'none'
    )),

  -- Yield (allocation denominator)
  grape_yield_tonnes numeric(10,2) NOT NULL CHECK (grape_yield_tonnes > 0),

  -- Phase 2: Soil carbon measurement override
  soil_carbon_override_kg_co2e_per_ha numeric,
  soil_carbon_measurement_date date,
  soil_carbon_methodology text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One profile per product-vineyard combination
  UNIQUE(product_id, vineyard_id)
);

-- Indexes
CREATE INDEX idx_vineyard_growing_profiles_product_id
  ON public.vineyard_growing_profiles(product_id);
CREATE INDEX idx_vineyard_growing_profiles_vineyard_id
  ON public.vineyard_growing_profiles(vineyard_id);
CREATE INDEX idx_vineyard_growing_profiles_organization_id
  ON public.vineyard_growing_profiles(organization_id);

-- RLS
ALTER TABLE public.vineyard_growing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view vineyard growing profiles"
  ON public.vineyard_growing_profiles FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can create vineyard growing profiles"
  ON public.vineyard_growing_profiles FOR INSERT TO authenticated
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can update vineyard growing profiles"
  ON public.vineyard_growing_profiles FOR UPDATE TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can delete vineyard growing profiles"
  ON public.vineyard_growing_profiles FOR DELETE TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role bypass for vineyard growing profiles"
  ON public.vineyard_growing_profiles FOR SELECT TO service_role
  USING (true);

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Add columns to existing tables
-- ══════════════════════════════════════════════════════════════════════════

-- product_materials: link to vineyard for self-grown ingredients
ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS vineyard_id uuid REFERENCES public.vineyards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_self_grown boolean NOT NULL DEFAULT false;

-- product_carbon_footprint_materials: FLAG-compliant removals column
-- Stores soil carbon removals SEPARATELY from impact_climate (FLAG requirement)
ALTER TABLE public.product_carbon_footprint_materials
  ADD COLUMN IF NOT EXISTS impact_removals_co2e numeric NOT NULL DEFAULT 0;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Updated_at trigger (reuse existing function if available)
-- ══════════════════════════════════════════════════════════════════════════

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vineyards_updated_at
  BEFORE UPDATE ON public.vineyards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vineyard_growing_profiles_updated_at
  BEFORE UPDATE ON public.vineyard_growing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
