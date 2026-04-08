-- =============================================================================
-- Convert alkatera Demo org Knowledge Bank content to global (visible to all)
-- =============================================================================
-- Resources created in the Demo org (2d86de84-...) were saved with that org's
-- ID before the global content logic was in place. Setting organization_id to
-- NULL makes them visible to every authenticated user via existing RLS policies.
--
-- Categories and tags have partial unique indexes on LOWER(name) WHERE
-- organization_id IS NULL, so we must handle duplicates carefully:
--   - Re-point items/item_tags to the existing global row if one exists
--   - Only convert to global if no duplicate exists

DO $$
DECLARE
  demo_org_id uuid := '2d86de84-e24e-458b-84b9-fd4057998bda';
  cat RECORD;
  tag RECORD;
  existing_global_id uuid;
BEGIN
  -- 1. Categories: merge duplicates before converting
  FOR cat IN
    SELECT id, name FROM knowledge_bank_categories
    WHERE organization_id = demo_org_id
  LOOP
    SELECT id INTO existing_global_id
    FROM knowledge_bank_categories
    WHERE organization_id IS NULL AND LOWER(name) = LOWER(cat.name);

    IF existing_global_id IS NOT NULL THEN
      -- Re-point items from demo category to existing global category
      UPDATE knowledge_bank_items
      SET category_id = existing_global_id
      WHERE category_id = cat.id;
      -- Remove the now-orphaned demo category
      DELETE FROM knowledge_bank_categories WHERE id = cat.id;
    ELSE
      -- No conflict, convert to global
      UPDATE knowledge_bank_categories
      SET organization_id = NULL
      WHERE id = cat.id;
    END IF;
  END LOOP;

  -- 2. Tags: merge duplicates before converting
  FOR tag IN
    SELECT id, name FROM knowledge_bank_tags
    WHERE organization_id = demo_org_id
  LOOP
    SELECT id INTO existing_global_id
    FROM knowledge_bank_tags
    WHERE organization_id IS NULL AND LOWER(name) = LOWER(tag.name);

    IF existing_global_id IS NOT NULL THEN
      -- Re-point item_tags from demo tag to existing global tag
      UPDATE knowledge_bank_item_tags
      SET tag_id = existing_global_id
      WHERE tag_id = tag.id
      AND NOT EXISTS (
        -- Avoid duplicate (item_id, tag_id) pairs
        SELECT 1 FROM knowledge_bank_item_tags
        WHERE tag_id = existing_global_id
        AND item_id = knowledge_bank_item_tags.item_id
      );
      -- Remove any remaining orphaned references
      DELETE FROM knowledge_bank_item_tags WHERE tag_id = tag.id;
      -- Remove the demo tag
      DELETE FROM knowledge_bank_tags WHERE id = tag.id;
    ELSE
      UPDATE knowledge_bank_tags
      SET organization_id = NULL
      WHERE id = tag.id;
    END IF;
  END LOOP;

  -- 3. Items: no unique constraint issues, convert directly
  UPDATE knowledge_bank_items
  SET organization_id = NULL
  WHERE organization_id = demo_org_id;
END $$;
