-- B Corp 2026 Standards Seed Data
-- Deactivates old B Corp v2.1 and inserts new B Corp 2026 framework with
-- Foundation Requirements + 7 Impact Topics, pass/fail model, Year 0/3/5 progression

-- 1. Mark old B Corp framework as legacy
UPDATE "public"."certification_frameworks"
SET
  "framework_name" = 'B Corp Certification (Legacy v2.1)',
  "name" = 'B Corp Certification (Legacy v2.1)',
  "is_active" = false,
  "updated_at" = now()
WHERE "framework_code" = 'bcorp_21';

-- 2. Insert new B Corp 2026 framework
INSERT INTO "public"."certification_frameworks" (
  "id", "framework_code", "framework_name", "framework_version",
  "description", "governing_body", "website_url",
  "is_active", "effective_date", "has_scoring", "passing_score",
  "name", "code", "version", "category", "display_order", "total_points",
  "scoring_model", "progression_model"
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'bcorp_2026',
  'B Corp Certification',
  '2026',
  'The 2026 B Corp Standards replace the points-based B Impact Assessment with mandatory pass/fail requirements across Foundation Requirements and 7 Impact Topics. Requirements escalate across Year 0, Year 3, and Year 5, with all requirements mandatory for certification renewal.',
  'B Lab',
  'https://www.bcorporation.net/',
  true,
  '2026-01-01',
  true,
  100.00,
  'B Corp Certification',
  'bcorp_2026',
  '2026',
  'Impact Certification',
  1,
  0,
  'pass_fail',
  '{"years": [0, 3, 5], "labels": ["Year 0 — Initial Certification", "Year 3 — Deepening Impact", "Year 5 — Full Compliance"]}'
);

-- 3. Insert Foundation Requirements (Year 0 — all mandatory from day one)

-- Foundation Requirement: Eligibility
INSERT INTO "public"."certification_framework_requirements" (
  "framework_id", "requirement_code", "requirement_name", "requirement_category",
  "section", "description", "max_points", "is_mandatory", "order_index",
  "applicable_from_year", "size_threshold", "topic_area",
  "points_available", "is_required"
) VALUES
-- Eligibility Requirements
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FR-E-001', 'Legal Entity Eligibility', 'Foundation Requirements',
 'Eligibility', 'Business must be a legally registered entity operating for at least 12 months with revenue.',
 1, true, 1, 0, 'all', 'foundation', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FR-E-002', 'B Corp Declaration of Interdependence', 'Foundation Requirements',
 'Eligibility', 'Sign the B Corp Declaration of Interdependence committing to using business as a force for good.',
 1, true, 2, 0, 'all', 'foundation', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FR-E-003', 'Disclosure Questionnaire', 'Foundation Requirements',
 'Eligibility', 'Complete and pass the Disclosure Questionnaire covering sensitive practices and industries.',
 1, true, 3, 0, 'all', 'foundation', 1, true),

-- Legal Commitment Requirements
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FR-L-001', 'Legal Commitment to Stakeholders', 'Foundation Requirements',
 'Legal Commitment', 'Amend governing documents to require consideration of all stakeholder interests in decision-making.',
 1, true, 4, 0, 'all', 'foundation', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FR-L-002', 'Benefit Entity Status', 'Foundation Requirements',
 'Legal Commitment', 'Where available, adopt Benefit Corporation or equivalent legal entity status.',
 1, true, 5, 0, 'all', 'foundation', 1, true),

-- Risk Management Requirements
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FR-R-001', 'Anti-Corruption & Ethics Policy', 'Foundation Requirements',
 'Risk Management', 'Implement anti-corruption and business ethics policies and training.',
 1, true, 6, 0, 'all', 'foundation', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FR-R-002', 'Whistleblower Mechanism', 'Foundation Requirements',
 'Risk Management', 'Establish confidential reporting mechanism for ethics concerns and whistleblowing.',
 1, true, 7, 0, 'all', 'foundation', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FR-R-003', 'Data Privacy & Security', 'Foundation Requirements',
 'Risk Management', 'Implement data privacy and security practices compliant with applicable regulations.',
 1, true, 8, 0, 'all', 'foundation', 1, true),

