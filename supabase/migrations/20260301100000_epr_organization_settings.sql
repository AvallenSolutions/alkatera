-- =============================================================================
-- EPR: Organisation-level EPR settings
-- =============================================================================
-- Stores RPD registration details, obligation thresholds, default EPR values,
-- and nation-of-sale distribution for each organisation.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.epr_organization_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- RPD portal registration
  rpd_organization_id text,
  rpd_subsidiary_id text,

  -- Obligation threshold determination
  annual_turnover_gbp numeric,
  estimated_annual_packaging_tonnage numeric,
  obligation_size text DEFAULT 'pending' NOT NULL
    CHECK (obligation_size IN ('large', 'small', 'below_threshold', 'pending')),

  -- Default EPR settings (applied when product-level fields are not set)
  default_packaging_activity text DEFAULT 'brand'
    CHECK (default_packaging_activity IS NULL OR default_packaging_activity IN
      ('brand', 'packed_filled', 'imported', 'empty', 'hired', 'marketplace')),
  default_uk_nation text DEFAULT 'england'
    CHECK (default_uk_nation IS NULL OR default_uk_nation IN
      ('england', 'scotland', 'wales', 'northern_ireland')),

  -- Nation-of-sale distribution (percentages, must sum to 100)
  nation_sales_england_pct numeric DEFAULT 100 NOT NULL
    CHECK (nation_sales_england_pct >= 0 AND nation_sales_england_pct <= 100),
  nation_sales_scotland_pct numeric DEFAULT 0 NOT NULL
    CHECK (nation_sales_scotland_pct >= 0 AND nation_sales_scotland_pct <= 100),
  nation_sales_wales_pct numeric DEFAULT 0 NOT NULL
    CHECK (nation_sales_wales_pct >= 0 AND nation_sales_wales_pct <= 100),
  nation_sales_ni_pct numeric DEFAULT 0 NOT NULL
    CHECK (nation_sales_ni_pct >= 0 AND nation_sales_ni_pct <= 100),

  -- Nation estimation method tracking
  nation_sales_method text DEFAULT 'manual' NOT NULL
    CHECK (nation_sales_method IN ('manual', 'auto_estimated', 'hybrid')),
  nation_sales_last_estimated_at timestamptz,

  -- DRS settings
  drs_applies boolean DEFAULT false NOT NULL,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- One settings row per org
  CONSTRAINT unique_org_epr_settings UNIQUE (organization_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_epr_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_epr_settings_updated_at
  BEFORE UPDATE ON public.epr_organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_epr_settings_updated_at();

-- RLS
ALTER TABLE public.epr_organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view EPR settings"
  ON public.epr_organization_settings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_organization_settings.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert EPR settings"
  ON public.epr_organization_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_organization_settings.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update EPR settings"
  ON public.epr_organization_settings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_organization_settings.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_organization_settings.organization_id
      AND organization_members.user_id = auth.uid()
  ));

-- Comments
COMMENT ON TABLE public.epr_organization_settings IS
  'Per-organisation EPR compliance configuration: RPD registration, obligation thresholds, nation-of-sale distribution, and default EPR values.';
COMMENT ON COLUMN public.epr_organization_settings.obligation_size IS
  'Derived from turnover + packaging tonnage. Large: >=£2M AND >=50t. Small: >=£1M AND >=25t (below Large). Below: under Small thresholds.';
COMMENT ON COLUMN public.epr_organization_settings.nation_sales_method IS
  'How the nation-of-sale distribution was derived: manual (user entered), auto_estimated (from postcode/delivery data), or hybrid (auto-estimated then manually adjusted).';
