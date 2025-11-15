/*
  # Create LCA Life Cycle Stages Classification System

  ## Overview
  This migration creates the two-tiered hierarchical classification system for
  Life Cycle Assessment (LCA) stages, providing the canonical reference data
  structure for emissions classification throughout the application.

  ## Tables Created

  ### 1. lca_life_cycle_stages
  Top-level LCA stages representing the five main phases of a product life cycle:
  - Raw Material Acquisition
  - Production/Manufacturing
  - Distribution/Transportation
  - Use Phase
  - End of Life

  Fields:
  - `id` (uuid, primary key)
  - `name` (text, unique, required) - The stage name
  - `description` (text) - Detailed explanation of the stage
  - `display_order` (integer) - Controls the display sequence in the UI
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. lca_sub_stages
  Detailed sub-classifications nested under each main stage, providing granular
  categorisation for specific activities and materials.

  Fields:
  - `id` (uuid, primary key)
  - `stage_id` (uuid, foreign key) - Links to parent lca_life_cycle_stages
  - `name` (text, required) - The sub-stage name
  - `description` (text) - Detailed explanation of the sub-stage
  - `display_order` (integer) - Controls display sequence within parent stage
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Both tables have RLS enabled
  - All authenticated users can read (reference data, not org-specific)
  - Only system administrators can modify (enforced at application layer)

  ## Indexes
  - stage_id indexed for optimal join performance
  - display_order indexed for efficient sorting

  ## Data Integrity
  - Foreign key constraint ensures all sub-stages link to valid parent stages
  - Unique constraint on stage name prevents duplicates
  - Unique constraint on (stage_id, name) prevents duplicate sub-stage names within a stage
*/

-- ============================================================================
-- STEP 1: Create Main Life Cycle Stages Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lca_life_cycle_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE public.lca_life_cycle_stages IS
'Reference table containing the five main Life Cycle Assessment stages as defined by ISO 14040/14044 standards. This is canonical reference data used throughout the application for emissions classification.';

COMMENT ON COLUMN public.lca_life_cycle_stages.display_order IS
'Controls the display order in the UI. Lower numbers appear first.';

-- Create index on display_order for sorting performance
CREATE INDEX IF NOT EXISTS idx_lca_stages_display_order
  ON public.lca_life_cycle_stages(display_order);

-- Enable Row Level Security
ALTER TABLE public.lca_life_cycle_stages ENABLE ROW LEVEL SECURITY;

-- Create policy: All authenticated users can read
CREATE POLICY "Authenticated users can view LCA stages"
  ON public.lca_life_cycle_stages
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- STEP 2: Create Sub-Stages Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lca_sub_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.lca_life_cycle_stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stage_id, name)
);

-- Add table comment
COMMENT ON TABLE public.lca_sub_stages IS
'Detailed sub-classifications for each main LCA stage. Provides granular categorisation for specific activities, materials, and processes within each life cycle phase.';

COMMENT ON COLUMN public.lca_sub_stages.stage_id IS
'Foreign key linking to the parent lca_life_cycle_stages record.';

COMMENT ON COLUMN public.lca_sub_stages.display_order IS
'Controls the display order within the parent stage. Lower numbers appear first.';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lca_sub_stages_stage_id
  ON public.lca_sub_stages(stage_id);

CREATE INDEX IF NOT EXISTS idx_lca_sub_stages_display_order
  ON public.lca_sub_stages(display_order);

-- Enable Row Level Security
ALTER TABLE public.lca_sub_stages ENABLE ROW LEVEL SECURITY;

-- Create policy: All authenticated users can read
CREATE POLICY "Authenticated users can view LCA sub-stages"
  ON public.lca_sub_stages
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- STEP 3: Seed Main Life Cycle Stages
-- ============================================================================

