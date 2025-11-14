/*
  # Create Products Table with LCA Definition Fields

  1. New ENUM Types
    - `functional_unit_type_enum` - Product packaging types (bottle, can, pack, unit)
    - `functional_unit_measure_enum` - Volume measurements (ml, l)
    - `system_boundary_enum` - LCA scope boundaries (cradle_to_gate, cradle_to_grave)

  2. New Table: `products`
    - `id` (uuid, primary key)
    - `organization_id` (uuid, foreign key to organizations)
    - `name` (text, required)
    - `product_description` (text, optional)
    - `product_image_url` (text, optional)
    - `functional_unit_type` (enum, optional)
    - `functional_unit_volume` (numeric, optional)
    - `functional_unit_measure` (enum, optional)
    - `system_boundary` (enum, required, default: cradle_to_gate)
    - `created_by` (uuid, foreign key to auth.users)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Security
    - Enable RLS
    - Policies for organization-based access
    - Automatic audit fields

  4. Notes
    - ENUM types enforce data integrity at database level
    - System boundary controls downstream data requirements
    - Supports Supabase Storage integration for images
    - Complies with greenwashing regulation guardrails
*/

-- Create ENUM types for data integrity
CREATE TYPE public.functional_unit_type_enum AS ENUM ('bottle', 'can', 'pack', 'unit');
CREATE TYPE public.functional_unit_measure_enum AS ENUM ('ml', 'l');
CREATE TYPE public.system_boundary_enum AS ENUM ('cradle_to_gate', 'cradle_to_grave');

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    product_description TEXT,
    product_image_url TEXT,
    functional_unit_type public.functional_unit_type_enum,
    functional_unit_volume NUMERIC,
    functional_unit_measure public.functional_unit_measure_enum,
    system_boundary public.system_boundary_enum NOT NULL DEFAULT 'cradle_to_gate',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_organization_id 
ON public.products(organization_id);

CREATE INDEX IF NOT EXISTS idx_products_created_by 
ON public.products(created_by);

CREATE INDEX IF NOT EXISTS idx_products_system_boundary 
ON public.products(system_boundary);

CREATE INDEX IF NOT EXISTS idx_products_created_at 
ON public.products(created_at DESC);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at 
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policy for viewing products
CREATE POLICY "Users can view products in their organization"
ON public.products
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_members.organization_id = products.organization_id
        AND organization_members.user_id = auth.uid()
    )
);

-- RLS Policy for inserting products
CREATE POLICY "Users can insert products in their organization"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_members.organization_id = products.organization_id
        AND organization_members.user_id = auth.uid()
    )
);

-- RLS Policy for updating products
CREATE POLICY "Users can update products in their organization"
ON public.products
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_members.organization_id = products.organization_id
        AND organization_members.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_members.organization_id = products.organization_id
        AND organization_members.user_id = auth.uid()
    )
);

-- RLS Policy for deleting products
CREATE POLICY "Users can delete products in their organization"
ON public.products
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_members.organization_id = products.organization_id
        AND organization_members.user_id = auth.uid()
    )
);

-- Add comments for documentation
COMMENT ON TABLE public.products IS 
'Product definitions for Life Cycle Assessment with compliance guardrails';

COMMENT ON COLUMN public.products.functional_unit_type IS 
'The type of packaging or unit for the product (bottle, can, pack, unit)';

COMMENT ON COLUMN public.products.functional_unit_volume IS 
'The volume quantity of the functional unit';

COMMENT ON COLUMN public.products.functional_unit_measure IS 
'The measurement unit for the volume (ml, l)';

COMMENT ON COLUMN public.products.system_boundary IS 
'Defines the scope of the LCA calculation, controlling downstream data requirements. Cradle-to-gate is for internal/B2B only.';

COMMENT ON COLUMN public.products.product_image_url IS 
'URL pointing to the product image in Supabase Storage (products-images bucket)';

COMMENT ON COLUMN public.products.product_description IS 
'Detailed description of the product for LCA context';