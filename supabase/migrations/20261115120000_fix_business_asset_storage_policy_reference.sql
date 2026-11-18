BEGIN;

DROP POLICY IF EXISTS
  "Business owners can upload business assets"
  ON storage.objects;

DROP POLICY IF EXISTS
  "Business owners can update business assets"
  ON storage.objects;

DROP POLICY IF EXISTS
  "Business owners can delete business assets"
  ON storage.objects;


-- Only the owner of the business can upload its banner or logo.
CREATE POLICY "Business owners can upload business assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  storage.objects.bucket_id = 'business-assets'
  AND cardinality(
    storage.foldername(storage.objects.name)
  ) = 2
  AND (storage.foldername(storage.objects.name))[2]
    IN ('banner', 'logo')
  AND EXISTS (
    SELECT 1
    FROM public.business_profiles AS bp
    WHERE bp.id::text =
      (storage.foldername(storage.objects.name))[1]
      AND bp.owner_id = (SELECT auth.uid())
  )
);


-- Only the owner can replace or update their own business assets.
CREATE POLICY "Business owners can update business assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  storage.objects.bucket_id = 'business-assets'
  AND cardinality(
    storage.foldername(storage.objects.name)
  ) = 2
  AND (storage.foldername(storage.objects.name))[2]
    IN ('banner', 'logo')
  AND EXISTS (
    SELECT 1
    FROM public.business_profiles AS bp
    WHERE bp.id::text =
      (storage.foldername(storage.objects.name))[1]
      AND bp.owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  storage.objects.bucket_id = 'business-assets'
  AND cardinality(
    storage.foldername(storage.objects.name)
  ) = 2
  AND (storage.foldername(storage.objects.name))[2]
    IN ('banner', 'logo')
  AND EXISTS (
    SELECT 1
    FROM public.business_profiles AS bp
    WHERE bp.id::text =
      (storage.foldername(storage.objects.name))[1]
      AND bp.owner_id = (SELECT auth.uid())
  )
);


-- Only the owner can delete their own business assets.
CREATE POLICY "Business owners can delete business assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  storage.objects.bucket_id = 'business-assets'
  AND cardinality(
    storage.foldername(storage.objects.name)
  ) = 2
  AND (storage.foldername(storage.objects.name))[2]
    IN ('banner', 'logo')
  AND EXISTS (
    SELECT 1
    FROM public.business_profiles AS bp
    WHERE bp.id::text =
      (storage.foldername(storage.objects.name))[1]
      AND bp.owner_id = (SELECT auth.uid())
  )
);

COMMIT;
