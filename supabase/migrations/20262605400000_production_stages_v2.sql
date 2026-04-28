-- Production Stages v2: multi-stage recipe chains for distillers, brewers, etc.
-- Each product can optionally define an ordered chain of production stages
-- (e.g. mashing -> fermentation -> distillation -> maturation -> bottling).
-- Ingredients on product_materials may reference a stage. The LCA calculator
-- divides upstream-stage ingredients by total bottles produced from one full
-- chain run, derived from the maturation profile or product-level override.

-- ---------------------------------------------------------------------------
-- 1. production_stages: per-product ordered stage chain
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."production_stages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "product_id" bigint NOT NULL REFERENCES "public"."products"("id") ON DELETE CASCADE,
    "ordinal" integer NOT NULL,
    "name" text NOT NULL,
    "stage_type" text NOT NULL,
    "input_volume_l" numeric,
    "output_volume_l" numeric,
    "input_abv_percent" numeric,
    "output_abv_percent" numeric,
    "notes" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "production_stages_stage_type_check"
      CHECK (stage_type IN ('brewing','fermentation','distillation','blending','maturation','bottling','other')),
    CONSTRAINT "production_stages_unique_ordinal" UNIQUE (product_id, ordinal)
);

CREATE INDEX IF NOT EXISTS "production_stages_product_id_idx"
  ON "public"."production_stages" (product_id, ordinal);

ALTER TABLE "public"."production_stages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view production stages in their org"
  ON "public"."production_stages" FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "public"."products" p
    WHERE p.id = production_stages.product_id
      AND p.organization_id = "public"."get_current_organization_id"()
  ));

CREATE POLICY "Members can insert production stages in their org"
  ON "public"."production_stages" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM "public"."products" p
    WHERE p.id = production_stages.product_id
      AND p.organization_id = "public"."get_current_organization_id"()
  ));

CREATE POLICY "Members can update production stages in their org"
  ON "public"."production_stages" FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "public"."products" p
    WHERE p.id = production_stages.product_id
      AND p.organization_id = "public"."get_current_organization_id"()
  ));

CREATE POLICY "Members can delete production stages in their org"
  ON "public"."production_stages" FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "public"."products" p
    WHERE p.id = production_stages.product_id
      AND p.organization_id = "public"."get_current_organization_id"()
  ));

