-- Impact Proxy Values table
-- Stores alkatera's versioned proxy values (shadow prices) used to monetise each impact metric.

CREATE TABLE IF NOT EXISTS impact_proxy_values (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capital     text NOT NULL,           -- 'natural' | 'human' | 'social' | 'governance'
  metric_key  text NOT NULL,           -- e.g. 'carbon_tonne', 'living_wage_gap_gbp'
  label       text NOT NULL,           -- human-readable label
  proxy_value numeric(12,4) NOT NULL,  -- £ per unit
  unit        text NOT NULL,           -- e.g. 'per tCO2e', 'per £1 gap', 'per hour'
  source      text NOT NULL,           -- citation: 'Defra 2024', 'HM Treasury Green Book 2022', etc.
  version     text NOT NULL DEFAULT '1.0',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS impact_proxy_values_key_version_idx
  ON impact_proxy_values (metric_key, version)
  WHERE is_active = true;

-- Seed initial proxy values (v1.0)
INSERT INTO impact_proxy_values (capital, metric_key, label, proxy_value, unit, source)
VALUES
  ('natural',    'carbon_tonne',           'Carbon (GHG)',            259.0000, 'per tCO2e',                 'Defra 2024 shadow carbon price (central)'),
  ('natural',    'water_m3',               'Water Use',                 0.9000, 'per m³ world-eq',           'Defra 2024 water abstraction charge proxy (AWARE scarcity-weighted)'),
  ('natural',    'land_ha',                'Land Use',                183.0000, 'per ha/yr',                 'Natural Capital Coalition proxy'),
  ('natural',    'waste_tonne',            'Waste to Landfill',       102.0000, 'per tonne',                 'UK landfill tax 2024 (£102.10/t)'),
  ('human',      'living_wage_gap_gbp',    'Living Wage Uplift',        1.0000, 'per £1 gap/yr',             'Direct monetary value'),
  ('human',      'training_hour',          'Employee Training',        13.0000, 'per hour',                  'CIPD Learning at Work Survey 2023'),
  ('human',      'wellbeing_score_point',  'Employee Wellbeing',      420.0000, 'per 1pt score improvement', 'Wellbeing Economy Alliance / HACT proxy'),
  ('social',     'volunteering_hour',      'Volunteering Hours',       28.0000, 'per hour',                  'NCVO UK Voluntary Sector 2023 (median wage proxy)'),
  ('social',     'charitable_giving_gbp',  'Charitable Giving',         1.0000, 'per £1 donated',            'Direct monetary value'),
  ('social',     'local_multiplier',       'Local Supply Chain Spend',  0.6300, 'per £1 local spend',        'NEF Local Multiplier 3 (LM3) coefficient'),
  ('governance', 'governance_score_point', 'Governance Quality',     1250.0000, 'per 1pt score (0–100)',     'Social Value Bank SROI proxy')
ON CONFLICT DO NOTHING;
