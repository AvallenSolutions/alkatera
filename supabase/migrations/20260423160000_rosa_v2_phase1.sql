-- =============================================================================
-- Rosa v2 — Phase 1: Memory layer, pending actions, knowledge base seed
-- =============================================================================
-- 1. rosa_memory: org/user-scoped scratchpad Rosa uses to remember preferences
--    and facts across conversations. Read into her system prompt every turn.
-- 2. rosa_pending_actions: confirmation-gated write pipeline (Phase 2 uses it).
-- 3. gaia_knowledge_base.source_url column + seed of ISO / VSME / CSRD /
--    greenwash / BIER entries so Rosa can cite methodology with a source chip.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. rosa_memory
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rosa_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('user', 'org')),
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rosa_memory_org_user_scope_key_uniq
  ON public.rosa_memory (organization_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), scope, key);

CREATE INDEX IF NOT EXISTS idx_rosa_memory_org_updated
  ON public.rosa_memory (organization_id, updated_at DESC);

ALTER TABLE public.rosa_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rosa_memory_member_read ON public.rosa_memory;
CREATE POLICY rosa_memory_member_read ON public.rosa_memory FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.rosa_memory TO service_role;
GRANT SELECT ON TABLE public.rosa_memory TO authenticated;

COMMENT ON TABLE public.rosa_memory IS 'Rosa scratchpad: stable facts and preferences carried across conversations.';
COMMENT ON COLUMN public.rosa_memory.scope IS 'user = personal to this user in this org; org = shared across all members of the org.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. rosa_pending_actions (created now, consumed by Phase 2)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rosa_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.gaia_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.gaia_messages(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'executed', 'failed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_rosa_pending_actions_user_status
  ON public.rosa_pending_actions (user_id, status, created_at DESC);

ALTER TABLE public.rosa_pending_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rosa_pending_actions_owner_read ON public.rosa_pending_actions;
CREATE POLICY rosa_pending_actions_owner_read ON public.rosa_pending_actions FOR SELECT
  USING (user_id = auth.uid());

GRANT ALL ON TABLE public.rosa_pending_actions TO service_role;
GRANT SELECT ON TABLE public.rosa_pending_actions TO authenticated;

COMMENT ON TABLE public.rosa_pending_actions IS 'Confirmation queue: Rosa proposes mutations here, the user confirms, server executes.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Knowledge base: add source_url column + seed methodology entries
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gaia_knowledge_base
  ADD COLUMN IF NOT EXISTS source_url text;

COMMENT ON COLUMN public.gaia_knowledge_base.source_url IS 'Citation link Rosa surfaces alongside any answer drawn from this entry.';

INSERT INTO public.gaia_knowledge_base (entry_type, title, content, category, tags, source_url, priority, is_active) VALUES
('guideline',
 'ISO 14044 Section 4.2.3.6 Data Quality Requirements',
 'ISO 14044 requires every LCA to declare data quality across six pedigree dimensions: time-related coverage, geographical coverage, technology coverage, precision, completeness, and representativeness. Each material, energy, transport and waste flow must be scored (typically 1-5 on a pedigree matrix) and the aggregate score rolled up to a Data Quality Index. Uncertainty is then propagated to the final footprint. When primary data cannot be obtained, secondary or proxy data can be used, but the report must transparently disclose the substitution and the reason.',
 'iso_methodology',
 ARRAY['iso_14044','data_quality','pedigree','lca'],
 'https://www.iso.org/standard/38498.html',
 10, true),

('guideline',
 'ISO 14044 Section 4.5 Interpretation',
 'The interpretation phase of an LCA must: (a) identify the significant issues based on inventory and impact assessment, (b) evaluate the study by completeness, sensitivity and consistency checks, and (c) draw conclusions, state limitations, and give recommendations. A "hotspot analysis" meeting 4.5(a) identifies which life-cycle stages or flows contribute most to the impact categories. Conclusions must be backed by the data quality declaration and consistent with the goal and scope.',
 'iso_methodology',
 ARRAY['iso_14044','interpretation','hotspot'],
 'https://www.iso.org/standard/38498.html',
 10, true),

('guideline',
 'ISO 14067 Section 6.3.5 Data Quality Declaration for Carbon Footprint',
 'ISO 14067 requires the carbon footprint of products (CFP) study report to include a data quality declaration covering: the time period of data, the geographical area, the technology coverage, precision, completeness, representativeness, consistency, and reproducibility. Where proxy or secondary data is used, the substitution, its basis, and its expected effect on the result must be stated. This is the reporting-compliant way to handle contract manufacturers or suppliers who cannot share primary energy/water data.',
 'iso_methodology',
 ARRAY['iso_14067','data_quality','cfp','carbon_footprint'],
 'https://www.iso.org/standard/71206.html',
 10, true),

('guideline',
 'VSME Basic Module Disclosure Requirements',
 'The EFRAG Voluntary Sustainability Reporting Standard for non-listed SMEs (VSME) Basic Module covers 11 disclosure datapoints: B1 general (basis of preparation), B2 sustainability matters, B3 energy, B4 GHG emissions (Scope 1 and 2), B5 pollution, B6 biodiversity, B7 water, B8 resource use and circular economy, B9 workforce general, B10 workforce health and safety, B11 business conduct. Scope 3 is not required at Basic level. Intended as the lowest-friction entry point for SMEs receiving ESG data requests from banks, customers, or investors.',
 'reporting_framework',
 ARRAY['vsme','sme','reporting','efrag'],
 'https://www.efrag.org/en/projects/voluntary-esrs-for-non-listed-smes-vsme-esrs/project-final-deliverables',
 10, true),

