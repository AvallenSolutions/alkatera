-- Migration: SBTi FLAG Requirements
-- Seeds FLAG-specific requirements into certification_framework_requirements
-- for the SBTi framework (framework_code: 'sbti').

DO $$
DECLARE
  sbti_id uuid;
BEGIN
  -- Look up the SBTi framework id
  SELECT id INTO sbti_id
  FROM public.certification_frameworks
  WHERE code = 'sbti'
  LIMIT 1;

  IF sbti_id IS NULL THEN
    RAISE NOTICE 'SBTi framework not found, skipping FLAG requirement seeding';
    RETURN;
  END IF;

  -- Only insert if FLAG-1.1 does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM public.certification_framework_requirements
    WHERE framework_id = sbti_id AND requirement_code = 'FLAG-1.1'
  ) THEN
    INSERT INTO public.certification_framework_requirements (
      framework_id, requirement_code, requirement_name, requirement_category,
      section, order_index, description, guidance, is_mandatory, required_data_sources
    )
    VALUES
      -- Section: FLAG Scope and Eligibility
      (sbti_id, 'FLAG-1.1', 'FLAG Emissions Threshold Assessment', 'FLAG Scope',
       'flag_eligibility', 1,
       'Determine whether FLAG emissions exceed 20% of total Scope 1, 2, and 3 emissions, triggering mandatory FLAG target-setting.',
       'If land-based emissions (agricultural N2O, dLUC, soil carbon) exceed 20% of total emissions, FLAG science-based targets must be set alongside near-term and long-term SBTi targets.',
       true, ARRAY['product_lca', 'viticulture_calculator', 'orchard_calculator']),

      -- Section: FLAG Deforestation
      (sbti_id, 'FLAG-1.2', 'No-Deforestation Commitment - Timber', 'FLAG Deforestation',
       'flag_deforestation', 2,
       'No-deforestation commitment covering timber and timber-derived products (cork, cardboard, paper, wooden pallets, oak staves).',
       'Applies if any product in your portfolio contains a supplier product with commodity_type = timber. Commitment must align with 2020 cutoff date per FLAG v1.2.',
       false, ARRAY['supplier_products', 'supplier_esg_assessments']),

      (sbti_id, 'FLAG-1.3', 'No-Deforestation Commitment - Other Commodities', 'FLAG Deforestation',
       'flag_deforestation', 3,
       'No-deforestation commitment covering any other deforestation-linked commodities (soy, cocoa, cattle, palm oil, coffee, rubber).',
       'Conditional on your product portfolio containing these commodities. Confirm commodity coverage in supplier ESG assessments or via manual declaration.',
       false, ARRAY['supplier_products', 'supplier_esg_assessments']),

      -- Section: FLAG Methodology
      (sbti_id, 'FLAG-1.4', 'GHG Protocol Land Sector Alignment', 'FLAG Methodology',
       'flag_methodology', 4,
       'Confirm emissions and removals calculations align with GHG Protocol Land Sector and Removals Standard v1.0 (January 2026).',
       'alkatera viticulture and orchard calculators are aligned with this standard. Manual attestation required to confirm no out-of-platform land-based emissions are excluded.',
       true, ARRAY['viticulture_calculator', 'orchard_calculator']),

      -- Section: FLAG Documentation
      (sbti_id, 'FLAG-1.5', 'Commodity Assessment Methodology Published', 'FLAG Documentation',
       'flag_documentation', 5,
       'Publish commodity assessment methodology on company website or policy documents within 12 months of SBTi validation.',
       'Required by FLAG Guidance v1.2. Upload document or provide URL in the audit package.',
       true, ARRAY['certification_audit_packages']),

      (sbti_id, 'FLAG-1.6', 'No-Deforestation Delivery Plan Published', 'FLAG Documentation',
       'flag_documentation', 6,
       'Publish no-deforestation delivery plan on company website or policy documents within 12 months of SBTi validation.',
       'Required by FLAG Guidance v1.2. Upload document or provide URL in the audit package.',
       true, ARRAY['certification_audit_packages']);
  END IF;
END $$;
