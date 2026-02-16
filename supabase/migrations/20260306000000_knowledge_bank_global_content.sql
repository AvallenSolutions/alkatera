-- Enable global (platform-level) content in the knowledge bank.
-- Follows the same pattern as staging_emission_factors: organization_id = NULL
-- means the row is visible to ALL authenticated users.

-- ============================================================
-- 1. Make organization_id nullable on knowledge bank tables
-- ============================================================

ALTER TABLE knowledge_bank_categories ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE knowledge_bank_items      ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE knowledge_bank_tags       ALTER COLUMN organization_id DROP NOT NULL;

-- ============================================================
-- 2. Partial unique indexes for global rows (NULL org_id)
--    PostgreSQL UNIQUE constraints treat NULL != NULL, so we
--    need explicit partial indexes for the global namespace.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_categories_global_name
  ON knowledge_bank_categories (LOWER(name))
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_tags_global_name
  ON knowledge_bank_tags (LOWER(name))
  WHERE organization_id IS NULL;

-- ============================================================
-- 3. Replace SELECT RLS policies to include global content
-- ============================================================

-- knowledge_bank_items: global published items visible to everyone
DROP POLICY IF EXISTS "Users can view published items in their organization" ON knowledge_bank_items;
CREATE POLICY "Users can view published items in their org or global"
  ON knowledge_bank_items FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND status = 'published')
    OR
    (organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    ) AND (status = 'published' OR author_id = auth.uid()))
  );

-- knowledge_bank_categories: global categories visible to everyone
DROP POLICY IF EXISTS "Users can view their organization's categories" ON knowledge_bank_categories;
CREATE POLICY "Users can view their org or global categories"
  ON knowledge_bank_categories FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- knowledge_bank_tags: global tags visible to everyone
DROP POLICY IF EXISTS "Users can view their organization's tags" ON knowledge_bank_tags;
CREATE POLICY "Users can view their org or global tags"
  ON knowledge_bank_tags FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- knowledge_bank_item_tags: follow item visibility
DROP POLICY IF EXISTS "Users can view item tags" ON knowledge_bank_item_tags;
CREATE POLICY "Users can view item tags"
  ON knowledge_bank_item_tags FOR SELECT TO authenticated
  USING (
    item_id IN (
      SELECT id FROM knowledge_bank_items
      WHERE organization_id IS NULL AND status = 'published'
    )
    OR item_id IN (
      SELECT id FROM knowledge_bank_items
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- knowledge_bank_item_tags: follow item visibility for manage policy too
DROP POLICY IF EXISTS "Users can manage item tags" ON knowledge_bank_item_tags;
CREATE POLICY "Users can manage item tags"
  ON knowledge_bank_item_tags TO authenticated
  USING (
    item_id IN (
      SELECT id FROM knowledge_bank_items
      WHERE organization_id IS NULL AND is_alkatera_admin()
    )
    OR item_id IN (
      SELECT id FROM knowledge_bank_items
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 4. INSERT policies for platform admins to create global content
-- ============================================================

CREATE POLICY "Platform admins can create global items"
  ON knowledge_bank_items FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL  -- existing policy handles org items
    OR is_alkatera_admin()
  );

CREATE POLICY "Platform admins can create global categories"
  ON knowledge_bank_categories FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    OR is_alkatera_admin()
  );

CREATE POLICY "Platform admins can create global tags"
  ON knowledge_bank_tags FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    OR is_alkatera_admin()
  );

-- ============================================================
-- 5. UPDATE / DELETE policies for platform admins on global content
-- ============================================================

CREATE POLICY "Platform admins can update global items"
  ON knowledge_bank_items FOR UPDATE TO authenticated
  USING (organization_id IS NULL AND is_alkatera_admin());

CREATE POLICY "Platform admins can delete global items"
  ON knowledge_bank_items FOR DELETE TO authenticated
  USING (organization_id IS NULL AND is_alkatera_admin());

CREATE POLICY "Platform admins can update global categories"
  ON knowledge_bank_categories FOR UPDATE TO authenticated
  USING (organization_id IS NULL AND is_alkatera_admin());

CREATE POLICY "Platform admins can delete global categories"
  ON knowledge_bank_categories FOR DELETE TO authenticated
  USING (organization_id IS NULL AND is_alkatera_admin());

CREATE POLICY "Platform admins can update global tags"
  ON knowledge_bank_tags FOR UPDATE TO authenticated
  USING (organization_id IS NULL AND is_alkatera_admin());

CREATE POLICY "Platform admins can delete global tags"
  ON knowledge_bank_tags FOR DELETE TO authenticated
  USING (organization_id IS NULL AND is_alkatera_admin());

-- ============================================================
-- 6. Convert duplicated seed categories into single global rows
--    For each category name that exists across multiple orgs with
--    identical content, keep one row and set org_id = NULL.
--    Move any items that reference the deleted duplicates.
-- ============================================================

DO $$
DECLARE
  _cat_names text[] := ARRAY[
    'Governance & Ethics',
    'Climate Action & GHG',
    'Worker Wellbeing',
    'Diversity & Inclusion',
    'Environmental Stewardship',
    'Circular Economy',
    'Community Impact',
    'Supply Chain Responsibility',
    'Customer Stewardship',
    'Reporting & Transparency',
    'Platform & Security'
  ];
  _name text;
  _keeper_id uuid;
BEGIN
  FOREACH _name IN ARRAY _cat_names
  LOOP
    -- Pick the first category row (by created_at) as the keeper
    SELECT id INTO _keeper_id
    FROM knowledge_bank_categories
    WHERE name = _name AND organization_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Skip if this category doesn't exist at all
    IF _keeper_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Re-point any items from duplicate categories to the keeper
    UPDATE knowledge_bank_items
    SET category_id = _keeper_id
    WHERE category_id IN (
      SELECT id FROM knowledge_bank_categories
      WHERE name = _name AND id != _keeper_id
    );

    -- Delete the duplicate categories (all except keeper)
    DELETE FROM knowledge_bank_categories
    WHERE name = _name AND id != _keeper_id;

    -- Make the keeper global
    UPDATE knowledge_bank_categories
    SET organization_id = NULL
    WHERE id = _keeper_id;
  END LOOP;
END $$;

-- Also convert any items that were under these categories to global,
-- since they were platform-provided seed content
UPDATE knowledge_bank_items
SET organization_id = NULL
WHERE category_id IN (
  SELECT id FROM knowledge_bank_categories
  WHERE organization_id IS NULL
);
