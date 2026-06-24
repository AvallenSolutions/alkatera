-- 20260624120000_advisor_rls_comprehensive.sql
--
-- Comprehensive fix: extend all org-data RLS policies to allow read-write advisors.
--
-- Root cause: most tables checked `organization_members` directly in permissive
-- write (and read) policies, blocking advisors entirely — even read-write advisors —
-- because advisors are not org members, only in `advisor_organization_access`.
-- The earlier migration (20260618130000) added restrictive `advisor_ro_no_*`
-- policies to 17 tables but never updated the permissive policies that were
-- already blocking all advisors.
--
-- This migration:
--   1. Replaces simple org_members-based permissive policies with
--      user_has_organization_access() (which covers members AND active advisors).
--   2. Adds advisor_ro_no_insert/update/delete RESTRICTIVE policies so read-only
--      advisors cannot write (DROP IF EXISTS first so it is idempotent for the
--      17 tables that already had these from migration 20260618130000).
--   3. Handles join-based tables (no direct organization_id column) individually.
--
-- Skipped tables:
--   Already fixed:  product_materials, packaging_material_components,
--                   packaging_templates (migrations 20260624100000/20260624110000)
--   Admin-only:     organization_suppliers (writes intentionally require admin role)
--   Audit/system:   ingredient_selection_audit, lca_workflow_audit (INSERT handled
--                   below, no UPDATE/DELETE), dashboard_anomalies,
--                   facility_data_quality_snapshot
--   Participant-scoped: advisor_conversations, advisor_messages
--   Platform-level: knowledge_bank_*, platform_suppliers, gaia_*, feedback_*

