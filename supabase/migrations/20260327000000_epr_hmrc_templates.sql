-- =============================================================================
-- EPR: HMRC Registration Template Tables
-- =============================================================================
-- Stores data required for the three HMRC EPR registration CSV templates:
--   1. Organisation Details (78 columns)
--   2. Brand Details (4 columns)
--   3. Partner Details (6 columns - partnerships only)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table A: epr_hmrc_org_details
-- ---------------------------------------------------------------------------
-- One row per organisation. Stores HMRC-specific company registration data
-- not already held in epr_organization_settings or organizations.

CREATE TABLE IF NOT EXISTS public.epr_hmrc_org_details (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Company registration
  companies_house_number text,
  home_nation_code text CHECK (home_nation_code IS NULL OR home_nation_code IN ('EN', 'NI', 'SC', 'WS')),
  main_activity_sic text,
  organisation_type_code text DEFAULT 'LTD' NOT NULL
    CHECK (organisation_type_code IN ('SOL', 'PAR', 'REG', 'PLC', 'LLP', 'LTD', 'CIO', 'OTH')),
  organisation_sub_type_code text,
  registration_type_code text,

  -- Packaging activity flags (Primary / Secondary / No)
  activity_so text DEFAULT 'Primary' NOT NULL CHECK (activity_so IN ('Primary', 'Secondary', 'No')),
  activity_pf text DEFAULT 'No' NOT NULL CHECK (activity_pf IN ('Primary', 'Secondary', 'No')),
  activity_im text DEFAULT 'No' NOT NULL CHECK (activity_im IN ('Primary', 'Secondary', 'No')),
  activity_se text DEFAULT 'No' NOT NULL CHECK (activity_se IN ('Primary', 'Secondary', 'No')),
  activity_hl text DEFAULT 'No' NOT NULL CHECK (activity_hl IN ('Primary', 'Secondary', 'No')),
  activity_om text DEFAULT 'No' NOT NULL CHECK (activity_om IN ('Primary', 'Secondary', 'No')),
  activity_sl text DEFAULT 'No' NOT NULL CHECK (activity_sl IN ('Primary', 'Secondary', 'No')),

  -- Compliance flags
  produce_blank_packaging_flag boolean DEFAULT false NOT NULL,
  liable_for_disposal_costs_flag boolean DEFAULT false NOT NULL,
  meet_reporting_requirements_flag boolean DEFAULT true NOT NULL,

  -- Sole trader details (only when organisation_type_code = 'SOL')
  sole_trader_first_name text,
  sole_trader_last_name text,
  sole_trader_phone text,
  sole_trader_email text,

  -- Leaver / joiner tracking
  leaver_code text,
  leaver_date date,
  organisation_change_reason text,
  joiner_date date,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT unique_org_hmrc_details UNIQUE (organization_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_epr_hmrc_org_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_epr_hmrc_org_details_updated_at
  BEFORE UPDATE ON public.epr_hmrc_org_details
  FOR EACH ROW
  EXECUTE FUNCTION update_epr_hmrc_org_details_updated_at();

-- ---------------------------------------------------------------------------
-- Table B: epr_hmrc_addresses
-- ---------------------------------------------------------------------------
-- Multiple address types per organisation: registered, audit,
-- service_of_notice, principal.

CREATE TABLE IF NOT EXISTS public.epr_hmrc_addresses (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  address_type text NOT NULL
    CHECK (address_type IN ('registered', 'audit', 'service_of_notice', 'principal')),

  line_1 text NOT NULL,
  line_2 text,
  city text NOT NULL,
  county text,
  postcode text NOT NULL,
  country text DEFAULT 'United Kingdom' NOT NULL,
  phone text,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT unique_org_address_type UNIQUE (organization_id, address_type)
);

CREATE OR REPLACE FUNCTION update_epr_hmrc_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_epr_hmrc_addresses_updated_at
  BEFORE UPDATE ON public.epr_hmrc_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_epr_hmrc_addresses_updated_at();

-- ---------------------------------------------------------------------------
-- Table C: epr_hmrc_contacts
-- ---------------------------------------------------------------------------
-- Contact persons: approved_person, delegated_person, primary_contact,
-- secondary_contact.

CREATE TABLE IF NOT EXISTS public.epr_hmrc_contacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_type text NOT NULL
    CHECK (contact_type IN ('approved_person', 'delegated_person', 'primary_contact', 'secondary_contact')),

  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  email text,
  job_title text,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT unique_org_contact_type UNIQUE (organization_id, contact_type)
);

CREATE OR REPLACE FUNCTION update_epr_hmrc_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_epr_hmrc_contacts_updated_at
  BEFORE UPDATE ON public.epr_hmrc_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_epr_hmrc_contacts_updated_at();

-- ---------------------------------------------------------------------------
-- Table D: epr_hmrc_brands
-- ---------------------------------------------------------------------------
-- Brand names for HMRC Template 2. Required when packaging_activity_so
-- is 'Primary' or 'Secondary' (i.e., the org sells goods under own brand).

CREATE TABLE IF NOT EXISTS public.epr_hmrc_brands (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  brand_name text NOT NULL,
  brand_type_code text DEFAULT 'BN' NOT NULL
    CHECK (brand_type_code IN ('BN', 'TM', 'OT')),

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT unique_org_brand_name UNIQUE (organization_id, brand_name)
);

-- ---------------------------------------------------------------------------
-- Table E: epr_hmrc_partners
-- ---------------------------------------------------------------------------
-- Individual partners in a legal partnership.
-- Only required when epr_hmrc_org_details.organisation_type_code = 'PAR'.

CREATE TABLE IF NOT EXISTS public.epr_hmrc_partners (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  email text,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_epr_hmrc_partners_org ON public.epr_hmrc_partners(organization_id);

-- =============================================================================
-- RLS Policies (same pattern as epr_organization_settings)
-- =============================================================================

-- epr_hmrc_org_details
ALTER TABLE public.epr_hmrc_org_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view HMRC org details"
  ON public.epr_hmrc_org_details FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_org_details.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert HMRC org details"
  ON public.epr_hmrc_org_details FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_org_details.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update HMRC org details"
  ON public.epr_hmrc_org_details FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_org_details.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_org_details.organization_id
      AND organization_members.user_id = auth.uid()
  ));