-- ---------------------------------------------------------------------------
-- 2. product_materials.stage_id: optional link from material -> stage
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."product_materials"
  ADD COLUMN IF NOT EXISTS "stage_id" uuid
    REFERENCES "public"."production_stages"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "product_materials_stage_id_idx"
  ON "public"."product_materials" (stage_id) WHERE stage_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. production_chain_templates: built-in + per-org reusable chains
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."production_chain_templates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    "kind" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "stages" jsonb NOT NULL,
    "created_by" uuid,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "production_chain_templates_kind_check" CHECK (kind IN ('built_in','custom')),
    CONSTRAINT "production_chain_templates_org_required_for_custom"
      CHECK ((kind = 'built_in' AND organization_id IS NULL)
          OR (kind = 'custom'   AND organization_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS "production_chain_templates_org_idx"
  ON "public"."production_chain_templates" (organization_id) WHERE organization_id IS NOT NULL;

ALTER TABLE "public"."production_chain_templates" ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read built-ins and their own org's customs.
CREATE POLICY "View built-in or own-org production templates"
  ON "public"."production_chain_templates" FOR SELECT TO authenticated
  USING (
    kind = 'built_in'
    OR organization_id = "public"."get_current_organization_id"()
  );

CREATE POLICY "Insert custom production templates in own org"
  ON "public"."production_chain_templates" FOR INSERT TO authenticated
  WITH CHECK (kind = 'custom' AND organization_id = "public"."get_current_organization_id"());

CREATE POLICY "Update own-org production templates"
  ON "public"."production_chain_templates" FOR UPDATE TO authenticated
  USING (kind = 'custom' AND organization_id = "public"."get_current_organization_id"());

CREATE POLICY "Delete own-org production templates"
  ON "public"."production_chain_templates" FOR DELETE TO authenticated
  USING (kind = 'custom' AND organization_id = "public"."get_current_organization_id"());

-- ---------------------------------------------------------------------------
-- 4. products.production_chain_template_id: informational link
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."products"
  ADD COLUMN IF NOT EXISTS "production_chain_template_id" uuid
    REFERENCES "public"."production_chain_templates"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 5. Seed built-in templates
-- ---------------------------------------------------------------------------

INSERT INTO "public"."production_chain_templates" (kind, name, description, stages)
VALUES
  ('built_in', 'Whisky',
   'Single-malt or grain whisky: mashing through bottling.',
   $json$[
     {"ordinal":0,"name":"Mashing","stage_type":"brewing","default_input_volume_l":1500,"default_output_volume_l":1500},
     {"ordinal":1,"name":"Fermentation","stage_type":"fermentation","default_input_volume_l":1500,"default_output_volume_l":1400,"default_output_abv_percent":8},
     {"ordinal":2,"name":"First distillation (wash still)","stage_type":"distillation","default_input_volume_l":1400,"default_output_volume_l":450,"default_input_abv_percent":8,"default_output_abv_percent":30},
     {"ordinal":3,"name":"Spirit run (low wines still)","stage_type":"distillation","default_input_volume_l":450,"default_output_volume_l":150,"default_input_abv_percent":30,"default_output_abv_percent":65},
     {"ordinal":4,"name":"Maturation","stage_type":"maturation","default_input_volume_l":200,"default_output_volume_l":170,"default_input_abv_percent":65,"default_output_abv_percent":63},
     {"ordinal":5,"name":"Bottling","stage_type":"bottling","default_input_volume_l":170,"default_output_volume_l":340,"default_input_abv_percent":63,"default_output_abv_percent":46}
   ]$json$),
  ('built_in', 'Gin',
   'London-dry style: neutral spirit -> botanical maceration -> distillation -> bottling.',
   $json$[
     {"ordinal":0,"name":"Botanical maceration","stage_type":"blending","default_input_volume_l":1000,"default_output_volume_l":1000,"default_input_abv_percent":96,"default_output_abv_percent":96},
     {"ordinal":1,"name":"Distillation","stage_type":"distillation","default_input_volume_l":1000,"default_output_volume_l":900,"default_input_abv_percent":96,"default_output_abv_percent":85},
     {"ordinal":2,"name":"Bottling","stage_type":"bottling","default_input_volume_l":900,"default_output_volume_l":1700,"default_input_abv_percent":85,"default_output_abv_percent":42}
   ]$json$),
  ('built_in', 'Rum',
   'Molasses fermentation through maturation and bottling.',
   $json$[
     {"ordinal":0,"name":"Molasses fermentation","stage_type":"fermentation","default_input_volume_l":2000,"default_output_volume_l":1800,"default_output_abv_percent":7},
     {"ordinal":1,"name":"Distillation","stage_type":"distillation","default_input_volume_l":1800,"default_output_volume_l":300,"default_input_abv_percent":7,"default_output_abv_percent":75},
     {"ordinal":2,"name":"Maturation","stage_type":"maturation","default_input_volume_l":250,"default_output_volume_l":210,"default_input_abv_percent":75,"default_output_abv_percent":70},
     {"ordinal":3,"name":"Bottling","stage_type":"bottling","default_input_volume_l":210,"default_output_volume_l":420,"default_input_abv_percent":70,"default_output_abv_percent":40}
   ]$json$),
  ('built_in', 'Beer',
   'Standard brewing chain: mashing -> fermentation -> bottling/canning.',
   $json$[
     {"ordinal":0,"name":"Mashing","stage_type":"brewing","default_input_volume_l":1000,"default_output_volume_l":1000},
     {"ordinal":1,"name":"Fermentation","stage_type":"fermentation","default_input_volume_l":1000,"default_output_volume_l":950,"default_output_abv_percent":5},
     {"ordinal":2,"name":"Bottling","stage_type":"bottling","default_input_volume_l":950,"default_output_volume_l":950,"default_input_abv_percent":5,"default_output_abv_percent":5}
   ]$json$),
  ('built_in', 'Wine',
   'Crush -> fermentation -> ageing -> bottling.',
   $json$[
     {"ordinal":0,"name":"Crush / press","stage_type":"brewing","default_input_volume_l":1300,"default_output_volume_l":1000},
     {"ordinal":1,"name":"Fermentation","stage_type":"fermentation","default_input_volume_l":1000,"default_output_volume_l":950,"default_output_abv_percent":13},
     {"ordinal":2,"name":"Ageing","stage_type":"maturation","default_input_volume_l":950,"default_output_volume_l":920,"default_input_abv_percent":13,"default_output_abv_percent":13},
     {"ordinal":3,"name":"Bottling","stage_type":"bottling","default_input_volume_l":920,"default_output_volume_l":920,"default_input_abv_percent":13,"default_output_abv_percent":13}
   ]$json$),
  ('built_in', 'Cider',
   'Apple pressing -> fermentation -> bottling.',
   $json$[
     {"ordinal":0,"name":"Apple pressing","stage_type":"brewing","default_input_volume_l":1500,"default_output_volume_l":1000},
     {"ordinal":1,"name":"Fermentation","stage_type":"fermentation","default_input_volume_l":1000,"default_output_volume_l":950,"default_output_abv_percent":6},
     {"ordinal":2,"name":"Bottling","stage_type":"bottling","default_input_volume_l":950,"default_output_volume_l":950,"default_input_abv_percent":6,"default_output_abv_percent":6}
   ]$json$)
ON CONFLICT DO NOTHING;