-- ─── Part 1: Tables with a direct organization_id column ──────────────────────
DO $$
DECLARE
  pol  RECORD;
  t    text;
  tables_to_fix text[] := ARRAY[
    -- Previously fixed by 20260618130000 (already have advisor_ro_no_* but
    -- permissive write policies may still check organization_members directly)
    'activity_data','agent_exceptions','calculated_emissions',
    'emissions_calculation_context','facilities','facility_activity_entries',
    'facility_emissions_aggregated','historical_imports','integration_requests',
    'operational_change_events','product_carbon_footprint_production_sites',
    'product_carbon_footprints','vineyard_growing_profiles',
    'vineyard_soil_carbon_evidence','vineyards','xero_sync_logs',
    -- New tables (simple org_members permissive policies confirmed above)
    'arable_fields','arable_growing_profiles','arable_soil_carbon_evidence',
    'arable_spray_chemicals','bom_imports','bulk_import_sessions',
    'byproduct_flows','byproducts','certification_audit_packages',
    'certification_evidence_links','certification_gap_analyses',
    'certification_score_history','circularity_targets','community_donations',
    'community_engagements','community_impact_scores','community_impact_stories',
    'community_local_impact','community_volunteer_activities',
    'contract_manufacturer_allocations','corporate_reports',
    'emission_factor_requests','epr_audit_log','epr_hmrc_addresses',
    'epr_hmrc_brands','epr_hmrc_contacts','epr_hmrc_org_details',
    'epr_hmrc_partners','epr_organization_settings','epr_prn_obligations',
    'epr_submission_lines','epr_submissions','facility_activity_data',
    'facility_product_assignments','facility_production_volumes',
    'facility_reporting_sessions','facility_water_data','fleet_activities',
    'governance_board_members','governance_ethics_records','governance_lobbying',
    'governance_mission','governance_policies','governance_scores',
    'governance_stakeholder_engagements','governance_stakeholders',
    'greenwash_assessments','hospitality_meal_meta','hospitality_menu_items',
    'hospitality_menus','hospitality_room_allocation','hospitality_service_volumes',
    'hospitality_settings','hospitality_venues','hospitality_waste',
    'impact_valuation_results','ingredients_templates','lca_critical_reviews',
    'lca_interpretation_results','lca_report_templates','materiality_assessments',
    'maturation_profiles','nature_action_flows','nature_actions',
    'nature_dependencies','openlca_impact_cache','orchard_growing_profiles',
    'orchard_soil_carbon_evidence','orchard_spray_chemicals','orchards',
    'organization_certifications','packaging_circularity_profiles',
    'people_benefits','people_culture_scores','people_dei_actions',
    'people_employee_compensation','people_employee_surveys',
    'people_survey_responses','people_training_records',
    'people_workforce_demographics','product_end_of_life_scenarios',
    'production_logs','production_run_resource_data','reduction_initiatives',
    'soil_carbon_samples','spend_import_batches','staging_emission_factors',
    'supplier_data_submissions','supplier_data_upgrade_recommendations',
    'supplier_responsibility_attestations','transition_plans','vehicles'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_fix LOOP
    -- Skip tables that do not yet exist on this environment (e.g. hospitality
    -- tables pending migration on production).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    -- Drop simple org_members-based permissive policies for all four commands.
    -- Filter keeps role-check and draft/status-check policies untouched:
    --   contract_manufacturer_allocations UPDATE/DELETE (admin role)
    --   epr_submissions DELETE (draft status)
    --   fleet_activities UPDATE (own-user role)
    --   reduction_initiatives DELETE (admin role)
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND cmd IN ('SELECT','INSERT','UPDATE','DELETE')
        AND permissive = 'PERMISSIVE'
        AND (
          COALESCE(qual,'') LIKE '%organization_members%'
          OR COALESCE(with_check,'') LIKE '%organization_members%'
        )
        AND COALESCE(qual,'')        NOT LIKE '%role%'
        AND COALESCE(with_check,'')  NOT LIKE '%role%'
        AND COALESCE(qual,'')        NOT LIKE '%draft%'
        AND COALESCE(with_check,'')  NOT LIKE '%draft%'
        AND COALESCE(qual,'')        NOT LIKE '%provisional%'
        AND COALESCE(with_check,'')  NOT LIKE '%provisional%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- SELECT: create if no user_has_organization_access policy yet
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT'
        AND COALESCE(qual,'') LIKE '%user_has_organization_access%'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
        || 'USING (public.user_has_organization_access(organization_id))',
        t || '_select', t
      );
    END IF;

    -- INSERT
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'INSERT'
        AND permissive = 'PERMISSIVE'
        AND COALESCE(with_check,'') LIKE '%user_has_organization_access%'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated '
        || 'WITH CHECK (public.user_has_organization_access(organization_id))',
        t || '_insert', t
      );
    END IF;

    -- UPDATE
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'UPDATE'
        AND permissive = 'PERMISSIVE'
        AND (
          COALESCE(qual,'')        LIKE '%user_has_organization_access%'
          OR COALESCE(with_check,'') LIKE '%user_has_organization_access%'
        )
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated '
        || 'USING  (public.user_has_organization_access(organization_id)) '
        || 'WITH CHECK (public.user_has_organization_access(organization_id))',
        t || '_update', t
      );
    END IF;

    -- DELETE
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'DELETE'
        AND permissive = 'PERMISSIVE'
        AND COALESCE(qual,'') LIKE '%user_has_organization_access%'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated '
        || 'USING (public.user_has_organization_access(organization_id))',
        t || '_delete', t
      );
    END IF;

    -- Restrictive: block read-only advisors from writing (idempotent DROP/CREATE)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'advisor_ro_no_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'advisor_ro_no_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'advisor_ro_no_delete', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
      || 'WITH CHECK (NOT public.is_readonly_advisor(organization_id))',
      'advisor_ro_no_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
      || 'USING (NOT public.is_readonly_advisor(organization_id))',
      'advisor_ro_no_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated '
      || 'USING (NOT public.is_readonly_advisor(organization_id))',
      'advisor_ro_no_delete', t
    );
  END LOOP;
END $$;


-- ─── Part 2: Tables WITHOUT a direct organization_id column ──────────────────
-- These join through a parent table to reach organization_id, so they need
-- explicit policy statements rather than the dynamic DO block above.

-- ── bom_extracted_items (via bom_imports.organization_id) ────────────────────
DROP POLICY IF EXISTS "Users can view extracted items for their organization"   ON public.bom_extracted_items;
DROP POLICY IF EXISTS "Users can insert extracted items for their organization" ON public.bom_extracted_items;
DROP POLICY IF EXISTS "Users can update extracted items for their organization" ON public.bom_extracted_items;
DROP POLICY IF EXISTS "Users can delete extracted items for their organization" ON public.bom_extracted_items;

CREATE POLICY "Users can view extracted items for their organization"
  ON public.bom_extracted_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bom_imports bi
    WHERE bi.id = bom_extracted_items.bom_import_id
      AND public.user_has_organization_access(bi.organization_id)
  ));

CREATE POLICY "Users can insert extracted items for their organization"
  ON public.bom_extracted_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bom_imports bi
    WHERE bi.id = bom_extracted_items.bom_import_id
      AND public.user_has_organization_access(bi.organization_id)
  ));

