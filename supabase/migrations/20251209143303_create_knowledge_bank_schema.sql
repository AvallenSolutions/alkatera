/*
  # Create Knowledge Bank Schema

  1. New Tables
    - `knowledge_bank_categories`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `name` (text, category name)
      - `description` (text, category description)
      - `icon` (text, lucide icon name)
      - `color` (text, tailwind color class)
      - `sort_order` (integer, for custom ordering)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `knowledge_bank_items`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `category_id` (uuid, foreign key to knowledge_bank_categories)
      - `title` (text, resource title)
      - `description` (text, detailed description)
      - `content_type` (text, type: document, video, link, embedded)
      - `file_url` (text, storage URL or external link)
      - `file_name` (text, original filename)
      - `file_size` (bigint, size in bytes)
      - `mime_type` (text, file MIME type)
      - `thumbnail_url` (text, preview image)
      - `status` (text, draft/published/archived)
      - `version` (integer, version number)
      - `author_id` (uuid, foreign key to profiles)
      - `view_count` (integer, total views)
      - `download_count` (integer, total downloads)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `published_at` (timestamptz)

    - `knowledge_bank_tags`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `name` (text, tag name)
      - `created_at` (timestamptz)

    - `knowledge_bank_item_tags`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key to knowledge_bank_items)
      - `tag_id` (uuid, foreign key to knowledge_bank_tags)
      - `created_at` (timestamptz)

    - `knowledge_bank_views`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key to knowledge_bank_items)
      - `user_id` (uuid, foreign key to profiles)
      - `viewed_at` (timestamptz)

    - `knowledge_bank_favorites`
      - `id` (uuid, primary key)
      - `item_id` (uuid, foreign key to knowledge_bank_items)
      - `user_id` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for organization-level isolation
    - Implement role-based access for creation/editing
*/

-- =====================================================
-- KNOWLEDGE BANK CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_bank_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'BookOpen',
  color text DEFAULT 'blue',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE knowledge_bank_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's categories"
  ON knowledge_bank_categories FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create categories"
  ON knowledge_bank_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update categories"
  ON knowledge_bank_categories FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete categories"
  ON knowledge_bank_categories FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- =====================================================
-- KNOWLEDGE BANK ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_bank_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES knowledge_bank_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content_type text NOT NULL CHECK (content_type IN ('document', 'video', 'link', 'embedded')),
  file_url text,
  file_name text,
  file_size bigint DEFAULT 0,
  mime_type text,
  thumbnail_url text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version integer DEFAULT 1,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  view_count integer DEFAULT 0,
  download_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz
);

ALTER TABLE knowledge_bank_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view published items in their organization"
  ON knowledge_bank_items FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND (status = 'published' OR author_id = auth.uid())
  );

CREATE POLICY "Admins can create items"
  ON knowledge_bank_items FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Authors and admins can update items"
  ON knowledge_bank_items FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete items"
  ON knowledge_bank_items FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- =====================================================
-- KNOWLEDGE BANK TAGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_bank_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE knowledge_bank_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's tags"
  ON knowledge_bank_tags FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tags"
  ON knowledge_bank_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- KNOWLEDGE BANK ITEM TAGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_bank_item_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES knowledge_bank_items(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES knowledge_bank_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(item_id, tag_id)
);

ALTER TABLE knowledge_bank_item_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view item tags"
  ON knowledge_bank_item_tags FOR SELECT
  TO authenticated
  USING (
    item_id IN (
      SELECT id FROM knowledge_bank_items
      WHERE organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage item tags"
  ON knowledge_bank_item_tags FOR ALL
  TO authenticated
  USING (
    item_id IN (
      SELECT id FROM knowledge_bank_items
      WHERE organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- KNOWLEDGE BANK VIEWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_bank_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES knowledge_bank_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_bank_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own view history"
  ON knowledge_bank_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can record views"
  ON knowledge_bank_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- KNOWLEDGE BANK FAVORITES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_bank_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES knowledge_bank_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(item_id, user_id)
);

ALTER TABLE knowledge_bank_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
  ON knowledge_bank_favorites FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own favorites"
  ON knowledge_bank_favorites FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_kb_categories_org ON knowledge_bank_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_sort ON knowledge_bank_categories(organization_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_kb_items_org ON knowledge_bank_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_kb_items_category ON knowledge_bank_items(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_items_status ON knowledge_bank_items(status);
CREATE INDEX IF NOT EXISTS idx_kb_items_author ON knowledge_bank_items(author_id);
CREATE INDEX IF NOT EXISTS idx_kb_items_created ON knowledge_bank_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_items_views ON knowledge_bank_items(view_count DESC);

CREATE INDEX IF NOT EXISTS idx_kb_tags_org ON knowledge_bank_tags(organization_id);

CREATE INDEX IF NOT EXISTS idx_kb_item_tags_item ON knowledge_bank_item_tags(item_id);
CREATE INDEX IF NOT EXISTS idx_kb_item_tags_tag ON knowledge_bank_item_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_kb_views_item ON knowledge_bank_views(item_id);
CREATE INDEX IF NOT EXISTS idx_kb_views_user ON knowledge_bank_views(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_views_date ON knowledge_bank_views(viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_favorites_user ON knowledge_bank_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_favorites_item ON knowledge_bank_favorites(item_id);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_kb_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kb_categories_updated_at
  BEFORE UPDATE ON knowledge_bank_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_updated_at();

CREATE TRIGGER update_kb_items_updated_at
  BEFORE UPDATE ON knowledge_bank_items
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_updated_at();

-- =====================================================
-- SEED DEFAULT CATEGORIES
-- =====================================================
INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Document Templates',
  'Reusable templates for reports, forms, and documentation',
  'FileText',
  'blue',
  1
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Training Videos',
  'Video tutorials and training materials',
  'Video',
  'purple',
  2
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Standard Operating Procedures',
  'SOPs and process documentation',
  'ClipboardCheck',
  'green',
  3
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Compliance Documents',
  'Regulatory requirements and compliance materials',
  'ShieldCheck',
  'red',
  4
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Quick Reference Guides',
  'One-page guides and cheat sheets',
  'BookOpen',
  'yellow',
  5
FROM organizations
ON CONFLICT DO NOTHING;