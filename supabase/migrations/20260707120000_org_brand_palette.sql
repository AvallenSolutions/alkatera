-- Brand-coloured rooms: store a tenant's brand colour and the studio room
-- palette derived from it. Both nullable; when null the app falls back to
-- the default studio palette (forest/teal/cobalt/plum/ochre/brick/ink).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_colour text,
  ADD COLUMN IF NOT EXISTS room_palette jsonb;

COMMENT ON COLUMN public.organizations.brand_colour IS
  'The org''s seed brand colour (#RRGGBB), captured from their website or set in settings.';
COMMENT ON COLUMN public.organizations.room_palette IS
  'Pre-computed studio room palette derived from brand_colour (see lib/studio/brand-palette.ts). Null = default studio palette.';
