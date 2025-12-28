/*
  # B Corp 2026 Standards Knowledge Bank Categories

  1. Changes
    - Remove default categories
    - Add 10 new categories aligned with B Corp 2026 Standards
    
  2. New Categories (aligned with B Corp 2026 Impact Areas)
    - **Governance & Ethics** - Mission governance, stakeholder engagement, ethics policies
    - **Climate Action & GHG** - Climate strategy, emissions reduction, carbon neutrality
    - **Worker Wellbeing** - Compensation, benefits, health & safety, training
    - **Diversity & Inclusion** - DEI policies, equity practices, accessibility
    - **Environmental Stewardship** - Waste reduction, water management, biodiversity
    - **Circular Economy** - Resource efficiency, product lifecycle, sustainable materials
    - **Community Impact** - Local economic development, civic engagement, charitable giving
    - **Supply Chain Responsibility** - Supplier standards, ethical sourcing, traceability
    - **Customer Stewardship** - Product impact, marketing ethics, customer wellbeing
    - **Reporting & Transparency** - Impact measurement, disclosure, certifications

  3. Colors & Icons
    - Each category has a distinct colour and Lucide icon for easy identification
*/

-- Delete existing default categories (this will cascade to items if any exist)
DELETE FROM knowledge_bank_categories 
WHERE name IN (
  'Document Templates',
  'Training Videos', 
  'Standard Operating Procedures',
  'Compliance Documents',
  'Quick Reference Guides'
);

-- Insert B Corp 2026-aligned categories for all organizations
INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Governance & Ethics',
  'Mission governance, stakeholder engagement, ethics policies, and corporate transparency',
  'Shield',
  'slate',
  1
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Climate Action & GHG',
  'Climate strategy, emissions reduction targets, carbon neutrality roadmaps, and GHG protocols',
  'CloudRain',
  'sky',
  2
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Worker Wellbeing',
  'Fair compensation, benefits, health & safety programmes, training, and career development',
  'Heart',
  'rose',
  3
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Diversity & Inclusion',
  'DEI policies, equity practices, accessibility standards, and inclusive workplace culture',
  'Users',
  'violet',
  4
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Environmental Stewardship',
  'Waste reduction, water management, biodiversity protection, and ecosystem restoration',
  'Leaf',
  'emerald',
  5
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Circular Economy',
  'Resource efficiency, product lifecycle management, sustainable materials, and regenerative design',
  'RefreshCw',
  'teal',
  6
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Community Impact',
  'Local economic development, civic engagement, charitable giving, and community partnerships',
  'Home',
  'amber',
  7
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Supply Chain Responsibility',
  'Supplier standards, ethical sourcing, fair trade practices, and supply chain traceability',
  'TruckIcon',
  'orange',
  8
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Customer Stewardship',
  'Product impact assessment, marketing ethics, customer wellbeing, and responsible innovation',
  'ShoppingBag',
  'blue',
  9
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO knowledge_bank_categories (organization_id, name, description, icon, color, sort_order)
SELECT
  id,
  'Reporting & Transparency',
  'Impact measurement, ESG disclosure, sustainability reporting, and third-party certifications',
  'FileText',
  'indigo',
  10
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;
