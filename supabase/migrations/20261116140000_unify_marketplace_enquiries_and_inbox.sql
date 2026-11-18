
BEGIN;

-- ---------------------------------------------------------
-- 1. Preserve the business identity on listing enquiry cards
-- ---------------------------------------------------------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS listing_business_id uuid
    REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS listing_business_name text;

CREATE INDEX IF NOT EXISTS messages_listing_enquiry_idx
  ON public.messages (listing_id, sender_id, receiver_id)
  WHERE listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_unread_inbox_idx
  ON public.messages (receiver_id, sender_id)
  WHERE read_at IS NULL;


-- ---------------------------------------------------------
-- 2. Restrict anonymous database privileges
-- ---------------------------------------------------------

REVOKE ALL PRIVILEGES
ON TABLE public.messages
FROM PUBLIC, anon;

-- Keep existing authenticated SELECT, INSERT, UPDATE and DELETE
-- permissions because the current chat uses these operations.
-- Remove privileges that ordinary messaging does not need.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.messages
FROM authenticated;


-- ---------------------------------------------------------
-- 3. Restrict direct message insertion
--
-- First listing enquiries must go through the dedicated RPC.
-- Ordinary friend messages and replies in an existing listing
-- conversation continue to use the existing chat actions.
-- ---------------------------------------------------------

DROP POLICY IF EXISTS
  "Users can message friends or about the recipient's listing"
  ON public.messages;

CREATE POLICY "Users can message friends or reply in listing conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND receiver_id IS NOT NULL
  AND receiver_id <> auth.uid()
  AND NOT public.is_blocked_with(receiver_id)

  -- Only the dedicated SECURITY DEFINER RPC may create
  -- the original Marketplace enquiry card.
  AND listing_id IS NULL
  AND listing_title IS NULL
  AND listing_price IS NULL
  AND listing_currency IS NULL
  AND listing_image_url IS NULL
  AND listing_business_id IS NULL
  AND listing_business_name IS NULL

  AND (
    EXISTS (
      SELECT 1
      FROM public.friend_requests AS fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.sender_id = auth.uid()
            AND fr.receiver_id = messages.receiver_id)
          OR
          (fr.receiver_id = auth.uid()
            AND fr.sender_id = messages.receiver_id)
        )
    )
    OR public.has_valid_listing_conversation(receiver_id)
  )
);


-- ---------------------------------------------------------
-- 4. Atomically initiate or reuse a listing enquiry
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_listing_conversation(
  p_listing_id uuid
)
RETURNS TABLE (
  message_id uuid,
  seller_id uuid,
  listing_title text,
  created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_buyer_id uuid := auth.uid();
  v_listing record;
  v_existing_message_id uuid;
  v_new_message_id uuid;
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'Listing ID is required'
      USING ERRCODE = '22004';
  END IF;

  SELECT
    l.id,
    l.seller_id,
    l.title,
    l.price,
    l.currency,
    l.image_urls,
    l.business_id,
    bp.name AS business_name
  INTO v_listing
  FROM public.marketplace_listings AS l
  LEFT JOIN public.business_profiles AS bp
    ON bp.id = l.business_id
  WHERE l.id = p_listing_id
    AND l.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This listing is no longer available'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_listing.seller_id = v_buyer_id THEN
    RAISE EXCEPTION 'You cannot contact yourself about your listing'
      USING ERRCODE = '42501';
  END IF;

  IF public.is_blocked_with(v_listing.seller_id) THEN
    RAISE EXCEPTION 'You cannot contact this seller'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize attempts by the same buyer for the same listing.
  -- This prevents simultaneous clicks/retries from creating
  -- duplicate enquiry cards.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_buyer_id::text || ':' || p_listing_id::text,
      0
    )
  );

  SELECT m.id
  INTO v_existing_message_id
  FROM public.messages AS m
  WHERE m.listing_id = p_listing_id
    AND m.sender_id = v_buyer_id
    AND m.receiver_id = v_listing.seller_id
  ORDER BY m.created_at ASC NULLS LAST, m.id ASC
  LIMIT 1;

  IF v_existing_message_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      v_existing_message_id,
      v_listing.seller_id,
      v_listing.title,
      false;
    RETURN;
  END IF;

  INSERT INTO public.messages (
    sender_id,
    receiver_id,
    content,
    listing_id,
    listing_title,
    listing_price,
    listing_currency,
    listing_image_url,
    listing_business_id,
    listing_business_name
  )
  VALUES (
    v_buyer_id,
    v_listing.seller_id,
    NULL,
    v_listing.id,
    v_listing.title,
    v_listing.price,
    v_listing.currency,
    v_listing.image_urls[1],
    v_listing.business_id,
    v_listing.business_name
  )
  RETURNING id INTO v_new_message_id;

  RETURN QUERY
  SELECT
    v_new_message_id,
    v_listing.seller_id,
    v_listing.title,
    true;
