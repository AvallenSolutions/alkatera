-- Add inbound_container_material column to product_materials so that users
-- selecting a custom delivery container can specify the material and get an
-- accurate emission factor without having to look up and enter the EF manually.

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS inbound_container_material text;

COMMENT ON COLUMN public.product_materials.inbound_container_material IS
  'Material of the inbound delivery container (e.g. HDPE, LDPE, steel, glass, aluminium). Used to look up the manufacturing emission factor when container type is ''custom'' and no manual EF override is provided.';
