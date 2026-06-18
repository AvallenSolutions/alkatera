-- Multi-modal inbound transport for product_materials
--
-- Context:
--   Inbound ingredients can arrive via a chain of transport modes:
--   e.g., truck (supplier → port) → ship (Chile → UK) → truck (UK port → facility).
--
--   Previously only a single transport_mode + distance_km was supported.
--   This migration adds transport_legs JSONB to store multiple legs.
--
-- Column format (DistributionLeg[]):
--   [
--     { "id": "leg_abc", "label": "Supplier to port", "transportMode": "truck",  "distanceKm": 200 },
--     { "id": "leg_def", "label": "Sea freight",      "transportMode": "ship",   "distanceKm": 14000 },
--     { "id": "leg_ghi", "label": "Port to facility", "transportMode": "truck",  "distanceKm": 150 }
--   ]
--
-- Backward compatibility:
--   - transport_mode and distance_km are NOT removed.
--   - When transport_legs IS set, the calculator uses all legs and ignores
--     transport_mode / distance_km.
--   - When transport_legs IS NULL (old rows), the calculator falls back to
--     transport_mode + distance_km as a single leg (unchanged behaviour).
--   - The save flow also writes transport_mode = legs[0].transportMode and
--     distance_km = legs[0].distanceKm so old reports remain consistent.
--
-- Valid transport modes: 'truck' | 'train' | 'ship' | 'air'
-- Emission factors from DEFRA 2025 (same as outbound distribution).
-- ============================================================================

ALTER TABLE product_materials
  ADD COLUMN IF NOT EXISTS transport_legs jsonb;

COMMENT ON COLUMN product_materials.transport_legs IS
  'Multi-modal inbound transport legs (DistributionLeg[]). When present, '
  'overrides the single transport_mode + distance_km fields. '
  'Each leg: { id, label, transportMode, distanceKm }. '
  'transportMode ∈ {truck, train, ship, air}.';
