-- =============================================================================
-- Migration: production_run_resource_data
-- Purpose: Store actual resource consumption (electricity, water, wastewater)
-- measured per production run. This is the highest quality data — directly
-- measured and product-specific, requiring no allocation.
--
-- Supports two electricity input modes:
--   Mode 1: Total kWh per run (electricity_total_kwh)
--   Mode 2: kWh per day × production days (electricity_kwh_per_day * production_days)
-- A trigger auto-computes electricity_computed_kwh from whichever mode is used.
-- =============================================================================

-- 1. Create the new table
CREATE TABLE IF NOT EXISTS public.production_run_resource_data (
    id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    facility_id                 uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    organization_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    production_log_id           uuid REFERENCES public.production_logs(id) ON DELETE SET NULL,

    -- Production details (inline so entry can stand alone without a linked production_log)
    product_id                  bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    production_date             date NOT NULL,
    production_volume           numeric NOT NULL,
    production_volume_unit      text NOT NULL DEFAULT 'Litres',
    units_produced              numeric,

    -- Electricity (two input modes)
    electricity_total_kwh       numeric,                    -- Mode 1: direct total
    electricity_kwh_per_day     numeric,                    -- Mode 2: daily rate
    production_days             numeric,                    -- Mode 2: number of days
    electricity_computed_kwh    numeric,                    -- Always populated by trigger

    -- Water
    water_intake_m3             numeric,
    wastewater_discharge_m3     numeric,

    -- Data quality metadata
    data_provenance             text NOT NULL DEFAULT 'primary_supplier_verified',
    verification_status         text NOT NULL DEFAULT 'unverified',
    notes                       text,

    -- Audit
    created_by                  uuid NOT NULL,
    created_at                  timestamptz DEFAULT now(),
    updated_at                  timestamptz DEFAULT now(),

    -- Constraints
    CONSTRAINT prrd_positive_volume CHECK (production_volume > 0),
    CONSTRAINT prrd_valid_electricity CHECK (
        electricity_total_kwh IS NOT NULL
        OR (electricity_kwh_per_day IS NOT NULL AND production_days IS NOT NULL AND production_days > 0)
        OR (electricity_total_kwh IS NULL AND electricity_kwh_per_day IS NULL)
    ),
    CONSTRAINT prrd_electricity_non_negative CHECK (
        (electricity_total_kwh IS NULL OR electricity_total_kwh >= 0)
        AND (electricity_kwh_per_day IS NULL OR electricity_kwh_per_day >= 0)
        AND (electricity_computed_kwh IS NULL OR electricity_computed_kwh >= 0)
    ),
    CONSTRAINT prrd_water_non_negative CHECK (
        (water_intake_m3 IS NULL OR water_intake_m3 >= 0)
        AND (wastewater_discharge_m3 IS NULL OR wastewater_discharge_m3 >= 0)
    ),
    CONSTRAINT prrd_volume_unit_check CHECK (
        production_volume_unit IN ('Litres', 'Hectolitres', 'Units', 'kg')
    ),
    CONSTRAINT prrd_provenance_check CHECK (
        data_provenance IN (
            'primary_supplier_verified',
            'primary_measured_onsite',
            'secondary_calculated_allocation',
            'secondary_modelled_industry_average'
        )
    ),
    CONSTRAINT prrd_verification_check CHECK (
        verification_status IN ('unverified', 'self_declared', 'third_party_verified')
    )
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_prrd_facility
    ON public.production_run_resource_data(facility_id);

CREATE INDEX IF NOT EXISTS idx_prrd_product
    ON public.production_run_resource_data(product_id);

CREATE INDEX IF NOT EXISTS idx_prrd_organization
    ON public.production_run_resource_data(organization_id);

CREATE INDEX IF NOT EXISTS idx_prrd_date
    ON public.production_run_resource_data(production_date DESC);

CREATE INDEX IF NOT EXISTS idx_prrd_production_log
    ON public.production_run_resource_data(production_log_id)
    WHERE production_log_id IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE public.production_run_resource_data ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies (matching facility_production_volumes pattern — org membership check)
CREATE POLICY "Users can view production run data for their organization"
    ON public.production_run_resource_data
    FOR SELECT TO authenticated
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create production run data for their organization"
    ON public.production_run_resource_data
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id
            FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update production run data for their organization"
    ON public.production_run_resource_data
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

CREATE POLICY "Users can delete production run data for their organization"
    ON public.production_run_resource_data
    FOR DELETE TO authenticated
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- 5. Trigger: auto-compute electricity_computed_kwh from whichever input mode is used
CREATE OR REPLACE FUNCTION public.compute_prrd_electricity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.electricity_total_kwh IS NOT NULL THEN
        NEW.electricity_computed_kwh := NEW.electricity_total_kwh;
    ELSIF NEW.electricity_kwh_per_day IS NOT NULL AND NEW.production_days IS NOT NULL THEN
        NEW.electricity_computed_kwh := NEW.electricity_kwh_per_day * NEW.production_days;
    ELSE
        NEW.electricity_computed_kwh := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_compute_prrd_electricity
    BEFORE INSERT OR UPDATE ON public.production_run_resource_data
    FOR EACH ROW
    EXECUTE FUNCTION public.compute_prrd_electricity();

-- 6. Trigger: auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.update_prrd_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_prrd_updated_at
    BEFORE UPDATE ON public.production_run_resource_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_prrd_updated_at();
