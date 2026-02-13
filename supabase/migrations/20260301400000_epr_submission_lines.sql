-- =============================================================================
-- EPR: Submission line items
-- =============================================================================
-- Each row maps 1:1 to a row in the RPD CSV export.
-- All 15 RPD columns are stored with CHECK constraints matching valid values.
-- Source traceability links back to the product_material that generated the line.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.epr_submission_lines (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.epr_submissions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),

  -- Source traceability (which product/packaging generated this line)
  product_id bigint REFERENCES public.products(id),
  product_name text,
  product_material_id bigint,

  -- =========================================================================
  -- RPD CSV columns (15 fields — matches official Defra file specification)
  -- =========================================================================

  -- Column A: Organisation ID (6-digit RPD account number)
  rpd_organisation_id text NOT NULL,

  -- Column B: Subsidiary ID (optional, parent-assigned)
  rpd_subsidiary_id text,

  -- Column C: Organisation Size
  rpd_organisation_size text NOT NULL
    CHECK (rpd_organisation_size IN ('L', 'S')),

  -- Column D: Submission Period
  rpd_submission_period text NOT NULL,     -- 2025-H1, 2025-H2, 2025-P0

  -- Column E: Packaging Activity
  rpd_packaging_activity text NOT NULL
    CHECK (rpd_packaging_activity IN ('SO', 'PF', 'IM', 'SE', 'HL', 'OM')),

  -- Column F: Packaging Type
  rpd_packaging_type text NOT NULL
    CHECK (rpd_packaging_type IN ('HH', 'NH', 'CW', 'OW', 'PB', 'RU', 'HDC', 'NDC', 'SP')),

  -- Column G: Packaging Class
  rpd_packaging_class text NOT NULL,       -- P1-P6, O1-O2, B1

  -- Column H: Packaging Material
  rpd_packaging_material text NOT NULL
    CHECK (rpd_packaging_material IN ('AL', 'FC', 'GL', 'PC', 'PL', 'ST', 'WD', 'OT')),

  -- Column I: Material Subtype (conditional)
  rpd_material_subtype text,

  -- Column J: From Nation
  rpd_from_nation text NOT NULL
    CHECK (rpd_from_nation IN ('EN', 'NI', 'SC', 'WS')),

  -- Column K: To Nation (conditional, for nation-of-sale)
  rpd_to_nation text
    CHECK (rpd_to_nation IS NULL OR rpd_to_nation IN ('EN', 'NI', 'SC', 'WS')),

  -- Column L: Material Weight (kg, whole numbers in CSV)
  rpd_material_weight_kg numeric NOT NULL
    CHECK (rpd_material_weight_kg > 0),

  -- Column M: Material Units (drinks containers only)
  rpd_material_units integer,

  -- Column N: Transitional Weight (legacy, leave blank for 2025+ data)
  rpd_transitional_weight numeric,

  -- Column O: Recyclability Rating
  rpd_recyclability_rating text
    CHECK (rpd_recyclability_rating IS NULL OR rpd_recyclability_rating IN
      ('R', 'A', 'G', 'R-M', 'A-M', 'G-M')),

  -- =========================================================================
  -- Fee calculation fields
  -- =========================================================================
  fee_rate_per_tonne numeric,
  estimated_fee_gbp numeric DEFAULT 0 NOT NULL,

  -- DRS exclusion (aluminium/PET/steel drinks containers 150ml-3L)
  is_drs_excluded boolean DEFAULT false NOT NULL,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.epr_submission_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view submission lines"
  ON public.epr_submission_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_submission_lines.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can manage submission lines"
  ON public.epr_submission_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_submission_lines.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update submission lines"
  ON public.epr_submission_lines FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_submission_lines.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_submission_lines.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete submission lines"
  ON public.epr_submission_lines FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_submission_lines.organization_id
      AND organization_members.user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_epr_lines_submission ON public.epr_submission_lines(submission_id);
CREATE INDEX IF NOT EXISTS idx_epr_lines_product ON public.epr_submission_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_epr_lines_material ON public.epr_submission_lines(rpd_packaging_material);

-- Comments
COMMENT ON TABLE public.epr_submission_lines IS
  'Individual RPD line items, mapping 1:1 to rows in the CSV export. Each line traces back to a specific product and packaging material.';
COMMENT ON COLUMN public.epr_submission_lines.rpd_packaging_activity IS
  'SO=Sold (Brand Owner), PF=Packed/Filled, IM=Imported, SE=Sold via online marketplace, HL=Hired/Loaned, OM=Online marketplace operator.';
COMMENT ON COLUMN public.epr_submission_lines.rpd_packaging_type IS
  'HH=Household, NH=Non-household, CW=Consumer waste (self-managed), OW=Organisation waste, PB=Public bin, RU=Reusable, HDC=Household drinks container, NDC=Non-household drinks container, SP=Street/public.';
COMMENT ON COLUMN public.epr_submission_lines.rpd_packaging_class IS
  'P1-P6=Primary, O1=Secondary, O2=Shipment, B1=Tertiary. Number suffix follows Defra packaging class codes.';
COMMENT ON COLUMN public.epr_submission_lines.is_drs_excluded IS
  'True if this is an aluminium/PET/steel drinks container 150ml-3L — excluded from EPR waste management fees as it will enter DRS.';