-- 4. Impact Topic 1: Purpose & Stakeholder Governance
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT1-Y0-001', 'Mission Statement', 'Purpose & Stakeholder Governance',
 'Purpose & Stakeholder Governance', 'Articulate a clear social or environmental mission embedded in company purpose.',
 1, true, 10, 0, 'all', 'Purpose & Stakeholder Governance', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT1-Y0-002', 'Stakeholder Governance Structure', 'Purpose & Stakeholder Governance',
 'Purpose & Stakeholder Governance', 'Board or governance body includes stakeholder perspectives in decision-making.',
 1, true, 11, 0, 'all', 'Purpose & Stakeholder Governance', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT1-Y0-003', 'Impact Reporting', 'Purpose & Stakeholder Governance',
 'Purpose & Stakeholder Governance', 'Publish annual impact report covering social and environmental performance.',
 1, true, 12, 0, 'all', 'Purpose & Stakeholder Governance', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT1-Y3-001', 'Stakeholder Advisory Mechanism', 'Purpose & Stakeholder Governance',
 'Purpose & Stakeholder Governance', 'Establish formal stakeholder advisory panel or regular engagement mechanism.',
 1, true, 13, 3, 'all', 'Purpose & Stakeholder Governance', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT1-Y5-001', 'Long-term Impact Strategy', 'Purpose & Stakeholder Governance',
 'Purpose & Stakeholder Governance', 'Develop and publish long-term (5+ year) impact strategy with measurable goals.',
 1, true, 14, 5, 'all', 'Purpose & Stakeholder Governance', 1, true),

-- 5. Impact Topic 2: Fair Work
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT2-Y0-001', 'Living Wage', 'Fair Work',
 'Fair Work', 'Pay at least a living wage to all employees (or commit to a plan to achieve within 2 years).',
 1, true, 20, 0, 'all', 'Fair Work', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT2-Y0-002', 'Worker Health & Safety', 'Fair Work',
 'Fair Work', 'Implement health and safety management system with incident tracking and prevention.',
 1, true, 21, 0, 'all', 'Fair Work', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT2-Y0-003', 'Employment Contracts', 'Fair Work',
 'Fair Work', 'Provide written employment contracts to all workers with clear terms and conditions.',
 1, true, 22, 0, 'all', 'Fair Work', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT2-Y3-001', 'Worker Voice & Representation', 'Fair Work',
 'Fair Work', 'Implement mechanisms for worker feedback and collective voice in workplace decisions.',
 1, true, 23, 3, 'all', 'Fair Work', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT2-Y3-002', 'Pay Equity Analysis', 'Fair Work',
 'Fair Work', 'Conduct pay equity analysis across gender and other demographic categories.',
 1, true, 24, 3, 'all', 'Fair Work', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT2-Y5-001', 'Comprehensive Benefits', 'Fair Work',
 'Fair Work', 'Provide comprehensive benefits including parental leave, professional development, and wellbeing support.',
 1, true, 25, 5, 'all', 'Fair Work', 1, true),

-- 6. Impact Topic 3: Justice, Equity, Diversity & Inclusion (JEDI)
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT3-Y0-001', 'JEDI Commitment', 'Justice, Equity, Diversity & Inclusion',
 'Justice, Equity, Diversity & Inclusion', 'Public commitment to JEDI with dedicated policy and executive accountability.',
 1, true, 30, 0, 'all', 'Justice, Equity, Diversity & Inclusion', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT3-Y0-002', 'Non-Discrimination Policy', 'Justice, Equity, Diversity & Inclusion',
 'Justice, Equity, Diversity & Inclusion', 'Implement comprehensive non-discrimination and anti-harassment policies.',
 1, true, 31, 0, 'all', 'Justice, Equity, Diversity & Inclusion', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT3-Y3-001', 'Diversity Data Collection', 'Justice, Equity, Diversity & Inclusion',
 'Justice, Equity, Diversity & Inclusion', 'Collect and analyse workforce diversity data across leadership and all levels.',
 1, true, 32, 3, 'all', 'Justice, Equity, Diversity & Inclusion', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT3-Y5-001', 'Equity Targets & Outcomes', 'Justice, Equity, Diversity & Inclusion',
 'Justice, Equity, Diversity & Inclusion', 'Set measurable diversity and inclusion targets with tracked outcomes.',
 1, true, 33, 5, 'all', 'Justice, Equity, Diversity & Inclusion', 1, true),

