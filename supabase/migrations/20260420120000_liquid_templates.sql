-- Liquid Templates: extend ingredients_templates with an optional maturation profile
-- so aged-spirit producers can reuse the same liquid (ingredients + maturation) across
-- multiple bottle formats.
--
-- Keeping the table name for backwards compatibility. UI surfaces this as a
-- "Liquid Template" whenever maturation is populated, and an "Ingredients
-- Template" otherwise.

ALTER TABLE public.ingredients_templates
  ADD COLUMN IF NOT EXISTS maturation jsonb NULL;

-- Stored generated column so we can filter/index without re-parsing JSON.
ALTER TABLE public.ingredients_templates
  ADD COLUMN IF NOT EXISTS has_maturation boolean
    GENERATED ALWAYS AS (maturation IS NOT NULL) STORED;

CREATE INDEX IF NOT EXISTS idx_ingredients_templates_has_maturation
  ON public.ingredients_templates(organization_id, has_maturation)
  WHERE has_maturation = true;

COMMENT ON COLUMN public.ingredients_templates.maturation IS
  'Optional maturation profile blob for aged spirits. When set, this template is surfaced as a "Liquid Template" in the UI. Shape mirrors lib/types/maturation.ts MaturationTemplateData (volume-independent fields only).';
