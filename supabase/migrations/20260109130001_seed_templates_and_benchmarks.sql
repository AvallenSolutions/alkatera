-- Seed data for report templates and industry benchmarks

-- ============================================
-- SYSTEM REPORT TEMPLATES
-- ============================================

INSERT INTO report_templates (id, name, description, template_type, config, is_public, tags, industry) VALUES
(
  gen_random_uuid(),
  'CDP Climate Change Disclosure 2024',
  'Pre-configured for CDP Climate Change questionnaire requirements. Includes all mandatory sections with TCFD alignment.',
  'system',
  '{
    "audience": "regulators",
    "outputFormat": "docx",
    "standards": ["cdp", "tcfd", "ghg-protocol"],
    "sections": [
      "executive-summary",
      "company-overview",
      "scope-1-2-3",
      "ghg-inventory",
      "targets",
      "methodology",
      "regulatory"
    ],
    "branding": {
      "primaryColor": "#2563eb",
      "secondaryColor": "#10b981"
    }
  }'::jsonb,
  true,
  ARRAY['cdp', 'disclosure', 'climate'],
  'all'
),
(
  gen_random_uuid(),
  'CSRD E1 Climate Change Compliance',
  'Complete CSRD E1 (Climate Change) reporting template with all required datapoints for EU mandatory reporting.',
  'system',
  '{
    "audience": "regulators",
    "outputFormat": "docx",
    "standards": ["csrd", "iso-14064"],
    "sections": [
      "executive-summary",
      "company-overview",
      "scope-1-2-3",
      "ghg-inventory",
      "carbon-origin",
      "targets",
      "methodology",
      "regulatory"
    ],
    "branding": {
      "primaryColor": "#0ea5e9",
      "secondaryColor": "#8b5cf6"
    }
  }'::jsonb,
  true,
  ARRAY['csrd', 'eu', 'mandatory', 'compliance'],
  'all'
),
(
  gen_random_uuid(),
  'Investor ESG Report',
  'Comprehensive sustainability report designed for investors and shareholders. Focuses on financial materiality and ROI of sustainability initiatives.',
  'system',
  '{
    "audience": "investors",
    "outputFormat": "pptx",
    "standards": ["gri", "sasb", "tcfd"],
    "sections": [
      "executive-summary",
      "company-overview",
      "scope-1-2-3",
      "product-footprints",
      "multi-capital",
      "trends",
      "targets"
    ],
    "branding": {
      "primaryColor": "#059669",
      "secondaryColor": "#f59e0b"
    }
  }'::jsonb,
  true,
  ARRAY['investor', 'esg', 'financial'],
  'all'
),
(
  gen_random_uuid(),
  'Product Carbon Footprint Report (ISO 14067)',
  'Detailed product-level LCA report following ISO 14067 standards. Ideal for B2B customers and supply chain partners.',
  'system',
  '{
    "audience": "customers",
    "outputFormat": "docx",
    "standards": ["iso-14067"],
    "sections": [
      "executive-summary",
      "product-footprints",
      "ghg-inventory",
      "carbon-origin",
      "supply-chain",
      "methodology"
    ],
    "branding": {
      "primaryColor": "#16a34a",
      "secondaryColor": "#0284c7"
    }
  }'::jsonb,
  true,
  ARRAY['product', 'lca', 'iso-14067', 'b2b'],
  'manufacturing'
),
(
  gen_random_uuid(),
  'Annual Sustainability Summary',
  'Executive-level overview of sustainability performance. Perfect for annual reports and stakeholder communications.',
  'system',
  '{
    "audience": "internal",
    "outputFormat": "pptx",
    "standards": ["gri"],
    "sections": [
      "executive-summary",
      "company-overview",
      "scope-1-2-3",
      "trends",
      "targets"
    ],
    "branding": {
      "primaryColor": "#dc2626",
      "secondaryColor": "#ea580c"
    }
  }'::jsonb,
  true,
  ARRAY['annual', 'summary', 'executive'],
  'all'
),
(
  gen_random_uuid(),
  'Supply Chain Emissions Report',
  'Focused on Scope 3 Category 1 (Purchased Goods & Services). Ideal for supplier engagement and value chain mapping.',
  'system',
  '{
    "audience": "supply-chain",
    "outputFormat": "xlsx",
    "standards": ["ghg-protocol"],
    "sections": [
      "executive-summary",
      "scope-1-2-3",
      "supply-chain",
      "product-footprints",
      "methodology"
    ],
    "branding": {
      "primaryColor": "#7c3aed",
      "secondaryColor": "#ec4899"
    }
  }'::jsonb,
  true,
  ARRAY['supply-chain', 'scope-3', 'procurement'],
  'all'
),
(
  gen_random_uuid(),
  'Science-Based Targets Progress Report',
  'Track progress toward SBTi-validated targets. Includes trajectory analysis and gap assessment.',
  'system',
  '{
    "audience": "regulators",
    "outputFormat": "docx",
    "standards": ["sbti", "ghg-protocol"],
    "sections": [
      "executive-summary",
      "scope-1-2-3",
      "trends",
      "targets",
      "methodology"
    ],
    "branding": {
      "primaryColor": "#0891b2",
      "secondaryColor": "#06b6d4"
    }
  }'::jsonb,
  true,
  ARRAY['sbti', 'targets', 'progress'],
  'all'
),
(
  gen_random_uuid(),
  'Quick Assessment Report',
  'Lightweight report for initial assessment. Includes only essential sections.',
  'system',
  '{
    "audience": "internal",
    "outputFormat": "pptx",
    "standards": ["ghg-protocol"],
    "sections": [
      "executive-summary",
      "scope-1-2-3"
    ],
    "branding": {
      "primaryColor": "#2563eb",
      "secondaryColor": "#10b981"
    }
  }'::jsonb,
  true,
  ARRAY['quick', 'assessment', 'starter'],
  'all'
);

