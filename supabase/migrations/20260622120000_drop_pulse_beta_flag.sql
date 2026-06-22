-- Pulse is now GA (gated per-widget by subscription tier, see WIDGET_MIN_TIER
-- in lib/pulse/widget-registry.ts). The `pulse_beta` feature flag is no longer
-- read anywhere in the app, so strip the dead key from every org's feature_flags
-- to avoid lingering, misleading state. Idempotent: only touches rows that still
-- carry the key.
UPDATE public.organizations
SET feature_flags = feature_flags - 'pulse_beta',
    updated_at = now()
WHERE feature_flags ? 'pulse_beta';
