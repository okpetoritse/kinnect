-- Improve active Marketplace browsing and substring search.
-- Existing listing RLS policies and table permissions are unchanged.

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS pg_trgm
WITH SCHEMA extensions;

-- Default active Marketplace browsing.
CREATE INDEX IF NOT EXISTS marketplace_active_newest_idx
ON public.marketplace_listings (created_at DESC, id DESC)
WHERE status = 'active';

-- Country-filtered discovery.
CREATE INDEX IF NOT EXISTS marketplace_active_country_newest_idx
ON public.marketplace_listings (
  seller_country,
  created_at DESC,
  id DESC
)
WHERE status = 'active';

-- Business storefront catalogues.
CREATE INDEX IF NOT EXISTS marketplace_active_business_newest_idx
ON public.marketplace_listings (
  business_id,
  created_at DESC,
  id DESC
)
WHERE status = 'active';

-- Exact category filtering.
CREATE INDEX IF NOT EXISTS marketplace_active_category_newest_idx
ON public.marketplace_listings (
  category,
  created_at DESC,
  id DESC
)
WHERE status = 'active';

-- Featured/promoted listing selection.
CREATE INDEX IF NOT EXISTS marketplace_active_promoted_until_idx
ON public.marketplace_listings (
  promoted_until,
  created_at DESC
)
WHERE status = 'active'
  AND is_promoted = true;

-- Substring search used by title ILIKE '%term%'.
CREATE INDEX IF NOT EXISTS marketplace_title_trgm_idx
ON public.marketplace_listings
USING GIN (title extensions.gin_trgm_ops);

-- Substring search used by description ILIKE '%term%'.
CREATE INDEX IF NOT EXISTS marketplace_description_trgm_idx
ON public.marketplace_listings
USING GIN (description extensions.gin_trgm_ops);

-- Substring search used by category ILIKE '%term%'.
CREATE INDEX IF NOT EXISTS marketplace_category_trgm_idx
ON public.marketplace_listings
USING GIN (category extensions.gin_trgm_ops);

-- Support the two existing price sort orders.
CREATE INDEX IF NOT EXISTS marketplace_active_price_low_idx
ON public.marketplace_listings (
  price ASC NULLS LAST,
  created_at DESC,
  id DESC
)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS marketplace_active_price_high_idx
ON public.marketplace_listings (
  price DESC NULLS LAST,
  created_at DESC,
  id DESC
)
WHERE status = 'active';
