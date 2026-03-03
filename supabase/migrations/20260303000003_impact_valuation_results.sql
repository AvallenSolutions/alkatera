-- Impact Valuation Results table
-- Caches calculation results per organisation/year/proxy-version.

CREATE TABLE IF NOT EXISTS impact_valuation_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reporting_year      integer NOT NULL,
  proxy_version       text NOT NULL DEFAULT '1.0',

  -- Natural Capital
  natural_carbon_value    numeric(14,2),
  natural_water_value     numeric(14,2),
  natural_land_value      numeric(14,2),
  natural_waste_value     numeric(14,2),
  natural_total           numeric(14,2),

  -- Human Capital
  human_living_wage_value     numeric(14,2),
  human_training_value        numeric(14,2),
  human_wellbeing_value       numeric(14,2),
  human_total                 numeric(14,2),

  -- Social Capital
  social_volunteering_value       numeric(14,2),
  social_giving_value             numeric(14,2),
  social_local_multiplier_value   numeric(14,2),
  social_total                    numeric(14,2),

  -- Governance Capital
  governance_total    numeric(14,2),

  -- Totals
  grand_total         numeric(14,2),
  confidence_level    text,          -- 'high' | 'medium' | 'low'
  data_coverage       numeric(5,2),  -- % of metrics that had real data

  calculated_at       timestamptz NOT NULL DEFAULT now(),
  input_snapshot      jsonb,         -- verbatim copy of all raw inputs used
  UNIQUE (organization_id, reporting_year, proxy_version)
);

CREATE INDEX IF NOT EXISTS impact_valuation_results_org_year_idx
  ON impact_valuation_results (organization_id, reporting_year);

-- Row Level Security
ALTER TABLE impact_valuation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "impact_valuation_results_org_select" ON "public"."impact_valuation_results" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "impact_valuation_results_org_insert" ON "public"."impact_valuation_results" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "impact_valuation_results_org_update" ON "public"."impact_valuation_results" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "impact_valuation_results_org_delete" ON "public"."impact_valuation_results" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));
