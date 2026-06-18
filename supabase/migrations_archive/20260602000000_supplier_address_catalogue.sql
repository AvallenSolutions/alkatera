-- ==========================================================================
-- Add address, geolocation, catalogue, and phone columns to suppliers table
-- Also creates a public supplier-logos bucket for reliable logo serving
-- ==========================================================================

-- 1. Add new columns to suppliers table
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS lng numeric(10,7),
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS catalogue_url text,
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.suppliers.address IS 'Full formatted address from Google Places';
COMMENT ON COLUMN public.suppliers.city IS 'Extracted city name';
COMMENT ON COLUMN public.suppliers.lat IS 'Latitude for map display';
COMMENT ON COLUMN public.suppliers.lng IS 'Longitude for map display';
COMMENT ON COLUMN public.suppliers.country_code IS 'ISO 2-letter country code';
COMMENT ON COLUMN public.suppliers.catalogue_url IS 'URL to uploaded product catalogue (PDF/Excel)';
COMMENT ON COLUMN public.suppliers.phone IS 'Contact phone number';

-- 2. Create a dedicated public bucket for supplier logos
-- The existing supplier-product-images bucket has conflicting public/private
-- state from earlier migrations, causing getPublicUrl() failures.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-logos',
  'supplier-logos',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. RLS policies for supplier-logos bucket
-- Allow authenticated users to upload to their own folder (supplier_id prefix)
CREATE POLICY "Suppliers can upload their own logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'supplier-logos');

CREATE POLICY "Suppliers can update their own logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'supplier-logos');

CREATE POLICY "Suppliers can delete their own logo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'supplier-logos');

-- Public read access (logos are public)
CREATE POLICY "Anyone can view supplier logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'supplier-logos');

-- 4. Create a dedicated bucket for supplier catalogues
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-catalogues',
  'supplier-catalogues',
  true,
  10485760, -- 10MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];

-- RLS policies for supplier-catalogues bucket
CREATE POLICY "Suppliers can upload catalogues"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'supplier-catalogues');

CREATE POLICY "Suppliers can update catalogues"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'supplier-catalogues');

CREATE POLICY "Suppliers can delete catalogues"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'supplier-catalogues');

CREATE POLICY "Anyone can view supplier catalogues"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'supplier-catalogues');