-- Insert the five standard LCA stages based on ISO 14040/14044
INSERT INTO public.lca_life_cycle_stages (name, description, display_order) VALUES
  (
    'Raw Material Acquisition',
    'Extraction and processing of raw materials from natural resources, including mining, harvesting, and initial material processing.',
    1
  ),
  (
    'Production/Manufacturing',
    'Transformation of raw materials into finished products, including all manufacturing processes, assembly, and packaging production.',
    2
  ),
  (
    'Distribution/Transportation',
    'Movement of materials and products through the supply chain, including logistics, storage, and retail distribution.',
    3
  ),
  (
    'Use Phase',
    'Consumer use of the product, including operation, maintenance, energy consumption, and product lifespan.',
    4
  ),
  (
    'End of Life',
    'Product disposal and waste management, including recycling, incineration, composting, and landfill disposal.',
    5
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STEP 4: Seed Sub-Stages for Each Main Stage
-- ============================================================================

-- Sub-stages for Raw Material Acquisition
INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Agricultural Production',
  'Cultivation and harvesting of plant-based raw materials including grains, fruits, vegetables, and fibres.',
  1
FROM public.lca_life_cycle_stages
WHERE name = 'Raw Material Acquisition'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Animal Husbandry',
  'Raising and processing of livestock and animal-derived materials including meat, dairy, and leather.',
  2
FROM public.lca_life_cycle_stages
WHERE name = 'Raw Material Acquisition'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Mining and Extraction',
  'Extraction of mineral resources including metals, ores, and industrial minerals from the earth.',
  3
FROM public.lca_life_cycle_stages
WHERE name = 'Raw Material Acquisition'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Forestry',
  'Harvesting and primary processing of wood and wood-based materials.',
  4
FROM public.lca_life_cycle_stages
WHERE name = 'Raw Material Acquisition'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Fossil Fuel Extraction',
  'Extraction and primary refining of petroleum, natural gas, and coal.',
  5
FROM public.lca_life_cycle_stages
WHERE name = 'Raw Material Acquisition'
ON CONFLICT (stage_id, name) DO NOTHING;

-- Sub-stages for Production/Manufacturing
INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Ingredient Processing',
  'Processing and transformation of raw ingredients into food-grade components.',
  1
FROM public.lca_life_cycle_stages
WHERE name = 'Production/Manufacturing'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Product Manufacturing',
  'Assembly and production of the final product from processed ingredients.',
  2
FROM public.lca_life_cycle_stages
WHERE name = 'Production/Manufacturing'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Packaging Production',
  'Manufacturing of all packaging materials including primary, secondary, and tertiary packaging.',
  3
FROM public.lca_life_cycle_stages
WHERE name = 'Production/Manufacturing'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Energy Production',
  'Generation of energy used in manufacturing processes including electricity, heat, and steam.',
  4
FROM public.lca_life_cycle_stages
WHERE name = 'Production/Manufacturing'
ON CONFLICT (stage_id, name) DO NOTHING;

-- Sub-stages for Distribution/Transportation
INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Road Transport',
  'Transportation by truck, van, or other road vehicles.',
  1
FROM public.lca_life_cycle_stages
WHERE name = 'Distribution/Transportation'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Sea Freight',
  'Transportation by cargo ship or other maritime vessels.',
  2
FROM public.lca_life_cycle_stages
WHERE name = 'Distribution/Transportation'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Air Freight',
  'Transportation by aeroplane or air cargo services.',
  3
FROM public.lca_life_cycle_stages
WHERE name = 'Distribution/Transportation'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Rail Transport',
  'Transportation by train or railway systems.',
  4
FROM public.lca_life_cycle_stages
WHERE name = 'Distribution/Transportation'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Warehousing',
  'Storage and inventory management in distribution centres and warehouses.',
  5
FROM public.lca_life_cycle_stages
WHERE name = 'Distribution/Transportation'
ON CONFLICT (stage_id, name) DO NOTHING;

-- Sub-stages for Use Phase
INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Consumer Use',
  'Direct use of the product by end consumers.',
  1
FROM public.lca_life_cycle_stages
WHERE name = 'Use Phase'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Refrigeration',
  'Energy consumption for cooling and cold storage during the use phase.',
  2
FROM public.lca_life_cycle_stages
WHERE name = 'Use Phase'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Preparation',
  'Energy and resources used in product preparation, cooking, or heating.',
  3
FROM public.lca_life_cycle_stages
WHERE name = 'Use Phase'
ON CONFLICT (stage_id, name) DO NOTHING;

-- Sub-stages for End of Life
INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Recycling',
  'Collection, sorting, and reprocessing of materials for reuse.',
  1
FROM public.lca_life_cycle_stages
WHERE name = 'End of Life'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Composting',
  'Biological decomposition of organic materials into compost.',
  2
FROM public.lca_life_cycle_stages
WHERE name = 'End of Life'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Incineration',
  'Thermal treatment of waste through combustion, often with energy recovery.',
  3
FROM public.lca_life_cycle_stages
WHERE name = 'End of Life'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Landfill',
  'Disposal of waste in controlled landfill sites.',
  4
FROM public.lca_life_cycle_stages
WHERE name = 'End of Life'
ON CONFLICT (stage_id, name) DO NOTHING;

INSERT INTO public.lca_sub_stages (stage_id, name, description, display_order)
SELECT
  id,
  'Anaerobic Digestion',
  'Biological breakdown of organic materials in the absence of oxygen to produce biogas.',
  5
FROM public.lca_life_cycle_stages
WHERE name = 'End of Life'
ON CONFLICT (stage_id, name) DO NOTHING;
