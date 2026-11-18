BEGIN;

-- Keep the bucket public for viewing listing photos, but limit uploads
-- to supported image formats and a maximum of 5 MB per file.
UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
WHERE id = 'marketplace';

-- Replace the old policy that allowed uploads anywhere in the bucket.
DROP POLICY IF EXISTS
  "Authenticated users can upload marketplace images"
  ON storage.objects;

CREATE POLICY "Sellers can upload their own marketplace images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'marketplace'
  AND cardinality(storage.foldername(name)) = 1
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Sellers can delete only images stored in their own folder.
CREATE POLICY "Sellers can delete their own marketplace images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'marketplace'
  AND cardinality(storage.foldername(name)) = 1
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- The existing public SELECT policy is intentionally retained.

COMMIT;