('guideline',
 'VSME Comprehensive Module Additional Disclosures',
 'The VSME Comprehensive Module adds to the Basic Module: C1 strategy and business model, C2 practices for transitioning towards a sustainable economy, C3 GHG reduction targets and climate transition, C4 climate risks, C5 additional workforce-general disclosures, C6 human rights policies, C7 human rights incidents, C8 revenues in controversial sectors, C9 gender diversity ratio in governance bodies. Scope 3 GHG becomes relevant when material. Designed for SMEs with value-chain partners who need more depth or who want a credible upgrade path to CSRD.',
 'reporting_framework',
 ARRAY['vsme','comprehensive','reporting','efrag','scope_3'],
 'https://www.efrag.org/en/projects/voluntary-esrs-for-non-listed-smes-vsme-esrs/project-final-deliverables',
 9, true),

('guideline',
 'CSRD ESRS E1 Climate Change',
 'Under CSRD, ESRS E1 (Climate) requires in-scope undertakings to disclose: E1-1 transition plan, E1-2 policies, E1-3 actions and resources, E1-4 targets, E1-5 energy consumption and mix, E1-6 gross Scope 1/2/3 and total GHG emissions, E1-7 GHG removals and mitigation via carbon credits, E1-8 internal carbon pricing, E1-9 anticipated financial effects from climate-related physical and transition risks. Scope 3 is mandatory where material. Alignment with science-based targets is expected for transition plans.',
 'reporting_framework',
 ARRAY['csrd','esrs','e1','climate','scope_3'],
 'https://www.efrag.org/en/projects/european-sustainability-reporting-standards-esrs-set-1',
 10, true),

('guideline',
 'UK Green Claims Code (CMA)',
 'The Competition and Markets Authority Green Claims Code sets six principles for environmental claims in the UK: (1) claims must be truthful and accurate, (2) claims must be clear and unambiguous, (3) claims must not omit or hide important information, (4) comparisons must be fair and meaningful, (5) claims must consider the full life cycle of the product, (6) claims must be substantiated. Enforcement via the Digital Markets, Competition and Consumers Act 2024 carries fines of up to 10% of global turnover. "Carbon neutral" and "net zero" claims require robust, independently verifiable evidence.',
 'regulation',
 ARRAY['greenwash','uk','cma','green_claims','greenwashing'],
 'https://www.gov.uk/government/publications/green-claims-code-making-environmental-claims',
 10, true),

('guideline',
 'EU Green Claims Directive',
 'The EU Green Claims Directive (proposed, in trilogue as of 2024-2026) requires explicit environmental claims to be substantiated in advance by independent verifiers using a standardised method. It bans generic claims (e.g. "eco-friendly", "green") without substantiation, and sets strict requirements for carbon offsetting claims. Once in force, claims about future environmental performance must have a detailed implementation plan with interim targets and regular verification.',
 'regulation',
 ARRAY['greenwash','eu','green_claims','directive'],
 'https://environment.ec.europa.eu/topics/circular-economy/green-claims_en',
 9, true),

('definition',
 'BIER 2023 Beverage Industry Benchmarking',
 'The Beverage Industry Environmental Roundtable (BIER) publishes annual water, energy, and GHG benchmarking across beer, wine, spirits, and soft drinks. The 2023 study reports industry-median intensities for packaging lines, brewing, distilling, and winemaking. These benchmarks are commonly used as screening-grade secondary data when primary facility data is unavailable, with appropriate pedigree downgrade per ISO 14044.',
 'benchmark',
 ARRAY['bier','benchmark','beverage','industry_data'],
 'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
 8, true),

('definition',
 'Pedigree Matrix for Data Quality',
 'The pedigree matrix (Weidema & Wesnaes, 1996; adopted in ecoinvent) scores LCA data across five dimensions each 1 to 5: reliability (1 = verified measurements, 5 = non-qualified estimate), completeness, temporal correlation, geographical correlation, and technological correlation. Lower scores are better. Aggregate scores feed into uncertainty ranges used in Monte Carlo propagation. A mid-grade facility-average number typically scores around 3-3-3-3-3 with about ±30% uncertainty.',
 'definition',
 ARRAY['pedigree','uncertainty','lca','ecoinvent'],
 'https://link.springer.com/article/10.1007/s11367-012-0527-3',
 8, true),

('guideline',
 'Scope 1, Scope 2, Scope 3 Definitions (GHG Protocol)',
 'The GHG Protocol Corporate Standard splits emissions into three scopes: Scope 1 = direct emissions from sources owned or controlled (on-site combustion, company vehicles, refrigerants); Scope 2 = indirect emissions from purchased electricity, steam, heat, cooling (location-based and market-based methods must both be reported); Scope 3 = all other indirect emissions across the value chain, split into 15 categories (purchased goods and services, capital goods, fuel-and-energy, transportation and distribution upstream and downstream, waste, business travel, employee commuting, leased assets, processing and use of sold products, end-of-life, investments, franchises). Scope 3 is typically 80-95% of a drinks company''s total footprint.',
 'definition',
 ARRAY['ghg_protocol','scope_1','scope_2','scope_3'],
 'https://ghgprotocol.org/corporate-standard',
 10, true),

('example_qa',
 'What is a cradle-to-gate LCA?',
 'A cradle-to-gate LCA covers every life-cycle stage from raw material extraction (the cradle) up to the point the product leaves the producing facility (the gate). It excludes downstream distribution, retail, use, and end-of-life. Most product carbon footprints published by drinks brands today are cradle-to-gate because the downstream chill chain and consumer behaviour are hard to measure precisely. A cradle-to-grave LCA extends to consumer use and disposal; cradle-to-cradle adds recovery and recycling back into the raw-material pool.',
 'definition',
 ARRAY['lca','scope','boundary','cradle_to_gate'],
 'https://www.iso.org/standard/38498.html',
 8, true);

COMMIT;
