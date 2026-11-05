-- Create a restricted function for marking incoming messages as read.
CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_sender_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_sender_id IS NULL THEN
    RAISE EXCEPTION 'Sender ID is required'
      USING ERRCODE = '22004';
  END IF;

  IF p_sender_id = v_user_id THEN
    RETURN 0;
  END IF;

  UPDATE public.messages
  SET read_at = pg_catalog.now()
  WHERE receiver_id = v_user_id
    AND sender_id = p_sender_id
    AND read_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$function$;

-- Restrict execution to authenticated users.
REVOKE ALL ON FUNCTION public.mark_messages_read(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid)
TO authenticated;