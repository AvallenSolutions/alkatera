/*
  # Seed Gaia Knowledge Base with Emissions Methodology

  ## Purpose
  Add authoritative guidance about the corporate emissions calculation methodology
  to Gaia's knowledge base. This ensures Gaia always explains the methodology
  correctly and directs users to use the pre-calculated figures.

  ## New Knowledge Base Entries
  1. Corporate Emissions Calculation Methodology guideline
  2. Double-counting avoidance instruction
  3. Scope definitions

  ## Security
  - No changes to RLS policies (using existing gaia_knowledge_base table)
*/

-- Insert the emissions methodology guideline
INSERT INTO gaia_knowledge_base (
  entry_type,
  title,
  content,
  priority,
  is_active
) VALUES (
  'guideline',
  'Corporate Emissions Calculation Methodology',
  'The platform calculates corporate emissions following the GHG Protocol Corporate Standard. 
Key principles:
1. Scope 1 covers direct emissions from owned/controlled sources (facilities, company vehicles)
2. Scope 2 covers indirect emissions from purchased energy (electricity, heat, steam)
3. Scope 3 covers all other indirect emissions in the value chain
4. Product LCAs are disaggregated into scopes - only the Scope 3 portion (upstream supply chain) is added to corporate inventory to avoid double-counting facility emissions
5. Production volumes determine the corporate share of product emissions
6. All calculations use verified emission factors from DEFRA, IEA, and Ecoinvent',
  100,
  true
) ON CONFLICT DO NOTHING;

-- Insert the double-counting avoidance instruction
INSERT INTO gaia_knowledge_base (
  entry_type,
  title,
  content,
  priority,
  is_active
) VALUES (
  'instruction',
  'Avoid Double-Counting in Emissions Reporting',
  'CRITICAL: Never manually sum raw product LCA values when reporting corporate emissions. 
Product LCAs include facility Scope 1 and 2 which are already tracked separately.
Always use the pre-calculated figures from the Corporate Carbon Footprint section which correctly extracts only the Scope 3 portion from products.
If asked about total emissions, use the authoritative total from calculate_gaia_corporate_emissions.',
  99,
  true
) ON CONFLICT DO NOTHING;

-- Insert scope definitions
INSERT INTO gaia_knowledge_base (
  entry_type,
  title,
  content,
  priority,
  is_active
) VALUES (
  'definition',
  'GHG Protocol Scope Definitions',
  'Scope 1: Direct GHG emissions from sources owned or controlled by the company (e.g., company vehicles, on-site fuel combustion).
Scope 2: Indirect GHG emissions from purchased electricity, heat, or steam consumed by the company.
Scope 3: All other indirect GHG emissions in the value chain, categorised into 15 categories covering upstream and downstream activities.
The platform tracks Categories 1-8 which are most relevant to manufacturing and consumer goods companies.',
  90,
  true
) ON CONFLICT DO NOTHING;

-- Insert example Q&A for total carbon footprint
INSERT INTO gaia_knowledge_base (
  entry_type,
  title,
  content,
  example_question,
  example_answer,
  priority,
  is_active
) VALUES (
  'example_qa',
  'Total Carbon Footprint Query',
  'Example of how to answer questions about total emissions',
  'What is my total carbon footprint?',
  'Based on your Corporate Carbon Footprint data for [year]:

**Total Emissions: [X.XX] tCO2e**

This breaks down as:
- Scope 1 (Direct): [X.XX] tCO2e - from company vehicles and on-site fuel
- Scope 2 (Energy): [X.XX] tCO2e - from purchased electricity and heat
- Scope 3 (Value Chain): [X.XX] tCO2e - from products, travel, and purchased services

*Source: GHG Protocol calculation*

Would you like me to show the detailed Scope 3 breakdown, or identify your largest emission sources?',
  95,
  true
) ON CONFLICT DO NOTHING;
