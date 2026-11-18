BEGIN;

-- One personal account may own multiple business profiles.
ALTER TABLE public.business_profiles
DROP CONSTRAINT IF EXISTS business_profiles_owner_id_key;

-- Preserve efficient queries for a user's businesses.
CREATE INDEX IF NOT EXISTS business_profiles_owner_id_idx
ON public.business_profiles (owner_id);

-- Prepare the storefront for an uploaded cover banner.
ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMIT;