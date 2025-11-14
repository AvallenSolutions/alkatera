/*
  # Create Product LCA Tables (Phase 1: Draft & Save)

  1. New Tables
    - `product_lcas`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `product_name` (text)
      - `functional_unit` (text)
      - `system_boundary` (text)
      - `status` (text, default 'draft')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `product_lca_inputs`
      - `id` (uuid, primary key)
      - `product_lca_id` (uuid, foreign key to product_lcas)
      - `input_data` (jsonb, stores full array of user inputs)
      - `created_at` (timestamptz)
    
    - `product_lca_results`
      - `id` (uuid, primary key)
      - `product_lca_id` (uuid, foreign key to product_lcas)
      - `impact_category` (text)
      - `value` (numeric)
      - `unit` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for organization-based access control
    - Restrict access to organization members only

  3. Notes
    - Phase 1 focuses on draft creation and data capture
    - Results table prepared for Phase 2 & 3 (calculation engine)
    - All input data stored immutably in JSONB format
*/

-- Create product_lcas table
CREATE TABLE IF NOT EXISTS public.product_lcas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    functional_unit TEXT NOT NULL,
    system_boundary TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'pending', 'completed', 'failed'))
);

-- Create index for faster organization queries
CREATE INDEX IF NOT EXISTS idx_product_lcas_organization_id ON public.product_lcas(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_lcas_status ON public.product_lcas(status);

-- Enable RLS on product_lcas
ALTER TABLE public.product_lcas ENABLE ROW LEVEL SECURITY;

-- RLS Policy for product_lcas
CREATE POLICY "Users can manage LCAs for their organization"
ON public.product_lcas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_lcas.organization_id
    AND organization_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_lcas.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Create product_lca_inputs table
CREATE TABLE IF NOT EXISTS public.product_lca_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_lca_id UUID NOT NULL REFERENCES public.product_lcas(id) ON DELETE CASCADE,
    input_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster LCA queries
CREATE INDEX IF NOT EXISTS idx_product_lca_inputs_lca_id ON public.product_lca_inputs(product_lca_id);

-- Enable RLS on product_lca_inputs
ALTER TABLE public.product_lca_inputs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for product_lca_inputs
CREATE POLICY "Users can manage inputs for their organization's LCAs"
ON public.product_lca_inputs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.product_lcas
        JOIN public.organization_members ON product_lcas.organization_id = organization_members.organization_id
        WHERE product_lcas.id = product_lca_inputs.product_lca_id
        AND organization_members.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.product_lcas
        JOIN public.organization_members ON product_lcas.organization_id = organization_members.organization_id
        WHERE product_lcas.id = product_lca_inputs.product_lca_id
        AND organization_members.user_id = auth.uid()
    )
);

-- Create product_lca_results table (prepared for Phase 2 & 3)
CREATE TABLE IF NOT EXISTS public.product_lca_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_lca_id UUID NOT NULL REFERENCES public.product_lcas(id) ON DELETE CASCADE,
    impact_category TEXT NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster LCA queries
CREATE INDEX IF NOT EXISTS idx_product_lca_results_lca_id ON public.product_lca_results(product_lca_id);
CREATE INDEX IF NOT EXISTS idx_product_lca_results_category ON public.product_lca_results(impact_category);

-- Enable RLS on product_lca_results
ALTER TABLE public.product_lca_results ENABLE ROW LEVEL SECURITY;

-- RLS Policy for product_lca_results (read-only for now)
CREATE POLICY "Users can view results for their organization's LCAs"
ON public.product_lca_results
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.product_lcas
        JOIN public.organization_members ON product_lcas.organization_id = organization_members.organization_id
        WHERE product_lcas.id = product_lca_results.product_lca_id
        AND organization_members.user_id = auth.uid()
    )
);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_lca_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_lcas_updated_at
BEFORE UPDATE ON public.product_lcas
FOR EACH ROW
EXECUTE FUNCTION update_product_lca_updated_at();