CREATE POLICY "Users can update extracted items for their organization"
  ON public.bom_extracted_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bom_imports bi
    WHERE bi.id = bom_extracted_items.bom_import_id
      AND public.user_has_organization_access(bi.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bom_imports bi
    WHERE bi.id = bom_extracted_items.bom_import_id
      AND public.user_has_organization_access(bi.organization_id)
  ));

CREATE POLICY "Users can delete extracted items for their organization"
  ON public.bom_extracted_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bom_imports bi
    WHERE bi.id = bom_extracted_items.bom_import_id
      AND public.user_has_organization_access(bi.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.bom_extracted_items;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.bom_extracted_items;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.bom_extracted_items;
CREATE POLICY advisor_ro_no_insert ON public.bom_extracted_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.bom_imports bi
    WHERE bi.id = bom_extracted_items.bom_import_id
      AND public.is_readonly_advisor(bi.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.bom_extracted_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.bom_imports bi
    WHERE bi.id = bom_extracted_items.bom_import_id
      AND public.is_readonly_advisor(bi.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.bom_extracted_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.bom_imports bi
    WHERE bi.id = bom_extracted_items.bom_import_id
      AND public.is_readonly_advisor(bi.organization_id)
  ));


-- ── contract_manufacturer_energy_inputs (via contract_manufacturer_allocations) ─
-- Only fix SELECT + INSERT. UPDATE/DELETE intentionally restrict to draft/provisional
-- allocations (business logic) and are left unchanged.
DROP POLICY IF EXISTS "Users can view energy inputs for their allocations"   ON public.contract_manufacturer_energy_inputs;
DROP POLICY IF EXISTS "Users can insert energy inputs for their allocations" ON public.contract_manufacturer_energy_inputs;

CREATE POLICY "Users can view energy inputs for their allocations"
  ON public.contract_manufacturer_energy_inputs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contract_manufacturer_allocations cma
    WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND public.user_has_organization_access(cma.organization_id)
  ));

CREATE POLICY "Users can insert energy inputs for their allocations"
  ON public.contract_manufacturer_energy_inputs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contract_manufacturer_allocations cma
    WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND public.user_has_organization_access(cma.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.contract_manufacturer_energy_inputs;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.contract_manufacturer_energy_inputs;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.contract_manufacturer_energy_inputs;
CREATE POLICY advisor_ro_no_insert ON public.contract_manufacturer_energy_inputs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.contract_manufacturer_allocations cma
    WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND public.is_readonly_advisor(cma.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.contract_manufacturer_energy_inputs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.contract_manufacturer_allocations cma
    WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND public.is_readonly_advisor(cma.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.contract_manufacturer_energy_inputs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.contract_manufacturer_allocations cma
    WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND public.is_readonly_advisor(cma.organization_id)
  ));


-- ── corporate_overheads (via corporate_reports.organization_id) ───────────────
DROP POLICY IF EXISTS "Users can view corporate overheads for their reports"   ON public.corporate_overheads;
DROP POLICY IF EXISTS "Users can insert corporate overheads for their reports" ON public.corporate_overheads;
DROP POLICY IF EXISTS "Users can update corporate overheads for their reports" ON public.corporate_overheads;
DROP POLICY IF EXISTS "Users can delete corporate overheads for their reports" ON public.corporate_overheads;

CREATE POLICY "Users can view corporate overheads for their reports"
  ON public.corporate_overheads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.corporate_reports cr
    WHERE cr.id = corporate_overheads.report_id
      AND public.user_has_organization_access(cr.organization_id)
  ));

CREATE POLICY "Users can insert corporate overheads for their reports"
  ON public.corporate_overheads FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.corporate_reports cr
    WHERE cr.id = corporate_overheads.report_id
      AND public.user_has_organization_access(cr.organization_id)
  ));

CREATE POLICY "Users can update corporate overheads for their reports"
  ON public.corporate_overheads FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.corporate_reports cr
    WHERE cr.id = corporate_overheads.report_id
      AND public.user_has_organization_access(cr.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.corporate_reports cr
    WHERE cr.id = corporate_overheads.report_id
      AND public.user_has_organization_access(cr.organization_id)
  ));

