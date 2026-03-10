-- =============================================================================
-- Migration: facility_production_volumes
-- Purpose: Decouple production volume tracking from facility_reporting_sessions
-- so users can manage production volumes independently of data entry sessions.
-- Part of the Reporting Period Simplification plan.
-- =============================================================================

-- 1. Create the new table
CREATE TABLE IF NOT EXISTS public.facility_production_volumes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    reporting_period_start date NOT NULL,
    reporting_period_end date NOT NULL,
    production_volume numeric NOT NULL,
    volume_unit text NOT NULL,
    data_source_type text NOT NULL DEFAULT 'Primary',
    facility_activity_type text,
    fallback_intensity_factor numeric,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT fpv_valid_period CHECK (reporting_period_end > reporting_period_start),
    CONSTRAINT fpv_positive_volume CHECK (production_volume > 0),
    CONSTRAINT fpv_data_source_check CHECK (data_source_type IN ('Primary', 'Secondary_Average')),
    CONSTRAINT fpv_unique_facility_period UNIQUE (facility_id, reporting_period_start, reporting_period_end)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_fpv_facility_period
    ON public.facility_production_volumes(facility_id, reporting_period_start);

CREATE INDEX IF NOT EXISTS idx_fpv_organization
    ON public.facility_production_volumes(organization_id);

-- 3. Enable RLS
ALTER TABLE public.facility_production_volumes ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies (matching facility_reporting_sessions pattern — org membership check)
CREATE POLICY "Users can view production volumes for their organization"
    ON public.facility_production_volumes
    FOR SELECT TO authenticated
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create production volumes for their organization"
    ON public.facility_production_volumes
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id
            FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update production volumes for their organization"
    ON public.facility_production_volumes
    FOR UPDATE TO authenticated
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id
            FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete production volumes for their organization"
    ON public.facility_production_volumes
    FOR DELETE TO authenticated
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- 5. Backfill from existing facility_reporting_sessions
-- Only insert where production volume is meaningful (> 0) and data_source_type is Primary
INSERT INTO public.facility_production_volumes (
    facility_id,
    organization_id,
    reporting_period_start,
    reporting_period_end,
    production_volume,
    volume_unit,
    data_source_type,
    facility_activity_type,
    fallback_intensity_factor,
    created_by,
    created_at,
    updated_at
)
SELECT
    frs.facility_id,
    frs.organization_id,
    frs.reporting_period_start,
    frs.reporting_period_end,
    frs.total_production_volume,
    frs.volume_unit,
    frs.data_source_type,
    frs.facility_activity_type,
    frs.fallback_intensity_factor,
    frs.created_by,
    frs.created_at,
    frs.updated_at
FROM public.facility_reporting_sessions frs
WHERE frs.total_production_volume > 0
ON CONFLICT (facility_id, reporting_period_start, reporting_period_end)
DO NOTHING;

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_facility_production_volumes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fpv_updated_at
    BEFORE UPDATE ON public.facility_production_volumes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_facility_production_volumes_updated_at();
