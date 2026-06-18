-- Add location and photo_urls columns to community_volunteer_activities
ALTER TABLE public.community_volunteer_activities
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';

-- Create storage bucket for volunteer activity photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('volunteer-photos', 'volunteer-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: org members can upload/read/delete their own org's photos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'volunteer_photos_select'
  ) THEN
    CREATE POLICY volunteer_photos_select ON storage.objects
      FOR SELECT USING (bucket_id = 'volunteer-photos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'volunteer_photos_insert'
  ) THEN
    CREATE POLICY volunteer_photos_insert ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'volunteer-photos'
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'volunteer_photos_delete'
  ) THEN
    CREATE POLICY volunteer_photos_delete ON storage.objects
      FOR DELETE USING (
        bucket_id = 'volunteer-photos'
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;