CREATE POLICY "Users can delete corporate overheads for their reports"
  ON public.corporate_overheads FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.corporate_reports cr
    WHERE cr.id = corporate_overheads.report_id
      AND public.user_has_organization_access(cr.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.corporate_overheads;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.corporate_overheads;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.corporate_overheads;
CREATE POLICY advisor_ro_no_insert ON public.corporate_overheads AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.corporate_reports cr
    WHERE cr.id = corporate_overheads.report_id
      AND public.is_readonly_advisor(cr.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.corporate_overheads AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.corporate_reports cr
    WHERE cr.id = corporate_overheads.report_id
      AND public.is_readonly_advisor(cr.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.corporate_overheads AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.corporate_reports cr
    WHERE cr.id = corporate_overheads.report_id
      AND public.is_readonly_advisor(cr.organization_id)
  ));


-- ── governance_policy_versions (via governance_policies.organization_id) ──────
DROP POLICY IF EXISTS governance_policy_versions_org_select ON public.governance_policy_versions;
DROP POLICY IF EXISTS governance_policy_versions_org_insert ON public.governance_policy_versions;
DROP POLICY IF EXISTS governance_policy_versions_org_update ON public.governance_policy_versions;
DROP POLICY IF EXISTS governance_policy_versions_org_delete ON public.governance_policy_versions;

CREATE POLICY governance_policy_versions_org_select
  ON public.governance_policy_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.governance_policies gp
    WHERE gp.id = governance_policy_versions.policy_id
      AND public.user_has_organization_access(gp.organization_id)
  ));

CREATE POLICY governance_policy_versions_org_insert
  ON public.governance_policy_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.governance_policies gp
    WHERE gp.id = governance_policy_versions.policy_id
      AND public.user_has_organization_access(gp.organization_id)
  ));

CREATE POLICY governance_policy_versions_org_update
  ON public.governance_policy_versions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.governance_policies gp
    WHERE gp.id = governance_policy_versions.policy_id
      AND public.user_has_organization_access(gp.organization_id)
  ));

CREATE POLICY governance_policy_versions_org_delete
  ON public.governance_policy_versions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.governance_policies gp
    WHERE gp.id = governance_policy_versions.policy_id
      AND public.user_has_organization_access(gp.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.governance_policy_versions;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.governance_policy_versions;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.governance_policy_versions;
CREATE POLICY advisor_ro_no_insert ON public.governance_policy_versions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.governance_policies gp
    WHERE gp.id = governance_policy_versions.policy_id
      AND public.is_readonly_advisor(gp.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.governance_policy_versions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.governance_policies gp
    WHERE gp.id = governance_policy_versions.policy_id
      AND public.is_readonly_advisor(gp.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.governance_policy_versions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.governance_policies gp
    WHERE gp.id = governance_policy_versions.policy_id
      AND public.is_readonly_advisor(gp.organization_id)
  ));


-- ── greenwash_assessment_claims (via greenwash_assessments.organization_id) ───
DROP POLICY IF EXISTS "Users can view claims for assessments in their organization"   ON public.greenwash_assessment_claims;
DROP POLICY IF EXISTS "Users can create claims for assessments in their organization" ON public.greenwash_assessment_claims;
DROP POLICY IF EXISTS "Users can update claims for assessments in their organization" ON public.greenwash_assessment_claims;
DROP POLICY IF EXISTS "Users can delete claims for assessments in their organization" ON public.greenwash_assessment_claims;

CREATE POLICY "Users can view claims for assessments in their organization"
  ON public.greenwash_assessment_claims FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    WHERE ga.id = greenwash_assessment_claims.assessment_id
      AND public.user_has_organization_access(ga.organization_id)
  ));

CREATE POLICY "Users can create claims for assessments in their organization"
  ON public.greenwash_assessment_claims FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    WHERE ga.id = greenwash_assessment_claims.assessment_id
      AND public.user_has_organization_access(ga.organization_id)
  ));

CREATE POLICY "Users can update claims for assessments in their organization"
  ON public.greenwash_assessment_claims FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    WHERE ga.id = greenwash_assessment_claims.assessment_id
      AND public.user_has_organization_access(ga.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    WHERE ga.id = greenwash_assessment_claims.assessment_id
      AND public.user_has_organization_access(ga.organization_id)
  ));