END;
$function$;


REVOKE ALL
ON FUNCTION public.start_listing_conversation(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.start_listing_conversation(uuid)
TO authenticated;


-- ---------------------------------------------------------
-- 5. Unified inbox: accepted friends + all message contacts
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_message_inbox(
  p_cursor_at timestamptz DEFAULT NULL,
  p_cursor_user_id uuid DEFAULT NULL,
  p_page_size integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  founding_number numeric,
  last_message_preview text,
  last_message_time timestamptz,
  unread_count bigint,
  cursor_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$

WITH current_user_data AS (
  SELECT auth.uid() AS user_id
),

participants AS (
  -- Accepted friends remain visible even before they have
  -- exchanged their first message.
  SELECT
    CASE
      WHEN fr.sender_id = me.user_id THEN fr.receiver_id
      ELSE fr.sender_id
    END AS other_user_id,
    fr.created_at AS activity_at
  FROM public.friend_requests AS fr
  CROSS JOIN current_user_data AS me
  WHERE fr.status = 'accepted'
    AND (
      fr.sender_id = me.user_id
      OR fr.receiver_id = me.user_id
    )

  UNION ALL

  -- Include every person with whom the user has exchanged messages,
  -- including non-friend Marketplace buyers and sellers.
  SELECT
    CASE
      WHEN m.sender_id = me.user_id THEN m.receiver_id
      ELSE m.sender_id
    END AS other_user_id,
    m.created_at AS activity_at
  FROM public.messages AS m
  CROSS JOIN current_user_data AS me
  WHERE
    m.sender_id = me.user_id
    OR m.receiver_id = me.user_id
),

conversation_people AS (
  SELECT
    p.other_user_id,
    MAX(p.activity_at) AS last_activity
  FROM participants AS p
  CROSS JOIN current_user_data AS me
  WHERE p.other_user_id IS NOT NULL
    AND p.other_user_id <> me.user_id
  GROUP BY p.other_user_id
)

SELECT
  pr.id,
  pr.full_name,
  pr.username,
  pr.avatar_url,
  pr.founding_number::numeric,

  COALESCE(
    latest.preview,
    ''
  ) AS last_message_preview,

  latest.created_at AS last_message_time,

  COALESCE(unread.message_count, 0)::bigint AS unread_count,

  COALESCE(
    latest.created_at,
    cp.last_activity,
    'epoch'::timestamptz
  ) AS cursor_at

FROM conversation_people AS cp
JOIN public.profiles AS pr
  ON pr.id = cp.other_user_id
CROSS JOIN current_user_data AS me

LEFT JOIN LATERAL (
  SELECT
    m.created_at,
    CASE
      WHEN m.listing_title IS NOT NULL THEN
        'Asked about ' || m.listing_title ||
        CASE
          WHEN NULLIF(m.listing_business_name, '') IS NOT NULL
          THEN ' · ' || m.listing_business_name
          ELSE ''
        END

      WHEN NULLIF(pg_catalog.btrim(m.content), '') IS NOT NULL
        THEN pg_catalog.left(m.content, 100)

      WHEN m.image_url IS NOT NULL THEN 'Photo'
      WHEN m.video_url IS NOT NULL THEN 'Video'
      WHEN m.sticker_id IS NOT NULL THEN 'Sent a sticker'
      WHEN m.audio_url IS NOT NULL THEN 'Voice message'
      WHEN m.ping_label IS NOT NULL THEN m.ping_label
      WHEN m.call_status IS NOT NULL THEN 'Call'
      ELSE 'Message'
    END AS preview

  FROM public.messages AS m
  WHERE
    (
      m.sender_id = me.user_id
      AND m.receiver_id = cp.other_user_id
    )
    OR
    (
      m.sender_id = cp.other_user_id
      AND m.receiver_id = me.user_id
    )
  ORDER BY m.created_at DESC NULLS LAST, m.id DESC
  LIMIT 1
) AS latest ON true

LEFT JOIN LATERAL (
  SELECT COUNT(*) AS message_count
  FROM public.messages AS m
  WHERE m.sender_id = cp.other_user_id
    AND m.receiver_id = me.user_id
    AND m.read_at IS NULL
) AS unread ON true

WHERE
  me.user_id IS NOT NULL
  AND (
    p_cursor_at IS NULL
    OR COALESCE(
      latest.created_at,
      cp.last_activity,
      'epoch'::timestamptz
    ) < p_cursor_at
    OR (
      COALESCE(
        latest.created_at,
        cp.last_activity,
        'epoch'::timestamptz
      ) = p_cursor_at
      AND pr.id < p_cursor_user_id
    )
  )

ORDER BY cursor_at DESC, pr.id DESC
LIMIT LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 50);

$function$;


REVOKE ALL
ON FUNCTION public.get_my_message_inbox(timestamptz, uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.get_my_message_inbox(timestamptz, uuid, integer)
TO authenticated;


COMMIT;