-- ============================================
-- INDUSTRY BENCHMARKS
-- ============================================

-- Food & Beverage Industry
INSERT INTO industry_benchmarks (industry, metric_name, metric_value, unit, percentile, year, source) VALUES
('food_beverage', 'emissions_intensity', 180.0, 'kg CO2e per $1M revenue', 'average', 2024, 'Industry Analysis 2024'),
('food_beverage', 'emissions_intensity', 95.0, 'kg CO2e per $1M revenue', 'top_quartile', 2024, 'Industry Analysis 2024'),
('food_beverage', 'emissions_intensity', 285.0, 'kg CO2e per $1M revenue', 'bottom_quartile', 2024, 'Industry Analysis 2024'),
('food_beverage', 'scope3_percentage', 65.0, '% of total emissions', 'average', 2024, 'Industry Analysis 2024'),
('food_beverage', 'scope3_percentage', 55.0, '% of total emissions', 'top_quartile', 2024, 'Industry Analysis 2024'),
('food_beverage', 'data_quality_tier1', 25.0, '% Tier 1 data', 'average', 2024, 'Industry Analysis 2024'),

-- Manufacturing
('manufacturing', 'emissions_intensity', 250.0, 'kg CO2e per $1M revenue', 'average', 2024, 'Industry Analysis 2024'),
('manufacturing', 'emissions_intensity', 150.0, 'kg CO2e per $1M revenue', 'top_quartile', 2024, 'Industry Analysis 2024'),
('manufacturing', 'emissions_intensity', 380.0, 'kg CO2e per $1M revenue', 'bottom_quartile', 2024, 'Industry Analysis 2024'),
('manufacturing', 'scope3_percentage', 70.0, '% of total emissions', 'average', 2024, 'Industry Analysis 2024'),
('manufacturing', 'renewable_energy', 35.0, '% renewable energy', 'average', 2024, 'Industry Analysis 2024'),

-- Technology
('technology', 'emissions_intensity', 85.0, 'kg CO2e per $1M revenue', 'average', 2024, 'Industry Analysis 2024'),
('technology', 'emissions_intensity', 45.0, 'kg CO2e per $1M revenue', 'top_quartile', 2024, 'Industry Analysis 2024'),
('technology', 'scope2_percentage', 45.0, '% of total emissions', 'average', 2024, 'Industry Analysis 2024'),
('technology', 'renewable_energy', 65.0, '% renewable energy', 'average', 2024, 'Industry Analysis 2024'),

-- Retail
('retail', 'emissions_intensity', 120.0, 'kg CO2e per $1M revenue', 'average', 2024, 'Industry Analysis 2024'),
('retail', 'emissions_intensity', 75.0, 'kg CO2e per $1M revenue', 'top_quartile', 2024, 'Industry Analysis 2024'),
('retail', 'scope3_percentage', 80.0, '% of total emissions', 'average', 2024, 'Industry Analysis 2024'),

-- Professional Services
('professional_services', 'emissions_intensity', 50.0, 'kg CO2e per $1M revenue', 'average', 2024, 'Industry Analysis 2024'),
('professional_services', 'emissions_intensity', 25.0, 'kg CO2e per $1M revenue', 'top_quartile', 2024, 'Industry Analysis 2024'),
('professional_services', 'scope3_percentage', 75.0, '% of total emissions', 'average', 2024, 'Industry Analysis 2024');

-- Add comment
COMMENT ON TABLE report_templates IS 'Contains system templates (pre-built) and user-created templates for report generation';
COMMENT ON TABLE industry_benchmarks IS 'Industry averages for benchmarking organizational performance';
