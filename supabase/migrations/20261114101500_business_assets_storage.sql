
BEGIN;

-- A dedicated public-read bucket for business branding.
-- Upload, replacement and deletion remain restricted by ownership.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'business-assets',
  'business-assets',
  true,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


DROP POLICY IF EXISTS
  "Public can view business assets"
  ON storage.objects;

CREATE POLICY "Public can view business assets"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'business-assets'
);


DROP POLICY IF EXISTS
  "Business owners can upload business assets"
  ON storage.objects;

CREATE POLICY "Business owners can upload business assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-assets'
  AND cardinality(storage.foldername(name)) = 2
  AND (storage.foldername(name))[2] IN ('banner', 'logo')
  AND EXISTS (
    SELECT 1
    FROM public.business_profiles AS bp
    WHERE bp.id::text = (storage.foldername(name))[1]
      AND bp.owner_id = (SELECT auth.uid())
  )
);


DROP POLICY IF EXISTS
  "Business owners can update business assets"
  ON storage.objects;

CREATE POLICY "Business owners can update business assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-assets'
  AND cardinality(storage.foldername(name)) = 2
  AND (storage.foldername(name))[2] IN ('banner', 'logo')
  AND EXISTS (
    SELECT 1
    FROM public.business_profiles AS bp
    WHERE bp.id::text = (storage.foldername(name))[1]
      AND bp.owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'business-assets'
  AND cardinality(storage.foldername(name)) = 2
  AND (storage.foldername(name))[2] IN ('banner', 'logo')
  AND EXISTS (
    SELECT 1
    FROM public.business_profiles AS bp
    WHERE bp.id::text = (storage.foldername(name))[1]
      AND bp.owner_id = (SELECT auth.uid())
  )
);


DROP POLICY IF EXISTS
  "Business owners can delete business assets"
  ON storage.objects;

CREATE POLICY "Business owners can delete business assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-assets'
  AND cardinality(storage.foldername(name)) = 2
  AND (storage.foldername(name))[2] IN ('banner', 'logo')
  AND EXISTS (
    SELECT 1
    FROM public.business_profiles AS bp
    WHERE bp.id::text = (storage.foldername(name))[1]
      AND bp.owner_id = (SELECT auth.uid())
  )
);

COMMIT;