-- 7. Impact Topic 4: Human Rights
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT4-Y0-001', 'Human Rights Policy', 'Human Rights',
 'Human Rights', 'Adopt human rights policy aligned with UN Guiding Principles on Business and Human Rights.',
 1, true, 40, 0, 'all', 'Human Rights', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT4-Y0-002', 'Forced & Child Labour Prevention', 'Human Rights',
 'Human Rights', 'Implement policies and due diligence to prevent forced labour and child labour in operations and supply chain.',
 1, true, 41, 0, 'all', 'Human Rights', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT4-Y3-001', 'Human Rights Due Diligence', 'Human Rights',
 'Human Rights', 'Conduct regular human rights due diligence across operations and key supply chain partners.',
 1, true, 42, 3, 'all', 'Human Rights', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT4-Y5-001', 'Remediation Mechanisms', 'Human Rights',
 'Human Rights', 'Establish accessible grievance mechanisms and remediation processes for rights holders.',
 1, true, 43, 5, 'all', 'Human Rights', 1, true),

-- 8. Impact Topic 5: Climate Action
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT5-Y0-001', 'GHG Emissions Measurement', 'Climate Action',
 'Climate Action', 'Measure and report Scope 1 and 2 greenhouse gas emissions annually.',
 1, true, 50, 0, 'all', 'Climate Action', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT5-Y0-002', 'Climate Commitment', 'Climate Action',
 'Climate Action', 'Commit to emissions reduction aligned with science-based targets or equivalent.',
 1, true, 51, 0, 'all', 'Climate Action', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT5-Y3-001', 'Scope 3 Emissions', 'Climate Action',
 'Climate Action', 'Measure and report material Scope 3 emissions categories.',
 1, true, 52, 3, 'all', 'Climate Action', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT5-Y3-002', 'Emissions Reduction Plan', 'Climate Action',
 'Climate Action', 'Implement and track progress against a time-bound emissions reduction plan.',
 1, true, 53, 3, 'all', 'Climate Action', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT5-Y5-001', 'Net Zero Pathway', 'Climate Action',
 'Climate Action', 'Demonstrate progress toward net zero target with validated science-based pathway.',
 1, true, 54, 5, 'all', 'Climate Action', 1, true),

-- 9. Impact Topic 6: Environmental Stewardship & Circularity
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT6-Y0-001', 'Environmental Management', 'Environmental Stewardship & Circularity',
 'Environmental Stewardship & Circularity', 'Implement environmental management practices for waste, water, and resource use.',
 1, true, 60, 0, 'all', 'Environmental Stewardship & Circularity', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT6-Y0-002', 'Waste Reduction & Recycling', 'Environmental Stewardship & Circularity',
 'Environmental Stewardship & Circularity', 'Measure waste generation and implement waste reduction and recycling programmes.',
 1, true, 61, 0, 'all', 'Environmental Stewardship & Circularity', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT6-Y3-001', 'Circular Economy Practices', 'Environmental Stewardship & Circularity',
 'Environmental Stewardship & Circularity', 'Adopt circular economy principles in product design, packaging, or operations.',
 1, true, 62, 3, 'all', 'Environmental Stewardship & Circularity', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT6-Y3-002', 'Water Stewardship', 'Environmental Stewardship & Circularity',
 'Environmental Stewardship & Circularity', 'Measure water use and implement water efficiency and stewardship practices.',
 1, true, 63, 3, 'all', 'Environmental Stewardship & Circularity', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT6-Y5-001', 'Biodiversity & Nature', 'Environmental Stewardship & Circularity',
 'Environmental Stewardship & Circularity', 'Assess and mitigate impacts on biodiversity and natural ecosystems.',
 1, true, 64, 5, 'all', 'Environmental Stewardship & Circularity', 1, true),

-- 10. Impact Topic 7: Government Affairs & Collective Action
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT7-Y0-001', 'Responsible Political Engagement', 'Government Affairs & Collective Action',
 'Government Affairs & Collective Action', 'Commit to transparent and responsible political engagement and lobbying practices.',
 1, true, 70, 0, 'all', 'Government Affairs & Collective Action', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT7-Y0-002', 'B Corp Community Participation', 'Government Affairs & Collective Action',
 'Government Affairs & Collective Action', 'Actively participate in the B Corp community through events, knowledge sharing, or mentoring.',
 1, true, 71, 0, 'all', 'Government Affairs & Collective Action', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT7-Y3-001', 'Industry Collaboration', 'Government Affairs & Collective Action',
 'Government Affairs & Collective Action', 'Participate in industry-level sustainability initiatives or standards development.',
 1, true, 72, 3, 'all', 'Government Affairs & Collective Action', 1, true),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT7-Y5-001', 'Systemic Change Advocacy', 'Government Affairs & Collective Action',
 'Government Affairs & Collective Action', 'Advocate for systemic change through policy engagement or collective action initiatives.',
 1, true, 73, 5, 'all', 'Government Affairs & Collective Action', 1, true);