CREATE POLICY "Users can delete claims for assessments in their organization"
  ON public.greenwash_assessment_claims FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    WHERE ga.id = greenwash_assessment_claims.assessment_id
      AND public.user_has_organization_access(ga.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.greenwash_assessment_claims;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.greenwash_assessment_claims;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.greenwash_assessment_claims;
CREATE POLICY advisor_ro_no_insert ON public.greenwash_assessment_claims AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    WHERE ga.id = greenwash_assessment_claims.assessment_id
      AND public.is_readonly_advisor(ga.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.greenwash_assessment_claims AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    WHERE ga.id = greenwash_assessment_claims.assessment_id
      AND public.is_readonly_advisor(ga.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.greenwash_assessment_claims AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    WHERE ga.id = greenwash_assessment_claims.assessment_id
      AND public.is_readonly_advisor(ga.organization_id)
  ));


-- ── lca_production_mix (via product_carbon_footprints.organization_id, lca_id) ─
DROP POLICY IF EXISTS "Users can view production mix for their organization"   ON public.lca_production_mix;
DROP POLICY IF EXISTS "Users can insert production mix for their organization" ON public.lca_production_mix;
DROP POLICY IF EXISTS "Users can update production mix for their organization" ON public.lca_production_mix;
DROP POLICY IF EXISTS "Users can delete production mix for their organization" ON public.lca_production_mix;

CREATE POLICY "Users can view production mix for their organization"
  ON public.lca_production_mix FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_production_mix.lca_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Users can insert production mix for their organization"
  ON public.lca_production_mix FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_production_mix.lca_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Users can update production mix for their organization"
  ON public.lca_production_mix FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_production_mix.lca_id
      AND public.user_has_organization_access(pcf.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_production_mix.lca_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Users can delete production mix for their organization"
  ON public.lca_production_mix FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_production_mix.lca_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.lca_production_mix;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.lca_production_mix;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.lca_production_mix;
CREATE POLICY advisor_ro_no_insert ON public.lca_production_mix AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_production_mix.lca_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.lca_production_mix AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_production_mix.lca_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.lca_production_mix AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_production_mix.lca_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));


-- ── lca_workflow_audit (via product_carbon_footprints, product_lca_id) ────────
-- Audit log: SELECT + INSERT only (no UPDATE/DELETE by design)
DROP POLICY IF EXISTS "Users can view audit logs for their organization's LCAs"   ON public.lca_workflow_audit;
DROP POLICY IF EXISTS "Users can insert audit logs for their organization's LCAs" ON public.lca_workflow_audit;

CREATE POLICY "Users can view audit logs for their organization's LCAs"
  ON public.lca_workflow_audit FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_workflow_audit.product_lca_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Users can insert audit logs for their organization's LCAs"
  ON public.lca_workflow_audit FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_workflow_audit.product_lca_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.lca_workflow_audit;
CREATE POLICY advisor_ro_no_insert ON public.lca_workflow_audit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = lca_workflow_audit.product_lca_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));


-- ── product_carbon_footprint_materials (via product_carbon_footprints) ─────────
DROP POLICY IF EXISTS "Users can view materials for their organization's PCFs"   ON public.product_carbon_footprint_materials;
DROP POLICY IF EXISTS "Users can insert materials for their organization's PCFs" ON public.product_carbon_footprint_materials;
DROP POLICY IF EXISTS "Users can update materials for their organization's PCFs" ON public.product_carbon_footprint_materials;
DROP POLICY IF EXISTS "Users can delete materials for their organization's PCFs" ON public.product_carbon_footprint_materials;

CREATE POLICY "Users can view materials for their organization's PCFs"
  ON public.product_carbon_footprint_materials FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_materials.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Users can insert materials for their organization's PCFs"
  ON public.product_carbon_footprint_materials FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_materials.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Users can update materials for their organization's PCFs"
  ON public.product_carbon_footprint_materials FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_materials.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_materials.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Users can delete materials for their organization's PCFs"
  ON public.product_carbon_footprint_materials FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_materials.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.product_carbon_footprint_materials;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.product_carbon_footprint_materials;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.product_carbon_footprint_materials;
CREATE POLICY advisor_ro_no_insert ON public.product_carbon_footprint_materials AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_materials.product_carbon_footprint_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.product_carbon_footprint_materials AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_materials.product_carbon_footprint_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.product_carbon_footprint_materials AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_materials.product_carbon_footprint_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));


-- ── product_carbon_footprint_results (via product_carbon_footprints) ────────
-- Note: keeps "Service role can insert LCA results" (WITH CHECK = true) untouched.
DROP POLICY IF EXISTS "Organization members can view LCA results"   ON public.product_carbon_footprint_results;
DROP POLICY IF EXISTS "Organization members can create LCA results" ON public.product_carbon_footprint_results;
DROP POLICY IF EXISTS "Organization members can update LCA results" ON public.product_carbon_footprint_results;
DROP POLICY IF EXISTS "Organization members can delete LCA results" ON public.product_carbon_footprint_results;

