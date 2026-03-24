-- Convert Knowledge Bank items and tags created by the alkatera platform org
-- to global content (organization_id = NULL) so all organisations can see them.

DO $$
DECLARE
  _alkatera_org_id uuid;
BEGIN
  -- Find the alkatera platform org
  SELECT id INTO _alkatera_org_id
  FROM organizations
  WHERE slug = 'alkatera' AND is_platform_admin = true
  LIMIT 1;

  IF _alkatera_org_id IS NULL THEN
    RAISE NOTICE 'No alkatera platform org found - skipping';
    RETURN;
  END IF;

  -- Convert items to global
  UPDATE knowledge_bank_items
  SET organization_id = NULL
  WHERE organization_id = _alkatera_org_id;

  -- Convert tags to global (merge with any existing global tags of same name)
  -- First, re-point item_tags from org-scoped tags to existing global tags
  UPDATE knowledge_bank_item_tags kit
  SET tag_id = gt.id
  FROM knowledge_bank_tags ot
  JOIN knowledge_bank_tags gt
    ON LOWER(gt.name) = LOWER(ot.name) AND gt.organization_id IS NULL
  WHERE kit.tag_id = ot.id
    AND ot.organization_id = _alkatera_org_id;

  -- Delete org-scoped tags that now have a global equivalent
  DELETE FROM knowledge_bank_tags ot
  WHERE ot.organization_id = _alkatera_org_id
    AND EXISTS (
      SELECT 1 FROM knowledge_bank_tags gt
      WHERE LOWER(gt.name) = LOWER(ot.name) AND gt.organization_id IS NULL
    );

  -- Convert remaining org-scoped tags to global
  UPDATE knowledge_bank_tags
  SET organization_id = NULL
  WHERE organization_id = _alkatera_org_id;

  RAISE NOTICE 'Converted alkatera org KB items and tags to global content';
END $$;
