
BEGIN;

-- Remove all broad table privileges, including TRUNCATE.
-- Row-level security does not protect against TRUNCATE.
REVOKE ALL PRIVILEGES
ON TABLE public.marketplace_listings
FROM PUBLIC, anon, authenticated;

-- Preserve the current signed-in browsing behaviour.
GRANT SELECT
ON TABLE public.marketplace_listings
TO authenticated;

-- Allow listing creation using seller-controlled fields only.
-- ID, status, created_at and promotion fields retain their defaults.
GRANT INSERT (
  seller_id,
  business_id,
  title,
  description,
  price,
  currency,
  category,
  location,
  image_urls,
  seller_country
)
ON TABLE public.marketplace_listings
TO authenticated;

-- Allow ordinary listing edits and the existing sold/removed workflow.
-- Do not allow clients to change seller identity or promotion controls.
GRANT UPDATE (
  business_id,
  title,
  description,
  price,
  currency,
  category,
  location,
  image_urls,
  status
)
ON TABLE public.marketplace_listings
TO authenticated;

-- Require the seller to own both the listing and its selected business.
DROP POLICY IF EXISTS
  "Owners can update their own listings"
  ON public.marketplace_listings;

CREATE POLICY "Owners can update their own listings"
ON public.marketplace_listings
FOR UPDATE
TO authenticated
USING (
  auth.uid() = seller_id
)
WITH CHECK (
  auth.uid() = seller_id
  AND (
    business_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.business_profiles AS bp
      WHERE bp.id = marketplace_listings.business_id
        AND bp.owner_id = auth.uid()
    )
  )
);

COMMIT;