-- epr_hmrc_addresses
ALTER TABLE public.epr_hmrc_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view HMRC addresses"
  ON public.epr_hmrc_addresses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_addresses.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert HMRC addresses"
  ON public.epr_hmrc_addresses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_addresses.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update HMRC addresses"
  ON public.epr_hmrc_addresses FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_addresses.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_addresses.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete HMRC addresses"
  ON public.epr_hmrc_addresses FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_addresses.organization_id
      AND organization_members.user_id = auth.uid()
  ));

-- epr_hmrc_contacts
ALTER TABLE public.epr_hmrc_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view HMRC contacts"
  ON public.epr_hmrc_contacts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_contacts.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert HMRC contacts"
  ON public.epr_hmrc_contacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_contacts.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update HMRC contacts"
  ON public.epr_hmrc_contacts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_contacts.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_contacts.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete HMRC contacts"
  ON public.epr_hmrc_contacts FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_contacts.organization_id
      AND organization_members.user_id = auth.uid()
  ));

-- epr_hmrc_brands
ALTER TABLE public.epr_hmrc_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view HMRC brands"
  ON public.epr_hmrc_brands FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_brands.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert HMRC brands"
  ON public.epr_hmrc_brands FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_brands.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update HMRC brands"
  ON public.epr_hmrc_brands FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_brands.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_brands.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete HMRC brands"
  ON public.epr_hmrc_brands FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_brands.organization_id
      AND organization_members.user_id = auth.uid()
  ));

-- epr_hmrc_partners
ALTER TABLE public.epr_hmrc_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view HMRC partners"
  ON public.epr_hmrc_partners FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_partners.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert HMRC partners"
  ON public.epr_hmrc_partners FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_partners.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update HMRC partners"
  ON public.epr_hmrc_partners FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_partners.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_partners.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete HMRC partners"
  ON public.epr_hmrc_partners FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_hmrc_partners.organization_id
      AND organization_members.user_id = auth.uid()
  ));

-- =============================================================================
-- Table & Column Comments
-- =============================================================================

COMMENT ON TABLE public.epr_hmrc_org_details IS
  'HMRC EPR registration data for Template 1 (Organisation Details). One row per organisation.';
COMMENT ON COLUMN public.epr_hmrc_org_details.organisation_type_code IS
  'Companies House entity type: SOL (Sole Trader), PAR (Partnership), REG (Registered Society), PLC, LLP, LTD, CIO (Charitable Incorporated Org), OTH (Other).';
COMMENT ON COLUMN public.epr_hmrc_org_details.activity_so IS
  'Packaging activity: Supplied/sold under own brand. Primary = main activity, Secondary = also does this, No = does not do this.';

COMMENT ON TABLE public.epr_hmrc_addresses IS
  'HMRC EPR addresses for Template 1. Up to 4 address types per organisation: registered, audit, service_of_notice, principal.';
COMMENT ON COLUMN public.epr_hmrc_addresses.address_type IS
  'Address purpose: registered (Companies House), audit (where records are kept), service_of_notice (legal correspondence), principal (main place of business).';

COMMENT ON TABLE public.epr_hmrc_contacts IS
  'HMRC EPR contact persons for Template 1. Up to 4 contacts: approved_person (signatory), delegated_person (day-to-day), primary_contact, secondary_contact.';

COMMENT ON TABLE public.epr_hmrc_brands IS
  'HMRC EPR Template 2 data. Brand names the organisation sells products under. Required when activity_so is Primary or Secondary.';
COMMENT ON COLUMN public.epr_hmrc_brands.brand_type_code IS
  'BN = Brand Name, TM = Trademark, OT = Other identifier.';

COMMENT ON TABLE public.epr_hmrc_partners IS
  'HMRC EPR Template 3 data. Individual partners in a legal partnership. Only required when organisation_type_code = PAR.';