CREATE POLICY "Organization members can view LCA results"
  ON public.product_carbon_footprint_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_results.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Organization members can create LCA results"
  ON public.product_carbon_footprint_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_results.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Organization members can update LCA results"
  ON public.product_carbon_footprint_results FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_results.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_results.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

CREATE POLICY "Organization members can delete LCA results"
  ON public.product_carbon_footprint_results FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_results.product_carbon_footprint_id
      AND public.user_has_organization_access(pcf.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.product_carbon_footprint_results;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.product_carbon_footprint_results;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.product_carbon_footprint_results;
CREATE POLICY advisor_ro_no_insert ON public.product_carbon_footprint_results AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_results.product_carbon_footprint_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.product_carbon_footprint_results AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_results.product_carbon_footprint_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.product_carbon_footprint_results AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.product_carbon_footprints pcf
    WHERE pcf.id = product_carbon_footprint_results.product_carbon_footprint_id
      AND public.is_readonly_advisor(pcf.organization_id)
  ));


-- ── spend_import_items (via spend_import_batches.organization_id) ─────────────
-- Drops both old policy variants (duplicates existed from separate migrations)
DROP POLICY IF EXISTS "Users can insert spend import items for their batches"    ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can update spend import items for their batches"    ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can delete spend import items for their batches"    ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can create import items for own organization"       ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can update own organization's import items"         ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can delete own organization's import items"         ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can view spend import items for their batches"      ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can view own organization's import items"           ON public.spend_import_items;

CREATE POLICY "Users can view spend import items for their batches"
  ON public.spend_import_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.spend_import_batches sib
    WHERE sib.id = spend_import_items.batch_id
      AND public.user_has_organization_access(sib.organization_id)
  ));

CREATE POLICY "Users can insert spend import items for their batches"
  ON public.spend_import_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.spend_import_batches sib
    WHERE sib.id = spend_import_items.batch_id
      AND public.user_has_organization_access(sib.organization_id)
  ));

CREATE POLICY "Users can update spend import items for their batches"
  ON public.spend_import_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.spend_import_batches sib
    WHERE sib.id = spend_import_items.batch_id
      AND public.user_has_organization_access(sib.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.spend_import_batches sib
    WHERE sib.id = spend_import_items.batch_id
      AND public.user_has_organization_access(sib.organization_id)
  ));

CREATE POLICY "Users can delete spend import items for their batches"
  ON public.spend_import_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.spend_import_batches sib
    WHERE sib.id = spend_import_items.batch_id
      AND public.user_has_organization_access(sib.organization_id)
  ));

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.spend_import_items;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.spend_import_items;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.spend_import_items;
CREATE POLICY advisor_ro_no_insert ON public.spend_import_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.spend_import_batches sib
    WHERE sib.id = spend_import_items.batch_id
      AND public.is_readonly_advisor(sib.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.spend_import_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.spend_import_batches sib
    WHERE sib.id = spend_import_items.batch_id
      AND public.is_readonly_advisor(sib.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.spend_import_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.spend_import_batches sib
    WHERE sib.id = spend_import_items.batch_id
      AND public.is_readonly_advisor(sib.organization_id)
  ));


-- ── utility_data_entries (via facilities.organization_id) ─────────────────────
-- Correct user_has_organization_access policies were already added in a prior
-- migration; just drop the old org_members-based duplicates.
DROP POLICY IF EXISTS "Users can insert utility data for their organization facilities" ON public.utility_data_entries;
DROP POLICY IF EXISTS "Users can update utility data for their organization facilities" ON public.utility_data_entries;
DROP POLICY IF EXISTS "Users can delete utility data for their organization facilities" ON public.utility_data_entries;
DROP POLICY IF EXISTS "Users can view utility data for their organization facilities"   ON public.utility_data_entries;

DROP POLICY IF EXISTS advisor_ro_no_insert ON public.utility_data_entries;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.utility_data_entries;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.utility_data_entries;
CREATE POLICY advisor_ro_no_insert ON public.utility_data_entries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = utility_data_entries.facility_id
      AND public.is_readonly_advisor(f.organization_id)
  ));
CREATE POLICY advisor_ro_no_update ON public.utility_data_entries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = utility_data_entries.facility_id
      AND public.is_readonly_advisor(f.organization_id)
  ));
CREATE POLICY advisor_ro_no_delete ON public.utility_data_entries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = utility_data_entries.facility_id
      AND public.is_readonly_advisor(f.organization_id)
  ));
