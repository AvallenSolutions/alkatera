-- Raise supplier-logos bucket file size limit from 2MB to 10MB
-- to match other image buckets and client-side upload limits.

UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id = 'supplier-logos';
