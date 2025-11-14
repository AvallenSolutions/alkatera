/*
  # Enhance Product LCA Tables for Phase 2 Calculations

  1. Changes to `product_lca_results`
    - Add `method` column to store LCIA method used
    - Add index for better query performance

  2. New Table: `product_lca_calculation_logs`
    - `id` (uuid, primary key)
    - `product_lca_id` (uuid, foreign key)
    - `status` (text: 'pending', 'success', 'failed')
    - `request_payload` (jsonb)
    - `response_data` (jsonb)
    - `error_message` (text, nullable)
    - `created_at` (timestamptz)

  3. Security
    - Enable RLS on calculation logs
    - Policies for organization-based access

  4. Notes
    - Supports OpenLCA API integration
    - Provides full audit trail of calculations
    - Enables troubleshooting and replay
*/

-- Add method column to product_lca_results if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_lca_results' 
    AND column_name = 'method'
  ) THEN
    ALTER TABLE public.product_lca_results 
    ADD COLUMN method TEXT;
  END IF;
END $$;

-- Create index on method for filtering
CREATE INDEX IF NOT EXISTS idx_product_lca_results_method 
ON public.product_lca_results(method);

-- Create product_lca_calculation_logs table
CREATE TABLE IF NOT EXISTS public.product_lca_calculation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_lca_id UUID NOT NULL REFERENCES public.product_lcas(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    request_payload JSONB,
    response_data JSONB,
    error_message TEXT,
    calculation_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_log_status CHECK (status IN ('pending', 'success', 'failed'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lca_calc_logs_lca_id 
ON public.product_lca_calculation_logs(product_lca_id);

CREATE INDEX IF NOT EXISTS idx_lca_calc_logs_status 
ON public.product_lca_calculation_logs(status);

CREATE INDEX IF NOT EXISTS idx_lca_calc_logs_created 
ON public.product_lca_calculation_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.product_lca_calculation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for calculation logs
CREATE POLICY "Users can view calculation logs for their organization's LCAs"
ON public.product_lca_calculation_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.product_lcas
        JOIN public.organization_members ON product_lcas.organization_id = organization_members.organization_id
        WHERE product_lcas.id = product_lca_calculation_logs.product_lca_id
        AND organization_members.user_id = auth.uid()
    )
);

-- Policy for inserting logs (edge functions will use service role)
CREATE POLICY "Service role can insert calculation logs"
ON public.product_lca_calculation_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.product_lca_calculation_logs IS 
'Audit log for all LCA calculation attempts, including request/response data for troubleshooting';

COMMENT ON COLUMN public.product_lca_results.method IS 
'LCIA method used for calculation (e.g., ReCiPe 2016, IPCC GWP100)';